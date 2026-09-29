begin;

-- Global curriculum content is intentionally separate from institution-owned
-- learning_units/learning_skills.  A grade is an expected level, not an access
-- boundary: the planner may send a student to an earlier or later skill.
create table public.learning_curriculum_catalogs (
  id uuid primary key default extensions.uuid_generate_v4(),
  code text not null,
  name text not null,
  version text not null default '1.0',
  description text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_curriculum_catalogs_code_version_unique unique (code, version)
);

create table public.learning_curriculum_skills (
  id uuid primary key default extensions.uuid_generate_v4(),
  catalog_id uuid not null references public.learning_curriculum_catalogs(id) on delete cascade,
  code text not null,
  stage text not null,
  grade_level smallint,
  subject_area text not null,
  domain text not null,
  title text not null,
  description text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_curriculum_skills_code_unique unique (catalog_id, code),
  constraint learning_curriculum_skills_grade_check check (grade_level is null or grade_level between 1 and 12)
);

create table public.learning_skill_prerequisites (
  id uuid primary key default extensions.uuid_generate_v4(),
  skill_id uuid not null references public.learning_curriculum_skills(id) on delete cascade,
  prerequisite_skill_id uuid not null references public.learning_curriculum_skills(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint learning_skill_prerequisites_unique unique (skill_id, prerequisite_skill_id),
  constraint learning_skill_prerequisites_not_self check (skill_id <> prerequisite_skill_id)
);

create index learning_curriculum_skills_catalog_idx
  on public.learning_curriculum_skills(catalog_id, active, stage, grade_level);
create index learning_skill_prerequisites_prerequisite_idx
  on public.learning_skill_prerequisites(prerequisite_skill_id, skill_id);

create table public.learning_skill_canonical_links (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  learning_skill_id uuid not null references public.learning_skills(id) on delete cascade,
  canonical_skill_id uuid not null references public.learning_curriculum_skills(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_skill_canonical_links_unique unique (institution_id, learning_skill_id)
);

create index learning_skill_canonical_links_canonical_idx
  on public.learning_skill_canonical_links(institution_id, canonical_skill_id, active);

-- Curriculum context is explicit: institutional subjects opt into the canonical
-- subject area, while grade targets choose the intended canonical skill.
create table public.learning_curriculum_subject_links (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  subject_area text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_curriculum_subject_links_unique unique (institution_id, subject_id)
);

create table public.learning_curriculum_grade_targets (
  id uuid primary key default extensions.uuid_generate_v4(),
  catalog_id uuid not null references public.learning_curriculum_catalogs(id) on delete cascade,
  stage text not null,
  grade_level smallint not null,
  subject_area text not null,
  canonical_skill_id uuid not null references public.learning_curriculum_skills(id) on delete restrict,
  priority integer not null default 0,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_curriculum_grade_targets_grade_check check (grade_level between 1 and 12),
  constraint learning_curriculum_grade_targets_unique
    unique (catalog_id, stage, grade_level, subject_area, canonical_skill_id)
);

create index learning_curriculum_subject_links_scope_idx
  on public.learning_curriculum_subject_links(institution_id, subject_id, active);
create index learning_curriculum_grade_targets_lookup_idx
  on public.learning_curriculum_grade_targets(catalog_id, stage, grade_level, subject_area, active, priority);

create or replace function private.validate_learning_curriculum_subject_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.subjects subject
    where subject.id = new.subject_id
      and subject.institution_id = new.institution_id
  ) then
    raise exception 'LEARNING_CURRICULUM_SUBJECT_SCOPE_MISMATCH' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger learning_curriculum_subject_links_validate_scope
before insert or update on public.learning_curriculum_subject_links
for each row execute function private.validate_learning_curriculum_subject_link();

create or replace function private.validate_learning_curriculum_grade_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.learning_curriculum_skills skill
    where skill.id = new.canonical_skill_id
      and skill.catalog_id = new.catalog_id
      and skill.active is true
  ) then
    raise exception 'LEARNING_CURRICULUM_TARGET_SCOPE_MISMATCH' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger learning_curriculum_grade_targets_validate_scope
before insert or update on public.learning_curriculum_grade_targets
for each row execute function private.validate_learning_curriculum_grade_target();

create or replace function private.prevent_learning_skill_cycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cycle_found boolean;
begin
  if new.skill_id = new.prerequisite_skill_id then
    raise exception 'LEARNING_SKILL_SELF_REFERENCE' using errcode = '23514';
  end if;

  -- Edges point from a skill to what it requires.  Starting at the proposed
  -- prerequisite and walking that direction detects both direct and indirect
  -- cycles after the row has been written.
  with recursive reachable(skill_id) as (
    select new.prerequisite_skill_id
    union
    select edge.prerequisite_skill_id
    from reachable
    join public.learning_skill_prerequisites edge
      on edge.skill_id = reachable.skill_id
  )
  select exists (
    select 1 from reachable where skill_id = new.skill_id
  ) into cycle_found;

  if cycle_found then
    raise exception 'LEARNING_SKILL_PREREQUISITE_CYCLE' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger learning_skill_prerequisites_prevent_cycle
after insert or update on public.learning_skill_prerequisites
for each row execute function private.prevent_learning_skill_cycle();

create or replace function private.validate_learning_skill_canonical_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  skill_institution_id uuid;
begin
  select skill.institution_id
    into skill_institution_id
  from public.learning_skills skill
  where skill.id = new.learning_skill_id;

  if skill_institution_id is null or skill_institution_id <> new.institution_id then
    raise exception 'LEARNING_SKILL_CANONICAL_LINK_SCOPE_MISMATCH' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.learning_curriculum_skills canonical_skill
    join public.learning_curriculum_catalogs catalog
      on catalog.id = canonical_skill.catalog_id
    where canonical_skill.id = new.canonical_skill_id
      and canonical_skill.active is true
      and catalog.active is true
  ) then
    raise exception 'LEARNING_CANONICAL_SKILL_INACTIVE' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger learning_skill_canonical_links_validate_scope
before insert or update on public.learning_skill_canonical_links
for each row execute function private.validate_learning_skill_canonical_link();

create or replace function private.learning_student_owns_state(
  target_institution_id uuid,
  target_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.students student
    where student.id = target_student_id
      and student.institution_id = target_institution_id
      and student.profile_id = auth.uid()
      and student.active is true
  );
$$;

create or replace function private.learning_teacher_can_access_student(
  target_institution_id uuid,
  target_student_id uuid,
  target_canonical_skill_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships membership
    join public.enrollments enrollment
      on enrollment.student_id = target_student_id
     and enrollment.active is true
     and enrollment.status = 'active'
    join public.learning_skill_canonical_links canonical_link
      on canonical_link.institution_id = target_institution_id
     and canonical_link.canonical_skill_id = target_canonical_skill_id
     and canonical_link.active is true
    join public.learning_skills learning_skill
      on learning_skill.id = canonical_link.learning_skill_id
     and learning_skill.institution_id = target_institution_id
     and learning_skill.active is true
    join public.learning_units learning_unit
      on learning_unit.id = learning_skill.unit_id
     and learning_unit.institution_id = target_institution_id
     and learning_unit.active is true
    join public.subject_offerings offering
      on offering.class_id = enrollment.class_id
     and offering.subject_id = learning_unit.subject_id
     and offering.teacher_profile_id = auth.uid()
     and offering.active is true
    join public.classes class
      on class.id = enrollment.class_id
     and class.institution_id = target_institution_id
     and class.active is true
    where membership.profile_id = auth.uid()
      and membership.institution_id = target_institution_id
      and membership.role = 'TEACHER'::public.user_role
      and membership.active is true
  );
$$;

create or replace function private.learning_teacher_can_access_activity(
  target_institution_id uuid,
  target_student_id uuid,
  target_activity_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.learning_activities activity
    join public.learning_skills learning_skill
      on learning_skill.id = activity.skill_id
     and learning_skill.institution_id = target_institution_id
    join public.learning_skill_canonical_links canonical_link
      on canonical_link.institution_id = target_institution_id
     and canonical_link.learning_skill_id = learning_skill.id
     and canonical_link.active is true
    where activity.id = target_activity_id
      and activity.institution_id = target_institution_id
      and private.learning_teacher_can_access_student(
        target_institution_id,
        target_student_id,
        canonical_link.canonical_skill_id
      )
  );
$$;

create table public.learning_attempt_runs (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  activity_id uuid not null references public.learning_activities(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  legacy_attempt_id uuid references public.learning_attempts(id) on delete set null,
  run_number integer not null,
  score integer not null default 0,
  total_points integer not null default 0,
  source text not null default 'PRACTICE',
  submitted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint learning_attempt_runs_score_check check (score >= 0 and total_points >= 0 and score <= total_points),
  constraint learning_attempt_runs_source_check check (source in ('PRACTICE', 'DIAGNOSTIC', 'LOCK_IN', 'REVIEW', 'SIMULATION', 'EXAM'))
);

create table public.learning_attempt_run_answers (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  run_id uuid not null references public.learning_attempt_runs(id) on delete cascade,
  question_id uuid not null references public.learning_questions(id) on delete restrict,
  answer_json jsonb not null,
  is_correct boolean not null default false,
  points_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  constraint learning_attempt_run_answers_unique unique (run_id, question_id)
);

create index learning_attempt_runs_student_idx
  on public.learning_attempt_runs(institution_id, student_id, submitted_at desc);
create index learning_attempt_runs_activity_idx
  on public.learning_attempt_runs(activity_id, student_id, run_number);
create index learning_attempt_run_answers_run_idx
  on public.learning_attempt_run_answers(run_id);

create table public.learning_skill_evidence (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  canonical_skill_id uuid not null references public.learning_curriculum_skills(id) on delete restrict,
  source text not null,
  correct boolean not null,
  score numeric(5,2) not null check (score between 0 and 100),
  attempt_run_id uuid references public.learning_attempt_runs(id) on delete set null,
  recorded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint learning_skill_evidence_source_check check (source in ('PRACTICE', 'DIAGNOSTIC', 'LOCK_IN', 'REVIEW', 'SIMULATION', 'EXAM'))
);

create index learning_skill_evidence_student_skill_idx
  on public.learning_skill_evidence(institution_id, student_id, canonical_skill_id, recorded_at desc);

create table public.learning_student_skill_state (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  canonical_skill_id uuid not null references public.learning_curriculum_skills(id) on delete restrict,
  state text not null default 'UNKNOWN',
  mastery_estimate numeric(5,2) not null default 0 check (mastery_estimate between 0 and 100),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  confidence numeric(5,4) not null default 0 check (confidence between 0 and 1),
  last_evidence_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint learning_student_skill_state_unique unique (institution_id, student_id, canonical_skill_id),
  constraint learning_student_skill_state_state_check check (state in ('UNKNOWN', 'INTRODUCED', 'LEARNING', 'PRACTICING', 'MASTERED', 'NEEDS_REVIEW'))
);

create index learning_student_skill_state_student_idx
  on public.learning_student_skill_state(institution_id, student_id, state);
create index learning_student_skill_state_skill_idx
  on public.learning_student_skill_state(institution_id, canonical_skill_id, state);

create or replace function private.refresh_learning_student_skill_state(
  target_institution_id uuid,
  target_student_id uuid,
  target_canonical_skill_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  evidence_total integer;
  evidence_average numeric;
  latest_evidence timestamptz;
  next_state text;
begin
  select
    count(*)::integer,
    coalesce(avg(evidence.score), 0),
    max(evidence.recorded_at)
  into evidence_total, evidence_average, latest_evidence
  from public.learning_skill_evidence evidence
  where evidence.institution_id = target_institution_id
    and evidence.student_id = target_student_id
    and evidence.canonical_skill_id = target_canonical_skill_id;

  next_state := case
    when evidence_total = 0 then 'UNKNOWN'
    when evidence_total = 1 then 'INTRODUCED'
    when evidence_total >= 3 and evidence_average >= 80 then 'MASTERED'
    when evidence_total >= 2 and evidence_average < 60 then 'NEEDS_REVIEW'
    else 'PRACTICING'
  end;

  insert into public.learning_student_skill_state (
    institution_id,
    student_id,
    canonical_skill_id,
    state,
    mastery_estimate,
    evidence_count,
    confidence,
    last_evidence_at,
    updated_at
  )
  values (
    target_institution_id,
    target_student_id,
    target_canonical_skill_id,
    next_state,
    round(evidence_average, 2),
    evidence_total,
    least(1::numeric, evidence_total / 3.0),
    latest_evidence,
    now()
  )
  on conflict (institution_id, student_id, canonical_skill_id)
  do update set
    state = excluded.state,
    mastery_estimate = excluded.mastery_estimate,
    evidence_count = excluded.evidence_count,
    confidence = excluded.confidence,
    last_evidence_at = excluded.last_evidence_at,
    updated_at = now();
end;
$$;

-- The legacy summary and answer rows remain the compatibility surface.  Every
-- submission additionally writes one immutable run and one evidence record.
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
begin
  if jsonb_typeof(coalesce(p_answers, '[]'::jsonb)) <> 'array' then
    raise exception 'Respostas inválidas.';
  end if;

  select * into v_activity
  from public.learning_activities
  where id = p_activity_id and status = 'PUBLISHED';
  if not found then raise exception 'Atividade indisponível.'; end if;

  select student.* into v_student
  from public.students student
  where student.profile_id = auth.uid()
    and student.institution_id = v_activity.institution_id
    and student.active;
  if not found or not private.learning_is_assigned_student(p_activity_id, v_student.id) then
    raise exception 'Aluno não possui acesso a esta atividade.';
  end if;

  select coalesce(sum(question.points), 0)::integer
    into v_total
  from public.learning_questions question
  where question.activity_id = p_activity_id;
  v_skill := v_activity.skill_id;

  insert into public.learning_attempts(
    institution_id, activity_id, student_id, total_points, completed_at
  )
  values (v_activity.institution_id, p_activity_id, v_student.id, v_total, now())
  on conflict (activity_id, student_id) do update
    set started_at = now(), completed_at = now(), total_points = excluded.total_points
  returning id into v_attempt;

  delete from public.learning_answers answer where answer.attempt_id = v_attempt;

  insert into public.learning_answers(
    institution_id, attempt_id, question_id, answer_json, is_correct, points_awarded
  )
  select
    v_activity.institution_id,
    v_attempt,
    question.id,
    item->'answer',
    question.correct_answer_json = item->'answer',
    case when question.correct_answer_json = item->'answer' then question.points else 0 end
  from public.learning_questions question
  join jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) item
    on (item->>'question_id')::uuid = question.id
  where question.activity_id = p_activity_id;

  select coalesce(sum(answer.points_awarded), 0)::integer
    into v_score
  from public.learning_answers answer
  where answer.attempt_id = v_attempt;

  update public.learning_attempts set score = v_score where id = v_attempt;
  v_percent := case when v_total = 0 then 0 else least(100, round(v_score * 100.0 / v_total)::integer) end;

  select coalesce(max(run_number), 0) + 1
    into v_run_number
  from public.learning_attempt_runs
  where activity_id = p_activity_id and student_id = v_student.id;

  insert into public.learning_attempt_runs(
    institution_id, activity_id, student_id, legacy_attempt_id,
    run_number, score, total_points, source
  )
  values (
    v_activity.institution_id, p_activity_id, v_student.id, v_attempt,
    v_run_number, v_score, v_total, 'PRACTICE'
  )
  returning id into v_attempt_run;

  insert into public.learning_attempt_run_answers(
    institution_id, run_id, question_id, answer_json, is_correct, points_awarded
  )
  select
    v_activity.institution_id,
    v_attempt_run,
    question.id,
    item->'answer',
    question.correct_answer_json = item->'answer',
    case when question.correct_answer_json = item->'answer' then question.points else 0 end
  from public.learning_questions question
  join jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) item
    on (item->>'question_id')::uuid = question.id
  where question.activity_id = p_activity_id;

  if v_skill is not null then
    insert into public.learning_skill_progress(
      institution_id, student_id, skill_id, mastery_percent, status, last_activity_at
    )
    values (
      v_activity.institution_id, v_student.id, v_skill, v_percent,
      case when v_percent >= 80 then 'MASTERED' when v_percent > 0 then 'IN_PROGRESS' else 'NOT_STARTED' end,
      now()
    )
    on conflict (institution_id, student_id, skill_id) do update
      set mastery_percent = excluded.mastery_percent,
          status = excluded.status,
          last_activity_at = excluded.last_activity_at,
          updated_at = now();

    select link.canonical_skill_id into v_canonical_skill
    from public.learning_skill_canonical_links link
    where link.institution_id = v_activity.institution_id
      and link.learning_skill_id = v_skill
      and link.active is true;

    if v_canonical_skill is not null then
      insert into public.learning_skill_evidence(
        institution_id, student_id, canonical_skill_id, source,
        correct, score, attempt_run_id, metadata
      )
      values (
        v_activity.institution_id, v_student.id, v_canonical_skill, 'PRACTICE',
        v_percent >= 80, v_percent, v_attempt_run, '{}'::jsonb
      );

      perform private.refresh_learning_student_skill_state(
        v_activity.institution_id,
        v_student.id,
        v_canonical_skill
      );
    end if;
  end if;

  return query select v_attempt, v_score, v_total, v_percent;
end;
$$;

-- The student contract intentionally omits explanation.  Explanations remain
-- available to the teacher-side authoring flow, but never before submission.
create or replace function public.list_student_learning_activities(p_institution_id uuid)
returns table (
  id uuid,
  subject_id uuid,
  unit_id uuid,
  skill_id uuid,
  teacher_id uuid,
  title text,
  description text,
  activity_type text,
  status text,
  created_at timestamptz,
  subjects jsonb,
  learning_questions jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    activity.id,
    activity.subject_id,
    activity.unit_id,
    activity.skill_id,
    activity.teacher_id,
    activity.title,
    activity.description,
    activity.activity_type,
    activity.status,
    activity.created_at,
    jsonb_build_object('name', subject.name),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', question.id,
            'question_text', question.question_text,
            'question_type', question.question_type,
            'options_json', question.options_json,
            'points', question.points,
            'sort_order', question.sort_order
          )
          order by question.sort_order, question.id
        )
        from public.learning_questions question
        where question.activity_id = activity.id
      ),
      '[]'::jsonb
    )
  from public.learning_activities activity
  join public.subjects subject on subject.id = activity.subject_id
  where activity.institution_id = p_institution_id
    and activity.status = 'PUBLISHED'
    and subject.institution_id = p_institution_id
    and coalesce(subject.active, true)
    and exists (
      select 1
      from public.learning_assignments assignment
      join public.enrollments enrollment
        on enrollment.class_id = assignment.class_id
       and enrollment.active is true
      join public.students student
        on student.id = enrollment.student_id
       and student.active is true
      where assignment.activity_id = activity.id
        and assignment.institution_id = p_institution_id
        and student.profile_id = auth.uid()
        and student.institution_id = p_institution_id
    )
  order by activity.created_at desc;
$$;

create or replace function public.get_teacher_adaptive_insights(p_institution_id uuid)
returns table (
  canonical_skill_id uuid,
  skill_code text,
  skill_title text,
  state text,
  student_count bigint,
  diagnostic_needed_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    state_row.canonical_skill_id,
    canonical_skill.code,
    canonical_skill.title,
    state_row.state,
    count(distinct state_row.student_id),
    count(distinct state_row.student_id) filter (
      where state_row.state in ('UNKNOWN', 'INTRODUCED') or state_row.confidence < 0.67
    )
  from public.learning_student_skill_state state_row
  join public.students student on student.id = state_row.student_id
  join public.learning_curriculum_skills canonical_skill
    on canonical_skill.id = state_row.canonical_skill_id
    where state_row.institution_id = p_institution_id
    and (
      private.learning_teacher_can_access_student(
        p_institution_id,
        state_row.student_id,
        state_row.canonical_skill_id
      )
      or public.can_manage_institution_operations(p_institution_id)
    )
  group by state_row.canonical_skill_id, canonical_skill.code, canonical_skill.title, state_row.state
  order by count(distinct state_row.student_id) filter (
    where state_row.state in ('UNKNOWN', 'INTRODUCED') or state_row.confidence < 0.67
  ) desc, canonical_skill.title;
$$;

alter table public.learning_curriculum_catalogs enable row level security;
alter table public.learning_curriculum_skills enable row level security;
alter table public.learning_skill_prerequisites enable row level security;
alter table public.learning_skill_canonical_links enable row level security;
alter table public.learning_curriculum_subject_links enable row level security;
alter table public.learning_curriculum_grade_targets enable row level security;
alter table public.learning_attempt_runs enable row level security;
alter table public.learning_attempt_run_answers enable row level security;
alter table public.learning_skill_evidence enable row level security;
alter table public.learning_student_skill_state enable row level security;

revoke all on table public.learning_curriculum_catalogs from anon, authenticated;
revoke all on table public.learning_curriculum_skills from anon, authenticated;
revoke all on table public.learning_skill_prerequisites from anon, authenticated;
revoke all on table public.learning_skill_canonical_links from anon, authenticated;
revoke all on table public.learning_curriculum_subject_links from anon, authenticated;
revoke all on table public.learning_curriculum_grade_targets from anon, authenticated;
revoke all on table public.learning_attempt_runs from anon, authenticated;
revoke all on table public.learning_attempt_run_answers from anon, authenticated;
revoke all on table public.learning_skill_evidence from anon, authenticated;
revoke all on table public.learning_student_skill_state from anon, authenticated;

grant select on table public.learning_curriculum_catalogs to authenticated;
grant select on table public.learning_curriculum_skills to authenticated;
grant select on table public.learning_skill_prerequisites to authenticated;
grant select on table public.learning_skill_canonical_links to authenticated;
grant select on table public.learning_curriculum_subject_links to authenticated;
grant select on table public.learning_curriculum_grade_targets to authenticated;
grant select on table public.learning_attempt_runs to authenticated;
grant select on table public.learning_attempt_run_answers to authenticated;
grant select on table public.learning_skill_evidence to authenticated;
grant select on table public.learning_student_skill_state to authenticated;

-- The service role is used by trusted server-side fixture/bootstrap paths. Keep
-- its table privileges explicit because bypassrls does not bypass table grants.
grant all on table
  public.academic_years,
  public.terms,
  public.classes,
  public.subjects,
  public.subject_offerings,
  public.enrollments,
  public.class_curriculum_items,
  public.learning_units,
  public.learning_skills,
  public.learning_activities,
  public.learning_questions,
  public.learning_assignments,
  public.learning_attempts,
  public.learning_answers,
  public.learning_skill_progress,
  public.learning_curriculum_catalogs,
  public.learning_curriculum_skills,
  public.learning_skill_prerequisites,
  public.learning_skill_canonical_links,
  public.learning_curriculum_subject_links,
  public.learning_curriculum_grade_targets,
  public.learning_attempt_runs,
  public.learning_attempt_run_answers,
  public.learning_skill_evidence,
  public.learning_student_skill_state
to service_role;

create policy learning_curriculum_catalogs_select
on public.learning_curriculum_catalogs for select to authenticated
using (active is true);

create policy learning_curriculum_skills_select
on public.learning_curriculum_skills for select to authenticated
using (active is true and exists (
  select 1 from public.learning_curriculum_catalogs catalog
  where catalog.id = catalog_id and catalog.active is true
));

create policy learning_skill_prerequisites_select
on public.learning_skill_prerequisites for select to authenticated
using (exists (
  select 1 from public.learning_curriculum_skills skill
  where skill.id = skill_id and skill.active is true
));

create policy learning_skill_canonical_links_select
on public.learning_skill_canonical_links for select to authenticated
using (public.can_access_institution(institution_id));

create policy learning_skill_canonical_links_write
on public.learning_skill_canonical_links for all to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

create policy learning_curriculum_subject_links_select
on public.learning_curriculum_subject_links for select to authenticated
using (active is true and public.can_access_institution(institution_id));

create policy learning_curriculum_subject_links_write
on public.learning_curriculum_subject_links for all to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

create policy learning_curriculum_grade_targets_select
on public.learning_curriculum_grade_targets for select to authenticated
using (active is true and exists (
  select 1 from public.learning_curriculum_catalogs catalog
  where catalog.id = catalog_id and catalog.active is true
));

create policy learning_attempt_runs_select
on public.learning_attempt_runs for select to authenticated
using (
  private.learning_student_owns_state(institution_id, student_id)
  or private.learning_teacher_can_access_activity(institution_id, student_id, activity_id)
  or public.can_manage_institution_operations(institution_id)
);

create policy learning_attempt_run_answers_select
on public.learning_attempt_run_answers for select to authenticated
using (exists (
  select 1
  from public.learning_attempt_runs run
  where run.id = run_id
    and (
      private.learning_student_owns_state(run.institution_id, run.student_id)
      or private.learning_teacher_can_access_activity(run.institution_id, run.student_id, run.activity_id)
      or public.can_manage_institution_operations(run.institution_id)
    )
));

create policy learning_skill_evidence_select
on public.learning_skill_evidence for select to authenticated
using (
  private.learning_student_owns_state(institution_id, student_id)
  or private.learning_teacher_can_access_student(institution_id, student_id, canonical_skill_id)
  or public.can_manage_institution_operations(institution_id)
);

create policy learning_student_skill_state_select
on public.learning_student_skill_state for select to authenticated
using (
  private.learning_student_owns_state(institution_id, student_id)
  or private.learning_teacher_can_access_student(institution_id, student_id, canonical_skill_id)
  or public.can_manage_institution_operations(institution_id)
);

revoke all on function private.prevent_learning_skill_cycle() from public, anon, authenticated;
revoke all on function private.validate_learning_skill_canonical_link() from public, anon, authenticated;
revoke all on function private.validate_learning_curriculum_subject_link() from public, anon, authenticated;
revoke all on function private.validate_learning_curriculum_grade_target() from public, anon, authenticated;
revoke all on function private.learning_student_owns_state(uuid, uuid) from public, anon, authenticated;
revoke all on function private.learning_teacher_can_access_student(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.learning_teacher_can_access_activity(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.refresh_learning_student_skill_state(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.submit_learning_attempt(uuid, jsonb) from public, anon;
revoke all on function public.list_student_learning_activities(uuid) from public, anon;
revoke all on function public.get_teacher_adaptive_insights(uuid) from public, anon;
grant execute on function public.submit_learning_attempt(uuid, jsonb) to authenticated, service_role;
grant execute on function public.list_student_learning_activities(uuid) to authenticated;
grant execute on function public.get_teacher_adaptive_insights(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
