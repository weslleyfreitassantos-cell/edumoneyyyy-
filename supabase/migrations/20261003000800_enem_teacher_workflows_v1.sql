begin;

create table if not exists public.learning_simulation_assignments (
  id uuid primary key default uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  simulation_id uuid not null references public.learning_simulations(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id),
  available_from timestamptz not null default now(),
  due_at timestamptz,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_simulation_assignment_target_check
    check ((class_id is not null) <> (student_id is not null)),
  constraint learning_simulation_assignment_due_check
    check (due_at is null or due_at >= available_from)
);

create unique index if not exists learning_simulation_assignment_class_unique_idx
  on public.learning_simulation_assignments(institution_id, simulation_id, class_id)
  where class_id is not null and student_id is null and status = 'ACTIVE';

create unique index if not exists learning_simulation_assignment_student_unique_idx
  on public.learning_simulation_assignments(institution_id, simulation_id, student_id)
  where student_id is not null and status = 'ACTIVE';

create index if not exists learning_simulation_assignments_scope_idx
  on public.learning_simulation_assignments(institution_id, simulation_id, status, created_at desc);

create table if not exists public.learning_pedagogical_reviews (
  id uuid primary key default uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  question_bank_id uuid not null references public.learning_question_bank(id) on delete cascade,
  state text not null default 'HUMAN_REVIEW_PENDING'
    check (state in ('AUTO_CLASSIFIED', 'HUMAN_REVIEW_PENDING', 'HUMAN_REVIEWED', 'NEEDS_CORRECTION')),
  suggested_subject_area text,
  topic text,
  difficulty text check (difficulty is null or difficulty in ('EASY', 'MEDIUM', 'HARD')),
  primary_canonical_skill_id uuid references public.learning_curriculum_skills(id),
  supporting_canonical_skill_ids uuid[] not null default '{}'::uuid[],
  explanation text,
  misconception text,
  confidence text not null default 'UNMAPPED'
    check (confidence in ('HIGH', 'MEDIUM', 'LOW', 'UNMAPPED')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, question_bank_id)
);

create index if not exists learning_pedagogical_reviews_queue_idx
  on public.learning_pedagogical_reviews(institution_id, state, updated_at desc);

create table if not exists public.learning_pedagogical_review_audits (
  id uuid primary key default uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  review_id uuid not null references public.learning_pedagogical_reviews(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id),
  before_json jsonb not null,
  after_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists learning_pedagogical_review_audits_scope_idx
  on public.learning_pedagogical_review_audits(institution_id, review_id, created_at desc);

create or replace function public.assign_learning_simulation(
  p_institution_id uuid,
  p_simulation_id uuid,
  p_class_id uuid default null,
  p_student_id uuid default null,
  p_available_from timestamptz default now(),
  p_due_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignment_id uuid;
  target_class_id uuid := p_class_id;
begin
  if auth.uid() is null or (p_class_id is null and p_student_id is null) or (p_class_id is not null and p_student_id is not null) then
    raise exception 'LEARNING_SIMULATION_ASSIGNMENT_TARGET_INVALID';
  end if;
  if p_due_at is not null and p_due_at < coalesce(p_available_from, now()) then
    raise exception 'LEARNING_SIMULATION_ASSIGNMENT_DUE_INVALID';
  end if;
  if not exists (
    select 1 from public.learning_simulations simulation
    where simulation.id = p_simulation_id
      and simulation.status = 'PUBLISHED'
      and (simulation.institution_id is null or simulation.institution_id = p_institution_id)
  ) then
    raise exception 'LEARNING_SIMULATION_NOT_FOUND';
  end if;

  if p_student_id is not null then
    select enrollment.class_id into target_class_id
      from public.students student
      join public.enrollments enrollment on enrollment.student_id = student.id and enrollment.active
      join public.classes enrolled_class on enrolled_class.id = enrollment.class_id and enrolled_class.active
     where student.id = p_student_id
       and student.institution_id = p_institution_id
       and student.active
       and enrolled_class.institution_id = p_institution_id
     order by enrollment.enrolled_at desc nulls last
     limit 1;
    if target_class_id is null then raise exception 'LEARNING_SIMULATION_STUDENT_NOT_FOUND'; end if;
  elsif not exists (
    select 1 from public.classes target_class
    where target_class.id = target_class_id
      and target_class.institution_id = p_institution_id
      and target_class.active
  ) then
    raise exception 'LEARNING_SIMULATION_CLASS_NOT_FOUND';
  end if;

  if not (
    public.can_manage_institution_operations(p_institution_id)
    or exists (
      select 1
        from public.subject_offerings offering
        join public.classes offering_class on offering_class.id = offering.class_id
       where offering.class_id = target_class_id
         and offering_class.institution_id = p_institution_id
         and offering.teacher_profile_id = auth.uid()
         and offering.active
    )
  ) then
    raise exception 'LEARNING_SIMULATION_ASSIGNMENT_SCOPE_DENIED';
  end if;

  select assignment.id into assignment_id
    from public.learning_simulation_assignments assignment
   where assignment.institution_id = p_institution_id
     and assignment.simulation_id = p_simulation_id
     and assignment.status = 'ACTIVE'
     and ((p_student_id is null and assignment.class_id = target_class_id and assignment.student_id is null)
       or (p_student_id is not null and assignment.student_id = p_student_id));
  if assignment_id is not null then return assignment_id; end if;

  insert into public.learning_simulation_assignments(
    institution_id, simulation_id, class_id, student_id, assigned_by, available_from, due_at
  ) values (
    p_institution_id, p_simulation_id, target_class_id, p_student_id, auth.uid(), coalesce(p_available_from, now()), p_due_at
  ) returning id into assignment_id;
  return assignment_id;
end;
$$;

create or replace function public.list_student_learning_simulation_assignments(
  p_institution_id uuid,
  p_student_id uuid
)
returns table (
  assignment_id uuid,
  simulation_id uuid,
  title text,
  simulation_type text,
  area text,
  source_year integer,
  question_count integer,
  duration_minutes integer,
  assigned_by_name text,
  available_from timestamptz,
  due_at timestamptz,
  assignment_status text,
  started_at timestamptz,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.students student
     where student.id = p_student_id
       and student.institution_id = p_institution_id
       and student.profile_id = auth.uid()
       and student.active
  ) then
    raise exception 'LEARNING_STUDENT_SCOPE_DENIED';
  end if;
  return query
  select assignment.id, simulation.id, simulation.title, simulation.simulation_type,
    simulation.area, simulation.source_year, simulation.question_count, simulation.duration_minutes,
    coalesce(profile.full_name, 'Professor'), assignment.available_from, assignment.due_at,
    case when attempt.status = 'COMPLETED' then 'COMPLETED'
         when attempt.id is not null then 'IN_PROGRESS'
         else 'ASSIGNED' end,
    attempt.started_at, attempt.completed_at
    from public.learning_simulation_assignments assignment
    join public.learning_simulations simulation on simulation.id = assignment.simulation_id
    left join public.profiles profile on profile.id = assignment.assigned_by
    left join lateral (
      select attempt.*
        from public.learning_simulation_attempts attempt
       where attempt.institution_id = p_institution_id
         and attempt.simulation_id = assignment.simulation_id
         and attempt.student_id = p_student_id
       order by case when attempt.status = 'IN_PROGRESS' then 0 else 1 end, attempt.started_at desc
       limit 1
    ) attempt on true
   where assignment.institution_id = p_institution_id
     and assignment.status = 'ACTIVE'
     and assignment.available_from <= now()
     and (assignment.student_id = p_student_id or exists (
       select 1 from public.enrollments enrollment
        where enrollment.student_id = p_student_id
          and enrollment.class_id = assignment.class_id
          and enrollment.active
     ))
   order by assignment.due_at nulls last, assignment.created_at desc;
end;
$$;

create or replace function public.list_teacher_learning_simulation_assignments(
  p_institution_id uuid
)
returns table (
  assignment_id uuid,
  simulation_id uuid,
  title text,
  class_id uuid,
  class_name text,
  student_id uuid,
  student_name text,
  due_at timestamptz,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.can_manage_institution_operations(p_institution_id) or exists (
    select 1 from public.subject_offerings offering
    join public.classes offering_class on offering_class.id = offering.class_id
    where offering_class.institution_id = p_institution_id
      and offering.teacher_profile_id = auth.uid()
      and offering.active
  )) then
    raise exception 'LEARNING_TEACHER_SCOPE_DENIED';
  end if;
  return query
  select assignment.id, assignment.simulation_id, simulation.title, assignment.class_id,
    target_class.name, assignment.student_id, student_profile.full_name,
    assignment.due_at,
    case when assignment.status = 'CANCELLED' then 'CANCELLED'
         when exists (select 1 from public.learning_simulation_attempts attempt where attempt.simulation_id = assignment.simulation_id and attempt.student_id = assignment.student_id and attempt.status = 'COMPLETED') then 'COMPLETED'
         else assignment.status end,
    assignment.created_at
    from public.learning_simulation_assignments assignment
    join public.learning_simulations simulation on simulation.id = assignment.simulation_id
    left join public.classes target_class on target_class.id = assignment.class_id
    left join public.students student on student.id = assignment.student_id
    left join public.profiles student_profile on student_profile.id = student.profile_id
   where assignment.institution_id = p_institution_id
     and (assignment.assigned_by = auth.uid() or public.can_manage_institution_operations(p_institution_id))
   order by assignment.created_at desc;
end;
$$;

create or replace function public.get_teacher_learning_simulation_results(
  p_institution_id uuid,
  p_assignment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignment_row public.learning_simulation_assignments%rowtype;
begin
  select assignment.* into assignment_row
    from public.learning_simulation_assignments assignment
   where assignment.id = p_assignment_id
     and assignment.institution_id = p_institution_id;
  if not found then raise exception 'LEARNING_SIMULATION_ASSIGNMENT_NOT_FOUND'; end if;
  if not (
    public.can_manage_institution_operations(p_institution_id)
    or (assignment_row.assigned_by = auth.uid())
    or exists (
      select 1 from public.subject_offerings offering
       where offering.class_id = assignment_row.class_id
         and offering.teacher_profile_id = auth.uid()
         and offering.active
    )
  ) then
    raise exception 'LEARNING_TEACHER_SCOPE_DENIED';
  end if;

  return (
    with roster as (
      select student.id as student_id, profile.full_name
        from public.students student
        join public.profiles profile on profile.id = student.profile_id
        join public.enrollments enrollment on enrollment.student_id = student.id and enrollment.active
       where student.institution_id = p_institution_id
         and student.active
         and ((assignment_row.student_id is not null and student.id = assignment_row.student_id)
           or (assignment_row.student_id is null and enrollment.class_id = assignment_row.class_id))
    ), stats as (
      select roster.student_id, roster.full_name,
        attempt.status as attempt_status, attempt.score, attempt.correct_count,
        attempt.total_questions, attempt.completed_at, attempt.area_breakdown, attempt.skill_breakdown
        from roster
        left join lateral (
          select attempt.*
            from public.learning_simulation_attempts attempt
           where attempt.institution_id = p_institution_id
             and attempt.simulation_id = assignment_row.simulation_id
             and attempt.student_id = roster.student_id
           order by case when attempt.status = 'COMPLETED' then 0 when attempt.status = 'IN_PROGRESS' then 1 else 2 end, attempt.started_at desc
           limit 1
        ) attempt on true
    ), area_totals as (
      select piece.key,
        sum(coalesce((piece.value->>'correct')::integer, 0)) as correct,
        sum(coalesce((piece.value->>'total')::integer, 0)) as total
        from stats
        cross join lateral jsonb_each(coalesce(stats.area_breakdown, '{}'::jsonb)) piece
       where stats.attempt_status = 'COMPLETED'
       group by piece.key
    ), skill_totals as (
      select piece.key,
        sum(coalesce((piece.value->>'correct')::integer, 0)) as correct,
        sum(coalesce((piece.value->>'total')::integer, 0)) as total
        from stats
        cross join lateral jsonb_each(coalesce(stats.skill_breakdown, '{}'::jsonb)) piece
       where stats.attempt_status = 'COMPLETED'
       group by piece.key
    )
    select jsonb_build_object(
      'assignment_id', assignment_row.id,
      'simulation_id', assignment_row.simulation_id,
      'summary', jsonb_build_object(
        'assigned', count(*),
        'started', count(*) filter (where stats.attempt_status is not null),
        'completed', count(*) filter (where stats.attempt_status = 'COMPLETED'),
        'not_started', count(*) filter (where stats.attempt_status is null),
        'completion_rate', case when count(*) = 0 then 0 else round(count(*) filter (where stats.attempt_status = 'COMPLETED') * 100.0 / count(*)) end,
        'average_raw_accuracy', coalesce(round(avg(stats.score) filter (where stats.attempt_status = 'COMPLETED')), 0)
      ),
      'students', coalesce(jsonb_agg(jsonb_build_object(
        'student_id', stats.student_id,
        'student_name', stats.full_name,
        'status', case when stats.attempt_status = 'COMPLETED' then 'COMPLETED' when stats.attempt_status is null then 'NOT_STARTED' else 'IN_PROGRESS' end,
        'score', stats.score,
        'correct_count', stats.correct_count,
        'total_questions', stats.total_questions,
        'completed_at', stats.completed_at
      ) order by stats.full_name), '[]'::jsonb),
      'area_breakdown', coalesce((select jsonb_object_agg(area_totals.key, jsonb_build_object('correct', area_totals.correct, 'total', area_totals.total)) from area_totals), '{}'::jsonb),
      'skill_breakdown', coalesce((select jsonb_object_agg(skill_totals.key, jsonb_build_object('correct', skill_totals.correct, 'total', skill_totals.total)) from skill_totals), '{}'::jsonb)
    ) from stats
  );
end;
$$;

create or replace function public.list_teacher_learning_pedagogical_reviews(
  p_institution_id uuid,
  p_state text default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  question_bank_id uuid,
  state text,
  source_year integer,
  source_name text,
  source_reference text,
  statement text,
  source_options jsonb,
  official_answer jsonb,
  source_subject_area text,
  suggested_subject_area text,
  topic text,
  difficulty text,
  primary_canonical_skill_id uuid,
  primary_skill_title text,
  supporting_canonical_skill_ids uuid[],
  explanation text,
  misconception text,
  confidence text,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.can_manage_institution_operations(p_institution_id) or exists (
    select 1 from public.subject_offerings offering
    join public.classes offering_class on offering_class.id = offering.class_id
    where offering_class.institution_id = p_institution_id
      and offering.teacher_profile_id = auth.uid()
      and offering.active
  )) then
    raise exception 'LEARNING_TEACHER_SCOPE_DENIED';
  end if;

  insert into public.learning_pedagogical_reviews(institution_id, question_bank_id, suggested_subject_area)
  select p_institution_id, question.id, question.subject_area
    from public.learning_question_bank question
   where question.active
     and question.package_type = 'ENEM'
     and not exists (
       select 1 from public.learning_pedagogical_reviews existing
        where existing.institution_id = p_institution_id and existing.question_bank_id = question.id
     )
   order by question.source_year desc nulls last, question.id
   limit greatest(1, least(coalesce(p_limit, 50), 100));

  return query
  select review.id, question.id, review.state, question.source_year, question.source_name, question.source_reference,
    question.statement, question.options, question.correct_answer, question.subject_area, review.suggested_subject_area,
    review.topic, review.difficulty, review.primary_canonical_skill_id, skill.title,
    review.supporting_canonical_skill_ids, review.explanation, review.misconception, review.confidence, review.reviewed_at
    from public.learning_pedagogical_reviews review
    join public.learning_question_bank question on question.id = review.question_bank_id
    left join public.learning_curriculum_skills skill on skill.id = review.primary_canonical_skill_id
   where review.institution_id = p_institution_id
     and (p_state is null or review.state = p_state)
   order by review.updated_at asc, question.source_year desc nulls last, question.source_name, question.id
   limit greatest(1, least(coalesce(p_limit, 50), 100));
end;
$$;

create or replace function public.review_teacher_learning_item(
  p_institution_id uuid,
  p_review_id uuid,
  p_state text,
  p_suggested_subject_area text,
  p_topic text,
  p_difficulty text,
  p_primary_canonical_skill_id uuid,
  p_supporting_canonical_skill_ids uuid[],
  p_explanation text,
  p_misconception text,
  p_confidence text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  review_row public.learning_pedagogical_reviews%rowtype;
  before_json jsonb;
begin
  if p_state not in ('AUTO_CLASSIFIED', 'HUMAN_REVIEW_PENDING', 'HUMAN_REVIEWED', 'NEEDS_CORRECTION') then
    raise exception 'LEARNING_REVIEW_STATE_INVALID';
  end if;
  if p_confidence not in ('HIGH', 'MEDIUM', 'LOW', 'UNMAPPED') then
    raise exception 'LEARNING_REVIEW_CONFIDENCE_INVALID';
  end if;
  if p_primary_canonical_skill_id is not null and not exists (
    select 1 from public.learning_curriculum_skills skill where skill.id = p_primary_canonical_skill_id and skill.active
  ) then
    raise exception 'LEARNING_REVIEW_SKILL_NOT_FOUND';
  end if;
  select review.* into review_row
    from public.learning_pedagogical_reviews review
   where review.id = p_review_id and review.institution_id = p_institution_id
   for update;
  if not found then raise exception 'LEARNING_REVIEW_NOT_FOUND'; end if;
  if not (public.can_manage_institution_operations(p_institution_id) or exists (
    select 1 from public.subject_offerings offering
    join public.classes offering_class on offering_class.id = offering.class_id
    where offering_class.institution_id = p_institution_id
      and offering.teacher_profile_id = auth.uid()
      and offering.active
  )) then
    raise exception 'LEARNING_TEACHER_SCOPE_DENIED';
  end if;

  before_json := jsonb_build_object(
    'state', review_row.state, 'suggested_subject_area', review_row.suggested_subject_area,
    'topic', review_row.topic, 'difficulty', review_row.difficulty,
    'primary_canonical_skill_id', review_row.primary_canonical_skill_id,
    'supporting_canonical_skill_ids', review_row.supporting_canonical_skill_ids,
    'explanation', review_row.explanation, 'misconception', review_row.misconception,
    'confidence', review_row.confidence
  );
  update public.learning_pedagogical_reviews set
    state = p_state,
    suggested_subject_area = nullif(trim(coalesce(p_suggested_subject_area, '')), ''),
    topic = nullif(trim(coalesce(p_topic, '')), ''),
    difficulty = nullif(trim(coalesce(p_difficulty, '')), ''),
    primary_canonical_skill_id = p_primary_canonical_skill_id,
    supporting_canonical_skill_ids = coalesce(p_supporting_canonical_skill_ids, '{}'::uuid[]),
    explanation = nullif(trim(coalesce(p_explanation, '')), ''),
    misconception = nullif(trim(coalesce(p_misconception, '')), ''),
    confidence = p_confidence,
    reviewed_by = auth.uid(),
    reviewed_at = case when p_state = 'HUMAN_REVIEWED' then now() else reviewed_at end,
    updated_at = now()
   where id = review_row.id;

  insert into public.learning_pedagogical_review_audits(institution_id, review_id, reviewer_id, before_json, after_json)
  values (
    p_institution_id, review_row.id, auth.uid(), before_json,
    jsonb_build_object(
      'state', p_state, 'suggested_subject_area', nullif(trim(coalesce(p_suggested_subject_area, '')), ''),
      'topic', nullif(trim(coalesce(p_topic, '')), ''), 'difficulty', nullif(trim(coalesce(p_difficulty, '')), ''),
      'primary_canonical_skill_id', p_primary_canonical_skill_id,
      'supporting_canonical_skill_ids', coalesce(p_supporting_canonical_skill_ids, '{}'::uuid[]),
      'explanation', nullif(trim(coalesce(p_explanation, '')), ''), 'misconception', nullif(trim(coalesce(p_misconception, '')), ''),
      'confidence', p_confidence
    )
  );
  return review_row.id;
end;
$$;

alter table public.learning_simulation_assignments enable row level security;
alter table public.learning_pedagogical_reviews enable row level security;
alter table public.learning_pedagogical_review_audits enable row level security;

drop policy if exists learning_simulation_assignments_select on public.learning_simulation_assignments;
create policy learning_simulation_assignments_select on public.learning_simulation_assignments
for select to authenticated using (
  public.can_manage_institution_operations(institution_id)
  or assigned_by = auth.uid()
  or (student_id in (select student.id from public.students student where student.profile_id = auth.uid() and student.active))
  or exists (
    select 1 from public.enrollments enrollment
     where enrollment.class_id = learning_simulation_assignments.class_id
       and enrollment.student_id in (select student.id from public.students student where student.profile_id = auth.uid() and student.active)
       and enrollment.active
  )
);

revoke all on table public.learning_simulation_assignments, public.learning_pedagogical_reviews, public.learning_pedagogical_review_audits from anon;
grant select on table public.learning_simulation_assignments to authenticated;
revoke all on table public.learning_pedagogical_reviews, public.learning_pedagogical_review_audits from authenticated;
grant all on table public.learning_simulation_assignments, public.learning_pedagogical_reviews, public.learning_pedagogical_review_audits to service_role;

revoke all on function public.assign_learning_simulation(uuid, uuid, uuid, uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.assign_learning_simulation(uuid, uuid, uuid, uuid, timestamptz, timestamptz) to authenticated;
revoke all on function public.list_student_learning_simulation_assignments(uuid, uuid) from public, anon;
grant execute on function public.list_student_learning_simulation_assignments(uuid, uuid) to authenticated;
revoke all on function public.list_teacher_learning_simulation_assignments(uuid) from public, anon;
grant execute on function public.list_teacher_learning_simulation_assignments(uuid) to authenticated;
revoke all on function public.get_teacher_learning_simulation_results(uuid, uuid) from public, anon;
grant execute on function public.get_teacher_learning_simulation_results(uuid, uuid) to authenticated;
revoke all on function public.list_teacher_learning_pedagogical_reviews(uuid, text, integer) from public, anon;
grant execute on function public.list_teacher_learning_pedagogical_reviews(uuid, text, integer) to authenticated;
revoke all on function public.review_teacher_learning_item(uuid, uuid, text, text, text, text, uuid, uuid[], text, text, text) from public, anon;
grant execute on function public.review_teacher_learning_item(uuid, uuid, text, text, text, text, uuid, uuid[], text, text, text) to authenticated;

notify pgrst, 'reload schema';
commit;
