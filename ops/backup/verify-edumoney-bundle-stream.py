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
STREAM_CHUNK_BYTES = 1024 * 1024


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


class HashingReader:
    """Track a stream without buffering the complete archive in memory."""

    def __init__(self, source) -> None:
        self.source = source
        self.digest = hashlib.sha256()

    def read(self, size: int = -1) -> bytes:
        chunk = self.source.read(size)
        if chunk:
            self.digest.update(chunk)
        return chunk

    def readinto(self, buffer) -> int:
        count = self.source.readinto(buffer)
        if count:
            self.digest.update(memoryview(buffer)[:count])
        return count


def parse_manifest_and_checksums(
    manifest_bytes: bytes,
    checksum_bytes: bytes,
) -> dict[str, str]:
    manifest = manifest_bytes.decode("utf-8", errors="strict")
    if not any(line.startswith("created_utc=") for line in manifest.splitlines()):
        fail("invalid manifest")

    expected: dict[str, str] = {}
    for line in checksum_bytes.decode("ascii", errors="strict").splitlines():
        digest, name = line.split(maxsplit=1)
        name = name.lstrip("* ")
        if name in expected:
            fail("duplicate checksum entry")
        expected[name] = digest
    if expected.keys() != COMPONENTS:
        fail("invalid checksum manifest")
    return expected


def inspect_storage_stream(stream) -> tuple[int, int, int, str]:
    count = 0
    total_bytes = 0
    sample_bytes = 0
    sample_hash = ""
    with tarfile.open(fileobj=stream, mode="r|gz") as storage:
        for member in storage:
            if member.name.startswith("/") or ".." in member.name.split("/"):
                fail("unsafe storage path")
            if not member.isfile():
                continue

            count += 1
            total_bytes += member.size
            if not sample_hash:
                sample = storage.extractfile(member)
                if sample is None:
                    fail("unreadable storage sample")
                digest = hashlib.sha256()
                while chunk := sample.read(STREAM_CHUNK_BYTES):
                    sample_bytes += len(chunk)
                    digest.update(chunk)
                sample_hash = digest.hexdigest()

    if count == 0:
        fail("storage archive has no regular objects")
    return count, total_bytes, sample_bytes, sample_hash


def check_bundle_stream() -> dict[str, object]:
    """Validate a bundle with bounded memory for the recurring host monitor."""
    source = HashingReader(sys.stdin.buffer)
    seen: set[str] = set()
    component_hashes: dict[str, str] = {}
    component_sizes: dict[str, int] = {}
    manifest_bytes: bytes | None = None
    checksum_bytes: bytes | None = None
    storage_stats: tuple[int, int, int, str] | None = None

    with tarfile.open(fileobj=source, mode="r|gz") as bundle:
        for member in bundle:
            name = member.name
            if name.startswith("/") or ".." in name.split("/"):
                fail("unsafe archive path")
            if name not in REQUIRED:
                continue
            if name in seen or not member.isfile():
                fail("duplicate or invalid bundle component")

            stream = bundle.extractfile(member)
            if stream is None:
                fail("unreadable bundle component")
            seen.add(name)

            if name in COMPONENTS:
                digest = hashlib.sha256()
                total = 0
                if name == "storage.tar.gz":
                    hashing_stream = HashingReader(stream)
                    storage_stats = inspect_storage_stream(hashing_stream)
                    digest = hashing_stream.digest
                    while hashing_stream.read(STREAM_CHUNK_BYTES):
                        pass
                    total = member.size
                else:
                    while chunk := stream.read(STREAM_CHUNK_BYTES):
                        total += len(chunk)
                        digest.update(chunk)
                component_hashes[name] = digest.hexdigest()
                component_sizes[name] = total
            elif name == "MANIFEST.txt":
                manifest_bytes = stream.read(1024 * 1024)
            else:
                checksum_bytes = stream.read(1024 * 1024)

    if seen != REQUIRED:
        fail("required bundle component missing")
    if component_sizes.get("globals.sql", 0) == 0 or component_sizes.get("postgres.dump", 0) == 0:
        fail("empty database component")
    if manifest_bytes is None or checksum_bytes is None or storage_stats is None:
        fail("required bundle component missing")

    expected = parse_manifest_and_checksums(manifest_bytes, checksum_bytes)
    for name, digest in component_hashes.items():
        if digest != expected[name]:
            fail("component checksum mismatch")

    objects, storage_bytes, sample_bytes, sample_hash = storage_stats
    return {
        "result": "PASS",
        "bundle_sha256": source.digest.hexdigest(),
        "components_verified": len(COMPONENTS),
        "database_dump_bytes": component_sizes["postgres.dump"],
        "storage_objects": objects,
        "storage_total_bytes": storage_bytes,
        "storage_sample_bytes": sample_bytes,
        "storage_sample_sha256": sample_hash,
    }


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
    if mode == "--check":
        print(json.dumps(check_bundle_stream(), separators=(",", ":")))
        return

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
