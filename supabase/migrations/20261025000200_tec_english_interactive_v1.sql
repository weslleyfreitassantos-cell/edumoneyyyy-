-- Tec Inglês Interactive V1: isolated course progress and server-graded lessons.
-- Course content is stored separately from UI code and remains STAGING until reviewed.

create table public.tec_english_courses (
  course_code text primary key,
  content_version integer not null check (content_version > 0),
  title text not null,
  description text not null,
  author text not null,
  publication_status text not null check (publication_status in ('STAGING', 'PUBLISHED', 'ARCHIVED')),
  review_status text not null check (review_status in ('PEDAGOGICAL_REVIEW_PENDING', 'PEDAGOGICAL_REVIEWED', 'CHANGES_REQUESTED')),
  xp_per_lesson integer not null check (xp_per_lesson between 1 and 500),
  is_test_fixture boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tec_english_units (
  id text primary key,
  course_code text not null references public.tec_english_courses(course_code) on delete cascade,
  position integer not null check (position > 0),
  title text not null,
  description text not null,
  content_version integer not null check (content_version > 0),
  author text not null,
  publication_status text not null check (publication_status in ('STAGING', 'PUBLISHED', 'ARCHIVED')),
  review_status text not null check (review_status in ('PEDAGOGICAL_REVIEW_PENDING', 'PEDAGOGICAL_REVIEWED', 'CHANGES_REQUESTED')),
  created_at timestamptz not null default now(),
  unique (course_code, position)
);

create table public.tec_english_lessons (
  id text primary key,
  unit_id text not null references public.tec_english_units(id) on delete cascade,
  position integer not null check (position > 0),
  title text not null,
  introduction text not null,
  xp_reward integer not null check (xp_reward between 1 and 500),
  content_version integer not null check (content_version > 0),
  author text not null,
  publication_status text not null check (publication_status in ('STAGING', 'PUBLISHED', 'ARCHIVED')),
  review_status text not null check (review_status in ('PEDAGOGICAL_REVIEW_PENDING', 'PEDAGOGICAL_REVIEWED', 'CHANGES_REQUESTED')),
  created_at timestamptz not null default now(),
  unique (unit_id, position)
);

create table public.tec_english_exercises (
  id text primary key,
  lesson_id text not null references public.tec_english_lessons(id) on delete cascade,
  position integer not null check (position > 0),
  exercise_type text not null check (exercise_type in ('MULTIPLE_CHOICE', 'WORD_ORDER', 'TRANSLATION', 'LISTENING', 'MATCHING', 'FILL_BLANK', 'SPEAKING')),
  instruction text not null,
  prompt text not null,
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  word_bank jsonb not null default '[]'::jsonb check (jsonb_typeof(word_bank) = 'array'),
  left_items jsonb not null default '[]'::jsonb check (jsonb_typeof(left_items) = 'array'),
  right_items jsonb not null default '[]'::jsonb check (jsonb_typeof(right_items) = 'array'),
  audio_text text,
  accepted_answers jsonb not null default '[]'::jsonb check (jsonb_typeof(accepted_answers) = 'array'),
  answer_key jsonb not null,
  explanation text not null,
  content_version integer not null check (content_version > 0),
  author text not null,
  publication_status text not null check (publication_status in ('STAGING', 'PUBLISHED', 'ARCHIVED')),
  review_status text not null check (review_status in ('PEDAGOGICAL_REVIEW_PENDING', 'PEDAGOGICAL_REVIEWED', 'CHANGES_REQUESTED')),
  created_at timestamptz not null default now(),
  unique (lesson_id, position),
  check (jsonb_typeof(answer_key) = 'object')
);

create index tec_english_units_course_position_idx on public.tec_english_units(course_code, position);
create index tec_english_lessons_unit_position_idx on public.tec_english_lessons(unit_id, position);
create index tec_english_exercises_lesson_position_idx on public.tec_english_exercises(lesson_id, position);

create table public.tec_english_lesson_sessions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  lesson_id text not null references public.tec_english_lessons(id) on delete restrict,
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS', 'COMPLETED')),
  current_position integer not null default 1 check (current_position > 0),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index tec_english_one_active_session_idx
  on public.tec_english_lesson_sessions(institution_id, student_id, lesson_id)
  where status = 'IN_PROGRESS';
create index tec_english_sessions_student_idx
  on public.tec_english_lesson_sessions(institution_id, student_id, updated_at desc);

create table public.tec_english_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  lesson_id text not null references public.tec_english_lessons(id) on delete restrict,
  completion_count integer not null default 1 check (completion_count > 0),
  best_score integer not null default 0 check (best_score between 0 and 100),
  xp_awarded integer not null default 0 check (xp_awarded >= 0),
  last_session_id uuid references public.tec_english_lesson_sessions(id) on delete set null,
  first_completed_at timestamptz not null default now(),
  last_completed_at timestamptz not null default now(),
  unique (institution_id, student_id, lesson_id)
);
create index tec_english_progress_student_idx
  on public.tec_english_lesson_progress(institution_id, student_id, first_completed_at desc);

create table public.tec_english_answer_attempts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  session_id uuid not null references public.tec_english_lesson_sessions(id) on delete cascade,
  exercise_id text not null references public.tec_english_exercises(id) on delete restrict,
  idempotency_key uuid not null,
  response jsonb not null check (jsonb_typeof(response) = 'object'),
  is_correct boolean not null,
  result_payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (student_id, idempotency_key)
);
create index tec_english_attempts_session_idx
  on public.tec_english_answer_attempts(session_id, exercise_id, created_at);

create table public.tec_english_student_stats (
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= current_streak),
  last_study_date date,
  updated_at timestamptz not null default now(),
  primary key (institution_id, student_id)
);

create table public.tec_english_xp_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  event_key text not null,
  lesson_id text not null references public.tec_english_lessons(id) on delete restrict,
  xp integer not null check (xp > 0),
  created_at timestamptz not null default now(),
  unique (institution_id, student_id, event_key)
);

create or replace function private.tec_english_test_mode()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, auth
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'tec_english_test_mode', 'false') = 'true';
$$;

create or replace function private.tec_english_current_student_id(p_institution_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_student_id uuid;
begin
  if auth.uid() is null or p_institution_id is null then
    raise exception 'TEC_ENGLISH_STUDENT_SCOPE_DENIED' using errcode = '42501';
  end if;

  select student.id
    into v_student_id
    from public.students student
    join public.profiles profile
      on profile.id = student.profile_id
     and profile.active
    join public.memberships membership
      on membership.profile_id = student.profile_id
     and membership.institution_id = student.institution_id
     and membership.active
     and membership.role = 'STUDENT'
   where student.profile_id = auth.uid()
     and student.institution_id = p_institution_id
     and student.active
   order by student.id
   limit 1;

  if v_student_id is null then
    raise exception 'TEC_ENGLISH_STUDENT_SCOPE_DENIED' using errcode = '42501';
  end if;
  return v_student_id;
end;
$$;

create or replace function private.tec_english_lesson_ready(p_lesson_id text, p_test_mode boolean)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
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
         )
       )
  );
$$;

create or replace function private.tec_english_normalize_answer(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select trim(regexp_replace(regexp_replace(lower(coalesce(p_value, '')), '[^[:alnum:] ]', ' ', 'g'), '[[:space:]]+', ' ', 'g'));
$$;

create or replace function private.tec_english_public_exercise(p_exercise_id text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'id', exercise.id,
    'position', exercise.position,
    'type', exercise.exercise_type,
    'instruction', exercise.instruction,
    'prompt', exercise.prompt,
    'options', exercise.options,
    'word_bank', exercise.word_bank,
    'left_items', exercise.left_items,
    'right_items', exercise.right_items,
    'audio_text', exercise.audio_text
  )
    from public.tec_english_exercises exercise
   where exercise.id = p_exercise_id;
$$;

create or replace function private.tec_english_session_payload(p_session_id uuid, p_student_id uuid, p_institution_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select jsonb_build_object(
    'session_id', session.id,
    'lesson_id', lesson.id,
    'lesson_title', lesson.title,
    'lesson_intro', lesson.introduction,
    'unit_title', unit.title,
    'status', session.status,
    'current_position', session.current_position,
    'total_exercises', exercise_count.total,
    'exercise', private.tec_english_public_exercise(current_exercise.id)
  )
    from public.tec_english_lesson_sessions session
    join public.tec_english_lessons lesson on lesson.id = session.lesson_id
    join public.tec_english_units unit on unit.id = lesson.unit_id
    cross join lateral (select count(*)::integer as total from public.tec_english_exercises exercise where exercise.lesson_id = lesson.id) exercise_count
    left join public.tec_english_exercises current_exercise
      on current_exercise.lesson_id = lesson.id
     and current_exercise.position = session.current_position
   where session.id = p_session_id
     and session.student_id = p_student_id
     and session.institution_id = p_institution_id;
$$;

create or replace function public.get_tec_english_map_v1(p_institution_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_student_id uuid := private.tec_english_current_student_id(p_institution_id);
  v_test_mode boolean := private.tec_english_test_mode();
  v_course_code text;
  v_result jsonb;
begin
  v_course_code := case when v_test_mode then 'TEC_ENGLISH_FOUNDATIONS_TEST' else 'TEC_ENGLISH_FOUNDATIONS' end;
  with lesson_rows as (
    select lesson.id,
           lesson.unit_id,
           lesson.position,
           lesson.title,
           lesson.introduction,
           lesson.xp_reward,
           unit.position as unit_position,
           progress.first_completed_at,
           active_session.id as active_session_id,
           (select count(*)::integer from public.tec_english_exercises exercise where exercise.lesson_id = lesson.id) as exercise_count,
           private.tec_english_lesson_ready(lesson.id, v_test_mode) as content_ready
      from public.tec_english_lessons lesson
      join public.tec_english_units unit on unit.id = lesson.unit_id
      join public.tec_english_courses course on course.course_code = unit.course_code
      left join public.tec_english_lesson_progress progress
        on progress.institution_id = p_institution_id
       and progress.student_id = v_student_id
       and progress.lesson_id = lesson.id
      left join lateral (
        select session.id
          from public.tec_english_lesson_sessions session
         where session.institution_id = p_institution_id
           and session.student_id = v_student_id
           and session.lesson_id = lesson.id
           and session.status = 'IN_PROGRESS'
         order by session.updated_at desc
         limit 1
      ) active_session on true
      where course.course_code = v_course_code
  ), numbered_lessons as (
    select lesson_rows.*,
           row_number() over (order by unit_position, position) as course_position
      from lesson_rows
  ), lesson_states as (
    select current_lesson.*,
           case
             when active_session_id is not null then 'IN_PROGRESS'
             when first_completed_at is not null then 'COMPLETED'
             when exists (
               select 1 from numbered_lessons previous_lesson
                where previous_lesson.course_position < current_lesson.course_position
                  and previous_lesson.first_completed_at is null
             ) then 'LOCKED'
             when not content_ready then 'REVIEW_PENDING'
             else 'AVAILABLE'
           end as lesson_status
      from numbered_lessons current_lesson
  ), unit_json as (
    select unit.id,
           unit.position,
           unit.title,
           unit.description,
           coalesce(jsonb_agg(jsonb_build_object(
             'id', lesson.id,
             'position', lesson.position,
             'title', lesson.title,
             'status', lesson.lesson_status,
             'exercise_count', lesson.exercise_count,
             'xp_reward', lesson.xp_reward,
             'active_session_id', lesson.active_session_id,
             'completed_at', lesson.first_completed_at
           ) order by lesson.position) filter (where lesson.id is not null), '[]'::jsonb) as lessons
      from public.tec_english_units unit
      join public.tec_english_courses course on course.course_code = unit.course_code
      left join lesson_states lesson on lesson.unit_id = unit.id
      where course.course_code = v_course_code
     group by unit.id, unit.position, unit.title, unit.description
  )
  select jsonb_build_object(
    'course', (
      select jsonb_build_object(
        'code', course.course_code,
        'title', course.title,
        'description', course.description,
        'version', course.content_version,
        'publication_status', course.publication_status,
        'review_status', course.review_status
      ) from public.tec_english_courses course where course.course_code = v_course_code
    ),
    'units', coalesce((select jsonb_agg(jsonb_build_object(
      'id', unit.id,
      'position', unit.position,
      'title', unit.title,
      'description', unit.description,
      'lessons', unit.lessons
    ) order by unit.position) from unit_json unit), '[]'::jsonb),
    'stats', (
      select jsonb_build_object(
        'xp', coalesce(stats.xp, 0),
        'current_streak', coalesce(stats.current_streak, 0),
        'longest_streak', coalesce(stats.longest_streak, 0),
        'last_study_date', stats.last_study_date
      ) from (select 1) seed
      left join public.tec_english_student_stats stats
        on stats.institution_id = p_institution_id and stats.student_id = v_student_id
    ),
    'completed_lessons', (
      select count(*)::integer
        from public.tec_english_lesson_progress progress
        join public.tec_english_lessons lesson on lesson.id = progress.lesson_id
        join public.tec_english_units unit on unit.id = lesson.unit_id
       where progress.institution_id = p_institution_id
         and progress.student_id = v_student_id
         and unit.course_code = v_course_code
    ),
    'total_lessons', (select count(*)::integer from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = v_course_code),
    'continue_lesson_id', (
      select lesson.id from lesson_states lesson
       where lesson.lesson_status in ('IN_PROGRESS', 'AVAILABLE')
       order by case lesson.lesson_status when 'IN_PROGRESS' then 0 else 1 end, lesson.unit_position, lesson.position
       limit 1
    )
  ) into v_result;

  if v_result -> 'course' = 'null'::jsonb then
    raise exception 'TEC_ENGLISH_COURSE_NOT_FOUND';
  end if;
  return v_result;
end;
$$;

create or replace function public.start_tec_english_lesson_v1(p_institution_id uuid, p_lesson_id text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_student_id uuid := private.tec_english_current_student_id(p_institution_id);
  v_test_mode boolean := private.tec_english_test_mode();
  v_course_code text;
  v_session_id uuid;
  v_lesson_position integer;
begin
  v_course_code := case when v_test_mode then 'TEC_ENGLISH_FOUNDATIONS_TEST' else 'TEC_ENGLISH_FOUNDATIONS' end;
  if not private.tec_english_lesson_ready(p_lesson_id, v_test_mode) then
    raise exception 'TEC_ENGLISH_CONTENT_NOT_APPROVED' using errcode = '42501';
  end if;

  select unit.position * 10000 + lesson.position
    into v_lesson_position
    from public.tec_english_lessons lesson
    join public.tec_english_units unit on unit.id = lesson.unit_id
    join public.tec_english_courses course on course.course_code = unit.course_code
   where lesson.id = p_lesson_id and course.course_code = v_course_code;
  if v_lesson_position is null then raise exception 'TEC_ENGLISH_LESSON_NOT_FOUND'; end if;

  if exists (
    select 1
      from public.tec_english_lessons previous_lesson
      join public.tec_english_units previous_unit on previous_unit.id = previous_lesson.unit_id
      join public.tec_english_courses course on course.course_code = previous_unit.course_code
     where course.course_code = v_course_code
       and previous_unit.position * 10000 + previous_lesson.position < v_lesson_position
       and not exists (
         select 1 from public.tec_english_lesson_progress progress
          where progress.institution_id = p_institution_id
            and progress.student_id = v_student_id
            and progress.lesson_id = previous_lesson.id
       )
  ) then
    raise exception 'TEC_ENGLISH_LESSON_LOCKED' using errcode = '42501';
  end if;

  select session.id into v_session_id
    from public.tec_english_lesson_sessions session
   where session.institution_id = p_institution_id
     and session.student_id = v_student_id
     and session.lesson_id = p_lesson_id
     and session.status = 'IN_PROGRESS'
   order by session.updated_at desc
   limit 1;

  if v_session_id is null then
    insert into public.tec_english_lesson_sessions(institution_id, student_id, lesson_id)
    values (p_institution_id, v_student_id, p_lesson_id)
    on conflict (institution_id, student_id, lesson_id) where status = 'IN_PROGRESS' do nothing
    returning id into v_session_id;
    if v_session_id is null then
      select session.id into v_session_id
        from public.tec_english_lesson_sessions session
       where session.institution_id = p_institution_id
         and session.student_id = v_student_id
         and session.lesson_id = p_lesson_id
         and session.status = 'IN_PROGRESS'
       for update;
    end if;
  end if;

  return private.tec_english_session_payload(v_session_id, v_student_id, p_institution_id);
end;
$$;

create or replace function public.get_tec_english_session_v1(p_institution_id uuid, p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_student_id uuid := private.tec_english_current_student_id(p_institution_id);
  v_payload jsonb;
begin
  select private.tec_english_session_payload(p_session_id, v_student_id, p_institution_id)
    into v_payload;
  if v_payload is null then raise exception 'TEC_ENGLISH_SESSION_NOT_FOUND' using errcode = '42501'; end if;
  return v_payload;
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
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_student_id uuid := private.tec_english_current_student_id(p_institution_id);
  v_session public.tec_english_lesson_sessions%rowtype;
  v_exercise public.tec_english_exercises%rowtype;
  v_existing public.tec_english_answer_attempts%rowtype;
  v_answer_text text;
  v_correct boolean := false;
  v_result jsonb;
  v_total integer;
  v_score integer;
  v_first_completion boolean := false;
  v_awarded_xp integer := 0;
  v_total_xp integer := 0;
  v_streak integer := 0;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_previous_study_date date;
  v_next_position integer;
begin
  if p_idempotency_key is null or p_response is null or jsonb_typeof(p_response) <> 'object'
     or octet_length(p_response::text) > 2000 then
    raise exception 'TEC_ENGLISH_INVALID_RESPONSE' using errcode = '22023';
  end if;

  select * into v_session
    from public.tec_english_lesson_sessions session
   where session.id = p_session_id
     and session.institution_id = p_institution_id
     and session.student_id = v_student_id
   for update;
  if not found then raise exception 'TEC_ENGLISH_SESSION_NOT_FOUND' using errcode = '42501'; end if;

  select * into v_existing
    from public.tec_english_answer_attempts attempt
   where attempt.student_id = v_student_id
     and attempt.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.session_id <> p_session_id or v_existing.exercise_id <> p_exercise_id or v_existing.response <> p_response then
      raise exception 'TEC_ENGLISH_IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;
    return v_existing.result_payload;
  end if;

  if v_session.status <> 'IN_PROGRESS' then raise exception 'TEC_ENGLISH_SESSION_COMPLETED'; end if;
  select exercise.* into v_exercise
    from public.tec_english_exercises exercise
   where exercise.id = p_exercise_id
     and exercise.lesson_id = v_session.lesson_id
     and exercise.position = v_session.current_position;
  if not found then raise exception 'TEC_ENGLISH_EXERCISE_OUT_OF_ORDER' using errcode = '22023'; end if;

  if v_exercise.exercise_type in ('MULTIPLE_CHOICE', 'FILL_BLANK') then
    if jsonb_typeof(p_response -> 'choice') is distinct from 'string' or length(p_response ->> 'choice') > 120 then
      raise exception 'TEC_ENGLISH_INVALID_RESPONSE' using errcode = '22023';
    end if;
    v_answer_text := p_response ->> 'choice';
  elsif v_exercise.exercise_type = 'WORD_ORDER' then
    if jsonb_typeof(p_response -> 'tokens') is distinct from 'array' then
      raise exception 'TEC_ENGLISH_INVALID_RESPONSE' using errcode = '22023';
    end if;
    if jsonb_array_length(p_response -> 'tokens') not between 2 and 20
       or exists (select 1 from jsonb_array_elements(p_response -> 'tokens') token where jsonb_typeof(token) <> 'string') then
      raise exception 'TEC_ENGLISH_INVALID_RESPONSE' using errcode = '22023';
    end if;
    select string_agg(value, ' ' order by ordinal)
      into v_answer_text
      from jsonb_array_elements_text(p_response -> 'tokens') with ordinality as tokens(value, ordinal);
  elsif v_exercise.exercise_type = 'MATCHING' then
    if jsonb_typeof(p_response -> 'pairs') is distinct from 'object' then
      raise exception 'TEC_ENGLISH_INVALID_RESPONSE' using errcode = '22023';
    end if;
    if jsonb_object_length(p_response -> 'pairs') <> jsonb_object_length(v_exercise.answer_key -> 'pairs') then
      raise exception 'TEC_ENGLISH_INVALID_RESPONSE' using errcode = '22023';
    end if;
  else
    if jsonb_typeof(p_response -> 'text') is distinct from 'string'
       or length(btrim(p_response ->> 'text')) = 0
       or length(p_response ->> 'text') > 300 then
      raise exception 'TEC_ENGLISH_INVALID_RESPONSE' using errcode = '22023';
    end if;
    v_answer_text := p_response ->> 'text';
  end if;

  if v_exercise.exercise_type = 'MATCHING' then
    v_correct := p_response -> 'pairs' = v_exercise.answer_key -> 'pairs';
  else
    v_correct := exists (
      select 1 from jsonb_array_elements_text(v_exercise.accepted_answers) accepted(answer)
       where private.tec_english_normalize_answer(accepted.answer) = private.tec_english_normalize_answer(v_answer_text)
    );
  end if;

  v_total := (select count(*)::integer from public.tec_english_exercises exercise where exercise.lesson_id = v_session.lesson_id);
  if v_correct then
    v_next_position := v_session.current_position + 1;
    if v_next_position > v_total then
      update public.tec_english_lesson_sessions
         set current_position = v_next_position, status = 'COMPLETED', completed_at = now(), updated_at = now()
       where id = v_session.id;

      select (count(*) filter (where first_try.is_correct))::integer
        into v_score
        from (
          select distinct on (attempt.exercise_id) attempt.exercise_id, attempt.is_correct
            from public.tec_english_answer_attempts attempt
           where attempt.session_id = v_session.id
           order by attempt.exercise_id, attempt.created_at, attempt.id
        ) first_try;
      -- Count this correct response only when no earlier attempt exists for this exercise.
      if not exists (
        select 1 from public.tec_english_answer_attempts attempt
         where attempt.session_id = v_session.id
           and attempt.exercise_id = v_exercise.id
      ) then
        v_score := coalesce(v_score, 0) + 1;
      end if;
      v_score := round(100.0 * coalesce(v_score, 0) / greatest(v_total, 1))::integer;

      insert into public.tec_english_lesson_progress(
        institution_id, student_id, lesson_id, completion_count, best_score, xp_awarded, last_session_id, first_completed_at, last_completed_at
      ) values (
        p_institution_id, v_student_id, v_session.lesson_id, 1, v_score, 0, v_session.id, now(), now()
      ) on conflict (institution_id, student_id, lesson_id) do nothing
      returning true into v_first_completion;
      v_first_completion := coalesce(v_first_completion, false);

      if not v_first_completion then
        update public.tec_english_lesson_progress progress
           set completion_count = progress.completion_count + 1,
               best_score = greatest(progress.best_score, v_score),
               last_session_id = v_session.id,
               last_completed_at = now()
         where progress.institution_id = p_institution_id
           and progress.student_id = v_student_id
           and progress.lesson_id = v_session.lesson_id;
      else
        select lesson.xp_reward into v_awarded_xp
          from public.tec_english_lessons lesson where lesson.id = v_session.lesson_id;
        insert into public.tec_english_xp_events(institution_id, student_id, event_key, lesson_id, xp)
        values (p_institution_id, v_student_id, 'lesson:' || v_session.lesson_id, v_session.lesson_id, v_awarded_xp)
        on conflict (institution_id, student_id, event_key) do nothing;

        if found then
          select stats.last_study_date into v_previous_study_date
            from public.tec_english_student_stats stats
           where stats.institution_id = p_institution_id and stats.student_id = v_student_id
           for update;
          insert into public.tec_english_student_stats(institution_id, student_id, xp, current_streak, longest_streak, last_study_date)
          values (
            p_institution_id, v_student_id, v_awarded_xp,
            case when v_previous_study_date = v_today then 1 when v_previous_study_date = v_today - 1 then 2 else 1 end,
            case when v_previous_study_date = v_today then 1 when v_previous_study_date = v_today - 1 then 2 else 1 end,
            v_today
          )
          on conflict (institution_id, student_id) do update
            set xp = public.tec_english_student_stats.xp + excluded.xp,
                current_streak = case
                  when public.tec_english_student_stats.last_study_date = v_today then public.tec_english_student_stats.current_streak
                  when public.tec_english_student_stats.last_study_date = v_today - 1 then public.tec_english_student_stats.current_streak + 1
                  else 1
                end,
                longest_streak = greatest(
                  public.tec_english_student_stats.longest_streak,
                  case
                    when public.tec_english_student_stats.last_study_date = v_today then public.tec_english_student_stats.current_streak
                    when public.tec_english_student_stats.last_study_date = v_today - 1 then public.tec_english_student_stats.current_streak + 1
                    else 1
                  end
                ),
                last_study_date = v_today,
                updated_at = now();
        else
          v_awarded_xp := 0;
        end if;
        update public.tec_english_lesson_progress progress
           set xp_awarded = v_awarded_xp
         where progress.institution_id = p_institution_id
           and progress.student_id = v_student_id
           and progress.lesson_id = v_session.lesson_id;
      end if;
    else
      update public.tec_english_lesson_sessions
         set current_position = v_next_position, updated_at = now()
       where id = v_session.id;
    end if;
  end if;

  select coalesce(stats.xp, 0), coalesce(stats.current_streak, 0)
    into v_total_xp, v_streak
    from (select 1) seed
    left join public.tec_english_student_stats stats
      on stats.institution_id = p_institution_id and stats.student_id = v_student_id;

  v_result := jsonb_build_object(
    'is_correct', v_correct,
    'feedback', case when v_correct then 'Muito bem! Você acertou.' else 'Quase! Revise a dica e tente novamente.' end,
    'explanation', v_exercise.explanation,
    'session_complete', v_correct and v_next_position > v_total,
    'next_position', case when v_correct then v_next_position else v_session.current_position end,
    'total_exercises', v_total,
    'xp_awarded', case when v_correct and v_next_position > v_total then v_awarded_xp else 0 end,
    'total_xp', v_total_xp,
    'current_streak', v_streak,
    'next_exercise', case when v_correct and v_next_position <= v_total then private.tec_english_public_exercise((select exercise.id from public.tec_english_exercises exercise where exercise.lesson_id = v_session.lesson_id and exercise.position = v_next_position)) else null end
  );

  insert into public.tec_english_answer_attempts(
    institution_id, student_id, session_id, exercise_id, idempotency_key, response, is_correct, result_payload
  ) values (
    p_institution_id, v_student_id, p_session_id, p_exercise_id, p_idempotency_key, p_response, v_correct, v_result
  );
  return v_result;
end;
$$;

alter table public.tec_english_courses enable row level security;
alter table public.tec_english_units enable row level security;
alter table public.tec_english_lessons enable row level security;
alter table public.tec_english_exercises enable row level security;
alter table public.tec_english_lesson_sessions enable row level security;
alter table public.tec_english_lesson_progress enable row level security;
alter table public.tec_english_answer_attempts enable row level security;
alter table public.tec_english_student_stats enable row level security;
alter table public.tec_english_xp_events enable row level security;

revoke all on table public.tec_english_courses, public.tec_english_units, public.tec_english_lessons,
  public.tec_english_exercises, public.tec_english_lesson_sessions, public.tec_english_lesson_progress,
  public.tec_english_answer_attempts, public.tec_english_student_stats, public.tec_english_xp_events
  from anon, authenticated;
grant all on table public.tec_english_courses, public.tec_english_units, public.tec_english_lessons,
  public.tec_english_exercises, public.tec_english_lesson_sessions, public.tec_english_lesson_progress,
  public.tec_english_answer_attempts, public.tec_english_student_stats, public.tec_english_xp_events
  to service_role;

revoke all on function private.tec_english_test_mode() from public, anon, authenticated;
revoke all on function private.tec_english_current_student_id(uuid) from public, anon, authenticated;
revoke all on function private.tec_english_lesson_ready(text, boolean) from public, anon, authenticated;
revoke all on function private.tec_english_normalize_answer(text) from public, anon, authenticated;
revoke all on function private.tec_english_public_exercise(text) from public, anon, authenticated;
revoke all on function private.tec_english_session_payload(uuid, uuid, uuid) from public, anon, authenticated;

revoke all on function public.get_tec_english_map_v1(uuid) from public, anon;
revoke all on function public.start_tec_english_lesson_v1(uuid, text) from public, anon;
revoke all on function public.get_tec_english_session_v1(uuid, uuid) from public, anon;
revoke all on function public.submit_tec_english_answer_v1(uuid, uuid, text, jsonb, uuid) from public, anon;
grant execute on function public.get_tec_english_map_v1(uuid) to authenticated;
grant execute on function public.start_tec_english_lesson_v1(uuid, text) to authenticated;
grant execute on function public.get_tec_english_session_v1(uuid, uuid) to authenticated;
grant execute on function public.submit_tec_english_answer_v1(uuid, uuid, text, jsonb, uuid) to authenticated;

comment on table public.tec_english_courses is 'Versioned Tec Inglês course catalog; publication and pedagogical review are independent gates.';
comment on table public.tec_english_exercises is 'Server-graded English exercises. answer_key and accepted_answers are never returned by student RPCs.';
comment on table public.tec_english_lesson_progress is 'English-only lesson completions; isolated from general daily plans and gamification.';
comment on function public.submit_tec_english_answer_v1(uuid, uuid, text, jsonb, uuid) is 'Validates a student answer on the server and awards course XP at most once per lesson.';
