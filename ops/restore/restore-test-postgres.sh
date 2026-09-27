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
for command_name in createdb dropdb pg_isready pg_restore psql tar realpath; do
  command -v "$command_name" >/dev/null || { printf 'BLOCKED: %s is required.\n' "$command_name" >&2; exit 2; }
done
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
temporary_dir="$(realpath -m -- "$RESTORE_TEST_TMPDIR")"
if [[ -n "$repo_root" && ( "$temporary_dir" == "$repo_root" || "$temporary_dir" == "$repo_root/"* ) ]]; then
  printf 'BLOCKED: restore scratch directory must be outside the Git working tree.\n' >&2
  exit 2
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
"$script_dir/../backup/verify-postgres-backup.sh" "$archive"
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
tar -xOf "$work/backup.tar" database.dump > "$work/database.dump"

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
printf 'RESTORE_TEST=PASS\nrestored_postgres_version=%s\nschema_count=%s\npublic_tables=%s\nrls_policies=%s\nrls_tables=%s\nlocal_database=%s\ncleanup=%s\n' \
  "$restored_version" "$schema_count" "$public_tables" "$policies" "$rls_tables" "$db" \
  "$([[ "${RESTORE_TEST_KEEP:-false}" == true ]] && printf retained || printf dropped)"
