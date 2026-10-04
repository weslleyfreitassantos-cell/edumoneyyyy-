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
  PRODUCTION_DB_URL='postgresql://fixture.invalid/postgres' \
  REMOTE_LEDGER_FILE="$ledger" \
  DRY_RUN_OUTPUT_FILE="$dry_run" \
  "$script"
}

success="$(run_guard)"
grep -q '^REMOTE_MIGRATION_COUNT=1$' <<< "$success"
grep -q '^WORKDIR_MIGRATION_COUNT=2$' <<< "$success"
grep -q '^DRY_RUN_PENDING_COUNT=1$' <<< "$success"
grep -q "^DRY_RUN_PENDING_VERSION=$target_version$" <<< "$success"

expect_failure() {
  if run_guard >/dev/null 2>&1; then
    echo "expected selective promotion guard failure" >&2
    exit 1
  fi
}

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

echo 'PROMOTE_SINGLE_MIGRATION_TEST=PASS'
