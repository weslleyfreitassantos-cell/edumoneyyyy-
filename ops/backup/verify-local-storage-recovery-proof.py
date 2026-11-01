#!/usr/bin/env python3
"""Validate the recorded isolated Storage-copy proof for PR #414."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
from pathlib import Path


RECEIPT_FORMAT = "tec-school-local-storage-restore-proof-v1"
MAX_CLOCK_SKEW = dt.timedelta(minutes=5)
MAX_AGE = dt.timedelta(hours=24)
EXPECTED_OBJECTS = "12249"
EXPECTED_BYTES = "352379320"


def fail(message: str) -> None:
    raise ValueError(message)


def parse_utc(value: str) -> dt.datetime:
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        fail("Storage proof recording time is invalid")
    if parsed.tzinfo is None:
        fail("Storage proof recording time must include a timezone")
    return parsed.astimezone(dt.timezone.utc)


def read_receipt(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            key, separator, value = line.partition("=")
            if not separator or not key or key in values:
                fail("Storage proof receipt format is invalid")
            values[key] = value
    except (OSError, UnicodeError):
        fail("Storage proof receipt could not be read")
    expected_keys = {
        "format",
        "status",
        "backup_sha256",
        "backup_bytes",
        "restore_mode",
        "storage_objects",
        "storage_bytes",
        "copy_integrity",
        "temporary_copy_cleanup",
        "production_storage_status",
        "offsite_status",
        "evidence_source",
        "recorded_at_utc",
    }
    if values.keys() != expected_keys:
        fail("Storage proof receipt fields are incomplete or unexpected")
    return values


def verify(args: argparse.Namespace) -> tuple[str, int, str]:
    backup = Path(args.backup_file)
    receipt_path = Path(args.receipt_file)
    repo_root = Path(args.repo_root).resolve(strict=True)
    for path, label in ((backup, "backup"), (receipt_path, "Storage proof receipt")):
        if path.is_symlink() or not path.is_file():
            fail(f"{label} must be an accessible regular file, not a symlink")
        resolved = path.resolve(strict=True)
        if resolved == repo_root or repo_root in resolved.parents:
            fail(f"{label} must be stored outside the repository")

    backup_bytes = backup.stat().st_size
    if backup_bytes <= 0:
        fail("backup is empty")
    digest = hashlib.sha256()
    with backup.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    backup_sha256 = digest.hexdigest()
    if args.expected_sha256 and backup_sha256 != args.expected_sha256.lower():
        fail("backup SHA-256 does not match the approved local artifact")

    receipt = read_receipt(receipt_path)
    if receipt["format"] != RECEIPT_FORMAT or receipt["status"] != "PASS":
        fail("receipt does not record a successful isolated Storage copy")
    if receipt["restore_mode"] != "isolated-storage-copy":
        fail("receipt does not identify an isolated Storage copy")
    if receipt["backup_sha256"] != backup_sha256 or receipt["backup_bytes"] != str(backup_bytes):
        fail("Storage proof receipt is for a different backup artifact")
    if receipt["storage_objects"] != EXPECTED_OBJECTS or receipt["storage_bytes"] != EXPECTED_BYTES:
        fail("Storage proof receipt does not match the previously verified object inventory")
    if receipt["copy_integrity"] != "PASS" or receipt["temporary_copy_cleanup"] != "COMPLETED":
        fail("Storage copy integrity or cleanup was not verified")
    if receipt["production_storage_status"] != "PARTIAL" or receipt["offsite_status"] != "FAIL":
        fail("receipt must preserve production Storage PARTIAL and offsite FAIL")
    if not receipt["evidence_source"].strip():
        fail("Storage proof evidence source is missing")

    recorded_at = parse_utc(receipt["recorded_at_utc"])
    now = dt.datetime.now(dt.timezone.utc)
    if recorded_at > now + MAX_CLOCK_SKEW or now - recorded_at > MAX_AGE:
        fail("Storage proof receipt is stale or future-dated")
    receipt_mtime = dt.datetime.fromtimestamp(receipt_path.stat().st_mtime, dt.timezone.utc)
    if now - receipt_mtime > MAX_AGE:
        fail("Storage proof receipt file is stale")
    return backup_sha256, backup_bytes, recorded_at.isoformat().replace("+00:00", "Z")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--backup-file", required=True)
    parser.add_argument("--receipt-file", required=True)
    parser.add_argument("--expected-sha256", default="")
    parser.add_argument("--repo-root", required=True)
    args = parser.parse_args()
    sha256, size, recorded_at = verify(args)
    print("LOCAL_STORAGE_RECOVERY_PROOF=PASS")
    print(f"BACKUP_SHA256={sha256}")
    print(f"BACKUP_BYTES={size}")
    print(f"STORAGE_PROOF_RECORDED_AT_UTC={recorded_at}")


if __name__ == "__main__":
    main()
