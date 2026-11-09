#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
migration_file="$repo_root/supabase/migrations/20261108173911_guided_study_v12_automatic_content_validation.sql"
db_container="${PROMOTION_TEST_DB_CONTAINER:-$(docker ps --format '{{.Names}}' | awk '/^supabase_db_/ { print; exit }')}"
[[ -f "$migration_file" ]] || { echo 'Guided Study V12 migration is missing' >&2; exit 1; }
[[ -n "$db_container" ]] || { echo 'Disposable Supabase PostgreSQL container not found' >&2; exit 1; }

first_line="$(head -n 1 "$migration_file" | tr -d '\r')"
last_line="$(tail -n 1 "$migration_file" | tr -d '\r')"
[[ "$first_line" == 'begin;' && "$last_line" == 'commit;' ]] || {
  echo 'V12 migration transaction boundary changed; update the isolated owner-role proof' >&2
  exit 1
}

test_sql="$(mktemp)"
trap 'rm -f -- "$test_sql"' EXIT
{
  cat <<'SQL'
begin;
do $owner_role_fixture_guard$
begin
  if session_user <> 'supabase_admin'
     or current_user <> 'supabase_admin'
     or not coalesce((select rolsuper from pg_catalog.pg_roles where rolname = session_user), false) then
    raise exception 'V12_OWNER_ROLE_FIXTURE_REQUIRES_SUPABASE_ADMIN_SESSION';
  end if;
end;
$owner_role_fixture_guard$;

set role supabase_admin;
alter table public.learning_curriculum_skills owner to supabase_admin;
alter table public.learning_adaptive_content_packs owner to supabase_admin;
alter table public.learning_central_studies_v2_candidates owner to supabase_admin;
alter table public.learning_central_studies_v2_runtime owner to supabase_admin;
alter table public.learning_central_studies_v2_institution_targets owner to supabase_admin;
alter table public.learning_guided_sessions owner to supabase_admin;

-- The full migration has already run in CI. Rewind only its non-idempotent
-- objects inside this transaction so the hosted executor proof can replay it.
-- New V12 functions must be absent, just as they are before a production first
-- apply. CREATE OR REPLACE would otherwise retain the local postgres owner.
drop trigger if exists guided_v12_bncc_lesson_revalidate on public.learning_skill_lessons;
drop trigger if exists guided_v12_bncc_set_revalidate on public.learning_question_sets;
drop trigger if exists guided_v12_bncc_item_revalidate on public.learning_question_set_items;
drop trigger if exists guided_v12_bncc_bank_link_revalidate on public.learning_question_bank_skill_links;
drop trigger if exists guided_v12_bncc_bank_revalidate on public.learning_question_bank;
drop trigger if exists adaptive_content_pack_v12_automatic_validation on public.learning_adaptive_content_packs;
drop trigger if exists central_studies_v2_automatic_validation_v12 on public.learning_central_studies_v2_candidates;
drop trigger if exists guided_session_v12_remove_human_review_claim on public.learning_guided_sessions;

drop function private.integrate_central_studies_v2_candidate_after_insert_v12();
drop function private.validate_adaptive_content_pack_after_change_v12();
drop function private.revalidate_bncc_v4_skill_after_content_change_v12();
drop function private.remove_human_review_claim_from_v12_session();
drop function private.integrate_central_studies_v2_candidate_v12(uuid, text);
drop function private.validate_adaptive_content_pack_v12(uuid);
drop function private.validate_central_studies_v2_candidate_v12(uuid);
drop function private.validate_mapped_bncc_skill_v12(uuid, text, jsonb);
drop function private.validate_bncc_high_school_skill_v12(uuid, text, jsonb);
drop function private.guided_json_array_length_v12(jsonb);
drop function private.record_guided_content_validation_v12(text, text, text, text, text, jsonb, jsonb);
drop function public.get_guided_study_v12_validation_summary();

drop function public.start_guided_study_v11(uuid);
alter function public.start_guided_study_v11_pre_v12(uuid) rename to start_guided_study_v11;

alter role postgres nosuperuser;
set role postgres;
SQL
  tail -n +2 "$migration_file" | head -n -1 | sed 's/\r$//'
  cat <<'SQL'
do $owner_role_new_function_assertion$
declare
  wrong_owner text;
begin
  select string_agg(format('%s=%s', function_row.oid::regprocedure, owner_role.rolname), ', ' order by function_row.oid::regprocedure::text)
    into wrong_owner
    from pg_catalog.pg_proc function_row
    join pg_catalog.pg_namespace schema_row on schema_row.oid = function_row.pronamespace
    join pg_catalog.pg_roles owner_role on owner_role.oid = function_row.proowner
   where ((schema_row.nspname = 'private' and function_row.proname in (
            'record_guided_content_validation_v12', 'validate_central_studies_v2_candidate_v12',
            'guided_json_array_length_v12', 'validate_bncc_high_school_skill_v12',
            'validate_mapped_bncc_skill_v12',
            'revalidate_bncc_v4_skill_after_content_change_v12', 'validate_adaptive_content_pack_v12',
            'validate_adaptive_content_pack_after_change_v12', 'integrate_central_studies_v2_candidate_v12',
            'integrate_central_studies_v2_candidate_after_insert_v12', 'remove_human_review_claim_from_v12_session'
          ))
      or (schema_row.nspname = 'public' and function_row.proname in (
            'start_guided_study_v11', 'get_guided_study_v12_validation_summary'
          )))
     and owner_role.rolname <> 'supabase_admin';

  if wrong_owner is not null then
    raise exception 'GUIDED_STUDY_V12_NEW_FUNCTION_OWNER_MISMATCH:%', wrong_owner;
  end if;
end;
$owner_role_new_function_assertion$;

do $owner_role_restore_assertion$
begin
  if session_user <> 'supabase_admin' or current_user <> 'postgres' then
    raise exception 'GUIDED_STUDY_V12_EXECUTOR_ROLE_NOT_RESTORED';
  end if;
end;
$owner_role_restore_assertion$;
rollback;
SQL
} > "$test_sql"

docker exec -i "$db_container" psql -X -U supabase_admin -d postgres -v ON_ERROR_STOP=1 \
  -v VERBOSITY=verbose < "$test_sql"
echo 'GUIDED_STUDY_V12_HOSTED_OWNER_ROLE_DDL_AND_LEDGER_ROLE_RESTORE=PASS'
