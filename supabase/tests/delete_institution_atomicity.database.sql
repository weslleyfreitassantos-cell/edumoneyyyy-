\set ON_ERROR_STOP on

create table public.institutions (
  id uuid primary key,
  account_id uuid not null
);

create table public.learning_attempts (
  id uuid primary key,
  institution_id uuid not null references public.institutions(id) on delete restrict
);

create table public.learning_answers (
  id uuid primary key,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  attempt_id uuid not null references public.learning_attempts(id) on delete restrict
);

create table public.classes (
  id uuid primary key,
  institution_id uuid not null references public.institutions(id) on delete restrict
);

-- This production-shaped relation has no institution_id. It must block the
-- institution delete, and the preceding deletes must roll back with it.
create table public.subject_offerings (
  id uuid primary key,
  class_id uuid not null references public.classes(id) on delete restrict
);

insert into public.institutions (id, account_id) values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002');

insert into public.learning_attempts (id, institution_id) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002');

insert into public.learning_answers (id, institution_id, attempt_id) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001');

insert into public.classes (id, institution_id) values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001');

insert into public.subject_offerings (id, class_id) values
  ('60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001');

do $test$
begin
  if has_function_privilege('anon', 'public.delete_institution_data_atomic_v1(uuid,uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.delete_institution_data_atomic_v1(uuid,uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.delete_institution_data_atomic_v1(uuid,uuid)', 'EXECUTE') then
    raise exception 'RPC grants are broader or narrower than expected';
  end if;

  begin
    perform public.delete_institution_data_atomic_v1(
      '20000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000001'
    );
    raise exception 'Mismatched account/institution scope was accepted';
  exception
    when no_data_found then null;
  end;

  if (select count(*) from public.learning_attempts) <> 2 then
    raise exception 'Scope rejection changed data';
  end if;

  begin
    perform public.delete_institution_data_atomic_v1(
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001'
    );
    raise exception 'RESTRICT dependency did not block deletion';
  exception
    when foreign_key_violation then null;
  end;

  if (select count(*) from public.learning_answers) <> 1
    or (select count(*) from public.learning_attempts where institution_id = '10000000-0000-4000-8000-000000000001') <> 1
    or (select count(*) from public.classes where institution_id = '10000000-0000-4000-8000-000000000001') <> 1
    or (select count(*) from public.institutions where id = '10000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'Blocked deletion left partial changes';
  end if;
end;
$test$;

delete from public.subject_offerings where id = '60000000-0000-4000-8000-000000000001';

set role service_role;
do $test$
declare
  result jsonb;
begin
  result := public.delete_institution_data_atomic_v1(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001'
  );
  if result->>'institutionDeleted' <> 'true'
    or result#>>'{summary,learning_attempts}' <> '1' then
    raise exception 'Unexpected deletion summary: %', result;
  end if;
end;
$test$;
reset role;

do $test$
begin
  if (select count(*) from public.institutions where id = '10000000-0000-4000-8000-000000000001') <> 0
    or (select count(*) from public.learning_attempts where institution_id = '10000000-0000-4000-8000-000000000001') <> 0
    or (select count(*) from public.institutions where id = '10000000-0000-4000-8000-000000000002') <> 1
    or (select count(*) from public.learning_attempts where institution_id = '10000000-0000-4000-8000-000000000002') <> 1 then
    raise exception 'Deletion did not stay within the requested institution';
  end if;
end;
$test$;

drop function public.delete_institution_data_atomic_v1(uuid, uuid);
drop table public.subject_offerings, public.classes, public.learning_answers, public.learning_attempts, public.institutions;

select 'DELETE_INSTITUTION_ATOMICITY=PASS' as result;
