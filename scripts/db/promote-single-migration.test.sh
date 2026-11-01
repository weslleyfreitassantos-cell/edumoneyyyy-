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
test_python="$(command -v python || command -v python3)"
"$test_python" "$repo_root/ops/backup/verify-local-recovery-proof.test.py"
"$test_python" "$repo_root/ops/backup/verify-local-storage-recovery-proof.test.py"

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
  SOURCE_ROOT="$repo_root" \
  TARGET_VERSION="${TEST_TARGET_VERSION:-$target_version}" \
  EXPECTED_REMOTE_LAST="${EXPECTED_REMOTE_LAST_OVERRIDE:-$expected_last}" \
  EXPECTED_SOURCE_COMMIT="$source_commit" \
  EXPECTED_TARGET_SHA256="${TEST_TARGET_SHA256:-${EXPECTED_TARGET_SHA256_OVERRIDE:-$target_hash}}" \
  PRODUCTION_DB_URL="${PRODUCTION_DB_URL_OVERRIDE:-postgresql://fixture_user:dummy%21secret@fixture.invalid:5432/postgres?sslmode=require}" \
  TMPDIR="$tmp/guard-tmp" \
  REAL_SHA256SUM="${real_sha256sum:-}" \
  REMOTE_LEDGER_FILE="${TEST_REMOTE_LEDGER_FILE:-$ledger}" \
  PYTHON3_BIN="${PROMOTION_TEST_PYTHON3_BIN:-python3}" \
  BACKUP_GATE="${TEST_BACKUP_GATE:-${BACKUP_GATE:-PASS}}" \
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
  printf '%s  %s\n' 'b8818e0b97a2152d60b1405f90d089a1ab4b43ba87d2739f234afb038b28d5c0' "$1"
else
  "$REAL_SHA256SUM" "$@"
fi
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
chmod +x "$tmp/bin/sha256sum" "$tmp/bin/npx" "$tmp/bin/psql"
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
  BACKUP_EXCEPTION_PR=399 \
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
grep -q '^BACKUP_EXCEPTION=RELEASE_399_ACCEPTED$' <<< "$exception_output"
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
    BACKUP_EXCEPTION_PR=399 \
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

# PR #409 local-only proof: validate a recent, intact disposable bundle and a
# matching successful restore receipt during dry-run. No production write token.
local_backup="$tmp/psychology-local-backup-fixture.tar.gz"
local_receipt="$tmp/psychology-local-restore.receipt"
"$test_python" - "$local_backup" "$local_receipt" <<'PY'
import datetime, hashlib, io, sys, tarfile
from pathlib import Path

def make_tar(entries):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w:gz") as archive:
        for name, content in entries.items():
            info = tarfile.TarInfo(name)
            info.size = len(content)
            archive.addfile(info, io.BytesIO(content))
    return output.getvalue()

now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0)
storage = make_tar({"bucket/sample.bin": b"sample"})
components = {
    "globals.sql": b"-- fixture\n",
    "postgres.dump": b"database fixture",
    "supabase-meta.dump": b"metadata fixture",
    "storage.tar.gz": storage,
    "config.tar.gz": b"encrypted config fixture",
}
checksums = "".join(f"{hashlib.sha256(body).hexdigest()}  {name}\n" for name, body in components.items())
created = now.isoformat().replace("+00:00", "Z")
bundle = make_tar({**components, "MANIFEST.txt": f"created_utc={created}\n".encode(), "SHA256SUMS": checksums.encode()})
Path(sys.argv[1]).write_bytes(bundle)
receipt = [
    "format=tec-school-local-restore-proof-v1",
    "status=PASS",
    f"backup_sha256={hashlib.sha256(bundle).hexdigest()}",
    f"backup_bytes={len(bundle)}",
    f"verified_at_utc={created}",
    "restore_mode=isolated-postgres",
    "database_cleanup=dropped",
]
Path(sys.argv[2]).write_text("\n".join(receipt) + "\n", encoding="utf-8")
PY

psychology_version=20261026000100
psychology_file="$repo_root/supabase/migrations/${psychology_version}_psychology_institution_gate.sql"
[[ -f "$psychology_file" ]]
psychology_hash="$(sed 's/\r$//' "$psychology_file" | "$real_sha256sum" | awk '{print $1}')"
local_backup_sha="$("$real_sha256sum" "$local_backup" | awk '{print $1}')"
real_git="$(command -v git)"
export PROMOTION_TEST_REAL_GIT="$real_git"
cat > "$tmp/bin/git" <<'SH'
#!/usr/bin/env bash
if [[ "$#" -eq 4 && "$1" == '-C' && "$2" == "${PROMOTION_TEST_REPO_ROOT:-}" && \
  "$3" == 'branch' && "$4" == '--show-current' ]]; then
  printf '%s\n' "${PROMOTION_TEST_BRANCH:-codex/psychology-gate-ux}"
  exit 0
fi
if [[ "$#" -eq 5 && "$1" == '-C' && "$2" == "${PROMOTION_TEST_REPO_ROOT:-}" && \
  "$3" == 'remote' && "$4" == 'get-url' && "$5" == 'origin' ]]; then
  printf '%s\n' "${PROMOTION_TEST_ORIGIN:-https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git}"
  exit 0
fi
exec "${PROMOTION_TEST_REAL_GIT:?}" "$@"
SH
chmod +x "$tmp/bin/git"
local_storage_receipt="$tmp/local-storage-restore.receipt"
"$test_python" - "$local_backup" "$local_storage_receipt" <<'PY'
import datetime, hashlib, sys
from pathlib import Path
backup = Path(sys.argv[1])
receipt = Path(sys.argv[2])
now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
values = {
    "format": "tec-school-local-storage-restore-proof-v1",
    "status": "PASS",
    "backup_sha256": hashlib.sha256(backup.read_bytes()).hexdigest(),
    "backup_bytes": str(backup.stat().st_size),
    "restore_mode": "isolated-storage-copy",
    "storage_objects": "12249",
    "storage_bytes": "352379320",
    "copy_integrity": "PASS",
    "temporary_copy_cleanup": "COMPLETED",
    "production_storage_status": "PARTIAL",
    "offsite_status": "FAIL",
    "evidence_source": "synthetic-test-fixture",
    "recorded_at_utc": now,
}
receipt.write_text("".join(f"{key}={value}\n" for key, value in values.items()), encoding="utf-8")
PY
local_ledger="$tmp/pr409-local-ledger"
local_dry_run="$tmp/pr409-local-dry-run"
printf '20261025000600\n' > "$local_ledger"
printf 'Would push migration %s\n' "$psychology_version" > "$local_dry_run"
local_output="$(PATH="$tmp/bin:$PATH" \
  PROMOTION_TEST_REAL_GIT="$real_git" PROMOTION_TEST_REPO_ROOT="$repo_root" \
  PROMOTION_TEST_PYTHON3_BIN="$test_python" \
  TEST_BACKUP_GATE=FAIL \
  BACKUP_EXCEPTION_PR=409 \
  BACKUP_EXCEPTION_BACKUP_FILE="$local_backup" \
  BACKUP_EXCEPTION_RESTORE_RECEIPT_FILE="$local_receipt" \
  BACKUP_EXCEPTION_BACKUP_SHA256="$local_backup_sha" \
  BACKUP_EXCEPTION_OFFSITE_STATUS=FAIL \
  EXPECTED_REMOTE_LAST_OVERRIDE=20261025000600 \
  TEST_REMOTE_LEDGER_FILE="$local_ledger" \
  TEST_TARGET_VERSION="$psychology_version" \
  TEST_TARGET_SHA256="$psychology_hash" \
  TEST_EXPECT_INCLUDE_ALL=0 \
  TEST_DRY_RUN_OUTPUT_FILE="$local_dry_run" \
  run_guard)"
grep -Fxq 'BACKUP_GATE=FAIL' <<< "$local_output"
grep -Fxq 'BACKUP_EXCEPTION=PR409_LOCAL_ONLY' <<< "$local_output"
grep -Fxq 'BACKUP_EXCEPTION_PR=409' <<< "$local_output"
grep -Fxq 'BACKUP_EXCEPTION_SCOPE=20261026000100' <<< "$local_output"
grep -Fxq "BACKUP_EXCEPTION_LOCAL_SHA256=$local_backup_sha" <<< "$local_output"
grep -Fxq 'BACKUP_EXCEPTION_RESTORE=PASS' <<< "$local_output"
grep -Fxq 'BACKUP_EXCEPTION_OFFSITE=FAIL' <<< "$local_output"
grep -Fxq 'BACKUP_EXCEPTION_OFFSITE_COPY=NONE' <<< "$local_output"
grep -Fxq 'BACKUP_EXCEPTION_RECOVERY_RISK=LOCAL_ONLY_NO_OFFSITE_COPY' <<< "$local_output"
grep -Fxq 'PROMOTION=DRY_RUN_ONLY' <<< "$local_output"
grep -Fxq 'PRODUCTION_WRITE_AUTHORIZATION=PENDING' <<< "$local_output"
! grep -q '20261025000700' <<< "$local_output"
[[ "$(cat "$cli_apply_count")" == '0' ]]

printf 'Would push migration %s\nWould push migration 20261025000700\n' "$psychology_version" > "$tmp/pr409-with-007"
if PATH="$tmp/bin:$PATH" PROMOTION_TEST_REAL_GIT="$real_git" PROMOTION_TEST_REPO_ROOT="$repo_root" \
  PROMOTION_TEST_PYTHON3_BIN="$test_python" \
  TEST_BACKUP_GATE=FAIL BACKUP_EXCEPTION_PR=409 \
  BACKUP_EXCEPTION_BACKUP_FILE="$local_backup" \
  BACKUP_EXCEPTION_RESTORE_RECEIPT_FILE="$local_receipt" \
  BACKUP_EXCEPTION_BACKUP_SHA256="$local_backup_sha" BACKUP_EXCEPTION_OFFSITE_STATUS=FAIL \
  EXPECTED_REMOTE_LAST_OVERRIDE=20261025000600 TEST_REMOTE_LEDGER_FILE="$local_ledger" \
  TEST_TARGET_VERSION="$psychology_version" TEST_TARGET_SHA256="$psychology_hash" \
  TEST_EXPECT_INCLUDE_ALL=0 TEST_DRY_RUN_OUTPUT_FILE="$tmp/pr409-with-007" run_guard >/dev/null 2>&1; then
  echo 'precheck unexpectedly allowed the extra migration 20261025000700' >&2
  exit 1
fi

if PATH="$tmp/bin:$PATH" PROMOTION_TEST_REAL_GIT="$real_git" PROMOTION_TEST_REPO_ROOT="$repo_root" \
  PROMOTION_TEST_PYTHON3_BIN="$test_python" \
  TEST_BACKUP_GATE=FAIL BACKUP_EXCEPTION_PR=409 \
  BACKUP_EXCEPTION_BACKUP_FILE="$local_backup" \
  BACKUP_EXCEPTION_RESTORE_RECEIPT_FILE="$local_receipt" \
  BACKUP_EXCEPTION_BACKUP_SHA256="$local_backup_sha" BACKUP_EXCEPTION_OFFSITE_STATUS=PASS \
  EXPECTED_REMOTE_LAST_OVERRIDE=20261025000600 TEST_REMOTE_LEDGER_FILE="$local_ledger" \
  TEST_TARGET_VERSION="$psychology_version" TEST_TARGET_SHA256="$psychology_hash" \
  TEST_EXPECT_INCLUDE_ALL=0 TEST_DRY_RUN_OUTPUT_FILE="$local_dry_run" run_guard >/dev/null 2>&1; then
  echo 'PR #409 exception unexpectedly accepted offsite PASS' >&2
  exit 1
fi

if PATH="$tmp/bin:$PATH" PROMOTION_TEST_REAL_GIT="$real_git" PROMOTION_TEST_REPO_ROOT="$repo_root" \
  PROMOTION_TEST_PYTHON3_BIN="$test_python" \
  TEST_BACKUP_GATE=FAIL BACKUP_EXCEPTION_PR=409 \
  BACKUP_EXCEPTION_BACKUP_FILE="$local_backup" \
  BACKUP_EXCEPTION_RESTORE_RECEIPT_FILE="$local_receipt" \
  BACKUP_EXCEPTION_BACKUP_SHA256="$local_backup_sha" BACKUP_EXCEPTION_OFFSITE_STATUS=FAIL \
  EXPECTED_REMOTE_LAST_OVERRIDE=20261025000600 TEST_REMOTE_LEDGER_FILE="$local_ledger" \
  TEST_TARGET_VERSION="$psychology_version" TEST_TARGET_SHA256="$psychology_hash" \
  TEST_EXPECT_INCLUDE_ALL=0 TEST_DRY_RUN_OUTPUT_FILE="$local_dry_run" \
  APPLY=1 CONFIRM_PRODUCTION_WRITE= ACCEPT_NO_OFFSITE_COPY= run_guard >/dev/null 2>&1; then
  echo 'PR #409 local-only exception unexpectedly wrote without specific authorization' >&2
  exit 1
fi
[[ "$(cat "$cli_apply_count")" == '0' ]]
echo 'PROMOTE_SINGLE_MIGRATION_PR409_LOCAL_ONLY=PASS'

# PR #411 has a separate local-only exception, pinned to its branch, repository,
# parent ledger, one migration hash, fresh isolated-restore receipt and explicit
# risk/write acknowledgements. The synthetic bundle above is test-only.
psychology_411_version=20261026000200
psychology_411_file="$repo_root/supabase/migrations/${psychology_411_version}_psychology_professional_school_staff_gate.sql"
[[ -f "$psychology_411_file" ]]
psychology_411_hash="$(sed 's/\r$//' "$psychology_411_file" | "$real_sha256sum" | awk '{print $1}')"
[[ "$psychology_411_hash" == 'da7db8e6ef8d635068ff34a3a1f2ccd4f0c5a4ce6b8a8d753203dc885aa075aa' ]]
local_ledger_411="$tmp/pr411-local-ledger"
local_dry_run_411="$tmp/pr411-local-dry-run"
printf '20261026000100\n' > "$local_ledger_411"
printf 'Would push migration %s\n' "$psychology_411_version" > "$local_dry_run_411"
printf '0\n' > "$cli_apply_count"
local_output_411="$(PATH="$tmp/bin:$PATH" \
  PROMOTION_TEST_REAL_GIT="$real_git" PROMOTION_TEST_REPO_ROOT="$repo_root" \
  PROMOTION_TEST_BRANCH=codex/psychology-school-staff-access \
  PROMOTION_TEST_PYTHON3_BIN="$test_python" \
  TEST_BACKUP_GATE=FAIL \
  BACKUP_EXCEPTION_PR=411 \
  BACKUP_EXCEPTION_BACKUP_FILE="$local_backup" \
  BACKUP_EXCEPTION_RESTORE_RECEIPT_FILE="$local_receipt" \
  BACKUP_EXCEPTION_BACKUP_SHA256="$local_backup_sha" \
  BACKUP_EXCEPTION_OFFSITE_STATUS=FAIL \
  BACKUP_EXCEPTION_STORAGE_STATUS=PARTIAL \
  ACCEPT_INCOMPLETE_RECOVERY_RISK=I_ACCEPT_LOCAL_ONLY_RECOVERY_RISK_FOR_PR_411 \
  EXPECTED_REMOTE_LAST_OVERRIDE=20261026000100 \
  TEST_REMOTE_LEDGER_FILE="$local_ledger_411" \
  TEST_TARGET_VERSION="$psychology_411_version" \
  TEST_TARGET_SHA256="$psychology_411_hash" \
  TEST_EXPECT_INCLUDE_ALL=0 \
  TEST_DRY_RUN_OUTPUT_FILE="$local_dry_run_411" \
  run_guard)"
grep -Fxq 'BACKUP_GATE=FAIL' <<< "$local_output_411"
grep -Fxq 'BACKUP_EXCEPTION=PR411_LOCAL_ONLY' <<< "$local_output_411"
grep -Fxq 'BACKUP_EXCEPTION_PR=411' <<< "$local_output_411"
grep -Fxq 'BACKUP_EXCEPTION_SCOPE=20261026000200' <<< "$local_output_411"
grep -Fxq "BACKUP_EXCEPTION_LOCAL_SHA256=$local_backup_sha" <<< "$local_output_411"
grep -Fxq 'BACKUP_EXCEPTION_RESTORE=PASS' <<< "$local_output_411"
grep -Fxq 'BACKUP_EXCEPTION_STORAGE=PARTIAL' <<< "$local_output_411"
grep -Fxq 'BACKUP_EXCEPTION_OFFSITE=FAIL' <<< "$local_output_411"
grep -Fxq 'BACKUP_EXCEPTION_OFFSITE_COPY=NONE' <<< "$local_output_411"
grep -Fxq 'BACKUP_EXCEPTION_RISK_ACCEPTANCE=ACCEPTED' <<< "$local_output_411"
grep -Fxq 'DRY_RUN_PENDING_COUNT=1' <<< "$local_output_411"
grep -Fxq 'DRY_RUN_PENDING_VERSION=20261026000200' <<< "$local_output_411"
grep -Fxq 'PRODUCTION_WRITE_AUTHORIZATION=PENDING' <<< "$local_output_411"
! grep -q '20261025000700' <<< "$local_output_411"
[[ "$(cat "$cli_apply_count")" == '0' ]]

expect_pr411_rejected() {
  local branch="${TEST_PR411_BRANCH-codex/psychology-school-staff-access}"
  local pr="${TEST_PR411_PR-411}"
  local target="${TEST_PR411_TARGET-$psychology_411_version}"
  local expected_last_411="${TEST_PR411_REMOTE_LAST-20261026000100}"
  local target_hash_411="${TEST_PR411_HASH-$psychology_411_hash}"
  local offsite="${TEST_PR411_OFFSITE-FAIL}"
  local storage="${TEST_PR411_STORAGE-PARTIAL}"
  local risk="${TEST_PR411_RISK-I_ACCEPT_LOCAL_ONLY_RECOVERY_RISK_FOR_PR_411}"
  local receipt="${TEST_PR411_RECEIPT-$local_receipt}"
  local dry_run_411="$tmp/pr411-rejected-$RANDOM"
  printf 'Would push migration %s\n' "$psychology_411_version" > "$dry_run_411"
  printf '0\n' > "$cli_apply_count"
  if PATH="$tmp/bin:$PATH" \
    PROMOTION_TEST_REAL_GIT="$real_git" PROMOTION_TEST_REPO_ROOT="$repo_root" \
    PROMOTION_TEST_BRANCH="$branch" PROMOTION_TEST_PYTHON3_BIN="$test_python" \
    TEST_BACKUP_GATE=FAIL BACKUP_EXCEPTION_PR="$pr" \
    BACKUP_EXCEPTION_BACKUP_FILE="$local_backup" \
    BACKUP_EXCEPTION_RESTORE_RECEIPT_FILE="$receipt" \
    BACKUP_EXCEPTION_BACKUP_SHA256="$local_backup_sha" \
    BACKUP_EXCEPTION_OFFSITE_STATUS="$offsite" BACKUP_EXCEPTION_STORAGE_STATUS="$storage" \
    ACCEPT_INCOMPLETE_RECOVERY_RISK="$risk" \
    EXPECTED_REMOTE_LAST_OVERRIDE="$expected_last_411" \
    TEST_REMOTE_LEDGER_FILE="$local_ledger_411" \
    TEST_TARGET_VERSION="$target" TEST_TARGET_SHA256="$target_hash_411" \
    TEST_EXPECT_INCLUDE_ALL=0 TEST_DRY_RUN_OUTPUT_FILE="$dry_run_411" run_guard \
    >"$tmp/pr411-rejection" 2>&1; then
    echo 'invalid PR #411 local-only exception unexpectedly passed' >&2
    exit 1
  fi
  [[ "$(cat "$cli_apply_count")" == '0' ]]
}

TEST_PR411_BRANCH=codex/another-branch expect_pr411_rejected
TEST_PR411_PR=409 expect_pr411_rejected
TEST_PR411_TARGET=20261025000700 expect_pr411_rejected
TEST_PR411_REMOTE_LAST=20261025000600 expect_pr411_rejected
TEST_PR411_HASH=bad expect_pr411_rejected
TEST_PR411_OFFSITE=PASS expect_pr411_rejected
TEST_PR411_STORAGE=FAIL expect_pr411_rejected
TEST_PR411_RISK= expect_pr411_rejected
TEST_PR411_RECEIPT="$tmp/missing-pr411-restore-proof" expect_pr411_rejected
unset TEST_PR411_BRANCH TEST_PR411_PR TEST_PR411_TARGET TEST_PR411_REMOTE_LAST TEST_PR411_HASH \
  TEST_PR411_OFFSITE TEST_PR411_STORAGE TEST_PR411_RISK TEST_PR411_RECEIPT

printf '0\n' > "$cli_apply_count"
applied_411="$(PATH="$tmp/bin:$PATH" \
  PROMOTION_TEST_REAL_GIT="$real_git" PROMOTION_TEST_REPO_ROOT="$repo_root" \
  PROMOTION_TEST_BRANCH=codex/psychology-school-staff-access \
  PROMOTION_TEST_PYTHON3_BIN="$test_python" \
  APPLY=1 TEST_BACKUP_GATE=FAIL BACKUP_EXCEPTION_PR=411 \
  BACKUP_EXCEPTION_BACKUP_FILE="$local_backup" \
  BACKUP_EXCEPTION_RESTORE_RECEIPT_FILE="$local_receipt" \
  BACKUP_EXCEPTION_BACKUP_SHA256="$local_backup_sha" \
  BACKUP_EXCEPTION_OFFSITE_STATUS=FAIL BACKUP_EXCEPTION_STORAGE_STATUS=PARTIAL \
  ACCEPT_INCOMPLETE_RECOVERY_RISK=I_ACCEPT_LOCAL_ONLY_RECOVERY_RISK_FOR_PR_411 \
  ACCEPT_NO_OFFSITE_COPY=I_ACCEPT_NO_OFFSITE_COPY_FOR_PR_411 \
  CONFIRM_PRODUCTION_WRITE=I_CONFIRM_PR411_SINGLE_MIGRATION_20261026000200 \
  EXPECTED_REMOTE_LAST_OVERRIDE=20261026000100 \
  TEST_REMOTE_LEDGER_FILE="$local_ledger_411" \
  TEST_TARGET_VERSION="$psychology_411_version" TEST_TARGET_SHA256="$psychology_411_hash" \
  TEST_EXPECT_INCLUDE_ALL=0 TEST_DRY_RUN_OUTPUT_FILE="$local_dry_run_411" \
  TEST_AFTER_LEDGER_CONTENT="20261026000100
20261026000200" run_guard)"
grep -Fxq 'BACKUP_GATE=FAIL' <<< "$applied_411"
grep -Fxq 'BACKUP_EXCEPTION=PR411_LOCAL_ONLY' <<< "$applied_411"
grep -Fxq 'PRODUCTION_WRITE_AUTHORIZATION=APPROVED' <<< "$applied_411"
grep -Fxq 'PROMOTION=APPLIED' <<< "$applied_411"
grep -Fxq 'REMOTE_AFTER_COUNT=2' <<< "$applied_411"
grep -Fxq 'REMOTE_AFTER_LAST=20261026000200' <<< "$applied_411"
[[ "$(cat "$cli_apply_count")" == '1' ]]

printf '0\n' > "$cli_apply_count"
if PATH="$tmp/bin:$PATH" \
  PROMOTION_TEST_REAL_GIT="$real_git" PROMOTION_TEST_REPO_ROOT="$repo_root" \
  PROMOTION_TEST_BRANCH=codex/psychology-school-staff-access \
  PROMOTION_TEST_PYTHON3_BIN="$test_python" \
  APPLY=1 TEST_BACKUP_GATE=FAIL BACKUP_EXCEPTION_PR=411 \
  BACKUP_EXCEPTION_BACKUP_FILE="$local_backup" \
  BACKUP_EXCEPTION_RESTORE_RECEIPT_FILE="$local_receipt" \
  BACKUP_EXCEPTION_BACKUP_SHA256="$local_backup_sha" \
  BACKUP_EXCEPTION_OFFSITE_STATUS=FAIL BACKUP_EXCEPTION_STORAGE_STATUS=PARTIAL \
  ACCEPT_INCOMPLETE_RECOVERY_RISK=I_ACCEPT_LOCAL_ONLY_RECOVERY_RISK_FOR_PR_411 \
  CONFIRM_PRODUCTION_WRITE=I_CONFIRM_PR411_SINGLE_MIGRATION_20261026000200 \
  EXPECTED_REMOTE_LAST_OVERRIDE=20261026000100 TEST_REMOTE_LEDGER_FILE="$local_ledger_411" \
  TEST_TARGET_VERSION="$psychology_411_version" TEST_TARGET_SHA256="$psychology_411_hash" \
  TEST_EXPECT_INCLUDE_ALL=0 TEST_DRY_RUN_OUTPUT_FILE="$local_dry_run_411" run_guard \
  >/dev/null 2>&1; then
  echo 'PR #411 local-only exception unexpectedly wrote without the offsite-risk acknowledgement' >&2
  exit 1
fi
[[ "$(cat "$cli_apply_count")" == '0' ]]
echo 'PROMOTE_SINGLE_MIGRATION_PR411_LOCAL_ONLY=PASS'

# PR #412 is restricted to Tec Inglês V2 migration 003 after migration 002.
# These backup and restore artifacts are synthetic; this only exercises the
# local-only gate and never represents real operational risk acceptance.
tec_english_412_version=20261026000300
tec_english_412_file="$repo_root/supabase/migrations/${tec_english_412_version}_tec_english_adaptive_v2.sql"
[[ -f "$tec_english_412_file" ]]
tec_english_412_hash="$(sed 's/\r$//' "$tec_english_412_file" | "$real_sha256sum" | awk '{print $1}')"
[[ "$tec_english_412_hash" == '6819fc02ecb0897b93b845dcfb2475da75193ff90f06f3de7d373cdd76f3063e' ]]
local_ledger_412="$tmp/pr412-local-ledger"
local_dry_run_412="$tmp/pr412-local-dry-run"
printf '20261026000200\n' > "$local_ledger_412"
printf 'Would push migration %s\n' "$tec_english_412_version" > "$local_dry_run_412"
printf '0\n' > "$cli_apply_count"
local_output_412="$(PATH="$tmp/bin:$PATH" \
  PROMOTION_TEST_REAL_GIT="$real_git" PROMOTION_TEST_REPO_ROOT="$repo_root" \
  PROMOTION_TEST_BRANCH=codex/tec-english-v2-adaptive \
  PROMOTION_TEST_PYTHON3_BIN="$test_python" \
  TEST_BACKUP_GATE=FAIL BACKUP_EXCEPTION_PR=412 \
  BACKUP_EXCEPTION_BACKUP_FILE="$local_backup" \
  BACKUP_EXCEPTION_RESTORE_RECEIPT_FILE="$local_receipt" \
  BACKUP_EXCEPTION_BACKUP_SHA256="$local_backup_sha" \
  BACKUP_EXCEPTION_OFFSITE_STATUS=FAIL BACKUP_EXCEPTION_STORAGE_STATUS=PARTIAL \
  ACCEPT_INCOMPLETE_RECOVERY_RISK=I_ACCEPT_LOCAL_ONLY_RECOVERY_RISK_FOR_PR_412 \
  EXPECTED_REMOTE_LAST_OVERRIDE=20261026000200 TEST_REMOTE_LEDGER_FILE="$local_ledger_412" \
  TEST_TARGET_VERSION="$tec_english_412_version" TEST_TARGET_SHA256="$tec_english_412_hash" \
  TEST_EXPECT_INCLUDE_ALL=0 TEST_DRY_RUN_OUTPUT_FILE="$local_dry_run_412" \
  run_guard)"
grep -Fxq 'BACKUP_GATE=FAIL' <<< "$local_output_412"
grep -Fxq 'BACKUP_EXCEPTION=PR412_LOCAL_ONLY' <<< "$local_output_412"
grep -Fxq 'BACKUP_EXCEPTION_PR=412' <<< "$local_output_412"
grep -Fxq 'BACKUP_EXCEPTION_SCOPE=20261026000300' <<< "$local_output_412"
grep -Fxq 'BACKUP_EXCEPTION_PREDECESSOR=20261026000200' <<< "$local_output_412"
grep -Fxq "BACKUP_EXCEPTION_LOCAL_SHA256=$local_backup_sha" <<< "$local_output_412"
grep -Fxq 'BACKUP_EXCEPTION_RESTORE=PASS' <<< "$local_output_412"
grep -Fxq 'BACKUP_EXCEPTION_STORAGE=PARTIAL' <<< "$local_output_412"
grep -Fxq 'BACKUP_EXCEPTION_OFFSITE=FAIL' <<< "$local_output_412"
grep -Fxq 'BACKUP_EXCEPTION_OFFSITE_COPY=NONE' <<< "$local_output_412"
grep -Fxq 'BACKUP_EXCEPTION_RECOVERY_RISK=LOCAL_ONLY_NO_OFFSITE_COPY_STORAGE_PARTIAL' <<< "$local_output_412"
grep -Fxq 'BACKUP_EXCEPTION_RISK_ACCEPTANCE=ACCEPTED' <<< "$local_output_412"
grep -Fxq 'DRY_RUN_PENDING_COUNT=1' <<< "$local_output_412"
grep -Fxq 'DRY_RUN_PENDING_VERSION=20261026000300' <<< "$local_output_412"
grep -Fxq 'PRODUCTION_WRITE_AUTHORIZATION=PENDING' <<< "$local_output_412"
! grep -q '20261026000100\|20261026000700' <<< "$local_output_412"
[[ "$(cat "$cli_apply_count")" == '0' ]]

expect_pr412_rejected() {
  local target="${TEST_PR412_TARGET-$tec_english_412_version}"
  local parent="${TEST_PR412_PARENT-20261026000200}"
  local branch="${TEST_PR412_BRANCH-codex/tec-english-v2-adaptive}"
  local origin="${TEST_PR412_ORIGIN-https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git}"
  local backup="${TEST_PR412_BACKUP-$local_backup}"
  local receipt="${TEST_PR412_RECEIPT-$local_receipt}"
  local target_file target_hash dry_run="$tmp/pr412-rejected-$RANDOM"
  target_file="$(find "$repo_root/supabase/migrations" -maxdepth 1 -type f -name "${target}_*.sql" -print -quit)"
  [[ -n "$target_file" ]]
  target_hash="$(sed 's/\r$//' "$target_file" | "$real_sha256sum" | awk '{print $1}')"
  printf 'Would push migration %s\n' "$tec_english_412_version" > "$dry_run"
  printf '0\n' > "$cli_apply_count"
  if PATH="$tmp/bin:$PATH" \
    PROMOTION_TEST_REAL_GIT="$real_git" PROMOTION_TEST_REPO_ROOT="$repo_root" \
    PROMOTION_TEST_BRANCH="$branch" PROMOTION_TEST_ORIGIN="$origin" \
    PROMOTION_TEST_PYTHON3_BIN="$test_python" \
    TEST_BACKUP_GATE=FAIL BACKUP_EXCEPTION_PR=412 \
    BACKUP_EXCEPTION_BACKUP_FILE="$backup" BACKUP_EXCEPTION_RESTORE_RECEIPT_FILE="$receipt" \
    BACKUP_EXCEPTION_BACKUP_SHA256="$local_backup_sha" \
    BACKUP_EXCEPTION_OFFSITE_STATUS="${TEST_PR412_OFFSITE-FAIL}" \
    BACKUP_EXCEPTION_STORAGE_STATUS="${TEST_PR412_STORAGE-PARTIAL}" \
    ACCEPT_INCOMPLETE_RECOVERY_RISK="${TEST_PR412_RISK-I_ACCEPT_LOCAL_ONLY_RECOVERY_RISK_FOR_PR_412}" \
    EXPECTED_REMOTE_LAST_OVERRIDE="$parent" TEST_REMOTE_LEDGER_FILE="$local_ledger_412" \
    TEST_TARGET_VERSION="$target" TEST_TARGET_SHA256="${TEST_PR412_HASH-$target_hash}" \
    TEST_EXPECT_INCLUDE_ALL=0 TEST_DRY_RUN_OUTPUT_FILE="$dry_run" run_guard \
    >"$tmp/pr412-rejection" 2>&1; then
    echo 'invalid PR #412 local-only exception unexpectedly passed' >&2
    exit 1
  fi
  [[ "$(cat "$cli_apply_count")" == '0' ]]
}

TEST_PR412_TARGET=20261026000200 expect_pr412_rejected
TEST_PR412_HASH=bad expect_pr412_rejected
TEST_PR412_PARENT=20261026000100 expect_pr412_rejected
TEST_PR412_BRANCH=codex/another-branch expect_pr412_rejected
TEST_PR412_ORIGIN=https://github.com/another-owner/another-repo.git expect_pr412_rejected
TEST_PR412_BACKUP="$tmp/missing-pr412-backup" expect_pr412_rejected
altered_backup_412="$tmp/altered-pr412-backup.tar.gz"
cp "$local_backup" "$altered_backup_412"
printf 'tampered' >> "$altered_backup_412"
TEST_PR412_BACKUP="$altered_backup_412" expect_pr412_rejected
invalid_receipt_412="$tmp/invalid-pr412-restore.receipt"
printf 'status=FAIL\n' > "$invalid_receipt_412"
TEST_PR412_RECEIPT="$invalid_receipt_412" expect_pr412_rejected
TEST_PR412_RISK= expect_pr412_rejected
TEST_PR412_OFFSITE=PASS expect_pr412_rejected
TEST_PR412_STORAGE=FAIL expect_pr412_rejected
unset TEST_PR412_TARGET TEST_PR412_HASH TEST_PR412_PARENT TEST_PR412_BRANCH TEST_PR412_ORIGIN \
  TEST_PR412_BACKUP TEST_PR412_RECEIPT TEST_PR412_RISK TEST_PR412_OFFSITE TEST_PR412_STORAGE

printf 'Would push migration %s\nWould push migration 20261025000700\n' "$tec_english_412_version" > "$tmp/pr412-multiple-migrations"
if PATH="$tmp/bin:$PATH" PROMOTION_TEST_REAL_GIT="$real_git" PROMOTION_TEST_REPO_ROOT="$repo_root" \
  PROMOTION_TEST_BRANCH=codex/tec-english-v2-adaptive PROMOTION_TEST_PYTHON3_BIN="$test_python" \
  TEST_BACKUP_GATE=FAIL BACKUP_EXCEPTION_PR=412 \
  BACKUP_EXCEPTION_BACKUP_FILE="$local_backup" BACKUP_EXCEPTION_RESTORE_RECEIPT_FILE="$local_receipt" \
  BACKUP_EXCEPTION_BACKUP_SHA256="$local_backup_sha" \
  BACKUP_EXCEPTION_OFFSITE_STATUS=FAIL BACKUP_EXCEPTION_STORAGE_STATUS=PARTIAL \
  ACCEPT_INCOMPLETE_RECOVERY_RISK=I_ACCEPT_LOCAL_ONLY_RECOVERY_RISK_FOR_PR_412 \
  EXPECTED_REMOTE_LAST_OVERRIDE=20261026000200 TEST_REMOTE_LEDGER_FILE="$local_ledger_412" \
  TEST_TARGET_VERSION="$tec_english_412_version" TEST_TARGET_SHA256="$tec_english_412_hash" \
  TEST_EXPECT_INCLUDE_ALL=0 TEST_DRY_RUN_OUTPUT_FILE="$tmp/pr412-multiple-migrations" run_guard \
  >"$tmp/pr412-multiple-rejection" 2>&1; then
  echo 'PR #412 exception unexpectedly accepted multiple pending migrations' >&2
  exit 1
fi
[[ "$(cat "$cli_apply_count")" == '0' ]]

if PATH="$tmp/bin:$PATH" PROMOTION_TEST_REAL_GIT="$real_git" PROMOTION_TEST_REPO_ROOT="$repo_root" \
  PROMOTION_TEST_BRANCH=codex/tec-english-v2-adaptive PROMOTION_TEST_PYTHON3_BIN="$test_python" \
  APPLY=1 TEST_BACKUP_GATE=FAIL BACKUP_EXCEPTION_PR=412 \
  BACKUP_EXCEPTION_BACKUP_FILE="$local_backup" BACKUP_EXCEPTION_RESTORE_RECEIPT_FILE="$local_receipt" \
  BACKUP_EXCEPTION_BACKUP_SHA256="$local_backup_sha" \
  BACKUP_EXCEPTION_OFFSITE_STATUS=FAIL BACKUP_EXCEPTION_STORAGE_STATUS=PARTIAL \
  ACCEPT_INCOMPLETE_RECOVERY_RISK=I_ACCEPT_LOCAL_ONLY_RECOVERY_RISK_FOR_PR_412 \
  EXPECTED_REMOTE_LAST_OVERRIDE=20261026000200 TEST_REMOTE_LEDGER_FILE="$local_ledger_412" \
  TEST_TARGET_VERSION="$tec_english_412_version" TEST_TARGET_SHA256="$tec_english_412_hash" \
  TEST_EXPECT_INCLUDE_ALL=0 TEST_DRY_RUN_OUTPUT_FILE="$local_dry_run_412" \
  CONFIRM_PRODUCTION_WRITE= run_guard >"$tmp/pr412-write-auth-rejection" 2>&1; then
  echo 'PR #412 exception unexpectedly proceeded without separate write authorization' >&2
  exit 1
fi
grep -q '^PROMOTION_ABORTED=PR #412 production write requires its separate single-migration authorization$' \
  "$tmp/pr412-write-auth-rejection"
[[ "$(cat "$cli_apply_count")" == '0' ]]
echo 'PROMOTE_SINGLE_MIGRATION_PR412_LOCAL_ONLY_GATES=PASS'

# PR #414 authorizes only the Tec Idiomas V3 runtime migration. All proofs are
# synthetic fixtures; the test validates guards and does not connect to production.
tec_idiomas_414_version=20261027000100
tec_idiomas_414_file="$repo_root/supabase/migrations/${tec_idiomas_414_version}_tec_idiomas_v3_runtime.sql"
[[ -f "$tec_idiomas_414_file" ]]
tec_idiomas_414_hash="$(sed 's/\r$//' "$tec_idiomas_414_file" | "$real_sha256sum" | awk '{print $1}')"
[[ "$tec_idiomas_414_hash" == '905cd1820e0496a3eb4f618f7951f636f93ffa4292c0f3eac68b7a53ec6c9813' ]]
local_ledger_414="$tmp/pr414-local-ledger"
local_dry_run_414="$tmp/pr414-local-dry-run"
printf '20261026000300\n' > "$local_ledger_414"
printf 'Would push migration %s\n' "$tec_idiomas_414_version" > "$local_dry_run_414"
printf '0\n' > "$cli_apply_count"
if ! local_output_414="$(PATH="$tmp/bin:$PATH" \
  PROMOTION_TEST_REAL_GIT="$real_git" PROMOTION_TEST_REPO_ROOT="$repo_root" \
  PROMOTION_TEST_BRANCH=codex/tec-idiomas-v3 \
  PROMOTION_TEST_PYTHON3_BIN="$test_python" \
  TEST_BACKUP_GATE=FAIL BACKUP_EXCEPTION_PR=414 \
  BACKUP_EXCEPTION_SOURCE_SHA="$source_commit" \
  BACKUP_EXCEPTION_BACKUP_FILE="$local_backup" \
  BACKUP_EXCEPTION_RESTORE_RECEIPT_FILE="$local_receipt" \
  BACKUP_EXCEPTION_STORAGE_RECEIPT_FILE="$local_storage_receipt" \
  BACKUP_EXCEPTION_BACKUP_SHA256="$local_backup_sha" \
  BACKUP_EXCEPTION_OFFSITE_STATUS=FAIL BACKUP_EXCEPTION_STORAGE_STATUS=PARTIAL \
  ACCEPT_INCOMPLETE_RECOVERY_RISK=ACCEPT_LOCAL_ONLY_RECOVERY_RISK_FOR_PR_414 \
  EXPECTED_REMOTE_LAST_OVERRIDE=20261026000300 TEST_REMOTE_LEDGER_FILE="$local_ledger_414" \
  TEST_TARGET_VERSION="$tec_idiomas_414_version" TEST_TARGET_SHA256="$tec_idiomas_414_hash" \
  TEST_EXPECT_INCLUDE_ALL=0 TEST_DRY_RUN_OUTPUT_FILE="$local_dry_run_414" \
  run_guard 2>&1)"; then
  printf '%s\n' "$local_output_414" >&2
  exit 1
fi
grep -Fxq 'BACKUP_GATE=FAIL' <<< "$local_output_414"
grep -Fxq 'BACKUP_EXCEPTION=PR414_LOCAL_ONLY' <<< "$local_output_414"
grep -Fxq 'BACKUP_EXCEPTION_PR=414' <<< "$local_output_414"
grep -Fxq 'BACKUP_EXCEPTION_SCOPE=20261027000100' <<< "$local_output_414"
grep -Fxq 'BACKUP_EXCEPTION_PREDECESSOR=20261026000300' <<< "$local_output_414"
grep -Fxq "BACKUP_EXCEPTION_SOURCE_SHA=$source_commit" <<< "$local_output_414"
grep -Fxq "BACKUP_EXCEPTION_MIGRATION_SHA256=$tec_idiomas_414_hash" <<< "$local_output_414"
grep -Fxq "BACKUP_EXCEPTION_LOCAL_SHA256=$local_backup_sha" <<< "$local_output_414"
grep -Fxq 'BACKUP_EXCEPTION_POSTGRES_RESTORE=PASS' <<< "$local_output_414"
grep -Fxq 'BACKUP_EXCEPTION_STORAGE_RESTORE=PASS' <<< "$local_output_414"
grep -Fxq 'BACKUP_EXCEPTION_STORAGE=PARTIAL' <<< "$local_output_414"
grep -Fxq 'BACKUP_EXCEPTION_OFFSITE=FAIL' <<< "$local_output_414"
grep -Fxq 'BACKUP_EXCEPTION_OFFSITE_COPY=NONE' <<< "$local_output_414"
grep -Fxq 'BACKUP_EXCEPTION_RISK_ACCEPTANCE=ACCEPTED' <<< "$local_output_414"
grep -Fxq 'DRY_RUN_PENDING_COUNT=1' <<< "$local_output_414"
grep -Fxq 'DRY_RUN_PENDING_VERSION=20261027000100' <<< "$local_output_414"
! grep -q '20261025000700\|20261026000100' <<< "$local_output_414"
[[ "$(cat "$cli_apply_count")" == '0' ]]

expect_pr414_rejected() {
  local target="${TEST_PR414_TARGET-$tec_idiomas_414_version}"
  local parent="${TEST_PR414_PARENT-20261026000300}"
  local branch="${TEST_PR414_BRANCH-codex/tec-idiomas-v3}"
  local origin="${TEST_PR414_ORIGIN-https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git}"
  local backup="${TEST_PR414_BACKUP-$local_backup}"
  local receipt="${TEST_PR414_RECEIPT-$local_receipt}"
  local storage_receipt="${TEST_PR414_STORAGE_RECEIPT-$local_storage_receipt}"
  local source_sha="${TEST_PR414_SOURCE_SHA-$source_commit}"
  local target_file target_hash dry_run="$tmp/pr414-rejected-$RANDOM"
  target_file="$(find "$repo_root/supabase/migrations" -maxdepth 1 -type f -name "${target}_*.sql" -print -quit)"
  [[ -n "$target_file" ]]
  target_hash="$(sed 's/\r$//' "$target_file" | "$real_sha256sum" | awk '{print $1}')"
  printf 'Would push migration %s\n' "$tec_idiomas_414_version" > "$dry_run"
  printf '0\n' > "$cli_apply_count"
  if PATH="$tmp/bin:$PATH" \
    PROMOTION_TEST_REAL_GIT="$real_git" PROMOTION_TEST_REPO_ROOT="$repo_root" \
    PROMOTION_TEST_BRANCH="$branch" PROMOTION_TEST_ORIGIN="$origin" \
    PROMOTION_TEST_PYTHON3_BIN="$test_python" \
    TEST_BACKUP_GATE=FAIL BACKUP_EXCEPTION_PR=414 \
    BACKUP_EXCEPTION_SOURCE_SHA="$source_sha" \
    BACKUP_EXCEPTION_BACKUP_FILE="$backup" BACKUP_EXCEPTION_RESTORE_RECEIPT_FILE="$receipt" \
    BACKUP_EXCEPTION_STORAGE_RECEIPT_FILE="$storage_receipt" \
    BACKUP_EXCEPTION_BACKUP_SHA256="$local_backup_sha" \
    BACKUP_EXCEPTION_OFFSITE_STATUS="${TEST_PR414_OFFSITE-FAIL}" \
    BACKUP_EXCEPTION_STORAGE_STATUS="${TEST_PR414_STORAGE-PARTIAL}" \
    ACCEPT_INCOMPLETE_RECOVERY_RISK="${TEST_PR414_RISK-ACCEPT_LOCAL_ONLY_RECOVERY_RISK_FOR_PR_414}" \
    EXPECTED_REMOTE_LAST_OVERRIDE="${TEST_PR414_PARENT-20261026000300}" \
    TEST_REMOTE_LEDGER_FILE="$local_ledger_414" \
    TEST_TARGET_VERSION="$target" TEST_TARGET_SHA256="${TEST_PR414_HASH-$target_hash}" \
    TEST_EXPECT_INCLUDE_ALL=0 TEST_DRY_RUN_OUTPUT_FILE="$dry_run" run_guard \
    >"$tmp/pr414-rejection" 2>&1; then
    echo 'invalid PR #414 local-only exception unexpectedly passed' >&2
    exit 1
  fi
  [[ "$(cat "$cli_apply_count")" == '0' ]]
}

TEST_PR414_TARGET=20261026000300 expect_pr414_rejected
TEST_PR414_HASH=bad expect_pr414_rejected
TEST_PR414_PARENT=20261026000200 expect_pr414_rejected
TEST_PR414_BRANCH=codex/other expect_pr414_rejected
TEST_PR414_ORIGIN=https://github.com/other/repo.git expect_pr414_rejected
TEST_PR414_SOURCE_SHA=0000000000000000000000000000000000000000 expect_pr414_rejected
TEST_PR414_BACKUP="$tmp/missing-pr414-backup" expect_pr414_rejected
altered_backup_414="$tmp/altered-pr414-backup.tar.gz"
cp "$local_backup" "$altered_backup_414"
printf 'tampered' >> "$altered_backup_414"
TEST_PR414_BACKUP="$altered_backup_414" expect_pr414_rejected
TEST_PR414_RECEIPT="$tmp/missing-pr414-postgres-receipt" expect_pr414_rejected
invalid_storage_receipt_414="$tmp/invalid-pr414-storage.receipt"
printf 'status=FAIL\n' > "$invalid_storage_receipt_414"
TEST_PR414_STORAGE_RECEIPT="$invalid_storage_receipt_414" expect_pr414_rejected
TEST_PR414_RISK= expect_pr414_rejected
TEST_PR414_OFFSITE=PASS expect_pr414_rejected
TEST_PR414_STORAGE=FAIL expect_pr414_rejected
unset TEST_PR414_TARGET TEST_PR414_HASH TEST_PR414_PARENT TEST_PR414_BRANCH TEST_PR414_ORIGIN \
  TEST_PR414_SOURCE_SHA TEST_PR414_BACKUP TEST_PR414_RECEIPT TEST_PR414_STORAGE_RECEIPT \
  TEST_PR414_RISK TEST_PR414_OFFSITE TEST_PR414_STORAGE

printf 'Would push migration %s\nWould push migration 20261025000700\n' "$tec_idiomas_414_version" > "$tmp/pr414-multiple-migrations"
if PATH="$tmp/bin:$PATH" PROMOTION_TEST_REAL_GIT="$real_git" PROMOTION_TEST_REPO_ROOT="$repo_root" \
  PROMOTION_TEST_BRANCH=codex/tec-idiomas-v3 PROMOTION_TEST_PYTHON3_BIN="$test_python" \
  TEST_BACKUP_GATE=FAIL BACKUP_EXCEPTION_PR=414 BACKUP_EXCEPTION_SOURCE_SHA="$source_commit" \
  BACKUP_EXCEPTION_BACKUP_FILE="$local_backup" BACKUP_EXCEPTION_RESTORE_RECEIPT_FILE="$local_receipt" \
  BACKUP_EXCEPTION_STORAGE_RECEIPT_FILE="$local_storage_receipt" \
  BACKUP_EXCEPTION_BACKUP_SHA256="$local_backup_sha" \
  BACKUP_EXCEPTION_OFFSITE_STATUS=FAIL BACKUP_EXCEPTION_STORAGE_STATUS=PARTIAL \
  ACCEPT_INCOMPLETE_RECOVERY_RISK=ACCEPT_LOCAL_ONLY_RECOVERY_RISK_FOR_PR_414 \
  EXPECTED_REMOTE_LAST_OVERRIDE=20261026000300 TEST_REMOTE_LEDGER_FILE="$local_ledger_414" \
  TEST_TARGET_VERSION="$tec_idiomas_414_version" TEST_TARGET_SHA256="$tec_idiomas_414_hash" \
  TEST_EXPECT_INCLUDE_ALL=0 TEST_DRY_RUN_OUTPUT_FILE="$tmp/pr414-multiple-migrations" run_guard \
  >"$tmp/pr414-multiple-rejection" 2>&1; then
  echo 'PR #414 exception unexpectedly accepted multiple pending migrations' >&2
  exit 1
fi
[[ "$(cat "$cli_apply_count")" == '0' ]]

if PATH="$tmp/bin:$PATH" PROMOTION_TEST_REAL_GIT="$real_git" PROMOTION_TEST_REPO_ROOT="$repo_root" \
  PROMOTION_TEST_BRANCH=codex/tec-idiomas-v3 PROMOTION_TEST_PYTHON3_BIN="$test_python" \
  APPLY=1 TEST_BACKUP_GATE=FAIL BACKUP_EXCEPTION_PR=414 BACKUP_EXCEPTION_SOURCE_SHA="$source_commit" \
  BACKUP_EXCEPTION_BACKUP_FILE="$local_backup" BACKUP_EXCEPTION_RESTORE_RECEIPT_FILE="$local_receipt" \
  BACKUP_EXCEPTION_STORAGE_RECEIPT_FILE="$local_storage_receipt" \
  BACKUP_EXCEPTION_BACKUP_SHA256="$local_backup_sha" \
  BACKUP_EXCEPTION_OFFSITE_STATUS=FAIL BACKUP_EXCEPTION_STORAGE_STATUS=PARTIAL \
  ACCEPT_INCOMPLETE_RECOVERY_RISK=ACCEPT_LOCAL_ONLY_RECOVERY_RISK_FOR_PR_414 \
  EXPECTED_REMOTE_LAST_OVERRIDE=20261026000300 TEST_REMOTE_LEDGER_FILE="$local_ledger_414" \
  TEST_TARGET_VERSION="$tec_idiomas_414_version" TEST_TARGET_SHA256="$tec_idiomas_414_hash" \
  TEST_EXPECT_INCLUDE_ALL=0 TEST_DRY_RUN_OUTPUT_FILE="$local_dry_run_414" \
  CONFIRM_PRODUCTION_WRITE= run_guard >"$tmp/pr414-write-auth-rejection" 2>&1; then
  echo 'PR #414 exception unexpectedly proceeded without write authorization' >&2
  exit 1
fi
grep -q '^PROMOTION_ABORTED=PR #414 production write requires its separate single-migration authorization$' \
  "$tmp/pr414-write-auth-rejection"
[[ "$(cat "$cli_apply_count")" == '0' ]]
echo 'PROMOTE_SINGLE_MIGRATION_PR414_LOCAL_ONLY_GATES=PASS'

# PR #418 accepts incomplete recovery risk for exactly the V4 migration. This
# fixture records the risk without claiming a local restore or offsite copy.
tec_idiomas_418_version=20261029000100
tec_idiomas_418_file="$repo_root/supabase/migrations/${tec_idiomas_418_version}_tec_idiomas_v4_absolute_beginners.sql"
[[ -f "$tec_idiomas_418_file" ]]
tec_idiomas_418_hash="$(sed 's/\r$//' "$tec_idiomas_418_file" | "$real_sha256sum" | awk '{print $1}')"
[[ "$tec_idiomas_418_hash" == '7c50f53b44605f62140abf3be630e9d7697f868dae8d4fd2cbe9d57fd97000e7' ]]
local_ledger_418="$tmp/pr418-local-ledger"
local_dry_run_418="$tmp/pr418-local-dry-run"
printf '20261027000100\n' > "$local_ledger_418"
printf 'Would push migration %s\n' "$tec_idiomas_418_version" > "$local_dry_run_418"
printf '0\n' > "$cli_apply_count"
run_pr418_guard() (
  export PATH="$tmp/bin:$PATH"
  export PROMOTION_TEST_REAL_GIT="$real_git"
  export PROMOTION_TEST_REPO_ROOT="$repo_root"
  export PROMOTION_TEST_BRANCH="${TEST_PR418_BRANCH-codex/tec-idiomas-v4-absolute-beginners}"
  export PROMOTION_TEST_ORIGIN="${TEST_PR418_ORIGIN-https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git}"
  export PROMOTION_TEST_PYTHON3_BIN="$test_python"
  export TEST_BACKUP_GATE=FAIL
  export BACKUP_EXCEPTION_PR="${TEST_PR418_PR-418}"
  export BACKUP_EXCEPTION_SOURCE_SHA="${TEST_PR418_SOURCE_SHA-$source_commit}"
  export BACKUP_EXCEPTION_OFFSITE_STATUS="${TEST_PR418_OFFSITE-FAIL}"
  export BACKUP_EXCEPTION_STORAGE_STATUS="${TEST_PR418_STORAGE-PARTIAL}"
  export ACCEPT_INCOMPLETE_RECOVERY_RISK="${TEST_PR418_RISK-I_ACCEPT_INCOMPLETE_RECOVERY_RISK_FOR_PR_418}"
  export EXPECTED_REMOTE_LAST_OVERRIDE="${TEST_PR418_PARENT-20261027000100}"
  export TEST_REMOTE_LEDGER_FILE="${PR418_LEDGER_FILE:-$local_ledger_418}"
  export TEST_TARGET_VERSION="${TEST_PR418_TARGET-$tec_idiomas_418_version}"
  export TEST_TARGET_SHA256="${TEST_PR418_HASH-$tec_idiomas_418_hash}"
  export TEST_EXPECT_INCLUDE_ALL=0
  export TEST_DRY_RUN_OUTPUT_FILE="${PR418_DRY_RUN_FILE:-$local_dry_run_418}"
  run_guard
)

if ! local_output_418="$(run_pr418_guard 2>&1)"; then
  printf '%s\n' "$local_output_418" >&2
  exit 1
fi
grep -Fxq 'BACKUP_GATE=FAIL' <<< "$local_output_418"
grep -Fxq 'BACKUP_EXCEPTION=PR418_SCOPED_RISK_ACCEPTANCE' <<< "$local_output_418"
grep -Fxq 'BACKUP_EXCEPTION_PR=418' <<< "$local_output_418"
grep -Fxq 'BACKUP_EXCEPTION_SCOPE=20261029000100' <<< "$local_output_418"
grep -Fxq 'BACKUP_EXCEPTION_PREDECESSOR=20261027000100' <<< "$local_output_418"
grep -Fxq "BACKUP_EXCEPTION_SOURCE_SHA=$source_commit" <<< "$local_output_418"
grep -Fxq "BACKUP_EXCEPTION_MIGRATION_SHA256=$tec_idiomas_418_hash" <<< "$local_output_418"
grep -Fxq 'BACKUP_EXCEPTION_RECOVERY_PROOF=NONE' <<< "$local_output_418"
grep -Fxq 'BACKUP_EXCEPTION_RECOVERY_RISK=INCOMPLETE_RECOVERY_RISK_ACCEPTED' <<< "$local_output_418"
grep -Fxq 'BACKUP_EXCEPTION_OFFSITE=FAIL' <<< "$local_output_418"
grep -Fxq 'BACKUP_EXCEPTION_STORAGE=PARTIAL' <<< "$local_output_418"
grep -Fxq 'BACKUP_EXCEPTION_RISK_ACCEPTANCE=ACCEPTED' <<< "$local_output_418"
grep -Fxq 'DRY_RUN_PENDING_COUNT=1' <<< "$local_output_418"
grep -Fxq 'DRY_RUN_PENDING_VERSION=20261029000100' <<< "$local_output_418"
grep -Fxq 'PROMOTION=DRY_RUN_ONLY' <<< "$local_output_418"
grep -Fxq 'PRODUCTION_WRITE_AUTHORIZATION=PENDING' <<< "$local_output_418"
! grep -q '20261025000700\|20261026000100\|20261029000200' <<< "$local_output_418"
[[ "$(cat "$cli_apply_count")" == '0' ]]

expect_pr418_rejected() {
  local target="${TEST_PR418_TARGET-$tec_idiomas_418_version}"
  local pending_output="$tmp/pr418-rejected-$RANDOM"
  local target_file target_hash
  target_file="$(find "$repo_root/supabase/migrations" -maxdepth 1 -type f -name "${target}_*.sql" -print -quit)"
  [[ -n "$target_file" ]]
  target_hash="$(sed 's/\r$//' "$target_file" | "$real_sha256sum" | awk '{print $1}')"
  printf 'Would push migration %s\n' "$tec_idiomas_418_version" > "$pending_output"
  printf '0\n' > "$cli_apply_count"
  if TEST_PR418_TARGET="$target" TEST_PR418_HASH="${TEST_PR418_HASH-$target_hash}" PR418_DRY_RUN_FILE="$pending_output" run_pr418_guard >"$tmp/pr418-rejection" 2>&1; then
    echo 'invalid PR #418 scoped risk exception unexpectedly passed' >&2
    exit 1
  fi
  [[ "$(cat "$cli_apply_count")" == '0' ]]
}

TEST_PR418_RISK= expect_pr418_rejected
TEST_PR418_PR=414 expect_pr418_rejected
TEST_PR418_BRANCH=codex/another-branch expect_pr418_rejected
TEST_PR418_ORIGIN=https://github.com/another-owner/another-repo.git expect_pr418_rejected
TEST_PR418_SOURCE_SHA=0000000000000000000000000000000000000000 expect_pr418_rejected
TEST_PR418_TARGET=20261027000100 expect_pr418_rejected
TEST_PR418_HASH=bad expect_pr418_rejected
TEST_PR418_PARENT=20261026000300 expect_pr418_rejected
TEST_PR418_OFFSITE=PASS expect_pr418_rejected
TEST_PR418_STORAGE=FAIL expect_pr418_rejected
unset TEST_PR418_RISK TEST_PR418_PR TEST_PR418_BRANCH TEST_PR418_ORIGIN TEST_PR418_SOURCE_SHA TEST_PR418_TARGET TEST_PR418_HASH TEST_PR418_PARENT TEST_PR418_OFFSITE TEST_PR418_STORAGE

printf 'Would push migration %s\nWould push migration 20261029000200\n' "$tec_idiomas_418_version" > "$tmp/pr418-multiple-migrations"
if PR418_DRY_RUN_FILE="$tmp/pr418-multiple-migrations" run_pr418_guard >"$tmp/pr418-multiple-rejection" 2>&1; then
  echo 'PR #418 exception unexpectedly accepted multiple pending migrations' >&2
  exit 1
fi
[[ "$(cat "$cli_apply_count")" == '0' ]]

if APPLY=1 CONFIRM_PRODUCTION_WRITE= run_pr418_guard >"$tmp/pr418-write-auth-rejection" 2>&1; then
  echo 'PR #418 exception unexpectedly proceeded without separate write authorization' >&2
  exit 1
fi
grep -q '^PROMOTION_ABORTED=PR #418 production write requires its separate single-migration authorization$' "$tmp/pr418-write-auth-rejection"
[[ "$(cat "$cli_apply_count")" == '0' ]]

# The placement-sync migration is a separate, sequentially scoped exception:
# exactly 20261029000200 after 20261029000100, with its own checksum and token.
tec_idiomas_418_placement_version=20261029000200
tec_idiomas_418_placement_file="$repo_root/supabase/migrations/${tec_idiomas_418_placement_version}_tec_idiomas_placement_sync.sql"
[[ -f "$tec_idiomas_418_placement_file" ]]
tec_idiomas_418_placement_hash="$(sed 's/\r$//' "$tec_idiomas_418_placement_file" | "$real_sha256sum" | awk '{print $1}')"
[[ "$tec_idiomas_418_placement_hash" == 'fded3483f8a17e652ce7301a2f99a90d5b2c18358deeeabdf9bae3aa43c71fb9' ]]
local_ledger_418_placement="$tmp/pr418-placement-local-ledger"
local_dry_run_418_placement="$tmp/pr418-placement-local-dry-run"
printf '20261029000100\n' > "$local_ledger_418_placement"
printf 'Would push migration %s\n' "$tec_idiomas_418_placement_version" > "$local_dry_run_418_placement"
if ! local_output_418_placement="$(TEST_PR418_PARENT=20261029000100 \
  TEST_PR418_TARGET="$tec_idiomas_418_placement_version" \
  TEST_PR418_HASH="$tec_idiomas_418_placement_hash" \
  PR418_LEDGER_FILE="$local_ledger_418_placement" \
  PR418_DRY_RUN_FILE="$local_dry_run_418_placement" run_pr418_guard 2>&1)"; then
  printf '%s\n' "$local_output_418_placement" >&2
  exit 1
fi
grep -Fxq 'BACKUP_GATE=FAIL' <<< "$local_output_418_placement"
grep -Fxq 'BACKUP_EXCEPTION=PR418_SCOPED_RISK_ACCEPTANCE' <<< "$local_output_418_placement"
grep -Fxq 'BACKUP_EXCEPTION_SCOPE=20261029000200' <<< "$local_output_418_placement"
grep -Fxq 'BACKUP_EXCEPTION_PREDECESSOR=20261029000100' <<< "$local_output_418_placement"
grep -Fxq "BACKUP_EXCEPTION_MIGRATION_SHA256=$tec_idiomas_418_placement_hash" <<< "$local_output_418_placement"
grep -Fxq 'BACKUP_EXCEPTION_OFFSITE=FAIL' <<< "$local_output_418_placement"
grep -Fxq 'BACKUP_EXCEPTION_STORAGE=PARTIAL' <<< "$local_output_418_placement"
grep -Fxq 'DRY_RUN_PENDING_COUNT=1' <<< "$local_output_418_placement"
grep -Fxq 'DRY_RUN_PENDING_VERSION=20261029000200' <<< "$local_output_418_placement"
grep -Fxq 'PROMOTION=DRY_RUN_ONLY' <<< "$local_output_418_placement"
! grep -q '20261025000700\|20261027000100' <<< "$local_output_418_placement"
[[ "$(cat "$cli_apply_count")" == '0' ]]

if TEST_PR418_PARENT=20261027000100 TEST_PR418_TARGET="$tec_idiomas_418_placement_version" \
  TEST_PR418_HASH="$tec_idiomas_418_placement_hash" PR418_LEDGER_FILE="$local_ledger_418_placement" \
  PR418_DRY_RUN_FILE="$local_dry_run_418_placement" run_pr418_guard >"$tmp/pr418-placement-wrong-parent" 2>&1; then
  echo 'PR #418 placement exception unexpectedly accepted the wrong predecessor' >&2
  exit 1
fi
if TEST_PR418_PARENT=20261029000100 TEST_PR418_TARGET="$tec_idiomas_418_placement_version" \
  TEST_PR418_HASH=bad PR418_LEDGER_FILE="$local_ledger_418_placement" \
  PR418_DRY_RUN_FILE="$local_dry_run_418_placement" run_pr418_guard >"$tmp/pr418-placement-wrong-hash" 2>&1; then
  echo 'PR #418 placement exception unexpectedly accepted a wrong migration hash' >&2
  exit 1
fi
if TEST_PR418_PARENT=20261029000100 TEST_PR418_TARGET="$tec_idiomas_418_placement_version" \
  TEST_PR418_HASH="$tec_idiomas_418_placement_hash" PR418_LEDGER_FILE="$local_ledger_418_placement" \
  PR418_DRY_RUN_FILE="$local_dry_run_418_placement" APPLY=1 \
  CONFIRM_PRODUCTION_WRITE=I_CONFIRM_PR418_SINGLE_MIGRATION_20261029000100 \
  run_pr418_guard >"$tmp/pr418-placement-wrong-write-token" 2>&1; then
  echo 'PR #418 placement exception unexpectedly accepted the V4 write token' >&2
  exit 1
fi
grep -q '^PROMOTION_ABORTED=PR #418 production write requires its separate single-migration authorization$' "$tmp/pr418-placement-wrong-write-token"
[[ "$(cat "$cli_apply_count")" == '0' ]]
echo 'PROMOTE_SINGLE_MIGRATION_PR418_SCOPED_RISK_GATES=PASS'

# PR #424 is a campaign-scoped authorization for exactly the V6.3 migration.
# The backup gate remains FAIL and the unavailable offsite/partial Storage
# recovery are reported; no local restore proof is claimed.
tec_idiomas_424_version=20261030000100
tec_idiomas_424_file="$repo_root/supabase/migrations/${tec_idiomas_424_version}_tec_idiomas_v63_ui_reset_activity.sql"
[[ -f "$tec_idiomas_424_file" ]]
tec_idiomas_424_hash="$(sed 's/\r$//' "$tec_idiomas_424_file" | "$real_sha256sum" | awk '{print $1}')"
[[ "$tec_idiomas_424_hash" == '39d60fde95d440bcf7c771de36c1a838f750957089db98c3908b093976846780' ]]
local_ledger_424="$tmp/pr424-local-ledger"
local_dry_run_424="$tmp/pr424-local-dry-run"
printf '20261029000200\n' > "$local_ledger_424"
printf 'Would push migration %s\n' "$tec_idiomas_424_version" > "$local_dry_run_424"
printf '0\n' > "$cli_apply_count"
run_pr424_guard() (
  export PATH="$tmp/bin:$PATH"
  export PROMOTION_TEST_REAL_GIT="$real_git"
  export PROMOTION_TEST_REPO_ROOT="$repo_root"
  export PROMOTION_TEST_BRANCH="${TEST_PR424_BRANCH-codex/tec-idiomas-v6-4-release-validation}"
  export PROMOTION_TEST_ORIGIN="${TEST_PR424_ORIGIN-https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git}"
  export PROMOTION_TEST_PYTHON3_BIN="$test_python"
  export TEST_BACKUP_GATE=FAIL
  export BACKUP_EXCEPTION_PR="${TEST_PR424_PR-424}"
  export BACKUP_EXCEPTION_SOURCE_SHA="${TEST_PR424_SOURCE_SHA-$source_commit}"
  export BACKUP_EXCEPTION_OFFSITE_STATUS="${TEST_PR424_OFFSITE-FAIL}"
  export BACKUP_EXCEPTION_STORAGE_STATUS="${TEST_PR424_STORAGE-PARTIAL}"
  export BACKUP_EXCEPTION_AUTHORIZATION="${TEST_PR424_AUTH-TECESCOLA_V65_PR424_20261030000100}"
  export EXPECTED_REMOTE_LAST_OVERRIDE="${TEST_PR424_PARENT-20261029000200}"
  export TEST_REMOTE_LEDGER_FILE="${PR424_LEDGER_FILE:-$local_ledger_424}"
  export TEST_TARGET_VERSION="${TEST_PR424_TARGET-$tec_idiomas_424_version}"
  export TEST_TARGET_SHA256="${TEST_PR424_HASH-$tec_idiomas_424_hash}"
  export TEST_EXPECT_INCLUDE_ALL=0
  export TEST_DRY_RUN_OUTPUT_FILE="${PR424_DRY_RUN_FILE:-$local_dry_run_424}"
  export TEST_AFTER_LEDGER_CONTENT="20261029000200
20261030000100"
  run_guard
)

if ! local_output_424="$(run_pr424_guard 2>&1)"; then
  printf '%s\n' "$local_output_424" >&2
  exit 1
fi
grep -Fxq 'BACKUP_GATE=FAIL' <<< "$local_output_424"
grep -Fxq 'BACKUP_EXCEPTION=PR424_SCOPED_MIGRATION_AUTHORIZATION' <<< "$local_output_424"
grep -Fxq 'BACKUP_EXCEPTION_PR=424' <<< "$local_output_424"
grep -Fxq 'BACKUP_EXCEPTION_SCOPE=20261030000100' <<< "$local_output_424"
grep -Fxq 'BACKUP_EXCEPTION_PREDECESSOR=20261029000200' <<< "$local_output_424"
grep -Fxq "BACKUP_EXCEPTION_SOURCE_SHA=$source_commit" <<< "$local_output_424"
grep -Fxq "BACKUP_EXCEPTION_MIGRATION_SHA256=$tec_idiomas_424_hash" <<< "$local_output_424"
grep -Fxq 'BACKUP_EXCEPTION_RECOVERY_PROOF=NONE' <<< "$local_output_424"
grep -Fxq 'BACKUP_EXCEPTION_RECOVERY_RISK=OFFSITE_UNAVAILABLE_STORAGE_PARTIAL' <<< "$local_output_424"
grep -Fxq 'BACKUP_EXCEPTION_OFFSITE=FAIL' <<< "$local_output_424"
grep -Fxq 'BACKUP_EXCEPTION_STORAGE=PARTIAL' <<< "$local_output_424"
grep -Fxq 'BACKUP_EXCEPTION_SCOPE_AUTHORIZATION=TECESCOLA_V65_PR424_20261030000100' <<< "$local_output_424"
grep -Fxq 'DRY_RUN_PENDING_COUNT=1' <<< "$local_output_424"
grep -Fxq 'DRY_RUN_PENDING_VERSION=20261030000100' <<< "$local_output_424"
grep -Fxq 'PROMOTION=DRY_RUN_ONLY' <<< "$local_output_424"
grep -Fxq 'PRODUCTION_WRITE_AUTHORIZATION=PENDING' <<< "$local_output_424"
! grep -q '20261025000700\|20261030000200' <<< "$local_output_424"
[[ "$(cat "$cli_apply_count")" == '0' ]]

expect_pr424_rejected() {
  local target="${TEST_PR424_TARGET-$tec_idiomas_424_version}"
  local pending_output="$tmp/pr424-rejected-$RANDOM"
  local target_file target_hash
  target_file="$(find "$repo_root/supabase/migrations" -maxdepth 1 -type f -name "${target}_*.sql" -print -quit)"
  [[ -n "$target_file" ]]
  target_hash="$(sed 's/\r$//' "$target_file" | "$real_sha256sum" | awk '{print $1}')"
  printf 'Would push migration %s\n' "$tec_idiomas_424_version" > "$pending_output"
  printf '0\n' > "$cli_apply_count"
  if TEST_PR424_TARGET="$target" TEST_PR424_HASH="${TEST_PR424_HASH-$target_hash}" \
    PR424_DRY_RUN_FILE="$pending_output" run_pr424_guard >"$tmp/pr424-rejection" 2>&1; then
    echo 'invalid PR #424 scoped authorization unexpectedly passed' >&2
    exit 1
  fi
  [[ "$(cat "$cli_apply_count")" == '0' ]]
}

TEST_PR424_TARGET=20261029000100 expect_pr424_rejected
TEST_PR424_HASH=bad expect_pr424_rejected
TEST_PR424_PARENT=20261029000100 expect_pr424_rejected
TEST_PR424_BRANCH=codex/another-branch expect_pr424_rejected
TEST_PR424_ORIGIN=https://github.com/another-owner/another-repo.git expect_pr424_rejected
TEST_PR424_SOURCE_SHA=0000000000000000000000000000000000000000 expect_pr424_rejected
TEST_PR424_PR=418 expect_pr424_rejected
TEST_PR424_AUTH=wrong expect_pr424_rejected
TEST_PR424_OFFSITE=PASS expect_pr424_rejected
TEST_PR424_STORAGE=FAIL expect_pr424_rejected
unset TEST_PR424_TARGET TEST_PR424_HASH TEST_PR424_PARENT TEST_PR424_BRANCH TEST_PR424_ORIGIN \
  TEST_PR424_SOURCE_SHA TEST_PR424_PR TEST_PR424_AUTH TEST_PR424_OFFSITE TEST_PR424_STORAGE

printf 'Would push migration %s\nWould push migration 20261030000200\n' "$tec_idiomas_424_version" > "$tmp/pr424-multiple-migrations"
if PR424_DRY_RUN_FILE="$tmp/pr424-multiple-migrations" run_pr424_guard >"$tmp/pr424-multiple-rejection" 2>&1; then
  echo 'PR #424 exception unexpectedly accepted multiple pending migrations' >&2
  exit 1
fi
[[ "$(cat "$cli_apply_count")" == '0' ]]

printf '0\n' > "$cli_apply_count"
if APPLY=1 CONFIRM_PRODUCTION_WRITE= run_pr424_guard >"$tmp/pr424-write-auth-rejection" 2>&1; then
  echo 'PR #424 exception unexpectedly proceeded without its exact write authorization' >&2
  exit 1
fi
grep -q '^PROMOTION_ABORTED=PR #424 production write requires its single-migration confirmation$' "$tmp/pr424-write-auth-rejection"
[[ "$(cat "$cli_apply_count")" == '0' ]]

printf '0\n' > "$cli_apply_count"
applied_424="$(APPLY=1 CONFIRM_PRODUCTION_WRITE=I_CONFIRM_PR424_SINGLE_MIGRATION_20261030000100 run_pr424_guard)"
grep -Fxq 'BACKUP_GATE=FAIL' <<< "$applied_424"
grep -Fxq 'PRODUCTION_WRITE_AUTHORIZATION=APPROVED' <<< "$applied_424"
grep -Fxq 'PROMOTION=APPLIED' <<< "$applied_424"
grep -Fxq 'REMOTE_AFTER_COUNT=2' <<< "$applied_424"
grep -Fxq 'REMOTE_AFTER_LAST=20261030000100' <<< "$applied_424"
[[ "$(cat "$cli_apply_count")" == '1' ]]
echo 'PROMOTE_SINGLE_MIGRATION_PR424_SCOPED_AUTHORIZATION=PASS'

# PR #425's allowlist is limited to its V8 technical publication migration.
tec_idiomas_425_version=20261030000200
tec_idiomas_425_file="$repo_root/supabase/migrations/${tec_idiomas_425_version}_tec_idiomas_explicit_institution_release.sql"
[[ -f "$tec_idiomas_425_file" ]]
tec_idiomas_425_hash="$(sed 's/\r$//' "$tec_idiomas_425_file" | "$real_sha256sum" | awk '{print $1}')"
[[ "$tec_idiomas_425_hash" == '827516fce78df4d5720cda5372ad2fe355c393394017754582aed597386912cb' ]]
local_ledger_425="$tmp/pr425-local-ledger"
local_dry_run_425="$tmp/pr425-local-dry-run"
printf '20261030000100\n' > "$local_ledger_425"
printf 'Would push migration %s\n' "$tec_idiomas_425_version" > "$local_dry_run_425"
printf '0\n' > "$cli_apply_count"
run_pr425_guard() (
  export PATH="$tmp/bin:$PATH"
  export PROMOTION_TEST_REAL_GIT="$real_git"
  export PROMOTION_TEST_REPO_ROOT="$repo_root"
  export PROMOTION_TEST_BRANCH="${TEST_PR425_BRANCH-codex/tec-idiomas-explicit-release-gate-v7}"
  export PROMOTION_TEST_ORIGIN="${TEST_PR425_ORIGIN-https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git}"
  export PROMOTION_TEST_PYTHON3_BIN="$test_python"
  export TEST_BACKUP_GATE=FAIL
  export BACKUP_EXCEPTION_PR="${TEST_PR425_PR-425}"
  export BACKUP_EXCEPTION_SOURCE_SHA="${TEST_PR425_SOURCE_SHA-$source_commit}"
  export BACKUP_EXCEPTION_OFFSITE_STATUS="${TEST_PR425_OFFSITE-FAIL}"
  export BACKUP_EXCEPTION_STORAGE_STATUS="${TEST_PR425_STORAGE-PARTIAL}"
  export BACKUP_EXCEPTION_AUTHORIZATION="${TEST_PR425_AUTH-TECESCOLA_V8_PR425_20261030000200}"
  export EXPECTED_REMOTE_LAST_OVERRIDE="${TEST_PR425_PARENT-20261030000100}"
  export TEST_REMOTE_LEDGER_FILE="${PR425_LEDGER_FILE:-$local_ledger_425}"
  export TEST_TARGET_VERSION="${TEST_PR425_TARGET-$tec_idiomas_425_version}"
  export TEST_TARGET_SHA256="${TEST_PR425_HASH-$tec_idiomas_425_hash}"
  export TEST_EXPECT_INCLUDE_ALL=0
  export TEST_DRY_RUN_OUTPUT_FILE="${PR425_DRY_RUN_FILE:-$local_dry_run_425}"
  export TEST_AFTER_LEDGER_CONTENT="20261030000100
20261030000200"
  run_guard
)

local_output_425="$(run_pr425_guard)"
grep -Fxq 'BACKUP_GATE=FAIL' <<< "$local_output_425"
grep -Fxq 'BACKUP_EXCEPTION=PR425_SCOPED_MIGRATION_AUTHORIZATION' <<< "$local_output_425"
grep -Fxq 'BACKUP_EXCEPTION_PR=425' <<< "$local_output_425"
grep -Fxq 'BACKUP_EXCEPTION_SCOPE=20261030000200' <<< "$local_output_425"
grep -Fxq 'BACKUP_EXCEPTION_PREDECESSOR=20261030000100' <<< "$local_output_425"
grep -Fxq "BACKUP_EXCEPTION_SOURCE_SHA=$source_commit" <<< "$local_output_425"
grep -Fxq "BACKUP_EXCEPTION_MIGRATION_SHA256=$tec_idiomas_425_hash" <<< "$local_output_425"
grep -Fxq 'BACKUP_EXCEPTION_RECOVERY_PROOF=NONE' <<< "$local_output_425"
grep -Fxq 'BACKUP_EXCEPTION_RECOVERY_RISK=OFFSITE_UNAVAILABLE_STORAGE_PARTIAL' <<< "$local_output_425"
grep -Fxq 'BACKUP_EXCEPTION_OFFSITE=FAIL' <<< "$local_output_425"
grep -Fxq 'BACKUP_EXCEPTION_STORAGE=PARTIAL' <<< "$local_output_425"
grep -Fxq 'BACKUP_EXCEPTION_SCOPE_AUTHORIZATION=TECESCOLA_V8_PR425_20261030000200' <<< "$local_output_425"
grep -Fxq 'DRY_RUN_PENDING_COUNT=1' <<< "$local_output_425"
grep -Fxq 'DRY_RUN_PENDING_VERSION=20261030000200' <<< "$local_output_425"
grep -Fxq 'PROMOTION=DRY_RUN_ONLY' <<< "$local_output_425"
grep -Fxq 'PRODUCTION_WRITE_AUTHORIZATION=PENDING' <<< "$local_output_425"
! grep -q '20261027000100\|20261030000300' <<< "$local_output_425"
[[ "$(cat "$cli_apply_count")" == '0' ]]

expect_pr425_rejected() {
  local pending_output="$tmp/pr425-rejected-$RANDOM"
  printf 'Would push migration %s\n' "$tec_idiomas_425_version" > "$pending_output"
  printf '0\n' > "$cli_apply_count"
  if PR425_DRY_RUN_FILE="$pending_output" run_pr425_guard >"$tmp/pr425-rejection" 2>&1; then
    echo 'invalid PR #425 scoped authorization unexpectedly passed' >&2
    exit 1
  fi
  [[ "$(cat "$cli_apply_count")" == '0' ]]
}
TEST_PR425_TARGET=20261030000100 expect_pr425_rejected
TEST_PR425_HASH=bad expect_pr425_rejected
TEST_PR425_PARENT=20261029000200 expect_pr425_rejected
TEST_PR425_BRANCH=codex/another-branch expect_pr425_rejected
TEST_PR425_ORIGIN=https://github.com/another-owner/another-repo.git expect_pr425_rejected
TEST_PR425_SOURCE_SHA=0000000000000000000000000000000000000000 expect_pr425_rejected
TEST_PR425_PR=424 expect_pr425_rejected
TEST_PR425_AUTH=wrong expect_pr425_rejected
TEST_PR425_OFFSITE=PASS expect_pr425_rejected
TEST_PR425_STORAGE=FAIL expect_pr425_rejected
unset TEST_PR425_TARGET TEST_PR425_HASH TEST_PR425_PARENT TEST_PR425_BRANCH TEST_PR425_ORIGIN \
  TEST_PR425_SOURCE_SHA TEST_PR425_PR TEST_PR425_AUTH TEST_PR425_OFFSITE TEST_PR425_STORAGE

printf 'Would push migration %s\nWould push migration 20261030000300\n' "$tec_idiomas_425_version" > "$tmp/pr425-multiple-migrations"
if PR425_DRY_RUN_FILE="$tmp/pr425-multiple-migrations" run_pr425_guard >"$tmp/pr425-multiple-rejection" 2>&1; then
  echo 'PR #425 exception unexpectedly accepted multiple pending migrations' >&2
  exit 1
fi
[[ "$(cat "$cli_apply_count")" == '0' ]]
if APPLY=1 CONFIRM_PRODUCTION_WRITE= run_pr425_guard >"$tmp/pr425-write-auth-rejection" 2>&1; then
  echo 'PR #425 exception unexpectedly proceeded without its single-migration confirmation' >&2
  exit 1
fi
grep -q '^PROMOTION_ABORTED=PR #425 production write requires its single-migration confirmation$' "$tmp/pr425-write-auth-rejection"
[[ "$(cat "$cli_apply_count")" == '0' ]]
applied_425="$(APPLY=1 CONFIRM_PRODUCTION_WRITE=I_CONFIRM_PR425_SINGLE_MIGRATION_20261030000200 run_pr425_guard)"
grep -Fxq 'BACKUP_GATE=FAIL' <<< "$applied_425"
grep -Fxq 'PRODUCTION_WRITE_AUTHORIZATION=APPROVED' <<< "$applied_425"
grep -Fxq 'PROMOTION=APPLIED' <<< "$applied_425"
grep -Fxq 'REMOTE_AFTER_COUNT=2' <<< "$applied_425"
grep -Fxq 'REMOTE_AFTER_LAST=20261030000200' <<< "$applied_425"
[[ "$(cat "$cli_apply_count")" == '1' ]]
echo 'PROMOTE_SINGLE_MIGRATION_PR425_SCOPED_AUTHORIZATION=PASS'

# PR #428 authorizes only the V8.5 eligibility migration; offsite and Storage
# recovery remain visibly FAIL/PARTIAL and the database-write token is separate.
tec_idiomas_428_version=20261031000100
tec_idiomas_428_file="$repo_root/supabase/migrations/${tec_idiomas_428_version}_tec_english_operational_release_eligibility.sql"
[[ -f "$tec_idiomas_428_file" ]]
tec_idiomas_428_hash="$(sed 's/\r$//' "$tec_idiomas_428_file" | "$real_sha256sum" | awk '{print $1}')"
[[ "$tec_idiomas_428_hash" == '278fee92c0272694b309032f186a434cafcd89e8dd63ea2d80028a59c6dba922' ]]
local_ledger_428="$tmp/pr428-local-ledger"
local_dry_run_428="$tmp/pr428-local-dry-run"
printf '20261030000200\n' > "$local_ledger_428"
printf 'Would push migration %s\n' "$tec_idiomas_428_version" > "$local_dry_run_428"
printf '0\n' > "$cli_apply_count"
run_pr428_guard() (
  export PATH="$tmp/bin:$PATH"
  export PROMOTION_TEST_REAL_GIT="$real_git"
  export PROMOTION_TEST_REPO_ROOT="$repo_root"
  export PROMOTION_TEST_BRANCH="${TEST_PR428_BRANCH-codex/tec-idiomas-v8-4-release-eligibility}"
  export PROMOTION_TEST_ORIGIN="${TEST_PR428_ORIGIN-https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git}"
  export PROMOTION_TEST_PYTHON3_BIN="$test_python"
  export TEST_BACKUP_GATE=FAIL
  export BACKUP_EXCEPTION_PR="${TEST_PR428_PR-428}"
  export BACKUP_EXCEPTION_SOURCE_SHA="${TEST_PR428_SOURCE_SHA-$source_commit}"
  export BACKUP_EXCEPTION_OFFSITE_STATUS="${TEST_PR428_OFFSITE-FAIL}"
  export BACKUP_EXCEPTION_STORAGE_STATUS="${TEST_PR428_STORAGE-PARTIAL}"
  export BACKUP_EXCEPTION_AUTHORIZATION="${TEST_PR428_AUTH-TECESCOLA_V85_PR428_20261031000100}"
  export EXPECTED_REMOTE_LAST_OVERRIDE="${TEST_PR428_PARENT-20261030000200}"
  export TEST_REMOTE_LEDGER_FILE="${PR428_LEDGER_FILE:-$local_ledger_428}"
  export TEST_TARGET_VERSION="${TEST_PR428_TARGET-$tec_idiomas_428_version}"
  export TEST_TARGET_SHA256="${TEST_PR428_HASH-$tec_idiomas_428_hash}"
  export TEST_EXPECT_INCLUDE_ALL=0
  export TEST_DRY_RUN_OUTPUT_FILE="${PR428_DRY_RUN_FILE:-$local_dry_run_428}"
  export TEST_AFTER_LEDGER_CONTENT="20261030000200
20261031000100"
  run_guard
)

local_output_428="$(run_pr428_guard)"
grep -Fxq 'BACKUP_GATE=FAIL' <<< "$local_output_428"
grep -Fxq 'BACKUP_EXCEPTION=PR428_SCOPED_MIGRATION_AUTHORIZATION' <<< "$local_output_428"
grep -Fxq 'BACKUP_EXCEPTION_PR=428' <<< "$local_output_428"
grep -Fxq 'BACKUP_EXCEPTION_SCOPE=20261031000100' <<< "$local_output_428"
grep -Fxq 'BACKUP_EXCEPTION_PREDECESSOR=20261030000200' <<< "$local_output_428"
grep -Fxq "BACKUP_EXCEPTION_SOURCE_SHA=$source_commit" <<< "$local_output_428"
grep -Fxq "BACKUP_EXCEPTION_MIGRATION_SHA256=$tec_idiomas_428_hash" <<< "$local_output_428"
grep -Fxq 'BACKUP_EXCEPTION_RECOVERY_PROOF=NONE' <<< "$local_output_428"
grep -Fxq 'BACKUP_EXCEPTION_RECOVERY_RISK=OFFSITE_UNAVAILABLE_STORAGE_PARTIAL_NONDESTRUCTIVE_DDL' <<< "$local_output_428"
grep -Fxq 'BACKUP_EXCEPTION_OFFSITE=FAIL' <<< "$local_output_428"
grep -Fxq 'BACKUP_EXCEPTION_STORAGE=PARTIAL' <<< "$local_output_428"
grep -Fxq 'BACKUP_EXCEPTION_SCOPE_AUTHORIZATION=TECESCOLA_V85_PR428_20261031000100' <<< "$local_output_428"
grep -Fxq 'DRY_RUN_PENDING_COUNT=1' <<< "$local_output_428"
grep -Fxq 'DRY_RUN_PENDING_VERSION=20261031000100' <<< "$local_output_428"
grep -Fxq 'PROMOTION=DRY_RUN_ONLY' <<< "$local_output_428"
grep -Fxq 'PRODUCTION_WRITE_AUTHORIZATION=PENDING' <<< "$local_output_428"
! grep -q '20261030000300\|20261027000100' <<< "$local_output_428"
[[ "$(cat "$cli_apply_count")" == '0' ]]

expect_pr428_rejected() {
  local pending_output="$tmp/pr428-rejected-$RANDOM"
  printf 'Would push migration %s\n' "$tec_idiomas_428_version" > "$pending_output"
  printf '0\n' > "$cli_apply_count"
  if PR428_DRY_RUN_FILE="$pending_output" run_pr428_guard >"$tmp/pr428-rejection" 2>&1; then
    echo 'invalid PR #428 scoped authorization unexpectedly passed' >&2
    exit 1
  fi
  [[ "$(cat "$cli_apply_count")" == '0' ]]
}
TEST_PR428_TARGET=20261030000200 expect_pr428_rejected
TEST_PR428_HASH=bad expect_pr428_rejected
TEST_PR428_PARENT=20261030000100 expect_pr428_rejected
TEST_PR428_BRANCH=codex/another-branch expect_pr428_rejected
TEST_PR428_ORIGIN=https://github.com/another-owner/another-repo.git expect_pr428_rejected
TEST_PR428_SOURCE_SHA=0000000000000000000000000000000000000000 expect_pr428_rejected
TEST_PR428_PR=427 expect_pr428_rejected
TEST_PR428_AUTH=wrong expect_pr428_rejected
TEST_PR428_OFFSITE=PASS expect_pr428_rejected
TEST_PR428_STORAGE=FAIL expect_pr428_rejected
unset TEST_PR428_TARGET TEST_PR428_HASH TEST_PR428_PARENT TEST_PR428_BRANCH TEST_PR428_ORIGIN \
  TEST_PR428_SOURCE_SHA TEST_PR428_PR TEST_PR428_AUTH TEST_PR428_OFFSITE TEST_PR428_STORAGE

printf 'Would push migration %s\nWould push migration 20261031000200\n' "$tec_idiomas_428_version" > "$tmp/pr428-multiple-migrations"
if PR428_DRY_RUN_FILE="$tmp/pr428-multiple-migrations" run_pr428_guard >"$tmp/pr428-multiple-rejection" 2>&1; then
  echo 'PR #428 exception unexpectedly accepted multiple pending migrations' >&2
  exit 1
fi
[[ "$(cat "$cli_apply_count")" == '0' ]]
if APPLY=1 CONFIRM_PRODUCTION_WRITE= run_pr428_guard >"$tmp/pr428-write-auth-rejection" 2>&1; then
  echo 'PR #428 exception unexpectedly proceeded without its single-migration confirmation' >&2
  exit 1
fi
grep -q '^PROMOTION_ABORTED=PR #428 production write requires its single-migration confirmation$' "$tmp/pr428-write-auth-rejection"
[[ "$(cat "$cli_apply_count")" == '0' ]]
applied_428="$(APPLY=1 CONFIRM_PRODUCTION_WRITE=I_CONFIRM_PR428_SINGLE_MIGRATION_20261031000100 run_pr428_guard)"
grep -Fxq 'BACKUP_GATE=FAIL' <<< "$applied_428"
grep -Fxq 'PRODUCTION_WRITE_AUTHORIZATION=APPROVED' <<< "$applied_428"
grep -Fxq 'PROMOTION=APPLIED' <<< "$applied_428"
grep -Fxq 'REMOTE_AFTER_COUNT=2' <<< "$applied_428"
grep -Fxq 'REMOTE_AFTER_LAST=20261031000100' <<< "$applied_428"
[[ "$(cat "$cli_apply_count")" == '1' ]]
echo 'PROMOTE_SINGLE_MIGRATION_PR428_SCOPED_AUTHORIZATION=PASS'

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
