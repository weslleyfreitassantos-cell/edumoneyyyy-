-- Tec Inglês adaptive V2. The course and all child content remain STAGING until
-- the existing exact-version pedagogical review and institution release gates pass.

-- Preserve the validity of every approval already on record before changing the
-- snapshot implementation for V2-only skill and dialogue metadata.
create temporary table tec_english_v2_pre_migration_approvals as
select review.id, review.course_code, review.content_version,
       private.tec_english_course_fingerprint(review.course_code, review.content_version) as fingerprint
  from public.tec_english_pedagogical_reviews review
 where review.decision = 'APPROVED';

alter table public.tec_english_exercises
  add column if not exists skill_code text,
  add column if not exists difficulty_level smallint not null default 1,
  add column if not exists dialogue_speaker text,
  add column if not exists dialogue_context jsonb not null default '[]'::jsonb;

update public.tec_english_exercises
   set skill_code = 'legacy_' || substr(md5(lesson_id), 1, 12)
 where skill_code is null;

alter table public.tec_english_exercises alter column skill_code set not null;
alter table public.tec_english_exercises
  add constraint tec_english_exercises_skill_code_check
    check (skill_code ~ '^[a-z][a-z0-9_]{2,63}$'),
  add constraint tec_english_exercises_difficulty_check
    check (difficulty_level between 1 and 5),
  add constraint tec_english_exercises_dialogue_context_check
    check (case when jsonb_typeof(dialogue_context) = 'array' then jsonb_array_length(dialogue_context) <= 12 else false end),
  add constraint tec_english_exercises_dialogue_speaker_check
    check (dialogue_speaker is null or length(dialogue_speaker) between 1 and 80);
create index tec_english_exercises_skill_difficulty_idx
  on public.tec_english_exercises(skill_code, difficulty_level, lesson_id);

create table public.tec_english_skill_mastery_v2 (
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  skill_code text not null check (skill_code ~ '^[a-z][a-z0-9_]{2,63}$'),
  mastery_score numeric(5,2) not null default 0 check (mastery_score between 0 and 100),
  difficulty_level smallint not null default 1 check (difficulty_level between 1 and 5),
  correct_streak integer not null default 0 check (correct_streak >= 0),
  incorrect_streak integer not null default 0 check (incorrect_streak >= 0),
  interval_days integer not null default 0 check (interval_days between 0 and 30),
  next_review_at timestamptz not null default now(),
  last_attempt_at timestamptz not null default now(),
  active_review_exercise_id text references public.tec_english_exercises(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (institution_id, student_id, skill_code)
);
create index tec_english_skill_mastery_due_idx
  on public.tec_english_skill_mastery_v2(institution_id, student_id, next_review_at, mastery_score);

create table public.tec_english_skill_review_attempts_v2 (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  skill_code text not null,
  exercise_id text not null references public.tec_english_exercises(id) on delete restrict,
  idempotency_key uuid not null,
  response jsonb not null check (jsonb_typeof(response) = 'object'),
  is_correct boolean not null,
  result_payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (student_id, idempotency_key),
  foreign key (institution_id, student_id, skill_code)
    references public.tec_english_skill_mastery_v2(institution_id, student_id, skill_code) on delete cascade
);
create index tec_english_skill_review_attempts_recent_idx
  on public.tec_english_skill_review_attempts_v2(institution_id, student_id, created_at desc);

alter table public.tec_english_skill_mastery_v2 enable row level security;
alter table public.tec_english_skill_review_attempts_v2 enable row level security;
revoke all on table public.tec_english_skill_mastery_v2, public.tec_english_skill_review_attempts_v2 from public, anon, authenticated;
grant all on table public.tec_english_skill_mastery_v2, public.tec_english_skill_review_attempts_v2 to service_role;

create or replace function private.tec_english_record_skill_mastery_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.tec_english_skill_mastery_v2(
    institution_id, student_id, skill_code, mastery_score, difficulty_level,
    correct_streak, incorrect_streak, interval_days, next_review_at, last_attempt_at
  )
  select new.institution_id, new.student_id, exercise.skill_code,
         case when new.is_correct then 10 else 0 end,
         exercise.difficulty_level,
         case when new.is_correct then 1 else 0 end,
         case when new.is_correct then 0 else 1 end,
         case when new.is_correct then 1 else 0 end,
         case when new.is_correct then now() + interval '1 day' else now() end,
         new.created_at
    from public.tec_english_exercises exercise
   where exercise.id = new.exercise_id
  on conflict (institution_id, student_id, skill_code) do update
    set mastery_score = greatest(0, least(100,
          public.tec_english_skill_mastery_v2.mastery_score
          + case when new.is_correct then 8 else -15 end)),
        correct_streak = case when new.is_correct then public.tec_english_skill_mastery_v2.correct_streak + 1 else 0 end,
        incorrect_streak = case when new.is_correct then 0 else public.tec_english_skill_mastery_v2.incorrect_streak + 1 end,
        difficulty_level = case
          when new.is_correct and public.tec_english_skill_mastery_v2.correct_streak + 1 >= 3
            then least(5, public.tec_english_skill_mastery_v2.difficulty_level + 1)
          when not new.is_correct and public.tec_english_skill_mastery_v2.incorrect_streak + 1 >= 2
            then greatest(1, public.tec_english_skill_mastery_v2.difficulty_level - 1)
          else public.tec_english_skill_mastery_v2.difficulty_level
        end,
        interval_days = case when new.is_correct then
          case public.tec_english_skill_mastery_v2.interval_days
            when 0 then 1 when 1 then 3 when 3 then 7 when 7 then 14 else 30 end
          else 0 end,
        next_review_at = case when new.is_correct then now() + make_interval(days =>
          case public.tec_english_skill_mastery_v2.interval_days
            when 0 then 1 when 1 then 3 when 3 then 7 when 7 then 14 else 30 end)
          else now() end,
        last_attempt_at = new.created_at,
        updated_at = now();
  return new;
end;
$$;

create trigger tec_english_answer_attempt_mastery_v2
  after insert on public.tec_english_answer_attempts
  for each row execute function private.tec_english_record_skill_mastery_v2();
revoke all on function private.tec_english_record_skill_mastery_v2() from public, anon, authenticated;

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
  || case when unit.course_code = 'TEC_ENGLISH_FOUNDATIONS_V2' or unit.course_code like 'TEC_ENGLISH_FOUNDATIONS_V2_TEST%'
       then jsonb_build_object('skill_code', exercise.skill_code,
         'difficulty_level', exercise.difficulty_level, 'dialogue_speaker', exercise.dialogue_speaker,
         'dialogue_context', exercise.dialogue_context)
       else '{}'::jsonb end
    from public.tec_english_exercises exercise
    join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id
    join public.tec_english_units unit on unit.id = lesson.unit_id
   where exercise.id = p_exercise_id;
$$;

create or replace function private.tec_english_skill_label_v2(p_skill_code text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select lesson.title
      from public.tec_english_exercises exercise
      join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id
     where exercise.skill_code = p_skill_code and p_skill_code like 'legacy_%'
     order by lesson.title
     limit 1
  ), case p_skill_code
    when 'daily_habits' then 'Hábitos diários'
    when 'days_and_plans' then 'Dias e planejamento'
    when 'days_listening' then 'Compreensão auditiva: dias'
    when 'days_speaking' then 'Falar sobre os dias'
    when 'directions_listening' then 'Compreensão auditiva: direções'
    when 'directions_places' then 'Direções e lugares'
    when 'directions_speaking' then 'Falar sobre caminhos'
    when 'family_listening' then 'Compreensão auditiva: família'
    when 'family_speaking' then 'Falar sobre família'
    when 'family_vocabulary' then 'Vocabulário da família'
    when 'family_words' then 'Integrantes da família'
    when 'listening_comprehension' then 'Compreensão auditiva'
    when 'object_listening' then 'Ouvir posições de objetos'
    when 'object_positions' then 'Posições dos objetos'
    when 'object_questions' then 'Perguntas sobre objetos'
    when 'object_speaking' then 'Falar sobre objetos'
    when 'routine_speaking' then 'Falar sobre rotina'
    when 'routine_time' then 'Horários da rotina'
    when 'routine_vocabulary' then 'Vocabulário da rotina'
    when 'school_listening' then 'Compreensão auditiva: escola'
    when 'school_objects' then 'Objetos escolares'
    when 'school_speaking' then 'Conversa na escola'
    when 'school_vocabulary' then 'Vocabulário escolar'
    when 'simple_present' then 'Presente simples'
    when 'simple_present_speaking' then 'Falar sobre hábitos'
    when 'time_expressions' then 'Expressões de horário'
    when 'time_listening' then 'Compreensão auditiva: horários'
    when 'word_order' then 'Ordem das palavras'
    else pg_catalog.initcap(pg_catalog.replace(p_skill_code, '_', ' '))
  end);
$$;

create or replace function private.tec_english_session_payload(p_session_id uuid, p_student_id uuid, p_institution_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select jsonb_build_object(
    'session_id', session.id, 'lesson_id', lesson.id,
    'course_code', unit.course_code,
    'lesson_title', lesson.title, 'lesson_intro', lesson.introduction,
    'unit_title', unit.title, 'status', session.status,
    'current_position', session.current_position,
    'total_exercises', exercise_count.total,
    'exercise', private.tec_english_public_exercise(current_exercise.id)
  )
    from public.tec_english_lesson_sessions session
    join public.tec_english_lessons lesson on lesson.id = session.lesson_id
    join public.tec_english_units unit on unit.id = lesson.unit_id
    cross join lateral (select count(*)::integer as total from public.tec_english_exercises exercise where exercise.lesson_id = lesson.id) exercise_count
    left join public.tec_english_exercises current_exercise
      on current_exercise.lesson_id = lesson.id and current_exercise.position = session.current_position
   where session.id = p_session_id and session.student_id = p_student_id
     and session.institution_id = p_institution_id;
$$;

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
              ) || case when p_course_code = 'TEC_ENGLISH_FOUNDATIONS_V2' or p_course_code like 'TEC_ENGLISH_FOUNDATIONS_V2_TEST%'
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

revoke all on function private.tec_english_public_exercise(text) from public, anon, authenticated;
revoke all on function private.tec_english_skill_label_v2(text) from public, anon, authenticated;
revoke all on function private.tec_english_session_payload(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.tec_english_course_snapshot(text, integer) from public, anon, authenticated;

create or replace function public.get_tec_english_course_map_v2(p_institution_id uuid, p_course_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := private.tec_english_current_student_id(p_institution_id);
  v_test_mode boolean := private.tec_english_test_mode();
  v_result jsonb;
begin
  if (not v_test_mode and p_course_code <> 'TEC_ENGLISH_FOUNDATIONS_V2')
     or (v_test_mode and p_course_code not like 'TEC_ENGLISH_FOUNDATIONS_V2_TEST%') then
    raise exception 'TEC_ENGLISH_COURSE_NOT_AVAILABLE' using errcode = '42501';
  end if;
  if not private.tec_english_course_available(p_institution_id, p_course_code, v_test_mode) then
    raise exception 'TEC_ENGLISH_COURSE_NOT_AVAILABLE' using errcode = '42501';
  end if;

  with lesson_rows as (
    select lesson.id, lesson.unit_id, lesson.position, lesson.title,
           lesson.xp_reward, unit.position as unit_position, progress.first_completed_at,
           active_session.id as active_session_id,
           (select count(*)::integer from public.tec_english_exercises exercise where exercise.lesson_id = lesson.id) as exercise_count,
           private.tec_english_lesson_ready(lesson.id, v_test_mode) as content_ready
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
           when exists (select 1 from numbered prev where prev.course_position < current_lesson.course_position and prev.first_completed_at is null) then 'LOCKED'
           when not content_ready then 'REVIEW_PENDING'
           else 'AVAILABLE' end as lesson_status
      from numbered current_lesson
  ), unit_json as (
    select unit.id, unit.position, unit.title, unit.description,
      coalesce(jsonb_agg(jsonb_build_object(
        'id', lesson.id, 'position', lesson.position, 'title', lesson.title,
        'status', lesson.lesson_status, 'exercise_count', lesson.exercise_count,
        'xp_reward', lesson.xp_reward,
        'active_session_id', lesson.active_session_id, 'completed_at', lesson.first_completed_at,
        'course_code', p_course_code
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
    'stats', (select jsonb_build_object('xp', coalesce(stats.xp, 0), 'current_streak', coalesce(stats.current_streak, 0),
      'longest_streak', coalesce(stats.longest_streak, 0), 'last_study_date', stats.last_study_date)
      from (select 1) seed left join public.tec_english_student_stats stats
        on stats.institution_id = p_institution_id and stats.student_id = v_student_id),
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

create or replace function public.start_tec_english_lesson_v2(p_institution_id uuid, p_course_code text, p_lesson_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := private.tec_english_current_student_id(p_institution_id);
  v_test_mode boolean := private.tec_english_test_mode();
  v_session_id uuid;
begin
  if (not v_test_mode and p_course_code <> 'TEC_ENGLISH_FOUNDATIONS_V2')
     or (v_test_mode and p_course_code not like 'TEC_ENGLISH_FOUNDATIONS_V2_TEST%')
     or not private.tec_english_course_available(p_institution_id, p_course_code, v_test_mode)
     or not private.tec_english_lesson_ready(p_lesson_id, v_test_mode)
     or not exists (select 1 from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id
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
    values (p_institution_id, v_student_id, p_lesson_id) returning id into v_session_id;
  end if;
  return private.tec_english_session_payload(v_session_id, v_student_id, p_institution_id);
end;
$$;

create or replace function public.get_tec_english_session_v2(p_institution_id uuid, p_course_code text, p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := private.tec_english_current_student_id(p_institution_id);
  v_test_mode boolean := private.tec_english_test_mode();
  v_lesson_id text;
  v_course text;
begin
  select session.lesson_id, unit.course_code into v_lesson_id, v_course
    from public.tec_english_lesson_sessions session
    join public.tec_english_lessons lesson on lesson.id = session.lesson_id
    join public.tec_english_units unit on unit.id = lesson.unit_id
   where session.id = p_session_id and session.student_id = v_student_id and session.institution_id = p_institution_id;
  if not found or v_course <> p_course_code
     or not private.tec_english_course_available(p_institution_id, p_course_code, v_test_mode)
     or not private.tec_english_lesson_ready(v_lesson_id, v_test_mode) then
    raise exception 'TEC_ENGLISH_SESSION_NOT_FOUND' using errcode = '42501';
  end if;
  return private.tec_english_session_payload(p_session_id, v_student_id, p_institution_id);
end;
$$;

create or replace function public.submit_tec_english_answer_v2(p_institution_id uuid, p_course_code text, p_session_id uuid, p_exercise_id text, p_response jsonb, p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := private.tec_english_current_student_id(p_institution_id);
  v_test_mode boolean := private.tec_english_test_mode();
  v_course text;
  v_lesson_id text;
begin
  select session.lesson_id, unit.course_code into v_lesson_id, v_course
    from public.tec_english_lesson_sessions session
    join public.tec_english_lessons lesson on lesson.id = session.lesson_id
    join public.tec_english_units unit on unit.id = lesson.unit_id
   where session.id = p_session_id and session.student_id = v_student_id and session.institution_id = p_institution_id;
  if not found or v_course <> p_course_code
     or (not v_test_mode and p_course_code <> 'TEC_ENGLISH_FOUNDATIONS_V2')
     or (v_test_mode and p_course_code not like 'TEC_ENGLISH_FOUNDATIONS_V2_TEST%')
     or not private.tec_english_lesson_ready(v_lesson_id, v_test_mode)
     or not private.tec_english_course_available(p_institution_id, p_course_code, v_test_mode) then
    raise exception 'TEC_ENGLISH_SESSION_NOT_FOUND' using errcode = '42501';
  end if;
  return private.tec_english_submit_answer_unchecked_v1(p_institution_id, p_session_id, p_exercise_id, p_response, p_idempotency_key);
end;
$$;

create or replace function public.get_tec_english_learning_home_v2(p_institution_id uuid)
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
  select jsonb_build_object(
    'due_reviews', (select count(*)::integer from public.tec_english_skill_mastery_v2 mastery
      where mastery.institution_id = p_institution_id and mastery.student_id = v_student_id and mastery.next_review_at <= now()),
    'due_skills', coalesce((select jsonb_agg(jsonb_build_object('skill_code', mastery.skill_code,
      'label', private.tec_english_skill_label_v2(mastery.skill_code), 'mastery_score', mastery.mastery_score,
      'difficulty_level', mastery.difficulty_level, 'next_review_at', mastery.next_review_at)
      order by mastery.mastery_score asc, mastery.next_review_at asc)
      from (select * from public.tec_english_skill_mastery_v2 mastery
        where mastery.institution_id = p_institution_id and mastery.student_id = v_student_id and mastery.next_review_at <= now()
        order by mastery.mastery_score asc, mastery.next_review_at asc limit 20) mastery), '[]'::jsonb),
    'weak_skills', coalesce((select jsonb_agg(jsonb_build_object('skill_code', mastery.skill_code,
      'label', private.tec_english_skill_label_v2(mastery.skill_code), 'mastery_score', mastery.mastery_score,
      'difficulty_level', mastery.difficulty_level) order by mastery.mastery_score asc)
      from (select * from public.tec_english_skill_mastery_v2 mastery
        where mastery.institution_id = p_institution_id and mastery.student_id = v_student_id
        order by mastery.mastery_score asc, mastery.updated_at desc limit 3) mastery), '[]'::jsonb),
    'stats', (select jsonb_build_object('xp', coalesce(stats.xp, 0), 'current_streak', coalesce(stats.current_streak, 0),
      'longest_streak', coalesce(stats.longest_streak, 0), 'last_study_date', stats.last_study_date)
      from (select 1) seed left join public.tec_english_student_stats stats
        on stats.institution_id = p_institution_id and stats.student_id = v_student_id)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.get_tec_english_skill_review_queue_v2(p_institution_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('skill_code', mastery.skill_code,
    'label', private.tec_english_skill_label_v2(mastery.skill_code), 'mastery_score', mastery.mastery_score,
    'difficulty_level', mastery.difficulty_level, 'next_review_at', mastery.next_review_at)
    order by mastery.mastery_score asc, mastery.next_review_at asc), '[]'::jsonb)
    from (select mastery.* from public.tec_english_skill_mastery_v2 mastery
      where mastery.institution_id = p_institution_id
        and mastery.student_id = private.tec_english_current_student_id(p_institution_id)
        and mastery.next_review_at <= now()
      order by mastery.mastery_score asc, mastery.next_review_at asc limit 20) mastery;
$$;

create or replace function public.start_tec_english_skill_review_v2(p_institution_id uuid, p_skill_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := private.tec_english_current_student_id(p_institution_id);
  v_mastery public.tec_english_skill_mastery_v2%rowtype;
  v_exercise_id text;
begin
  select * into v_mastery from public.tec_english_skill_mastery_v2 mastery
   where mastery.institution_id = p_institution_id and mastery.student_id = v_student_id and mastery.skill_code = p_skill_code
     and mastery.next_review_at <= now() for update;
  if not found then raise exception 'TEC_ENGLISH_REVIEW_NOT_DUE' using errcode = 'P0002'; end if;
  v_exercise_id := v_mastery.active_review_exercise_id;
  if v_exercise_id is null or not exists (
    select 1 from public.tec_english_exercises exercise
    join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id
    join public.tec_english_units unit on unit.id = lesson.unit_id
    where exercise.id = v_exercise_id and exercise.skill_code = p_skill_code
      and private.tec_english_lesson_ready(lesson.id, private.tec_english_test_mode())
      and private.tec_english_course_available(p_institution_id, unit.course_code, private.tec_english_test_mode())
  ) then
    select exercise.id into v_exercise_id from public.tec_english_exercises exercise
    join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id
    join public.tec_english_units unit on unit.id = lesson.unit_id
    where exercise.skill_code = p_skill_code
      and private.tec_english_lesson_ready(lesson.id, private.tec_english_test_mode())
      and private.tec_english_course_available(p_institution_id, unit.course_code, private.tec_english_test_mode())
    order by (select max(attempt.created_at) from public.tec_english_skill_review_attempts_v2 attempt
        where attempt.institution_id = p_institution_id and attempt.student_id = v_student_id
          and attempt.exercise_id = exercise.id) nulls first,
      abs(exercise.difficulty_level - v_mastery.difficulty_level),
      exercise.id
    limit 1;
  end if;
  if v_exercise_id is null then raise exception 'TEC_ENGLISH_REVIEW_CONTENT_UNAVAILABLE' using errcode = 'P0002'; end if;
  update public.tec_english_skill_mastery_v2 set active_review_exercise_id = v_exercise_id, updated_at = now()
   where institution_id = p_institution_id and student_id = v_student_id and skill_code = p_skill_code;
  return jsonb_build_object('skill_code', p_skill_code, 'label', private.tec_english_skill_label_v2(p_skill_code),
    'mastery_score', v_mastery.mastery_score, 'difficulty_level', v_mastery.difficulty_level,
    'exercise', private.tec_english_public_exercise(v_exercise_id));
end;
$$;

create or replace function public.submit_tec_english_skill_review_v2(p_institution_id uuid, p_skill_code text, p_response jsonb, p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := private.tec_english_current_student_id(p_institution_id);
  v_mastery public.tec_english_skill_mastery_v2%rowtype;
  v_exercise public.tec_english_exercises%rowtype;
  v_existing public.tec_english_skill_review_attempts_v2%rowtype;
  v_answer text;
  v_correct boolean := false;
  v_result jsonb;
  v_next_interval integer;
begin
  if p_idempotency_key is null or p_response is null or jsonb_typeof(p_response) <> 'object' or octet_length(p_response::text) > 2000 then
    raise exception 'TEC_ENGLISH_INVALID_RESPONSE' using errcode = '22023';
  end if;
  select * into v_mastery from public.tec_english_skill_mastery_v2 mastery
   where mastery.institution_id = p_institution_id and mastery.student_id = v_student_id and mastery.skill_code = p_skill_code
   for update;
  if not found then raise exception 'TEC_ENGLISH_REVIEW_NOT_DUE' using errcode = 'P0002'; end if;
  select * into v_existing from public.tec_english_skill_review_attempts_v2 attempt
   where attempt.student_id = v_student_id and attempt.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.skill_code <> p_skill_code or v_existing.response <> p_response then
      raise exception 'TEC_ENGLISH_IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;
    return v_existing.result_payload;
  end if;
  if v_mastery.next_review_at > now() or v_mastery.active_review_exercise_id is null then
    raise exception 'TEC_ENGLISH_REVIEW_NOT_DUE' using errcode = 'P0002';
  end if;
  select * into v_exercise from public.tec_english_exercises exercise
   where exercise.id = v_mastery.active_review_exercise_id and exercise.skill_code = p_skill_code;
  if not found then raise exception 'TEC_ENGLISH_REVIEW_CONTENT_UNAVAILABLE' using errcode = 'P0002'; end if;
  if not exists (
    select 1 from public.tec_english_lessons lesson
    join public.tec_english_units unit on unit.id = lesson.unit_id
     where lesson.id = v_exercise.lesson_id
       and private.tec_english_lesson_ready(lesson.id, private.tec_english_test_mode())
       and private.tec_english_course_available(p_institution_id, unit.course_code, private.tec_english_test_mode())
  ) then raise exception 'TEC_ENGLISH_REVIEW_CONTENT_UNAVAILABLE' using errcode = 'P0002'; end if;
  if v_exercise.exercise_type in ('MULTIPLE_CHOICE', 'FILL_BLANK') then
    if jsonb_typeof(p_response -> 'choice') is distinct from 'string' or length(p_response ->> 'choice') > 120 then raise exception 'TEC_ENGLISH_INVALID_RESPONSE' using errcode = '22023'; end if;
    v_answer := p_response ->> 'choice';
  elsif v_exercise.exercise_type = 'WORD_ORDER' then
    if jsonb_typeof(p_response -> 'tokens') is distinct from 'array' or jsonb_array_length(p_response -> 'tokens') not between 2 and 20 then raise exception 'TEC_ENGLISH_INVALID_RESPONSE' using errcode = '22023'; end if;
    select string_agg(value, ' ' order by ordinal) into v_answer from jsonb_array_elements_text(p_response -> 'tokens') with ordinality as tokens(value, ordinal);
  elsif v_exercise.exercise_type = 'MATCHING' then
    if jsonb_typeof(p_response -> 'pairs') is distinct from 'object' then raise exception 'TEC_ENGLISH_INVALID_RESPONSE' using errcode = '22023'; end if;
    v_correct := p_response -> 'pairs' = v_exercise.answer_key -> 'pairs';
  else
    if jsonb_typeof(p_response -> 'text') is distinct from 'string' or length(btrim(p_response ->> 'text')) = 0 or length(p_response ->> 'text') > 300 then raise exception 'TEC_ENGLISH_INVALID_RESPONSE' using errcode = '22023'; end if;
    v_answer := p_response ->> 'text';
  end if;
  if v_exercise.exercise_type <> 'MATCHING' then
    v_correct := exists (select 1 from jsonb_array_elements_text(v_exercise.accepted_answers) accepted(answer)
      where private.tec_english_normalize_answer(accepted.answer) = private.tec_english_normalize_answer(v_answer));
  end if;
  v_next_interval := case when v_correct then case v_mastery.interval_days when 0 then 1 when 1 then 3 when 3 then 7 when 7 then 14 else 30 end else 0 end;
  v_result := jsonb_build_object('is_correct', v_correct,
    'feedback', case when v_correct then 'Muito bem! Revisão concluída.' else 'Quase! Revise a dica e tente novamente.' end,
    'explanation', v_exercise.explanation, 'skill_code', p_skill_code,
    'mastery_score', greatest(0, least(100, v_mastery.mastery_score + case when v_correct then 8 else -15 end)),
    'difficulty_level', case when v_correct and v_mastery.correct_streak + 1 >= 3 then least(5, v_mastery.difficulty_level + 1)
      when not v_correct and v_mastery.incorrect_streak + 1 >= 2 then greatest(1, v_mastery.difficulty_level - 1) else v_mastery.difficulty_level end,
    'next_review_at', case when v_correct then now() + make_interval(days => v_next_interval) else now() end);
  insert into public.tec_english_skill_review_attempts_v2(institution_id, student_id, skill_code, exercise_id, idempotency_key, response, is_correct, result_payload)
  values (p_institution_id, v_student_id, p_skill_code, v_exercise.id, p_idempotency_key, p_response, v_correct, v_result);
  update public.tec_english_skill_mastery_v2 set
    mastery_score = greatest(0, least(100, mastery_score + case when v_correct then 8 else -15 end)),
    correct_streak = case when v_correct then correct_streak + 1 else 0 end,
    incorrect_streak = case when v_correct then 0 else incorrect_streak + 1 end,
    difficulty_level = (v_result ->> 'difficulty_level')::smallint,
    interval_days = v_next_interval,
    next_review_at = (v_result ->> 'next_review_at')::timestamptz,
    active_review_exercise_id = case when v_correct then null else active_review_exercise_id end,
    last_attempt_at = now(), updated_at = now()
   where institution_id = p_institution_id and student_id = v_student_id and skill_code = p_skill_code;
  return v_result;
end;
$$;

revoke all on function public.get_tec_english_course_map_v2(uuid, text) from public, anon;
revoke all on function public.start_tec_english_lesson_v2(uuid, text, text) from public, anon;
revoke all on function public.get_tec_english_session_v2(uuid, text, uuid) from public, anon;
revoke all on function public.submit_tec_english_answer_v2(uuid, text, uuid, text, jsonb, uuid) from public, anon;
revoke all on function public.get_tec_english_learning_home_v2(uuid) from public, anon;
revoke all on function public.get_tec_english_skill_review_queue_v2(uuid) from public, anon;
revoke all on function public.start_tec_english_skill_review_v2(uuid, text) from public, anon;
revoke all on function public.submit_tec_english_skill_review_v2(uuid, text, jsonb, uuid) from public, anon;
grant execute on function public.get_tec_english_course_map_v2(uuid, text) to authenticated;
grant execute on function public.start_tec_english_lesson_v2(uuid, text, text) to authenticated;
grant execute on function public.get_tec_english_session_v2(uuid, text, uuid) to authenticated;
grant execute on function public.submit_tec_english_answer_v2(uuid, text, uuid, text, jsonb, uuid) to authenticated;
grant execute on function public.get_tec_english_learning_home_v2(uuid) to authenticated;
grant execute on function public.get_tec_english_skill_review_queue_v2(uuid) to authenticated;
grant execute on function public.start_tec_english_skill_review_v2(uuid, text) to authenticated;
grant execute on function public.submit_tec_english_skill_review_v2(uuid, text, jsonb, uuid) to authenticated;

comment on table public.tec_english_skill_mastery_v2 is 'Per-student, per-institution mastery and spaced-review schedule. Client access is RPC-only.';
comment on table public.tec_english_skill_review_attempts_v2 is 'Idempotent, server-graded adaptive review attempts; answer keys remain server-side.';
comment on function private.tec_english_course_snapshot(text, integer) is 'Exact-version review fingerprint includes skill, difficulty and conversation metadata.';
comment on function public.get_tec_english_course_map_v2(uuid, text) is 'Student-only map for V2; requires exact course approval, publication and institution release.';

do $$
begin
  if exists (
    select 1
      from pg_temp.tec_english_v2_pre_migration_approvals previous
     where previous.fingerprint is distinct from
           private.tec_english_course_fingerprint(previous.course_code, previous.content_version)
  ) then
    raise exception 'TEC_ENGLISH_V2_INVALIDATES_EXISTING_APPROVAL';
  end if;
end;
$$;
drop table pg_temp.tec_english_v2_pre_migration_approvals;

-- BEGIN GENERATED TEC ENGLISH V2 CONTENT

insert into public.tec_english_courses(course_code, content_version, title, description, author, publication_status, review_status, xp_per_lesson) values ('TEC_ENGLISH_FOUNDATIONS_V2', 3, 'Inglês em conversas do cotidiano', 'Pratique rotinas, escola, família e lugares em diálogos curtos e situações do dia a dia.', 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 30) on conflict (course_code) do nothing;

insert into public.tec_english_units(id, course_code, position, title, description, content_version, author, publication_status, review_status) values ('english-v2-unit-4', 'TEC_ENGLISH_FOUNDATIONS_V2', 4, 'Minha rotina', 'Fale sobre horários, atividades diárias e planos da semana.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING') on conflict (id) do nothing;

insert into public.tec_english_lessons(id, unit_id, position, title, introduction, xp_reward, content_version, author, publication_status, review_status) values ('english-v2-u4-l1', 'english-v2-unit-4', 1, 'Meu dia começa', 'A rotina ganha sentido quando juntamos uma ação e um horário. Observe como a conversa avança da hora de acordar para a próxima atividade.

Objetivo: Usar verbos simples e horários para descrever uma rotina da manhã.', 30, 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING') on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l1-e1', 'english-v2-u4-l1', 1, 'MULTIPLE_CHOICE', 'Conversa guiada · escolha uma resposta que mantenha o diálogo.', 'What time do you wake up?', '["I wake up at seven.","It is Tuesday.","The library is near the school."]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["I wake up at seven."]'::jsonb, '{"accepted":["I wake up at seven."]}'::jsonb, 'A pergunta “What time…” pede um horário; “at seven” informa a hora.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'routine_time', 1, 'Mia', '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l1-e2', 'english-v2-u4-l1', 2, 'MULTIPLE_CHOICE', 'Conversa guiada · escolha uma resposta que mantenha o diálogo.', 'What do you do after breakfast?', '["I go to school.","My sister is eleven.","Turn left at the park."]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["I go to school."]'::jsonb, '{"accepted":["I go to school."]}'::jsonb, 'A resposta continua o assunto da rotina com uma atividade depois do café.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'routine_time', 2, 'Mia', '[{"speaker":"Mia","text":"What time do you wake up?"},{"speaker":"Você","text":"I wake up at seven."}]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l1-e3', 'english-v2-u4-l1', 3, 'WORD_ORDER', 'Monte a frase na ordem correta.', 'Monte: “Eu tomo café da manhã às sete.”', '[]'::jsonb, '["seven.","at","breakfast","have","I"]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["I have breakfast at seven."]'::jsonb, '{"accepted":["I have breakfast at seven."]}'::jsonb, 'A ordem básica é pessoa, ação e complemento; “at seven” indica o horário.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'word_order', 1, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l1-e4', 'english-v2-u4-l1', 4, 'TRANSLATION', 'Escreva uma tradução natural em inglês.', 'Eu vou para a escola de manhã.', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["I go to school in the morning."]'::jsonb, '{"accepted":["I go to school in the morning."]}'::jsonb, '“In the morning” é uma forma natural de dizer “de manhã”.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'routine_time', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l1-e5', 'english-v2-u4-l1', 5, 'LISTENING', 'Ouça a fala e responda sem ver a transcrição.', 'Que horário aparece na frase?', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'I wake up at six thirty.', '["six thirty","6:30","half past six"]'::jsonb, '{"accepted":["six thirty","6:30","half past six"]}'::jsonb, '“Six thirty” corresponde a seis e meia.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'listening_comprehension', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l1-e6', 'english-v2-u4-l1', 6, 'MATCHING', 'Associe cada expressão ao significado.', 'Encontre os pares correspondentes.', '[]'::jsonb, '[]'::jsonb, '["wake up","have breakfast","go to school"]'::jsonb, '["acordar","tomar café da manhã","ir para a escola"]'::jsonb, null, '[]'::jsonb, '{"pairs":{"wake up":"acordar","have breakfast":"tomar café da manhã","go to school":"ir para a escola"}}'::jsonb, 'As expressões descrevem ações comuns do começo do dia.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'routine_vocabulary', 1, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l1-e7', 'english-v2-u4-l1', 7, 'FILL_BLANK', 'Escolha a palavra que completa a frase.', 'I ___ breakfast before school.', '["have","has","am"]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["have"]'::jsonb, '{"accepted":["have"]}'::jsonb, 'Com “I”, usamos “have”: “I have breakfast”.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'simple_present', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_lessons(id, unit_id, position, title, introduction, xp_reward, content_version, author, publication_status, review_status) values ('english-v2-u4-l2', 'english-v2-unit-4', 2, 'Horários e atividades', '“What time” pergunta a hora. Para responder, use uma atividade e “at” antes do horário.

Objetivo: Perguntar “what time” e responder com “at” mais um horário.', 30, 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING') on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l2-e1', 'english-v2-u4-l2', 1, 'MULTIPLE_CHOICE', 'Conversa guiada · escolha uma resposta que mantenha o diálogo.', 'What time does your class start?', '["It starts at eight.","My cousin is kind.","The pencil is blue."]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["It starts at eight."]'::jsonb, '{"accepted":["It starts at eight."]}'::jsonb, '“What time” pede um horário; “at eight” responde diretamente.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'routine_time', 2, 'Noah', '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l2-e2', 'english-v2-u4-l2', 2, 'MULTIPLE_CHOICE', 'Conversa guiada · escolha uma resposta que mantenha o diálogo.', 'And what do you do after class?', '["I do my homework.","It is next to the bank.","She is my aunt."]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["I do my homework."]'::jsonb, '{"accepted":["I do my homework."]}'::jsonb, 'A resposta acompanha a conversa sobre a rotina escolar.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'routine_time', 2, 'Noah', '[{"speaker":"Noah","text":"What time does your class start?"},{"speaker":"Você","text":"It starts at eight."}]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l2-e3', 'english-v2-u4-l2', 3, 'WORD_ORDER', 'Monte a frase na ordem correta.', 'Monte: “Minha aula termina ao meio-dia.”', '[]'::jsonb, '["noon.","at","ends","class","My"]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["My class ends at noon."]'::jsonb, '{"accepted":["My class ends at noon."]}'::jsonb, '“My class” é o sujeito, “ends” a ação e “at noon” o horário.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'word_order', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l2-e4', 'english-v2-u4-l2', 4, 'TRANSLATION', 'Escreva uma tradução natural em inglês.', 'Nós estudamos inglês à tarde.', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["We study English in the afternoon."]'::jsonb, '{"accepted":["We study English in the afternoon."]}'::jsonb, '“In the afternoon” expressa “à tarde”.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'routine_time', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l2-e5', 'english-v2-u4-l2', 5, 'LISTENING', 'Ouça a fala e responda sem ver a transcrição.', 'A que horas começa a atividade?', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'The club starts at half past three.', '["half past three","three thirty","3:30"]'::jsonb, '{"accepted":["half past three","three thirty","3:30"]}'::jsonb, '“Half past three” e “three thirty” significam três e meia.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'time_listening', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l2-e6', 'english-v2-u4-l2', 6, 'MATCHING', 'Associe cada expressão ao significado.', 'Encontre os pares correspondentes.', '[]'::jsonb, '[]'::jsonb, '["at noon","at night","in the afternoon"]'::jsonb, '["ao meio-dia","à noite","à tarde"]'::jsonb, null, '[]'::jsonb, '{"pairs":{"at noon":"ao meio-dia","at night":"à noite","in the afternoon":"à tarde"}}'::jsonb, 'Use “at” para horários pontuais e “in” em partes do dia.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'time_expressions', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l2-e7', 'english-v2-u4-l2', 7, 'SPEAKING', 'Ouça o exemplo e repita. A transcrição é apenas um apoio, não uma nota de pronúncia.', 'Repita: “My class starts at eight.”', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'My class starts at eight.', '["My class starts at eight."]'::jsonb, '{"accepted":["My class starts at eight."]}'::jsonb, 'Ouça, fale se quiser e confira o texto reconhecido. O navegador não mede precisão fonética.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'routine_speaking', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_lessons(id, unit_id, position, title, introduction, xp_reward, content_version, author, publication_status, review_status) values ('english-v2-u4-l3', 'english-v2-unit-4', 3, 'Dias da semana', 'Use “on” antes de um dia da semana. Em uma conversa, uma pergunta sobre sábado pode levar a um plano simples.

Objetivo: Reconhecer os dias da semana e falar de planos com “on”.', 30, 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING') on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l3-e1', 'english-v2-u4-l3', 1, 'MULTIPLE_CHOICE', 'Conversa guiada · escolha uma resposta que mantenha o diálogo.', 'What do you do on Saturday?', '["I play soccer with my friends.","My classroom is upstairs.","The bus is at seven."]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["I play soccer with my friends."]'::jsonb, '{"accepted":["I play soccer with my friends."]}'::jsonb, 'A resposta apresenta uma atividade para o sábado.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'days_and_plans', 2, 'Lia', '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l3-e2', 'english-v2-u4-l3', 2, 'MULTIPLE_CHOICE', 'Conversa guiada · escolha uma resposta que mantenha o diálogo.', 'Do you study on Sunday?', '["No, I rest with my family.","Turn right at the corner.","She has a red notebook."]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["No, I rest with my family."]'::jsonb, '{"accepted":["No, I rest with my family."]}'::jsonb, 'A resposta usa “No” e acrescenta um plano coerente para domingo.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'days_and_plans', 2, 'Lia', '[{"speaker":"Lia","text":"What do you do on Saturday?"},{"speaker":"Você","text":"I play soccer with my friends."}]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l3-e3', 'english-v2-u4-l3', 3, 'WORD_ORDER', 'Monte a frase na ordem correta.', 'Monte: “Na segunda-feira, eu estudo matemática.”', '[]'::jsonb, '["math.","study","I","Monday,","On"]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["On Monday, I study math."]'::jsonb, '{"accepted":["On Monday, I study math."]}'::jsonb, 'O dia vem com “on”; depois, sujeito e verbo.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'word_order', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l3-e4', 'english-v2-u4-l3', 4, 'TRANSLATION', 'Escreva uma tradução natural em inglês.', 'Ela visita a avó no domingo.', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["She visits her grandmother on Sunday.","She visits her grandma on Sunday."]'::jsonb, '{"accepted":["She visits her grandmother on Sunday.","She visits her grandma on Sunday."]}'::jsonb, '“Grandmother” e “grandma” podem significar “avó”; use “on” com Sunday.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'days_and_plans', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l3-e5', 'english-v2-u4-l3', 5, 'LISTENING', 'Ouça a fala e responda sem ver a transcrição.', 'Em que dia a pessoa visita a avó?', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'I visit my grandmother on Friday.', '["Friday","on Friday"]'::jsonb, '{"accepted":["Friday","on Friday"]}'::jsonb, 'A palavra ouvida é “Friday”, sexta-feira.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'days_listening', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l3-e6', 'english-v2-u4-l3', 6, 'FILL_BLANK', 'Escolha a palavra que completa a frase.', 'We play volleyball ___ Saturday.', '["on","at","in"]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["on"]'::jsonb, '{"accepted":["on"]}'::jsonb, 'Use “on” antes de dias da semana.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'simple_present', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l3-e7', 'english-v2-u4-l3', 7, 'SPEAKING', 'Ouça o exemplo e repita. A transcrição é apenas um apoio, não uma nota de pronúncia.', 'Repita: “I read a book on Sunday.”', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'I read a book on Sunday.', '["I read a book on Sunday."]'::jsonb, '{"accepted":["I read a book on Sunday."]}'::jsonb, 'A fala serve para praticar e conferir a transcrição, sem avaliação fonética automatizada.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'days_speaking', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_lessons(id, unit_id, position, title, introduction, xp_reward, content_version, author, publication_status, review_status) values ('english-v2-u4-l4', 'english-v2-unit-4', 4, 'Hábitos e frequência', 'No Simple Present, “he” e “she” normalmente recebem “-s” no verbo. Compare “I read” e “she reads”.

Objetivo: Descrever hábitos no Simple Present e observar a concordância verbal com “he” e “she”.', 30, 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING') on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l4-e1', 'english-v2-u4-l4', 1, 'MULTIPLE_CHOICE', 'Conversa guiada · escolha uma resposta que mantenha o diálogo.', 'Does your brother walk to school?', '["Yes, he walks with a friend.","It is Wednesday.","The museum is across the street."]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["Yes, he walks with a friend."]'::jsonb, '{"accepted":["Yes, he walks with a friend."]}'::jsonb, 'Com “he”, o verbo afirmativo “walk” recebe “-s”: “walks”.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'simple_present', 3, 'Ben', '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l4-e2', 'english-v2-u4-l4', 2, 'MULTIPLE_CHOICE', 'Conversa guiada · escolha uma resposta que mantenha o diálogo.', 'What does he do after school?', '["He reads and then plays music.","They are in the classroom.","It is next to the park."]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["He reads and then plays music."]'::jsonb, '{"accepted":["He reads and then plays music."]}'::jsonb, '“Reads” e “plays” concordam com “he”.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'simple_present', 3, 'Ben', '[{"speaker":"Ben","text":"Does your brother walk to school?"},{"speaker":"Você","text":"Yes, he walks with a friend."}]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l4-e3', 'english-v2-u4-l4', 3, 'WORD_ORDER', 'Monte a frase na ordem correta.', 'Monte: “Ela ajuda a família em casa.”', '[]'::jsonb, '["home.","at","family","her","helps","She"]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["She helps her family at home."]'::jsonb, '{"accepted":["She helps her family at home."]}'::jsonb, 'Com “she”, usamos “helps”.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'simple_present', 3, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l4-e4', 'english-v2-u4-l4', 4, 'TRANSLATION', 'Escreva uma tradução natural em inglês.', 'Nós lemos antes de dormir.', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["We read before bed.","We read before going to sleep."]'::jsonb, '{"accepted":["We read before bed.","We read before going to sleep."]}'::jsonb, 'As duas frases expressam uma rotina de leitura antes de dormir.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'simple_present', 3, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l4-e5', 'english-v2-u4-l4', 5, 'MATCHING', 'Associe cada expressão ao significado.', 'Encontre os pares correspondentes.', '[]'::jsonb, '[]'::jsonb, '["read a book","help at home","walk to school"]'::jsonb, '["ler um livro","ajudar em casa","ir a pé para a escola"]'::jsonb, null, '[]'::jsonb, '{"pairs":{"read a book":"ler um livro","help at home":"ajudar em casa","walk to school":"ir a pé para a escola"}}'::jsonb, 'Cada expressão apresenta um hábito cotidiano.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'daily_habits', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l4-e6', 'english-v2-u4-l4', 6, 'FILL_BLANK', 'Escolha a palavra que completa a frase.', 'My sister ___ her homework after lunch.', '["does","do","is"]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["does"]'::jsonb, '{"accepted":["does"]}'::jsonb, 'Com “my sister” (she), usamos “does”.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'simple_present', 3, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u4-l4-e7', 'english-v2-u4-l4', 7, 'SPEAKING', 'Ouça o exemplo e repita. A transcrição é apenas um apoio, não uma nota de pronúncia.', 'Repita: “She studies English every day.”', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'She studies English every day.', '["She studies English every day."]'::jsonb, '{"accepted":["She studies English every day."]}'::jsonb, 'O retorno mostra palavras reconhecidas; não atribui uma nota de pronúncia.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'simple_present_speaking', 3, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_units(id, course_code, position, title, description, content_version, author, publication_status, review_status) values ('english-v2-unit-5', 'TEC_ENGLISH_FOUNDATIONS_V2', 5, 'Conversas do cotidiano', 'Converse sobre escola, família, objetos e lugares.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING') on conflict (id) do nothing;

insert into public.tec_english_lessons(id, unit_id, position, title, introduction, xp_reward, content_version, author, publication_status, review_status) values ('english-v2-u5-l1', 'english-v2-unit-5', 1, 'Na escola', 'Diálogos escolares podem começar com uma pergunta sobre um objeto ou uma sala e continuar com uma resposta útil.

Objetivo: Usar perguntas curtas para pedir e oferecer informação na escola.', 30, 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING') on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l1-e1', 'english-v2-u5-l1', 1, 'MULTIPLE_CHOICE', 'Conversa guiada · escolha uma resposta que mantenha o diálogo.', 'Where is the science room?', '["It is next to the library.","I wake up at six.","My aunt is a teacher."]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["It is next to the library."]'::jsonb, '{"accepted":["It is next to the library."]}'::jsonb, 'A pergunta “Where is…” pede um lugar.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'school_vocabulary', 2, 'Alex', '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l1-e2', 'english-v2-u5-l1', 2, 'MULTIPLE_CHOICE', 'Conversa guiada · escolha uma resposta que mantenha o diálogo.', 'Can I borrow your pencil?', '["Sure, here you are.","It starts on Monday.","She reads at home."]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["Sure, here you are."]'::jsonb, '{"accepted":["Sure, here you are."]}'::jsonb, '“Sure, here you are” é uma resposta natural ao emprestar um objeto.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'school_vocabulary', 2, 'Alex', '[{"speaker":"Alex","text":"Where is the science room?"},{"speaker":"Você","text":"It is next to the library."}]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l1-e3', 'english-v2-u5-l1', 3, 'WORD_ORDER', 'Monte a frase na ordem correta.', 'Monte: “A biblioteca fica perto da sala de música.”', '[]'::jsonb, '["room.","music","the","near","is","library","The"]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["The library is near the music room."]'::jsonb, '{"accepted":["The library is near the music room."]}'::jsonb, '“Near” indica que um lugar fica perto de outro.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'school_vocabulary', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l1-e4', 'english-v2-u5-l1', 4, 'LISTENING', 'Ouça a fala e responda sem ver a transcrição.', 'Qual material a pessoa precisa?', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'I need my notebook for class.', '["notebook","my notebook"]'::jsonb, '{"accepted":["notebook","my notebook"]}'::jsonb, 'A palavra ouvida é “notebook”, caderno.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'school_listening', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l1-e5', 'english-v2-u5-l1', 5, 'MATCHING', 'Associe cada expressão ao significado.', 'Encontre os pares correspondentes.', '[]'::jsonb, '[]'::jsonb, '["notebook","pencil","classroom"]'::jsonb, '["caderno","lápis","sala de aula"]'::jsonb, null, '[]'::jsonb, '{"pairs":{"notebook":"caderno","pencil":"lápis","classroom":"sala de aula"}}'::jsonb, 'São palavras frequentes no ambiente escolar.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'school_objects', 1, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l1-e6', 'english-v2-u5-l1', 6, 'FILL_BLANK', 'Escolha a palavra que completa a frase.', 'The art room is ___ the library.', '["near","seven","brother"]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["near"]'::jsonb, '{"accepted":["near"]}'::jsonb, '“Near” conecta dois lugares próximos.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'school_vocabulary', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l1-e7', 'english-v2-u5-l1', 7, 'SPEAKING', 'Ouça o exemplo e repita. A transcrição é apenas um apoio, não uma nota de pronúncia.', 'Repita: “Can I borrow your notebook?”', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'Can I borrow your notebook?', '["Can I borrow your notebook?"]'::jsonb, '{"accepted":["Can I borrow your notebook?"]}'::jsonb, 'A transcrição é uma ajuda opcional; você também pode digitar.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'school_speaking', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_lessons(id, unit_id, position, title, introduction, xp_reward, content_version, author, publication_status, review_status) values ('english-v2-u5-l2', 'english-v2-unit-5', 2, 'Minha família', 'Para perguntar idade, use “How old…?”. Responda com “I am…” ou “He/She is…”.

Objetivo: Usar vocabulário familiar e perguntas simples sobre idade e parentesco.', 30, 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING') on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l2-e1', 'english-v2-u5-l2', 1, 'MULTIPLE_CHOICE', 'Conversa guiada · escolha uma resposta que mantenha o diálogo.', 'How old is your sister?', '["She is twelve years old.","The station is on the left.","My class starts at eight."]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["She is twelve years old."]'::jsonb, '{"accepted":["She is twelve years old."]}'::jsonb, '“How old” pergunta idade; “she is twelve” responde.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'family_vocabulary', 2, 'Ravi', '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l2-e2', 'english-v2-u5-l2', 2, 'MULTIPLE_CHOICE', 'Conversa guiada · escolha uma resposta que mantenha o diálogo.', 'What does she like to do?', '["She likes drawing with me.","It is next to the bank.","We study on Thursday."]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["She likes drawing with me."]'::jsonb, '{"accepted":["She likes drawing with me."]}'::jsonb, 'A resposta mantém o assunto sobre a irmã.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'family_vocabulary', 2, 'Ravi', '[{"speaker":"Ravi","text":"How old is your sister?"},{"speaker":"Você","text":"She is twelve years old."}]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l2-e3', 'english-v2-u5-l2', 3, 'TRANSLATION', 'Escreva uma tradução natural em inglês.', 'Meu primo mora com a família.', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["My cousin lives with his family.","My cousin lives with her family."]'::jsonb, '{"accepted":["My cousin lives with his family.","My cousin lives with her family."]}'::jsonb, 'O gênero de “cousin” não é indicado pela palavra em inglês; as duas formas são possíveis.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'family_vocabulary', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l2-e4', 'english-v2-u5-l2', 4, 'LISTENING', 'Ouça a fala e responda sem ver a transcrição.', 'Quem mora com a pessoa?', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'My grandmother lives with us.', '["grandmother","my grandmother"]'::jsonb, '{"accepted":["grandmother","my grandmother"]}'::jsonb, '“Grandmother” significa avó.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'family_listening', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l2-e5', 'english-v2-u5-l2', 5, 'MATCHING', 'Associe cada expressão ao significado.', 'Encontre os pares correspondentes.', '[]'::jsonb, '[]'::jsonb, '["cousin","grandmother","brother"]'::jsonb, '["primo ou prima","avó","irmão"]'::jsonb, null, '[]'::jsonb, '{"pairs":{"cousin":"primo ou prima","grandmother":"avó","brother":"irmão"}}'::jsonb, '“Cousin” serve para primo ou prima; o contexto informa a pessoa.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'family_words', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l2-e6', 'english-v2-u5-l2', 6, 'FILL_BLANK', 'Escolha a palavra que completa a frase.', 'My aunt’s son is my ___.', '["cousin","classroom","Tuesday"]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["cousin"]'::jsonb, '{"accepted":["cousin"]}'::jsonb, 'O filho da sua tia ou do seu tio é seu primo ou sua prima.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'family_vocabulary', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l2-e7', 'english-v2-u5-l2', 7, 'SPEAKING', 'Ouça o exemplo e repita. A transcrição é apenas um apoio, não uma nota de pronúncia.', 'Repita: “My family has dinner together.”', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'My family has dinner together.', '["My family has dinner together."]'::jsonb, '{"accepted":["My family has dinner together."]}'::jsonb, 'O reconhecimento de voz apenas transcreve o que percebe; não mede fonética.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'family_speaking', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_lessons(id, unit_id, position, title, introduction, xp_reward, content_version, author, publication_status, review_status) values ('english-v2-u5-l3', 'english-v2-unit-5', 3, 'Lugares da cidade', '“Where is…?” pergunta onde fica algo. “Turn left” e “turn right” indicam virar à esquerda ou à direita.

Objetivo: Perguntar onde fica um lugar e entender instruções curtas de direção.', 30, 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING') on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l3-e1', 'english-v2-u5-l3', 1, 'MULTIPLE_CHOICE', 'Conversa guiada · escolha uma resposta que mantenha o diálogo.', 'Excuse me, where is the bus station?', '["It is across from the park.","I read before bed.","My father is forty."]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["It is across from the park."]'::jsonb, '{"accepted":["It is across from the park."]}'::jsonb, 'A resposta informa a localização da estação.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'directions_places', 2, 'Sofia', '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l3-e2', 'english-v2-u5-l3', 2, 'MULTIPLE_CHOICE', 'Conversa guiada · escolha uma resposta que mantenha o diálogo.', 'How can I get there?', '["Go straight and turn left.","She has a blue notebook.","We have lunch at noon."]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["Go straight and turn left."]'::jsonb, '{"accepted":["Go straight and turn left."]}'::jsonb, 'A resposta dá duas instruções de direção.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'directions_places', 3, 'Sofia', '[{"speaker":"Sofia","text":"Excuse me, where is the bus station?"},{"speaker":"Você","text":"It is across from the park."}]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l3-e3', 'english-v2-u5-l3', 3, 'WORD_ORDER', 'Monte a frase na ordem correta.', 'Monte: “Vire à direita na esquina.”', '[]'::jsonb, '["corner.","the","at","right","Turn"]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["Turn right at the corner."]'::jsonb, '{"accepted":["Turn right at the corner."]}'::jsonb, '“Turn right” significa virar à direita.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'directions_places', 3, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l3-e4', 'english-v2-u5-l3', 4, 'TRANSLATION', 'Escreva uma tradução natural em inglês.', 'O mercado fica atrás da escola.', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["The market is behind the school."]'::jsonb, '{"accepted":["The market is behind the school."]}'::jsonb, '“Behind” significa atrás de.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'directions_places', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l3-e5', 'english-v2-u5-l3', 5, 'LISTENING', 'Ouça a fala e responda sem ver a transcrição.', 'Para qual lado a pessoa deve virar?', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'Turn left at the next street.', '["left","turn left"]'::jsonb, '{"accepted":["left","turn left"]}'::jsonb, '“Left” significa esquerda.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'directions_listening', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l3-e6', 'english-v2-u5-l3', 6, 'FILL_BLANK', 'Escolha a palavra que completa a frase.', 'The bank is ___ the library and the café.', '["between","Monday","sister"]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["between"]'::jsonb, '{"accepted":["between"]}'::jsonb, '“Between” indica que algo fica entre dois lugares.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'directions_places', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l3-e7', 'english-v2-u5-l3', 7, 'SPEAKING', 'Ouça o exemplo e repita. A transcrição é apenas um apoio, não uma nota de pronúncia.', 'Repita: “Go straight and turn left.”', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'Go straight and turn left.', '["Go straight and turn left."]'::jsonb, '{"accepted":["Go straight and turn left."]}'::jsonb, 'Repita se quiser e use a transcrição como referência, sem nota de pronúncia.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'directions_speaking', 3, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_lessons(id, unit_id, position, title, introduction, xp_reward, content_version, author, publication_status, review_status) values ('english-v2-u5-l4', 'english-v2-unit-5', 4, 'Objetos e perguntas', 'Perguntas simples ajudam a descobrir o que é um objeto ou onde está. Preste atenção na resposta e mantenha o diálogo.

Objetivo: Usar “this”, “where” e expressões de posição em perguntas curtas sobre objetos e lugares.', 30, 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING') on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l4-e1', 'english-v2-u5-l4', 1, 'MULTIPLE_CHOICE', 'Conversa guiada · escolha uma resposta que mantenha o diálogo.', 'What is this?', '["It is a map of the city.","I wake up at seven.","He visits on Sunday."]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["It is a map of the city."]'::jsonb, '{"accepted":["It is a map of the city."]}'::jsonb, '“What is this?” pergunta o que é o objeto apresentado.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'object_questions', 2, 'Maya', '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l4-e2', 'english-v2-u5-l4', 2, 'MULTIPLE_CHOICE', 'Conversa guiada · escolha uma resposta que mantenha o diálogo.', 'Where can I find the history book?', '["It is on the shelf by the window.","My brother is thirteen.","We play soccer on Saturday."]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["It is on the shelf by the window."]'::jsonb, '{"accepted":["It is on the shelf by the window."]}'::jsonb, 'A resposta indica o lugar do livro.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'object_questions', 3, 'Maya', '[{"speaker":"Maya","text":"I need the history book for class."},{"speaker":"Você","text":"Let’s look for it in the library."}]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l4-e3', 'english-v2-u5-l4', 3, 'WORD_ORDER', 'Monte a frase na ordem correta.', 'Monte: “Onde fica a entrada do museu?”', '[]'::jsonb, '["entrance?","museum","the","is","Where"]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["Where is the museum entrance?"]'::jsonb, '{"accepted":["Where is the museum entrance?"]}'::jsonb, 'Em perguntas com “where”, o lugar vem depois do verbo “is”.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'object_questions', 3, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l4-e4', 'english-v2-u5-l4', 4, 'TRANSLATION', 'Escreva uma tradução natural em inglês.', 'A chave está sobre a mesa.', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, null, '["The key is on the table."]'::jsonb, '{"accepted":["The key is on the table."]}'::jsonb, '“On the table” significa sobre a mesa.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'object_questions', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l4-e5', 'english-v2-u5-l4', 5, 'LISTENING', 'Ouça a fala e responda sem ver a transcrição.', 'Onde está a mochila?', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'The backpack is under the chair.', '["under the chair"]'::jsonb, '{"accepted":["under the chair"]}'::jsonb, '“Under the chair” significa embaixo da cadeira.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'object_listening', 3, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l4-e6', 'english-v2-u5-l4', 6, 'MATCHING', 'Associe cada expressão ao significado.', 'Encontre os pares correspondentes.', '[]'::jsonb, '[]'::jsonb, '["on the table","under the chair","by the window"]'::jsonb, '["sobre a mesa","embaixo da cadeira","perto da janela"]'::jsonb, null, '[]'::jsonb, '{"pairs":{"on the table":"sobre a mesa","under the chair":"embaixo da cadeira","by the window":"perto da janela"}}'::jsonb, 'As expressões indicam posição ou proximidade.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'object_positions', 2, null, '[]'::jsonb) on conflict (id) do nothing;

insert into public.tec_english_exercises(id, lesson_id, position, exercise_type, instruction, prompt, options, word_bank, left_items, right_items, audio_text, accepted_answers, answer_key, explanation, content_version, author, publication_status, review_status, skill_code, difficulty_level, dialogue_speaker, dialogue_context) values ('english-v2-u5-l4-e7', 'english-v2-u5-l4', 7, 'SPEAKING', 'Ouça o exemplo e repita. A transcrição é apenas um apoio, não uma nota de pronúncia.', 'Repita: “Where is the museum entrance?”', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'Where is the museum entrance?', '["Where is the museum entrance?"]'::jsonb, '{"accepted":["Where is the museum entrance?"]}'::jsonb, 'O microfone é opcional; o texto pode ser digitado.', 3, 'Equipe de conteúdo Tec Escola', 'STAGING', 'PEDAGOGICAL_REVIEW_PENDING', 'object_speaking', 3, null, '[]'::jsonb) on conflict (id) do nothing;

-- END GENERATED TEC ENGLISH V2 CONTENT

notify pgrst, 'reload schema';
