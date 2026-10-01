#!/usr/bin/env python3
"""Validate a production bundle from stdin without writing its contents to disk."""

from __future__ import annotations

import hashlib
import io
import json
import sys
import tarfile


COMPONENTS = {
    "globals.sql",
    "postgres.dump",
    "supabase-meta.dump",
    "storage.tar.gz",
    "config.tar.gz",
}
REQUIRED = COMPONENTS | {"MANIFEST.txt", "SHA256SUMS"}


def fail(message: str) -> None:
    raise ValueError(message)


def load_bundle() -> tuple[bytes, dict[str, bytes]]:
    archive_bytes = sys.stdin.buffer.read()
    if not archive_bytes:
        fail("empty input")

    entries: dict[str, bytes] = {}
    with tarfile.open(fileobj=io.BytesIO(archive_bytes), mode="r:gz") as bundle:
        for member in bundle.getmembers():
            name = member.name
            if name.startswith("/") or ".." in name.split("/"):
                fail("unsafe archive path")
            if name not in REQUIRED:
                continue
            if name in entries or not member.isfile():
                fail("duplicate or invalid bundle component")
            stream = bundle.extractfile(member)
            if stream is None:
                fail("unreadable bundle component")
            entries[name] = stream.read()

    if entries.keys() != REQUIRED:
        fail("required bundle component missing")
    if not entries["globals.sql"] or not entries["postgres.dump"]:
        fail("empty database component")

    manifest = entries["MANIFEST.txt"].decode("utf-8", errors="strict")
    if not any(line.startswith("created_utc=") for line in manifest.splitlines()):
        fail("invalid manifest")

    expected: dict[str, str] = {}
    for line in entries["SHA256SUMS"].decode("ascii", errors="strict").splitlines():
        digest, name = line.split(maxsplit=1)
        name = name.lstrip("* ")
        if name in expected:
            fail("duplicate checksum entry")
        expected[name] = digest
    if expected.keys() != COMPONENTS:
        fail("invalid checksum manifest")
    for name, content in entries.items():
        if name in COMPONENTS and hashlib.sha256(content).hexdigest() != expected[name]:
            fail("component checksum mismatch")
    return archive_bytes, entries


def storage_sample(storage_archive: bytes) -> tuple[int, int, int, str, bytes]:
    count = 0
    total_bytes = 0
    sample_bytes = 0
    sample_hash = ""
    sample_data = bytearray()
    with tarfile.open(fileobj=io.BytesIO(storage_archive), mode="r:gz") as storage:
        for member in storage.getmembers():
            if member.name.startswith("/") or ".." in member.name.split("/"):
                fail("unsafe storage path")
            if not member.isfile():
                continue
            count += 1
            total_bytes += member.size
            if not sample_hash:
                stream = storage.extractfile(member)
                if stream is None:
                    fail("unreadable storage sample")
                digest = hashlib.sha256()
                while chunk := stream.read(1024 * 1024):
                    sample_bytes += len(chunk)
                    digest.update(chunk)
                    sample_data.extend(chunk)
                sample_hash = digest.hexdigest()
    if count == 0:
        fail("storage archive has no regular objects")
    return count, total_bytes, sample_bytes, sample_hash, bytes(sample_data)


def main() -> None:
    modes = {"--check", "--database", "--supabase-meta", "--globals", "--storage", "--storage-sample"}
    if len(sys.argv) != 2 or sys.argv[1] not in modes:
        fail("usage: verify-edumoney-bundle-stream.py --check|--database|--supabase-meta|--globals|--storage")
    mode = sys.argv[1]
    archive_bytes, entries = load_bundle()

    if mode == "--database":
        sys.stdout.buffer.write(entries["postgres.dump"])
        return
    if mode == "--supabase-meta":
        sys.stdout.buffer.write(entries["supabase-meta.dump"])
        return
    if mode == "--globals":
        sys.stdout.buffer.write(entries["globals.sql"])
        return
    if mode == "--storage":
        sys.stdout.buffer.write(entries["storage.tar.gz"])
        return

    objects, storage_bytes, sample_bytes, sample_hash, sample_data = storage_sample(entries["storage.tar.gz"])
    if mode == "--storage-sample":
        sys.stdout.buffer.write(sample_data)
        return
    print(json.dumps({
        "result": "PASS",
        "bundle_sha256": hashlib.sha256(archive_bytes).hexdigest(),
        "components_verified": len(COMPONENTS),
        "database_dump_bytes": len(entries["postgres.dump"]),
        "storage_objects": objects,
        "storage_total_bytes": storage_bytes,
        "storage_sample_bytes": sample_bytes,
        "storage_sample_sha256": sample_hash,
    }, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except (OSError, tarfile.TarError, ValueError, KeyError, UnicodeError):
        sys.stderr.write("BUNDLE_VERIFY=FAIL\n")
        raise SystemExit(1)
