#!/usr/bin/env python3
"""Validate a recent local backup and its isolated PostgreSQL restore receipt."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tarfile


RECEIPT_FORMAT = "tec-school-local-restore-proof-v1"
MAX_CLOCK_SKEW = dt.timedelta(minutes=5)


def fail(message: str) -> None:
    raise ValueError(message)


def parse_utc(value: str, label: str) -> dt.datetime:
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        # Backup MANIFEST.txt timestamps use hyphens in the time component
        # (for example 2026-10-26T07-31-18Z) to match the artifact filename.
        try:
            parsed = dt.datetime.strptime(value, "%Y-%m-%dT%H-%M-%SZ").replace(tzinfo=dt.timezone.utc)
        except ValueError:
            fail(f"{label} is invalid")
    if parsed.tzinfo is None:
        fail(f"{label} must include a timezone")
    return parsed.astimezone(dt.timezone.utc)


def require_fresh(value: dt.datetime, now: dt.datetime, label: str, max_age: dt.timedelta) -> None:
    if value > now + MAX_CLOCK_SKEW:
        fail(f"{label} is in the future")
    if now - value > max_age:
        fail(f"{label} is stale")


def outside_repo(path: Path, repo_root: Path, label: str) -> None:
    resolved = path.resolve(strict=True)
    root = repo_root.resolve(strict=True)
    if resolved == root or root in resolved.parents:
        fail(f"{label} must be outside the repository")


def read_manifest_created(backup: Path) -> dt.datetime:
    try:
        with tarfile.open(backup, mode="r:gz") as archive:
            matches = [member for member in archive.getmembers() if member.name == "MANIFEST.txt"]
            if len(matches) != 1 or not matches[0].isfile() or matches[0].size > 1024 * 1024:
                fail("backup manifest is missing, duplicated, or invalid")
            stream = archive.extractfile(matches[0])
            if stream is None:
                fail("backup manifest is unreadable")
            lines = stream.read().decode("utf-8", errors="strict").splitlines()
    except (OSError, tarfile.TarError, UnicodeError):
        fail("backup manifest could not be read")
    created_values = [line.partition("=")[2] for line in lines if line.startswith("created_utc=")]
    if len(created_values) != 1 or not created_values[0]:
        fail("backup manifest creation time is invalid")
    return parse_utc(created_values[0], "backup creation time")


def load_receipt(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            key, separator, value = line.partition("=")
            if not separator or not key or key in values:
                fail("restore receipt format is invalid")
            values[key] = value
    except (OSError, UnicodeError):
        fail("restore receipt could not be read")
    expected_keys = {
        "format",
        "status",
        "backup_sha256",
        "backup_bytes",
        "verified_at_utc",
        "restore_mode",
        "database_cleanup",
    }
    if values.keys() != expected_keys:
        fail("restore receipt fields are invalid")
    return values


def verify(args: argparse.Namespace) -> dict[str, object]:
    backup = Path(args.backup_file)
    receipt_path = Path(args.receipt_file)
    repo_root = Path(args.repo_root)
    verifier = Path(args.bundle_verifier)

    for path, label in ((backup, "backup"), (receipt_path, "restore receipt")):
        if path.is_symlink() or not path.is_file():
            fail(f"{label} must be an accessible regular file, not a symlink")
        outside_repo(path, repo_root, label)
    if backup.stat().st_size <= 0:
        fail("backup is empty")

    now = dt.datetime.now(dt.timezone.utc)
    max_age = dt.timedelta(hours=args.max_age_hours)
    backup_mtime = dt.datetime.fromtimestamp(backup.stat().st_mtime, dt.timezone.utc)
    require_fresh(backup_mtime, now, "backup file timestamp", max_age)
    created_at = read_manifest_created(backup)
    require_fresh(created_at, now, "backup manifest timestamp", max_age)

    digest = hashlib.sha256()
    with backup.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    backup_sha256 = digest.hexdigest()
    if args.expected_sha256 and backup_sha256 != args.expected_sha256.lower():
        fail("backup SHA-256 does not match the approved local artifact")
    backup_bytes = backup.stat().st_size

    if not verifier.is_file():
        fail("bundle verifier is unavailable")
    try:
        with backup.open("rb") as source:
            checked = subprocess.run(
                [sys.executable, str(verifier), "--check"],
                stdin=source,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
        result = json.loads(checked.stdout) if checked.returncode == 0 else {}
    except (OSError, json.JSONDecodeError):
        fail("bundle integrity check could not be completed")
    if result.get("result") != "PASS" or result.get("bundle_sha256") != backup_sha256:
        fail("backup bundle integrity check failed")

    if receipt_path.stat().st_size <= 0:
        fail("restore receipt is empty")
    receipt_mtime = dt.datetime.fromtimestamp(receipt_path.stat().st_mtime, dt.timezone.utc)
    require_fresh(receipt_mtime, now, "restore receipt timestamp", max_age)
    receipt = load_receipt(receipt_path)
    if receipt["format"] != RECEIPT_FORMAT or receipt["status"] != "PASS":
        fail("restore receipt does not prove a successful isolated restore")
    if receipt["restore_mode"] != "isolated-postgres" or receipt["database_cleanup"] != "dropped":
        fail("restore receipt does not prove an isolated database was cleaned up")
    if receipt["backup_sha256"] != backup_sha256 or receipt["backup_bytes"] != str(backup_bytes):
        fail("restore receipt is for a different backup artifact")
    verified_at = parse_utc(receipt["verified_at_utc"], "restore verification time")
    require_fresh(verified_at, now, "restore verification time", max_age)
    if verified_at < created_at or verified_at > now + MAX_CLOCK_SKEW:
        fail("restore verification time is inconsistent with the backup")

    return {
        "backup_bytes": backup_bytes,
        "backup_created_at_utc": created_at.isoformat().replace("+00:00", "Z"),
        "backup_sha256": backup_sha256,
        "restore_verified_at_utc": verified_at.isoformat().replace("+00:00", "Z"),
        "status": "PASS",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--backup-file", required=True)
    parser.add_argument("--receipt-file", required=True)
    parser.add_argument("--expected-sha256", default="")
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--bundle-verifier", required=True)
    parser.add_argument("--max-age-hours", type=int, default=24)
    args = parser.parse_args()
    if args.max_age_hours < 1 or args.max_age_hours > 24:
        fail("maximum backup age must be between 1 and 24 hours")
    if args.expected_sha256 and (len(args.expected_sha256) != 64 or any(char not in "0123456789abcdefABCDEF" for char in args.expected_sha256)):
        fail("expected SHA-256 is invalid")
    evidence = verify(args)
    print("LOCAL_RECOVERY_PROOF=PASS")
    for key, value in evidence.items():
        print(f"{key.upper()}={value}")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as error:
        sys.stderr.write(f"LOCAL_RECOVERY_PROOF=FAIL reason={error}\n")
        raise SystemExit(1)
