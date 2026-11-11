#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
migration_file="$repo_root/supabase/migrations/20261111000300_guided_study_v17_em1_subject_strands.sql"
contract_file="$repo_root/supabase/tests/guidedStudyV17Content.database.sql"
db_container="${PROMOTION_TEST_DB_CONTAINER:-$(docker ps --format '{{.Names}}' | awk '/^supabase_db_/ { print; exit }')}"

[[ -f "$migration_file" ]] || { echo 'Guided Study V17 migration is missing' >&2; exit 1; }
[[ -f "$contract_file" ]] || { echo 'Guided Study V17 database contract is missing' >&2; exit 1; }
[[ -n "$db_container" ]] || { echo 'Disposable Supabase PostgreSQL container not found' >&2; exit 1; }

# Match the production executor and mixed ownership relevant to V17 in CI only.
docker exec -i "$db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
DO $role_fixture$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin WITH LOGIN SUPERUSER;
  ELSE
    ALTER ROLE supabase_admin WITH LOGIN SUPERUSER;
  END IF;
END;
$role_fixture$;

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

apply_v17_as_supabase_admin
echo 'GUIDED_STUDY_V17_FIRST_APPLY_AS_SUPABASE_ADMIN=PASS'
apply_v17_as_supabase_admin
echo 'GUIDED_STUDY_V17_IDEMPOTENT_REAPPLY_AS_SUPABASE_ADMIN=PASS'

docker exec -i "$db_container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 < "$contract_file"
npx supabase migration repair --local --status applied 20261111000300
echo 'GUIDED_STUDY_V17_PRODUCTION_ROLE_AND_CONTENT_CONTRACT=PASS'
