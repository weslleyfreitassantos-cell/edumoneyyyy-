-- Tighten Tec Idiomas institutional releases to operational, unsuspended,
-- non-test institutions. Existing release rows are retained for audit/history.

create or replace function private.tec_english_institution_release_eligible(
  p_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.institutions institution
      join public.accounts account
        on account.id = institution.account_id
     where institution.id = p_institution_id
       and institution.active is true
       and institution.suspended_at is null
       and account.status = 'ACTIVE'
       and public.is_institution_operational(institution.id)
       and pg_catalog.lower(pg_catalog.concat_ws(' ', institution.name, institution.subdomain))
         !~ '(^|[^[:alnum:]])(qa|test|tests|teste|testes|synthetic|sandbox|demo|pilot|preview|staging)([^[:alnum:]]|$)'
       and pg_catalog.strpos(
         pg_catalog.lower(pg_catalog.concat_ws(' ', institution.name, institution.subdomain)),
         'homolog'
       ) = 0
  );
$$;
revoke all on function private.tec_english_institution_release_eligible(uuid)
  from public, anon, authenticated, service_role;
comment on function private.tec_english_institution_release_eligible(uuid) is
  'Tec Idiomas operational release target: active institution, unsuspended, linked ACTIVE account, official operational helper true, and no explicit QA/test marker in institution name or subdomain. Does not change institution/account classification.';

create or replace function private.tec_english_course_available(
  p_institution_id uuid,
  p_course_code text,
  p_test_mode boolean
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.tec_english_courses course
     where course.course_code = p_course_code
       and (
         (p_test_mode and course.is_test_fixture)
         or (
           not p_test_mode and not course.is_test_fixture
           and course.publication_status = 'PUBLISHED'
           and private.tec_idiomas_v8_course_version_allowed(course.course_code, course.content_version)
           and private.tec_idiomas_v8_course_fingerprint_valid(course.course_code, course.content_version)
           and private.tec_english_course_structure_valid_v2(course.course_code, course.content_version)
           and (
             not private.tec_idiomas_v3_course_allowed(course.course_code)
             or private.tec_idiomas_v3_course_content_eligible(course.course_code, course.content_version)
           )
           and exists (
             select 1
               from public.tec_english_course_releases release
               join public.institutions institution
                 on institution.id = release.institution_id
              where release.course_code = course.course_code
                and release.content_version = course.content_version
                and release.institution_id = p_institution_id
                and release.enabled
                and private.tec_english_institution_release_eligible(institution.id)
           )
         )
       )
  );
$$;
revoke all on function private.tec_english_course_available(uuid, text, boolean)
  from public, anon, authenticated;
comment on function private.tec_english_course_available(uuid, text, boolean) is
  'Requires an authorized test fixture or an exact published course release for an operational institution. Existing releases stop granting access when the institution/account becomes ineligible; release history is preserved.';

create or replace function public.get_tec_english_release_targets_v1(
  p_course_code text,
  p_content_version integer,
  p_search text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_targets jsonb;
begin
  if not public.is_platform_super_admin() then
    raise exception 'TEC_ENGLISH_RELEASE_FORBIDDEN' using errcode = '42501';
  end if;
  if not private.tec_idiomas_v8_course_version_allowed(p_course_code, p_content_version)
     or not exists (
       select 1 from public.tec_english_courses course
        where course.course_code = p_course_code
          and course.content_version = p_content_version
          and not course.is_test_fixture
          and course.publication_status = 'PUBLISHED'
          and private.tec_english_course_structure_valid_v2(course.course_code, course.content_version)
          and (not private.tec_idiomas_v3_course_allowed(course.course_code)
            or private.tec_idiomas_v3_course_content_eligible(course.course_code, course.content_version))
     ) then
    raise exception 'TEC_ENGLISH_COURSE_NOT_TECHNICALLY_PUBLISHED' using errcode = '42501';
  end if;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'institution_id', institution.id,
    'institution_name', institution.name,
    'operational_status', institution.account_status,
    'enabled', coalesce(release.enabled and release.content_version = p_content_version, false)
  ) order by institution.name), '[]'::jsonb)
    into v_targets
    from (
      select item.id, item.name, account.status as account_status
        from public.institutions item
        join public.accounts account on account.id = item.account_id
       where private.tec_english_institution_release_eligible(item.id)
         and (nullif(btrim(p_search), '') is null or item.name ilike '%' || btrim(p_search) || '%')
       order by item.name
       limit 200
    ) institution
    left join public.tec_english_course_releases release
      on release.institution_id = institution.id
     and release.course_code = p_course_code;
  return v_targets;
end;
$$;

create or replace function public.set_tec_english_institution_release_v1(
  p_course_code text,
  p_content_version integer,
  p_institution_id uuid,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_name text;
  v_email text;
  v_action text;
  v_existing_enabled boolean;
  v_existing_version integer;
begin
  if not public.is_platform_super_admin() then
    raise exception 'TEC_ENGLISH_RELEASE_FORBIDDEN' using errcode = '42501';
  end if;
  if p_enabled is null or p_course_code is null or p_content_version is null or p_institution_id is null then
    raise exception 'TEC_ENGLISH_RELEASE_INVALID_REQUEST' using errcode = '22023';
  end if;
  if p_enabled and not exists (
    select 1 from public.tec_english_courses course
     where course.course_code = p_course_code
       and course.content_version = p_content_version
       and not course.is_test_fixture
       and course.publication_status = 'PUBLISHED'
       and private.tec_idiomas_v8_course_version_allowed(course.course_code, course.content_version)
       and private.tec_english_course_structure_valid_v2(course.course_code, course.content_version)
       and (not private.tec_idiomas_v3_course_allowed(course.course_code)
         or private.tec_idiomas_v3_course_content_eligible(course.course_code, course.content_version))
  ) then
    raise exception 'TEC_ENGLISH_COURSE_NOT_TECHNICALLY_PUBLISHED' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.tec_english_courses course
     where course.course_code = p_course_code
       and course.content_version = p_content_version
       and not course.is_test_fixture
  ) then
    raise exception 'TEC_ENGLISH_RELEASE_VERSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_enabled and not private.tec_english_institution_release_eligible(p_institution_id) then
    raise exception 'TEC_ENGLISH_RELEASE_INSTITUTION_UNAVAILABLE' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.institutions institution where institution.id = p_institution_id
  ) then
    raise exception 'TEC_ENGLISH_RELEASE_INSTITUTION_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_course_code || ':' || p_institution_id::text, 0)
  );

  select release.enabled, release.content_version
    into v_existing_enabled, v_existing_version
    from public.tec_english_course_releases release
   where release.course_code = p_course_code
     and release.institution_id = p_institution_id
   for update;

  if not found and not p_enabled then
    return pg_catalog.jsonb_build_object(
      'course_code', p_course_code,
      'content_version', p_content_version,
      'institution_id', p_institution_id,
      'enabled', false,
      'changed', false
    );
  end if;
  if found and v_existing_enabled = p_enabled and v_existing_version = p_content_version then
    return pg_catalog.jsonb_build_object(
      'course_code', p_course_code,
      'content_version', p_content_version,
      'institution_id', p_institution_id,
      'enabled', p_enabled,
      'changed', false
    );
  end if;

  select * into v_profile from public.profiles profile where profile.id = auth.uid();
  if not found then raise exception 'TEC_ENGLISH_RELEASE_ACTOR_NOT_FOUND' using errcode = '42501'; end if;
  v_name := coalesce(nullif(btrim(v_profile.full_name), ''), v_profile.email);
  v_email := v_profile.email;
  v_action := case when p_enabled then 'ENABLED' else 'DISABLED' end;

  insert into public.tec_english_course_releases(
    course_code, content_version, institution_id, enabled,
    updated_by_profile_id, updated_by_id_snapshot, updated_by_name, updated_by_email, updated_at
  ) values (
    p_course_code, p_content_version, p_institution_id, p_enabled,
    v_profile.id, auth.uid(), v_name, v_email, now()
  ) on conflict (course_code, institution_id) do update
    set content_version = excluded.content_version,
        enabled = excluded.enabled,
        updated_by_profile_id = excluded.updated_by_profile_id,
        updated_by_id_snapshot = excluded.updated_by_id_snapshot,
        updated_by_name = excluded.updated_by_name,
        updated_by_email = excluded.updated_by_email,
        updated_at = excluded.updated_at;

  insert into public.tec_english_course_release_events(
    course_code, content_version, institution_id, action, actor_id_snapshot, actor_name, actor_email
  ) values (
    p_course_code, p_content_version, p_institution_id, v_action, auth.uid(), v_name, v_email
  );

  return pg_catalog.jsonb_build_object(
    'course_code', p_course_code,
    'content_version', p_content_version,
    'institution_id', p_institution_id,
    'enabled', p_enabled,
    'changed', true,
    'actor_name', v_name,
    'actor_email', v_email,
    'updated_at', now()
  );
end;
$$;

revoke all on function public.get_tec_english_release_targets_v1(text, integer, text) from public, anon;
grant execute on function public.get_tec_english_release_targets_v1(text, integer, text) to authenticated;
revoke all on function public.set_tec_english_institution_release_v1(text, integer, uuid, boolean) from public, anon;
grant execute on function public.set_tec_english_institution_release_v1(text, integer, uuid, boolean) to authenticated;
