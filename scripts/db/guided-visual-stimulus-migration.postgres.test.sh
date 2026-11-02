#!/usr/bin/env bash
set -euo pipefail

: "${PROMOTION_TEST_DB_CONTAINER:?PROMOTION_TEST_DB_CONTAINER must name the disposable PostgreSQL container}"

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
migration="$root_dir/supabase/migrations/20261102000100_bncc_guided_visual_stimulus_v1.sql"
test -f "$migration"

psql_test() {
  docker exec -i "$PROMOTION_TEST_DB_CONTAINER" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
}

security_signature() {
  psql_test -At <<'SQL'
select string_agg(
  concat_ws('|', p.proname, p.proowner::regrole::text, p.prorettype::regtype::text,
    p.prosecdef::text, coalesce(p.proconfig::text, '<null>'), coalesce(p.proacl::text, '<default>')),
  E'\n' order by p.proname
)
from pg_proc p
where p.oid in (
  'public.get_guided_learning_step_v4(uuid)'::regprocedure::oid,
  'public.get_guided_learning_step_v4_legacy_v9(uuid)'::regprocedure::oid
);
SQL
}

psql_test <<'SQL'
drop function if exists public.get_guided_learning_step_v4(uuid);
drop function if exists public.get_guided_learning_step_v4_legacy_v9(uuid);

create function public.get_guided_learning_step_v4(p_step_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object('position', item.position)
    from (values (1)) as item(position)
    cross join (select '{"visual_stimulus":{"items":[{"src":"/learning/fixture.svg","alt":"Fixture"}]}}'::jsonb as metadata) as question
$$;

create function public.get_guided_learning_step_v4_legacy_v9(p_step_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object('position', item.position)
    from (values (2)) as item(position)
    cross join (select '{"visual_stimulus":{"items":[{"src":"/learning/legacy-fixture.svg","alt":"Legacy fixture"}]}}'::jsonb as metadata) as question
$$;

revoke all on function public.get_guided_learning_step_v4(uuid) from public, anon;
revoke all on function public.get_guided_learning_step_v4_legacy_v9(uuid) from public, anon;
grant execute on function public.get_guided_learning_step_v4(uuid) to authenticated;
grant execute on function public.get_guided_learning_step_v4_legacy_v9(uuid) to authenticated;
SQL

assert_patched_payloads() {
  psql_test <<'SQL'
do $$
declare
  function_id regprocedure;
  actual jsonb;
begin
  foreach function_id in array array[
    'public.get_guided_learning_step_v4(uuid)'::regprocedure,
    'public.get_guided_learning_step_v4_legacy_v9(uuid)'::regprocedure
  ] loop
    if not has_function_privilege('authenticated', function_id, 'EXECUTE')
       or has_function_privilege('anon', function_id, 'EXECUTE') then
      raise exception 'DISPOSABLE_VISUAL_STIMULUS_GRANTS_CHANGED';
    end if;
    if (select proowner::regrole::text from pg_proc where oid = function_id::oid) <> 'postgres'
       or not (select prosecdef from pg_proc where oid = function_id::oid)
       or not exists (
         select 1 from pg_proc p, unnest(p.proconfig) setting
          where p.oid = function_id::oid and setting = 'search_path=public'
       ) then
      raise exception 'DISPOSABLE_VISUAL_STIMULUS_SECURITY_SHAPE_CHANGED';
    end if;
  end loop;

  actual := public.get_guided_learning_step_v4('00000000-0000-0000-0000-000000000001');
  if actual #> '{visual_stimulus,items,0,src}' is distinct from to_jsonb('/learning/fixture.svg'::text) then
    raise exception 'DISPOSABLE_VISUAL_STIMULUS_CURRENT_PAYLOAD_MISSING';
  end if;
  actual := public.get_guided_learning_step_v4_legacy_v9('00000000-0000-0000-0000-000000000002');
  if actual #> '{visual_stimulus,items,0,src}' is distinct from to_jsonb('/learning/legacy-fixture.svg'::text) then
    raise exception 'DISPOSABLE_VISUAL_STIMULUS_LEGACY_PAYLOAD_MISSING';
  end if;
end;
$$;
SQL
}

security_before_apply="$(security_signature)"
psql_test < "$migration"
security_after_apply="$(security_signature)"
if [[ "$security_before_apply" != "$security_after_apply" ]]; then
  echo 'Function owner, return type, SECURITY DEFINER, search_path, or ACL changed.' >&2
  exit 1
fi
assert_patched_payloads

# Running the candidate again must accept only the complete patched payload.
security_before_reapply="$(security_signature)"
psql_test < "$migration"
security_after_reapply="$(security_signature)"
if [[ "$security_before_reapply" != "$security_after_reapply" ]]; then
  echo 'Idempotent reapplication changed function security metadata.' >&2
  exit 1
fi
assert_patched_payloads

# A mismatch in the second function must be detected before the first is replaced.
psql_test <<'SQL'
create or replace function public.get_guided_learning_step_v4(p_step_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object('position', item.position)
    from (values (1)) as item(position)
    cross join (select '{"visual_stimulus":{"items":[{"src":"/learning/fixture.svg","alt":"Fixture"}]}}'::jsonb as metadata) as question
$$;

create or replace function public.get_guided_learning_step_v4_legacy_v9(p_step_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object('position', item.position) || jsonb_build_object('position', item.position)
    from (values (2)) as item(position)
    cross join (select '{"visual_stimulus":{"items":[{"src":"/learning/legacy-fixture.svg","alt":"Legacy fixture"}]}}'::jsonb as metadata) as question
$$;
SQL

before_first="$(psql_test -Atc "select pg_get_functiondef('public.get_guided_learning_step_v4(uuid)'::regprocedure)")"
if migration_error="$(psql_test 2>&1 < "$migration")"; then
  echo 'Expected the migration to reject a duplicated legacy clause.' >&2
  exit 1
fi
if [[ "$migration_error" != *BNCC_GUIDED_VISUAL_STIMULUS_PATCH_MISMATCH* ]]; then
  printf 'Unexpected migration failure in disposable PostgreSQL: %s\n' "$migration_error" >&2
  exit 1
fi
after_first="$(psql_test -Atc "select pg_get_functiondef('public.get_guided_learning_step_v4(uuid)'::regprocedure)")"
if [[ "$before_first" != "$after_first" ]]; then
  echo 'The first function changed although the second target failed validation.' >&2
  exit 1
fi

echo 'guided visual stimulus migration: disposable PostgreSQL apply, idempotency, grants, security metadata, payloads, and prevalidation atomicity PASS'
