#!/usr/bin/env bash
set -euo pipefail
set +x

repo_root="$(git rev-parse --show-toplevel)"
promoter="$repo_root/scripts/db/promote-single-migration.sh"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/tecescola-promote-postgres.XXXXXX")"
real_sha256sum="$(command -v sha256sum)"
[[ "$real_sha256sum" == /* && -f "$real_sha256sum" && -x "$real_sha256sum" ]] || {
  echo 'Absolute executable sha256sum not found before installing test mocks' >&2
  exit 1
}
db_container="${PROMOTION_TEST_DB_CONTAINER:-$(docker ps --format '{{.Names}}' | awk '/^supabase_db_/{print; exit}')}"
[[ -n "$db_container" ]] || { echo 'Disposable Supabase PostgreSQL container not found' >&2; exit 1; }
executor_admin=promoter_cli_executor_admin_ci

cleanup() {
  docker exec "$db_container" psql -U "$executor_admin" -d postgres -v ON_ERROR_STOP=1 \
    -c 'ALTER ROLE postgres SUPERUSER;' >/dev/null 2>&1 || true
  for database in promoter_historical_ci promoter_chronological_ci promoter_backup_exception_ci promoter_cli_executor_007_ci; do
    docker exec "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
      -c "DROP DATABASE IF EXISTS $database WITH (FORCE);" >/dev/null 2>&1 || true
  done
  docker exec "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c 'DROP ROLE IF EXISTS cli_login_promoter_007_ci; DROP ROLE IF EXISTS promoter_cli_executor_admin_ci;' \
    >/dev/null 2>&1 || true
  rm -rf -- "$tmp"
}
trap cleanup EXIT

raw_db_url="${PROMOTION_TEST_DB_URL:-}"
if [[ -z "$raw_db_url" ]]; then
  status_output="$(npx supabase status -o env)"
  raw_db_url="$(printf '%s\n' "$status_output" | sed -n 's/^DB_URL=//p' | head -n 1 | sed -E "s/^[\\\"']//; s/[\\\"']$//")"
fi
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
promotion_test_supabase_bin="${PROMOTION_TEST_SUPABASE_BIN:-}"
if [[ -z "${promotion_test_supabase_bin}" ]]; then
  linux_supabase_bin="${repo_root}/node_modules/@supabase/cli-linux-x64/bin/supabase"
  if [[ -x "${linux_supabase_bin}" ]]; then
    promotion_test_supabase_bin="${linux_supabase_bin}"
  else
    promotion_test_supabase_bin="${repo_root}/node_modules/.bin/supabase"
  fi
fi

executor_database=promoter_cli_executor_007_ci
executor_role=cli_login_promoter_007_ci
executor_password=promoter_ci_only_2026
executor_owner_db_url="$(BASE_DB_URL="$test_db_url" EXECUTOR_DATABASE="$executor_database" python3 - <<'PY'
import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

parts = urlsplit(os.environ["BASE_DB_URL"])
query = dict(parse_qsl(parts.query, keep_blank_values=True))
query["sslmode"] = "disable"
print(urlunsplit((parts.scheme, parts.netloc, f"/{os.environ['EXECUTOR_DATABASE']}", urlencode(query), "")))
PY
)"
executor_db_url="$(BASE_DB_URL="$test_db_url" EXECUTOR_DATABASE="$executor_database" \
  EXECUTOR_ROLE="$executor_role" EXECUTOR_PASSWORD="$executor_password" python3 - <<'PY'
import os
from urllib.parse import parse_qsl, quote, urlencode, urlsplit, urlunsplit

parts = urlsplit(os.environ["BASE_DB_URL"])
host = f"[{parts.hostname}]" if ":" in (parts.hostname or "") else parts.hostname
netloc = (
    f"{quote(os.environ['EXECUTOR_ROLE'], safe='')}:"
    f"{quote(os.environ['EXECUTOR_PASSWORD'], safe='')}@{host}:{parts.port}"
)
query = dict(parse_qsl(parts.query, keep_blank_values=True))
query["sslmode"] = "disable"
print(urlunsplit((parts.scheme, netloc, f"/{os.environ['EXECUTOR_DATABASE']}", urlencode(query), "")))
PY
)"

mkdir -p "$tmp/bin"
cat > "$tmp/bin/supabase-with-timeout" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
set +e
output_file="$(mktemp "${PROMOTION_TEST_CLI_LOG_DIR:?}/supabase-cli.XXXXXX")"
supabase_binary="${PROMOTION_TEST_SUPABASE_BIN:-}"
if [[ -n "$supabase_binary" && -x "$supabase_binary" ]]; then
  timeout --kill-after="${PROMOTION_TEST_SUPABASE_KILL_AFTER_SECONDS:-5}s" \
    "${PROMOTION_TEST_SUPABASE_TIMEOUT_SECONDS:-180}s" \
    "$supabase_binary" --debug "$@" >"$output_file" 2>&1
else
  timeout --kill-after="${PROMOTION_TEST_SUPABASE_KILL_AFTER_SECONDS:-5}s" \
    "${PROMOTION_TEST_SUPABASE_TIMEOUT_SECONDS:-180}s" \
    npx supabase --debug "$@" >"$output_file" 2>&1
fi
status=$?
if [[ "$status" -eq 124 ]]; then
  printf 'PROMOTION_TEST_CLI_TIMEOUT=YES\n' >> "$output_file"
fi
printf 'PROMOTION_TEST_CLI_EXIT_STATUS=%s\n' "$status" >> "$output_file"
cat "$output_file"
exit "$status"
MOCK
chmod +x "$tmp/bin/supabase-with-timeout"
mkdir -p "$tmp/cli-logs"

emit_cli_diagnostics() {
  local log_file
  shopt -s nullglob
  local log_files=("$tmp"/cli-logs/supabase-cli.*)
  shopt -u nullglob
  ((${#log_files[@]})) || return 0
  printf 'PROMOTION_TEST_CLI_DIAGNOSTICS_BEGIN\n' >&2
  for log_file in "${log_files[@]}"; do
    tail -n 50 "$log_file" |
      sed -E \
        -e 's#(postgres(ql)?://[^:/@]+:)[^@/]+@#\1<redacted>@#g' \
        -e 's/(password|token|secret|key)=([^[:space:]]+)/\1=<redacted>/Ig' >&2
  done
  printf 'PROMOTION_TEST_CLI_DIAGNOSTICS_END\n' >&2
}

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
  printf 'PROMOTE_SINGLE_MIGRATION_CASE=%s START\n' "$target_name" >&2
  target_file="$(find "$fixture/supabase/migrations" -maxdepth 1 -type f -name "${target_version}_*.sql" -print -quit)"
  target_hash="$(sed 's/\r$//' "$target_file" | sha256sum | awk '{print $1}')"
  source_commit="$(git -C "$fixture" rev-parse HEAD)"
  if ! output="$(PATH="$tmp/bin:$PATH" \
    PROMOTION_TEST_DB_CONTAINER="$db_container" \
    PROMOTION_TEST_DATABASE_NAME="$database_name" \
    PROMOTION_TEST_CLI_LOG_DIR="$tmp/cli-logs" \
    PROMOTION_TEST_SUPABASE_BIN="$promotion_test_supabase_bin" \
    PROMOTE_SINGLE_MIGRATION_CLI_BINARY="$tmp/bin/supabase-with-timeout" \
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
    "$promoter")"; then
    printf '%s\n' "$output" >&2
    emit_cli_diagnostics
    printf 'PROMOTE_SINGLE_MIGRATION_CASE=%s FAIL\n' "$target_name" >&2
    return 1
  fi
  printf '%s\n' "$output"
  grep -q '^PROMOTION=APPLIED$' <<< "$output" || {
    printf 'Expected applied result for %s\n' "$target_name" >&2
    return 1
  }
  grep -Fxq "REMOTE_AFTER_COUNT=2" <<< "$output" || {
    printf 'Expected two ledger versions after %s\n' "$target_name" >&2
    return 1
  }

  local actual_versions actual_probe
  actual_versions="$(docker exec "$db_container" psql -U postgres -d "$database_name" \
    -X -A -t -v ON_ERROR_STOP=1 -c \
    'select version from supabase_migrations.schema_migrations order by version;')" || {
    printf 'Could not inspect the post-promotion ledger for %s\n' "$target_name" >&2
    return 1
  }
  actual_probe="$(docker exec "$db_container" psql -U postgres -d "$database_name" \
    -X -A -t -v ON_ERROR_STOP=1 -c \
    "select count(*) from public.${target_name}_probe;")" || {
    printf 'Expected probe table missing after %s\n' "$target_name" >&2
    return 1
  }
  [[ "$(printf '%s\n' "$actual_versions" | sort)" == "$(printf '%s\n' "$base_version" "$target_version" | sort)" ]] || {
    printf 'Unexpected post-promotion ledger contents for %s\n' "$target_name" >&2
    return 1
  }
  [[ "$actual_probe" == '1' ]] || {
    printf 'Expected one probe row after %s\n' "$target_name" >&2
    return 1
  }
  printf 'PROMOTE_SINGLE_MIGRATION_CASE=%s PASS\n' "$target_name" >&2
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

# Prove the release-399 exception through the real Supabase CLI against a third,
# disposable PostgreSQL database. CI cannot access the private Windows backup;
# the fixture digest command therefore substitutes only that artifact's
# already-verified SHA. The production path uses the operating system sha256sum.
exception_version=20261023000200
exception_base_version=20261023000100
exception_database=promoter_backup_exception_ci
exception_db_url="${test_db_url%/promoter_historical_ci}/${exception_database}"
exception_backup="$tmp/verified-windows-backup-fixture.tar.gz"
mkdir -p "$tmp/exception-bin"
printf 'CI placeholder for the previously verified Windows backup\n' > "$exception_backup"
cat > "$tmp/exception-bin/sha256sum" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
if [[ -n "${PROMOTION_TEST_BACKUP_FILE:-}" && "$#" == '1' && "$1" == "$PROMOTION_TEST_BACKUP_FILE" ]]; then
  printf '%s  %s\n' 'b8818e0b97a2152d60b1405f90d089a1ab4b43ba87d2739f234afb038b28d5c0' "$1"
else
  "$PROMOTION_TEST_REAL_SHA256SUM" "$@"
fi
MOCK
chmod +x "$tmp/exception-bin/sha256sum"
[[ "$real_sha256sum" != "$tmp/exception-bin/sha256sum" ]] || {
  echo 'Resolved sha256sum unexpectedly points to the test mock' >&2
  exit 1
}

docker exec "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE $exception_database;" >/dev/null
docker exec "$db_container" psql -U postgres -d "$exception_database" -v ON_ERROR_STOP=1 \
  -c "CREATE SCHEMA supabase_migrations;
      CREATE TABLE supabase_migrations.schema_migrations (
        version text PRIMARY KEY NOT NULL,
        statements text[],
        name text
      );
      INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
        VALUES ('$exception_base_version', ARRAY[]::text[], 'release-399-base');" >/dev/null

exception_target_file="$repo_root/supabase/migrations/${exception_version}_guided_study_demo_preview_state.sql"
exception_target_hash="$(sed 's/\r$//' "$exception_target_file" | sha256sum | awk '{print $1}')"
[[ "$exception_target_hash" == '4ed582c3b19f5da409b7e087e4bce5b8af07b7b98c5c2829fda52a3f1c414e97' ]]
exception_source_commit="$(git -C "$repo_root" rev-parse HEAD)"
if ! exception_output="$(PATH="$tmp/exception-bin:$tmp/bin:$PATH" \
  PROMOTION_TEST_DB_CONTAINER="$db_container" \
  PROMOTION_TEST_DATABASE_NAME="$exception_database" \
  PROMOTION_TEST_CLI_LOG_DIR="$tmp/cli-logs" \
  PROMOTION_TEST_SUPABASE_BIN="$promotion_test_supabase_bin" \
  PROMOTE_SINGLE_MIGRATION_CLI_BINARY="$tmp/bin/supabase-with-timeout" \
  PROMOTION_TEST_REAL_SHA256SUM="$real_sha256sum" \
  PROMOTION_TEST_BACKUP_FILE="$exception_backup" \
  SOURCE_ROOT="$repo_root" \
  TARGET_VERSION="$exception_version" \
  EXPECTED_REMOTE_LAST="$exception_base_version" \
  EXPECTED_SOURCE_COMMIT="$exception_source_commit" \
  EXPECTED_TARGET_SHA256="$exception_target_hash" \
  PRODUCTION_DB_URL="$exception_db_url" \
  APPLY=1 \
  BACKUP_GATE=FAIL \
  BACKUP_EXCEPTION_RELEASE_SHA=36979b8adc4408bf9eaccdf77f742904fba152fc \
  BACKUP_EXCEPTION_WINDOWS_PATH='C:\Users\samue\Backups\TecEscola\edumoney-2026-10-24T07-41-52Z.tar.gz' \
  BACKUP_EXCEPTION_BACKUP_SHA256=b8818e0b97a2152d60b1405f90d089a1ab4b43ba87d2739f234afb038b28d5c0 \
  BACKUP_EXCEPTION_BACKUP_FILE="$exception_backup" \
  BACKUP_EXCEPTION_RESTORE_STATUS=PARTIAL \
  BACKUP_EXCEPTION_STORAGE_STATUS=PARTIAL \
  BACKUP_EXCEPTION_OFFSITE_GATE=FAIL \
  ACCEPT_INCOMPLETE_RECOVERY_RISK=I_ACCEPT_INCOMPLETE_RECOVERY_RISK_FOR_RELEASE_399 \
  CONFIRM_PRODUCTION_WRITE=I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION \
  TMPDIR="$tmp" \
  "$promoter")"; then
  printf '%s\n' "$exception_output" >&2
  emit_cli_diagnostics
  printf 'PROMOTE_SINGLE_MIGRATION_CASE=release_399_backup_exception FAIL\n' >&2
  exit 1
fi
printf '%s\n' "$exception_output"
grep -q '^BACKUP_GATE=FAIL$' <<< "$exception_output"
grep -q '^BACKUP_EXCEPTION=USED$' <<< "$exception_output"
grep -q '^BACKUP_EXCEPTION_RESTORE=PARTIAL$' <<< "$exception_output"
grep -q '^BACKUP_EXCEPTION_STORAGE=PARTIAL$' <<< "$exception_output"
grep -q '^BACKUP_EXCEPTION_OFFSITE_GATE=FAIL$' <<< "$exception_output"
grep -q '^PROMOTION=APPLIED$' <<< "$exception_output"
grep -Fxq "REMOTE_AFTER_COUNT=2" <<< "$exception_output"
grep -Fxq "REMOTE_AFTER_LAST=$exception_version" <<< "$exception_output"

exception_versions="$(docker exec "$db_container" psql -U postgres -d "$exception_database" \
  -X -A -t -v ON_ERROR_STOP=1 -c \
  'select version from supabase_migrations.schema_migrations order by version;')"
[[ "$(printf '%s\n' "$exception_versions" | sort)" == \
  "$(printf '%s\n' "$exception_base_version" "$exception_version" | sort)" ]]
exception_function_count="$(docker exec "$db_container" psql -U postgres -d "$exception_database" \
  -X -A -t -v ON_ERROR_STOP=1 -c \
  "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_recommended_guided_study_v10';")"
[[ "$exception_function_count" == '1' ]]
echo 'PROMOTE_SINGLE_MIGRATION_POSTGRES_BACKUP_EXCEPTION_399=PASS'

# Prove the actual Supabase CLI migration-executor identity in disposable
# PostgreSQL. Its connection hook switches cli_login_* to postgres; RESET ALL
# runs before each migration but preserves that active role. Apply the exact
# first ALTER TABLE operations from 007 in a minimal fixture owned by postgres.
executor_fixture="$tmp/source-cli-executor-007"
mkdir -p "$executor_fixture/supabase/migrations"
printf 'project_id = "migration-promoter-cli-executor-ci"\n' > "$executor_fixture/supabase/config.toml"
printf 'select 1;\n' > "$executor_fixture/supabase/migrations/20261025000600_baseline.sql"
cat > "$executor_fixture/supabase/migrations/20261025000650_cli_executor_identity_probe.sql" <<'SQL'
insert into public.migration_executor_probe
  (session_user_name, current_user_name, current_role_name, role_setting, is_superuser)
select session_user::text, current_user::text, current_role::text,
       coalesce(nullif(current_setting('role', true), ''), 'none'), role_row.rolsuper
  from pg_roles role_row
 where role_row.rolname = current_user;
SQL
cat > "$executor_fixture/supabase/migrations/20261025000700_candidate_ownership_probe.sql" <<'SQL'
alter table public.learning_central_studies_v2_candidates
  drop constraint learning_central_studies_v2_candidates_publication_status_check;
alter table public.learning_central_studies_v2_candidates
  add constraint learning_central_studies_v2_candidates_publication_status_check
  check (publication_status in ('STAGING', 'PUBLISHED', 'UNPUBLISHED'));
SQL

docker exec "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE ROLE $executor_admin LOGIN SUPERUSER;" >/dev/null
docker exec "$db_container" psql -U "$executor_admin" -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE ROLE $executor_role LOGIN NOINHERIT PASSWORD '$executor_password';" >/dev/null
docker exec "$db_container" psql -U "$executor_admin" -d postgres -v ON_ERROR_STOP=1 \
  -c "GRANT postgres TO $executor_role;" >/dev/null
docker exec "$db_container" psql -U "$executor_admin" -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE $executor_database OWNER postgres;" >/dev/null
docker exec "$db_container" psql -U postgres -d "$executor_database" -v ON_ERROR_STOP=1 \
  -c "CREATE SCHEMA supabase_migrations;
      CREATE TABLE supabase_migrations.schema_migrations (
        version text PRIMARY KEY NOT NULL,
        statements text[],
        name text
      );
      INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
        VALUES ('20261025000600', ARRAY[]::text[], 'baseline');
      CREATE TABLE public.migration_executor_probe (
        session_user_name text NOT NULL,
        current_user_name text NOT NULL,
        current_role_name text NOT NULL,
        role_setting text NOT NULL,
        is_superuser boolean NOT NULL
      );
      CREATE TABLE public.learning_central_studies_v2_candidates (publication_status text NOT NULL);
      ALTER TABLE public.learning_central_studies_v2_candidates
        ADD CONSTRAINT learning_central_studies_v2_candidates_publication_status_check
        CHECK (publication_status IN ('STAGING', 'PUBLISHED'));" >/dev/null
# Prove the database URL and CLI connection while the owner login is still a
# superuser; the later non-superuser fixture models a hosted migration owner.
if ! owner_connection_output="$("$promotion_test_supabase_bin" --workdir "$executor_fixture" db query \
  --db-url "$executor_owner_db_url" --agent yes --output-format json --log-level error \
  'select 1 as executor_owner_connection' 2>&1)"; then
  printf 'Supabase CLI owner connection failed before role modeling; sanitized diagnostics follow:\n' >&2
  printf '%s\n' "$owner_connection_output" | sed -E \
    -e 's#(postgres(ql)?://[^:/@]+:)[^@/]+@#\1<redacted>@#g' \
    -e 's/(password|token|secret|key)=([^[:space:]]+)/\1=<redacted>/Ig' >&2
  exit 1
fi
# Model the hosted arrangement where postgres owns objects but is not a
# superuser. Keep a disposable admin only for CI cleanup.
docker exec "$db_container" psql -U "$executor_admin" -d postgres -v ON_ERROR_STOP=1 \
  -c 'ALTER ROLE postgres NOSUPERUSER;' >/dev/null
if ! docker exec --env "PGPASSWORD=$executor_password" "$db_container" \
  psql -h 127.0.0.1 -U "$executor_role" -d "$executor_database" \
    -X -A -t -v ON_ERROR_STOP=1 -c 'select 1;' >/dev/null; then
  echo 'Disposable cli_login role could not connect over TCP with its test password' >&2
  exit 1
fi
run_cli_identity_query() {
  local sql="$1"
  "$promotion_test_supabase_bin" --workdir "$executor_fixture" db query \
    --db-url "$executor_db_url" --agent yes --output-format json --log-level error "$sql"
}

run_cli_identity_query_debug() {
  local sql="$1"
  "$promotion_test_supabase_bin" --debug --workdir "$executor_fixture" db query \
    --db-url "$executor_db_url" --agent yes --output-format json --log-level error "$sql"
}

assert_cli_executor_identity() {
  local query_output="$1" expected_current_user="$2"
  CLI_IDENTITY_QUERY_OUTPUT="$query_output" EXPECTED_CURRENT_USER="$expected_current_user" \
    EXPECTED_SESSION_USER="$executor_role" python3 - <<'PY'
import json
import os

raw_output = os.environ["CLI_IDENTITY_QUERY_OUTPUT"]
decoder = json.JSONDecoder()
documents = []
cursor = 0
while cursor < len(raw_output):
    if raw_output[cursor] not in "[{":
        cursor += 1
        continue
    try:
        document, end = decoder.raw_decode(raw_output, cursor)
    except json.JSONDecodeError:
        cursor += 1
        continue
    documents.append(document)
    cursor = end
if not documents:
    # The CLI can emit a human-readable login notice before its JSON payload.
    # Show a short, credential-scrubbed excerpt if the expected payload is absent.
    import re
    safe_excerpt = re.sub(
        r"(postgres(?:ql)?://[^:/@]+:)[^@/]+@", r"\1<redacted>@", raw_output
    )
    safe_excerpt = re.sub(
        r"(password|token|secret|key)=([^\s]+)", r"\1=<redacted>", safe_excerpt, flags=re.I
    )
    raise SystemExit(
        "Supabase CLI identity query did not return JSON; output="
        + repr(safe_excerpt[:500])
    )
matches = []

def visit(value):
    if isinstance(value, str) and value.startswith(("{", "[")):
        try:
            visit(json.loads(value))
        except json.JSONDecodeError:
            return
    elif isinstance(value, dict):
        if "session_user" in value and "current_user" in value:
            matches.append(value)
        for child in value.values():
            visit(child)
    elif isinstance(value, list):
        for child in value:
            visit(child)

for document in documents:
    visit(document)
if len(matches) != 1:
    raise SystemExit("Supabase CLI identity query did not return exactly one identity")
identity = matches[0]
if identity["session_user"] != os.environ["EXPECTED_SESSION_USER"]:
    raise SystemExit("Supabase CLI session_user did not match the disposable login role")
if identity["current_user"] != os.environ["EXPECTED_CURRENT_USER"]:
    raise SystemExit("Supabase CLI current_user did not match the expected execution role")
if identity.get("current_role") != os.environ["EXPECTED_CURRENT_USER"]:
    raise SystemExit("Supabase CLI current_role did not match the expected execution role")
if identity.get("role_setting") != os.environ["EXPECTED_CURRENT_USER"]:
    raise SystemExit("Supabase CLI role setting did not match the expected execution role")
PY
}

report_executor_cli_failure() {
  local command_output="$1"
  printf 'Supabase CLI executor-context query failed; sanitized diagnostics follow:\n' >&2
  printf '%s\n' "$command_output" | sed -E \
    -e 's#(postgres(ql)?://[^:/@]+:)[^@/]+@#\1<redacted>@#g' \
    -e 's/(password|token|secret|key)=([^[:space:]]+)/\1=<redacted>/Ig' >&2
}

if ! hook_identity="$(run_cli_identity_query \
  "select json_build_object('session_user', session_user::text, 'current_user', current_user::text, 'current_role', current_role::text, 'role_setting', coalesce(nullif(current_setting('role', true), ''), 'none')) as identity" 2>&1)"; then
  if ! debug_output="$(run_cli_identity_query_debug \
    "select json_build_object('session_user', session_user::text, 'current_user', current_user::text, 'current_role', current_role::text, 'role_setting', coalesce(nullif(current_setting('role', true), ''), 'none')) as identity" 2>&1)"; then
    report_executor_cli_failure "$debug_output"
  else
    report_executor_cli_failure "$hook_identity"
  fi
  exit 1
fi
assert_cli_executor_identity "$hook_identity" postgres

set +e
executor_push_output="$("$promotion_test_supabase_bin" --workdir "$executor_fixture" db push \
  --db-url "$executor_db_url" --yes --log-level error 2>&1)"
executor_push_status=$?
set -e
if [[ "$executor_push_status" -ne 0 ]]; then
  printf 'Disposable Supabase CLI executor identity/DDL probe failed; sanitized diagnostics follow:\n' >&2
  printf '%s\n' "$executor_push_output" | sed -E \
    -e 's#(postgres(ql)?://[^:/@]+:)[^@/]+@#\1<redacted>@#g' \
    -e 's/(password|token|secret|key)=([^[:space:]]+)/\1=<redacted>/Ig' >&2
  exit 1
fi
executor_ledger="$(docker exec "$db_container" psql -U postgres -d "$executor_database" \
  -X -A -t -v ON_ERROR_STOP=1 -c \
  'select version from supabase_migrations.schema_migrations order by version;')"
executor_identity="$(docker exec "$db_container" psql -U postgres -d "$executor_database" \
  -X -A -t -v ON_ERROR_STOP=1 -c \
  "select session_user_name || '|' || current_user_name || '|' || current_role_name || '|' || role_setting || '|' || is_superuser
     from public.migration_executor_probe;")"
executor_constraint="$(docker exec "$db_container" psql -U postgres -d "$executor_database" \
  -X -A -t -v ON_ERROR_STOP=1 -c \
  "select count(*) = 1 and bool_and(pg_get_constraintdef(constraint_row.oid) like '%UNPUBLISHED%')
     from pg_constraint constraint_row
    join pg_class relation_row on relation_row.oid = constraint_row.conrelid
    join pg_namespace namespace_row on namespace_row.oid = relation_row.relnamespace
   where namespace_row.nspname = 'public'
     and relation_row.relname = 'learning_central_studies_v2_candidates'
     and constraint_row.conname = 'learning_central_studies_v2_candidates_publication_status_check';")"
[[ "$executor_ledger" == $'20261025000600\n20261025000650\n20261025000700' && \
  "$executor_identity" == "$executor_role|postgres|postgres|postgres|false" && \
  "$executor_constraint" == 't' ]] || {
  echo 'Disposable executor did not preserve the CLI role through RESET ALL and the candidate ALTER TABLE' >&2
  exit 1
}
echo 'PROMOTE_SINGLE_MIGRATION_POSTGRES_CLI_EXECUTOR_ROLE_RESET=PASS'
echo 'PROMOTE_SINGLE_MIGRATION_POSTGRES_CLI_EXECUTOR_CANDIDATE_DDL=PASS'
echo 'PROMOTE_SINGLE_MIGRATION_POSTGRES_CLI_TARGET_DDL_PROBE=PASS'
echo 'PROMOTION_POSTGRES_PRODUCTION_42501_REPRODUCED=NO'
