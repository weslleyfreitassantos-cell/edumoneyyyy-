-- V8 technical publication for the eight canonical Tec Idiomas course versions.
-- Publication is separate from editorial review and never creates institution
-- releases. Student access still requires an active institution and an explicit
-- enabled release for the exact course version.

create or replace function private.tec_idiomas_v8_course_version_allowed(
  p_course_code text,
  p_content_version integer
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_course_code, p_content_version) in (
    ('TEC_ENGLISH_FOUNDATIONS', 1),
    ('TEC_ENGLISH_FOUNDATIONS_V2', 4),
    ('TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', 1),
    ('TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER', 1),
    ('TEC_KOREAN_FOUNDATIONS_V1', 1),
    ('TEC_KOREAN_FOUNDATIONS_V2_BEGINNER', 1),
    ('TEC_SPANISH_FOUNDATIONS_V1', 1),
    ('TEC_SPANISH_FOUNDATIONS_V2_BEGINNER', 1)
  );
$$;
revoke all on function private.tec_idiomas_v8_course_version_allowed(text, integer) from public, anon, authenticated;

create table if not exists private.tec_english_technical_publication_events (
  course_code text not null,
  content_version integer not null check (content_version > 0),
  content_fingerprint text not null check (content_fingerprint ~ '^[0-9a-f]{32}$'),
  source_migration text not null check (source_migration = '20261030000200'),
  publication_kind text not null check (publication_kind = 'TECHNICAL_CATALOG'),
  published_at timestamptz not null default now(),
  primary key (course_code, content_version, source_migration)
);
alter table private.tec_english_technical_publication_events enable row level security;
revoke all on table private.tec_english_technical_publication_events from public, anon, authenticated, service_role;
comment on table private.tec_english_technical_publication_events is
  'Restricted audit of the V8 technical catalog publication; it does not represent pedagogical approval or institutional enablement.';

do $tec_english_v8_publish$
declare
  v_expected record;
  v_course_status text;
  v_units integer;
  v_lessons integer;
  v_exercises integer;
  v_fingerprint text;
  v_changed integer;
  v_event_count integer;
begin
  lock table public.tec_english_courses,
             public.tec_english_units,
             public.tec_english_lessons,
             public.tec_english_exercises
    in share row exclusive mode;

  for v_expected in
    select * from (values
      ('TEC_ENGLISH_FOUNDATIONS', 1, 3, 12, 84, '71b020e233fa23dcc6a5316d50433d43'),
      ('TEC_ENGLISH_FOUNDATIONS_V2', 4, 2, 8, 56, '66944522eafc1e5c8b6a8f64747fe963'),
      ('TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', 1, 4, 16, 112, '7364e2f7e460e0547b71d27fb802cf8a'),
      ('TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER', 1, 4, 16, 76, 'e88be160e84a605b7b2be5348db65038'),
      ('TEC_KOREAN_FOUNDATIONS_V1', 1, 2, 8, 56, '4ec9dff599c82a8bd6ef39c3c31f577d'),
      ('TEC_KOREAN_FOUNDATIONS_V2_BEGINNER', 1, 4, 16, 72, '308116e9fb684b4df75ddebdcb418c86'),
      ('TEC_SPANISH_FOUNDATIONS_V1', 1, 2, 8, 56, '9867948cfbb963887dfb5de12f644a6d'),
      ('TEC_SPANISH_FOUNDATIONS_V2_BEGINNER', 1, 4, 16, 76, 'f5fb9c9c9ebe4f9fa1453791a2e0d7fe')
    ) as expected(course_code, content_version, unit_count, lesson_count, exercise_count, fingerprint)
  loop
    select course.publication_status
      into v_course_status
      from public.tec_english_courses course
     where course.course_code = v_expected.course_code
       and course.content_version = v_expected.content_version
       and not course.is_test_fixture
     for update;
    if not found then
      raise exception 'TEC_IDIOMAS_V8_EXPECTED_COURSE_MISSING: %', v_expected.course_code;
    end if;
    if v_course_status is null or v_course_status not in ('STAGING', 'PUBLISHED') then
      raise exception 'TEC_IDIOMAS_V8_UNEXPECTED_COURSE_STATUS: %', v_expected.course_code;
    end if;

    if not private.tec_idiomas_v8_course_version_allowed(v_expected.course_code, v_expected.content_version)
       or not private.tec_english_course_structure_valid_v2(v_expected.course_code, v_expected.content_version) then
      raise exception 'TEC_IDIOMAS_V8_STRUCTURE_INVALID: %', v_expected.course_code;
    end if;
    if private.tec_idiomas_v3_course_allowed(v_expected.course_code)
       and not private.tec_idiomas_v3_course_content_eligible(v_expected.course_code, v_expected.content_version) then
      raise exception 'TEC_IDIOMAS_V8_CONTENT_MANIFEST_INVALID: %', v_expected.course_code;
    end if;

    select count(*)::integer into v_units
      from public.tec_english_units unit
     where unit.course_code = v_expected.course_code
       and unit.content_version = v_expected.content_version;
    select count(*)::integer into v_lessons
      from public.tec_english_lessons lesson
      join public.tec_english_units unit on unit.id = lesson.unit_id
      where unit.course_code = v_expected.course_code
        and unit.content_version = v_expected.content_version;
    select count(*)::integer into v_exercises
      from public.tec_english_exercises exercise
      join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id
      join public.tec_english_units unit on unit.id = lesson.unit_id
      where unit.course_code = v_expected.course_code
        and unit.content_version = v_expected.content_version;
    if (v_units, v_lessons, v_exercises) is distinct from
       (v_expected.unit_count, v_expected.lesson_count, v_expected.exercise_count) then
      raise exception 'TEC_IDIOMAS_V8_CONTENT_COUNTS_MISMATCH: %', v_expected.course_code;
    end if;

    select private.tec_english_course_fingerprint(v_expected.course_code, v_expected.content_version)
      into v_fingerprint;
    if v_fingerprint is distinct from v_expected.fingerprint then
      raise exception 'TEC_IDIOMAS_V8_CONTENT_FINGERPRINT_MISMATCH: %', v_expected.course_code;
    end if;

    if exists (
      select 1 from public.tec_english_units unit
       where unit.course_code = v_expected.course_code
         and unit.content_version = v_expected.content_version
         and unit.publication_status <> v_course_status
    ) or exists (
      select 1 from public.tec_english_lessons lesson
      join public.tec_english_units unit on unit.id = lesson.unit_id
       where unit.course_code = v_expected.course_code
         and unit.content_version = v_expected.content_version
         and (lesson.content_version <> unit.content_version
           or lesson.publication_status <> v_course_status)
    ) or exists (
      select 1 from public.tec_english_exercises exercise
      join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id
      join public.tec_english_units unit on unit.id = lesson.unit_id
       where unit.course_code = v_expected.course_code
         and unit.content_version = v_expected.content_version
         and (lesson.content_version <> unit.content_version
           or exercise.content_version <> lesson.content_version
           or exercise.publication_status <> v_course_status)
    ) then
      raise exception 'TEC_IDIOMAS_V8_CHILD_PUBLICATION_STATE_MISMATCH: %', v_expected.course_code;
    end if;

    select count(*)::integer into v_event_count
      from private.tec_english_technical_publication_events event
     where event.course_code = v_expected.course_code
       and event.content_version = v_expected.content_version
       and event.source_migration = '20261030000200';
    if v_event_count > 0 and not exists (
      select 1 from private.tec_english_technical_publication_events event
       where event.course_code = v_expected.course_code
         and event.content_version = v_expected.content_version
         and event.source_migration = '20261030000200'
         and event.content_fingerprint = v_expected.fingerprint
         and event.publication_kind = 'TECHNICAL_CATALOG'
    ) then
      raise exception 'TEC_IDIOMAS_V8_PUBLICATION_AUDIT_MISMATCH: %', v_expected.course_code;
    end if;
  end loop;

  if exists (
    select 1 from public.tec_english_exercises exercise
     left join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id
    where lesson.id is null
  ) then
    raise exception 'TEC_IDIOMAS_V8_ORPHAN_EXERCISE_FOUND';
  end if;

  if exists (
    select 1
      from public.tec_english_course_releases release
     where private.tec_idiomas_v8_course_version_allowed(release.course_code, release.content_version)
       and release.enabled
  ) then
    raise exception 'TEC_IDIOMAS_V8_UNEXPECTED_INSTITUTION_RELEASE';
  end if;

  for v_expected in
    select * from (values
      ('TEC_ENGLISH_FOUNDATIONS', 1, 3, 12, 84, '71b020e233fa23dcc6a5316d50433d43'),
      ('TEC_ENGLISH_FOUNDATIONS_V2', 4, 2, 8, 56, '66944522eafc1e5c8b6a8f64747fe963'),
      ('TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', 1, 4, 16, 112, '7364e2f7e460e0547b71d27fb802cf8a'),
      ('TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER', 1, 4, 16, 76, 'e88be160e84a605b7b2be5348db65038'),
      ('TEC_KOREAN_FOUNDATIONS_V1', 1, 2, 8, 56, '4ec9dff599c82a8bd6ef39c3c31f577d'),
      ('TEC_KOREAN_FOUNDATIONS_V2_BEGINNER', 1, 4, 16, 72, '308116e9fb684b4df75ddebdcb418c86'),
      ('TEC_SPANISH_FOUNDATIONS_V1', 1, 2, 8, 56, '9867948cfbb963887dfb5de12f644a6d'),
      ('TEC_SPANISH_FOUNDATIONS_V2_BEGINNER', 1, 4, 16, 76, 'f5fb9c9c9ebe4f9fa1453791a2e0d7fe')
    ) as expected(course_code, content_version, unit_count, lesson_count, exercise_count, fingerprint)
  loop
    select course.publication_status
      into v_course_status
      from public.tec_english_courses course
     where course.course_code = v_expected.course_code
       and course.content_version = v_expected.content_version
       and not course.is_test_fixture
     for update;

    if v_course_status = 'STAGING' then
      update public.tec_english_courses course
         set publication_status = 'PUBLISHED', updated_at = now()
       where course.course_code = v_expected.course_code
         and course.content_version = v_expected.content_version
         and course.publication_status = 'STAGING';
      get diagnostics v_changed = row_count;
      if v_changed <> 1 then raise exception 'TEC_IDIOMAS_V8_COURSE_PUBLISH_COUNT_MISMATCH: %', v_expected.course_code; end if;

      update public.tec_english_units unit
         set publication_status = 'PUBLISHED'
       where unit.course_code = v_expected.course_code
         and unit.content_version = v_expected.content_version
         and unit.publication_status = 'STAGING';
      get diagnostics v_changed = row_count;
      if v_changed <> v_expected.unit_count then raise exception 'TEC_IDIOMAS_V8_UNIT_PUBLISH_COUNT_MISMATCH: %', v_expected.course_code; end if;

      update public.tec_english_lessons lesson
         set publication_status = 'PUBLISHED'
        from public.tec_english_units unit
       where unit.id = lesson.unit_id
         and unit.course_code = v_expected.course_code
         and unit.content_version = v_expected.content_version
         and lesson.content_version = v_expected.content_version
         and lesson.publication_status = 'STAGING';
      get diagnostics v_changed = row_count;
      if v_changed <> v_expected.lesson_count then raise exception 'TEC_IDIOMAS_V8_LESSON_PUBLISH_COUNT_MISMATCH: %', v_expected.course_code; end if;

      update public.tec_english_exercises exercise
         set publication_status = 'PUBLISHED'
        from public.tec_english_lessons lesson
        join public.tec_english_units unit on unit.id = lesson.unit_id
       where exercise.lesson_id = lesson.id
         and unit.course_code = v_expected.course_code
         and unit.content_version = v_expected.content_version
         and lesson.content_version = v_expected.content_version
         and exercise.content_version = v_expected.content_version
         and exercise.publication_status = 'STAGING';
      get diagnostics v_changed = row_count;
      if v_changed <> v_expected.exercise_count then raise exception 'TEC_IDIOMAS_V8_EXERCISE_PUBLISH_COUNT_MISMATCH: %', v_expected.course_code; end if;
    end if;

    insert into private.tec_english_technical_publication_events(
      course_code, content_version, content_fingerprint, source_migration, publication_kind
    ) values (
      v_expected.course_code, v_expected.content_version, v_expected.fingerprint,
      '20261030000200', 'TECHNICAL_CATALOG'
    ) on conflict (course_code, content_version, source_migration) do nothing;
    get diagnostics v_changed = row_count;
    if v_changed = 0 and not exists (
      select 1 from private.tec_english_technical_publication_events event
       where event.course_code = v_expected.course_code
         and event.content_version = v_expected.content_version
         and event.source_migration = '20261030000200'
         and event.content_fingerprint = v_expected.fingerprint
         and event.publication_kind = 'TECHNICAL_CATALOG'
    ) then
      raise exception 'TEC_IDIOMAS_V8_PUBLICATION_AUDIT_MISMATCH: %', v_expected.course_code;
    end if;
  end loop;

  select count(*)::integer into v_event_count
    from private.tec_english_technical_publication_events event
   where event.source_migration = '20261030000200';
  if v_event_count <> 8 then raise exception 'TEC_IDIOMAS_V8_PUBLICATION_AUDIT_COUNT_MISMATCH'; end if;
end;
$tec_english_v8_publish$;

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
           and private.tec_english_course_structure_valid_v2(course.course_code, course.content_version)
           and (
             not private.tec_idiomas_v3_course_allowed(course.course_code)
             or private.tec_idiomas_v3_course_content_eligible(course.course_code, course.content_version)
           )
           and exists (
             select 1 from public.tec_english_course_releases release
             join public.institutions institution on institution.id = release.institution_id
              where release.course_code = course.course_code
                and release.content_version = course.content_version
                and release.institution_id = p_institution_id
                and release.enabled
                and institution.active
           )
         )
       )
  );
$$;
revoke all on function private.tec_english_course_available(uuid, text, boolean) from public, anon, authenticated;

create or replace function private.tec_english_lesson_ready(p_lesson_id text, p_test_mode boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.tec_english_lessons lesson
      join public.tec_english_units unit on unit.id = lesson.unit_id
      join public.tec_english_courses course on course.course_code = unit.course_code
     where lesson.id = p_lesson_id
       and exists (select 1 from public.tec_english_exercises exercise where exercise.lesson_id = lesson.id)
       and (
         (p_test_mode and course.is_test_fixture)
         or (
           not p_test_mode and not course.is_test_fixture
           and course.publication_status = 'PUBLISHED'
           and private.tec_idiomas_v8_course_version_allowed(course.course_code, course.content_version)
           and private.tec_english_course_structure_valid_v2(course.course_code, course.content_version)
           and (not private.tec_idiomas_v3_course_allowed(course.course_code)
             or private.tec_idiomas_v3_course_content_eligible(course.course_code, course.content_version))
           and unit.content_version = course.content_version
           and lesson.content_version = course.content_version
           and unit.publication_status = 'PUBLISHED'
           and lesson.publication_status = 'PUBLISHED'
           and not exists (
             select 1 from public.tec_english_exercises exercise
              where exercise.lesson_id = lesson.id
                and (exercise.content_version <> course.content_version
                  or exercise.publication_status <> 'PUBLISHED')
           )
         )
       )
  );
$$;
revoke all on function private.tec_english_lesson_ready(text, boolean) from public, anon, authenticated;

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
    'enabled', coalesce(release.enabled and release.content_version = p_content_version, false)
  ) order by institution.name), '[]'::jsonb)
    into v_targets
    from (
      select item.id, item.name
        from public.institutions item
       where item.active
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
  if p_enabled and not exists (
    select 1 from public.institutions institution where institution.id = p_institution_id and institution.active
  ) then
    raise exception 'TEC_ENGLISH_RELEASE_INSTITUTION_UNAVAILABLE' using errcode = 'P0002';
  end if;
  if not p_enabled and not exists (
    select 1 from public.institutions institution where institution.id = p_institution_id
  ) then
    raise exception 'TEC_ENGLISH_RELEASE_INSTITUTION_NOT_FOUND' using errcode = 'P0002';
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

-- Keep old review records intact, but retire approval as a runtime/publication
-- control. No new checklist decisions are recorded through the legacy endpoint.
create or replace function public.review_tec_english_course_v1(
  p_course_code text,
  p_content_version integer,
  p_decision text,
  p_notes text,
  p_expected_fingerprint text,
  p_checklist jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'TEC_ENGLISH_PEDAGOGICAL_REVIEW_RETIRED' using errcode = '0A000';
end;
$$;
revoke all on function public.review_tec_english_course_v1(text, integer, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.get_tec_english_review_queue_v1() from public, anon, authenticated;
revoke all on function public.get_tec_english_review_history_v1() from public, anon, authenticated;
revoke all on function public.get_tec_english_review_preview_v1(text, integer) from public, anon, authenticated;
