#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
script="$repo_root/scripts/db/promote-single-migration.sh"
target_version=20261013003200
expected_last=20261019000500
source_commit="$(git -C "$repo_root" rev-parse HEAD)"
target_file="$(find "$repo_root/supabase/migrations" -maxdepth 1 -type f -name "${target_version}_*.sql" -print -quit)"
[[ -n "$target_file" ]]
target_hash="$(sed 's/\r$//' "$target_file" | sha256sum | awk '{print $1}')"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/tecescola-promote-test.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/guard-tmp"

eval "$(sed -n '/^safe_cli_failure_class()/,/^}/p' "$script")"
[[ "$(safe_cli_failure_class 'dial tcp 127.0.0.1:1234: connectex: actively refused')" == 'database_connection_refused' ]]
[[ "$(safe_cli_failure_class 'context deadline exceeded while dialing')" == 'database_connection_timeout' ]]
[[ "$(safe_cli_failure_class 'no pg_hba.conf entry: no encryption')" == 'database_access_policy' ]]
[[ "$(safe_cli_failure_class 'ERROR: V9_EXPANSION_SKILL_UNAVAILABLE:ART')" == 'database_migration_invariant' ]]
[[ "$(safe_cli_failure_class 'ERROR: duplicate key SQLSTATE 23505')" == 'database_migration_error' ]]

ledger="$tmp/ledger"
dry_run="$tmp/dry-run"
after_ledger="$tmp/after-ledger"
cli_apply_count="$tmp/cli-apply-count"
psql_call_count="$tmp/psql-call-count"
printf '%s\n' "$expected_last" > "$ledger"
printf 'Would push migration %s\n' "$target_version" > "$dry_run"
printf '%s\n' "$expected_last" "$target_version" > "$after_ledger"
printf '0\n' > "$cli_apply_count"
printf '0\n' > "$psql_call_count"

run_guard() {
  SOURCE_ROOT="${TEST_SOURCE_ROOT:-$repo_root}" \
  TARGET_VERSION="${TEST_TARGET_VERSION:-$target_version}" \
  EXPECTED_REMOTE_LAST="${TEST_EXPECTED_REMOTE_LAST:-${EXPECTED_REMOTE_LAST_OVERRIDE:-$expected_last}}" \
  EXPECTED_SOURCE_COMMIT="${TEST_SOURCE_COMMIT:-$source_commit}" \
  EXPECTED_TARGET_SHA256="${TEST_TARGET_SHA256:-${EXPECTED_TARGET_SHA256_OVERRIDE:-$target_hash}}" \
  PRODUCTION_DB_URL="${PRODUCTION_DB_URL_OVERRIDE:-postgresql://fixture_user:dummy%21secret@fixture.invalid:5432/postgres?sslmode=require}" \
  TMPDIR="$tmp/guard-tmp" \
  REAL_SHA256SUM="${real_sha256sum:-}" \
  REMOTE_LEDGER_FILE="${TEST_REMOTE_LEDGER_FILE:-$ledger}" \
  DRY_RUN_OUTPUT_FILE="${TEST_DRY_RUN_OUTPUT_FILE:-${DRY_RUN_OUTPUT_FILE_OVERRIDE-$dry_run}}" \
  EXPECT_INCLUDE_ALL="${TEST_EXPECT_INCLUDE_ALL:-1}" \
  MOCK_AFTER_LEDGER_FILE="$after_ledger" \
  MOCK_AFTER_LEDGER_CONTENT="${TEST_AFTER_LEDGER_CONTENT:-$expected_last
$target_version}" \
  MOCK_CLI_APPLY_COUNT_FILE="$cli_apply_count" \
  MOCK_PSQL_CALL_COUNT_FILE="$psql_call_count" \
  "$script"
}

success="$(run_guard)"
grep -q '^REMOTE_MIGRATION_COUNT=1$' <<< "$success"
grep -q '^WORKDIR_MIGRATION_COUNT=2$' <<< "$success"
grep -q '^DRY_RUN_PENDING_COUNT=1$' <<< "$success"
grep -q "^DRY_RUN_PENDING_VERSION=$target_version$" <<< "$success"
if [[ "$success" == *dummy* || "$success" == *fixture_user* ]]; then
  echo "connection credentials leaked into promotion output" >&2
  exit 1
fi

expect_failure() {
  if run_guard >/dev/null 2>&1; then
    echo "expected selective promotion guard failure" >&2
    exit 1
  fi
}

printf 'Already applied %s\nWould push migration %s\n' "$expected_last" "$target_version" > "$dry_run"
success="$(run_guard)"
grep -q '^DRY_RUN_PENDING_COUNT=1$' <<< "$success"
grep -q "^DRY_RUN_PENDING_VERSION=$target_version$" <<< "$success"

printf '%s\n' "$target_version" 20261004000100 > "$dry_run"
expect_failure
printf 'Would push migration %s\n' "$target_version" > "$dry_run"

EXPECTED_REMOTE_LAST_OVERRIDE=20260709000000 expect_failure
unset EXPECTED_REMOTE_LAST_OVERRIDE

printf '%s\n' "$expected_last" "$target_version" > "$ledger"
EXPECTED_REMOTE_LAST_OVERRIDE="$target_version" expect_failure
printf '%s\n' "$expected_last" > "$ledger"

EXPECTED_TARGET_SHA256_OVERRIDE=bad expect_failure
unset EXPECTED_TARGET_SHA256_OVERRIDE

PRODUCTION_DB_URL_OVERRIDE='postgresql://fixture_user@fixture.invalid:5432/postgres' expect_failure
unset PRODUCTION_DB_URL_OVERRIDE

PRODUCTION_DB_URL_OVERRIDE='postgresql://fixture_user:dummy%21secret@fixture.invalid:5432/postgres?passfile=/tmp/secret' expect_failure
unset PRODUCTION_DB_URL_OVERRIDE
PROMOTE_SINGLE_MIGRATION_CLI_BINARY='/fixture/supabase.exe' expect_failure

mkdir -p "$tmp/bin"
real_sha256sum="$(command -v sha256sum)"
cat > "$tmp/bin/sha256sum" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
if [[ -n "${MOCK_BACKUP_FILE:-}" && "$#" == '1' && "$1" == "$MOCK_BACKUP_FILE" ]]; then
  printf '%s  %s\n' "${MOCK_BACKUP_SHA256:-b8818e0b97a2152d60b1405f90d089a1ab4b43ba87d2739f234afb038b28d5c0}" "$1"
else
  "$REAL_SHA256SUM" "$@"
fi
MOCK
cat > "$tmp/bin/ssh" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
[[ "$*" == *'tecescola-vps'* && "$*" == *'/srv/grupotec/backups/edumoney/edumoney-2026-10-25T07-43-25Z.tar.gz'* ]] || exit 56
printf '%s\n%s  %s\n' \
  "${MOCK_406_BACKUP_SIZE:-372305133}" \
  "${MOCK_406_BACKUP_SHA256:-a9f5a433cd10970cf0a5e5752ea5f71115d27bc91706fdae32265f2b56084841}" \
  '/srv/grupotec/backups/edumoney/edumoney-2026-10-25T07-43-25Z.tar.gz'
MOCK
cat > "$tmp/bin/npx" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
[[ "$*" != *dummy* && "$*" != *fixture_user* ]] || exit 31
[[ "$*" == *"${EXPECTED_SANITIZED_DB_URL:-postgresql://fixture.invalid:5432/postgres?sslmode=require}"* ]] || exit 32
[[ "${PGUSER:-}" == 'fixture_user' && "${PGPASSWORD:-}" == 'dummy!secret' && "${PGSSLMODE:-}" == "${EXPECTED_SSLMODE:-require}" ]] || exit 33
if [[ -n "${EXPECTED_CLI_EXECUTABLE:-}" ]]; then
  [[ "$0" == "$EXPECTED_CLI_EXECUTABLE" ]] || exit 39
fi
if [[ "${MOCK_CLI_FAILURE:-0}" == '1' ]]; then
  printf 'no password supplied\n' >&2
  exit 47
fi
if [[ "${EXPECT_INCLUDE_ALL:-1}" == '1' ]]; then
  [[ "$*" == *'--include-all'* ]] || exit 53
else
  [[ "$*" != *'--include-all'* ]] || exit 54
fi
if [[ "${MOCK_APPLY_FAILURE:-0}" == '1' && "$*" != *'--dry-run'* ]]; then
  printf 'ERROR: V9_EXPANSION_SKILL_UNAVAILABLE:PRIVATE_DETAIL_MUST_NOT_LEAK\n' >&2
  exit 48
fi
if [[ "${EXPECT_WSLENV_FORWARDING:-0}" == '1' ]]; then
  [[ ":${WSLENV:-}:" == *':PGUSER/w:'* && ":${WSLENV:-}:" == *':PGPASSWORD/w:'* && ":${WSLENV:-}:" == *':PGSSLMODE/w:'* ]] || exit 40
fi
if [[ "${EXPECT_WINDOWS_WORKDIR:-0}" == '1' ]]; then
  [[ "$*" == *'C:\codex-temp\tecescola-promote.'* ]] || exit 34
  workdir="$(cat "$CLI_WORKDIR_PATH_FILE")"
  [[ "$workdir" == "$CLI_WORKDIR_EXPECT_ROOT"/tecescola-promote.* ]] || exit 35
  [[ -f "$workdir/supabase/config.toml" ]] || exit 36
  [[ "$(find "$workdir/supabase/migrations" -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')" == '2' ]] || exit 37
  passfile="$(find "$CLI_PRIVATE_ROOT" -mindepth 2 -maxdepth 2 -name .pgpass -type f -print -quit)"
  [[ -n "$passfile" && "$(stat -c %a "$passfile")" == '600' ]] || exit 38
fi
if [[ "$*" == *'--dry-run'* ]]; then
  printf 'Would push migration %s\n' "$TARGET_VERSION"
else
  apply_count="$(cat "$MOCK_CLI_APPLY_COUNT_FILE")"
  printf '%s\n' "$((apply_count + 1))" > "$MOCK_CLI_APPLY_COUNT_FILE"
  printf '%s\n' "$MOCK_AFTER_LEDGER_CONTENT" > "$MOCK_AFTER_LEDGER_FILE"
  printf 'mock selective apply complete\n'
fi
MOCK
cat > "$tmp/bin/psql" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
[[ "$*" != *dummy* && "$*" != *fixture_user* ]] || exit 41
[[ "$*" == *'postgresql://fixture.invalid:5432/postgres?sslmode=require'* ]] || exit 42
[[ "${PGUSER:-}" == 'fixture_user' && -n "${PGPASSFILE:-}" && -f "$PGPASSFILE" ]] || exit 43
[[ "$(stat -c %a "$PGPASSFILE")" == '600' ]] || exit 44
grep -Fxq '*:*:*:fixture_user:dummy!secret' "$PGPASSFILE" || exit 45
[[ "$*" == *'select version from supabase_migrations.schema_migrations order by version;'* ]] || exit 46
psql_count="$(cat "$MOCK_PSQL_CALL_COUNT_FILE")"
printf '%s\n' "$((psql_count + 1))" > "$MOCK_PSQL_CALL_COUNT_FILE"
if [[ "${MOCK_PSQL_FAILURE:-0}" == '1' ]]; then
  printf 'mock post-apply query unavailable\n' >&2
  exit 49
fi
cat "$MOCK_AFTER_LEDGER_FILE"
MOCK
chmod +x "$tmp/bin/sha256sum" "$tmp/bin/ssh" "$tmp/bin/npx" "$tmp/bin/psql"
cat > "$tmp/bin/wslpath" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
[[ "$#" == '2' && "$1" == '-w' && -d "$2" ]] || exit 51
[[ "$2" == "$CLI_WORKDIR_EXPECT_ROOT"/tecescola-promote.* ]] || exit 52
printf '%s\n' "$2" > "$CLI_WORKDIR_PATH_FILE"
printf 'C:\\codex-temp\\%s\n' "$(basename "$2")"
MOCK
chmod +x "$tmp/bin/wslpath"

cp "$tmp/bin/npx" "$tmp/bin/cli-override"
cp "$tmp/bin/npx" "$tmp/bin/supabase.exe"
chmod +x "$tmp/bin/cli-override" "$tmp/bin/supabase.exe"

dry_run_prefer="$(PATH="$tmp/bin:$PATH" \
  EXPECTED_SSLMODE=prefer \
  EXPECTED_SANITIZED_DB_URL='postgresql://fixture.invalid:5432/postgres' \
  PRODUCTION_DB_URL_OVERRIDE='postgresql://fixture_user:dummy%21secret@fixture.invalid:5432/postgres' \
  DRY_RUN_OUTPUT_FILE_OVERRIDE= \
  run_guard)"
grep -q '^PROMOTION=DRY_RUN_ONLY$' <<< "$dry_run_prefer"
grep -q '^DRY_RUN_PENDING_COUNT=1$' <<< "$dry_run_prefer"

applied="$(PATH="$tmp/bin:$PATH" \
  APPLY=1 \
  BACKUP_GATE=PASS \
  CONFIRM_PRODUCTION_WRITE=I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION \
  run_guard)"
grep -q '^PROMOTION=APPLIED$' <<< "$applied"
grep -q '^REMOTE_AFTER_COUNT=2$' <<< "$applied"
grep -q "^REMOTE_AFTER_LAST=$expected_last$" <<< "$applied"
if [[ "$applied" == *dummy* || "$applied" == *fixture_user* ]]; then
  echo "connection credentials leaked into apply output" >&2
  exit 1
fi

if apply_failure="$(PATH="$tmp/bin:$PATH" \
  APPLY=1 \
  BACKUP_GATE=PASS \
  CONFIRM_PRODUCTION_WRITE=I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION \
  MOCK_APPLY_FAILURE=1 \
  run_guard 2>&1)"; then
  echo "mock CLI apply failure unexpectedly passed" >&2
  exit 1
fi
grep -q '^PROMOTION_ABORTED=selective migration push failed: database_migration_invariant$' <<< "$apply_failure"
if [[ "$apply_failure" == *PRIVATE_DETAIL_MUST_NOT_LEAK* || "$apply_failure" == *dummy* || "$apply_failure" == *fixture_user* ]]; then
  echo "connection credentials or migration details leaked from CLI apply failure" >&2
  exit 1
fi
[[ -z "$(find "$tmp/guard-tmp" -mindepth 1 -print -quit)" ]] || {
  echo "temporary promotion credentials were not cleaned up" >&2
  exit 1
}

mkdir -p "$tmp/override-tmp"
applied_override="$(PATH="$tmp/bin:$PATH" \
  APPLY=1 \
  BACKUP_GATE=PASS \
  CONFIRM_PRODUCTION_WRITE=I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION \
  PROMOTE_SINGLE_MIGRATION_CLI_BINARY="$tmp/bin/cli-override" \
  EXPECTED_CLI_EXECUTABLE="$tmp/bin/cli-override" \
  run_guard)"
grep -q '^PROMOTION=APPLIED$' <<< "$applied_override"

# A chronologically newer migration must not pass --include-all, and the
# reported maximum must advance to the target.
chronological_version=20261022000200
chronological_file="$repo_root/supabase/migrations/${chronological_version}_inventory_management.sql"
[[ -f "$chronological_file" ]]
chronological_hash="$(sed 's/\r$//' "$chronological_file" | sha256sum | awk '{print $1}')"
printf 'Would push migration %s\n' "$chronological_version" > "$tmp/chronological-dry-run"
chronological="$(PATH="$tmp/bin:$PATH" \
  APPLY=1 \
  BACKUP_GATE=PASS \
  CONFIRM_PRODUCTION_WRITE=I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION \
  TEST_TARGET_VERSION="$chronological_version" \
  TEST_TARGET_SHA256="$chronological_hash" \
  TEST_EXPECT_INCLUDE_ALL=0 \
  TEST_DRY_RUN_OUTPUT_FILE="$tmp/chronological-dry-run" \
  TEST_AFTER_LEDGER_CONTENT="$expected_last
$chronological_version" \
  run_guard)"
grep -q '^PROMOTION=APPLIED$' <<< "$chronological"
grep -q '^REMOTE_AFTER_COUNT=2$' <<< "$chronological"
grep -q "^REMOTE_AFTER_LAST=$chronological_version$" <<< "$chronological"

# After a successful apply, a failed ledger query is ambiguous. Never invite
# an automatic or blind retry of the migration.
printf '0\n' > "$cli_apply_count"
printf '0\n' > "$psql_call_count"
if query_failure="$(PATH="$tmp/bin:$PATH" \
  APPLY=1 \
  BACKUP_GATE=PASS \
  CONFIRM_PRODUCTION_WRITE=I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION \
  MOCK_PSQL_FAILURE=1 \
  run_guard 2>&1)"; then
  echo "post-apply query failure unexpectedly passed" >&2
  exit 1
fi
grep -q '^PROMOTION_OUTCOME=UNKNOWN_DO_NOT_RETRY$' <<< "$query_failure"
grep -q '^PROMOTION_ABORTED=post-promotion ledger query failed$' <<< "$query_failure"
[[ "$(cat "$cli_apply_count")" == '1' ]]
[[ "$(cat "$psql_call_count")" == '1' ]]
grep -Fxq "$target_version" "$after_ledger"

expect_post_apply_ledger_failure() {
  printf '0\n' > "$cli_apply_count"
  printf '0\n' > "$psql_call_count"
  if failure="$(PATH="$tmp/bin:$PATH" \
    APPLY=1 \
    BACKUP_GATE=PASS \
    CONFIRM_PRODUCTION_WRITE=I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION \
    TEST_AFTER_LEDGER_CONTENT="$1" \
    run_guard 2>&1)"; then
    echo "invalid post-apply ledger unexpectedly passed" >&2
    exit 1
  fi
  grep -q '^PROMOTION_OUTCOME=UNKNOWN_DO_NOT_RETRY$' <<< "$failure"
  [[ "$(cat "$cli_apply_count")" == '1' ]]
}

expect_post_apply_ledger_failure "$expected_last"
expect_post_apply_ledger_failure "$expected_last
$target_version
20261020000001"
expect_post_apply_ledger_failure "$expected_last
$target_version
$target_version"

mkdir -p "$tmp/cli-root"
applied_windows="$(PATH="$tmp/bin:$PATH" \
  APPLY=1 \
  BACKUP_GATE=PASS \
  CONFIRM_PRODUCTION_WRITE=I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION \
  EXPECT_WINDOWS_WORKDIR=1 \
  EXPECT_WSLENV_FORWARDING=1 \
  PROMOTE_SINGLE_MIGRATION_CLI_BINARY="$tmp/bin/supabase.exe" \
  EXPECTED_CLI_EXECUTABLE="$tmp/bin/supabase.exe" \
  SUPABASE_CLI_WORKDIR_ROOT="$tmp/cli-root" \
  CLI_WORKDIR_EXPECT_ROOT="$tmp/cli-root" \
  CLI_WORKDIR_PATH_FILE="$tmp/cli-workdir-path" \
  CLI_PRIVATE_ROOT="$tmp/guard-tmp" \
  run_guard)"
grep -q '^PROMOTION=APPLIED$' <<< "$applied_windows"
[[ -z "$(find "$tmp/cli-root" -mindepth 1 -print -quit)" ]] || {
  echo "temporary Windows CLI workdir was not cleaned up" >&2
  exit 1
}
[[ -z "$(find "$tmp/guard-tmp" -mindepth 1 -print -quit)" ]] || {
  echo "private credential workdir was not cleaned up" >&2
  exit 1
}

if PATH="$tmp/bin:$PATH" APPLY=1 BACKUP_GATE=FAIL \
  CONFIRM_PRODUCTION_WRITE=I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION run_guard >/dev/null 2>&1; then
  echo "backup gate failure unexpectedly allowed apply" >&2
  exit 1
fi
[[ -z "$(find "$tmp/guard-tmp" -mindepth 1 -print -quit)" ]] || {
  echo "temporary promotion credentials remained after a blocked apply" >&2
  exit 1
}

# Exercise the one release-scoped recovery exception. CI substitutes only the
# digest command for its placeholder backup file; production hashes the real
# accessible file using the system sha256sum.
exception_version=20261023000200
exception_file="$repo_root/supabase/migrations/${exception_version}_guided_study_demo_preview_state.sql"
[[ -f "$exception_file" ]]
exception_hash="$(sed 's/\r$//' "$exception_file" | "$real_sha256sum" | awk '{print $1}')"
exception_backup="$tmp/verified-windows-backup-fixture.tar.gz"
printf 'CI placeholder for the previously verified Windows backup\n' > "$exception_backup"
printf 'Would push migration %s\n' "$exception_version" > "$tmp/exception-dry-run"
printf '0\n' > "$cli_apply_count"
printf '0\n' > "$psql_call_count"
exception_output="$(PATH="$tmp/bin:$PATH" \
  REAL_SHA256SUM="$real_sha256sum" \
  MOCK_BACKUP_FILE="$exception_backup" \
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
  TEST_TARGET_VERSION="$exception_version" \
  TEST_TARGET_SHA256="$exception_hash" \
  TEST_EXPECT_INCLUDE_ALL=0 \
  TEST_DRY_RUN_OUTPUT_FILE="$tmp/exception-dry-run" \
  TEST_AFTER_LEDGER_CONTENT="$expected_last
$exception_version" \
  run_guard)"
grep -q '^BACKUP_GATE=FAIL$' <<< "$exception_output"
grep -q '^BACKUP_EXCEPTION=USED$' <<< "$exception_output"
grep -q '^BACKUP_EXCEPTION_RESTORE=PARTIAL$' <<< "$exception_output"
grep -q '^BACKUP_EXCEPTION_STORAGE=PARTIAL$' <<< "$exception_output"
grep -q '^BACKUP_EXCEPTION_OFFSITE_GATE=FAIL$' <<< "$exception_output"
grep -q '^BACKUP_EXCEPTION_RISK_ACCEPTANCE=ACCEPTED$' <<< "$exception_output"
grep -q '^PRODUCTION_WRITE_AUTHORIZATION=APPROVED$' <<< "$exception_output"
[[ "$(cat "$cli_apply_count")" == '1' ]]

expect_exception_rejected() {
  local target_version_to_test="${TEST_EXCEPTION_TARGET_VERSION:-$exception_version}"
  local target_file_to_test target_hash_to_test
  target_file_to_test="$(find "$repo_root/supabase/migrations" -maxdepth 1 -type f \
    -name "${target_version_to_test}_*.sql" -print -quit)"
  [[ -n "$target_file_to_test" ]]
  target_hash_to_test="$(sed 's/\r$//' "$target_file_to_test" | "$real_sha256sum" | awk '{print $1}')"
  printf 'Would push migration %s\n' "$target_version_to_test" > "$tmp/exception-dry-run-$target_version_to_test"
  printf '0\n' > "$cli_apply_count"
  if PATH="$tmp/bin:$PATH" \
    REAL_SHA256SUM="$real_sha256sum" \
    MOCK_BACKUP_FILE="${TEST_MOCK_BACKUP_FILE-$exception_backup}" \
    APPLY=1 BACKUP_GATE=FAIL \
    BACKUP_EXCEPTION_RELEASE_SHA="${TEST_EXCEPTION_RELEASE_SHA-36979b8adc4408bf9eaccdf77f742904fba152fc}" \
    BACKUP_EXCEPTION_WINDOWS_PATH="${TEST_EXCEPTION_WINDOWS_PATH-C:\Users\samue\Backups\TecEscola\edumoney-2026-10-24T07-41-52Z.tar.gz}" \
    BACKUP_EXCEPTION_BACKUP_SHA256="${TEST_EXCEPTION_BACKUP_SHA256-b8818e0b97a2152d60b1405f90d089a1ab4b43ba87d2739f234afb038b28d5c0}" \
    BACKUP_EXCEPTION_BACKUP_FILE="${TEST_EXCEPTION_FILE-$exception_backup}" \
    BACKUP_EXCEPTION_RESTORE_STATUS="${TEST_EXCEPTION_RESTORE_STATUS-PARTIAL}" \
    BACKUP_EXCEPTION_STORAGE_STATUS="${TEST_EXCEPTION_STORAGE_STATUS-PARTIAL}" \
    BACKUP_EXCEPTION_OFFSITE_GATE="${TEST_EXCEPTION_OFFSITE_GATE-FAIL}" \
    ACCEPT_INCOMPLETE_RECOVERY_RISK="${TEST_EXCEPTION_RISK_ACCEPTANCE-I_ACCEPT_INCOMPLETE_RECOVERY_RISK_FOR_RELEASE_399}" \
    CONFIRM_PRODUCTION_WRITE="${TEST_EXCEPTION_PRODUCTION_AUTH-I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION}" \
    TEST_TARGET_VERSION="$target_version_to_test" \
    TEST_TARGET_SHA256="$target_hash_to_test" \
    TEST_EXPECT_INCLUDE_ALL=0 \
    TEST_DRY_RUN_OUTPUT_FILE_OVERRIDE= \
    TEST_DRY_RUN_OUTPUT_FILE="$tmp/exception-dry-run-$target_version_to_test" \
    run_guard >"$tmp/exception-rejection" 2>&1; then
    echo "invalid release #399 backup exception unexpectedly passed" >&2
    exit 1
  fi
  [[ "$(cat "$cli_apply_count")" == '0' ]]
}

TEST_EXCEPTION_RELEASE_SHA=unapproved-release expect_exception_rejected
TEST_EXCEPTION_TARGET_VERSION=20261022000100 expect_exception_rejected
TEST_EXCEPTION_BACKUP_SHA256=bad expect_exception_rejected
TEST_EXCEPTION_RESTORE_STATUS=PASS expect_exception_rejected
TEST_EXCEPTION_RESTORE_STATUS=NOT_RUN expect_exception_rejected
TEST_EXCEPTION_STORAGE_STATUS=PASS expect_exception_rejected
TEST_EXCEPTION_STORAGE_STATUS=NOT_RUN expect_exception_rejected
TEST_EXCEPTION_STORAGE_STATUS=FAIL expect_exception_rejected
TEST_EXCEPTION_OFFSITE_GATE=PASS expect_exception_rejected
TEST_EXCEPTION_RISK_ACCEPTANCE= expect_exception_rejected
TEST_EXCEPTION_PRODUCTION_AUTH= expect_exception_rejected
wrong_backup="$tmp/incorrect-windows-backup-fixture.tar.gz"
printf 'different backup bytes\n' > "$wrong_backup"
TEST_EXCEPTION_FILE="$wrong_backup" expect_exception_rejected
TEST_EXCEPTION_WINDOWS_PATH='C:\Users\samue\Backups\other.tar.gz' expect_exception_rejected
unset TEST_EXCEPTION_RELEASE_SHA TEST_EXCEPTION_BACKUP_SHA256 TEST_EXCEPTION_RESTORE_STATUS \
  TEST_EXCEPTION_STORAGE_STATUS \
  TEST_EXCEPTION_OFFSITE_GATE TEST_EXCEPTION_RISK_ACCEPTANCE TEST_EXCEPTION_PRODUCTION_AUTH \
  TEST_EXCEPTION_TARGET_VERSION TEST_EXCEPTION_FILE TEST_EXCEPTION_WINDOWS_PATH TEST_MOCK_BACKUP_FILE

# Release #406 is bound to its PR source lineage, exact VPS-local backup and the
# exact pre-migration ledger positions. The SQL and DB clients remain mocked.
release_406_backup_sha256=a9f5a433cd10970cf0a5e5752ea5f71115d27bc91706fdae32265f2b56084841
release_406_backup_path=/srv/grupotec/backups/edumoney/edumoney-2026-10-25T07-43-25Z.tar.gz
release_406_base=20261025000500
mapfile -t release_406_candidates < <(
  find "$repo_root/supabase/migrations" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' |
    cut -c1-14 | grep -E '^[0-9]{14}$' |
    awk -v base="$release_406_base" '$0 < base && $0 != "20261004000100" && $0 != "20261004000200" && $0 != "20261004000300"' |
    sort -u | head -n 240
)
[[ "${#release_406_candidates[@]}" -eq 240 ]]
release_406_ledger="$tmp/release-406-ledger"
printf '%s\n' "${release_406_candidates[@]}" "$release_406_base" | sort -u > "$release_406_ledger"
[[ "$(wc -l < "$release_406_ledger" | tr -d '[:space:]')" == '241' ]]
release_406_dry_run="$tmp/release-406-dry-run"
release_406_source="$tmp/release-406-source"
mkdir -p "$release_406_source/supabase/migrations"
printf 'project_id = "promote-406-test"\n' > "$release_406_source/supabase/config.toml"
printf 'gitdir: %s\n' "$(git -C "$repo_root" rev-parse --absolute-git-dir)" > "$release_406_source/.git"
while IFS= read -r version; do
  [[ -n "$version" ]] || continue
  printf 'select 1;\n' > "$release_406_source/supabase/migrations/${version}_test_fixture.sql"
done < "$release_406_ledger"
cp "$repo_root/supabase/migrations/20261025000600_central_estudos_v2_content_review.sql" \
  "$release_406_source/supabase/migrations/"
cp "$repo_root/supabase/migrations/20261025000700_central_estudos_v2_runtime_publication.sql" \
  "$release_406_source/supabase/migrations/"
release_406_after="$tmp/release-406-after-ledger"
release_406_version=20261025000600
release_406_file="$repo_root/supabase/migrations/${release_406_version}_central_estudos_v2_content_review.sql"
[[ -f "$release_406_file" ]]
release_406_hash="$(sed 's/\r$//' "$release_406_file" | "$real_sha256sum" | awk '{print $1}')"
[[ "$release_406_hash" == 'afc999f01040b1d633d8fe8185ea257729a212a2833d017bb6d27a71b6b473e3' ]]
printf 'Would push migration %s\n' "$release_406_version" > "$release_406_dry_run"
cat "$release_406_ledger" > "$release_406_after"
printf '%s\n' "$release_406_version" >> "$release_406_after"
printf '0\n' > "$cli_apply_count"
release_406_output="$(PATH="$tmp/bin:$PATH" \
  REAL_SHA256SUM="$real_sha256sum" \
  MOCK_406_BACKUP_SHA256="$release_406_backup_sha256" \
  MOCK_406_BACKUP_SIZE=372305133 \
  APPLY=1 BACKUP_GATE=FAIL \
  BACKUP_EXCEPTION_RELEASE_ID=406 \
  BACKUP_EXCEPTION_SOURCE_COMMIT="$source_commit" \
  BACKUP_EXCEPTION_BACKUP_HOST=tecescola-vps \
  BACKUP_EXCEPTION_BACKUP_SHA256="$release_406_backup_sha256" \
  BACKUP_EXCEPTION_BACKUP_FILE="$release_406_backup_path" \
  ACCEPT_INCOMPLETE_RECOVERY_RISK=I_ACCEPT_INCOMPLETE_RECOVERY_RISK_FOR_RELEASE_406 \
  CONFIRM_PRODUCTION_WRITE=I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION \
  TEST_TARGET_VERSION="$release_406_version" \
  TEST_SOURCE_ROOT="$release_406_source" \
  TEST_EXPECTED_REMOTE_LAST="$release_406_base" \
  TEST_TARGET_SHA256="$release_406_hash" \
  TEST_EXPECT_INCLUDE_ALL=0 \
  TEST_REMOTE_LEDGER_FILE="$release_406_ledger" \
  TEST_DRY_RUN_OUTPUT_FILE="$release_406_dry_run" \
  TEST_AFTER_LEDGER_CONTENT="$(cat "$release_406_after")" \
  run_guard)"
grep -q '^BACKUP_GATE=FAIL$' <<< "$release_406_output"
grep -q '^BACKUP_EXCEPTION=RELEASE_406_ACCEPTED$' <<< "$release_406_output"
grep -q '^BACKUP_EXCEPTION_RELEASE_ID=406$' <<< "$release_406_output"
grep -q "^BACKUP_EXCEPTION_SOURCE_COMMIT=$source_commit$" <<< "$release_406_output"
grep -q '^BACKUP_EXCEPTION_BACKUP_HOST=tecescola-vps$' <<< "$release_406_output"
grep -q '^BACKUP_EXCEPTION_BACKUP_PATH=/srv/grupotec/backups/edumoney/edumoney-2026-10-25T07-43-25Z.tar.gz$' <<< "$release_406_output"
grep -q "^BACKUP_EXCEPTION_BACKUP_SHA256=$release_406_backup_sha256$" <<< "$release_406_output"
grep -q '^BACKUP_EXCEPTION_BACKUP_SIZE_BYTES=372305133$' <<< "$release_406_output"
grep -q '^BACKUP_EXCEPTION_STORAGE_RECOVERY=PARTIAL$' <<< "$release_406_output"
grep -q '^BACKUP_EXCEPTION_OFFSITE_GATE=FAIL$' <<< "$release_406_output"
grep -q '^BACKUP_EXCEPTION_RISK_ACCEPTANCE=ACCEPTED$' <<< "$release_406_output"
grep -q '^PROMOTION=APPLIED$' <<< "$release_406_output"
grep -q '^REMOTE_AFTER_COUNT=242$' <<< "$release_406_output"
grep -q '^REMOTE_AFTER_LAST=20261025000600$' <<< "$release_406_output"
[[ "$(cat "$cli_apply_count")" == '1' ]]

# The second artifact is accepted only with 00600 already in the ledger.
release_406_second_base=20261025000600
release_406_second_version=20261025000700
release_406_second_file="$repo_root/supabase/migrations/${release_406_second_version}_central_estudos_v2_runtime_publication.sql"
[[ -f "$release_406_second_file" ]]
release_406_second_hash="$(sed 's/\r$//' "$release_406_second_file" | "$real_sha256sum" | awk '{print $1}')"
[[ "$release_406_second_hash" == '7651ba9d253cb14c10882b370cdf866e87c193594c25493385cbbfe4e90d0bcc' ]]
release_406_second_ledger="$tmp/release-406-second-ledger"
cat "$release_406_ledger" > "$release_406_second_ledger"
printf '%s\n' "$release_406_version" >> "$release_406_second_ledger"
release_406_second_dry_run="$tmp/release-406-second-dry-run"
release_406_second_after="$tmp/release-406-second-after-ledger"
printf 'Would push migration %s\n' "$release_406_second_version" > "$release_406_second_dry_run"
cat "$release_406_second_ledger" > "$release_406_second_after"
printf '%s\n' "$release_406_second_version" >> "$release_406_second_after"
printf '0\n' > "$cli_apply_count"
release_406_second_output="$(PATH="$tmp/bin:$PATH" \
  REAL_SHA256SUM="$real_sha256sum" \
  MOCK_406_BACKUP_SHA256="$release_406_backup_sha256" \
  MOCK_406_BACKUP_SIZE=372305133 \
  APPLY=1 BACKUP_GATE=FAIL \
  BACKUP_EXCEPTION_RELEASE_ID=406 \
  BACKUP_EXCEPTION_SOURCE_COMMIT="$source_commit" \
  BACKUP_EXCEPTION_BACKUP_HOST=tecescola-vps \
  BACKUP_EXCEPTION_BACKUP_SHA256="$release_406_backup_sha256" \
  BACKUP_EXCEPTION_BACKUP_FILE="$release_406_backup_path" \
  ACCEPT_INCOMPLETE_RECOVERY_RISK=I_ACCEPT_INCOMPLETE_RECOVERY_RISK_FOR_RELEASE_406 \
  CONFIRM_PRODUCTION_WRITE=I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION \
  TEST_TARGET_VERSION="$release_406_second_version" \
  TEST_SOURCE_ROOT="$release_406_source" \
  TEST_EXPECTED_REMOTE_LAST="$release_406_second_base" \
  TEST_TARGET_SHA256="$release_406_second_hash" \
  TEST_EXPECT_INCLUDE_ALL=0 \
  TEST_REMOTE_LEDGER_FILE="$release_406_second_ledger" \
  TEST_DRY_RUN_OUTPUT_FILE="$release_406_second_dry_run" \
  TEST_AFTER_LEDGER_CONTENT="$(cat "$release_406_second_after")" \
  run_guard)"
grep -q '^BACKUP_GATE=FAIL$' <<< "$release_406_second_output"
grep -q '^BACKUP_EXCEPTION=RELEASE_406_ACCEPTED$' <<< "$release_406_second_output"
grep -q '^PROMOTION=APPLIED$' <<< "$release_406_second_output"
grep -q '^REMOTE_AFTER_COUNT=243$' <<< "$release_406_second_output"
grep -q '^REMOTE_AFTER_LAST=20261025000700$' <<< "$release_406_second_output"
[[ "$(cat "$cli_apply_count")" == '1' ]]

expect_release_406_rejected() {
  printf '0\n' > "$cli_apply_count"
  if PATH="$tmp/bin:$PATH" \
    REAL_SHA256SUM="$real_sha256sum" \
    MOCK_406_BACKUP_SHA256="${TEST_406_SSH_SHA-$release_406_backup_sha256}" \
    MOCK_406_BACKUP_SIZE="${TEST_406_SSH_SIZE-372305133}" \
    APPLY=1 BACKUP_GATE=FAIL \
    BACKUP_EXCEPTION_RELEASE_ID="${TEST_406_RELEASE_ID-406}" \
    BACKUP_EXCEPTION_SOURCE_COMMIT="${TEST_406_SOURCE_COMMIT-$source_commit}" \
    BACKUP_EXCEPTION_BACKUP_HOST="${TEST_406_HOST-tecescola-vps}" \
    BACKUP_EXCEPTION_BACKUP_SHA256="${TEST_406_BACKUP_SHA256-$release_406_backup_sha256}" \
    BACKUP_EXCEPTION_BACKUP_FILE="${TEST_406_BACKUP_PATH-$release_406_backup_path}" \
    ACCEPT_INCOMPLETE_RECOVERY_RISK="${TEST_406_RISK-I_ACCEPT_INCOMPLETE_RECOVERY_RISK_FOR_RELEASE_406}" \
    CONFIRM_PRODUCTION_WRITE=I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION \
    TEST_TARGET_VERSION="$release_406_version" \
    TEST_SOURCE_ROOT="$release_406_source" \
    TEST_EXPECTED_REMOTE_LAST="$release_406_base" \
    TEST_TARGET_SHA256="$release_406_hash" \
    TEST_EXPECT_INCLUDE_ALL=0 \
    TEST_REMOTE_LEDGER_FILE="${TEST_406_LEDGER-$release_406_ledger}" \
    TEST_DRY_RUN_OUTPUT_FILE="$release_406_dry_run" \
    TEST_AFTER_LEDGER_CONTENT="$(cat "$release_406_after")" \
    run_guard >"$tmp/release-406-rejection" 2>&1; then
    echo 'invalid release #406 exception unexpectedly passed' >&2
    exit 1
  fi
  [[ "$(cat "$cli_apply_count")" == '0' ]]
}

TEST_406_RELEASE_ID=405 expect_release_406_rejected
TEST_406_SOURCE_COMMIT=0000000000000000000000000000000000000000 expect_release_406_rejected
TEST_406_HOST=untrusted-host expect_release_406_rejected
TEST_406_BACKUP_PATH=/tmp/other.tar.gz expect_release_406_rejected
TEST_406_RISK= expect_release_406_rejected
TEST_406_BACKUP_SHA256=bad expect_release_406_rejected
TEST_406_SSH_SHA=bad expect_release_406_rejected
TEST_406_SSH_SIZE=1 expect_release_406_rejected
short_release_406_ledger="$tmp/release-406-short-ledger"
head -n 239 "$release_406_ledger" > "$short_release_406_ledger"
printf '%s\n' "$release_406_base" >> "$short_release_406_ledger"
TEST_406_LEDGER="$short_release_406_ledger" expect_release_406_rejected
unset TEST_406_RELEASE_ID TEST_406_SOURCE_COMMIT TEST_406_RISK TEST_406_BACKUP_SHA256 \
  TEST_406_SSH_SHA TEST_406_SSH_SIZE TEST_406_HOST TEST_406_BACKUP_PATH TEST_406_LEDGER

if cli_failure="$(PATH="$tmp/bin:$PATH" MOCK_CLI_FAILURE=1 DRY_RUN_OUTPUT_FILE_OVERRIDE= run_guard 2>&1)"; then
  echo "mock CLI authentication failure unexpectedly passed" >&2
  exit 1
fi
grep -q '^PROMOTION_ABORTED=supabase dry-run failed: database_authentication$' <<< "$cli_failure"
if [[ "$cli_failure" == *dummy* || "$cli_failure" == *fixture_user* ]]; then
  echo "connection credentials leaked from CLI failure output" >&2
  exit 1
fi
[[ -z "$(find "$tmp/guard-tmp" -mindepth 1 -print -quit)" ]] || {
  echo "temporary promotion credentials were not cleaned after CLI failure" >&2
  exit 1
}

echo 'PROMOTE_SINGLE_MIGRATION_TEST=PASS'
