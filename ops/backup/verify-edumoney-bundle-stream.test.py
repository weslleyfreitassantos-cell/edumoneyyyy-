import hashlib
import io
import subprocess
import sys
import tarfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("verify-edumoney-bundle-stream.py")


def make_tar(entries: dict[str, bytes], mode: str) -> bytes:
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode=mode) as archive:
        for name, content in entries.items():
            info = tarfile.TarInfo(name)
            info.size = len(content)
            archive.addfile(info, io.BytesIO(content))
    return output.getvalue()


def make_bundle(corrupt: bool = False) -> tuple[bytes, bytes]:
    storage = make_tar({"bucket/fixture.bin": b"storage sample bytes"}, "w:gz")
    components = {
        "globals.sql": b"-- globals fixture\n",
        "postgres.dump": b"database archive fixture",
        "supabase-meta.dump": b"metadata fixture",
        "storage.tar.gz": storage,
        "config.tar.gz": b"encrypted-in-production-config-fixture",
    }
    checksums = "".join(f"{hashlib.sha256(value).hexdigest()}  {name}\n" for name, value in components.items())
    if corrupt:
        components["postgres.dump"] = b"altered database archive"
    bundle = {
        **components,
        "MANIFEST.txt": b"created_utc=fixture\n",
        "SHA256SUMS": checksums.encode(),
    }
    return make_tar(bundle, "w:gz"), components["postgres.dump"]


class VerifyBundleStreamTests(unittest.TestCase):
    def run_verifier(self, mode: str, bundle: bytes) -> subprocess.CompletedProcess[bytes]:
        return subprocess.run(
            [sys.executable, str(SCRIPT), mode],
            input=bundle,
            capture_output=True,
            check=False,
        )

    def test_check_validates_components_and_storage_sample_without_names(self) -> None:
        bundle, _ = make_bundle()
        result = self.run_verifier("--check", bundle)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(b'"result":"PASS"', result.stdout)
        self.assertIn(b'"storage_objects":1', result.stdout)
        self.assertNotIn(b"fixture.bin", result.stdout)

    def test_database_mode_emits_only_verified_dump(self) -> None:
        bundle, database_dump = make_bundle()
        result = self.run_verifier("--database", bundle)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, database_dump)

    def test_metadata_mode_emits_only_verified_supabase_catalog_dump(self) -> None:
        bundle, _ = make_bundle()
        result = self.run_verifier("--supabase-meta", bundle)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, b"metadata fixture")

    def test_storage_sample_mode_emits_only_one_verified_object(self) -> None:
        bundle, _ = make_bundle()
        result = self.run_verifier("--storage-sample", bundle)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, b"storage sample bytes")

    def test_component_checksum_mismatch_fails_closed(self) -> None:
        bundle, _ = make_bundle(corrupt=True)
        result = self.run_verifier("--check", bundle)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stderr.strip(), b"BUNDLE_VERIFY=FAIL")


if __name__ == "__main__":
    unittest.main()
