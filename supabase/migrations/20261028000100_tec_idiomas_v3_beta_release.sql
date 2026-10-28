-- Institution-scoped, auditable Beta access for the three Tec Idiomas V3 courses.
-- Beta never changes pedagogical review/publication status; the exact content
-- fingerprint is checked on every student request and the default is disabled.

create table public.tec_idiomas_v3_beta_releases (
  course_code text not null references public.tec_english_courses(course_code) on delete cascade
    check (course_code in ('TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', 'TEC_SPANISH_FOUNDATIONS_V1', 'TEC_KOREAN_FOUNDATIONS_V1')),
  content_version integer not null check (content_version > 0),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  snapshot_fingerprint text not null check (snapshot_fingerprint ~ '^[0-9a-f]{32}$'),
  enabled boolean not null default true,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_id_snapshot uuid not null,
  updated_by_name text not null,
  updated_by_email text not null,
  reason text not null check (length(btrim(reason)) between 10 and 1000),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz,
  primary key (course_code, content_version, institution_id)
);

create table public.tec_idiomas_v3_beta_release_events (
  id uuid primary key default gen_random_uuid(),
  course_code text not null
    check (course_code in ('TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', 'TEC_SPANISH_FOUNDATIONS_V1', 'TEC_KOREAN_FOUNDATIONS_V1')),
  content_version integer not null check (content_version > 0),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  snapshot_fingerprint text not null check (snapshot_fingerprint ~ '^[0-9a-f]{32}$'),
  action text not null check (action in ('ENABLED', 'DISABLED')),
  reason text not null check (length(btrim(reason)) between 10 and 1000),
  actor_id_snapshot uuid not null,
  actor_name text not null,
  actor_email text not null,
  occurred_at timestamptz not null default now()
);

create index tec_idiomas_v3_beta_events_idx
  on public.tec_idiomas_v3_beta_release_events(course_code, content_version, institution_id, occurred_at desc);

alter table public.tec_idiomas_v3_beta_releases enable row level security;
alter table public.tec_idiomas_v3_beta_release_events enable row level security;
revoke all on table public.tec_idiomas_v3_beta_releases, public.tec_idiomas_v3_beta_release_events from public, anon, authenticated;
grant all on table public.tec_idiomas_v3_beta_releases, public.tec_idiomas_v3_beta_release_events to service_role;

create or replace function private.tec_idiomas_v3_beta_course_allowed(p_course_code text)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select p_course_code in (
    'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION',
    'TEC_SPANISH_FOUNDATIONS_V1',
    'TEC_KOREAN_FOUNDATIONS_V1'
  );
$$;
revoke all on function private.tec_idiomas_v3_beta_course_allowed(text) from public, anon, authenticated;

create or replace function private.tec_idiomas_v3_beta_release_active(
  p_institution_id uuid,
  p_course_code text,
  p_content_version integer
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.tec_idiomas_v3_beta_course_allowed(p_course_code)
    and exists (
      select 1
        from public.tec_english_courses course
        join public.tec_idiomas_v3_beta_releases beta
          on beta.course_code = course.course_code
         and beta.content_version = course.content_version
       where course.course_code = p_course_code
         and course.content_version = p_content_version
         and not course.is_test_fixture
         and course.publication_status = 'STAGING'
         and course.review_status = 'PEDAGOGICAL_REVIEW_PENDING'
         and beta.institution_id = p_institution_id
         and beta.enabled
         and beta.snapshot_fingerprint = private.tec_english_course_fingerprint(course.course_code, course.content_version)
         and exists (select 1 from public.institutions institution
                      where institution.id = beta.institution_id and institution.active)
         and not exists (select 1 from public.tec_english_pedagogical_reviews approved
                          where approved.course_code = course.course_code
                            and approved.content_version = course.content_version
                            and approved.decision = 'APPROVED')
    );
$$;
revoke all on function private.tec_idiomas_v3_beta_release_active(uuid, text, integer) from public, anon, authenticated;

create or replace function public.get_tec_idiomas_v3_beta_targets_v1(
  p_course_code text,
  p_content_version integer,
  p_search text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_fingerprint text;
  v_targets jsonb;
begin
  if not public.is_platform_super_admin() then
    raise exception 'TEC_IDIOMAS_BETA_FORBIDDEN' using errcode = '42501';
  end if;
  if not private.tec_idiomas_v3_beta_course_allowed(p_course_code)
     or length(btrim(coalesce(p_search, ''))) < 2 then
    raise exception 'TEC_IDIOMAS_BETA_INVALID_SEARCH' using errcode = '22023';
  end if;

  select private.tec_english_course_fingerprint(course.course_code, course.content_version)
    into v_fingerprint
    from public.tec_english_courses course
   where course.course_code = p_course_code
     and course.content_version = p_content_version
     and not course.is_test_fixture
     and course.publication_status = 'STAGING'
     and course.review_status = 'PEDAGOGICAL_REVIEW_PENDING';
  if v_fingerprint is null or exists (
    select 1 from public.tec_english_pedagogical_reviews approved
     where approved.course_code = p_course_code
       and approved.content_version = p_content_version
       and approved.decision = 'APPROVED'
  ) then
    raise exception 'TEC_IDIOMAS_BETA_VERSION_NOT_ELIGIBLE' using errcode = '42501';
  end if;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'course_code', p_course_code,
    'content_version', p_content_version,
    'course_title', course.title,
    'snapshot_fingerprint', v_fingerprint,
    'institution_id', institution.id,
    'institution_name', institution.name,
    'enabled', coalesce(beta.enabled, false),
    'effective', coalesce(beta.enabled and beta.snapshot_fingerprint = v_fingerprint, false),
    'updated_at', beta.updated_at,
    'updated_by_name', beta.updated_by_name,
    'reason', beta.reason
  ) order by institution.name), '[]'::jsonb)
    into v_targets
    from public.tec_english_courses course
    join (
      select item.id, item.name
        from public.institutions item
       where item.active
         and item.name ilike '%' || btrim(p_search) || '%'
       order by item.name
       limit 100
    ) institution on true
    left join public.tec_idiomas_v3_beta_releases beta
      on beta.course_code = p_course_code
     and beta.content_version = p_content_version
     and beta.institution_id = institution.id
   where course.course_code = p_course_code
     and course.content_version = p_content_version;
  return v_targets;
end;
$$;

create or replace function public.set_tec_idiomas_v3_beta_release_v1(
  p_course_code text,
  p_content_version integer,
  p_institution_id uuid,
  p_enabled boolean,
  p_expected_fingerprint text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_course public.tec_english_courses%rowtype;
  v_fingerprint text;
  v_action text;
  v_name text;
  v_email text;
begin
  if not public.is_platform_super_admin() then
    raise exception 'TEC_IDIOMAS_BETA_FORBIDDEN' using errcode = '42501';
  end if;
  if p_enabled is null or p_reason is null or length(btrim(p_reason)) not between 10 and 1000 then
    raise exception 'TEC_IDIOMAS_BETA_INVALID_RELEASE' using errcode = '22023';
  end if;
  if not private.tec_idiomas_v3_beta_course_allowed(p_course_code) then
    raise exception 'TEC_IDIOMAS_BETA_COURSE_NOT_ALLOWED' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles profile where profile.id = auth.uid() and profile.active;
  if not found then raise exception 'TEC_IDIOMAS_BETA_FORBIDDEN' using errcode = '42501'; end if;
  v_name := coalesce(nullif(btrim(v_profile.full_name), ''), v_profile.email, 'Super Administrador');
  v_email := coalesce(v_profile.email, '');

  if p_enabled then
    select * into v_course
      from public.tec_english_courses course
     where course.course_code = p_course_code
       and course.content_version = p_content_version
       and not course.is_test_fixture
       and course.publication_status = 'STAGING'
       and course.review_status = 'PEDAGOGICAL_REVIEW_PENDING'
     for update;
    if not found then raise exception 'TEC_IDIOMAS_BETA_VERSION_NOT_ELIGIBLE' using errcode = '42501'; end if;
    v_fingerprint := private.tec_english_course_fingerprint(p_course_code, p_content_version);
    if v_fingerprint is null or p_expected_fingerprint is distinct from v_fingerprint then
      raise exception 'TEC_IDIOMAS_BETA_CONTENT_CHANGED' using errcode = '40001';
    end if;
    if exists (select 1 from public.tec_english_pedagogical_reviews approved
                where approved.course_code = p_course_code
                  and approved.content_version = p_content_version
                  and approved.decision = 'APPROVED') then
      raise exception 'TEC_IDIOMAS_BETA_USE_FORMAL_RELEASE' using errcode = '42501';
    end if;
    if not exists (select 1 from public.institutions institution
                    where institution.id = p_institution_id and institution.active)
       or not exists (select 1 from public.tec_english_units unit where unit.course_code = p_course_code)
       or exists (select 1 from public.tec_english_units unit
                   where unit.course_code = p_course_code
                     and (unit.content_version <> p_content_version or unit.publication_status <> 'STAGING'
                          or unit.review_status <> 'PEDAGOGICAL_REVIEW_PENDING'
                          or not exists (select 1 from public.tec_english_lessons lesson where lesson.unit_id = unit.id)))
       or exists (select 1 from public.tec_english_lessons lesson
                   join public.tec_english_units unit on unit.id = lesson.unit_id
                   where unit.course_code = p_course_code
                     and (lesson.content_version <> p_content_version or lesson.publication_status <> 'STAGING'
                          or lesson.review_status <> 'PEDAGOGICAL_REVIEW_PENDING'
                          or not exists (select 1 from public.tec_english_exercises exercise where exercise.lesson_id = lesson.id)))
       or exists (select 1 from public.tec_english_exercises exercise
                   join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id
                   join public.tec_english_units unit on unit.id = lesson.unit_id
                   where unit.course_code = p_course_code
                     and (exercise.content_version <> p_content_version or exercise.publication_status <> 'STAGING'
                          or exercise.review_status <> 'PEDAGOGICAL_REVIEW_PENDING')) then
      raise exception 'TEC_IDIOMAS_BETA_CONTENT_INCOMPLETE' using errcode = '22023';
    end if;
  else
    select beta.snapshot_fingerprint into v_fingerprint
      from public.tec_idiomas_v3_beta_releases beta
     where beta.course_code = p_course_code
       and beta.content_version = p_content_version
       and beta.institution_id = p_institution_id
       and beta.enabled
     for update;
    if not found then raise exception 'TEC_IDIOMAS_BETA_RELEASE_NOT_FOUND' using errcode = 'P0002'; end if;
  end if;

  v_action := case when p_enabled then 'ENABLED' else 'DISABLED' end;
  if p_enabled then
    insert into public.tec_idiomas_v3_beta_releases(
      course_code, content_version, institution_id, snapshot_fingerprint, enabled,
      updated_by_profile_id, updated_by_id_snapshot, updated_by_name, updated_by_email,
      reason, updated_at, disabled_at
    ) values (
      p_course_code, p_content_version, p_institution_id, v_fingerprint, true,
      v_profile.id, auth.uid(), v_name, v_email, btrim(p_reason), now(), null
    ) on conflict (course_code, content_version, institution_id) do update
      set snapshot_fingerprint = excluded.snapshot_fingerprint,
          enabled = true,
          updated_by_profile_id = excluded.updated_by_profile_id,
          updated_by_id_snapshot = excluded.updated_by_id_snapshot,
          updated_by_name = excluded.updated_by_name,
          updated_by_email = excluded.updated_by_email,
          reason = excluded.reason,
          updated_at = now(), disabled_at = null;
  else
    update public.tec_idiomas_v3_beta_releases beta
       set enabled = false,
           updated_by_profile_id = v_profile.id,
           updated_by_id_snapshot = auth.uid(),
           updated_by_name = v_name,
           updated_by_email = v_email,
           reason = btrim(p_reason),
           updated_at = now(), disabled_at = now()
     where beta.course_code = p_course_code
       and beta.content_version = p_content_version
       and beta.institution_id = p_institution_id;
  end if;

  insert into public.tec_idiomas_v3_beta_release_events(
    course_code, content_version, institution_id, snapshot_fingerprint,
    action, reason, actor_id_snapshot, actor_name, actor_email
  ) values (
    p_course_code, p_content_version, p_institution_id, v_fingerprint,
    v_action, btrim(p_reason), auth.uid(), v_name, v_email
  );

  return pg_catalog.jsonb_build_object(
    'course_code', p_course_code,
    'content_version', p_content_version,
    'institution_id', p_institution_id,
    'snapshot_fingerprint', v_fingerprint,
    'enabled', p_enabled,
    'actor_name', v_name,
    'actor_email', v_email,
    'reason', btrim(p_reason),
    'updated_at', now()
  );
end;
$$;

revoke all on function public.get_tec_idiomas_v3_beta_targets_v1(text, integer, text) from public, anon;
revoke all on function public.set_tec_idiomas_v3_beta_release_v1(text, integer, uuid, boolean, text, text) from public, anon;
grant execute on function public.get_tec_idiomas_v3_beta_targets_v1(text, integer, text) to authenticated;
grant execute on function public.set_tec_idiomas_v3_beta_release_v1(text, integer, uuid, boolean, text, text) to authenticated;

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
    select 1 from public.tec_english_courses course
     where course.course_code = p_course_code
       and (
         (p_test_mode and course.is_test_fixture)
         or (
           not p_test_mode and not course.is_test_fixture
           and (
             (course.publication_status = 'PUBLISHED'
              and course.review_status = 'PEDAGOGICAL_REVIEWED'
              and exists (
                select 1 from public.tec_english_pedagogical_reviews review
                 where review.course_code = course.course_code
                   and review.content_version = course.content_version
                   and review.decision = 'APPROVED'
                   and review.snapshot_fingerprint = private.tec_english_course_fingerprint(course.course_code, course.content_version)
              )
              and exists (
                select 1 from public.tec_english_course_releases release
                join public.institutions institution on institution.id = release.institution_id
                where release.course_code = course.course_code
                  and release.content_version = course.content_version
                  and release.institution_id = p_institution_id
                  and release.enabled and institution.active
              ))
             or private.tec_idiomas_v3_beta_release_active(p_institution_id, p_course_code, course.content_version)
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
           not course.is_test_fixture
           and (
             (course.publication_status = 'PUBLISHED'
              and course.review_status = 'PEDAGOGICAL_REVIEWED'
              and unit.publication_status = 'PUBLISHED'
              and unit.review_status = 'PEDAGOGICAL_REVIEWED'
              and lesson.publication_status = 'PUBLISHED'
              and lesson.review_status = 'PEDAGOGICAL_REVIEWED'
              and not exists (
                select 1 from public.tec_english_exercises exercise
                 where exercise.lesson_id = lesson.id
                   and (exercise.publication_status <> 'PUBLISHED' or exercise.review_status <> 'PEDAGOGICAL_REVIEWED')
              )
              and exists (
                select 1 from public.tec_english_pedagogical_reviews review
                 where review.course_code = course.course_code
                   and review.content_version = course.content_version
                   and review.decision = 'APPROVED'
                   and review.snapshot_fingerprint = private.tec_english_course_fingerprint(course.course_code, course.content_version)
              ))
             or (private.tec_idiomas_v3_beta_course_allowed(course.course_code)
                 and course.publication_status = 'STAGING'
                 and course.review_status = 'PEDAGOGICAL_REVIEW_PENDING'
                 and unit.content_version = course.content_version
                 and unit.publication_status = 'STAGING'
                 and unit.review_status = 'PEDAGOGICAL_REVIEW_PENDING'
                 and lesson.content_version = course.content_version
                 and lesson.publication_status = 'STAGING'
                 and lesson.review_status = 'PEDAGOGICAL_REVIEW_PENDING'
                 and not exists (
                   select 1 from public.tec_english_exercises exercise
                    where exercise.lesson_id = lesson.id
                      and (exercise.content_version <> course.content_version
                           or exercise.publication_status <> 'STAGING'
                           or exercise.review_status <> 'PEDAGOGICAL_REVIEW_PENDING')
                 )
                 and exists (
                   select 1 from public.tec_idiomas_v3_beta_releases beta
                    where beta.course_code = course.course_code
                      and beta.content_version = course.content_version
                      and beta.enabled
                      and beta.snapshot_fingerprint = private.tec_english_course_fingerprint(course.course_code, course.content_version)
                 ))
           )
         )
       )
  );
$$;
revoke all on function private.tec_english_lesson_ready(text, boolean) from public, anon, authenticated;

comment on table public.tec_idiomas_v3_beta_releases is 'Explicit, institution-scoped Tec Idiomas Beta access; does not represent pedagogical approval or publication.';
comment on table public.tec_idiomas_v3_beta_release_events is 'Append-only audit history for Tec Idiomas Beta enables and revocations.';
comment on function private.tec_idiomas_v3_beta_release_active(uuid, text, integer) is 'Allows only an exact, active, fingerprint-matched Beta release for one active institution.';
notify pgrst, 'reload schema';
