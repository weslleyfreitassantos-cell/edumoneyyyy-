from __future__ import annotations

import datetime as dt
import hashlib
import importlib.util
import io
import tempfile
import tarfile
import unittest
from argparse import Namespace
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VERIFIER = ROOT / "ops/backup/verify-edumoney-bundle-stream.py"
MODULE_PATH = Path(__file__).with_name("verify-local-recovery-proof.py")
SPEC = importlib.util.spec_from_file_location("verify_local_recovery_proof", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
verify = MODULE.verify
COMPONENTS = {
    "globals.sql": b"-- globals fixture\n",
    "postgres.dump": b"disposable database dump fixture",
    "supabase-meta.dump": b"metadata fixture",
    "storage.tar.gz": b"storage fixture archive",
    "config.tar.gz": b"encrypted config fixture",
}


def make_tar(entries: dict[str, bytes]) -> bytes:
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w:gz") as archive:
        for name, content in entries.items():
            info = tarfile.TarInfo(name)
            info.size = len(content)
            archive.addfile(info, io.BytesIO(content))
    return output.getvalue()


class LocalRecoveryProofTests(unittest.TestCase):
    def test_parses_manifest_timestamp_with_hyphens_in_time(self) -> None:
        parsed = MODULE.parse_utc("2026-10-26T07-31-18Z", "test timestamp")
        self.assertEqual(parsed.isoformat(), "2026-10-26T07:31:18+00:00")

    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.directory = Path(self.temp.name)
        self.backup = self.directory / "bundle.tar.gz"
        self.receipt = self.directory / "restore.receipt"
        now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
        storage_tar = make_tar({"bucket/sample.bin": b"sample"})
        components = dict(COMPONENTS, **{"storage.tar.gz": storage_tar})
        checksums = "".join(
            f"{hashlib.sha256(value).hexdigest()}  {name}\n" for name, value in components.items()
        ).encode()
        manifest = f"created_utc={now.isoformat().replace('+00:00', 'Z')}\n".encode()
        self.backup.write_bytes(make_tar({**components, "MANIFEST.txt": manifest, "SHA256SUMS": checksums}))
        self.sha256 = hashlib.sha256(self.backup.read_bytes()).hexdigest()
        self.bytes = self.backup.stat().st_size
        self.verified_at = now.isoformat().replace("+00:00", "Z")
        self.write_receipt()
        self.args = Namespace(
            backup_file=str(self.backup),
            receipt_file=str(self.receipt),
            expected_sha256=self.sha256,
            repo_root=str(ROOT),
            bundle_verifier=str(VERIFIER),
            max_age_hours=24,
        )

    def tearDown(self) -> None:
        self.temp.cleanup()

    def write_receipt(self, **overrides: str) -> None:
        values = {
            "format": "tec-school-local-restore-proof-v1",
            "status": "PASS",
            "backup_sha256": getattr(self, "sha256", ""),
            "backup_bytes": str(getattr(self, "bytes", 0)),
            "verified_at_utc": getattr(self, "verified_at", ""),
            "restore_mode": "isolated-postgres",
            "database_cleanup": "dropped",
        }
        values.update(overrides)
        self.receipt.write_text("".join(f"{key}={value}\n" for key, value in values.items()), encoding="utf-8")

    def test_recent_intact_backup_with_matching_restore_proof_passes(self) -> None:
        evidence = verify(self.args)
        self.assertEqual(evidence["status"], "PASS")
        self.assertEqual(evidence["backup_sha256"], self.sha256)
        self.assertEqual(evidence["backup_bytes"], self.bytes)

    def test_backup_hash_mismatch_fails(self) -> None:
        self.args.expected_sha256 = "0" * 64
        with self.assertRaisesRegex(ValueError, "SHA-256"):
            verify(self.args)

    def test_restore_proof_for_another_backup_fails(self) -> None:
        self.write_receipt(backup_sha256="0" * 64)
        with self.assertRaisesRegex(ValueError, "different backup"):
            verify(self.args)

    def test_restore_proof_must_confirm_database_cleanup(self) -> None:
        self.write_receipt(database_cleanup="retained")
        with self.assertRaisesRegex(ValueError, "cleaned up"):
            verify(self.args)

    def test_restore_proof_must_be_recent(self) -> None:
        stale = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=2)).replace(microsecond=0)
        self.write_receipt(verified_at_utc=stale.isoformat().replace("+00:00", "Z"))
        with self.assertRaisesRegex(ValueError, "stale"):
            verify(self.args)

    def test_corrupt_bundle_fails_integrity_check(self) -> None:
        self.backup.write_bytes(b"not a Tec Escola backup bundle")
        self.args.expected_sha256 = hashlib.sha256(self.backup.read_bytes()).hexdigest()
        with self.assertRaisesRegex(ValueError, "integrity|could not be read"):
            verify(self.args)


if __name__ == "__main__":
    unittest.main()
