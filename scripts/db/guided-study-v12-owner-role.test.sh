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
drop trigger if exists guided_v12_bncc_lesson_revalidate on public.learning_skill_lessons;
drop trigger if exists guided_v12_bncc_set_revalidate on public.learning_question_sets;
drop trigger if exists guided_v12_bncc_item_revalidate on public.learning_question_set_items;
drop trigger if exists guided_v12_bncc_bank_link_revalidate on public.learning_question_bank_skill_links;
drop trigger if exists guided_v12_bncc_bank_revalidate on public.learning_question_bank;
drop function public.start_guided_study_v11(uuid);
alter function public.start_guided_study_v11_pre_v12(uuid) rename to start_guided_study_v11;

alter role postgres nosuperuser;
set role postgres;
SQL
  tail -n +2 "$migration_file" | head -n -1 | sed 's/\r$//'
  cat <<'SQL'
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
