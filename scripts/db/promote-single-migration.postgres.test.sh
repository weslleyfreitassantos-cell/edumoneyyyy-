#!/usr/bin/env bash
set -euo pipefail
set +x

repo_root="$(git rev-parse --show-toplevel)"
promoter="$repo_root/scripts/db/promote-single-migration.sh"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/tecescola-promote-postgres.XXXXXX")"
db_container="$(docker ps --format '{{.Names}}' | awk '/^supabase_db_/{print; exit}')"
[[ -n "$db_container" ]] || { echo 'Disposable Supabase PostgreSQL container not found' >&2; exit 1; }

cleanup() {
  for database in promoter_historical_ci promoter_chronological_ci; do
    docker exec "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
      -c "DROP DATABASE IF EXISTS $database WITH (FORCE);" >/dev/null 2>&1 || true
  done
  rm -rf -- "$tmp"
}
trap cleanup EXIT

status_output="$(npx supabase status -o env)"
raw_db_url="$(printf '%s\n' "$status_output" | sed -n 's/^DB_URL=//p' | head -n 1 | sed -E "s/^[\\\"']//; s/[\\\"']$//")"
[[ -n "$raw_db_url" ]] || { echo 'Supabase local DB_URL unavailable' >&2; exit 1; }
test_db_url="$(RAW_DB_URL="$raw_db_url" python3 - <<'PY'
import os
from urllib.parse import urlsplit, urlunsplit

parts = urlsplit(os.environ["RAW_DB_URL"])
if parts.scheme not in ("postgres", "postgresql"):
    raise SystemExit("Unexpected disposable PostgreSQL URL scheme")
if parts.hostname not in ("127.0.0.1", "localhost", "::1"):
    raise SystemExit("Refusing to run disposable migration proof against a non-loopback host")
if not parts.username or not parts.password or not parts.port:
    raise SystemExit("Disposable PostgreSQL URL is missing connection fields")
print(urlunsplit((parts.scheme, parts.netloc, "/promoter_historical_ci", parts.query, "")))
PY
)"
chronological_db_url="${test_db_url%/promoter_historical_ci}/promoter_chronological_ci"

mkdir -p "$tmp/bin"
cat > "$tmp/bin/psql" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
query=''
while (($#)); do
  if [[ "$1" == '-c' ]]; then
    query="${2:-}"
    break
  fi
  shift
done
[[ "$query" == 'select version from supabase_migrations.schema_migrations order by version;' ]] || exit 81
exec docker exec "$PROMOTION_TEST_DB_CONTAINER" psql -X -A -t -v ON_ERROR_STOP=1 \
  -U postgres -d "$PROMOTION_TEST_DATABASE_NAME" -c "$query"
MOCK
chmod +x "$tmp/bin/psql"

init_fixture() {
  local fixture="$1" base_version="$2" target_version="$3" target_name="$4" database="$5"
  mkdir -p "$fixture/supabase/migrations"
  printf 'project_id = "migration-promoter-ci"\n' > "$fixture/supabase/config.toml"
  printf 'select 1;\n' > "$fixture/supabase/migrations/${base_version}_baseline.sql"
  cat > "$fixture/supabase/migrations/${target_version}_${target_name}.sql" <<SQL
create table public.${target_name}_probe (id integer primary key);
insert into public.${target_name}_probe (id) values (1);
SQL
  git -C "$fixture" init -q
  git -C "$fixture" config user.name 'Migration promoter CI'
  git -C "$fixture" config user.email 'migration-promoter-ci@example.invalid'
  git -C "$fixture" add supabase/config.toml supabase/migrations
  git -C "$fixture" commit -q -m 'Disposable migration promoter fixture'

  docker exec "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE $database;" >/dev/null
  docker exec "$db_container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 \
    -c "CREATE SCHEMA supabase_migrations;
        CREATE TABLE supabase_migrations.schema_migrations (
          version text PRIMARY KEY NOT NULL,
          statements text[],
          name text
        );
        INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
          VALUES ('$base_version', ARRAY[]::text[], 'baseline');" >/dev/null
}

run_promotion() {
  local fixture="$1" base_version="$2" target_version="$3" target_name="$4" database_url="$5" database_name="$6"
  local target_file target_hash source_commit output
  target_file="$(find "$fixture/supabase/migrations" -maxdepth 1 -type f -name "${target_version}_*.sql" -print -quit)"
  target_hash="$(sha256sum "$target_file" | awk '{print $1}')"
  source_commit="$(git -C "$fixture" rev-parse HEAD)"
  output="$(PATH="$tmp/bin:$PATH" \
    PROMOTION_TEST_DB_CONTAINER="$db_container" \
    PROMOTION_TEST_DATABASE_NAME="$database_name" \
    SOURCE_ROOT="$fixture" \
    TARGET_VERSION="$target_version" \
    EXPECTED_REMOTE_LAST="$base_version" \
    EXPECTED_SOURCE_COMMIT="$source_commit" \
    EXPECTED_TARGET_SHA256="$target_hash" \
    PRODUCTION_DB_URL="$database_url" \
    APPLY=1 \
    BACKUP_GATE=PASS \
    CONFIRM_PRODUCTION_WRITE=I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION \
    TMPDIR="$tmp" \
    "$promoter")"
  printf '%s\n' "$output"
  grep -q '^PROMOTION=APPLIED$' <<< "$output"
  grep -Fxq "REMOTE_AFTER_COUNT=2" <<< "$output"

  local actual_versions actual_probe
  actual_versions="$(docker exec "$db_container" psql -U postgres -d "$database_name" \
    -X -A -t -v ON_ERROR_STOP=1 -c \
    'select version from supabase_migrations.schema_migrations order by version;')"
  actual_probe="$(docker exec "$db_container" psql -U postgres -d "$database_name" \
    -X -A -t -v ON_ERROR_STOP=1 -c \
    "select count(*) from public.${target_name}_probe;")"
  [[ "$(printf '%s\n' "$actual_versions" | sort)" == "$(printf '%s\n' "$base_version" "$target_version" | sort)" ]]
  [[ "$actual_probe" == '1' ]]
}

historical_fixture="$tmp/source-historical"
init_fixture "$historical_fixture" 20261019000500 20261013003200 historical promoter_historical_ci
historical_db_url="$test_db_url"
historical_output="$(run_promotion "$historical_fixture" 20261019000500 20261013003200 historical "$historical_db_url" promoter_historical_ci)"
grep -q '^REMOTE_AFTER_LAST=20261019000500$' <<< "$historical_output"
grep -q '^PROMOTION=APPLIED$' <<< "$historical_output"
echo 'PROMOTE_SINGLE_MIGRATION_POSTGRES_HISTORICAL=PASS'

chronological_fixture="$tmp/source-chronological"
init_fixture "$chronological_fixture" 20261013003200 20261022000200 chronological promoter_chronological_ci
chronological_output="$(run_promotion "$chronological_fixture" 20261013003200 20261022000200 chronological "$chronological_db_url" promoter_chronological_ci)"
grep -q '^REMOTE_AFTER_LAST=20261022000200$' <<< "$chronological_output"
grep -q '^PROMOTION=APPLIED$' <<< "$chronological_output"
echo 'PROMOTE_SINGLE_MIGRATION_POSTGRES_CHRONOLOGICAL=PASS'
