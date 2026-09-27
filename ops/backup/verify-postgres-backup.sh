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
fi

verify_work="$(mktemp -d "${TMPDIR:-/tmp}/tecescola-backup-verify.XXXXXXXX")"
chmod 700 -- "$verify_work"
trap 'rm -rf -- "$verify_work"' EXIT
if [[ "$archive" == *.age ]]; then
  age --decrypt --identity "$AGE_IDENTITY" "$archive" > "$verify_work/backup.tar"
else
  cp -- "$archive" "$verify_work/backup.tar"
fi

entries="$(tar -tf "$verify_work/backup.tar")"
if grep -qE '(^/|(^|/)\.\.(/|$))' <<< "$entries"; then
  printf 'FAIL: archive contains an unsafe path.\n' >&2
  exit 1
fi

if grep -qx 'database.dump' <<< "$entries" && grep -qx 'manifest.txt' <<< "$entries"; then
  database_entry='database.dump'
  for component in database.dump globals.sql manifest.txt; do
    [[ "$(grep -Fxc -- "$component" <<< "$entries")" == 1 ]] || { printf 'FAIL: archive entry is missing or duplicated: %s.\n' "$component" >&2; exit 1; }
  done
  tar -xf "$verify_work/backup.tar" -C "$verify_work" -- database.dump globals.sql manifest.txt
elif grep -qx 'postgres.dump' <<< "$entries" && grep -qx 'MANIFEST.txt' <<< "$entries" && grep -qx 'SHA256SUMS' <<< "$entries"; then
  database_entry='postgres.dump'
  for component in postgres.dump globals.sql supabase-meta.dump storage.tar.gz config.tar.gz; do
    [[ "$(grep -Fxc -- "$component" <<< "$entries")" == 1 ]] || { printf 'FAIL: bundle entry is missing or duplicated: %s.\n' "$component" >&2; exit 1; }
  done
  [[ "$(grep -Fxc -- 'MANIFEST.txt' <<< "$entries")" == 1 && "$(grep -Fxc -- 'SHA256SUMS' <<< "$entries")" == 1 ]] || { printf 'FAIL: bundle manifest or checksums entry is missing or duplicated.\n' >&2; exit 1; }
  tar -xf "$verify_work/backup.tar" -C "$verify_work" -- postgres.dump globals.sql supabase-meta.dump storage.tar.gz config.tar.gz MANIFEST.txt SHA256SUMS
  [[ "$(wc -l < "$verify_work/SHA256SUMS" | tr -d ' ')" == 5 ]] || { printf 'FAIL: production bundle checksum list has an unexpected entry count.\n' >&2; exit 1; }
  (cd -- "$verify_work" && sha256sum --check --status SHA256SUMS) || { printf 'FAIL: production bundle component checksum mismatch.\n' >&2; exit 1; }
else
  printf 'FAIL: archive layout is not a supported PostgreSQL backup.\n' >&2
  exit 1
fi

global_bytes="$(wc -c < "$verify_work/globals.sql" | tr -d ' ')"
[[ "$global_bytes" -gt 0 ]] || { printf 'FAIL: globals dump is empty.\n' >&2; exit 1; }
pg_restore --list "$verify_work/$database_entry" >/dev/null
printf 'BACKUP_VERIFY=PASS\nsha256=%s\ndatabase_archive=PASS\ncluster_globals=PASS\n' "$sha"
