#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
script="$repo_root/scripts/db/promote-single-migration.sh"
target_version=20261003001200
expected_last=20260709000100
source_commit="$(git -C "$repo_root" rev-parse HEAD)"
target_file="$repo_root/supabase/migrations/${target_version}_normalize_teacher_learning_roster_scope.sql"
target_hash="$(sha256sum "$target_file" | awk '{print $1}')"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/tecescola-promote-test.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/guard-tmp"

eval "$(sed -n '/^safe_cli_failure_class()/,/^}/p' "$script")"
[[ "$(safe_cli_failure_class 'dial tcp 127.0.0.1:1234: connectex: actively refused')" == 'database_connection_refused' ]]
[[ "$(safe_cli_failure_class 'context deadline exceeded while dialing')" == 'database_connection_timeout' ]]
[[ "$(safe_cli_failure_class 'no pg_hba.conf entry: no encryption')" == 'database_access_policy' ]]

ledger="$tmp/ledger"
dry_run="$tmp/dry-run"
printf '%s\n' "$expected_last" > "$ledger"
printf 'Would push migration %s\n' "$target_version" > "$dry_run"

run_guard() {
  SOURCE_ROOT="$repo_root" \
  TARGET_VERSION="$target_version" \
  EXPECTED_REMOTE_LAST="${EXPECTED_REMOTE_LAST_OVERRIDE:-$expected_last}" \
  EXPECTED_SOURCE_COMMIT="$source_commit" \
  EXPECTED_TARGET_SHA256="${EXPECTED_TARGET_SHA256_OVERRIDE:-$target_hash}" \
  PRODUCTION_DB_URL="${PRODUCTION_DB_URL_OVERRIDE:-postgresql://fixture_user:dummy%21secret@fixture.invalid:5432/postgres?sslmode=require}" \
  TMPDIR="$tmp/guard-tmp" \
  REMOTE_LEDGER_FILE="$ledger" \
  DRY_RUN_OUTPUT_FILE="${DRY_RUN_OUTPUT_FILE_OVERRIDE-$dry_run}" \
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
SUPABASE_CLI_BINARY_OVERRIDE='/fixture/supabase.exe' expect_failure

mkdir -p "$tmp/bin"
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
  printf 'Would push migration 20261003001200\n'
else
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
printf '2|20261003001200\n'
MOCK
chmod +x "$tmp/bin/npx" "$tmp/bin/psql"
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
if [[ "$applied" == *dummy* || "$applied" == *fixture_user* ]]; then
  echo "connection credentials leaked into apply output" >&2
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
  SUPABASE_CLI_BINARY_OVERRIDE="$tmp/bin/cli-override" \
  EXPECTED_CLI_EXECUTABLE="$tmp/bin/cli-override" \
  run_guard)"
grep -q '^PROMOTION=APPLIED$' <<< "$applied_override"

mkdir -p "$tmp/cli-root"
applied_windows="$(PATH="$tmp/bin:$PATH" \
  APPLY=1 \
  BACKUP_GATE=PASS \
  CONFIRM_PRODUCTION_WRITE=I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION \
  EXPECT_WINDOWS_WORKDIR=1 \
  EXPECT_WSLENV_FORWARDING=1 \
  SUPABASE_CLI_BINARY_OVERRIDE="$tmp/bin/supabase.exe" \
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
