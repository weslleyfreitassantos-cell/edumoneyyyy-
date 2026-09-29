begin;

-- TecEscola Adaptive Learning Complete V1. This extends the validated
-- foundation without replacing the legacy learning-center contract.

create table public.learning_question_skill_links (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  question_id uuid not null references public.learning_questions(id) on delete cascade,
  canonical_skill_id uuid not null references public.learning_curriculum_skills(id) on delete restrict,
  skill_role text not null default 'PRIMARY' check (skill_role in ('PRIMARY', 'SUPPORTING')),
  created_at timestamptz not null default now(),
  constraint learning_question_skill_links_unique unique (question_id, canonical_skill_id)
);
create index learning_question_skill_links_skill_idx
  on public.learning_question_skill_links(institution_id, canonical_skill_id, question_id);

create table public.learning_skill_lessons (
  id uuid primary key default extensions.uuid_generate_v4(),
  canonical_skill_id uuid not null references public.learning_curriculum_skills(id) on delete cascade,
  version integer not null default 1 check (version > 0),
  title text not null,
  summary text not null,
  content_markdown text not null,
  worked_example text,
  tips text[] not null default '{}',
  estimated_minutes integer not null default 5 check (estimated_minutes between 1 and 120),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_skill_lessons_version_unique unique (canonical_skill_id, version)
);

create table public.learning_guided_sessions (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  target_canonical_skill_id uuid not null references public.learning_curriculum_skills(id) on delete restrict,
  target_institution_skill_id uuid references public.learning_skills(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'PAUSED', 'COMPLETED', 'NEEDS_TEACHER_SUPPORT', 'CANCELLED')),
  planner_version text not null default 'V1',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index learning_guided_sessions_one_active_idx
  on public.learning_guided_sessions(student_id, target_canonical_skill_id)
  where status in ('ACTIVE', 'PAUSED');
create index learning_guided_sessions_student_idx
  on public.learning_guided_sessions(institution_id, student_id, status, updated_at desc);

create table public.learning_guided_steps (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  session_id uuid not null references public.learning_guided_sessions(id) on delete cascade,
  canonical_skill_id uuid not null references public.learning_curriculum_skills(id) on delete restrict,
  step_type text not null check (step_type in ('DIAGNOSTIC', 'LESSON', 'PRACTICE', 'LOCK_IN', 'REVIEW', 'RETURN_TO_TARGET')),
  position integer not null check (position >= 0),
  status text not null default 'PENDING' check (status in ('PENDING', 'ACTIVE', 'COMPLETED', 'SKIPPED')),
  activity_id uuid references public.learning_activities(id) on delete set null,
  lesson_id uuid references public.learning_skill_lessons(id) on delete set null,
  attempts integer not null default 0 check (attempts >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_guided_steps_position_unique unique (session_id, position)
);
create index learning_guided_steps_session_idx
  on public.learning_guided_steps(session_id, status, position);

create table public.learning_packages (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid references public.institutions(id) on delete cascade,
  package_type text not null check (package_type in ('TECESCOLA', 'INSTITUTION', 'TEACHER')),
  visibility text not null default 'GLOBAL' check (visibility in ('GLOBAL', 'INSTITUTION', 'PRIVATE')),
  teacher_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  subject_area text,
  active boolean not null default true,
  version integer not null default 1 check (version > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_packages_scope_check check (
    (visibility = 'GLOBAL' and institution_id is null)
    or (visibility in ('INSTITUTION', 'PRIVATE') and institution_id is not null)
  )
);
create table public.learning_package_steps (
  id uuid primary key default extensions.uuid_generate_v4(),
  package_id uuid not null references public.learning_packages(id) on delete cascade,
  position integer not null check (position >= 0),
  step_type text not null check (step_type in ('LESSON', 'ACTIVITY', 'QUESTION_SET', 'DIAGNOSTIC', 'PRACTICE', 'REVIEW', 'SIMULATION', 'RESOURCE')),
  lesson_id uuid references public.learning_skill_lessons(id) on delete set null,
  activity_id uuid references public.learning_activities(id) on delete set null,
  question_bank_id uuid,
  resource_url text,
  title text not null,
  metadata jsonb not null default '{}'::jsonb,
  constraint learning_package_steps_position_unique unique (package_id, position)
);
create table public.learning_package_assignments (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  package_id uuid not null references public.learning_packages(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  constraint learning_package_assignment_target_check check (class_id is not null or student_id is not null)
);
create table public.learning_package_progress (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  package_id uuid not null references public.learning_packages(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  completed_steps integer not null default 0 check (completed_steps >= 0),
  total_steps integer not null default 0 check (total_steps >= 0),
  status text not null default 'NOT_STARTED' check (status in ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
  last_activity_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (package_id, student_id)
);

create table public.learning_daily_plans (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  plan_date date not null,
  planner_version text not null default 'V1',
  estimated_minutes integer not null default 0 check (estimated_minutes >= 0),
  status text not null default 'OPEN' check (status in ('OPEN', 'COMPLETED', 'REPLACED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, student_id, plan_date)
);
create table public.learning_daily_plan_items (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  plan_id uuid not null references public.learning_daily_plans(id) on delete cascade,
  position integer not null check (position >= 0),
  item_type text not null check (item_type in ('REVIEW', 'DIAGNOSTIC', 'BRIDGE', 'CURRENT_TARGET', 'LOCK_IN', 'PRACTICE', 'LESSON', 'SIMULATION')),
  title text not null,
  description text,
  canonical_skill_id uuid references public.learning_curriculum_skills(id) on delete set null,
  session_id uuid references public.learning_guided_sessions(id) on delete set null,
  step_id uuid references public.learning_guided_steps(id) on delete set null,
  lesson_id uuid references public.learning_skill_lessons(id) on delete set null,
  activity_id uuid references public.learning_activities(id) on delete set null,
  estimated_minutes integer not null default 5 check (estimated_minutes > 0),
  status text not null default 'PENDING' check (status in ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (plan_id, position)
);

create table public.learning_error_notebook (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  question_id uuid references public.learning_questions(id) on delete cascade,
  question_bank_id uuid,
  canonical_skill_id uuid references public.learning_curriculum_skills(id) on delete set null,
  error_count integer not null default 1 check (error_count > 0),
  status text not null default 'OPEN' check (status in ('OPEN', 'REVIEWED', 'RESOLVED')),
  first_missed_at timestamptz not null default now(),
  last_missed_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint learning_error_notebook_target_check check (question_id is not null or question_bank_id is not null),
  unique (student_id, question_id)
);
create unique index learning_error_notebook_bank_unique_idx
  on public.learning_error_notebook(student_id, question_bank_id)
  where question_bank_id is not null;
create table public.learning_skill_reviews (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  canonical_skill_id uuid not null references public.learning_curriculum_skills(id) on delete cascade,
  source text not null check (source in ('PRACTICE', 'LOCK_IN', 'REVIEW', 'SIMULATION')),
  interval_days integer not null default 1 check (interval_days in (1, 3, 7, 14, 30)),
  review_due_at timestamptz not null,
  completed_at timestamptz,
  result_score integer check (result_score is null or result_score between 0 and 100),
  created_at timestamptz not null default now()
);
create index learning_skill_reviews_due_idx
  on public.learning_skill_reviews(institution_id, student_id, review_due_at)
  where completed_at is null;

create table public.learning_student_gamification (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  daily_goal_minutes integer not null default 15 check (daily_goal_minutes between 5 and 180),
  last_qualified_activity_date date,
  updated_at timestamptz not null default now(),
  unique (institution_id, student_id)
);
create table public.learning_gamification_events (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  event_key text not null,
  event_type text not null check (event_type in ('DIAGNOSTIC', 'PRACTICE', 'LOCK_IN', 'REVIEW', 'SIMULATION', 'SESSION_COMPLETION')),
  xp integer not null check (xp > 0),
  created_at timestamptz not null default now(),
  unique (student_id, event_key)
);

create table public.learning_question_bank (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid references public.institutions(id) on delete cascade,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  package_type text not null check (package_type in ('TECESCOLA', 'ENEM', 'INSTITUTION', 'TEACHER')),
  source_type text not null,
  source_name text,
  source_year integer,
  source_exam text,
  source_application text,
  source_day text,
  source_number integer,
  subject_area text not null,
  domain text,
  topic text,
  subtopic text,
  statement text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer jsonb,
  explanation text,
  solution text,
  difficulty text check (difficulty is null or difficulty in ('EASY', 'MEDIUM', 'HARD')),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  provenance text,
  source_reference text,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_question_bank_scope_check check (
    (package_type in ('TECESCOLA', 'ENEM') and institution_id is null)
    or (package_type in ('INSTITUTION', 'TEACHER') and institution_id is not null)
  )
);
create index learning_question_bank_filter_idx
  on public.learning_question_bank(package_type, subject_area, difficulty, source_year, active);
alter table public.learning_error_notebook
  add constraint learning_error_notebook_question_bank_fk
  foreign key (question_bank_id) references public.learning_question_bank(id) on delete cascade;
create table public.learning_question_bank_skill_links (
  id uuid primary key default extensions.uuid_generate_v4(),
  question_bank_id uuid not null references public.learning_question_bank(id) on delete cascade,
  canonical_skill_id uuid not null references public.learning_curriculum_skills(id) on delete restrict,
  skill_role text not null default 'PRIMARY' check (skill_role in ('PRIMARY', 'SUPPORTING')),
  unique (question_bank_id, canonical_skill_id)
);

create table public.learning_misconception_tags (
  id uuid primary key default extensions.uuid_generate_v4(),
  code text not null unique,
  title text not null,
  description text,
  active boolean not null default true
);
create table public.learning_question_misconception_links (
  id uuid primary key default extensions.uuid_generate_v4(),
  question_id uuid not null references public.learning_questions(id) on delete cascade,
  misconception_tag_id uuid not null references public.learning_misconception_tags(id) on delete cascade,
  unique (question_id, misconception_tag_id)
);

create table public.learning_simulations (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid references public.institutions(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  simulation_type text not null check (simulation_type in ('HISTORICAL_EXAM', 'AREA', 'SUBJECT', 'TOPIC', 'MINI', 'ADAPTIVE')),
  area text,
  source_year integer,
  question_count integer not null default 0 check (question_count >= 0),
  duration_minutes integer,
  status text not null default 'PUBLISHED' check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.learning_simulation_questions (
  id uuid primary key default extensions.uuid_generate_v4(),
  simulation_id uuid not null references public.learning_simulations(id) on delete cascade,
  position integer not null,
  question_bank_id uuid not null references public.learning_question_bank(id) on delete restrict,
  unique (simulation_id, position),
  unique (simulation_id, question_bank_id)
);
create table public.learning_simulation_attempts (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  simulation_id uuid not null references public.learning_simulations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS', 'COMPLETED', 'ABANDONED')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_seconds integer,
  score integer not null default 0,
  correct_count integer not null default 0,
  total_questions integer not null default 0,
  area_breakdown jsonb not null default '{}'::jsonb,
  skill_breakdown jsonb not null default '{}'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create unique index learning_simulation_one_open_attempt_idx
  on public.learning_simulation_attempts(simulation_id, student_id)
  where status = 'IN_PROGRESS';

create unique index learning_package_assignment_class_unique_idx
  on public.learning_package_assignments(institution_id, package_id, class_id)
  where class_id is not null and student_id is null;
create unique index learning_package_assignment_student_unique_idx
  on public.learning_package_assignments(institution_id, package_id, student_id)
  where student_id is not null;

create or replace function public.start_learning_simulation_attempt(p_institution_id uuid, p_student_id uuid, p_simulation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_id uuid;
  question_total integer;
begin
  if not exists (select 1 from public.students student where student.id = p_student_id and student.institution_id = p_institution_id and student.profile_id = auth.uid() and student.active) then raise exception 'LEARNING_STUDENT_SCOPE_DENIED'; end if;
  if not exists (select 1 from public.learning_simulations simulation where simulation.id = p_simulation_id and simulation.status = 'PUBLISHED' and (simulation.institution_id is null or simulation.institution_id = p_institution_id)) then raise exception 'LEARNING_SIMULATION_NOT_FOUND'; end if;
  select count(*) into question_total from public.learning_simulation_questions where simulation_id = p_simulation_id;
  select id into attempt_id from public.learning_simulation_attempts where simulation_id = p_simulation_id and student_id = p_student_id and status = 'IN_PROGRESS' limit 1;
  if attempt_id is not null then return attempt_id; end if;
  insert into public.learning_simulation_attempts(institution_id, simulation_id, student_id, total_questions)
  values (p_institution_id, p_simulation_id, p_student_id, question_total)
  returning id into attempt_id;
  return attempt_id;
end;
$$;

create or replace function public.submit_learning_simulation_attempt(p_attempt_id uuid, p_answers jsonb, p_duration_seconds integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_row public.learning_simulation_attempts%rowtype;
  question_row record;
  answer_item jsonb;
  correct_count integer := 0;
  total_count integer := 0;
  score_percent integer := 0;
  answer_map jsonb := '{}'::jsonb;
begin
  select attempt.* into attempt_row
   from public.learning_simulation_attempts attempt
   where attempt.id = p_attempt_id
     and attempt.student_id in (select student.id from public.students student where student.profile_id = auth.uid() and student.active);
  if not found then raise exception 'LEARNING_SIMULATION_ATTEMPT_SCOPE_DENIED'; end if;
  if attempt_row.status = 'COMPLETED' then
    return jsonb_build_object('attempt_id', attempt_row.id, 'score', attempt_row.score, 'correct_count', attempt_row.correct_count, 'total_questions', attempt_row.total_questions, 'answers', attempt_row.answers);
  end if;
  if jsonb_typeof(coalesce(p_answers, '[]'::jsonb)) <> 'array' then raise exception 'LEARNING_SIMULATION_ANSWERS_INVALID'; end if;
  for question_row in
    select question_bank.id, question_bank.correct_answer, link.canonical_skill_id
      from public.learning_simulation_questions simulation_question
      join public.learning_question_bank question_bank on question_bank.id = simulation_question.question_bank_id
      left join public.learning_question_bank_skill_links link on link.question_bank_id = question_bank.id and link.skill_role = 'PRIMARY'
     where simulation_question.simulation_id = attempt_row.simulation_id
     order by simulation_question.position
  loop
    total_count := total_count + 1;
    select item into answer_item from jsonb_array_elements(p_answers) item where item->>'question_bank_id' = question_row.id::text limit 1;
    if answer_item is not null and (question_row.correct_answer = answer_item->'answer') then correct_count := correct_count + 1; end if;
    answer_map := answer_map || jsonb_build_object(question_row.id::text, jsonb_build_object('answer', coalesce(answer_item->'answer', 'null'::jsonb), 'is_correct', answer_item is not null and question_row.correct_answer = answer_item->'answer'));
    if question_row.canonical_skill_id is not null then
      insert into public.learning_skill_evidence(institution_id, student_id, canonical_skill_id, source, correct, score, metadata)
      values (attempt_row.institution_id, attempt_row.student_id, question_row.canonical_skill_id, 'SIMULATION', answer_item is not null and question_row.correct_answer = answer_item->'answer', case when answer_item is not null and question_row.correct_answer = answer_item->'answer' then 100 else 0 end, jsonb_build_object('simulation_attempt_id', attempt_row.id, 'question_bank_id', question_row.id));
      perform private.refresh_learning_student_skill_state(attempt_row.institution_id, attempt_row.student_id, question_row.canonical_skill_id);
    end if;
    if answer_item is null or question_row.correct_answer <> answer_item->'answer' then
      insert into public.learning_error_notebook(institution_id, student_id, question_bank_id, canonical_skill_id)
      values (attempt_row.institution_id, attempt_row.student_id, question_row.id, question_row.canonical_skill_id)
      on conflict (student_id, question_bank_id) where question_bank_id is not null do update set
        error_count = public.learning_error_notebook.error_count + 1,
        last_missed_at = now(),
        status = 'OPEN',
        canonical_skill_id = coalesce(public.learning_error_notebook.canonical_skill_id, excluded.canonical_skill_id);
    end if;
  end loop;
  score_percent := case when total_count = 0 then 0 else round(correct_count * 100.0 / total_count)::integer end;
  update public.learning_simulation_attempts set status = 'COMPLETED', completed_at = now(), duration_seconds = coalesce(p_duration_seconds, duration_seconds), score = score_percent, correct_count = correct_count, total_questions = total_count, answers = answer_map, updated_at = now() where id = attempt_row.id;
  perform private.award_learning_xp(attempt_row.institution_id, attempt_row.student_id, 'simulation:' || attempt_row.id::text, 'SIMULATION', 20);
  return jsonb_build_object('attempt_id', attempt_row.id, 'score', score_percent, 'correct_count', correct_count, 'total_questions', total_count, 'answers', answer_map);
end;
$$;

create or replace function public.assign_learning_package(
  p_institution_id uuid,
  p_package_id uuid,
  p_class_id uuid default null,
  p_student_id uuid default null,
  p_due_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignment_id uuid;
  target_class_id uuid;
begin
  if p_class_id is null and p_student_id is null then
    raise exception 'LEARNING_PACKAGE_ASSIGNMENT_TARGET_REQUIRED';
  end if;

  if not exists (
    select 1 from public.learning_packages package
    where package.id = p_package_id
      and package.active
      and (package.visibility = 'GLOBAL' or package.institution_id = p_institution_id)
  ) then
    raise exception 'LEARNING_PACKAGE_NOT_FOUND';
  end if;

  if p_student_id is not null then
    select enrollment.class_id into target_class_id
      from public.enrollments enrollment
     where enrollment.student_id = p_student_id
       and enrollment.institution_id = p_institution_id
       and enrollment.active
     order by enrollment.enrolled_at desc nulls last
     limit 1;
    if target_class_id is null then raise exception 'LEARNING_PACKAGE_STUDENT_NOT_FOUND'; end if;
  else
    target_class_id := p_class_id;
  end if;

  if not exists (
    select 1 from public.classes class
    where class.id = target_class_id
      and class.institution_id = p_institution_id
      and class.active
  ) then
    raise exception 'LEARNING_PACKAGE_CLASS_NOT_FOUND';
  end if;

  if not (
    public.can_manage_institution_operations(p_institution_id)
    or exists (
      select 1 from public.subject_offerings offering
      where offering.institution_id = p_institution_id
        and offering.class_id = target_class_id
        and offering.teacher_profile_id = auth.uid()
        and offering.active
    )
  ) then
    raise exception 'LEARNING_PACKAGE_ASSIGNMENT_SCOPE_DENIED';
  end if;

  select assignment.id into assignment_id
    from public.learning_package_assignments assignment
   where assignment.institution_id = p_institution_id
     and assignment.package_id = p_package_id
     and ((p_student_id is null and assignment.class_id = target_class_id and assignment.student_id is null)
       or (p_student_id is not null and assignment.student_id = p_student_id))
   limit 1;
  if assignment_id is not null then return assignment_id; end if;

  insert into public.learning_package_assignments(
    institution_id, package_id, class_id, student_id, assigned_by, due_at
  ) values (
    p_institution_id, p_package_id, target_class_id, p_student_id, auth.uid(), p_due_at
  ) returning id into assignment_id;
  return assignment_id;
end;
$$;

create or replace function private.award_learning_xp(target_institution_id uuid, target_student_id uuid, target_event_key text, target_event_type text, target_xp integer)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  inserted_count integer;
  today_date date := current_date;
begin
  insert into public.learning_gamification_events(institution_id, student_id, event_key, event_type, xp)
  values (target_institution_id, target_student_id, target_event_key, target_event_type, target_xp)
  on conflict (student_id, event_key) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then return; end if;
  insert into public.learning_student_gamification(institution_id, student_id, xp, current_streak, longest_streak, last_qualified_activity_date)
  values (target_institution_id, target_student_id, target_xp, 1, 1, today_date)
  on conflict (institution_id, student_id) do update set
    xp = public.learning_student_gamification.xp + excluded.xp,
    current_streak = case
      when public.learning_student_gamification.last_qualified_activity_date = today_date then public.learning_student_gamification.current_streak
      when public.learning_student_gamification.last_qualified_activity_date = today_date - 1 then public.learning_student_gamification.current_streak + 1
      else 1
    end,
    longest_streak = greatest(public.learning_student_gamification.longest_streak, case
      when public.learning_student_gamification.last_qualified_activity_date = today_date then public.learning_student_gamification.current_streak
      when public.learning_student_gamification.last_qualified_activity_date = today_date - 1 then public.learning_student_gamification.current_streak + 1
      else 1
    end),
    last_qualified_activity_date = today_date,
    updated_at = now();
end;
$$;

create or replace function public.start_guided_learning_session(p_institution_id uuid, p_student_id uuid, p_target_canonical_skill_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  existing_session public.learning_guided_sessions%rowtype;
  new_session public.learning_guided_sessions%rowtype;
  target_institution_skill_id uuid;
  subject_id uuid;
  class_id uuid;
  position_index integer := 0;
  gap_count integer := 0;
  skill_row record;
begin
  if not exists (
    select 1 from public.students student
    where student.id = p_student_id
      and student.institution_id = p_institution_id
      and student.active
      and (student.profile_id = auth.uid() or public.can_manage_institution_operations(p_institution_id))
  ) then raise exception 'LEARNING_STUDENT_SCOPE_DENIED'; end if;
  if not exists (
    select 1 from public.learning_curriculum_skills skill
    join public.learning_curriculum_catalogs catalog on catalog.id = skill.catalog_id and catalog.active
    where skill.id = p_target_canonical_skill_id and skill.active
  ) then raise exception 'LEARNING_TARGET_NOT_FOUND'; end if;

  select * into existing_session from public.learning_guided_sessions
   where institution_id = p_institution_id and student_id = p_student_id
     and target_canonical_skill_id = p_target_canonical_skill_id
     and status in ('ACTIVE', 'PAUSED')
   order by created_at desc limit 1;
  if found then return jsonb_build_object('session_id', existing_session.id, 'created', false); end if;

  select link.learning_skill_id, unit.subject_id
    into target_institution_skill_id, subject_id
    from public.learning_skill_canonical_links link
    join public.learning_skills institution_skill on institution_skill.id = link.learning_skill_id and institution_skill.active
    join public.learning_units unit on unit.id = institution_skill.unit_id and unit.active
   where link.institution_id = p_institution_id and link.canonical_skill_id = p_target_canonical_skill_id and link.active
   order by link.created_at limit 1;
  select enrollment.class_id into class_id
    from public.enrollments enrollment
   where enrollment.student_id = p_student_id and enrollment.active and enrollment.status = 'active'
   order by enrollment.created_at desc limit 1;

  insert into public.learning_guided_sessions(institution_id, student_id, target_canonical_skill_id, target_institution_skill_id, subject_id, class_id)
  values (p_institution_id, p_student_id, p_target_canonical_skill_id, target_institution_skill_id, subject_id, class_id)
  returning * into new_session;

  for skill_row in
    with recursive required(skill_id, depth) as (
      select p_target_canonical_skill_id, 0
      union
      select prerequisite.prerequisite_skill_id, required.depth + 1
        from required
        join public.learning_skill_prerequisites prerequisite on prerequisite.skill_id = required.skill_id
    )
    select distinct on (required.skill_id) required.skill_id, required.depth, coalesce(state.state, 'UNKNOWN') as learner_state
      from required
      left join public.learning_student_skill_state state on state.institution_id = p_institution_id and state.student_id = p_student_id and state.canonical_skill_id = required.skill_id
     order by required.skill_id, required.depth desc
  loop
    if skill_row.skill_id <> p_target_canonical_skill_id and skill_row.learner_state = 'MASTERED' then continue; end if;
    if skill_row.skill_id <> p_target_canonical_skill_id then gap_count := gap_count + 1; end if;

    insert into public.learning_guided_steps(institution_id, session_id, canonical_skill_id, step_type, position, lesson_id)
    values (p_institution_id, new_session.id, skill_row.skill_id, 'DIAGNOSTIC', position_index, (select lesson.id from public.learning_skill_lessons lesson where lesson.canonical_skill_id = skill_row.skill_id and lesson.active order by lesson.version desc limit 1));
    position_index := position_index + 1;
    insert into public.learning_guided_steps(institution_id, session_id, canonical_skill_id, step_type, position, lesson_id)
    values (p_institution_id, new_session.id, skill_row.skill_id, 'LESSON', position_index, (select lesson.id from public.learning_skill_lessons lesson where lesson.canonical_skill_id = skill_row.skill_id and lesson.active order by lesson.version desc limit 1));
    position_index := position_index + 1;
    insert into public.learning_guided_steps(institution_id, session_id, canonical_skill_id, step_type, position, activity_id)
    values (p_institution_id, new_session.id, skill_row.skill_id, 'PRACTICE', position_index, (select activity.id from public.learning_activities activity join public.learning_skill_canonical_links link on link.learning_skill_id = activity.skill_id and link.canonical_skill_id = skill_row.skill_id and link.institution_id = p_institution_id and link.active where activity.institution_id = p_institution_id and activity.status = 'PUBLISHED' order by activity.created_at desc limit 1));
    position_index := position_index + 1;
    insert into public.learning_guided_steps(institution_id, session_id, canonical_skill_id, step_type, position, activity_id)
    values (p_institution_id, new_session.id, skill_row.skill_id, 'LOCK_IN', position_index, (select activity.id from public.learning_activities activity join public.learning_skill_canonical_links link on link.learning_skill_id = activity.skill_id and link.canonical_skill_id = skill_row.skill_id and link.institution_id = p_institution_id and link.active where activity.institution_id = p_institution_id and activity.status = 'PUBLISHED' order by activity.created_at desc limit 1));
    position_index := position_index + 1;
  end loop;

  if gap_count > 0 then
    insert into public.learning_guided_steps(institution_id, session_id, canonical_skill_id, step_type, position)
    values (p_institution_id, new_session.id, p_target_canonical_skill_id, 'RETURN_TO_TARGET', position_index);
  end if;
  update public.learning_guided_steps step
     set status = 'ACTIVE', started_at = now(), updated_at = now()
   where step.session_id = new_session.id
     and step.position = (select min(first_step.position) from public.learning_guided_steps first_step where first_step.session_id = new_session.id and first_step.status = 'PENDING');
  return jsonb_build_object('session_id', new_session.id, 'created', true, 'target_canonical_skill_id', p_target_canonical_skill_id, 'gap_count', gap_count);
end;
$$;

create or replace function public.complete_guided_learning_step(p_step_id uuid, p_status text default 'COMPLETED', p_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  step_row public.learning_guided_steps%rowtype;
  session_row public.learning_guided_sessions%rowtype;
  next_step_id uuid;
  pending_count integer;
  max_lock_in_attempts integer := 3;
begin
  if p_status not in ('COMPLETED', 'SKIPPED') then raise exception 'LEARNING_STEP_STATUS_INVALID'; end if;
  select step.* into step_row
    from public.learning_guided_steps step
    join public.learning_guided_sessions session on session.id = step.session_id
    join public.students student on student.id = session.student_id
   where step.id = p_step_id
     and (student.profile_id = auth.uid() or public.can_manage_institution_operations(session.institution_id));
  if not found then raise exception 'LEARNING_STEP_SCOPE_DENIED'; end if;
  select * into session_row from public.learning_guided_sessions where id = step_row.session_id;
  if step_row.status in ('COMPLETED', 'SKIPPED') then return jsonb_build_object('step_id', step_row.id, 'idempotent', true, 'session_id', step_row.session_id); end if;

  if step_row.step_type = 'LOCK_IN'
     and p_status = 'COMPLETED'
     and coalesce(p_metadata->>'mastery_confirmed', 'false') <> 'true' then
    update public.learning_guided_steps
       set attempts = attempts + 1, metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb), updated_at = now()
     where id = step_row.id;
    if step_row.attempts + 1 >= max_lock_in_attempts then
      update public.learning_guided_sessions
         set status = 'NEEDS_TEACHER_SUPPORT', updated_at = now()
       where id = step_row.session_id;
      return jsonb_build_object('step_id', step_row.id, 'idempotent', false, 'retry', false, 'needs_teacher_support', true, 'session_id', step_row.session_id, 'session_status', 'NEEDS_TEACHER_SUPPORT');
    end if;
    return jsonb_build_object('step_id', step_row.id, 'idempotent', false, 'retry', true, 'attempts', step_row.attempts + 1, 'session_id', step_row.session_id, 'session_status', 'ACTIVE');
  end if;

  update public.learning_guided_steps
     set status = p_status, completed_at = now(), metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb), updated_at = now()
   where id = p_step_id;
  select count(*) into pending_count from public.learning_guided_steps where session_id = step_row.session_id and status not in ('COMPLETED', 'SKIPPED');
  select id into next_step_id from public.learning_guided_steps where session_id = step_row.session_id and status = 'PENDING' order by position limit 1;
  if next_step_id is not null then
    update public.learning_guided_steps set status = 'ACTIVE', started_at = now(), updated_at = now() where id = next_step_id;
  elsif pending_count = 0 then
    update public.learning_guided_sessions set status = 'COMPLETED', completed_at = now(), updated_at = now() where id = step_row.session_id;
    perform private.award_learning_xp(session_row.institution_id, session_row.student_id, 'guided-session:' || session_row.id::text, 'SESSION_COMPLETION', 25);
  end if;
  return jsonb_build_object('step_id', step_row.id, 'idempotent', false, 'session_id', step_row.session_id, 'next_step_id', next_step_id, 'session_status', case when pending_count = 0 then 'COMPLETED' else 'ACTIVE' end);
end;
$$;

create or replace function public.create_or_get_learning_daily_plan(p_institution_id uuid, p_student_id uuid, p_plan_date date default current_date)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  plan_id uuid;
  active_session_id uuid;
  active_target_id uuid;
  position_index integer := 0;
  review_row record;
begin
  if not exists (select 1 from public.students student where student.id = p_student_id and student.institution_id = p_institution_id and student.active and (student.profile_id = auth.uid() or public.can_manage_institution_operations(p_institution_id))) then raise exception 'LEARNING_STUDENT_SCOPE_DENIED'; end if;
  select id into plan_id from public.learning_daily_plans where institution_id = p_institution_id and student_id = p_student_id and plan_date = p_plan_date;
  if plan_id is not null then return plan_id; end if;

  select session.id, session.target_canonical_skill_id into active_session_id, active_target_id
    from public.learning_guided_sessions session where session.institution_id = p_institution_id and session.student_id = p_student_id and session.status in ('ACTIVE', 'PAUSED') order by session.updated_at desc limit 1;
  insert into public.learning_daily_plans(institution_id, student_id, plan_date) values (p_institution_id, p_student_id, p_plan_date) returning id into plan_id;

  for review_row in
    select review.canonical_skill_id, skill.title
      from public.learning_skill_reviews review
      join public.learning_curriculum_skills skill on skill.id = review.canonical_skill_id
     where review.institution_id = p_institution_id and review.student_id = p_student_id and review.completed_at is null and review.review_due_at <= (p_plan_date + 1)::timestamptz
     order by review.review_due_at limit 2
  loop
    insert into public.learning_daily_plan_items(institution_id, plan_id, position, item_type, title, description, canonical_skill_id, session_id, estimated_minutes)
    values (p_institution_id, plan_id, position_index, 'REVIEW', 'Revisar ' || review_row.title, 'Uma revisão curta para manter o domínio.', review_row.canonical_skill_id, active_session_id, 5);
    position_index := position_index + 1;
  end loop;

  if active_session_id is not null then
    insert into public.learning_daily_plan_items(institution_id, plan_id, position, item_type, title, description, canonical_skill_id, session_id, step_id, lesson_id, activity_id, estimated_minutes)
    select p_institution_id, plan_id, position_index + step.position, case when step.step_type = 'LOCK_IN' then 'LOCK_IN' when step.step_type = 'DIAGNOSTIC' then 'DIAGNOSTIC' when step.step_type = 'LESSON' then 'LESSON' when step.step_type = 'RETURN_TO_TARGET' then 'CURRENT_TARGET' else 'PRACTICE' end, case when step.step_type = 'RETURN_TO_TARGET' then 'Retomar seu objetivo' else initcap(lower(replace(step.step_type, '_', ' '))) || ': ' || skill.title end, 'Próximo passo da sua sessão guiada.', step.canonical_skill_id, active_session_id, step.id, step.lesson_id, step.activity_id, case when step.step_type = 'LESSON' then 6 when step.step_type = 'DIAGNOSTIC' then 5 else 5 end
      from public.learning_guided_steps step
      join public.learning_curriculum_skills skill on skill.id = step.canonical_skill_id
     where step.session_id = active_session_id and step.status in ('ACTIVE', 'PENDING')
     order by step.position limit 4;
  elsif active_target_id is not null then
    insert into public.learning_daily_plan_items(institution_id, plan_id, position, item_type, title, description, canonical_skill_id, estimated_minutes)
    values (p_institution_id, plan_id, position_index, 'CURRENT_TARGET', 'Começar seu próximo objetivo', 'Abra a Central de Estudos para iniciar o diagnóstico.', active_target_id, 5);
  end if;
  update public.learning_daily_plans set estimated_minutes = coalesce((select sum(item.estimated_minutes) from public.learning_daily_plan_items item where item.plan_id = plan_id), 0), updated_at = now() where id = plan_id;
  return plan_id;
end;
$$;

-- The activity draft and all of its questions are one authorized transaction.
-- Publishing/assignment remains a separate explicit action.
create or replace function public.create_learning_activity_with_questions(
  p_institution_id uuid,
  p_subject_id uuid,
  p_unit_id uuid,
  p_skill_id uuid,
  p_teacher_id uuid,
  p_title text,
  p_description text,
  p_activity_type text,
  p_questions jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  activity_id uuid;
  item jsonb;
  question_index integer := 0;
begin
  if auth.uid() is null or auth.uid() <> p_teacher_id then raise exception 'LEARNING_TEACHER_SCOPE_DENIED'; end if;
  if p_activity_type not in ('PRACTICE', 'REINFORCEMENT') then raise exception 'LEARNING_ACTIVITY_TYPE_INVALID'; end if;
  if nullif(trim(coalesce(p_title, '')), '') is null then raise exception 'LEARNING_ACTIVITY_TITLE_REQUIRED'; end if;
  if jsonb_typeof(coalesce(p_questions, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_questions, '[]'::jsonb)) = 0 then raise exception 'LEARNING_ACTIVITY_QUESTIONS_REQUIRED'; end if;
  if not private.learning_is_teacher(p_institution_id) or not private.learning_teacher_owns_subject_class(p_institution_id, p_subject_id, (select offering.class_id from public.subject_offerings offering where offering.subject_id = p_subject_id and offering.teacher_profile_id = auth.uid() and offering.active limit 1)) then
    if not private.learning_teacher_owns_subject(p_institution_id, p_subject_id) then raise exception 'LEARNING_TEACHER_SUBJECT_SCOPE_DENIED'; end if;
  end if;

  insert into public.learning_activities(institution_id, subject_id, unit_id, skill_id, teacher_id, title, description, activity_type, status)
  values (p_institution_id, p_subject_id, p_unit_id, p_skill_id, p_teacher_id, trim(p_title), nullif(trim(coalesce(p_description, '')), ''), p_activity_type, 'DRAFT')
  returning id into activity_id;

  for item in select value from jsonb_array_elements(p_questions)
  loop
    if nullif(trim(coalesce(item->>'question_text', '')), '') is null then raise exception 'LEARNING_QUESTION_TEXT_REQUIRED'; end if;
    if coalesce(item->>'question_type', 'MULTIPLE_CHOICE') not in ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER') then raise exception 'LEARNING_QUESTION_TYPE_INVALID'; end if;
    insert into public.learning_questions(institution_id, activity_id, question_text, question_type, options_json, correct_answer_json, explanation, points, sort_order)
    values (
      p_institution_id, activity_id, trim(item->>'question_text'), coalesce(item->>'question_type', 'MULTIPLE_CHOICE'), coalesce(item->'options_json', '[]'::jsonb), coalesce(item->'correct_answer_json', 'null'::jsonb), nullif(trim(coalesce(item->>'explanation', '')), ''), greatest(1, coalesce((item->>'points')::integer, 1)), coalesce((item->>'sort_order')::integer, question_index)
    );
    question_index := question_index + 1;
  end loop;
  return activity_id;
end;
$$;

create or replace function public.submit_learning_attempt_with_feedback(p_activity_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  outcome record;
  current_student_id uuid;
  feedback jsonb;
begin
  select student.id into current_student_id
    from public.students student
   where student.profile_id = auth.uid()
     and student.active
   limit 1;
  if current_student_id is null then raise exception 'LEARNING_STUDENT_SCOPE_DENIED'; end if;
  select * into outcome from public.submit_learning_attempt(p_activity_id, p_answers) limit 1;
  select coalesce(jsonb_agg(jsonb_build_object(
    'question_id', answer.question_id,
    'is_correct', answer.is_correct,
    'correct_answer', question.correct_answer_json,
    'explanation', question.explanation
  ) order by question.sort_order), '[]'::jsonb)
    into feedback
    from public.learning_answers answer
    join public.learning_questions question on question.id = answer.question_id
   where answer.attempt_id = outcome.attempt_id;
  return jsonb_build_object(
    'attempt_id', outcome.attempt_id,
    'score', outcome.score,
    'total_points', outcome.total_points,
    'mastery_percent', outcome.mastery_percent,
    'feedback', feedback
  );
end;
$$;

create or replace function private.sync_learning_answer_outcome()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  attempt_row public.learning_attempts%rowtype;
  question_skill record;
begin
  if new.is_correct then return new; end if;
  select attempt.* into attempt_row from public.learning_attempts attempt where attempt.id = new.attempt_id;
  for question_skill in
    select link.canonical_skill_id
      from public.learning_question_skill_links link
     where link.question_id = new.question_id and link.institution_id = new.institution_id
     order by link.skill_role = 'PRIMARY' desc
  loop
    insert into public.learning_error_notebook(institution_id, student_id, question_id, canonical_skill_id)
    values (new.institution_id, attempt_row.student_id, new.question_id, question_skill.canonical_skill_id)
    on conflict (student_id, question_id) do update set
      error_count = public.learning_error_notebook.error_count + 1,
      status = 'OPEN',
      last_missed_at = now(),
      canonical_skill_id = coalesce(public.learning_error_notebook.canonical_skill_id, excluded.canonical_skill_id);
    exit;
  end loop;
  return new;
end;
$$;
drop trigger if exists learning_answer_sync_outcome on public.learning_answers;
create trigger learning_answer_sync_outcome after insert on public.learning_answers
for each row execute function private.sync_learning_answer_outcome();

create or replace function private.sync_learning_attempt_reward()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.completed_at is not null and (old.completed_at is null or old.completed_at <> new.completed_at) then
    perform private.award_learning_xp(new.institution_id, new.student_id, 'attempt:' || new.id::text || ':' || extract(epoch from new.completed_at)::text, 'PRACTICE', 10);
  end if;
  return new;
end;
$$;
drop trigger if exists learning_attempt_sync_reward on public.learning_attempts;
create trigger learning_attempt_sync_reward after update on public.learning_attempts
for each row execute function private.sync_learning_attempt_reward();

alter table public.learning_question_skill_links enable row level security;
alter table public.learning_skill_lessons enable row level security;
alter table public.learning_guided_sessions enable row level security;
alter table public.learning_guided_steps enable row level security;
alter table public.learning_packages enable row level security;
alter table public.learning_package_steps enable row level security;
alter table public.learning_package_assignments enable row level security;
alter table public.learning_package_progress enable row level security;
alter table public.learning_daily_plans enable row level security;
alter table public.learning_daily_plan_items enable row level security;
alter table public.learning_error_notebook enable row level security;
alter table public.learning_skill_reviews enable row level security;
alter table public.learning_student_gamification enable row level security;
alter table public.learning_gamification_events enable row level security;
alter table public.learning_question_bank enable row level security;
alter table public.learning_question_bank_skill_links enable row level security;
alter table public.learning_misconception_tags enable row level security;
alter table public.learning_question_misconception_links enable row level security;
alter table public.learning_simulations enable row level security;
alter table public.learning_simulation_questions enable row level security;
alter table public.learning_simulation_attempts enable row level security;

create policy learning_question_skill_links_select on public.learning_question_skill_links for select to authenticated using (exists (select 1 from public.learning_questions question join public.learning_activities activity on activity.id = question.activity_id where question.id = learning_question_skill_links.question_id and (activity.teacher_id = auth.uid() or (activity.status = 'PUBLISHED' and public.can_access_institution(activity.institution_id)))));
create policy learning_question_skill_links_write on public.learning_question_skill_links for all to authenticated using (exists (select 1 from public.learning_questions question join public.learning_activities activity on activity.id = question.activity_id where question.id = learning_question_skill_links.question_id and activity.teacher_id = auth.uid())) with check (exists (select 1 from public.learning_questions question join public.learning_activities activity on activity.id = question.activity_id where question.id = learning_question_skill_links.question_id and activity.teacher_id = auth.uid() and activity.institution_id = learning_question_skill_links.institution_id));
create policy learning_skill_lessons_select on public.learning_skill_lessons for select to authenticated using (active);
create policy learning_guided_sessions_select on public.learning_guided_sessions for select to authenticated using (private.learning_student_owns_state(institution_id, student_id) or public.can_manage_institution_operations(institution_id) or exists (select 1 from public.enrollments enrollment join public.subject_offerings offering on offering.class_id = enrollment.class_id where enrollment.student_id = learning_guided_sessions.student_id and enrollment.active and offering.teacher_profile_id = auth.uid() and offering.subject_id = learning_guided_sessions.subject_id and offering.active));
create policy learning_guided_steps_select on public.learning_guided_steps for select to authenticated using (exists (select 1 from public.learning_guided_sessions session where session.id = session_id and (private.learning_student_owns_state(session.institution_id, session.student_id) or public.can_manage_institution_operations(session.institution_id) or exists (select 1 from public.enrollments enrollment join public.subject_offerings offering on offering.class_id = enrollment.class_id where enrollment.student_id = session.student_id and enrollment.active and offering.teacher_profile_id = auth.uid() and offering.subject_id = session.subject_id and offering.active))));
create policy learning_packages_select on public.learning_packages for select to authenticated using ((visibility = 'GLOBAL' and active) or (institution_id is not null and public.can_access_institution(institution_id) and active));
create policy learning_package_steps_select on public.learning_package_steps for select to authenticated using (exists (select 1 from public.learning_packages package where package.id = package_id and package.active and (package.visibility = 'GLOBAL' or public.can_access_institution(package.institution_id))));
create policy learning_package_assignments_select on public.learning_package_assignments for select to authenticated using (private.learning_student_owns_state(institution_id, student_id) or public.can_manage_institution_operations(institution_id) or assigned_by = auth.uid());
create policy learning_package_progress_select on public.learning_package_progress for select to authenticated using (private.learning_student_owns_state(institution_id, student_id) or public.can_manage_institution_operations(institution_id));
create policy learning_daily_plans_select on public.learning_daily_plans for select to authenticated using (private.learning_student_owns_state(institution_id, student_id) or public.can_manage_institution_operations(institution_id));
create policy learning_daily_plan_items_select on public.learning_daily_plan_items for select to authenticated using (exists (select 1 from public.learning_daily_plans plan where plan.id = plan_id and (private.learning_student_owns_state(plan.institution_id, plan.student_id) or public.can_manage_institution_operations(plan.institution_id))));
create policy learning_error_notebook_select on public.learning_error_notebook for select to authenticated using (private.learning_student_owns_state(institution_id, student_id) or public.can_manage_institution_operations(institution_id) or exists (select 1 from public.enrollments enrollment join public.subject_offerings offering on offering.class_id = enrollment.class_id where enrollment.student_id = learning_error_notebook.student_id and enrollment.active and offering.teacher_profile_id = auth.uid() and offering.active));
create policy learning_skill_reviews_select on public.learning_skill_reviews for select to authenticated using (private.learning_student_owns_state(institution_id, student_id) or public.can_manage_institution_operations(institution_id));
create policy learning_student_gamification_select on public.learning_student_gamification for select to authenticated using (private.learning_student_owns_state(institution_id, student_id) or public.can_manage_institution_operations(institution_id));
create policy learning_gamification_events_select on public.learning_gamification_events for select to authenticated using (private.learning_student_owns_state(institution_id, student_id) or public.can_manage_institution_operations(institution_id));
create policy learning_question_bank_select on public.learning_question_bank for select to authenticated using (active and ((package_type in ('TECESCOLA', 'ENEM') and institution_id is null) or (institution_id is not null and public.can_access_institution(institution_id))));
create policy learning_question_bank_write on public.learning_question_bank for all to authenticated using ((owner_profile_id = auth.uid() and package_type = 'TEACHER') or public.can_manage_institution_operations(institution_id)) with check ((owner_profile_id = auth.uid() and package_type = 'TEACHER') or public.can_manage_institution_operations(institution_id));
create policy learning_question_bank_skill_links_select on public.learning_question_bank_skill_links for select to authenticated using (exists (select 1 from public.learning_question_bank question where question.id = question_bank_id and question.active));
create policy learning_misconception_tags_select on public.learning_misconception_tags for select to authenticated using (active);
create policy learning_question_misconception_links_select on public.learning_question_misconception_links for select to authenticated using (exists (select 1 from public.learning_questions question join public.learning_activities activity on activity.id = question.activity_id where question.id = learning_question_misconception_links.question_id and (activity.teacher_id = auth.uid() or (activity.status = 'PUBLISHED' and public.can_access_institution(activity.institution_id)))));
create policy learning_simulations_select on public.learning_simulations for select to authenticated using (status = 'PUBLISHED' and (institution_id is null or public.can_access_institution(institution_id)));
create policy learning_simulation_questions_select on public.learning_simulation_questions for select to authenticated using (exists (select 1 from public.learning_simulations simulation where simulation.id = simulation_id and simulation.status = 'PUBLISHED' and (simulation.institution_id is null or public.can_access_institution(simulation.institution_id))));
create policy learning_simulation_attempts_select on public.learning_simulation_attempts for select to authenticated using (private.learning_student_owns_state(institution_id, student_id) or public.can_manage_institution_operations(institution_id));

revoke all on table public.learning_question_skill_links, public.learning_skill_lessons, public.learning_guided_sessions, public.learning_guided_steps, public.learning_packages, public.learning_package_steps, public.learning_package_assignments, public.learning_package_progress, public.learning_daily_plans, public.learning_daily_plan_items, public.learning_error_notebook, public.learning_skill_reviews, public.learning_student_gamification, public.learning_gamification_events, public.learning_question_bank, public.learning_question_bank_skill_links, public.learning_misconception_tags, public.learning_question_misconception_links, public.learning_simulations, public.learning_simulation_questions, public.learning_simulation_attempts from anon;
grant select on table public.learning_question_skill_links, public.learning_skill_lessons, public.learning_guided_sessions, public.learning_guided_steps, public.learning_packages, public.learning_package_steps, public.learning_package_assignments, public.learning_package_progress, public.learning_daily_plans, public.learning_daily_plan_items, public.learning_error_notebook, public.learning_skill_reviews, public.learning_student_gamification, public.learning_gamification_events, public.learning_question_bank, public.learning_question_bank_skill_links, public.learning_misconception_tags, public.learning_question_misconception_links, public.learning_simulations, public.learning_simulation_questions, public.learning_simulation_attempts to authenticated;
grant all on table public.learning_question_skill_links, public.learning_skill_lessons, public.learning_guided_sessions, public.learning_guided_steps, public.learning_packages, public.learning_package_steps, public.learning_package_assignments, public.learning_package_progress, public.learning_daily_plans, public.learning_daily_plan_items, public.learning_error_notebook, public.learning_skill_reviews, public.learning_student_gamification, public.learning_gamification_events, public.learning_question_bank, public.learning_question_bank_skill_links, public.learning_misconception_tags, public.learning_question_misconception_links, public.learning_simulations, public.learning_simulation_questions, public.learning_simulation_attempts to service_role;

revoke all on function private.award_learning_xp(uuid, uuid, text, text, integer) from public, anon, authenticated;
revoke all on function private.sync_learning_answer_outcome() from public, anon, authenticated;
revoke all on function private.sync_learning_attempt_reward() from public, anon, authenticated;
revoke all on function public.start_guided_learning_session(uuid, uuid, uuid) from public, anon;
revoke all on function public.complete_guided_learning_step(uuid, text, jsonb) from public, anon;
revoke all on function public.create_or_get_learning_daily_plan(uuid, uuid, date) from public, anon;
revoke all on function public.create_learning_activity_with_questions(uuid, uuid, uuid, uuid, uuid, text, text, text, jsonb) from public, anon;
revoke all on function public.submit_learning_attempt_with_feedback(uuid, jsonb) from public, anon;
revoke all on function public.start_learning_simulation_attempt(uuid, uuid, uuid) from public, anon;
revoke all on function public.submit_learning_simulation_attempt(uuid, jsonb, integer) from public, anon;
grant execute on function public.start_guided_learning_session(uuid, uuid, uuid) to authenticated;
grant execute on function public.complete_guided_learning_step(uuid, text, jsonb) to authenticated;
grant execute on function public.create_or_get_learning_daily_plan(uuid, uuid, date) to authenticated;
grant execute on function public.create_learning_activity_with_questions(uuid, uuid, uuid, uuid, uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.submit_learning_attempt_with_feedback(uuid, jsonb) to authenticated;
grant execute on function public.start_learning_simulation_attempt(uuid, uuid, uuid) to authenticated;
grant execute on function public.submit_learning_simulation_attempt(uuid, jsonb, integer) to authenticated;
revoke all on function public.assign_learning_package(uuid, uuid, uuid, uuid, timestamptz) from public, anon;
grant execute on function public.assign_learning_package(uuid, uuid, uuid, uuid, timestamptz) to authenticated;

-- A class assignment is visible to each enrolled student in that class; a
-- student-specific assignment remains limited to that student.
drop policy if exists learning_package_assignments_select on public.learning_package_assignments;
create policy learning_package_assignments_select on public.learning_package_assignments for select to authenticated using (
  private.learning_student_owns_state(institution_id, student_id)
  or exists (
    select 1 from public.enrollments enrollment
    where enrollment.institution_id = learning_package_assignments.institution_id
      and enrollment.class_id = learning_package_assignments.class_id
      and enrollment.student_id in (select student.id from public.students student where student.profile_id = auth.uid() and student.active)
      and enrollment.active
  )
  or public.can_manage_institution_operations(institution_id)
  or assigned_by = auth.uid()
);

-- Prefer question-level evidence whenever a question has an explicit skill
-- mapping.  Legacy activities without mappings keep the old activity-level
-- fallback, so existing schools remain compatible.
create or replace function public.submit_learning_attempt(p_activity_id uuid, p_answers jsonb)
returns table(attempt_id uuid, score integer, total_points integer, mastery_percent integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activity public.learning_activities%rowtype;
  v_student public.students%rowtype;
  v_attempt uuid;
  v_attempt_run uuid;
  v_run_number integer;
  v_total integer := 0;
  v_score integer := 0;
  v_skill uuid;
  v_canonical_skill uuid;
  v_percent integer := 0;
  v_question_links integer := 0;
  evidence_row record;
  review_interval integer;
begin
  if jsonb_typeof(coalesce(p_answers, '[]'::jsonb)) <> 'array' then raise exception 'Respostas inválidas.'; end if;
  select * into v_activity from public.learning_activities where id = p_activity_id and status = 'PUBLISHED';
  if not found then raise exception 'Atividade indisponível.'; end if;
  select student.* into v_student from public.students student where student.profile_id = auth.uid() and student.institution_id = v_activity.institution_id and student.active;
  if not found or not private.learning_is_assigned_student(p_activity_id, v_student.id) then raise exception 'Aluno não possui acesso a esta atividade.'; end if;

  select coalesce(sum(question.points), 0)::integer into v_total from public.learning_questions question where question.activity_id = p_activity_id;
  v_skill := v_activity.skill_id;
  insert into public.learning_attempts(institution_id, activity_id, student_id, total_points, completed_at)
  values (v_activity.institution_id, p_activity_id, v_student.id, v_total, now())
  on conflict (activity_id, student_id) do update set started_at = now(), completed_at = now(), total_points = excluded.total_points
  returning id into v_attempt;
  delete from public.learning_answers answer where answer.attempt_id = v_attempt;
  insert into public.learning_answers(institution_id, attempt_id, question_id, answer_json, is_correct, points_awarded)
  select v_activity.institution_id, v_attempt, question.id, item->'answer', question.correct_answer_json = item->'answer', case when question.correct_answer_json = item->'answer' then question.points else 0 end
    from public.learning_questions question
    join jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) item on (item->>'question_id')::uuid = question.id
   where question.activity_id = p_activity_id;
  select coalesce(sum(answer.points_awarded), 0)::integer into v_score from public.learning_answers answer where answer.attempt_id = v_attempt;
  update public.learning_attempts set score = v_score where id = v_attempt;
  v_percent := case when v_total = 0 then 0 else least(100, round(v_score * 100.0 / v_total)::integer) end;

  select coalesce(max(run_number), 0) + 1 into v_run_number from public.learning_attempt_runs where activity_id = p_activity_id and student_id = v_student.id;
  insert into public.learning_attempt_runs(institution_id, activity_id, student_id, legacy_attempt_id, run_number, score, total_points, source)
  values (v_activity.institution_id, p_activity_id, v_student.id, v_attempt, v_run_number, v_score, v_total, 'PRACTICE') returning id into v_attempt_run;
  insert into public.learning_attempt_run_answers(institution_id, run_id, question_id, answer_json, is_correct, points_awarded)
  select v_activity.institution_id, v_attempt_run, question.id, item->'answer', question.correct_answer_json = item->'answer', case when question.correct_answer_json = item->'answer' then question.points else 0 end
    from public.learning_questions question
    join jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) item on (item->>'question_id')::uuid = question.id
   where question.activity_id = p_activity_id;

  if v_skill is not null then
    insert into public.learning_skill_progress(institution_id, student_id, skill_id, mastery_percent, status, last_activity_at)
    values (v_activity.institution_id, v_student.id, v_skill, v_percent, case when v_percent >= 80 then 'MASTERED' when v_percent > 0 then 'IN_PROGRESS' else 'NOT_STARTED' end, now())
    on conflict (institution_id, student_id, skill_id) do update set mastery_percent = excluded.mastery_percent, status = excluded.status, last_activity_at = excluded.last_activity_at, updated_at = now();
  end if;

  select count(*) into v_question_links
    from public.learning_question_skill_links link
    join public.learning_questions question on question.id = link.question_id
   where question.activity_id = p_activity_id and link.institution_id = v_activity.institution_id;

  if v_question_links > 0 then
    for evidence_row in
      select link.canonical_skill_id, coalesce(sum(answer.points_awarded), 0)::integer as skill_score, coalesce(sum(question.points), 0)::integer as skill_total
        from public.learning_question_skill_links link
        join public.learning_questions question on question.id = link.question_id and question.activity_id = p_activity_id
        join public.learning_answers answer on answer.attempt_id = v_attempt and answer.question_id = question.id
       where link.institution_id = v_activity.institution_id
       group by link.canonical_skill_id
    loop
      insert into public.learning_skill_evidence(institution_id, student_id, canonical_skill_id, source, correct, score, attempt_run_id, metadata)
      values (v_activity.institution_id, v_student.id, evidence_row.canonical_skill_id, 'PRACTICE', evidence_row.skill_score >= greatest(1, evidence_row.skill_total) * 0.8, case when evidence_row.skill_total = 0 then 0 else round(evidence_row.skill_score * 100.0 / evidence_row.skill_total, 2) end, v_attempt_run, jsonb_build_object('question_level', true));
      review_interval := case when evidence_row.skill_total > 0 and evidence_row.skill_score * 100.0 / evidence_row.skill_total >= 90 then 14 when evidence_row.skill_total > 0 and evidence_row.skill_score * 100.0 / evidence_row.skill_total >= 80 then 7 else 1 end;
      insert into public.learning_skill_reviews(institution_id, student_id, canonical_skill_id, source, interval_days, review_due_at, result_score)
      values (v_activity.institution_id, v_student.id, evidence_row.canonical_skill_id, 'PRACTICE', review_interval, now() + (review_interval || ' days')::interval, case when evidence_row.skill_total = 0 then 0 else round(evidence_row.skill_score * 100.0 / evidence_row.skill_total)::integer end);
      perform private.refresh_learning_student_skill_state(v_activity.institution_id, v_student.id, evidence_row.canonical_skill_id);
    end loop;
  elsif v_skill is not null then
    select link.canonical_skill_id into v_canonical_skill from public.learning_skill_canonical_links link where link.institution_id = v_activity.institution_id and link.learning_skill_id = v_skill and link.active is true;
    if v_canonical_skill is not null then
      insert into public.learning_skill_evidence(institution_id, student_id, canonical_skill_id, source, correct, score, attempt_run_id, metadata)
      values (v_activity.institution_id, v_student.id, v_canonical_skill, 'PRACTICE', v_percent >= 80, v_percent, v_attempt_run, jsonb_build_object('question_level', false, 'legacy_fallback', true));
      insert into public.learning_skill_reviews(institution_id, student_id, canonical_skill_id, source, interval_days, review_due_at, result_score)
      values (v_activity.institution_id, v_student.id, v_canonical_skill, 'PRACTICE', case when v_percent >= 90 then 14 when v_percent >= 80 then 7 else 1 end, now() + ((case when v_percent >= 90 then 14 when v_percent >= 80 then 7 else 1 end) || ' days')::interval, v_percent);
      perform private.refresh_learning_student_skill_state(v_activity.institution_id, v_student.id, v_canonical_skill);
    end if;
  end if;
  return query select v_attempt, v_score, v_total, v_percent;
end;
$$;

do $$
declare
  v_catalog_id uuid;
  v_skill_id uuid;
  item record;
begin
  insert into public.learning_curriculum_catalogs(code, name, version, description, active)
  values ('TECESCOLA_CORE', 'TecEscola Core', '1.0', 'Habilidades base para a primeira jornada adaptativa.', true)
  on conflict (code, version) do update set active = true, updated_at = now()
  returning id into v_catalog_id;
  if v_catalog_id is null then
    select catalog.id into v_catalog_id from public.learning_curriculum_catalogs catalog where catalog.code = 'TECESCOLA_CORE' and catalog.version = '1.0';
  end if;

  for item in select * from (values
    ('FRACTIONS', 'ENSINO_FUNDAMENTAL', 6, 'MATEMATICA', 'NUMEROS', 'Fundamentos de frações', 'Representar, comparar e operar frações.'),
    ('RATIO_PROPORTION', 'ENSINO_FUNDAMENTAL', 7, 'MATEMATICA', 'GRANDEZAS', 'Razão e proporção', 'Relacionar grandezas por razões e proporções.'),
    ('PERCENTAGE', 'ENSINO_FUNDAMENTAL', 7, 'MATEMATICA', 'GRANDEZAS', 'Porcentagem', 'Resolver situações percentuais.'),
    ('EQUATIONS', 'ENSINO_FUNDAMENTAL', 8, 'MATEMATICA', 'ALGEBRA', 'Equações', 'Modelar e resolver equações de primeiro grau.'),
    ('FUNCTIONS_INTRO', 'ENSINO_MEDIO', 1, 'MATEMATICA', 'ALGEBRA', 'Introdução a funções', 'Interpretar relações entre variáveis.'),
    ('LINEAR_FUNCTION', 'ENSINO_MEDIO', 1, 'MATEMATICA', 'ALGEBRA', 'Função afim', 'Interpretar lei, gráfico e variação de uma função afim.')
  ) as v(code, stage, grade_level, subject_area, domain, title, description)
  loop
    insert into public.learning_curriculum_skills(catalog_id, code, stage, grade_level, subject_area, domain, title, description, active)
    values (v_catalog_id, item.code, item.stage, item.grade_level, item.subject_area, item.domain, item.title, item.description, true)
    on conflict (catalog_id, code) do update set title = excluded.title, description = excluded.description, active = true
    returning id into v_skill_id;
    if v_skill_id is null then
      select canonical.id into v_skill_id from public.learning_curriculum_skills canonical where canonical.catalog_id = v_catalog_id and canonical.code = item.code;
    end if;
    insert into public.learning_skill_lessons(canonical_skill_id, version, title, summary, content_markdown, worked_example, tips, estimated_minutes)
    values (v_skill_id, 1, item.title, item.description, '## ' || item.title || E'\\n\\n' || item.description, 'Comece identificando as grandezas conhecidas e represente cada passo antes de calcular.', array['Explique o raciocínio em cada etapa.', 'Confira se a resposta faz sentido no contexto.'], 6)
    on conflict (canonical_skill_id, version) do update set summary = excluded.summary, content_markdown = excluded.content_markdown, active = true, updated_at = now();
  end loop;
end;
$$;

do $$
declare
  v_skill_id uuid;
  v_question_id uuid;
  v_simulation_id uuid;
  v_question_ids uuid[];
  item record;
  question_index integer := 0;
begin
  for item in select * from (values
    ('FRACTIONS', 'Quanto é 1/2 + 1/4?', '3/4', '1/2', '3/4', '1/4'),
    ('RATIO_PROPORTION', 'Se 2 cadernos custam 10 reais, quanto custam 6?', '30', '20', '25', '30'),
    ('PERCENTAGE', 'Quanto é 25% de 80?', '20', '15', '20', '25'),
    ('EQUATIONS', 'Qual valor resolve 2x + 4 = 10?', '3', '2', '3', '4'),
    ('FUNCTIONS_INTRO', 'Em uma relação, a saída depende de qual elemento?', 'entrada', 'entrada', 'apenas do resultado', 'nenhum'),
    ('LINEAR_FUNCTION', 'Na função f(x) = 2x + 1, qual é f(3)?', '7', '5', '6', '7')
  ) as v(code, statement, correct, option_one, option_two, option_three)
  loop
    select canonical.id into v_skill_id from public.learning_curriculum_skills canonical join public.learning_curriculum_catalogs catalog on catalog.id = canonical.catalog_id where catalog.code = 'TECESCOLA_CORE' and canonical.code = item.code;
    select question.id into v_question_id from public.learning_question_bank question where question.source_type = 'TECESCOLA_CORE_V1' and question.statement = item.statement limit 1;
    if v_question_id is null then
      insert into public.learning_question_bank(package_type, source_type, source_name, subject_area, domain, topic, statement, options, correct_answer, explanation, difficulty, estimated_minutes, provenance, active)
      values ('TECESCOLA', 'TECESCOLA_CORE_V1', 'TecEscola', 'MATEMATICA', 'ALGEBRA', item.code, item.statement, jsonb_build_array(item.option_one, item.option_two, item.option_three), to_jsonb(item.correct), 'Compare cada alternativa com o raciocínio feito passo a passo.', 'EASY', 3, 'Conteúdo autoral versionado do TecEscola; não é questão oficial ENEM.', true)
      returning id into v_question_id;
    end if;
    insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role)
    values (v_question_id, v_skill_id, 'PRIMARY') on conflict (question_bank_id, canonical_skill_id) do nothing;
  end loop;

  select array_agg(question.id order by question.created_at) into v_question_ids from public.learning_question_bank question where question.source_type = 'TECESCOLA_CORE_V1';
  select simulation.id into v_simulation_id from public.learning_simulations simulation where simulation.title = 'Matemática · diagnóstico rápido' and simulation.institution_id is null limit 1;
  if v_simulation_id is null then
    insert into public.learning_simulations(institution_id, title, simulation_type, area, question_count, duration_minutes, status, metadata)
    values (null, 'Matemática · diagnóstico rápido', 'MINI', 'MATEMATICA', coalesce(array_length(v_question_ids, 1), 0), 20, 'PUBLISHED', jsonb_build_object('source', 'TECESCOLA_CORE_V1')) returning id into v_simulation_id;
  end if;
  if v_question_ids is not null then
    for question_index in 1..array_length(v_question_ids, 1)
    loop
      insert into public.learning_simulation_questions(simulation_id, position, question_bank_id)
      values (v_simulation_id, question_index - 1, v_question_ids[question_index]) on conflict (simulation_id, question_bank_id) do nothing;
    end loop;
  end if;
end;
$$;

do $$
declare
  package_id uuid;
  lesson_row record;
begin
  for lesson_row in
    select lesson.id, lesson.title, canonical.subject_area
      from public.learning_skill_lessons lesson
      join public.learning_curriculum_skills canonical on canonical.id = lesson.canonical_skill_id
      join public.learning_curriculum_catalogs catalog on catalog.id = canonical.catalog_id and catalog.code = 'TECESCOLA_CORE'
     where lesson.version = 1 and lesson.active
     order by canonical.grade_level, canonical.title
  loop
    select package.id into package_id from public.learning_packages package where package.title = lesson_row.title and package.visibility = 'GLOBAL' limit 1;
    if package_id is null then
      insert into public.learning_packages(package_type, visibility, title, description, subject_area)
      values ('TECESCOLA', 'GLOBAL', lesson_row.title, 'Trilha curta para construir segurança passo a passo.', lesson_row.subject_area)
      returning id into package_id;
    end if;
    insert into public.learning_package_steps(package_id, position, step_type, lesson_id, title)
    values (package_id, 0, 'LESSON', lesson_row.id, lesson_row.title)
    on conflict (package_id, position) do nothing;
  end loop;

  select package.id into package_id from public.learning_packages package where package.title = 'Preparação Matemática ENEM — Fundamentos' and package.visibility = 'GLOBAL' limit 1;
  if package_id is null then
    insert into public.learning_packages(package_type, visibility, title, description, subject_area)
    values ('TECESCOLA', 'GLOBAL', 'Preparação Matemática ENEM — Fundamentos', 'Percurso de fundamentos para interpretar problemas matemáticos.', 'MATEMATICA') returning id into package_id;
    insert into public.learning_package_steps(package_id, position, step_type, lesson_id, title)
    select package_id, row_number() over (order by lesson.id) - 1, 'LESSON', lesson.id, lesson.title
      from public.learning_skill_lessons lesson
      join public.learning_curriculum_skills canonical on canonical.id = lesson.canonical_skill_id
      join public.learning_curriculum_catalogs catalog on catalog.id = canonical.catalog_id and catalog.code = 'TECESCOLA_CORE'
     where lesson.version = 1 and lesson.active;
  end if;
end;
$$;

insert into public.learning_misconception_tags(code, title, description)
values ('fraction_add_direct_components', 'Soma direta de componentes', 'Soma numeradores e denominadores sem equivalência de denominadores.')
on conflict (code) do update set active = true;

notify pgrst, 'reload schema';
commit;
