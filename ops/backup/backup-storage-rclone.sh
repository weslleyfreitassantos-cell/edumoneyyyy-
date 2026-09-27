#!/usr/bin/env bash
set -euo pipefail
umask 077

for name in STORAGE_SOURCE STORAGE_BACKUP_DIR; do
  if [[ -z "${!name:-}" ]]; then printf 'BLOCKED: %s is unset.\n' "$name" >&2; exit 2; fi
done
command -v rclone >/dev/null || { printf 'BLOCKED: rclone is required.\n' >&2; exit 2; }
command -v realpath >/dev/null || { printf 'BLOCKED: realpath is required.\n' >&2; exit 2; }
backup_dir="$(realpath -m -- "$STORAGE_BACKUP_DIR")"
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -n "$repo_root" && ( "$backup_dir" == "$repo_root" || "$backup_dir" == "$repo_root/"* ) ]]; then
  printf 'BLOCKED: storage backup destination must be outside the Git working tree.\n' >&2
  exit 2
fi
mkdir -p -- "$backup_dir"
destination="$backup_dir/storage-$(date -u +%Y%m%dT%H%M%SZ)"
destination="${destination}-${BASHPID}"
temporary_destination="${destination}.partial"
[[ ! -e "$destination" && ! -e "$temporary_destination" ]] || { printf 'BLOCKED: storage backup destination already exists.\n' >&2; exit 2; }
mkdir -m 700 -- "$temporary_destination"
trap 'rm -rf -- "$temporary_destination"' EXIT

# `copy` is read-only at the source; never replace it with `sync` for a backup.
rclone copy "$STORAGE_SOURCE" "$temporary_destination" --checksum --create-empty-src-dirs --log-level ERROR
rclone check "$STORAGE_SOURCE" "$temporary_destination" --one-way --log-level ERROR
bytes="$(du -sb "$temporary_destination" | awk '{print $1}')"
files="$(find "$temporary_destination" -type f | wc -l | tr -d ' ')"
mv -- "$temporary_destination" "$destination"
trap - EXIT
printf 'STORAGE_BACKUP=PASS\nfiles=%s\nbytes=%s\ndestination=%s\n' "$files" "$bytes" "$(basename -- "$destination")"
