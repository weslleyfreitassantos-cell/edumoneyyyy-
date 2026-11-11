#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
migration_file="$repo_root/supabase/migrations/20261111000300_guided_study_v17_em1_subject_strands.sql"
contract_file="$repo_root/supabase/tests/guidedStudyV17Content.database.sql"
db_container="${PROMOTION_TEST_DB_CONTAINER:-$(docker ps --format '{{.Names}}' | awk '/^supabase_db_/ { print; exit }')}"
executor_role="guided_study_v17_executor_${RANDOM}_$$"
test_tmp="$(mktemp -d "${TMPDIR:-/tmp}/tecescola-v17-role.XXXXXX")"
chmod 700 "$test_tmp"
promoter_source="$test_tmp/promoter-source"
supabase_admin_restore_sql="$test_tmp/restore-supabase-admin.sql"
supabase_admin_existed=false

[[ -f "$migration_file" ]] || { echo 'Guided Study V17 migration is missing' >&2; exit 1; }
[[ -f "$contract_file" ]] || { echo 'Guided Study V17 database contract is missing' >&2; exit 1; }
[[ -n "$db_container" ]] || { echo 'Disposable Supabase PostgreSQL container not found' >&2; exit 1; }

docker exec -i "$db_container" psql -X -q -A -t -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "SELECT format('ALTER ROLE supabase_admin %s %s PASSWORD %L;', CASE WHEN rolsuper THEN 'SUPERUSER' ELSE 'NOSUPERUSER' END, CASE WHEN rolcanlogin THEN 'LOGIN' ELSE 'NOLOGIN' END, rolpassword) FROM pg_catalog.pg_authid WHERE rolname = 'supabase_admin'" \
  > "$supabase_admin_restore_sql"
chmod 600 "$supabase_admin_restore_sql"
if [[ -s "$supabase_admin_restore_sql" ]]; then
  supabase_admin_existed=true
fi

restore_supabase_admin_role() {
  if [[ "$supabase_admin_existed" == true ]]; then
    docker exec -i "$db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 < "$supabase_admin_restore_sql"
  else
    docker exec -i "$db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
      -c 'DROP ROLE IF EXISTS supabase_admin'
  fi
}

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
drop_executor_role() {
  local role_exists
  role_exists="$(docker exec -i "$db_container" psql -X -A -t -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c "SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '$executor_role')")"
  [[ "$role_exists" == 't' ]] || return 0
  docker exec -i "$db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c "REVOKE EXECUTE ON FUNCTION private.validate_bncc_high_school_skill_v12(uuid, text, jsonb) FROM $executor_role; REVOKE supabase_admin FROM $executor_role; DROP ROLE $executor_role" >/dev/null
}
restore_fixture_ledger() {
  docker exec -i "$db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
DO $restore_ledger$
BEGIN
  IF to_regclass('supabase_migrations._ci_guided_study_v17_saved') IS NOT NULL THEN
    EXECUTE $restore_sql$
      INSERT INTO supabase_migrations.schema_migrations(version, statements, name)
      SELECT version, statements, name
      FROM supabase_migrations._ci_guided_study_v17_saved
      ON CONFLICT (version) DO UPDATE
      SET statements = EXCLUDED.statements,
          name = EXCLUDED.name
    $restore_sql$;
    EXECUTE 'DROP TABLE supabase_migrations._ci_guided_study_v17_saved';
  END IF;
END;
$restore_ledger$;
SQL
}
cleanup_test_fixture() {
  local cleanup_status=0
  restore_fixture_owners || cleanup_status=$?
  drop_executor_role || cleanup_status=$?
  restore_fixture_ledger || cleanup_status=$?
  restore_supabase_admin_role || cleanup_status=$?
  rm -rf -- "$test_tmp"
  return "$cleanup_status"
}
trap cleanup_test_fixture EXIT

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

# Model the hosted CLI's non-owner current role while preserving the authenticated
# supabase_admin session. EXECUTE is intentionally present; replacing the
# SECURITY DEFINER function must still fail until the owner role is selected.
docker exec -i "$db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 <<SQL
CREATE ROLE $executor_role NOLOGIN NOSUPERUSER NOINHERIT;
GRANT supabase_admin TO $executor_role;
GRANT EXECUTE ON FUNCTION private.validate_bncc_high_school_skill_v12(uuid, text, jsonb) TO $executor_role;
SQL

set +e
role_denial_output="$(
  {
    printf '%s\n' \
      'SET SESSION AUTHORIZATION supabase_admin;' \
      'BEGIN;' \
      "SET ROLE $executor_role;" \
      "SELECT session_user || '|' || current_user || '|' || (SELECT rolsuper::text FROM pg_catalog.pg_roles WHERE rolname = current_user) || '|' || (SELECT pg_catalog.pg_get_userbyid(proowner) FROM pg_catalog.pg_proc WHERE oid = 'private.validate_bncc_high_school_skill_v12(uuid,text,jsonb)'::regprocedure) || '|' || pg_catalog.has_function_privilege(current_user, 'private.validate_bncc_high_school_skill_v12(uuid,text,jsonb)'::regprocedure, 'EXECUTE');" \
      "SELECT pg_catalog.pg_get_functiondef('private.validate_bncc_high_school_skill_v12(uuid,text,jsonb)'::regprocedure) \\gexec" \
      'ROLLBACK;'
  } | docker exec -i "$db_container" psql -X -U postgres -d postgres \
    -v ON_ERROR_STOP=1 -v VERBOSITY=verbose 2>&1
)"
role_denial_status=$?
set -e
expected_denial_context="supabase_admin|$executor_role|false|supabase_admin|true"
[[ "$role_denial_status" -ne 0 ]] &&
  [[ "$role_denial_output" == *"$expected_denial_context"* ]] &&
  [[ "$role_denial_output" == *"42501"* ]] &&
  [[ "$role_denial_output" == *'must be owner of function validate_bncc_high_school_skill_v12'* ]] || {
    printf 'V17_EXPECTED_OWNER_DENIAL_NOT_REPRODUCED status=%s\n%s\n' "$role_denial_status" "$role_denial_output" >&2
    exit 1
  }
echo 'GUIDED_STUDY_V17_NON_OWNER_CREATE_OR_REPLACE_42501_REPRODUCED=PASS'

owner_transition_output="$(
  {
    printf '%s\n' \
      'SET SESSION AUTHORIZATION supabase_admin;' \
      'BEGIN;' \
      "SET ROLE $executor_role;" \
      'SET LOCAL ROLE supabase_admin;' \
      "SELECT session_user || '|' || current_user || '|' || (SELECT rolsuper::text FROM pg_catalog.pg_roles WHERE rolname = current_user);" \
      "SELECT pg_catalog.pg_get_functiondef('private.validate_bncc_high_school_skill_v12(uuid,text,jsonb)'::regprocedure) \\gexec" \
      'ROLLBACK;'
  } | docker exec -i "$db_container" psql -X -U postgres -d postgres \
    -v ON_ERROR_STOP=1 -v VERBOSITY=verbose
)"
[[ "$owner_transition_output" == *'supabase_admin|supabase_admin|true'* ]] || {
  printf 'V17_LOCAL_OWNER_ROLE_TRANSITION_FAILED\n%s\n' "$owner_transition_output" >&2
  exit 1
}
echo 'GUIDED_STUDY_V17_SET_LOCAL_OWNER_ROLE_REPLACES_FUNCTION=PASS'

# Production intentionally omits these deferred migrations from its ledger.
# Mirror that ledger shape in CI while retaining the schema they created.
docker exec -i "$db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
DO $validate_ledger$
DECLARE
  expected_count integer;
BEGIN
  SELECT count(*) INTO expected_count
  FROM supabase_migrations.schema_migrations
  WHERE version IN ('20261004000100', '20261004000200', '20261004000300');
  IF expected_count <> 3 THEN
    RAISE EXCEPTION 'Expected exactly 3 deferred BNCC ledger rows, found %', expected_count;
  END IF;
  IF to_regclass('supabase_migrations._ci_guided_study_v17_saved') IS NOT NULL THEN
    RAISE EXCEPTION 'A prior V17 ledger fixture was not restored';
  END IF;
END;
$validate_ledger$;
BEGIN;
CREATE TABLE supabase_migrations._ci_guided_study_v17_saved AS
SELECT version, statements, name
FROM supabase_migrations.schema_migrations
WHERE version IN ('20261004000100', '20261004000200', '20261004000300');
DELETE FROM supabase_migrations.schema_migrations
WHERE version IN ('20261004000100', '20261004000200', '20261004000300');
COMMIT;
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
git clone --shared --no-checkout "$repo_root" "$promoter_source" >/dev/null
git -C "$promoter_source" checkout --detach "$source_commit" >/dev/null
git -C "$promoter_source" remote set-url origin https://github.com/weslleyfreitassantos-cell/edumoneyyyy-.git
[[ -z "$(git -C "$promoter_source" status --porcelain=v1 --untracked-files=all)" ]]
promoter_output="$(
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

restore_fixture_owners
restore_fixture_ledger
restore_supabase_admin_role

docker exec -i "$db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 < "$contract_file"
rm -rf -- "$test_tmp"
trap - EXIT
echo 'GUIDED_STUDY_V17_PRODUCTION_ROLE_AND_CONTENT_CONTRACT=PASS'
