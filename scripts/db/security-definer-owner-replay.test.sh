#!/usr/bin/env bash
set -euo pipefail

db_container="${PROMOTION_TEST_DB_CONTAINER:-$(docker ps --format '{{.Names}}' | awk '/^supabase_db_/ { print; exit }')}"
[[ -n "$db_container" ]] || { echo 'Disposable Supabase PostgreSQL container not found' >&2; exit 1; }

docker exec -i "$db_container" psql -X -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <<'SQL'
begin;
do $owner_probe_role_guard$
begin
  if session_user <> 'supabase_admin'
     or current_user <> 'supabase_admin'
     or not coalesce((select rolsuper from pg_catalog.pg_roles where rolname = current_user), false) then
    raise exception 'OWNER_REPLAY_PROBE_REQUIRES_SUPERUSER_SUPABASE_ADMIN';
  end if;
end;
$owner_probe_role_guard$;

create role guided_v12_owner_probe nologin nosuperuser;
create schema guided_v12_owner_probe authorization supabase_admin;
create table guided_v12_owner_probe.protected_rows(value integer not null);
insert into guided_v12_owner_probe.protected_rows values (0);
grant usage, create on schema guided_v12_owner_probe to guided_v12_owner_probe;
grant usage on language plpgsql to guided_v12_owner_probe;

set role guided_v12_owner_probe;
create function guided_v12_owner_probe.validate()
returns void language plpgsql security definer set search_path = '' as $$
begin
  update guided_v12_owner_probe.protected_rows set value = value + 1;
end;
$$;
reset role;

set role supabase_admin;
create or replace function guided_v12_owner_probe.validate()
returns void language plpgsql security definer set search_path = '' as $$
begin
  update guided_v12_owner_probe.protected_rows set value = value + 1;
end;
$$;
reset role;

do $owner_preservation_assertion$
declare
  function_owner text;
  denied boolean := false;
begin
  select role_row.rolname into function_owner
    from pg_catalog.pg_proc function_row
    join pg_catalog.pg_roles role_row on role_row.oid = function_row.proowner
   where function_row.oid = 'guided_v12_owner_probe.validate()'::regprocedure;
  if function_owner <> 'guided_v12_owner_probe' then
    raise exception 'CREATE_OR_REPLACE_CHANGED_FUNCTION_OWNER:%', function_owner;
  end if;

  begin
    perform guided_v12_owner_probe.validate();
  exception when insufficient_privilege then
    denied := true;
  end;

  if not denied then
    raise exception 'STALE_SECURITY_DEFINER_OWNER_DID_NOT_REPRODUCE_PERMISSION_DENIAL';
  end if;
end;
$owner_preservation_assertion$;

alter function guided_v12_owner_probe.validate() owner to supabase_admin;
select guided_v12_owner_probe.validate();
do $owner_transfer_assertion$
begin
  if (select value from guided_v12_owner_probe.protected_rows) <> 1 then
    raise exception 'OWNER_TRANSFER_DID_NOT_ALLOW_PROTECTED_UPDATE';
  end if;
end;
$owner_transfer_assertion$;
rollback;
SQL

echo 'GUIDED_STUDY_V12_CREATE_OR_REPLACE_OWNER_PRESERVATION=PASS'
