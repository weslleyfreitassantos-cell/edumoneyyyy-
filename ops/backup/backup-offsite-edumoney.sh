#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

BACKUP_ROOT="${BACKUP_ROOT:-/srv/grupotec/backups/edumoney}"
OFFSITE_REMOTE="${OFFSITE_REMOTE:-gdrive-backups:tecescola-offsite}"
AGE_RECIPIENT_FILE="${AGE_RECIPIENT_FILE:-/etc/grupotec-backup/age-recipient}"
STATE_FILE="${OFFSITE_STATE_FILE:-/var/lib/tecescola-ops/offsite-backup.state}"
RETENTION_DAYS="${OFFSITE_RETENTION_DAYS:-14}"
TEMP_ROOT="${OFFSITE_TEMP_ROOT:-/run}"

started_at="$(date +%s)"
work=''

write_state() {
  local status="$1" exit_code="$2" artifact="${3:-none}" sha="${4:-none}" bytes="${5:-0}"
  local state_dir state_tmp completed duration
  state_dir="$(dirname -- "$STATE_FILE")"
  mkdir -p -- "$state_dir"
  chmod 700 -- "$state_dir"
  state_tmp="$(mktemp "$state_dir/.offsite-state.XXXXXXXX")"
  completed="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  duration="$(($(date +%s) - started_at))"
  printf 'status=%s\ncompleted_at_utc=%s\nartifact=%s\nsha256=%s\nbytes=%s\nduration_seconds=%s\nexit_code=%s\n' \
    "$status" "$completed" "$artifact" "$sha" "$bytes" "$duration" "$exit_code" > "$state_tmp"
  chmod 600 -- "$state_tmp"
  mv -f -- "$state_tmp" "$STATE_FILE"
}

finish() {
  local rc=$?
  trap - EXIT
  if [[ -n "$work" ]]; then rm -rf -- "$work"; fi
  if (( rc != 0 )); then
    write_state FAIL "$rc" || true
    printf 'OFFSITE_BACKUP=FAIL exit_code=%s\n' "$rc" >&2
  fi
  exit "$rc"
}
trap finish EXIT

for command_name in age rclone tar sha256sum find sort awk grep mktemp; do
  command -v "$command_name" >/dev/null || { printf 'Required command unavailable: %s\n' "$command_name" >&2; exit 2; }
done
[[ "$RETENTION_DAYS" =~ ^[1-9][0-9]*$ ]] || { printf 'Invalid offsite retention days.\n' >&2; exit 2; }
[[ -r "$AGE_RECIPIENT_FILE" ]] || { printf 'Age recipient file unavailable.\n' >&2; exit 2; }

recipient="$(tr -d '\r\n' < "$AGE_RECIPIENT_FILE")"
[[ "$recipient" =~ ^age1[0-9a-z]+$ ]] || { printf 'Age recipient is invalid.\n' >&2; exit 2; }
latest="$(find "$BACKUP_ROOT" -maxdepth 1 -type f -name 'edumoney-*.tar.gz' -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d ' ' -f 2-)"
[[ -n "$latest" && -s "$latest" ]] || { printf 'No complete local Edumoney backup found.\n' >&2; exit 1; }

work="$(mktemp -d "${TEMP_ROOT%/}/tecescola-offsite.XXXXXXXX")"
chmod 700 -- "$work"
tar -xzf "$latest" -C "$work"
for entry in globals.sql postgres.dump supabase-meta.dump storage.tar.gz config.tar.gz MANIFEST.txt SHA256SUMS; do
  [[ -f "$work/$entry" ]] || { printf 'Backup bundle component missing.\n' >&2; exit 1; }
done
(cd -- "$work" && sha256sum --check --status SHA256SUMS) || { printf 'Backup bundle checksum verification failed.\n' >&2; exit 1; }
grep -q '^created_utc=' "$work/MANIFEST.txt" || { printf 'Backup manifest is invalid.\n' >&2; exit 1; }

filename="$(basename -- "$latest").age"
encrypted="$work/$filename"
age --recipient "$recipient" --output "$encrypted" "$latest"
local_sha="$(sha256sum "$encrypted" | awk '{print $1}')"
bytes="$(wc -c < "$encrypted" | tr -d ' ' )"
target="${OFFSITE_REMOTE%/}/$filename"

rclone mkdir "$OFFSITE_REMOTE"
rclone copyto --retries 3 --low-level-retries 10 "$encrypted" "$target"
remote_sha="$(rclone cat "$target" | sha256sum | awk '{print $1}')"
[[ "$remote_sha" == "$local_sha" ]] || { printf 'Offsite ciphertext checksum mismatch.\n' >&2; exit 1; }
rclone delete --min-age "$((RETENTION_DAYS * 24))h" --include 'edumoney-*.tar.gz.age' "$OFFSITE_REMOTE"

write_state SUCCESS 0 "$filename" "$local_sha" "$bytes"
printf 'OFFSITE_BACKUP=PASS bytes=%s sha256=%s retention_days=%s\n' "$bytes" "$local_sha" "$RETENTION_DAYS"
