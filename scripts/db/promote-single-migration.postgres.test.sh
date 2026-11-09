#!/usr/bin/env bash
set -euo pipefail
set +x

repo_root="${PROMOTION_TEST_PROJECT_ROOT:-$(git rev-parse --show-toplevel)}"
promoter="$repo_root/scripts/db/promote-single-migration.sh"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/tecescola-promote-v14-pg.XXXXXX")"
raw_db_url="${PROMOTION_TEST_DB_URL:-}"
db_container="${PROMOTION_TEST_DB_CONTAINER:-$(docker ps --format '{{.Names}}' | awk '/^supabase_db_/{print; exit}')}"
databases=(promoter_v14_no_backup_ci promoter_v14_backup_present_ci promoter_v14_preapply_failure_ci promoter_v14_multi_pending_ci promoter_v14_destructive_ci promoter_v14_uncertain_ci)
trap 'status=$?; printf "PROMOTION_TEST_FAILURE_LINE=%s STATUS=%s\\n" "${BASH_LINENO[0]:-unknown}" "$status" >&2' ERR

cleanup() {
  local database
  for database in "${databases[@]}"; do
    docker exec "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
      -c "DROP DATABASE IF EXISTS $database WITH (FORCE);" >/dev/null 2>&1 || true
  done
  rm -rf -- "$tmp"
}
trap cleanup EXIT

[[ -n "$db_container" ]] || { echo 'Disposable Supabase PostgreSQL container not found' >&2; exit 1; }
if [[ -z "$raw_db_url" ]]; then
  status_output="$(npx supabase status -o env)"
  raw_db_url="$(printf '%s\n' "$status_output" | sed -n 's/^DB_URL=//p' | head -n 1 | sed -E "s/^[\\\"']//; s/[\\\"']$//")"
fi
[[ -n "$raw_db_url" ]] || { echo 'Supabase local DB_URL unavailable' >&2; exit 1; }

mkdir -p "$tmp/bin"
cli_bin="$(command -v npx)"
[[ -n "$cli_bin" ]] || { echo 'npx unavailable in PostgreSQL integration test' >&2; exit 1; }

new_fixture() {
  local fixture="$1"
  mkdir -p "$fixture/supabase/migrations"
  printf 'project_id = "promoter-v14-ci"\n' > "$fixture/supabase/config.toml"
  printf 'select 1;\n' > "$fixture/supabase/migrations/20260101000000_baseline.sql"
  cat > "$fixture/supabase/migrations/20260102000000_probe.sql" <<'SQL'
create table public.promoter_v14_probe (id integer primary key);
alter table public.promoter_v14_probe enable row level security;
create policy promoter_v14_probe_isolation on public.promoter_v14_probe
  for select to authenticated using (false);
insert into public.promoter_v14_probe (id) values (1);
SQL
  git -C "$fixture" init -q
  git -C "$fixture" config user.name 'Migration promoter V14 CI'
  git -C "$fixture" config user.email 'migration-promoter-v14-ci@example.invalid'
  git -C "$fixture" remote add origin 'https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git'
  git -C "$fixture" add supabase
  git -C "$fixture" commit -q -m 'disposable migration promoter V14 fixture'
}

database_url() {
  RAW_DB_URL="$raw_db_url" DATABASE_NAME="$1" python3 - <<'PY'
import os
from urllib.parse import urlsplit, urlunsplit

parts = urlsplit(os.environ["RAW_DB_URL"])
if parts.scheme not in ("postgres", "postgresql"):
    raise SystemExit("Unexpected disposable PostgreSQL URL scheme")
if parts.hostname not in ("127.0.0.1", "localhost", "::1"):
    raise SystemExit("Refusing to connect to a non-loopback test database")
if not parts.username or not parts.password or not parts.port:
    raise SystemExit("Disposable PostgreSQL URL is incomplete")
# The loopback CI service is plaintext-only; production URLs never use this helper.
print(urlunsplit((parts.scheme, parts.netloc, "/" + os.environ["DATABASE_NAME"], "sslmode=disable", "")))
PY
}

init_database() {
  local database="$1"
  docker exec "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE $database;" >/dev/null
  docker exec "$db_container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 -c \
    "CREATE SCHEMA supabase_migrations;
     CREATE TABLE supabase_migrations.schema_migrations (
       version text PRIMARY KEY NOT NULL, statements text[], name text
     );
     INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
       VALUES ('20260101000000', ARRAY[]::text[], 'baseline');" >/dev/null
}

database_identity() {
  docker exec "$db_container" psql -U postgres -d "$1" -X -A -t -v ON_ERROR_STOP=1 \
    -c "select system_identifier::text || '|' || current_database() from pg_control_system();"
}

run_promoter() {
  local fixture="$1" database="$2" action="$3" cli_override="${4:-}"
  local db_url identity source_commit target_file target_hash
  db_url="$(database_url "$database")"
  identity="$(database_identity "$database")"
  source_commit="$(git -C "$fixture" rev-parse HEAD)"
  target_file="$fixture/supabase/migrations/20260102000000_probe.sql"
  target_hash="$(sed 's/\r$//' "$target_file" | sha256sum | awk '{print $1}')"
  SOURCE_ROOT="$fixture" \
  TARGET_VERSION=20260102000000 \
  EXPECTED_REMOTE_LAST="${EXPECTED_REMOTE_LAST_OVERRIDE:-20260101000000}" \
  EXPECTED_SOURCE_COMMIT="$source_commit" \
  EXPECTED_TARGET_SHA256="${EXPECTED_TARGET_SHA256_OVERRIDE:-$target_hash}" \
  PRODUCTION_DB_URL="$db_url" \
  TECESCOLA_VERIFIED_DATABASE_IDENTITY="${PROMOTION_TEST_EXPECTED_DATABASE_IDENTITY:-$identity}" \
  CONFIRM_PRODUCTION_WRITE=I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION \
  DESTRUCTIVE_SQL_REVIEW_SHA256="${PROMOTION_TEST_DESTRUCTIVE_REVIEW_SHA256:-}" \
  PROMOTE_SINGLE_MIGRATION_CLI_BINARY="${cli_override:-}" \
  PROMOTION_TEST_DB_URL="$db_url" \
  APPLY="$action" \
  TMPDIR="$tmp" \
  "$promoter"
}

safe_fixture="$tmp/source-safe"
new_fixture "$safe_fixture"
init_database promoter_v14_no_backup_ci
no_backup_output="$(BACKUP_GATE=FAIL \
  BACKUP_EXCEPTION_BACKUP_FILE="$tmp/does-not-exist" \
  ACCEPT_NO_BACKUP_COPY=not-required \
  run_promoter "$safe_fixture" promoter_v14_no_backup_ci 1)"
grep -Fxq 'PROMOTION=APPLIED' <<< "$no_backup_output"
grep -Fxq 'BACKUP_POLICY=NOT_REQUIRED' <<< "$no_backup_output"
grep -Fxq 'BACKUP_REQUIRED=NO' <<< "$no_backup_output"
grep -Fxq 'RECOVERY_CAPABILITY=UNVERIFIED_OR_UNAVAILABLE' <<< "$no_backup_output"
! grep -Fxq 'BACKUP_GATE=PASS' <<< "$no_backup_output"
! grep -q '^BACKUP_EXCEPTION_' <<< "$no_backup_output"
grep -Fxq 'DRY_RUN_PENDING_COUNT=1' <<< "$no_backup_output"
probe_count="$(docker exec "$db_container" psql -U postgres -d promoter_v14_no_backup_ci \
  -X -A -t -v ON_ERROR_STOP=1 -c 'select count(*) from public.promoter_v14_probe;')"
[[ "$probe_count" == '1' ]]

init_database promoter_v14_backup_present_ci
printf 'non-backup test marker\n' > "$tmp/present-marker"
present_output="$(BACKUP_GATE=PASS \
  BACKUP_EXCEPTION_BACKUP_FILE="$tmp/present-marker" \
  run_promoter "$safe_fixture" promoter_v14_backup_present_ci 1)"
grep -Fxq 'PROMOTION=APPLIED' <<< "$present_output"
grep -Fxq 'BACKUP_POLICY=NOT_REQUIRED' <<< "$present_output"
! grep -Fxq 'BACKUP_GATE=PASS' <<< "$present_output"
! grep -q '^BACKUP_EXCEPTION_' <<< "$present_output"

if BACKUP_GATE=PASS BACKUP_EXCEPTION_BACKUP_FILE="$tmp/does-not-exist" \
  run_promoter "$safe_fixture" promoter_v14_no_backup_ci 1 >"$tmp/reapplied.out" 2>&1; then
  echo 'Already-applied migration was unexpectedly run again' >&2
  exit 1
fi
grep -Fq 'target migration is already applied' "$tmp/reapplied.out"

if PROMOTION_TEST_EXPECTED_DATABASE_IDENTITY='1|wrong_database' \
  run_promoter "$safe_fixture" promoter_v14_backup_present_ci 0 >"$tmp/wrong-identity.out" 2>&1; then
  echo 'Wrong cluster/database identity was unexpectedly accepted' >&2
  exit 1
fi
grep -Fq 'target database identity differs' "$tmp/wrong-identity.out"

if EXPECTED_TARGET_SHA256_OVERRIDE=wrong run_promoter "$safe_fixture" promoter_v14_backup_present_ci 0 >"$tmp/wrong-hash.out" 2>&1; then
  echo 'Incorrect migration hash was unexpectedly accepted' >&2
  exit 1
fi
grep -Fq 'target migration hash mismatch' "$tmp/wrong-hash.out"

if EXPECTED_REMOTE_LAST_OVERRIDE=20260103000000 \
  run_promoter "$safe_fixture" promoter_v14_backup_present_ci 0 >"$tmp/wrong-predecessor.out" 2>&1; then
  echo 'Incorrect migration predecessor was unexpectedly accepted' >&2
  exit 1
fi
grep -Fq 'remote last migration differs from expected' "$tmp/wrong-predecessor.out"

init_database promoter_v14_multi_pending_ci
printf 'Would push migration 20260102000000\nWould push migration 20260103000000\n' > "$tmp/multi-pending"
if DRY_RUN_OUTPUT_FILE="$tmp/multi-pending" \
  run_promoter "$safe_fixture" promoter_v14_multi_pending_ci 0 >"$tmp/multi-pending.out" 2>&1; then
  echo 'Multiple pending migrations were unexpectedly accepted' >&2
  exit 1
fi
grep -Fq 'dry-run contains an unexpected number of migrations' "$tmp/multi-pending.out"

cat > "$tmp/fail-dry-run" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
[[ " $* " == *' --dry-run '* ]] || exit 31
echo 'simulated dry-run connection failure' >&2
exit 32
SH
chmod +x "$tmp/fail-dry-run"
init_database promoter_v14_preapply_failure_ci
if run_promoter "$safe_fixture" promoter_v14_preapply_failure_ci 1 "$tmp/fail-dry-run" >"$tmp/dry-run-failure.out" 2>&1; then
  echo 'Dry-run failure was unexpectedly accepted' >&2
  exit 1
fi
grep -Fq 'supabase dry-run failed' "$tmp/dry-run-failure.out"
pending_count="$(docker exec "$db_container" psql -U postgres -d promoter_v14_preapply_failure_ci \
  -X -A -t -v ON_ERROR_STOP=1 -c 'select count(*) from supabase_migrations.schema_migrations;')"
[[ "$pending_count" == '1' ]]

destructive_fixture="$tmp/source-destructive"
new_fixture "$destructive_fixture"
printf 'drop table public.promoter_v14_probe;\n' > \
  "$destructive_fixture/supabase/migrations/20260102000000_probe.sql"
git -C "$destructive_fixture" add supabase/migrations/20260102000000_probe.sql
git -C "$destructive_fixture" commit -q -m 'destructive test migration'
init_database promoter_v14_destructive_ci
printf 'Would push migration 20260102000000\n' > "$tmp/destructive-dry-run"
if DRY_RUN_OUTPUT_FILE="$tmp/destructive-dry-run" \
  run_promoter "$destructive_fixture" promoter_v14_destructive_ci 1 >"$tmp/destructive.out" 2>&1; then
  echo 'Destructive SQL without exact-hash review was unexpectedly accepted' >&2
  exit 1
fi
grep -Fq 'requires review bound to the exact migration SHA-256' "$tmp/destructive.out"
pending_count="$(docker exec "$db_container" psql -U postgres -d promoter_v14_destructive_ci \
  -X -A -t -v ON_ERROR_STOP=1 -c 'select count(*) from supabase_migrations.schema_migrations;')"
[[ "$pending_count" == '1' ]]

init_database promoter_v14_uncertain_ci
cat > "$tmp/fail-after-ledger-write" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [[ " $* " == *' --dry-run '* ]]; then
  printf 'Would push migration %s\n' "$TARGET_VERSION"
  exit 0
fi
printf 'attempt\n' >> "$PROMOTION_TEST_CLI_ATTEMPTS"
psql "$PROMOTION_TEST_DB_URL" -X -v ON_ERROR_STOP=1 -c \
  "insert into supabase_migrations.schema_migrations (version, statements, name) values ('$TARGET_VERSION', ARRAY[]::text[], 'uncertain');" >/dev/null
echo 'simulated connection lost after database commit' >&2
exit 47
SH
chmod +x "$tmp/fail-after-ledger-write"
export PROMOTION_TEST_CLI_ATTEMPTS="$tmp/uncertain-attempts"
if run_promoter "$safe_fixture" promoter_v14_uncertain_ci 1 "$tmp/fail-after-ledger-write" >"$tmp/uncertain.out" 2>&1; then
  echo 'Uncertain apply failure was unexpectedly accepted' >&2
  exit 1
fi
grep -Fxq 'PROMOTION_OUTCOME=UNKNOWN_DO_NOT_RETRY' "$tmp/uncertain.out"
grep -Fxq 'APPLY_FAILURE_LEDGER=CHANGED_RECONCILIATION_REQUIRED' "$tmp/uncertain.out"
[[ "$(wc -l < "$PROMOTION_TEST_CLI_ATTEMPTS" | tr -d '[:space:]')" == '1' ]]
[[ "$(docker exec "$db_container" psql -U postgres -d promoter_v14_uncertain_ci -X -A -t -v ON_ERROR_STOP=1 \
  -c "select count(*) from supabase_migrations.schema_migrations where version = '20260102000000';")" == '1' ]]

printf 'PROMOTE_SINGLE_MIGRATION_POSTGRES_V14_POLICY=PASS\n'
