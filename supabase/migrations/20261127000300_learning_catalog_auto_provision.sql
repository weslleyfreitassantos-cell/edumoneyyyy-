-- Keep the institutional learning catalog enabled by default for every
-- operational institution, including institutions created after the initial
-- catalog migration.

create or replace function private.provision_tec_learning_releases(
  p_institution_id uuid default null,
  p_course_code text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.tec_english_course_releases(
    course_code, content_version, institution_id, enabled,
    updated_by_profile_id, updated_by_id_snapshot, updated_by_name,
    updated_by_email, updated_at
  )
  select
    course.course_code,
    course.content_version,
    institution.id,
    true,
    null,
    gen_random_uuid(),
    'Provisionamento automático do catálogo institucional',
    'system@grupotec.dev.br',
    now()
  from public.tec_english_courses course
  cross join public.institutions institution
  join public.accounts account on account.id = institution.account_id
  where not course.is_test_fixture
    and course.publication_status = 'PUBLISHED'
    and institution.active is true
    and institution.suspended_at is null
    and account.status = 'ACTIVE'
    and public.is_institution_operational(institution.id)
    and (p_institution_id is null or institution.id = p_institution_id)
    and (p_course_code is null or course.course_code = p_course_code)
  on conflict (course_code, institution_id) do nothing;
$$;
revoke all on function private.provision_tec_learning_releases(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.provision_tec_learning_releases_on_institution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.provision_tec_learning_releases(new.id, null);
  return new;
end;
$$;

create or replace function private.provision_tec_learning_releases_on_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'ACTIVE' then
    perform private.provision_tec_learning_releases(null, null);
  end if;
  return new;
end;
$$;

create or replace function private.provision_tec_learning_releases_on_course()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.publication_status = 'PUBLISHED' and not new.is_test_fixture then
    perform private.provision_tec_learning_releases(null, new.course_code);
  end if;
  return new;
end;
$$;

drop trigger if exists provision_tec_learning_releases_after_institution
  on public.institutions;
create trigger provision_tec_learning_releases_after_institution
  after insert or update of active, suspended_at, account_id on public.institutions
  for each row execute function private.provision_tec_learning_releases_on_institution();

drop trigger if exists provision_tec_learning_releases_after_account
  on public.accounts;
create trigger provision_tec_learning_releases_after_account
  after insert or update of status on public.accounts
  for each row execute function private.provision_tec_learning_releases_on_account();

drop trigger if exists provision_tec_learning_releases_after_course
  on public.tec_english_courses;
create trigger provision_tec_learning_releases_after_course
  after insert or update of publication_status, is_test_fixture on public.tec_english_courses
  for each row execute function private.provision_tec_learning_releases_on_course();

comment on function private.provision_tec_learning_releases(uuid, text) is
  'Automatically enables published non-test learning courses for every operational institution. Explicit disabled release rows remain disabled.';
