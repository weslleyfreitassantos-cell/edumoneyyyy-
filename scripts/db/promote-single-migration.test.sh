#!/usr/bin/env bash
set -euo pipefail

project_root="${PROMOTION_TEST_PROJECT_ROOT:-$(git rev-parse --show-toplevel)}"
repo_root="$project_root"
policy="$project_root/scripts/db/promote-single-migration-policy-v14.sh"
risk_tool="$project_root/scripts/db/migration-release-risk.py"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/tecescola-release-policy.XXXXXX")"
trap 'rm -rf -- "$tmp"' EXIT

abort() {
  printf 'POLICY_ABORTED=%s\n' "$1" >&2
  exit 1
}

expect_rejected() {
  local label="$1"
  shift
  if ("$@") >"$tmp/$label.out" 2>&1; then
    printf 'Expected policy rejection: %s\n' "$label" >&2
    exit 1
  fi
}

source "$policy"
promoter_dir="$project_root/scripts/db"

backup_exception='legacy-value'
BACKUP_GATE=FAIL BACKUP_EXCEPTION_PR=459 BACKUP_EXCEPTION_BACKUP_FILE="$tmp/missing" apply_release_backup_policy
[[ "$RELEASE_BACKUP_POLICY" == 'NOT_REQUIRED' ]]
[[ "$backup_exception" == 'NOT_REQUIRED' ]]

TECESCOLA_VERIFIED_DATABASE_IDENTITY='123456|promoter_test' \
  database_identity='123456|promoter_test' validate_target_database_identity
expect_rejected wrong_database_identity env TECESCOLA_VERIFIED_DATABASE_IDENTITY='123456|promoter_test' \
  bash -c 'source "$1"; repo_root=x; expected_source_commit=x; abort(){ exit 1; }; database_identity="999999|promoter_test"; validate_target_database_identity' _ "$policy"

safe_sql="$tmp/safe.sql"
comment_sql="$tmp/comment.sql"
quoted_comment_sql="$tmp/quoted-comment.sql"
destructive_sql="$tmp/destructive.sql"
printf 'create table public.release_probe (id integer primary key);\n' > "$safe_sql"
printf '%s\n' '/* outer /* DROP TABLE and UPDATE are comments */ still a comment */' 'select 1;' > "$comment_sql"
printf '%s\n' "select E'-- this is string content, not a comment" "UPDATE public.release_probe set id = 2';" > "$quoted_comment_sql"
printf 'drop table public.release_probe;\n' > "$destructive_sql"
[[ "$(python3 "$risk_tool" "$safe_sql")" == 'SAFE' ]]
[[ "$(python3 "$risk_tool" "$comment_sql")" == 'SAFE' ]]
[[ "$(python3 "$risk_tool" "$quoted_comment_sql")" == 'REVIEW_REQUIRED' ]]
[[ "$(python3 "$risk_tool" "$destructive_sql")" == 'REVIEW_REQUIRED' ]]

target_file="$safe_sql"
actual_target_sha256="$(sha256sum "$safe_sql" | awk '{print $1}')"
python3_bin="$(command -v python3)"
validate_destructive_sql_review >/dev/null

target_file="$destructive_sql"
actual_target_sha256="$(sha256sum "$destructive_sql" | awk '{print $1}')"
expect_rejected missing_destructive_review env -u DESTRUCTIVE_SQL_REVIEW_SHA256 \
  bash -c 'source "$1"; abort(){ exit 1; }; promoter_dir="$2"; python3_bin="$(command -v python3)"; target_file="$3"; actual_target_sha256="$4"; validate_destructive_sql_review' \
  _ "$policy" "$repo_root/scripts/db" "$destructive_sql" "$actual_target_sha256"
DESTRUCTIVE_SQL_REVIEW_SHA256=wrong
expect_rejected mismatched_destructive_review bash -c \
  'source "$1"; abort(){ exit 1; }; promoter_dir="$2"; python3_bin="$(command -v python3)"; target_file="$3"; actual_target_sha256="$4"; DESTRUCTIVE_SQL_REVIEW_SHA256=wrong; validate_destructive_sql_review' \
  _ "$policy" "$repo_root/scripts/db" "$destructive_sql" "$actual_target_sha256"
DESTRUCTIVE_SQL_REVIEW_SHA256="$actual_target_sha256"
review_output="$(validate_destructive_sql_review)"
grep -Fxq 'DESTRUCTIVE_SQL_REVIEW=APPROVED_FOR_TARGET_SHA256' <<< "$review_output"

CONFIRM_PRODUCTION_WRITE=I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION
target_file="$safe_sql"
actual_target_sha256="$(sha256sum "$safe_sql" | awk '{print $1}')"
authorize_output="$(authorize_production_write)"
grep -Fxq 'PRODUCTION_WRITE_AUTHORIZATION=APPROVED' <<< "$authorize_output"

fixture="$tmp/source"
mkdir -p "$fixture"
git -C "$fixture" init -q
git -C "$fixture" config user.name 'Release policy test'
git -C "$fixture" config user.email 'release-policy@example.invalid'
printf 'committed fixture\n' > "$fixture/file.txt"
git -C "$fixture" add file.txt
git -C "$fixture" commit -q -m 'clean source fixture'
git -C "$fixture" remote add origin 'https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git'
repo_root="$fixture"
expected_source_commit="$(git -C "$fixture" rev-parse HEAD)"
validate_release_source
printf 'uncommitted\n' >> "$fixture/file.txt"
expect_rejected dirty_source bash -c \
  'source "$1"; abort(){ exit 1; }; repo_root="$2"; expected_source_commit="$3"; validate_release_source' \
  _ "$policy" "$fixture" "$expected_source_commit"

grep -Fq 'source "${promoter_dir}/promote-single-migration-policy-v14.sh"' \
  "$project_root/scripts/db/promote-single-migration.sh"
! grep -Fq "printf 'BACKUP_GATE=" "$project_root/scripts/db/promote-single-migration.sh"
! grep -Eq '^[[:space:]]*validate_backup_gate([[:space:]]|$)' "$project_root/scripts/db/promote-single-migration.sh"

printf 'PROMOTE_SINGLE_MIGRATION_POLICY_V14=PASS\n'
