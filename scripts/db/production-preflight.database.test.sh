#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
preflight_sql="${script_dir}/production-preflight.sql"

db_container="${1:-}"
if [[ -z "$db_container" ]]; then
  db_container="$(docker ps --format '{{.Names}}' | awk '/^supabase_db_/ { print; exit }')"
fi
[[ -n "$db_container" ]] || { printf 'DATABASE_CONTAINER=NOT_FOUND\n' >&2; exit 1; }

snapshot="$(docker exec -i "$db_container" psql -X -U postgres -d postgres -A -t \
  -v ON_ERROR_STOP=1 -f - < "$preflight_sql")"
node -e '
const d = JSON.parse(process.argv[1]);
if (d.database !== "postgres" || d.session_user !== "postgres" || d.current_user !== "postgres" ||
    d.is_superuser !== true || d.can_read_cluster_identity !== true ||
    d.can_create_private_objects !== true ||
    d.can_read_migration_ledger !== true || d.can_write_migration_ledger !== true ||
    Object.keys(d.v12_relation_owners || {}).length !== 6 ||
    Object.values(d.v12_relation_owners).some((owner) => !["postgres", "supabase_admin"].includes(owner)) ||
    !/^\d{14}$/.test(d.latest_migration || "")) {
  throw new Error("PostgreSQL preflight fixture did not meet the expected executor contract");
}
' "$snapshot"

role_snapshot="$(
  {
    printf '%s\n' 'BEGIN;' 'SET ROLE supabase_admin;'
    cat "$preflight_sql"
    printf '%s\n' 'ROLLBACK;'
  } | docker exec -i "$db_container" psql -q -X -U postgres -d postgres -A -t \
    -v ON_ERROR_STOP=1 -f -
)"
node -e '
const lines = process.argv[1].trim().split(/\n+/);
const d = JSON.parse(lines.at(-1));
if (d.database !== "postgres" || d.session_user !== "postgres" || d.current_user !== "supabase_admin" ||
    d.is_superuser !== true || d.can_read_cluster_identity !== true ||
    d.can_create_private_objects !== true || d.can_read_migration_ledger !== true ||
    d.can_write_migration_ledger !== true || Object.keys(d.v12_relation_owners || {}).length !== 6 ||
    Object.values(d.v12_relation_owners).some((owner) => !["postgres", "supabase_admin"].includes(owner)) ||
    !/^\d{14}$/.test(d.latest_migration || "")) {
  throw new Error("PostgreSQL SET ROLE preflight did not meet the expected executor contract");
}
' "$role_snapshot"

role_state="$(docker exec -i "$db_container" psql -X -U postgres -d postgres -A -t \
  -v ON_ERROR_STOP=1 -c "BEGIN; SET ROLE supabase_admin; SELECT session_user || '|' || current_user; ROLLBACK;")"
[[ "$role_state" == *'postgres|supabase_admin'* ]] || {
  printf 'ROLE_SWITCH_FIXTURE=FAIL\n' >&2
  exit 1
}
printf 'PRODUCTION_PREFLIGHT_DATABASE_FIXTURE=PASS\nROLE_IDENTITY_DIFFERENCE_FIXTURE=PASS\nROLE_CAPABILITIES_FIXTURE=PASS\n'
