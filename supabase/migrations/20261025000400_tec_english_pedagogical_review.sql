-- Human review and version-bound publication for Tec Ingles course content.
-- Student RPCs remain gated until a reviewer approves the exact content snapshot.

create table public.tec_english_pedagogical_reviews (
  id uuid primary key default gen_random_uuid(),
  course_code text not null references public.tec_english_courses(course_code) on delete cascade,
  content_version integer not null check (content_version > 0),
  snapshot_fingerprint text not null check (snapshot_fingerprint ~ '^[0-9a-f]{32}$'),
  decision text not null check (decision in ('APPROVED', 'CHANGES_REQUESTED')),
  notes text not null check (length(btrim(notes)) between 10 and 2000),
  reviewer_profile_id uuid references public.profiles(id) on delete set null,
  reviewer_id_snapshot uuid not null,
  reviewer_name text not null,
  reviewer_email text not null,
  reviewed_at timestamptz not null default now()
);

create index tec_english_pedagogical_reviews_version_idx
  on public.tec_english_pedagogical_reviews(course_code, content_version, reviewed_at desc);

create table public.tec_english_course_releases (
  course_code text not null references public.tec_english_courses(course_code) on delete cascade,
  content_version integer not null check (content_version > 0),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  enabled boolean not null default false,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_id_snapshot uuid not null,
  updated_by_name text not null,
  updated_by_email text not null,
  updated_at timestamptz not null default now(),
  primary key (course_code, institution_id)
);

create table public.tec_english_course_release_events (
  id uuid primary key default gen_random_uuid(),
  course_code text not null,
  content_version integer not null check (content_version > 0),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  action text not null check (action in ('ENABLED', 'DISABLED')),
  actor_id_snapshot uuid not null,
  actor_name text not null,
  actor_email text not null,
  occurred_at timestamptz not null default now()
);

create index tec_english_release_events_version_idx
  on public.tec_english_course_release_events(course_code, content_version, occurred_at desc);

alter table public.tec_english_pedagogical_reviews enable row level security;
alter table public.tec_english_course_releases enable row level security;
alter table public.tec_english_course_release_events enable row level security;
revoke all on table public.tec_english_pedagogical_reviews from public, anon, authenticated;
revoke all on table public.tec_english_course_releases, public.tec_english_course_release_events from public, anon, authenticated;
grant all on table public.tec_english_pedagogical_reviews to service_role;
grant all on table public.tec_english_course_releases, public.tec_english_course_release_events to service_role;

create or replace function private.tec_english_course_snapshot(
  p_course_code text,
  p_content_version integer
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'course', pg_catalog.jsonb_build_object(
      'course_code', course.course_code,
      'content_version', course.content_version,
      'title', course.title,
      'description', course.description,
      'author', course.author,
      'xp_per_lesson', course.xp_per_lesson
    ),
    'units', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', unit.id,
          'position', unit.position,
          'title', unit.title,
          'description', unit.description,
          'content_version', unit.content_version,
          'author', unit.author,
          'lessons', coalesce((
            select pg_catalog.jsonb_agg(
              pg_catalog.jsonb_build_object(
                'id', lesson.id,
                'position', lesson.position,
                'title', lesson.title,
                'introduction', lesson.introduction,
                'xp_reward', lesson.xp_reward,
                'content_version', lesson.content_version,
                'author', lesson.author,
                'exercises', coalesce((
                  select pg_catalog.jsonb_agg(
                    pg_catalog.jsonb_build_object(
                      'id', exercise.id,
                      'position', exercise.position,
                      'type', exercise.exercise_type,
                      'instruction', exercise.instruction,
                      'prompt', exercise.prompt,
                      'options', exercise.options,
                      'word_bank', exercise.word_bank,
                      'left_items', exercise.left_items,
                      'right_items', exercise.right_items,
                      'audio_text', exercise.audio_text,
                      'accepted_answers', exercise.accepted_answers,
                      'answer_key', exercise.answer_key,
                      'explanation', exercise.explanation,
                      'content_version', exercise.content_version,
                      'author', exercise.author
                    ) order by exercise.position
                  )
                    from public.tec_english_exercises exercise
                   where exercise.lesson_id = lesson.id
                ), '[]'::jsonb)
              ) order by lesson.position
            )
              from public.tec_english_lessons lesson
             where lesson.unit_id = unit.id
          ), '[]'::jsonb)
        ) order by unit.position
      )
        from public.tec_english_units unit
       where unit.course_code = course.course_code
    ), '[]'::jsonb)
  )
    from public.tec_english_courses course
   where course.course_code = p_course_code
     and course.content_version = p_content_version;
$$;

create or replace function private.tec_english_course_fingerprint(
  p_course_code text,
  p_content_version integer
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.md5(snapshot::text)
    from (select private.tec_english_course_snapshot(p_course_code, p_content_version) as snapshot) content
   where snapshot is not null;
$$;

revoke all on function private.tec_english_course_snapshot(text, integer) from public, anon, authenticated;
revoke all on function private.tec_english_course_fingerprint(text, integer) from public, anon, authenticated;

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
           not p_test_mode
           and not course.is_test_fixture
           and course.publication_status = 'PUBLISHED'
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
               and release.enabled
               and institution.active
           )
         )
       )
  );
$$;

revoke all on function private.tec_english_course_available(uuid, text, boolean) from public, anon, authenticated;

create or replace function public.get_tec_english_review_queue_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_queue jsonb;
begin
  if not public.is_platform_super_admin() then
    raise exception 'TEC_ENGLISH_REVIEW_FORBIDDEN' using errcode = '42501';
  end if;

  select coalesce(pg_catalog.jsonb_agg(item.payload order by item.course_code), '[]'::jsonb)
    into v_queue
    from (
      select course.course_code,
             pg_catalog.jsonb_build_object(
               'course_code', course.course_code,
               'content_version', course.content_version,
               'title', course.title,
               'description', course.description,
               'author', course.author,
               'publication_status', course.publication_status,
               'review_status', course.review_status,
               'snapshot_fingerprint', private.tec_english_course_fingerprint(course.course_code, course.content_version),
               'unit_count', (select count(*)::integer from public.tec_english_units unit where unit.course_code = course.course_code),
               'lesson_count', (select count(*)::integer from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = course.course_code),
               'exercise_count', (select count(*)::integer from public.tec_english_exercises exercise join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = course.course_code),
               'latest_decision', latest.decision,
               'latest_reviewer', latest.reviewer_name,
               'latest_reviewed_at', latest.reviewed_at
             ) as payload
        from public.tec_english_courses course
        left join lateral (
          select review.decision, review.reviewer_name, review.reviewed_at
            from public.tec_english_pedagogical_reviews review
           where review.course_code = course.course_code
             and review.content_version = course.content_version
           order by review.reviewed_at desc, review.id desc
           limit 1
        ) latest on true
       where not course.is_test_fixture
         and course.publication_status <> 'ARCHIVED'
         and (
           course.review_status <> 'PEDAGOGICAL_REVIEWED'
           or course.publication_status <> 'PUBLISHED'
           or not exists (
             select 1
               from public.tec_english_pedagogical_reviews approved
              where approved.course_code = course.course_code
                and approved.content_version = course.content_version
                and approved.decision = 'APPROVED'
                and approved.snapshot_fingerprint = private.tec_english_course_fingerprint(course.course_code, course.content_version)
           )
         )
    ) item;

  return v_queue;
end;
$$;

create or replace function public.get_tec_english_review_history_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_history jsonb;
begin
  if not public.is_platform_super_admin() then
    raise exception 'TEC_ENGLISH_REVIEW_FORBIDDEN' using errcode = '42501';
  end if;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'course_code', review.course_code,
    'course_title', course.title,
    'content_version', review.content_version,
    'snapshot_fingerprint', review.snapshot_fingerprint,
    'decision', review.decision,
    'notes', review.notes,
    'reviewer_profile_id', review.reviewer_id_snapshot,
    'reviewer_name', review.reviewer_name,
    'reviewer_email', review.reviewer_email,
    'reviewed_at', review.reviewed_at
  ) order by review.reviewed_at desc, review.id desc), '[]'::jsonb)
    into v_history
    from public.tec_english_pedagogical_reviews review
    left join public.tec_english_courses course on course.course_code = review.course_code;
  return v_history;
end;
$$;

create or replace function public.get_tec_english_review_preview_v1(
  p_course_code text,
  p_content_version integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_snapshot jsonb;
begin
  if not public.is_platform_super_admin() then
    raise exception 'TEC_ENGLISH_REVIEW_FORBIDDEN' using errcode = '42501';
  end if;

  select private.tec_english_course_snapshot(p_course_code, p_content_version)
    into v_snapshot;
  if v_snapshot is null then
    raise exception 'TEC_ENGLISH_REVIEW_VERSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  return v_snapshot || pg_catalog.jsonb_build_object(
    'snapshot_fingerprint', private.tec_english_course_fingerprint(p_course_code, p_content_version),
    'audio_mode', 'Browser speech synthesis, en-US; pronunciation evaluation uses browser speech recognition when available and typed fallback otherwise.'
  );
end;
$$;

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
    raise exception 'TEC_ENGLISH_REVIEW_FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.tec_english_courses course
     where course.course_code = p_course_code
       and course.content_version = p_content_version
       and course.publication_status = 'PUBLISHED'
       and course.review_status = 'PEDAGOGICAL_REVIEWED'
       and exists (
         select 1 from public.tec_english_pedagogical_reviews review
          where review.course_code = course.course_code
            and review.content_version = course.content_version
            and review.decision = 'APPROVED'
            and review.snapshot_fingerprint = private.tec_english_course_fingerprint(course.course_code, course.content_version)
       )
  ) then
    raise exception 'TEC_ENGLISH_CONTENT_NOT_APPROVED' using errcode = '42501';
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
     and release.course_code = p_course_code
  ;
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
    raise exception 'TEC_ENGLISH_REVIEW_FORBIDDEN' using errcode = '42501';
  end if;
  if p_enabled is null or not exists (
    select 1 from public.tec_english_courses course
     where course.course_code = p_course_code
       and course.content_version = p_content_version
       and course.publication_status = 'PUBLISHED'
       and course.review_status = 'PEDAGOGICAL_REVIEWED'
       and exists (
         select 1 from public.tec_english_pedagogical_reviews review
          where review.course_code = course.course_code
            and review.content_version = course.content_version
            and review.decision = 'APPROVED'
            and review.snapshot_fingerprint = private.tec_english_course_fingerprint(course.course_code, course.content_version)
       )
  ) then
    raise exception 'TEC_ENGLISH_CONTENT_NOT_APPROVED' using errcode = '42501';
  end if;
  if not exists (select 1 from public.institutions institution where institution.id = p_institution_id and institution.active) then
    raise exception 'TEC_ENGLISH_RELEASE_INSTITUTION_UNAVAILABLE' using errcode = 'P0002';
  end if;

  select * into v_profile from public.profiles profile where profile.id = auth.uid();
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
declare
  v_course public.tec_english_courses%rowtype;
  v_profile public.profiles%rowtype;
  v_fingerprint text;
  v_review_id uuid;
begin
  if not public.is_platform_super_admin() then
    raise exception 'TEC_ENGLISH_REVIEW_FORBIDDEN' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('APPROVED', 'CHANGES_REQUESTED')
     or length(btrim(coalesce(p_notes, ''))) < 10
     or length(p_notes) > 2000 then
    raise exception 'TEC_ENGLISH_REVIEW_INVALID_DECISION' using errcode = '22023';
  end if;
  if p_decision = 'APPROVED' and (
    p_checklist is null
    or pg_catalog.jsonb_typeof(p_checklist) is distinct from 'object'
    or p_checklist ->> 'translation' is distinct from 'true'
    or p_checklist ->> 'audio' is distinct from 'true'
    or p_checklist ->> 'instructions' is distinct from 'true'
    or p_checklist ->> 'alternatives' is distinct from 'true'
    or p_checklist ->> 'progression' is distinct from 'true'
    or p_checklist ->> 'brazilian' is distinct from 'true'
    or p_checklist ->> 'accessibility' is distinct from 'true'
    or p_checklist ->> 'references' is distinct from 'true'
  ) then
    raise exception 'TEC_ENGLISH_REVIEW_CHECKLIST_INCOMPLETE' using errcode = '22023';
  end if;

  select * into v_course
    from public.tec_english_courses course
   where course.course_code = p_course_code
     and course.content_version = p_content_version
   for update;
  if not found or v_course.is_test_fixture or v_course.publication_status = 'ARCHIVED' then
    raise exception 'TEC_ENGLISH_REVIEW_VERSION_NOT_REVIEWABLE' using errcode = 'P0002';
  end if;

  v_fingerprint := private.tec_english_course_fingerprint(p_course_code, p_content_version);
  if v_fingerprint is null or p_expected_fingerprint is null or v_fingerprint is distinct from p_expected_fingerprint then
    raise exception 'TEC_ENGLISH_REVIEW_CONTENT_CHANGED' using errcode = '40001';
  end if;

  if exists (
    select 1 from public.tec_english_pedagogical_reviews prior
     where prior.course_code = p_course_code
       and prior.content_version = p_content_version
       and prior.decision = 'APPROVED'
       and prior.snapshot_fingerprint <> v_fingerprint
  ) then
    raise exception 'TEC_ENGLISH_CONTENT_VERSION_IMMUTABLE' using errcode = '55000';
  end if;

  if p_decision = 'APPROVED' then
    if not exists (select 1 from public.tec_english_units unit where unit.course_code = p_course_code)
       or exists (
         select 1 from public.tec_english_units unit
          where unit.course_code = p_course_code
            and unit.content_version <> p_content_version
       )
       or exists (
         select 1 from public.tec_english_lessons lesson
         join public.tec_english_units unit on unit.id = lesson.unit_id
          where unit.course_code = p_course_code
            and lesson.content_version <> p_content_version
       )
       or exists (
         select 1 from public.tec_english_exercises exercise
         join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id
         join public.tec_english_units unit on unit.id = lesson.unit_id
          where unit.course_code = p_course_code
            and exercise.content_version <> p_content_version
       )
       or exists (
         select 1 from public.tec_english_units unit
          where unit.course_code = p_course_code
            and not exists (select 1 from public.tec_english_lessons lesson where lesson.unit_id = unit.id)
       )
       or exists (
         select 1 from public.tec_english_lessons lesson
         join public.tec_english_units unit on unit.id = lesson.unit_id
          where unit.course_code = p_course_code
            and (
              select count(*) from public.tec_english_exercises exercise where exercise.lesson_id = lesson.id
            ) <> 7
       )
       or exists (
         select 1 from public.tec_english_lessons lesson
         join public.tec_english_units unit on unit.id = lesson.unit_id
          where unit.course_code = p_course_code
            and (
              select count(distinct exercise.exercise_type) from public.tec_english_exercises exercise where exercise.lesson_id = lesson.id
            ) <> 7
       ) then
      raise exception 'TEC_ENGLISH_REVIEW_CONTENT_INCOMPLETE' using errcode = '22023';
    end if;

    update public.tec_english_courses
       set publication_status = 'PUBLISHED', review_status = 'PEDAGOGICAL_REVIEWED', updated_at = now()
     where course_code = p_course_code;
    update public.tec_english_units
       set publication_status = 'PUBLISHED', review_status = 'PEDAGOGICAL_REVIEWED'
     where course_code = p_course_code;
    update public.tec_english_lessons lesson
       set publication_status = 'PUBLISHED', review_status = 'PEDAGOGICAL_REVIEWED'
      from public.tec_english_units unit
     where unit.id = lesson.unit_id and unit.course_code = p_course_code;
    update public.tec_english_exercises exercise
       set publication_status = 'PUBLISHED', review_status = 'PEDAGOGICAL_REVIEWED'
      from public.tec_english_lessons lesson
      join public.tec_english_units unit on unit.id = lesson.unit_id
     where lesson.id = exercise.lesson_id and unit.course_code = p_course_code;
  else
    update public.tec_english_courses
       set publication_status = 'STAGING', review_status = 'CHANGES_REQUESTED', updated_at = now()
     where course_code = p_course_code;
    update public.tec_english_units
       set publication_status = 'STAGING', review_status = 'CHANGES_REQUESTED'
     where course_code = p_course_code;
    update public.tec_english_lessons lesson
       set publication_status = 'STAGING', review_status = 'CHANGES_REQUESTED'
      from public.tec_english_units unit
     where unit.id = lesson.unit_id and unit.course_code = p_course_code;
    update public.tec_english_exercises exercise
       set publication_status = 'STAGING', review_status = 'CHANGES_REQUESTED'
      from public.tec_english_lessons lesson
      join public.tec_english_units unit on unit.id = lesson.unit_id
     where lesson.id = exercise.lesson_id and unit.course_code = p_course_code;
  end if;

  if private.tec_english_course_fingerprint(p_course_code, p_content_version) is distinct from p_expected_fingerprint then
    raise exception 'TEC_ENGLISH_REVIEW_CONTENT_CHANGED' using errcode = '40001';
  end if;

  select * into v_profile from public.profiles profile where profile.id = auth.uid();
  insert into public.tec_english_pedagogical_reviews(
    course_code, content_version, snapshot_fingerprint, decision, notes,
    reviewer_profile_id, reviewer_id_snapshot, reviewer_name, reviewer_email
  ) values (
    p_course_code, p_content_version, v_fingerprint, p_decision, btrim(p_notes),
    v_profile.id, auth.uid(), coalesce(nullif(btrim(v_profile.full_name), ''), v_profile.email), v_profile.email
  ) returning id into v_review_id;

  return pg_catalog.jsonb_build_object(
    'review_id', v_review_id,
    'course_code', p_course_code,
    'content_version', p_content_version,
    'decision', p_decision,
    'reviewer_name', coalesce(nullif(btrim(v_profile.full_name), ''), v_profile.email),
    'reviewer_email', v_profile.email,
    'reviewed_at', now(),
    'snapshot_fingerprint', v_fingerprint
  );
end;
$$;

revoke all on function public.get_tec_english_review_queue_v1() from public, anon;
revoke all on function public.get_tec_english_review_history_v1() from public, anon;
revoke all on function public.get_tec_english_review_preview_v1(text, integer) from public, anon;
revoke all on function public.review_tec_english_course_v1(text, integer, text, text, text, jsonb) from public, anon;
grant execute on function public.get_tec_english_review_queue_v1() to authenticated;
grant execute on function public.get_tec_english_review_history_v1() to authenticated;
grant execute on function public.get_tec_english_review_preview_v1(text, integer) to authenticated;
grant execute on function public.review_tec_english_course_v1(text, integer, text, text, text, jsonb) to authenticated;

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
            and course.publication_status = 'PUBLISHED'
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
            )
         )
       )
  );
$$;

revoke all on function private.tec_english_lesson_ready(text, boolean) from public, anon, authenticated;

-- Keep the original student RPC implementations private, then wrap them with
-- an institution-specific release gate. This prevents staging content from
-- appearing in maps, sessions, or replayed answer responses.
alter function public.get_tec_english_map_v1(uuid) set schema private;
alter function private.get_tec_english_map_v1(uuid) rename to tec_english_get_map_unchecked_v1;
alter function public.start_tec_english_lesson_v1(uuid, text) set schema private;
alter function private.start_tec_english_lesson_v1(uuid, text) rename to tec_english_start_lesson_unchecked_v1;
alter function public.get_tec_english_session_v1(uuid, uuid) set schema private;
alter function private.get_tec_english_session_v1(uuid, uuid) rename to tec_english_get_session_unchecked_v1;
alter function public.submit_tec_english_answer_v1(uuid, uuid, text, jsonb, uuid) set schema private;
alter function private.submit_tec_english_answer_v1(uuid, uuid, text, jsonb, uuid) rename to tec_english_submit_answer_unchecked_v1;

revoke all on function private.tec_english_get_map_unchecked_v1(uuid) from public, anon, authenticated;
revoke all on function private.tec_english_start_lesson_unchecked_v1(uuid, text) from public, anon, authenticated;
revoke all on function private.tec_english_get_session_unchecked_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function private.tec_english_submit_answer_unchecked_v1(uuid, uuid, text, jsonb, uuid) from public, anon, authenticated;

create or replace function public.get_tec_english_map_v1(p_institution_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_test_mode boolean := private.tec_english_test_mode();
  v_course_code text := case when private.tec_english_test_mode() then 'TEC_ENGLISH_FOUNDATIONS_TEST' else 'TEC_ENGLISH_FOUNDATIONS' end;
begin
  perform private.tec_english_current_student_id(p_institution_id);
  if not private.tec_english_course_available(p_institution_id, v_course_code, v_test_mode) then
    raise exception 'TEC_ENGLISH_COURSE_NOT_AVAILABLE' using errcode = '42501';
  end if;
  return private.tec_english_get_map_unchecked_v1(p_institution_id);
end;
$$;

create or replace function public.start_tec_english_lesson_v1(p_institution_id uuid, p_lesson_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_test_mode boolean := private.tec_english_test_mode();
  v_course_code text := case when private.tec_english_test_mode() then 'TEC_ENGLISH_FOUNDATIONS_TEST' else 'TEC_ENGLISH_FOUNDATIONS' end;
begin
  perform private.tec_english_current_student_id(p_institution_id);
  if not private.tec_english_course_available(p_institution_id, v_course_code, v_test_mode) then
    raise exception 'TEC_ENGLISH_COURSE_NOT_AVAILABLE' using errcode = '42501';
  end if;
  if not private.tec_english_lesson_ready(p_lesson_id, v_test_mode) then
    raise exception 'TEC_ENGLISH_CONTENT_NOT_APPROVED' using errcode = '42501';
  end if;
  return private.tec_english_start_lesson_unchecked_v1(p_institution_id, p_lesson_id);
end;
$$;

create or replace function public.get_tec_english_session_v1(p_institution_id uuid, p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := private.tec_english_current_student_id(p_institution_id);
  v_test_mode boolean := private.tec_english_test_mode();
  v_lesson_id text;
  v_course_code text;
begin
  select session.lesson_id, course.course_code
    into v_lesson_id, v_course_code
    from public.tec_english_lesson_sessions session
    join public.tec_english_lessons lesson on lesson.id = session.lesson_id
    join public.tec_english_units unit on unit.id = lesson.unit_id
    join public.tec_english_courses course on course.course_code = unit.course_code
   where session.id = p_session_id
     and session.institution_id = p_institution_id
     and session.student_id = v_student_id;
  if not found then raise exception 'TEC_ENGLISH_SESSION_NOT_FOUND' using errcode = '42501'; end if;
  if not private.tec_english_course_available(p_institution_id, v_course_code, v_test_mode)
     or not private.tec_english_lesson_ready(v_lesson_id, v_test_mode) then
    raise exception 'TEC_ENGLISH_COURSE_NOT_AVAILABLE' using errcode = '42501';
  end if;
  return private.tec_english_get_session_unchecked_v1(p_institution_id, p_session_id);
end;
$$;

create or replace function public.submit_tec_english_answer_v1(
  p_institution_id uuid,
  p_session_id uuid,
  p_exercise_id text,
  p_response jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := private.tec_english_current_student_id(p_institution_id);
  v_test_mode boolean := private.tec_english_test_mode();
  v_lesson_id text;
  v_course_code text;
begin
  select session.lesson_id, course.course_code
    into v_lesson_id, v_course_code
    from public.tec_english_lesson_sessions session
    join public.tec_english_lessons lesson on lesson.id = session.lesson_id
    join public.tec_english_units unit on unit.id = lesson.unit_id
    join public.tec_english_courses course on course.course_code = unit.course_code
   where session.id = p_session_id
     and session.institution_id = p_institution_id
     and session.student_id = v_student_id;
  if not found then raise exception 'TEC_ENGLISH_SESSION_NOT_FOUND' using errcode = '42501'; end if;
  if not private.tec_english_course_available(p_institution_id, v_course_code, v_test_mode)
     or not private.tec_english_lesson_ready(v_lesson_id, v_test_mode) then
    raise exception 'TEC_ENGLISH_COURSE_NOT_AVAILABLE' using errcode = '42501';
  end if;
  return private.tec_english_submit_answer_unchecked_v1(
    p_institution_id, p_session_id, p_exercise_id, p_response, p_idempotency_key
  );
end;
$$;

revoke all on function public.get_tec_english_review_queue_v1() from public, anon;
revoke all on function public.get_tec_english_review_history_v1() from public, anon;
revoke all on function public.get_tec_english_review_preview_v1(text, integer) from public, anon;
revoke all on function public.get_tec_english_release_targets_v1(text, integer, text) from public, anon;
revoke all on function public.set_tec_english_institution_release_v1(text, integer, uuid, boolean) from public, anon;
revoke all on function public.review_tec_english_course_v1(text, integer, text, text, text, jsonb) from public, anon;
grant execute on function public.get_tec_english_review_queue_v1() to authenticated;
grant execute on function public.get_tec_english_review_history_v1() to authenticated;
grant execute on function public.get_tec_english_review_preview_v1(text, integer) to authenticated;
grant execute on function public.get_tec_english_release_targets_v1(text, integer, text) to authenticated;
grant execute on function public.set_tec_english_institution_release_v1(text, integer, uuid, boolean) to authenticated;
grant execute on function public.review_tec_english_course_v1(text, integer, text, text, text, jsonb) to authenticated;

revoke all on function public.get_tec_english_map_v1(uuid) from public, anon;
revoke all on function public.start_tec_english_lesson_v1(uuid, text) from public, anon;
revoke all on function public.get_tec_english_session_v1(uuid, uuid) from public, anon;
revoke all on function public.submit_tec_english_answer_v1(uuid, uuid, text, jsonb, uuid) from public, anon;
grant execute on function public.get_tec_english_map_v1(uuid) to authenticated;
grant execute on function public.start_tec_english_lesson_v1(uuid, text) to authenticated;
grant execute on function public.get_tec_english_session_v1(uuid, uuid) to authenticated;
grant execute on function public.submit_tec_english_answer_v1(uuid, uuid, text, jsonb, uuid) to authenticated;

comment on table public.tec_english_course_releases is 'Institution allow-list for gradual Tec Inglês release; no school is enabled by default.';
comment on table public.tec_english_course_release_events is 'Audit history for enabling and disabling a reviewed Tec Inglês course at an institution.';
comment on function private.tec_english_course_available(uuid, text, boolean) is 'Requires test-mode fixture authorization or an exact approved course version enabled for the active institution.';
notify pgrst, 'reload schema';

comment on table public.tec_english_pedagogical_reviews is 'Append-only reviewer decisions tied to an exact content version fingerprint; a database decision is required before student publication.';
comment on function public.review_tec_english_course_v1(text, integer, text, text, text, jsonb) is 'Records a human SUPER_ADMIN review for an exact course snapshot and atomically publishes or returns the full version to staging.';
