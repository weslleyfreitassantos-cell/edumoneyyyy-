#!/usr/bin/env bash
set -euo pipefail
umask 077

archive="${1:-}"
if [[ -z "$archive" || ! -f "$archive" ]]; then
  printf 'Usage: %s <backup.tar|backup.tar.age>\n' "$0" >&2
  exit 2
fi
for command_name in tar pg_restore sha256sum; do
  command -v "$command_name" >/dev/null || { printf 'BLOCKED: %s is required.\n' "$command_name" >&2; exit 2; }
done

sha="$(sha256sum "$archive" | awk '{print $1}')"
sidecar="$archive.manifest.txt"
if [[ -f "$sidecar" ]]; then
  expected="$(sed -n 's/^archive_sha256=//p' "$sidecar" | head -n 1)"
  [[ -n "$expected" && "$expected" == "$sha" ]] || { printf 'FAIL: archive SHA-256 does not match sidecar.\n' >&2; exit 1; }
fi

if [[ "$archive" == *.age ]]; then
  command -v age >/dev/null || { printf 'BLOCKED: age is required.\n' >&2; exit 2; }
  [[ -n "${AGE_IDENTITY:-}" && -f "$AGE_IDENTITY" ]] || { printf 'BLOCKED: AGE_IDENTITY must point to the private decryption identity.\n' >&2; exit 2; }
  decrypt_archive() { age --decrypt --identity "$AGE_IDENTITY" "$archive"; }
else
  decrypt_archive() { cat -- "$archive"; }
fi

entries="$(decrypt_archive | tar -tf -)"
grep -qx 'database.dump' <<< "$entries"
grep -qx 'globals.sql' <<< "$entries"
grep -qx 'manifest.txt' <<< "$entries"
if grep -qE '(^/|(^|/)\.\.(/|$))' <<< "$entries"; then
  printf 'FAIL: archive contains an unsafe path.\n' >&2
  exit 1
fi
global_bytes="$(decrypt_archive | tar -xOf - globals.sql | wc -c | tr -d ' ')"
[[ "$global_bytes" -gt 0 ]] || { printf 'FAIL: globals dump is empty.\n' >&2; exit 1; }
decrypt_archive | tar -xOf - database.dump | pg_restore --list - >/dev/null
printf 'BACKUP_VERIFY=PASS\nsha256=%s\narchive_entries=3\ndatabase_archive=PASS\ncluster_globals=PASS\n' "$sha"
