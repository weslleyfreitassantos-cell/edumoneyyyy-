#!/usr/bin/env bash
set -euo pipefail
umask 077

required=(PGHOST PGUSER PGDATABASE PGPASSWORD BACKUP_DIR BACKUP_TMPDIR)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    printf 'BLOCKED: required environment variable %s is unset.\n' "$name" >&2
    exit 2
  fi
done

for command_name in pg_dump pg_dumpall pg_restore psql tar sha256sum realpath stat; do
  command -v "$command_name" >/dev/null || { printf 'BLOCKED: %s is required.\n' "$command_name" >&2; exit 2; }
done

if [[ -z "${BACKUP_AGE_RECIPIENT:-}" && "${ALLOW_UNENCRYPTED_BACKUP:-}" != 'true' ]]; then
  printf 'BLOCKED: set BACKUP_AGE_RECIPIENT or explicitly allow a protected unencrypted backup.\n' >&2
  exit 2
fi
if [[ -n "${BACKUP_AGE_RECIPIENT:-}" ]]; then
  command -v age >/dev/null || { printf 'BLOCKED: age is required for encrypted backups.\n' >&2; exit 2; }
fi

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
backup_dir="$(realpath -m -- "$BACKUP_DIR")"
temporary_dir="$(realpath -m -- "$BACKUP_TMPDIR")"
if [[ -n "$repo_root" && ( "$backup_dir" == "$repo_root" || "$backup_dir" == "$repo_root/"* || "$temporary_dir" == "$repo_root" || "$temporary_dir" == "$repo_root/"* ) ]]; then
  printf 'BLOCKED: backup destination must be outside the Git working tree.\n' >&2
  exit 2
fi
if [[ ! -e "$backup_dir" ]]; then
  mkdir -p -- "$backup_dir"
  chmod 700 -- "$backup_dir"
elif [[ ! -d "$backup_dir" ]]; then
  printf 'BLOCKED: BACKUP_DIR must be a directory.\n' >&2
  exit 2
else
  backup_mode="$(stat -c '%a' -- "$backup_dir")"
  if (( (8#$backup_mode & 077) != 0 )); then
    printf 'BLOCKED: existing BACKUP_DIR must not grant group/other access.\n' >&2
    exit 2
  fi
fi
mkdir -p -- "$temporary_dir"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
safe_database="$(printf '%s' "$PGDATABASE" | tr -c 'A-Za-z0-9._-' '_')"
suffix='tar'
if [[ -n "${BACKUP_AGE_RECIPIENT:-}" ]]; then suffix='tar.age'; fi
archive="$backup_dir/tecescola-${safe_database}-${timestamp}-${BASHPID}.${suffix}"
manifest="$archive.manifest.txt"
archive_partial="$archive.partial"
manifest_partial="$manifest.partial"
work="$(mktemp -d "$temporary_dir/tecescola-backup.XXXXXXXX")"
chmod 700 -- "$work"
cleanup() { rm -rf -- "$work"; rm -f -- "$archive_partial" "$manifest_partial"; }
trap cleanup EXIT

export PGPORT="${PGPORT:-5432}"
export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-10}"
server_version="$(psql -X -v ON_ERROR_STOP=1 -Atqc 'show server_version')"

pg_dump --format=custom --no-owner --no-acl --file="$work/database.dump"
pg_dumpall --globals-only > "$work/globals.sql"
[[ -s "$work/database.dump" && -s "$work/globals.sql" ]] || { printf 'FAIL: database or globals dump is empty.\n' >&2; exit 1; }
pg_restore --list "$work/database.dump" >/dev/null

cat > "$work/manifest.txt" <<EOF
created_at_utc=$timestamp
logical_host=$PGHOST
database=$PGDATABASE
postgres_version=$server_version
backup_type=postgres_custom_archive_plus_cluster_globals
storage_objects=not_included
EOF
tar -C "$work" -cf "$work/backup.tar" database.dump globals.sql manifest.txt

if [[ -n "${BACKUP_AGE_RECIPIENT:-}" ]]; then
  age --recipient "$BACKUP_AGE_RECIPIENT" --output "$archive_partial" "$work/backup.tar"
else
  cp -- "$work/backup.tar" "$archive_partial"
fi

archive_sha="$(sha256sum "$archive_partial" | awk '{print $1}')"
archive_bytes="$(wc -c < "$archive_partial" | tr -d ' ')"
cat > "$manifest_partial" <<EOF
created_at_utc=$timestamp
logical_host=$PGHOST
database=$PGDATABASE
postgres_version=$server_version
backup_type=postgres_custom_archive_plus_cluster_globals
encrypted=$([[ -n "${BACKUP_AGE_RECIPIENT:-}" ]] && printf true || printf false)
storage_objects=not_included
archive_bytes=$archive_bytes
archive_sha256=$archive_sha
pg_restore_list=PASS
exit_code=0
EOF
chmod 600 -- "$archive_partial" "$manifest_partial"
[[ ! -e "$archive" && ! -e "$manifest" ]] || { printf 'BLOCKED: backup destination already exists.\n' >&2; exit 2; }
mv -- "$archive_partial" "$archive"
mv -- "$manifest_partial" "$manifest"
printf 'BACKUP=PASS\narchive=%s\nsize_bytes=%s\nsha256=%s\npostgres_version=%s\nstorage_objects=NOT_INCLUDED\n' \
  "$(basename -- "$archive")" "$archive_bytes" "$archive_sha" "$server_version"
