#!/usr/bin/env python3
"""Focused checks for the PR #414 isolated Storage proof receipt."""

from __future__ import annotations

import datetime as dt
import hashlib
from pathlib import Path
import subprocess
import sys
import tempfile


SCRIPT = Path(__file__).with_name("verify-local-storage-recovery-proof.py")
REPO_ROOT = Path(__file__).parents[2]


def run(backup: Path, receipt: Path, expected: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--backup-file", str(backup), "--receipt-file", str(receipt),
         "--expected-sha256", expected, "--repo-root", str(REPO_ROOT)],
        capture_output=True,
        text=True,
        check=False,
    )


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="tec-storage-proof-test-") as temporary:
        root = Path(temporary)
        backup = root / "bundle.tar.gz"
        backup.write_bytes(b"verified local backup fixture")
        digest = hashlib.sha256(backup.read_bytes()).hexdigest()
        now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        receipt = root / "storage-proof.txt"

        def write_receipt(**changes: str) -> None:
            values = {
                "format": "tec-school-local-storage-restore-proof-v1",
                "status": "PASS",
                "backup_sha256": digest,
                "backup_bytes": str(backup.stat().st_size),
                "restore_mode": "isolated-storage-copy",
                "storage_objects": "12249",
                "storage_bytes": "352379320",
                "copy_integrity": "PASS",
                "temporary_copy_cleanup": "COMPLETED",
                "production_storage_status": "PARTIAL",
                "offsite_status": "FAIL",
                "evidence_source": "synthetic-test-fixture",
                "recorded_at_utc": now,
            }
            values.update(changes)
            receipt.write_text("".join(f"{key}={value}\n" for key, value in values.items()), encoding="utf-8")

        write_receipt()
        result = run(backup, receipt, digest)
        assert result.returncode == 0 and "LOCAL_STORAGE_RECOVERY_PROOF=PASS" in result.stdout, result.stderr

        for changes, expected_hash in (
            ({"backup_sha256": "0" * 64}, digest),
            ({"storage_objects": "1"}, digest),
            ({"storage_bytes": "1"}, digest),
            ({"copy_integrity": "FAIL"}, digest),
            ({"temporary_copy_cleanup": "UNKNOWN"}, digest),
            ({"production_storage_status": "PASS"}, digest),
            ({"offsite_status": "PASS"}, digest),
            ({"evidence_source": ""}, digest),
            ({}, "0" * 64),
        ):
            write_receipt(**changes)
            result = run(backup, receipt, expected_hash)
            assert result.returncode != 0, (changes, result.stdout, result.stderr)

        write_receipt()
        write_receipt(recorded_at_utc="2020-01-01T00:00:00Z")
        result = run(backup, receipt, digest)
        assert result.returncode != 0 and "stale" in result.stderr.lower(), result.stderr

    print("VERIFY_LOCAL_STORAGE_RECOVERY_PROOF=PASS")


if __name__ == "__main__":
    main()
