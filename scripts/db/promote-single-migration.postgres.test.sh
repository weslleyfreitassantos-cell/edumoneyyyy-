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

cleanup() {
  for database in promoter_historical_ci promoter_chronological_ci promoter_backup_exception_ci promoter_fast_delivery_exception_ci; do
    docker exec "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
      -c "DROP DATABASE IF EXISTS $database WITH (FORCE);" >/dev/null 2>&1 || true
  done
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
elif [[ "$#" == '1' && -n "${PROMOTION_TEST_MIGRATION_RAW_FILE:-}" && "$1" == "$PROMOTION_TEST_MIGRATION_RAW_FILE" ]]; then
  printf '%s  %s\n' "${PROMOTION_TEST_MIGRATION_RAW_SHA256:?}" "$1"
elif [[ "$#" == '0' && -n "${PROMOTION_TEST_MIGRATION_SHA256:-}" ]]; then
  cat >/dev/null
  printf '%s  -\n' "$PROMOTION_TEST_MIGRATION_SHA256"
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

# Prove the newly approved, hash-limited fast-delivery exception can apply a
# migration to a disposable PostgreSQL database while keeping all recovery
# risks visible and rejecting every version outside its allowlist.
fast_delivery_version=20261025000100
fast_delivery_base_version=20261024000100
fast_delivery_approved_hash=bea4c981901f75bef1b1be9fa1306f813db4b19cb781472468f7049b58ebcb39
fast_delivery_hash=6e3a281516461a4a1dbf88d5f1650a78dd286e60cb587062a8dd94cdd0c8ac5d
fast_delivery_database=promoter_fast_delivery_exception_ci
fast_delivery_db_url="${test_db_url%/promoter_historical_ci}/${fast_delivery_database}"
fast_delivery_fixture="$tmp/fast-delivery-fixture"
fast_delivery_backup="$tmp/verified-windows-backup-fast-delivery-fixture.tar.gz"
printf 'CI placeholder for the previously verified Windows backup\n' > "$fast_delivery_backup"
init_fixture "$fast_delivery_fixture" "$fast_delivery_base_version" "$fast_delivery_version" \
  fast_delivery_candidate_test "$fast_delivery_database"
fast_delivery_source_commit="$(git -C "$fast_delivery_fixture" rev-parse HEAD)"
mkdir -p "$tmp/fast-delivery-exception-bin"
cp "$tmp/exception-bin/sha256sum" "$tmp/fast-delivery-exception-bin/sha256sum"
fast_delivery_output="$(PATH="$tmp/fast-delivery-exception-bin:$tmp/bin:$PATH" \
  PROMOTION_TEST_DB_CONTAINER="$db_container" \
  PROMOTION_TEST_DATABASE_NAME="$fast_delivery_database" \
  PROMOTION_TEST_CLI_LOG_DIR="$tmp/cli-logs" \
  PROMOTION_TEST_SUPABASE_BIN="$promotion_test_supabase_bin" \
  PROMOTE_SINGLE_MIGRATION_CLI_BINARY="$tmp/bin/supabase-with-timeout" \
  PROMOTION_TEST_REAL_SHA256SUM="$real_sha256sum" \
  PROMOTION_TEST_BACKUP_FILE="$fast_delivery_backup" \
  PROMOTION_TEST_MIGRATION_SHA256="$fast_delivery_hash" \
  PROMOTION_TEST_MIGRATION_RAW_FILE="$(find "$fast_delivery_fixture/supabase/migrations" -maxdepth 1 -type f -name "${fast_delivery_version}_*.sql" -print -quit)" \
  PROMOTION_TEST_MIGRATION_RAW_SHA256="$fast_delivery_hash" \
  SOURCE_ROOT="$fast_delivery_fixture" \
  TARGET_VERSION="$fast_delivery_version" \
  EXPECTED_REMOTE_LAST="$fast_delivery_base_version" \
  EXPECTED_SOURCE_COMMIT="$fast_delivery_source_commit" \
  EXPECTED_TARGET_SHA256="$fast_delivery_hash" \
  PRODUCTION_DB_URL="$fast_delivery_db_url" \
  APPLY=1 BACKUP_GATE=FAIL \
  BACKUP_EXCEPTION_SCOPE=TECESCOLA_FAST_DELIVERY \
  BACKUP_EXCEPTION_WINDOWS_PATH='C:\Users\samue\Backups\TecEscola\edumoney-2026-10-24T07-41-52Z.tar.gz' \
  BACKUP_EXCEPTION_BACKUP_SHA256=b8818e0b97a2152d60b1405f90d089a1ab4b43ba87d2739f234afb038b28d5c0 \
  BACKUP_EXCEPTION_BACKUP_FILE="$fast_delivery_backup" \
  BACKUP_EXCEPTION_RESTORE_STATUS=PARTIAL \
  BACKUP_EXCEPTION_STORAGE_STATUS=PARTIAL \
  BACKUP_EXCEPTION_OFFSITE_GATE=FAIL \
  ACCEPT_INCOMPLETE_RECOVERY_RISK=I_ACCEPT_INCOMPLETE_RECOVERY_RISK_FOR_TECESCOLA_FAST_DELIVERY \
  CONFIRM_PRODUCTION_WRITE=I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION \
  TMPDIR="$tmp" \
  "$promoter")"
printf '%s\n' "$fast_delivery_output"
grep -Fxq 'BACKUP_GATE=FAIL' <<< "$fast_delivery_output"
grep -Fxq 'BACKUP_EXCEPTION=USED' <<< "$fast_delivery_output"
grep -Fxq 'BACKUP_EXCEPTION_SCOPE=TECESCOLA_FAST_DELIVERY' <<< "$fast_delivery_output"
grep -Fxq "BACKUP_EXCEPTION_MIGRATION_VERSION=$fast_delivery_version" <<< "$fast_delivery_output"
grep -Fxq "BACKUP_EXCEPTION_MIGRATION_SHA256=$fast_delivery_hash" <<< "$fast_delivery_output"
grep -Fxq "BACKUP_EXCEPTION_MIGRATION_SHA256_WINDOWS_APPROVED=$fast_delivery_approved_hash" <<< "$fast_delivery_output"
grep -Fxq "BACKUP_EXCEPTION_MIGRATION_SHA256_ON_DISK=$fast_delivery_hash" <<< "$fast_delivery_output"
grep -Fxq 'BACKUP_EXCEPTION_RESTORE=PARTIAL' <<< "$fast_delivery_output"
grep -Fxq 'BACKUP_EXCEPTION_STORAGE=PARTIAL' <<< "$fast_delivery_output"
grep -Fxq 'BACKUP_EXCEPTION_OFFSITE_GATE=FAIL' <<< "$fast_delivery_output"
grep -Fxq 'BACKUP_EXCEPTION_RISK_ACCEPTANCE=ACCEPTED' <<< "$fast_delivery_output"
grep -Fxq 'PROMOTION=APPLIED' <<< "$fast_delivery_output"
grep -Fxq 'REMOTE_AFTER_COUNT=2' <<< "$fast_delivery_output"
grep -Fxq "REMOTE_AFTER_LAST=$fast_delivery_version" <<< "$fast_delivery_output"
fast_delivery_table_count="$(docker exec "$db_container" psql -U postgres -d "$fast_delivery_database" \
  -X -A -t -v ON_ERROR_STOP=1 -c \
  "select count(*) from public.fast_delivery_candidate_test_probe where id = 1;")"
[[ "$fast_delivery_table_count" == '1' ]]
echo 'PROMOTE_SINGLE_MIGRATION_POSTGRES_FAST_DELIVERY_EXCEPTION=PASS'
