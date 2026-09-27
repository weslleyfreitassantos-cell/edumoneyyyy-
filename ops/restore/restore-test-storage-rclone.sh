#!/usr/bin/env bash
set -euo pipefail
umask 077

for name in STORAGE_RESTORE_TEST_SOURCE STORAGE_RESTORE_TEST_TMPDIR; do
  if [[ -z "${!name:-}" ]]; then printf 'BLOCKED: %s is unset.\n' "$name" >&2; exit 2; fi
done
for command_name in rclone mktemp realpath; do
  command -v "$command_name" >/dev/null || { printf 'BLOCKED: %s is required.\n' "$command_name" >&2; exit 2; }
done
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
temporary_dir="$(realpath -m -- "$STORAGE_RESTORE_TEST_TMPDIR")"
if [[ -n "$repo_root" && ( "$temporary_dir" == "$repo_root" || "$temporary_dir" == "$repo_root/"* ) ]]; then
  printf 'BLOCKED: restore scratch directory must be outside the Git working tree.\n' >&2
  exit 2
fi

work="$(mktemp -d "$temporary_dir/tecescola-storage-restore.XXXXXXXX")"
chmod 700 -- "$work"
trap 'rm -rf -- "$work"' EXIT
rclone copy "$STORAGE_RESTORE_TEST_SOURCE" "$work/objects" --checksum --create-empty-src-dirs --log-level ERROR
rclone check "$STORAGE_RESTORE_TEST_SOURCE" "$work/objects" --one-way --log-level ERROR
bytes="$(du -sb "$work/objects" | awk '{print $1}')"
files="$(find "$work/objects" -type f | wc -l | tr -d ' ')"
printf 'STORAGE_RESTORE_TEST=PASS\nfiles=%s\nbytes=%s\nrestored_to=temporary_local_copy\n' "$files" "$bytes"
