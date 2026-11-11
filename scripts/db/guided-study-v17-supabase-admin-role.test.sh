#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
migration_file="$repo_root/supabase/migrations/20261111000300_guided_study_v17_em1_subject_strands.sql"
contract_file="$repo_root/supabase/tests/guidedStudyV17Content.database.sql"
db_container="${PROMOTION_TEST_DB_CONTAINER:-$(docker ps --format '{{.Names}}' | awk '/^supabase_db_/ { print; exit }')}"
test_tmp="$(mktemp -d "${TMPDIR:-/tmp}/tecescola-v17-role.XXXXXX")"
promoter_source="$test_tmp/promoter-source"
promoter_source_added=0

[[ -f "$migration_file" ]] || { echo 'Guided Study V17 migration is missing' >&2; exit 1; }
[[ -f "$contract_file" ]] || { echo 'Guided Study V17 database contract is missing' >&2; exit 1; }
[[ -n "$db_container" ]] || { echo 'Disposable Supabase PostgreSQL container not found' >&2; exit 1; }

# Match the production executor and mixed ownership relevant to V17 in CI only.
docker exec -i "$db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
DO $role_fixture$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin WITH LOGIN SUPERUSER PASSWORD 'ci-v17-role-test-only';
  ELSE
    ALTER ROLE supabase_admin WITH LOGIN SUPERUSER PASSWORD 'ci-v17-role-test-only';
  END IF;
END;
$role_fixture$;
SQL

restore_fixture_owners() {
  docker exec -i "$db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE public.learning_question_sets OWNER TO postgres;
ALTER TABLE public.learning_question_set_items OWNER TO postgres;
ALTER FUNCTION private.validate_mapped_bncc_skill_v12(uuid, text, jsonb) OWNER TO postgres;
ALTER FUNCTION private.validate_bncc_high_school_skill_v12(uuid, text, jsonb) OWNER TO postgres;
ALTER FUNCTION private.validate_adaptive_content_pack_v12(uuid) OWNER TO postgres;
ALTER FUNCTION private.validate_adaptive_content_pack_after_change_v12() OWNER TO postgres;
ALTER FUNCTION private.revalidate_bncc_v4_skill_after_content_change_v12() OWNER TO postgres;
SQL
}
cleanup_test_fixture() {
  restore_fixture_owners
  if [[ "$promoter_source_added" == '1' ]]; then
    git -C "$repo_root" worktree remove --force "$promoter_source"
  fi
  rm -rf -- "$test_tmp"
}
trap cleanup_test_fixture EXIT

cli_log="$test_tmp/supabase-cli.log"
cli_wrapper="$test_tmp/supabase-cli"
cat > "$cli_wrapper" <<'SH'
#!/usr/bin/env bash
set -o pipefail
npx supabase "$@" 2>&1 | tee "$PROMOTION_TEST_CLI_LOG" >&2
SH
chmod 700 "$cli_wrapper"

docker exec -i "$db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE public.learning_question_sets OWNER TO supabase_admin;
ALTER TABLE public.learning_question_set_items OWNER TO supabase_admin;
ALTER FUNCTION private.validate_mapped_bncc_skill_v12(uuid, text, jsonb) OWNER TO supabase_admin;
ALTER FUNCTION private.validate_bncc_high_school_skill_v12(uuid, text, jsonb) OWNER TO supabase_admin;
ALTER FUNCTION private.validate_adaptive_content_pack_v12(uuid) OWNER TO supabase_admin;
ALTER FUNCTION private.validate_adaptive_content_pack_after_change_v12() OWNER TO supabase_admin;
ALTER FUNCTION private.revalidate_bncc_v4_skill_after_content_change_v12() OWNER TO supabase_admin;
SQL

role_identity="$(docker exec -i "$db_container" psql -X -q -A -t -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
SET SESSION AUTHORIZATION supabase_admin;
SELECT session_user || '|' || current_user || '|' || coalesce((
  SELECT rolsuper::text FROM pg_catalog.pg_roles WHERE rolname = current_user
), 'false');
SQL
)"
[[ "$role_identity" == 'supabase_admin|supabase_admin|true' ]] || {
  printf 'V17_SUPABASE_ADMIN_IDENTITY_MISMATCH=%s\n' "$role_identity" >&2
  exit 1
}

apply_v17_as_supabase_admin() {
  {
    printf 'SET SESSION AUTHORIZATION supabase_admin;\n'
    cat "$migration_file"
  } | docker exec -i "$db_container" psql -X -U postgres -d postgres \
    -v ON_ERROR_STOP=1 -v VERBOSITY=verbose
}

database_identity="$(docker exec -i "$db_container" psql -X -q -A -t -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "select system_identifier::text || '|' || current_database() from pg_catalog.pg_control_system()")"
status_output="$(npx supabase status -o env)"
database_url="$(SUPABASE_STATUS_ENV="$status_output" node -e '
const env = process.env.SUPABASE_STATUS_ENV || "";
const line = env.split(/\r?\n/).find((entry) => entry.startsWith("DB_URL="));
if (!line) throw new Error("Supabase local DB_URL is unavailable");
let raw = line.slice("DB_URL=".length).trim();
if ((raw.startsWith("\"") && raw.endsWith("\"")) || (raw.startsWith("\x27") && raw.endsWith("\x27"))) raw = raw.slice(1, -1);
const url = new URL(raw);
if (!new Set(["postgres:", "postgresql:"]).has(url.protocol) || !["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
  throw new Error("Refusing non-local Supabase database URL in role reproduction");
}
url.username = "supabase_admin";
url.password = "ci-v17-role-test-only";
url.searchParams.set("sslmode", "disable");
process.stdout.write(url.toString());
')"
migration_sha="$(sed 's/\r$//' "$migration_file" | sha256sum | awk '{print $1}')"
source_commit="$(git -C "$repo_root" rev-parse HEAD)"
git -C "$repo_root" worktree add --detach "$promoter_source" "$source_commit" >/dev/null
promoter_source_added=1
promoter_output="$(
  # actions/checkout omits .git; give only the promoter subprocess the canonical origin.
  GIT_CONFIG_COUNT=1 \
  GIT_CONFIG_KEY_0=remote.origin.url \
  GIT_CONFIG_VALUE_0=https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git \
  PROMOTION_TEST_CLI_LOG="$cli_log" \
  SOURCE_ROOT="$promoter_source" \
  TARGET_VERSION=20261111000300 \
  EXPECTED_REMOTE_LAST=20261111000200 \
  EXPECTED_SOURCE_COMMIT="$source_commit" \
  EXPECTED_TARGET_SHA256="$migration_sha" \
  PRODUCTION_DB_URL="$database_url" \
  TECESCOLA_VERIFIED_DATABASE_IDENTITY="$database_identity" \
  DESTRUCTIVE_SQL_REVIEW_SHA256="$migration_sha" \
  CONFIRM_PRODUCTION_WRITE=I_CONFIRM_SELECTIVE_PRODUCTION_MIGRATION \
  PYTHON3_BIN=python3 \
  PROMOTE_SINGLE_MIGRATION_CLI_BINARY="$cli_wrapper" \
  APPLY=1 \
    bash "$repo_root/scripts/db/promote-single-migration.sh" 2>&1
)" || {
  printf '%s\n' "$promoter_output" >&2
  if [[ -s "$cli_log" ]]; then
    grep -Ei 'error|permission denied|SQLSTATE|failed to apply|migration' "$cli_log" | head -n 40 >&2 || true
  fi
  exit 1
}
printf '%s\n' "$promoter_output" | grep -Fxq 'PROMOTION=APPLIED'
printf '%s\n' "$promoter_output" | grep -Fxq 'DRY_RUN_PENDING_VERSION=20261111000300'
echo 'GUIDED_STUDY_V17_OFFICIAL_PROMOTER_AS_SUPABASE_ADMIN=PASS'

apply_v17_as_supabase_admin
echo 'GUIDED_STUDY_V17_IDEMPOTENT_REAPPLY_AS_SUPABASE_ADMIN=PASS'

docker exec -i "$db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 < "$contract_file"
cleanup_test_fixture
trap - EXIT
echo 'GUIDED_STUDY_V17_PRODUCTION_ROLE_AND_CONTENT_CONTRACT=PASS'
