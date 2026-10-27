#!/usr/bin/env bash
set -euo pipefail
umask 077

archive="${1:-}"
if [[ -z "$archive" || ! -f "$archive" ]]; then
  printf 'Usage: %s <backup.tar|backup.tar.age>\n' "$0" >&2
  exit 2
fi
for name in RESTORE_TEST_PGHOST RESTORE_TEST_PGUSER RESTORE_TEST_PGPASSWORD RESTORE_TEST_TMPDIR; do
  if [[ -z "${!name:-}" ]]; then printf 'BLOCKED: %s is unset.\n' "$name" >&2; exit 2; fi
done
case "$RESTORE_TEST_PGHOST" in localhost|127.0.0.1|::1) ;; *)
  printf 'BLOCKED: restore test only accepts localhost/loopback, never a remote host.\n' >&2
  exit 2
esac
for command_name in createdb dropdb pg_isready pg_restore psql tar; do
  command -v "$command_name" >/dev/null || { printf 'BLOCKED: %s is required.\n' "$command_name" >&2; exit 2; }
done
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -d "$RESTORE_TEST_TMPDIR" ]] || { printf 'BLOCKED: restore scratch directory must exist.\n' >&2; exit 2; }
temporary_dir="$(cd -- "$RESTORE_TEST_TMPDIR" && pwd -P)"
if [[ -n "$repo_root" && ( "$temporary_dir" == "$repo_root" || "$temporary_dir" == "$repo_root/"* ) ]]; then
  printf 'BLOCKED: restore scratch directory must be outside the Git working tree.\n' >&2
  exit 2
fi
receipt_path=''
if [[ -n "${RESTORE_TEST_RECEIPT_FILE:-}" ]]; then
  receipt_input="${RESTORE_TEST_RECEIPT_FILE}"
  receipt_leaf="$(basename -- "$receipt_input")"
  receipt_parent_input="$(dirname -- "$receipt_input")"
  [[ "$receipt_leaf" != '.' && "$receipt_leaf" != '..' && -d "$receipt_parent_input" ]] || {
    printf 'BLOCKED: restore receipt parent directory must already exist and be writable.\n' >&2
    exit 2
  }
  receipt_parent="$(cd -- "$receipt_parent_input" && pwd -P)"
  [[ -w "$receipt_parent" ]] || {
    printf 'BLOCKED: restore receipt parent directory must already exist and be writable.\n' >&2
    exit 2
  }
  receipt_path="$receipt_parent/$receipt_leaf"
  if [[ -n "$repo_root" && ( "$receipt_path" == "$repo_root" || "$receipt_path" == "$repo_root/"* ) ]]; then
    printf 'BLOCKED: restore receipt must be outside the Git working tree.\n' >&2
    exit 2
  fi
  [[ ! -e "$receipt_path" && ! -L "$receipt_path" ]] || {
    printf 'BLOCKED: restore receipt destination already exists.\n' >&2
    exit 2
  }
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
bash "$script_dir/../backup/verify-postgres-backup.sh" "$archive"
work="$(mktemp -d "$temporary_dir/tecescola-restore.XXXXXXXX")"
chmod 700 -- "$work"
db="qualification_restore_${BASHPID}_${RANDOM}"
created=0
cleanup() {
  if [[ "$created" == 1 && "${RESTORE_TEST_KEEP:-false}" != 'true' ]]; then
    PGHOST="$RESTORE_TEST_PGHOST" PGPORT="${RESTORE_TEST_PGPORT:-5432}" PGUSER="$RESTORE_TEST_PGUSER" PGPASSWORD="$RESTORE_TEST_PGPASSWORD" dropdb --if-exists --maintenance-db=postgres "$db" >/dev/null 2>&1 || true
  fi
  rm -rf -- "$work"
}
trap cleanup EXIT

export PGHOST="$RESTORE_TEST_PGHOST"
export PGPORT="${RESTORE_TEST_PGPORT:-5432}"
export PGUSER="$RESTORE_TEST_PGUSER"
export PGPASSWORD="$RESTORE_TEST_PGPASSWORD"
export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-10}"
pg_isready -q -d postgres || { printf 'BLOCKED: disposable local PostgreSQL is unavailable.\n' >&2; exit 2; }

if [[ "$archive" == *.age ]]; then
  command -v age >/dev/null || { printf 'BLOCKED: age is required.\n' >&2; exit 2; }
  [[ -n "${AGE_IDENTITY:-}" && -f "$AGE_IDENTITY" ]] || { printf 'BLOCKED: AGE_IDENTITY is required.\n' >&2; exit 2; }
  age --decrypt --identity "$AGE_IDENTITY" "$archive" > "$work/backup.tar"
else
  cp -- "$archive" "$work/backup.tar"
fi
entries="$(tar -tf "$work/backup.tar")"
if grep -qx 'database.dump' <<< "$entries"; then
  database_entry='database.dump'
elif grep -qx 'postgres.dump' <<< "$entries"; then
  database_entry='postgres.dump'
else
  printf 'FAIL: backup archive has no supported database dump.\n' >&2
  exit 1
fi
tar -xOf "$work/backup.tar" "$database_entry" > "$work/database.dump"

if psql -X -d postgres -v ON_ERROR_STOP=1 -Atqc "select 1 from pg_database where datname = '$db'" | grep -qx 1; then
  printf 'FAIL: generated restore database name already exists.\n' >&2
  exit 1
fi
createdb --maintenance-db=postgres --template=template0 "$db"
created=1
pg_restore --exit-on-error --no-owner --no-acl --dbname="$db" "$work/database.dump"

verification="$(psql -X -d "$db" -v ON_ERROR_STOP=1 -At -F '|' -c "
select current_setting('server_version'),
       (select count(*) from information_schema.schemata where schema_name in ('public','auth','storage')),
       (select count(*) from information_schema.tables where table_schema='public'),
       (select count(*) from pg_policies),
       (select count(*) from pg_class where relrowsecurity)
")"
IFS='|' read -r restored_version schema_count public_tables policies rls_tables <<< "$verification"
[[ "$schema_count" == 3 ]] || { printf 'FAIL: expected public/auth/storage schemas after restore.\n' >&2; exit 1; }
[[ "$public_tables" =~ ^[0-9]+$ && "$public_tables" -gt 0 ]] || { printf 'FAIL: restored public schema has no tables.\n' >&2; exit 1; }
database_cleanup='retained'
if [[ "${RESTORE_TEST_KEEP:-false}" != true ]]; then
  dropdb --if-exists --maintenance-db=postgres "$db"
  created=0
  if psql -X -d postgres -v ON_ERROR_STOP=1 -Atqc "select 1 from pg_database where datname = '$db'" | grep -qx 1; then
    printf 'FAIL: disposable restore database still exists after cleanup.\n' >&2
    exit 1
  fi
  database_cleanup='dropped'
fi

backup_sha256="$(sha256sum "$archive" | awk '{print $1}')"
backup_bytes="$(wc -c < "$archive" | tr -d ' ')"
verified_at_utc="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
if [[ -n "$receipt_path" ]]; then
  [[ "$database_cleanup" == dropped ]] || {
    printf 'FAIL: restore proof requires the disposable database to be dropped.\n' >&2
    exit 1
  }
  receipt_temporary="$(mktemp "$(dirname -- "$receipt_path")/.restore-proof.XXXXXXXX")"
  chmod 600 -- "$receipt_temporary"
  cat > "$receipt_temporary" <<EOF
format=tec-school-local-restore-proof-v1
status=PASS
backup_sha256=$backup_sha256
backup_bytes=$backup_bytes
verified_at_utc=$verified_at_utc
restore_mode=isolated-postgres
database_cleanup=dropped
EOF
  mv -- "$receipt_temporary" "$receipt_path"
  printf 'RESTORE_PROOF_RECEIPT=WRITTEN\n'
fi

printf 'RESTORE_TEST=PASS\nrestored_postgres_version=%s\nschema_count=%s\npublic_tables=%s\nrls_policies=%s\nrls_tables=%s\nlocal_database=%s\ncleanup=%s\nbackup_sha256=%s\nbackup_bytes=%s\nverified_at_utc=%s\n' \
  "$restored_version" "$schema_count" "$public_tables" "$policies" "$rls_tables" "$db" \
  "$database_cleanup" "$backup_sha256" "$backup_bytes" "$verified_at_utc"
