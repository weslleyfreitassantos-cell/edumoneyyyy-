-- Shared, gated runtime for the additive English expansion, Spanish V1, and Korean V1.
-- Every course remains STAGING until the existing exact-version review and
-- institution-release workflow approves and enables it.

create table public.tec_language_course_stats_v1 (
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  course_code text not null references public.tec_english_courses(course_code) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= current_streak),
  last_study_date date,
  updated_at timestamptz not null default now(),
  primary key (institution_id, student_id, course_code)
);

alter table public.tec_language_course_stats_v1 enable row level security;
revoke all on table public.tec_language_course_stats_v1 from public, anon, authenticated;
grant all on table public.tec_language_course_stats_v1 to service_role;
comment on table public.tec_language_course_stats_v1 is
  'Per-course Tec Idiomas XP and streaks; student RPCs update this table without mixing language stats into legacy Tec Inglês totals.';

create or replace function private.tec_idiomas_v3_course_allowed(p_course_code text)
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
revoke all on function private.tec_idiomas_v3_course_allowed(text) from public, anon, authenticated;

-- Preserve the existing English V2 snapshot byte-for-byte while including the
-- v2 metadata in fingerprints for only the new, allowlisted course codes.
create or replace function private.tec_english_course_snapshot(p_course_code text, p_content_version integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'course', pg_catalog.jsonb_build_object(
      'course_code', course.course_code, 'content_version', course.content_version,
      'title', course.title, 'description', course.description,
      'author', course.author, 'xp_per_lesson', course.xp_per_lesson
    ),
    'units', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', unit.id, 'position', unit.position, 'title', unit.title,
        'description', unit.description, 'content_version', unit.content_version,
        'author', unit.author, 'lessons', coalesce((
          select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'id', lesson.id, 'position', lesson.position, 'title', lesson.title,
            'introduction', lesson.introduction, 'xp_reward', lesson.xp_reward,
            'content_version', lesson.content_version, 'author', lesson.author,
            'exercises', coalesce((
              select pg_catalog.jsonb_agg((pg_catalog.jsonb_build_object(
                'id', exercise.id, 'position', exercise.position,
                'type', exercise.exercise_type, 'instruction', exercise.instruction,
                'prompt', exercise.prompt, 'options', exercise.options,
                'word_bank', exercise.word_bank, 'left_items', exercise.left_items,
                'right_items', exercise.right_items, 'audio_text', exercise.audio_text,
                'accepted_answers', exercise.accepted_answers, 'answer_key', exercise.answer_key,
                'explanation', exercise.explanation,
                'content_version', exercise.content_version, 'author', exercise.author
              ) || case when p_course_code in (
                   'TEC_ENGLISH_FOUNDATIONS_V2',
                   'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION',
                   'TEC_SPANISH_FOUNDATIONS_V1',
                   'TEC_KOREAN_FOUNDATIONS_V1'
                 ) or p_course_code like 'TEC_ENGLISH_FOUNDATIONS_V2_TEST%'
                   then pg_catalog.jsonb_build_object('skill_code', exercise.skill_code,
                     'difficulty_level', exercise.difficulty_level, 'dialogue_speaker', exercise.dialogue_speaker,
                     'dialogue_context', exercise.dialogue_context)
                   else '{}'::jsonb end) order by exercise.position)
                from public.tec_english_exercises exercise where exercise.lesson_id = lesson.id
            ), '[]'::jsonb)
          ) order by lesson.position)
            from public.tec_english_lessons lesson where lesson.unit_id = unit.id
        ), '[]'::jsonb)
      ) order by unit.position)
        from public.tec_english_units unit where unit.course_code = course.course_code
    ), '[]'::jsonb)
  )
    from public.tec_english_courses course
   where course.course_code = p_course_code and course.content_version = p_content_version;
$$;
revoke all on function private.tec_english_course_snapshot(text, integer) from public, anon, authenticated;

create or replace function private.tec_english_public_exercise(p_exercise_id text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'id', exercise.id, 'position', exercise.position, 'type', exercise.exercise_type,
    'instruction', exercise.instruction, 'prompt', exercise.prompt,
    'options', exercise.options, 'word_bank', exercise.word_bank,
    'left_items', exercise.left_items, 'right_items', exercise.right_items,
    'audio_text', exercise.audio_text
  )
  || case when unit.course_code in (
       'TEC_ENGLISH_FOUNDATIONS_V2',
       'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION',
       'TEC_SPANISH_FOUNDATIONS_V1',
       'TEC_KOREAN_FOUNDATIONS_V1'
     ) or unit.course_code like 'TEC_ENGLISH_FOUNDATIONS_V2_TEST%'
       then jsonb_build_object('skill_code', exercise.skill_code,
         'difficulty_level', exercise.difficulty_level, 'dialogue_speaker', exercise.dialogue_speaker,
         'dialogue_context', exercise.dialogue_context)
       else '{}'::jsonb end
    from public.tec_english_exercises exercise
    join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id
    join public.tec_english_units unit on unit.id = lesson.unit_id
   where exercise.id = p_exercise_id;
$$;
revoke all on function private.tec_english_public_exercise(text) from public, anon, authenticated;

create or replace function public.get_tec_language_course_map_v1(p_institution_id uuid, p_course_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := private.tec_english_current_student_id(p_institution_id);
  v_result jsonb;
begin
  if not private.tec_idiomas_v3_course_allowed(p_course_code)
     or private.tec_english_test_mode()
     or not private.tec_english_course_available(p_institution_id, p_course_code, false) then
    raise exception 'TEC_ENGLISH_COURSE_NOT_AVAILABLE' using errcode = '42501';
  end if;

  with lesson_rows as (
    select lesson.id, lesson.unit_id, lesson.position, lesson.title, lesson.xp_reward,
      unit.position as unit_position, progress.first_completed_at, active_session.id as active_session_id,
      (select count(*)::integer from public.tec_english_exercises exercise where exercise.lesson_id = lesson.id) as exercise_count,
      private.tec_english_lesson_ready(lesson.id, false) as content_ready
    from public.tec_english_lessons lesson
    join public.tec_english_units unit on unit.id = lesson.unit_id
    left join public.tec_english_lesson_progress progress
      on progress.institution_id = p_institution_id and progress.student_id = v_student_id and progress.lesson_id = lesson.id
    left join lateral (
      select session.id from public.tec_english_lesson_sessions session
       where session.institution_id = p_institution_id and session.student_id = v_student_id
         and session.lesson_id = lesson.id and session.status = 'IN_PROGRESS'
       order by session.updated_at desc limit 1
    ) active_session on true
    where unit.course_code = p_course_code
  ), numbered as (
    select lesson_rows.*, row_number() over(order by unit_position, position) as course_position from lesson_rows
  ), lesson_states as (
    select current_lesson.*,
      case when active_session_id is not null then 'IN_PROGRESS'
           when first_completed_at is not null then 'COMPLETED'
           when exists (select 1 from numbered previous where previous.course_position < current_lesson.course_position and previous.first_completed_at is null) then 'LOCKED'
           when not content_ready then 'REVIEW_PENDING'
           else 'AVAILABLE' end as lesson_status
      from numbered current_lesson
  ), unit_json as (
    select unit.id, unit.position, unit.title, unit.description,
      coalesce(jsonb_agg(jsonb_build_object(
        'id', lesson.id, 'position', lesson.position, 'title', lesson.title,
        'status', lesson.lesson_status, 'exercise_count', lesson.exercise_count,
        'xp_reward', lesson.xp_reward, 'active_session_id', lesson.active_session_id,
        'completed_at', lesson.first_completed_at, 'course_code', p_course_code
      ) order by lesson.position) filter (where lesson.id is not null), '[]'::jsonb) as lessons
      from public.tec_english_units unit
      left join lesson_states lesson on lesson.unit_id = unit.id
      where unit.course_code = p_course_code
      group by unit.id, unit.position, unit.title, unit.description
  )
  select jsonb_build_object(
    'course', (select jsonb_build_object('code', course.course_code, 'title', course.title,
      'description', course.description, 'version', course.content_version,
      'publication_status', course.publication_status, 'review_status', course.review_status)
      from public.tec_english_courses course where course.course_code = p_course_code),
    'units', coalesce((select jsonb_agg(jsonb_build_object('id', unit.id, 'position', unit.position,
      'title', unit.title, 'description', unit.description, 'lessons', unit.lessons) order by unit.position)
      from unit_json unit), '[]'::jsonb),
    'stats', (select jsonb_build_object('xp', coalesce(stats.xp, 0),
      'current_streak', coalesce(stats.current_streak, 0), 'longest_streak', coalesce(stats.longest_streak, 0),
      'last_study_date', stats.last_study_date)
      from (select 1) seed left join public.tec_language_course_stats_v1 stats
        on stats.institution_id = p_institution_id and stats.student_id = v_student_id and stats.course_code = p_course_code),
    'completed_lessons', (select count(*)::integer from public.tec_english_lesson_progress progress
      join public.tec_english_lessons lesson on lesson.id = progress.lesson_id
      join public.tec_english_units unit on unit.id = lesson.unit_id
      where progress.institution_id = p_institution_id and progress.student_id = v_student_id and unit.course_code = p_course_code),
    'total_lessons', (select count(*)::integer from public.tec_english_lessons lesson
      join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = p_course_code),
    'continue_lesson_id', (select lesson.id from lesson_states lesson
      where lesson.lesson_status in ('IN_PROGRESS', 'AVAILABLE')
      order by case lesson.lesson_status when 'IN_PROGRESS' then 0 else 1 end, lesson.unit_position, lesson.position limit 1)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.start_tec_language_lesson_v1(p_institution_id uuid, p_course_code text, p_lesson_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := private.tec_english_current_student_id(p_institution_id);
  v_session_id uuid;
begin
  if not private.tec_idiomas_v3_course_allowed(p_course_code)
     or private.tec_english_test_mode()
     or not private.tec_english_course_available(p_institution_id, p_course_code, false)
     or not private.tec_english_lesson_ready(p_lesson_id, false)
     or not exists (select 1 from public.tec_english_lessons lesson
       join public.tec_english_units unit on unit.id = lesson.unit_id
       where lesson.id = p_lesson_id and unit.course_code = p_course_code) then
    raise exception 'TEC_ENGLISH_CONTENT_NOT_APPROVED' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.tec_english_lessons target
    join public.tec_english_units target_unit on target_unit.id = target.unit_id
    join public.tec_english_lessons previous on true
    join public.tec_english_units previous_unit on previous_unit.id = previous.unit_id
    where target.id = p_lesson_id and target_unit.course_code = p_course_code
      and previous_unit.course_code = p_course_code
      and (previous_unit.position, previous.position) < (target_unit.position, target.position)
      and not exists (select 1 from public.tec_english_lesson_progress progress
        where progress.institution_id = p_institution_id and progress.student_id = v_student_id and progress.lesson_id = previous.id)
  ) then raise exception 'TEC_ENGLISH_LESSON_LOCKED' using errcode = '42501'; end if;

  select session.id into v_session_id from public.tec_english_lesson_sessions session
   where session.institution_id = p_institution_id and session.student_id = v_student_id
     and session.lesson_id = p_lesson_id and session.status = 'IN_PROGRESS'
   order by session.updated_at desc limit 1 for update;
  if v_session_id is null then
    insert into public.tec_english_lesson_sessions(institution_id, student_id, lesson_id)
    values (p_institution_id, v_student_id, p_lesson_id)
    on conflict (institution_id, student_id, lesson_id) where status = 'IN_PROGRESS' do nothing
    returning id into v_session_id;
    if v_session_id is null then
      select session.id into v_session_id from public.tec_english_lesson_sessions session
       where session.institution_id = p_institution_id and session.student_id = v_student_id
         and session.lesson_id = p_lesson_id and session.status = 'IN_PROGRESS' for update;
    end if;
  end if;
  return private.tec_english_session_payload(v_session_id, v_student_id, p_institution_id);
end;
$$;

create or replace function public.get_tec_language_session_v1(p_institution_id uuid, p_course_code text, p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := private.tec_english_current_student_id(p_institution_id);
  v_lesson_id text;
  v_course_code text;
  v_result jsonb;
begin
  select session.lesson_id, unit.course_code into v_lesson_id, v_course_code
    from public.tec_english_lesson_sessions session
    join public.tec_english_lessons lesson on lesson.id = session.lesson_id
    join public.tec_english_units unit on unit.id = lesson.unit_id
   where session.id = p_session_id and session.student_id = v_student_id and session.institution_id = p_institution_id;
  if not found or v_course_code is distinct from p_course_code
     or not private.tec_idiomas_v3_course_allowed(p_course_code)
     or private.tec_english_test_mode()
     or not private.tec_english_course_available(p_institution_id, p_course_code, false)
     or not private.tec_english_lesson_ready(v_lesson_id, false) then
    raise exception 'TEC_ENGLISH_SESSION_NOT_FOUND' using errcode = '42501';
  end if;
  select private.tec_english_session_payload(p_session_id, v_student_id, p_institution_id) into v_result;
  return v_result;
end;
$$;

create or replace function public.submit_tec_language_answer_v1(
  p_institution_id uuid, p_course_code text, p_session_id uuid,
  p_exercise_id text, p_response jsonb, p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := private.tec_english_current_student_id(p_institution_id);
  v_course_code text;
  v_lesson_id text;
  v_created_stats_row boolean := false;
  v_was_replay boolean := false;
  v_had_xp_event boolean := false;
  v_old_stats public.tec_english_student_stats%rowtype;
  v_result jsonb;
  v_awarded_xp integer := 0;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_language_stats public.tec_language_course_stats_v1%rowtype;
begin
  select lesson.id, unit.course_code into v_lesson_id, v_course_code
    from public.tec_english_lesson_sessions session
    join public.tec_english_lessons lesson on lesson.id = session.lesson_id
    join public.tec_english_units unit on unit.id = lesson.unit_id
   where session.id = p_session_id and session.student_id = v_student_id and session.institution_id = p_institution_id;
  if not found or v_course_code is distinct from p_course_code
     or not private.tec_idiomas_v3_course_allowed(p_course_code)
     or private.tec_english_test_mode()
     or not private.tec_english_course_available(p_institution_id, p_course_code, false)
     or not private.tec_english_lesson_ready(v_lesson_id, false) then
    raise exception 'TEC_ENGLISH_SESSION_NOT_FOUND' using errcode = '42501';
  end if;

  select exists (select 1 from public.tec_english_answer_attempts attempt
    where attempt.student_id = v_student_id and attempt.idempotency_key = p_idempotency_key) into v_was_replay;
  select exists (select 1 from public.tec_english_xp_events event
    where event.institution_id = p_institution_id and event.student_id = v_student_id
      and event.event_key = 'lesson:' || v_lesson_id) into v_had_xp_event;

  -- The legacy scorer still maintains global English totals. Lock and restore
  -- that row around the shared grading/progress transaction so the new course
  -- writes its visible XP and streak only into its own course-scoped row.
  insert into public.tec_english_student_stats(institution_id, student_id)
    values (p_institution_id, v_student_id)
    on conflict (institution_id, student_id) do nothing
    returning true into v_created_stats_row;
  v_created_stats_row := coalesce(v_created_stats_row, false);
  select * into v_old_stats from public.tec_english_student_stats stats
   where stats.institution_id = p_institution_id and stats.student_id = v_student_id for update;

  v_result := private.tec_english_submit_answer_unchecked_v1(
    p_institution_id, p_session_id, p_exercise_id, p_response, p_idempotency_key
  );
  v_awarded_xp := coalesce((v_result ->> 'xp_awarded')::integer, 0);

  -- The shared scorer creates a global English XP event. Keep Spanish and
  -- Korean XP isolated in tec_language_course_stats_v1 by removing only the
  -- event newly created by this transaction; pre-existing events are retained.
  if not v_had_xp_event and v_awarded_xp > 0 then
    delete from public.tec_english_xp_events event
     where event.institution_id = p_institution_id and event.student_id = v_student_id
       and event.event_key = 'lesson:' || v_lesson_id;
  end if;

  if v_created_stats_row then
    delete from public.tec_english_student_stats stats
     where stats.institution_id = p_institution_id and stats.student_id = v_student_id;
  else
    update public.tec_english_student_stats stats set
      xp = v_old_stats.xp, current_streak = v_old_stats.current_streak,
      longest_streak = v_old_stats.longest_streak, last_study_date = v_old_stats.last_study_date,
      updated_at = v_old_stats.updated_at
     where stats.institution_id = p_institution_id and stats.student_id = v_student_id;
  end if;

  if not v_was_replay and v_awarded_xp > 0 then
    insert into public.tec_language_course_stats_v1(institution_id, student_id, course_code, xp, current_streak, longest_streak, last_study_date)
    values (p_institution_id, v_student_id, p_course_code, v_awarded_xp, 1, 1, v_today)
    on conflict (institution_id, student_id, course_code) do update set
      xp = public.tec_language_course_stats_v1.xp + excluded.xp,
      current_streak = case
        when public.tec_language_course_stats_v1.last_study_date = v_today then public.tec_language_course_stats_v1.current_streak
        when public.tec_language_course_stats_v1.last_study_date = v_today - 1 then public.tec_language_course_stats_v1.current_streak + 1
        else 1 end,
      longest_streak = greatest(public.tec_language_course_stats_v1.longest_streak,
        case when public.tec_language_course_stats_v1.last_study_date = v_today then public.tec_language_course_stats_v1.current_streak
             when public.tec_language_course_stats_v1.last_study_date = v_today - 1 then public.tec_language_course_stats_v1.current_streak + 1
             else 1 end),
      last_study_date = v_today, updated_at = now();
  end if;

  select * into v_language_stats from public.tec_language_course_stats_v1 stats
   where stats.institution_id = p_institution_id and stats.student_id = v_student_id and stats.course_code = p_course_code;
  v_result := jsonb_set(v_result, '{total_xp}', to_jsonb(coalesce(v_language_stats.xp, 0)), true);
  v_result := jsonb_set(v_result, '{current_streak}', to_jsonb(coalesce(v_language_stats.current_streak, 0)), true);
  return v_result;
end;
$$;

revoke all on function public.get_tec_language_course_map_v1(uuid, text) from public, anon;
revoke all on function public.start_tec_language_lesson_v1(uuid, text, text) from public, anon;
revoke all on function public.get_tec_language_session_v1(uuid, text, uuid) from public, anon;
revoke all on function public.submit_tec_language_answer_v1(uuid, text, uuid, text, jsonb, uuid) from public, anon;
grant execute on function public.get_tec_language_course_map_v1(uuid, text) to authenticated;
grant execute on function public.start_tec_language_lesson_v1(uuid, text, text) to authenticated;
grant execute on function public.get_tec_language_session_v1(uuid, text, uuid) to authenticated;
grant execute on function public.submit_tec_language_answer_v1(uuid, text, uuid, text, jsonb, uuid) to authenticated;

revoke all on function private.tec_english_course_snapshot(text, integer) from public, anon, authenticated;
revoke all on function private.tec_english_public_exercise(text) from public, anon, authenticated;
notify pgrst, 'reload schema';
