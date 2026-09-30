begin;

-- Adaptive Learning V2 is an additive, server-planned journey. Existing V1
-- sessions remain readable and callable for legacy installations.
-- V2 treats TRANSFER as first-class evidence. This migration is still
-- pre-release, so evolve the V1 check in place instead of adding a repair
-- migration after the feature ships.
alter table public.learning_skill_evidence
  drop constraint if exists learning_skill_evidence_source_check;
alter table public.learning_skill_evidence
  add constraint learning_skill_evidence_source_check
  check (source in ('PRACTICE', 'DIAGNOSTIC', 'TRANSFER', 'LOCK_IN', 'REVIEW', 'SIMULATION', 'EXAM'));

alter table public.learning_guided_sessions
  add column if not exists original_target_canonical_skill_id uuid references public.learning_curriculum_skills(id) on delete restrict,
  add column if not exists current_canonical_skill_id uuid references public.learning_curriculum_skills(id) on delete restrict,
  add column if not exists current_step_id uuid references public.learning_guided_steps(id) on delete set null,
  add column if not exists decision_reason text,
  add column if not exists replan_count integer not null default 0;

update public.learning_guided_sessions
   set original_target_canonical_skill_id = coalesce(original_target_canonical_skill_id, target_canonical_skill_id),
       current_canonical_skill_id = coalesce(current_canonical_skill_id, target_canonical_skill_id)
 where original_target_canonical_skill_id is null
    or current_canonical_skill_id is null;

alter table public.learning_guided_steps
  add column if not exists question_set_id uuid,
  add column if not exists purpose text,
  add column if not exists evidence_run_id uuid;
alter table public.learning_guided_steps drop constraint if exists learning_guided_steps_step_type_check;
alter table public.learning_guided_steps
  add constraint learning_guided_steps_step_type_check
  check (step_type in ('DIAGNOSTIC', 'PROBE', 'LESSON', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW', 'RETURN_TO_TARGET'));

create table if not exists public.learning_question_sets (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid references public.institutions(id) on delete cascade,
  teacher_profile_id uuid references public.profiles(id) on delete set null,
  canonical_skill_id uuid not null references public.learning_curriculum_skills(id) on delete cascade,
  scope text not null check (scope in ('GLOBAL', 'INSTITUTION', 'TEACHER')),
  purpose text not null check (purpose in ('PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW')),
  version integer not null default 1 check (version > 0),
  difficulty text check (difficulty is null or difficulty in ('EASY', 'MEDIUM', 'HARD')),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_question_sets_scope_alignment_check check (
    (scope = 'GLOBAL' and institution_id is null and teacher_profile_id is null)
    or (scope = 'INSTITUTION' and institution_id is not null and teacher_profile_id is null)
    or (scope = 'TEACHER' and institution_id is not null and teacher_profile_id is not null)
  ),
  unique (institution_id, teacher_profile_id, canonical_skill_id, purpose, version)
);
create unique index learning_question_sets_global_unique_idx
  on public.learning_question_sets(canonical_skill_id, purpose, version)
 where scope = 'GLOBAL';
create unique index learning_question_sets_institution_unique_idx
  on public.learning_question_sets(institution_id, canonical_skill_id, purpose, version)
 where scope = 'INSTITUTION';
create unique index learning_question_sets_teacher_unique_idx
  on public.learning_question_sets(institution_id, teacher_profile_id, canonical_skill_id, purpose, version)
 where scope = 'TEACHER';
create index if not exists learning_question_sets_lookup_idx
  on public.learning_question_sets(canonical_skill_id, purpose, scope, active);

create table if not exists public.learning_question_set_items (
  id uuid primary key default extensions.uuid_generate_v4(),
  question_set_id uuid not null references public.learning_question_sets(id) on delete cascade,
  question_bank_id uuid not null references public.learning_question_bank(id) on delete restrict,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  unique (question_set_id, position),
  unique (question_set_id, question_bank_id)
);

create table if not exists public.learning_guided_session_events (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  session_id uuid not null references public.learning_guided_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  event_type text not null check (event_type in (
    'SESSION_STARTED', 'STEP_STARTED', 'STEP_COMPLETED', 'EVIDENCE_RECORDED',
    'REPLANNED', 'SKILL_ADVANCED', 'RETURNED_TO_TARGET', 'SESSION_COMPLETED',
    'TEACHER_SUPPORT_REQUIRED'
  )),
  step_id uuid references public.learning_guided_steps(id) on delete set null,
  idempotency_key text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, idempotency_key)
);
create index if not exists learning_guided_session_events_session_idx
  on public.learning_guided_session_events(session_id, created_at);

create table if not exists public.learning_guided_step_attempts (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  session_id uuid not null references public.learning_guided_sessions(id) on delete cascade,
  step_id uuid not null references public.learning_guided_steps(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  purpose text not null check (purpose in ('PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW')),
  answers jsonb not null default '[]'::jsonb,
  feedback jsonb not null default '[]'::jsonb,
  score numeric(5,2) not null check (score between 0 and 100),
  correct_count integer not null default 0 check (correct_count >= 0),
  total_questions integer not null check (total_questions > 0),
  idempotency_key text not null,
  submitted_at timestamptz not null default now(),
  unique (step_id, idempotency_key)
);
create index if not exists learning_guided_step_attempts_student_idx
  on public.learning_guided_step_attempts(institution_id, student_id, submitted_at desc);

alter table public.learning_student_skill_state
  add column if not exists valid_evidence_count integer not null default 0,
  add column if not exists distinct_run_count integer not null default 0,
  add column if not exists weighted_mastery numeric(5,2) not null default 0,
  add column if not exists strong_evidence_count integer not null default 0,
  add column if not exists mastery_policy_version text not null default 'V1';

create or replace function private.learning_v2_scope_student(target_institution_id uuid, target_student_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.students student
    where student.id = target_student_id
      and student.institution_id = target_institution_id
      and student.active
      and (
        student.profile_id = auth.uid()
        or public.can_manage_institution_operations(target_institution_id)
      )
  );
$$;

create or replace function private.pick_learning_question_set_v2(
  target_institution_id uuid,
  target_teacher_profile_id uuid,
  target_skill_id uuid,
  target_purpose text
)
returns uuid language sql stable security definer set search_path = ''
as $$
  select set_row.id
    from public.learning_question_sets set_row
   where set_row.canonical_skill_id = target_skill_id
     and set_row.purpose = target_purpose
     and set_row.active
     and (
       (set_row.scope = 'TEACHER' and set_row.institution_id = target_institution_id and set_row.teacher_profile_id = target_teacher_profile_id)
       or (set_row.scope = 'INSTITUTION' and set_row.institution_id = target_institution_id)
       or (set_row.scope = 'GLOBAL' and set_row.institution_id is null)
     )
   order by case set_row.scope when 'TEACHER' then 0 when 'INSTITUTION' then 1 else 2 end,
            set_row.version desc, set_row.id
   limit 1;
$$;

create or replace function private.refresh_learning_student_skill_state_v2(
  target_institution_id uuid,
  target_student_id uuid,
  target_skill_id uuid
)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  valid_count integer;
  run_count integer;
  strong_count integer;
  weighted numeric(5,2);
  confidence numeric(5,4);
  next_state text;
begin
  select count(*)::integer,
         count(distinct coalesce(evidence.attempt_run_id::text, evidence.metadata->>'guided_attempt_id', evidence.id::text))::integer,
         count(*) filter (where evidence.source in ('TRANSFER', 'LOCK_IN', 'REVIEW'))::integer,
         coalesce(
           sum(evidence.score * case
             when evidence.source = 'DIAGNOSTIC' then 0.8
             when evidence.source in ('TRANSFER', 'LOCK_IN', 'REVIEW') then 1.2
             else 1
           end) / nullif(sum(case
             when evidence.source = 'DIAGNOSTIC' then 0.8
             when evidence.source in ('TRANSFER', 'LOCK_IN', 'REVIEW') then 1.2
             else 1
           end), 0), 0
         )::numeric(5,2)
    into valid_count, run_count, strong_count, weighted
    from public.learning_skill_evidence evidence
   where evidence.institution_id = target_institution_id
     and evidence.student_id = target_student_id
     and evidence.canonical_skill_id = target_skill_id
     and evidence.score between 0 and 100;
  confidence := least(1, valid_count::numeric / 5);
  next_state := case
    when valid_count >= 3 and run_count >= 2 and weighted >= 80 and confidence >= .6 and strong_count >= 1 then 'MASTERED'
    when valid_count >= 2 and weighted < 60 then 'NEEDS_REVIEW'
    when valid_count = 0 then 'UNKNOWN'
    when valid_count = 1 then 'INTRODUCED'
    else 'PRACTICING'
  end;
  insert into public.learning_student_skill_state(
    institution_id, student_id, canonical_skill_id, state, mastery_estimate,
    evidence_count, confidence, valid_evidence_count, distinct_run_count,
    weighted_mastery, strong_evidence_count, mastery_policy_version,
    last_evidence_at, updated_at
  ) values (
    target_institution_id, target_student_id, target_skill_id, next_state,
    weighted, valid_count, confidence, valid_count, run_count, weighted,
    strong_count, 'V2', now(), now()
  ) on conflict (institution_id, student_id, canonical_skill_id) do update set
    state = excluded.state,
    mastery_estimate = excluded.mastery_estimate,
    evidence_count = excluded.evidence_count,
    confidence = excluded.confidence,
    valid_evidence_count = excluded.valid_evidence_count,
    distinct_run_count = excluded.distinct_run_count,
    weighted_mastery = excluded.weighted_mastery,
    strong_evidence_count = excluded.strong_evidence_count,
    mastery_policy_version = excluded.mastery_policy_version,
    last_evidence_at = excluded.last_evidence_at,
    updated_at = now();
end;
$$;

create or replace function private.pick_learning_v2_next_skill(
  target_institution_id uuid,
  target_student_id uuid,
  target_skill_id uuid
)
returns uuid language sql stable security definer set search_path = ''
as $$
  with recursive prerequisite(skill_id, depth, path) as (
    select edge.prerequisite_skill_id, 1, array[target_skill_id]::uuid[]
      from public.learning_skill_prerequisites edge
     where edge.skill_id = target_skill_id
    union all
    select edge.prerequisite_skill_id, prerequisite.depth + 1, prerequisite.path || edge.prerequisite_skill_id
      from prerequisite
      join public.learning_skill_prerequisites edge on edge.skill_id = prerequisite.skill_id
     where not edge.prerequisite_skill_id = any(prerequisite.path)
  ), candidates as (
    select target_skill_id as skill_id, 0 as depth
    union all
    select prerequisite.skill_id, prerequisite.depth
      from prerequisite
  ), ordered as (
    select candidate.skill_id, max(candidate.depth) as depth
      from candidates candidate
      join public.learning_curriculum_skills skill on skill.id = candidate.skill_id and skill.active
     group by candidate.skill_id
  )
  select ordered.skill_id
    from ordered
    left join public.learning_student_skill_state state
      on state.institution_id = target_institution_id
     and state.student_id = target_student_id
     and state.canonical_skill_id = ordered.skill_id
   where coalesce(state.mastery_policy_version, 'V1') <> 'V2'
      or coalesce(state.state, 'UNKNOWN') <> 'MASTERED'
   order by ordered.depth desc, ordered.skill_id
   limit 1;
$$;

create or replace function private.append_guided_v2_next_step(
  session_row public.learning_guided_sessions,
  completed_step public.learning_guided_steps,
  outcome text,
  event_key text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  next_type text;
  next_purpose text;
  next_skill uuid;
  next_lesson uuid;
  question_set uuid;
  next_step uuid;
  next_position integer;
  next_reason text;
  teacher_profile_id uuid;
  new_replan integer := session_row.replan_count;
begin
  if exists (select 1 from public.learning_guided_session_events event where event.session_id = session_row.id and event.idempotency_key = event_key) then
    return null;
  end if;
  next_skill := completed_step.canonical_skill_id;
  select offering.teacher_profile_id into teacher_profile_id
    from public.subject_offerings offering
   where offering.class_id = session_row.class_id
     and offering.subject_id = session_row.subject_id
     and offering.active
   order by offering.teacher_profile_id
   limit 1;
  if completed_step.step_type in ('PROBE', 'DIAGNOSTIC') then
    if outcome = 'GAP' then next_type := 'LESSON'; next_purpose := null; next_reason := 'CONFIRMED_GAP';
    else next_type := 'PRACTICE'; next_purpose := 'PRACTICE'; next_reason := 'PRACTICE_REQUIRED'; end if;
  elsif completed_step.step_type = 'LESSON' then
    next_type := 'PRACTICE'; next_purpose := 'PRACTICE'; next_reason := 'PRACTICE_REQUIRED';
  elsif completed_step.step_type = 'PRACTICE' then
    if outcome = 'GAP' and session_row.replan_count < 2 then
      next_type := 'LESSON'; next_purpose := null; new_replan := session_row.replan_count + 1; next_reason := 'CONFIRMED_GAP';
    else next_type := 'TRANSFER'; next_purpose := 'TRANSFER'; next_reason := 'TRANSFER_REQUIRED'; end if;
  elsif completed_step.step_type = 'TRANSFER' then
    if outcome = 'GAP' and session_row.replan_count < 2 then
      next_type := 'LESSON'; next_purpose := null; new_replan := session_row.replan_count + 1; next_reason := 'CONFIRMED_GAP';
    elsif outcome = 'GAP' then
      next_type := 'REVIEW'; next_purpose := 'REVIEW'; next_reason := 'TEACHER_SUPPORT_REQUIRED';
    else next_type := 'LOCK_IN'; next_purpose := 'LOCK_IN'; next_reason := 'TARGET_READY'; end if;
  elsif completed_step.step_type = 'LOCK_IN' then
    if outcome = 'GAP' and session_row.replan_count < 2 then
      next_type := 'LESSON'; next_purpose := null; new_replan := session_row.replan_count + 1; next_reason := 'CONFIRMED_GAP';
    elsif outcome = 'GAP' then
      update public.learning_guided_sessions set status = 'NEEDS_TEACHER_SUPPORT', decision_reason = 'TEACHER_SUPPORT_REQUIRED', updated_at = now() where id = session_row.id;
      insert into public.learning_guided_session_events(institution_id, session_id, student_id, event_type, step_id, idempotency_key, payload)
      values (session_row.institution_id, session_row.id, session_row.student_id, 'TEACHER_SUPPORT_REQUIRED', completed_step.id, event_key, jsonb_build_object('reason', 'TEACHER_SUPPORT_REQUIRED'));
      return null;
    else
      next_skill := private.pick_learning_v2_next_skill(session_row.institution_id, session_row.student_id, session_row.target_canonical_skill_id);
      if next_skill is null or next_skill = session_row.target_canonical_skill_id then
        next_type := 'RETURN_TO_TARGET'; next_purpose := null; next_skill := session_row.target_canonical_skill_id; next_reason := 'TARGET_READY';
      else
        next_type := 'PROBE'; next_purpose := 'PROBE'; next_reason := 'PREREQUISITE_UNKNOWN';
      end if;
    end if;
  elsif completed_step.step_type = 'RETURN_TO_TARGET' then
    next_type := 'REVIEW'; next_purpose := 'REVIEW'; next_skill := session_row.target_canonical_skill_id; next_reason := 'REVIEW_REQUIRED';
  else
    update public.learning_guided_sessions set status = 'COMPLETED', completed_at = now(), decision_reason = 'TARGET_READY', updated_at = now() where id = session_row.id;
    insert into public.learning_guided_session_events(institution_id, session_id, student_id, event_type, step_id, idempotency_key, payload)
    values (session_row.institution_id, session_row.id, session_row.student_id, 'SESSION_COMPLETED', completed_step.id, event_key, jsonb_build_object('reason', 'TARGET_READY'));
    return null;
  end if;

  next_position := completed_step.position + 1;
  if next_purpose is not null then
    question_set := private.pick_learning_question_set_v2(session_row.institution_id, teacher_profile_id, next_skill, next_purpose);
    if question_set is null or not exists (
      select 1
        from public.learning_question_set_items item
        join public.learning_question_bank bank on bank.id = item.question_bank_id and bank.active
       where item.question_set_id = question_set
    ) then
      raise exception 'LEARNING_GUIDED_QUESTION_SET_EMPTY';
    end if;
  end if;
  select lesson.id into next_lesson from public.learning_skill_lessons lesson where lesson.canonical_skill_id = next_skill and lesson.active order by lesson.version desc limit 1;
  insert into public.learning_guided_steps(institution_id, session_id, canonical_skill_id, step_type, purpose, position, status, lesson_id, question_set_id, started_at)
  values (session_row.institution_id, session_row.id, next_skill, next_type, next_purpose, next_position, 'ACTIVE', next_lesson, question_set, now())
  returning id into next_step;
  update public.learning_guided_sessions
     set current_canonical_skill_id = next_skill,
         current_step_id = next_step,
         decision_reason = next_reason,
         replan_count = new_replan,
         updated_at = now()
   where id = session_row.id;
  insert into public.learning_guided_session_events(institution_id, session_id, student_id, event_type, step_id, idempotency_key, payload)
  values (session_row.institution_id, session_row.id, session_row.student_id,
    case when next_type = 'RETURN_TO_TARGET' then 'RETURNED_TO_TARGET' else 'REPLANNED' end,
    next_step, event_key, jsonb_build_object('step_type', next_type, 'reason', next_reason, 'replan_count', new_replan));
  return next_step;
end;
$$;

create or replace function public.start_guided_learning_session_v2(
  p_institution_id uuid,
  p_student_id uuid,
  p_target_canonical_skill_id uuid
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  existing public.learning_guided_sessions%rowtype;
  created public.learning_guided_sessions%rowtype;
  first_step uuid;
  question_set uuid;
  target_skill uuid := p_target_canonical_skill_id;
  first_unmastered_skill uuid;
  first_type text;
  first_purpose text;
  first_reason text;
  target_subject_id uuid;
  enrollment_class_id uuid;
  target_institution_skill_id uuid;
  teacher_profile_id uuid;
begin
  if not private.learning_v2_scope_student(p_institution_id, p_student_id) then raise exception 'LEARNING_STUDENT_SCOPE_DENIED'; end if;
  if not exists (select 1 from public.learning_curriculum_skills skill where skill.id = target_skill and skill.active) then raise exception 'LEARNING_TARGET_NOT_FOUND'; end if;
  first_unmastered_skill := private.pick_learning_v2_next_skill(p_institution_id, p_student_id, target_skill);
  first_type := case when first_unmastered_skill is null then 'REVIEW' else 'PROBE' end;
  first_purpose := first_type;
  first_reason := case when first_unmastered_skill is null then 'TARGET_READY' else 'PREREQUISITE_UNKNOWN' end;
  target_skill := coalesce(first_unmastered_skill, target_skill);
  select session.* into existing from public.learning_guided_sessions session where session.institution_id = p_institution_id and session.student_id = p_student_id and session.target_canonical_skill_id = p_target_canonical_skill_id and session.status in ('ACTIVE', 'PAUSED') order by session.updated_at desc limit 1;
  if found and existing.planner_version = 'V2' then return jsonb_build_object('session_id', existing.id, 'created', false, 'current_step_id', existing.current_step_id); end if;
  if found then
    update public.learning_guided_sessions set status = 'CANCELLED', decision_reason = 'V2_REPLACED_LEGACY_SESSION', updated_at = now() where id = existing.id;
  end if;
  select link.learning_skill_id, unit.subject_id into target_institution_skill_id, target_subject_id
    from public.learning_skill_canonical_links link join public.learning_skills skill on skill.id = link.learning_skill_id and skill.active join public.learning_units unit on unit.id = skill.unit_id and unit.active
   where link.institution_id = p_institution_id and link.canonical_skill_id = p_target_canonical_skill_id and link.active order by link.created_at limit 1;
  select enrollment.class_id into enrollment_class_id from public.enrollments enrollment where enrollment.student_id = p_student_id and enrollment.active and enrollment.status = 'active' order by enrollment.created_at desc limit 1;
  select offering.teacher_profile_id into teacher_profile_id from public.subject_offerings offering where offering.class_id = enrollment_class_id and offering.subject_id = target_subject_id and offering.active order by offering.teacher_profile_id limit 1;
  insert into public.learning_guided_sessions(institution_id, student_id, target_canonical_skill_id, original_target_canonical_skill_id, current_canonical_skill_id, target_institution_skill_id, subject_id, class_id, planner_version, decision_reason, metadata)
  values (p_institution_id, p_student_id, p_target_canonical_skill_id, p_target_canonical_skill_id, target_skill, target_institution_skill_id, target_subject_id, enrollment_class_id, 'V2', first_reason, jsonb_build_object('engine_version', 'V2', 'decision', first_type, 'decision_reason', first_reason, 'replan_count', 0)) returning * into created;
  question_set := private.pick_learning_question_set_v2(p_institution_id, teacher_profile_id, target_skill, first_purpose);
  if question_set is null or not exists (
    select 1
      from public.learning_question_set_items item
      join public.learning_question_bank bank on bank.id = item.question_bank_id and bank.active
     where item.question_set_id = question_set
  ) then raise exception 'LEARNING_GUIDED_QUESTION_SET_EMPTY'; end if;
  insert into public.learning_guided_steps(institution_id, session_id, canonical_skill_id, step_type, purpose, position, status, question_set_id, started_at)
  values (p_institution_id, created.id, target_skill, first_type, first_purpose, 0, 'ACTIVE', question_set, now()) returning id into first_step;
  update public.learning_guided_sessions set current_step_id = first_step where id = created.id;
  insert into public.learning_guided_session_events(institution_id, session_id, student_id, event_type, step_id, idempotency_key, payload)
  values (p_institution_id, created.id, p_student_id, 'SESSION_STARTED', first_step, 'session-start:' || created.id::text, jsonb_build_object('engine_version', 'V2', 'decision', first_type, 'decision_reason', first_reason));
  insert into public.learning_guided_session_events(institution_id, session_id, student_id, event_type, step_id, idempotency_key, payload)
  values (p_institution_id, created.id, p_student_id, 'STEP_STARTED', first_step, 'step-start:' || first_step::text, jsonb_build_object('step_type', first_type));
  return jsonb_build_object('session_id', created.id, 'created', true, 'current_step_id', first_step, 'engine_version', 'V2');
end;
$$;

create or replace function public.get_guided_learning_session_v2(p_institution_id uuid, p_student_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare result jsonb;
begin
  if not private.learning_v2_scope_student(p_institution_id, p_student_id) then raise exception 'LEARNING_STUDENT_SCOPE_DENIED'; end if;
  select jsonb_build_object(
    'id', session.id,
    'student_id', session.student_id,
    'target_canonical_skill_id', session.target_canonical_skill_id,
    'original_target_canonical_skill_id', session.original_target_canonical_skill_id,
    'current_canonical_skill_id', session.current_canonical_skill_id,
    'current_step_id', session.current_step_id,
    'status', session.status,
    'planner_version', session.planner_version,
    'decision_reason', session.decision_reason,
    'replan_count', session.replan_count,
    'metadata', session.metadata,
    'current_step', (select jsonb_build_object('id', step.id, 'canonical_skill_id', step.canonical_skill_id, 'step_type', step.step_type, 'purpose', step.purpose, 'status', step.status, 'position', step.position, 'lesson_id', step.lesson_id) from public.learning_guided_steps step where step.id = session.current_step_id)
  ) into result from public.learning_guided_sessions session where session.institution_id = p_institution_id and session.student_id = p_student_id and session.planner_version = 'V2' and session.status in ('ACTIVE', 'PAUSED', 'NEEDS_TEACHER_SUPPORT') order by session.updated_at desc limit 1;
  return result;
end;
$$;

create or replace function public.get_guided_learning_step_v2(p_step_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare step_row public.learning_guided_steps%rowtype; session_row public.learning_guided_sessions%rowtype; result jsonb;
begin
  select step.* into step_row from public.learning_guided_steps step join public.learning_guided_sessions session on session.id = step.session_id where step.id = p_step_id and session.planner_version = 'V2';
  if not found then raise exception 'LEARNING_GUIDED_STEP_NOT_FOUND'; end if;
  select session.* into session_row from public.learning_guided_sessions session where session.id = step_row.session_id;
  if not private.learning_v2_scope_student(session_row.institution_id, session_row.student_id) then raise exception 'LEARNING_STEP_SCOPE_DENIED'; end if;
  select jsonb_build_object(
    'id', step_row.id, 'session_id', step_row.session_id, 'canonical_skill_id', step_row.canonical_skill_id,
    'step_type', step_row.step_type, 'purpose', step_row.purpose, 'status', step_row.status,
    'position', step_row.position, 'lesson_id', step_row.lesson_id,
    'lesson', (select jsonb_build_object('id', lesson.id, 'title', lesson.title, 'summary', lesson.summary, 'content_markdown', lesson.content_markdown, 'worked_example', lesson.worked_example, 'tips', lesson.tips, 'estimated_minutes', lesson.estimated_minutes) from public.learning_skill_lessons lesson where lesson.id = step_row.lesson_id),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', question.id, 'statement', question.statement, 'options', question.options, 'difficulty', question.difficulty, 'position', item.position) order by item.position) from public.learning_question_set_items item join public.learning_question_bank question on question.id = item.question_bank_id and question.active where item.question_set_id = step_row.question_set_id and not exists (select 1 from public.learning_guided_step_attempts previous_attempt where previous_attempt.session_id = step_row.session_id and exists (select 1 from jsonb_array_elements(previous_attempt.answers) answer where answer->>'question_bank_id' = question.id::text))), '[]'::jsonb)
  ) into result;
  if step_row.step_type in ('PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW') and jsonb_array_length(result->'questions') = 0 then raise exception 'LEARNING_GUIDED_QUESTION_SET_EMPTY'; end if;
  return result;
end;
$$;

create or replace function public.advance_guided_learning_session_v2(p_session_id uuid, p_step_id uuid, p_action text, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare session_row public.learning_guided_sessions%rowtype; step_row public.learning_guided_steps%rowtype; existing_event jsonb; next_step uuid; outcome text := 'SUCCESS';
begin
  select session.* into session_row from public.learning_guided_sessions session where session.id = p_session_id and session.planner_version = 'V2' for update;
  if not found or not private.learning_v2_scope_student(session_row.institution_id, session_row.student_id) then raise exception 'LEARNING_SESSION_SCOPE_DENIED'; end if;
  select jsonb_build_object('session_id', p_session_id, 'step_id', p_step_id, 'idempotent', true, 'current_step_id', session_row.current_step_id) into existing_event
    from public.learning_guided_session_events event
   where event.session_id = p_session_id and event.idempotency_key = p_idempotency_key
   order by event.created_at desc
   limit 1;
  if existing_event is not null then return existing_event; end if;
  select step.* into step_row from public.learning_guided_steps step where step.id = p_step_id and step.session_id = p_session_id for update;
  if not found then raise exception 'LEARNING_GUIDED_STEP_NOT_FOUND'; end if;
  if p_action not in ('LESSON_COMPLETED', 'TARGET_RETURNED', 'REVIEW_REQUESTED') then raise exception 'LEARNING_GUIDED_ACTION_INVALID'; end if;
  if step_row.status in ('COMPLETED', 'SKIPPED') then return jsonb_build_object('session_id', p_session_id, 'step_id', p_step_id, 'idempotent', true, 'current_step_id', session_row.current_step_id); end if;
  update public.learning_guided_steps set status = 'COMPLETED', completed_at = now(), updated_at = now() where id = p_step_id;
  insert into public.learning_guided_session_events(institution_id, session_id, student_id, event_type, step_id, idempotency_key, payload)
  values (session_row.institution_id, p_session_id, session_row.student_id, 'STEP_COMPLETED', p_step_id, p_idempotency_key, jsonb_build_object('action', p_action));
  next_step := private.append_guided_v2_next_step(session_row, step_row, outcome, p_idempotency_key || ':next');
  return jsonb_build_object('session_id', p_session_id, 'step_id', p_step_id, 'idempotent', false, 'current_step_id', next_step, 'session_status', (select status from public.learning_guided_sessions where id = p_session_id));
end;
$$;

create or replace function public.submit_guided_learning_step_v2(p_step_id uuid, p_answers jsonb, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare step_row public.learning_guided_steps%rowtype; session_row public.learning_guided_sessions%rowtype; item record; answer_item jsonb; expected jsonb; submitted jsonb; correct boolean; total integer := 0; correct_count integer := 0; score numeric(5,2); feedback jsonb := '[]'::jsonb; attempt_id uuid; next_step uuid; outcome text;
begin
  select step.* into step_row from public.learning_guided_steps step where step.id = p_step_id for update;
  if not found then raise exception 'LEARNING_GUIDED_STEP_NOT_FOUND'; end if;
  select session.* into session_row from public.learning_guided_sessions session where session.id = step_row.session_id and session.planner_version = 'V2';
  if not found or not private.learning_v2_scope_student(session_row.institution_id, session_row.student_id) then raise exception 'LEARNING_STEP_SCOPE_DENIED'; end if;
  if jsonb_typeof(coalesce(p_answers, '[]'::jsonb)) <> 'array' then raise exception 'LEARNING_GUIDED_ANSWERS_INVALID'; end if;
  select attempt.id into attempt_id from public.learning_guided_step_attempts attempt where attempt.step_id = p_step_id and attempt.idempotency_key = p_idempotency_key;
  if attempt_id is not null then return (select jsonb_build_object('attempt_id', attempt.id, 'idempotent', true, 'score', attempt.score, 'correct_count', attempt.correct_count, 'total_questions', attempt.total_questions, 'feedback', attempt.feedback) from public.learning_guided_step_attempts attempt where attempt.id = attempt_id); end if;
  if step_row.status in ('COMPLETED', 'SKIPPED') then
    select attempt.id into attempt_id
      from public.learning_guided_step_attempts attempt
     where attempt.step_id = p_step_id
     order by attempt.submitted_at desc
     limit 1;
    if attempt_id is not null then
      return (select jsonb_build_object('attempt_id', attempt.id, 'idempotent', true, 'score', attempt.score, 'correct_count', attempt.correct_count, 'total_questions', attempt.total_questions, 'feedback', attempt.feedback) from public.learning_guided_step_attempts attempt where attempt.id = attempt_id);
    end if;
    raise exception 'LEARNING_GUIDED_STEP_ALREADY_COMPLETED';
  end if;
  for item in select bank.id, bank.correct_answer, bank.explanation, bank.metadata, set_item.position from public.learning_question_set_items set_item join public.learning_question_bank bank on bank.id = set_item.question_bank_id and bank.active where set_item.question_set_id = step_row.question_set_id order by set_item.position loop
    total := total + 1;
    select value into answer_item from jsonb_array_elements(p_answers) value where value->>'question_bank_id' = item.id::text limit 1;
    submitted := coalesce(answer_item->'answer', 'null'::jsonb);
    expected := coalesce(item.correct_answer, 'null'::jsonb);
    correct := submitted = expected;
    if correct then correct_count := correct_count + 1; end if;
    feedback := feedback || jsonb_build_array(jsonb_build_object('question_bank_id', item.id, 'is_correct', correct, 'correct_answer', item.correct_answer, 'explanation', item.explanation, 'misconception_code', case when not correct then item.metadata->>'misconception_code' else null end));
  end loop;
  if total = 0 then raise exception 'LEARNING_GUIDED_QUESTION_SET_EMPTY'; end if;
  score := round((correct_count::numeric / total::numeric) * 100, 2);
  insert into public.learning_guided_step_attempts(institution_id, session_id, step_id, student_id, purpose, answers, feedback, score, correct_count, total_questions, idempotency_key)
  values (session_row.institution_id, session_row.id, step_row.id, session_row.student_id, step_row.purpose, p_answers, feedback, score, correct_count, total, p_idempotency_key) returning id into attempt_id;
  insert into public.learning_skill_evidence(institution_id, student_id, canonical_skill_id, source, correct, score, metadata)
  values (session_row.institution_id, session_row.student_id, step_row.canonical_skill_id,
    case step_row.purpose when 'PROBE' then 'DIAGNOSTIC' else step_row.purpose end,
    score >= 80, score, jsonb_build_object('engine_version', 'V2', 'guided_step_id', step_row.id, 'guided_attempt_id', attempt_id, 'purpose', step_row.purpose, 'feedback', feedback));
  perform private.refresh_learning_student_skill_state_v2(session_row.institution_id, session_row.student_id, step_row.canonical_skill_id);
  update public.learning_guided_steps set status = 'COMPLETED', completed_at = now(), evidence_run_id = attempt_id, updated_at = now() where id = step_row.id;
  insert into public.learning_guided_session_events(institution_id, session_id, student_id, event_type, step_id, idempotency_key, payload)
  values (session_row.institution_id, session_row.id, session_row.student_id, 'EVIDENCE_RECORDED', step_row.id, p_idempotency_key, jsonb_build_object('score', score, 'purpose', step_row.purpose));
  outcome := case when score >= 80 then 'SUCCESS' else 'GAP' end;
  next_step := private.append_guided_v2_next_step(session_row, step_row, outcome, p_idempotency_key || ':next');
  return jsonb_build_object('attempt_id', attempt_id, 'idempotent', false, 'score', score, 'correct_count', correct_count, 'total_questions', total, 'feedback', feedback, 'current_step_id', next_step, 'session_status', (select status from public.learning_guided_sessions where id = session_row.id));
end;
$$;

create or replace function public.get_teacher_guided_learning_insights_v2(p_institution_id uuid)
returns table(
  session_id uuid,
  student_id uuid,
  student_name text,
  class_id uuid,
  subject_id uuid,
  target_canonical_skill_id uuid,
  status text,
  decision_reason text,
  replan_count integer,
  misconception_summary jsonb
)
language sql stable security definer set search_path = ''
as $$
  select session.id, session.student_id, profile.full_name, session.class_id, session.subject_id,
         session.target_canonical_skill_id, session.status, session.decision_reason, session.replan_count,
         coalesce((select jsonb_object_agg(summary.code, summary.total)
                     from (select feedback_item->>'misconception_code' as code, count(*)::integer as total
                             from public.learning_skill_evidence evidence
                             cross join lateral jsonb_array_elements(coalesce(evidence.metadata->'feedback', '[]'::jsonb)) feedback_item
                            where evidence.institution_id = p_institution_id
                              and evidence.student_id = session.student_id
                              and feedback_item->>'misconception_code' is not null
                            group by feedback_item->>'misconception_code') summary), '{}'::jsonb)
    from public.learning_guided_sessions session
    join public.students student on student.id = session.student_id and student.institution_id = p_institution_id
    join public.profiles profile on profile.id = student.profile_id
   where session.institution_id = p_institution_id
     and session.planner_version = 'V2'
     and session.status in ('ACTIVE', 'NEEDS_TEACHER_SUPPORT')
     and (
       public.can_manage_institution_operations(p_institution_id)
       or exists (
         select 1 from public.subject_offerings offering
          where offering.class_id = session.class_id
            and offering.subject_id = session.subject_id
            and offering.teacher_profile_id = auth.uid()
            and offering.active
       )
     )
   order by session.status desc, session.updated_at desc;
$$;

create or replace function public.resolve_teacher_guided_learning_session_v2(
  p_session_id uuid,
  p_action text,
  p_target_canonical_skill_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare session_row public.learning_guided_sessions%rowtype; current_step public.learning_guided_steps%rowtype; new_step uuid; question_set uuid; teacher_profile_id uuid;
begin
  select session.* into session_row from public.learning_guided_sessions session where session.id = p_session_id and session.planner_version = 'V2';
  if not found then raise exception 'LEARNING_SESSION_NOT_FOUND'; end if;
  if not (
    public.can_manage_institution_operations(session_row.institution_id)
    or exists (select 1 from public.subject_offerings offering where offering.class_id = session_row.class_id and offering.subject_id = session_row.subject_id and offering.teacher_profile_id = auth.uid() and offering.active)
  ) then raise exception 'LEARNING_TEACHER_SCOPE_DENIED'; end if;
  if p_action not in ('RESUME', 'CLOSE', 'OVERRIDE_TARGET') then raise exception 'LEARNING_GUIDED_ACTION_INVALID'; end if;
  if p_action = 'CLOSE' then
    update public.learning_guided_sessions set status = 'CANCELLED', decision_reason = 'TEACHER_SUPPORT_REQUIRED', updated_at = now() where id = p_session_id;
  elsif p_action = 'RESUME' then
    update public.learning_guided_sessions set status = 'ACTIVE', replan_count = 0, decision_reason = 'REVIEW_REQUIRED', updated_at = now() where id = p_session_id;
  else
    if p_target_canonical_skill_id is null or not exists (select 1 from public.learning_curriculum_skills skill where skill.id = p_target_canonical_skill_id and skill.active) then raise exception 'LEARNING_TARGET_NOT_FOUND'; end if;
    select offering.teacher_profile_id into teacher_profile_id from public.subject_offerings offering where offering.class_id = session_row.class_id and offering.subject_id = session_row.subject_id and offering.teacher_profile_id = auth.uid() and offering.active limit 1;
    select step.* into current_step from public.learning_guided_steps step where step.id = session_row.current_step_id;
    if found then update public.learning_guided_steps set status = 'SKIPPED', updated_at = now() where id = current_step.id; end if;
    question_set := private.pick_learning_question_set_v2(session_row.institution_id, teacher_profile_id, p_target_canonical_skill_id, 'PROBE');
    if question_set is null or not exists (
      select 1
        from public.learning_question_set_items item
        join public.learning_question_bank bank on bank.id = item.question_bank_id and bank.active
       where item.question_set_id = question_set
    ) then raise exception 'LEARNING_GUIDED_QUESTION_SET_EMPTY'; end if;
    insert into public.learning_guided_steps(institution_id, session_id, canonical_skill_id, step_type, purpose, position, status, question_set_id, started_at)
    values (session_row.institution_id, p_session_id, p_target_canonical_skill_id, 'PROBE', 'PROBE', coalesce(current_step.position, 0) + 1, 'ACTIVE', question_set, now()) returning id into new_step;
    update public.learning_guided_sessions set target_canonical_skill_id = p_target_canonical_skill_id, current_canonical_skill_id = p_target_canonical_skill_id, current_step_id = new_step, status = 'ACTIVE', replan_count = 0, decision_reason = 'PREREQUISITE_UNKNOWN', metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('teacher_override', true, 'engine_version', 'V2'), updated_at = now() where id = p_session_id;
  end if;
  insert into public.learning_guided_session_events(institution_id, session_id, student_id, event_type, idempotency_key, payload)
  values (session_row.institution_id, p_session_id, session_row.student_id, case when p_action = 'CLOSE' then 'TEACHER_SUPPORT_REQUIRED' else 'REPLANNED' end, 'teacher:' || p_action || ':' || p_session_id::text || ':' || extract(epoch from now())::text, jsonb_build_object('action', p_action, 'target_canonical_skill_id', p_target_canonical_skill_id));
  return jsonb_build_object('session_id', p_session_id, 'action', p_action, 'current_step_id', new_step);
end;
$$;

-- Keep one stable plan per civil day, but allow the plan to collect active
-- guided work from more than one subject/session for the same student.
create or replace function public.create_or_get_learning_daily_plan(
  p_institution_id uuid,
  p_student_id uuid,
  p_plan_date date default current_date
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_plan_id uuid;
  position_index integer := 0;
  review_row record;
  session_row record;
  step_row record;
begin
  if not exists (
    select 1
      from public.students student
     where student.id = p_student_id
       and student.institution_id = p_institution_id
       and student.active
       and (student.profile_id = auth.uid() or public.can_manage_institution_operations(p_institution_id))
  ) then
    raise exception 'LEARNING_STUDENT_SCOPE_DENIED';
  end if;

  select plan.id into v_plan_id
    from public.learning_daily_plans plan
   where plan.institution_id = p_institution_id
     and plan.student_id = p_student_id
     and plan.plan_date = p_plan_date;
  if v_plan_id is not null then return v_plan_id; end if;

  insert into public.learning_daily_plans(institution_id, student_id, plan_date)
  values (p_institution_id, p_student_id, p_plan_date)
  returning id into v_plan_id;

  for review_row in
    select review.canonical_skill_id, skill.title
      from public.learning_skill_reviews review
      join public.learning_curriculum_skills skill on skill.id = review.canonical_skill_id
     where review.institution_id = p_institution_id
       and review.student_id = p_student_id
       and review.completed_at is null
       and review.review_due_at <= (p_plan_date + 1)::timestamptz
     order by review.review_due_at, review.canonical_skill_id
     limit 2
  loop
    insert into public.learning_daily_plan_items(
      institution_id, plan_id, position, item_type, title, description,
      canonical_skill_id, estimated_minutes
    ) values (
      p_institution_id, v_plan_id, position_index, 'REVIEW',
      'Revisar ' || review_row.title,
      'Uma revisão curta para manter o domínio.',
      review_row.canonical_skill_id, 5
    );
    position_index := position_index + 1;
  end loop;

  for session_row in
    select session.id, session.updated_at
      from public.learning_guided_sessions session
     where session.institution_id = p_institution_id
       and session.student_id = p_student_id
       and session.status in ('ACTIVE', 'PAUSED')
     order by session.updated_at desc, session.id
  loop
    exit when position_index >= 6;
    for step_row in
      select step.id, step.step_type, step.canonical_skill_id, step.position,
             step.lesson_id, step.activity_id, skill.title
        from public.learning_guided_steps step
        join public.learning_curriculum_skills skill on skill.id = step.canonical_skill_id
       where step.session_id = session_row.id
         and step.status in ('ACTIVE', 'PENDING')
       order by step.position, step.id
       limit 4
    loop
      exit when position_index >= 6;
      insert into public.learning_daily_plan_items(
        institution_id, plan_id, position, item_type, title, description,
        canonical_skill_id, session_id, step_id, lesson_id, activity_id,
        estimated_minutes
      ) values (
        p_institution_id, v_plan_id, position_index,
        case step_row.step_type
          when 'LOCK_IN' then 'LOCK_IN'
          when 'DIAGNOSTIC' then 'DIAGNOSTIC'
          when 'PROBE' then 'DIAGNOSTIC'
          when 'LESSON' then 'LESSON'
          when 'RETURN_TO_TARGET' then 'CURRENT_TARGET'
          else 'PRACTICE'
        end,
        case when step_row.step_type = 'RETURN_TO_TARGET'
          then 'Retomar seu objetivo'
          else initcap(lower(replace(step_row.step_type, '_', ' '))) || ': ' || step_row.title
        end,
        'Próximo passo da sua sessão guiada.',
        step_row.canonical_skill_id, session_row.id, step_row.id,
        step_row.lesson_id, step_row.activity_id,
        case when step_row.step_type = 'LESSON' then 6 else 5 end
      );
      position_index := position_index + 1;
    end loop;
  end loop;

  update public.learning_daily_plans
     set estimated_minutes = coalesce((select sum(item.estimated_minutes) from public.learning_daily_plan_items item where item.plan_id = v_plan_id), 0),
         updated_at = now()
   where id = v_plan_id;
  return v_plan_id;
end;
$$;

-- A small second-subject slice proves that the engine is generic. Content is
-- authorial TecEscola material, not an official exam corpus.
do $$
declare v_catalog_id uuid; v_reading_skill uuid; v_cohesion_skill uuid; question_id uuid; item record;
begin
  select id into v_catalog_id from public.learning_curriculum_catalogs where code = 'TECESCOLA_CORE' and version = '1.0' limit 1;
  insert into public.learning_curriculum_skills(catalog_id, code, stage, grade_level, subject_area, domain, title, description, active)
  values (v_catalog_id, 'READING_ARGUMENT', 'ENSINO_MEDIO', 1, 'LINGUAGENS', 'LEITURA', 'Leitura argumentativa', 'Identificar tese, argumento e evidência em textos curtos.', true)
  on conflict (catalog_id, code) do update set active = true, title = excluded.title, description = excluded.description
  returning id into v_reading_skill;
  if v_reading_skill is null then select canonical.id into v_reading_skill from public.learning_curriculum_skills canonical where canonical.catalog_id = v_catalog_id and canonical.code = 'READING_ARGUMENT'; end if;
  insert into public.learning_curriculum_skills(catalog_id, code, stage, grade_level, subject_area, domain, title, description, active)
  values (v_catalog_id, 'TEXTUAL_COHESION', 'ENSINO_MEDIO', 1, 'LINGUAGENS', 'ESCRITA', 'Coesão textual', 'Relacionar ideias com conectivos e retomadas claras.', true)
  on conflict (catalog_id, code) do update set active = true, title = excluded.title, description = excluded.description
  returning id into v_cohesion_skill;
  if v_cohesion_skill is null then select canonical.id into v_cohesion_skill from public.learning_curriculum_skills canonical where canonical.catalog_id = v_catalog_id and canonical.code = 'TEXTUAL_COHESION'; end if;
  insert into public.learning_skill_prerequisites(skill_id, prerequisite_skill_id) values (v_cohesion_skill, v_reading_skill) on conflict do nothing;
  insert into public.learning_curriculum_grade_targets(catalog_id, stage, grade_level, subject_area, canonical_skill_id, priority, sort_order, active)
  values (v_catalog_id, 'ENSINO_MEDIO', 1, 'LINGUAGENS', v_cohesion_skill, 0, 0, true)
  on conflict (catalog_id, stage, grade_level, subject_area, canonical_skill_id) do update set active = true;
  insert into public.learning_skill_lessons(canonical_skill_id, version, title, summary, content_markdown, worked_example, tips, estimated_minutes, metadata)
  values
    (v_reading_skill, 2, 'Leitura argumentativa', 'Como localizar a ideia central e os argumentos de um texto.', 'CONCEITO\n\nA tese é a ideia que o texto defende. Os argumentos são as razões usadas para sustentá-la.\n\nINTUIÇÃO\n\nPergunte: qual posição o autor quer que eu aceite? e depois qual evidência ele oferece?\n\nEXEMPLO RESOLVIDO\n\nEm um texto que defende bibliotecas abertas no fim de semana, a tese é ampliar o acesso; dados de frequência e relatos de leitores são argumentos.\n\nSEGUNDO EXEMPLO\n\nUma frase que apresenta apenas um dado pode ser evidência, mas não necessariamente a tese.\n\nDICA\n\nNão confunda o assunto geral com a posição defendida.', 'A palavra portanto costuma introduzir uma conclusão; procure a ideia que ela retoma.', array['Destaque a tese em uma frase.', 'Separe opinião, argumento e exemplo.'], 7, jsonb_build_object('engine_version', 'V2')),
    (v_cohesion_skill, 2, 'Coesão textual', 'Como conectar frases para que o leitor acompanhe o raciocínio.', 'CONCEITO\n\nCoesão é a ligação visível entre partes do texto por conectivos, pronomes e repetições controladas.\n\nINTUIÇÃO\n\nCada frase deve responder ao que veio antes e preparar o que vem depois.\n\nEXEMPLO RESOLVIDO\n\nChoveu muito. Por isso, a quadra ficou fechada. O conectivo indica consequência e evita uma relação solta.\n\nSEGUNDO EXEMPLO\n\nMaria leu o artigo e depois o resumiu. O pronome retoma artigo sem repetir a expressão inteira.\n\nDICA\n\nEscolha o conectivo pela relação lógica, não apenas pelo som.', 'Troque o conectivo e observe se a relação muda de causa para oposição.', array['Procure o referente dos pronomes.', 'Teste se o conectivo expressa a relação pretendida.'], 7, jsonb_build_object('engine_version', 'V2'))
  on conflict (canonical_skill_id, version) do update set title = excluded.title, summary = excluded.summary, content_markdown = excluded.content_markdown, worked_example = excluded.worked_example, tips = excluded.tips, metadata = excluded.metadata, active = true, updated_at = now();
  for item in select * from (values
    ('READING_ARGUMENT', 'Qual pergunta ajuda a localizar a tese de um texto?', 'Qual posição o autor defende?', 'Quantas linhas o texto tem?', 'Qual é a cor da página?', 'Quem imprimiu o texto?'),
    ('READING_ARGUMENT', 'Em um texto argumentativo, para que servem os dados?', 'Para sustentar uma ideia', 'Para substituir o título', 'Para apagar a tese', 'Para indicar a fonte da tinta?'),
    ('COHESION_TEXT', 'Qual conectivo indica consequência?', 'por isso', 'porém', 'embora', 'enquanto')
  ) as question(code, statement, correct, option_one, option_two, option_three)
  loop
    select id into question_id from public.learning_question_bank where source_type = 'TECESCOLA_CORE_V2' and statement = item.statement limit 1;
    if question_id is null then
      insert into public.learning_question_bank(package_type, source_type, source_name, subject_area, domain, topic, statement, options, correct_answer, explanation, difficulty, estimated_minutes, provenance, active)
      values ('TECESCOLA', 'TECESCOLA_CORE_V2', 'TecEscola', 'LINGUAGENS', 'LEITURA', item.code, item.statement, jsonb_build_array(item.option_one, item.option_two, item.option_three), to_jsonb(item.correct), 'Compare a relação entre a pergunta e a ideia defendida antes de escolher.', 'EASY', 3, 'Conteúdo autoral versionado do TecEscola; não é questão oficial ENEM.', true)
      returning id into question_id;
    end if;
    insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role)
    values (question_id, case when item.code = 'COHESION_TEXT' then v_cohesion_skill else v_reading_skill end, 'PRIMARY')
    on conflict (question_bank_id, canonical_skill_id) do nothing;
  end loop;
end;
$$;







-- GENERATED FROM content/adaptive/tec-escola-core-v2/*.json.
do $seed$
declare
  item record;
  skill_row record;
  purpose_row record;
  question_row record;
  skill_id uuid;
  question_id uuid;
  prerequisite_id uuid;
  set_id uuid;
  position_index integer;
begin
  for item in select * from (values
    ('FRACTIONS', 'Fundamentos de frações', 'Representar, comparar e operar frações com significado.', '## Conceito\n\nUma fração descreve partes iguais de um todo ou uma razão entre quantidades. Antes de operar, pergunte o que representa o denominador.\n\n## Intuição\n\nUma receita usa 1/2 de xícara de leite e mais 1/4. Com denominador comum 4, 1/2 = 2/4; portanto 2/4 + 1/4 = 3/4.\n\n## Exemplo resolvido\n\nPara comparar 3/5 e 2/3, use produto cruzado: 3 x 3 = 9 e 2 x 5 = 10; logo 2/3 é maior.\n\n## Erro comum\n\nErro comum: somar numeradores e denominadores diretamente. Dica: só some diretamente quando os denominadores já forem iguais.', 'Para comparar 3/5 e 2/3, use produto cruzado: 3 x 3 = 9 e 2 x 5 = 10; logo 2/3 é maior.', array['Erro comum: somar numeradores e denominadores diretamente. Dica: só some diretamente quando os denominadores já forem iguais.', 'Explique por que a resposta faz sentido antes de avançar.']::text[], 8),
    ('RATIO_PROPORTION', 'Razão e proporção', 'Relacionar grandezas por razões, escalas e proporções.', '## Conceito\n\nRazão compara quantidades na mesma unidade; proporção afirma que duas razões representam a mesma relação.\n\n## Intuição\n\nSe 3 cadernos custam R$18, cada caderno custa R$6. Para 5 cadernos, a relação mantém 18/3 = x/5, logo x = 30.\n\n## Exemplo resolvido\n\nEm um mapa de escala 1:100 000, 1 cm representa 100 000 cm reais, ou 1 km.\n\n## Erro comum\n\nErro comum: misturar unidades antes de montar a razão. Dica: converta as grandezas primeiro.', 'Em um mapa de escala 1:100 000, 1 cm representa 100 000 cm reais, ou 1 km.', array['Erro comum: misturar unidades antes de montar a razão. Dica: converta as grandezas primeiro.', 'Explique por que a resposta faz sentido antes de avançar.']::text[], 8),
    ('PERCENTAGE', 'Porcentagem', 'Interpretar porcentagens como partes de cem em situações reais.', '## Conceito\n\nPorcentagem é uma razão com denominador 100. O símbolo % indica quantas partes de cem estão sendo consideradas.\n\n## Intuição\n\nPara calcular 25% de 80, use 25/100 x 80 = 20. Também é possível notar que 25% é um quarto.\n\n## Exemplo resolvido\n\nUm desconto de 10% em R$200 é R$20; o preço final é R$180.\n\n## Erro comum\n\nErro comum: somar percentuais de etapas sem verificar a base. Dica: informe sempre sobre qual valor o percentual é calculado.', 'Um desconto de 10% em R$200 é R$20; o preço final é R$180.', array['Erro comum: somar percentuais de etapas sem verificar a base. Dica: informe sempre sobre qual valor o percentual é calculado.', 'Explique por que a resposta faz sentido antes de avançar.']::text[], 8),
    ('EQUATIONS', 'Equações de primeiro grau', 'Modelar situações e resolver equações lineares com uma incógnita.', '## Conceito\n\nUma equação afirma que duas expressões têm o mesmo valor. O objetivo é isolar a incógnita mantendo a igualdade.\n\n## Intuição\n\nEm 2x + 4 = 10, subtraia 4 dos dois lados e divida por 2: x = 3.\n\n## Exemplo resolvido\n\nEm um problema de preço, escolha a incógnita antes de traduzir as palavras em operações.\n\n## Erro comum\n\nErro comum: mover um termo sem mudar a operação. Dica: faça a mesma operação nos dois lados e confira substituindo a resposta.', 'Em um problema de preço, escolha a incógnita antes de traduzir as palavras em operações.', array['Erro comum: mover um termo sem mudar a operação. Dica: faça a mesma operação nos dois lados e confira substituindo a resposta.', 'Explique por que a resposta faz sentido antes de avançar.']::text[], 8),
    ('FUNCTIONS_INTRO', 'Introdução a funções', 'Interpretar funções como relações entre entrada, regra e saída.', '## Conceito\n\nUma função associa cada entrada a uma única saída. A lei descreve como transformar x em f(x).\n\n## Intuição\n\nSe f(x)=2x+1, a entrada 3 produz 7. A tabela ajuda a perceber a regularidade entre entradas e saídas.\n\n## Exemplo resolvido\n\nUm gráfico de uma função organiza pares ordenados (entrada, saída), não apenas números soltos.\n\n## Erro comum\n\nErro comum: trocar entrada e saída. Dica: localize primeiro o valor fornecido e aplique a regra.', 'Um gráfico de uma função organiza pares ordenados (entrada, saída), não apenas números soltos.', array['Erro comum: trocar entrada e saída. Dica: localize primeiro o valor fornecido e aplique a regra.', 'Explique por que a resposta faz sentido antes de avançar.']::text[], 8),
    ('LINEAR_FUNCTION', 'Função afim', 'Interpretar lei, gráfico e variação de uma função afim.', '## Conceito\n\nUma função afim tem forma f(x)=ax+b. O coeficiente a indica a variação por unidade e b é o valor inicial quando x=0.\n\n## Intuição\n\nNa função f(x)=2x+5, a cada unidade de x a saída cresce 2 e o gráfico cruza o eixo vertical em 5.\n\n## Exemplo resolvido\n\nPara construir um modelo de custo, se há taxa fixa e custo por unidade, a taxa fixa é b e o custo unitário é a.\n\n## Erro comum\n\nErro comum: confundir intercepto com inclinação. Dica: observe separadamente o valor inicial e quanto cresce a cada passo.', 'Para construir um modelo de custo, se há taxa fixa e custo por unidade, a taxa fixa é b e o custo unitário é a.', array['Erro comum: confundir intercepto com inclinação. Dica: observe separadamente o valor inicial e quanto cresce a cada passo.', 'Explique por que a resposta faz sentido antes de avançar.']::text[], 8),
    ('READING_ARGUMENT', 'Leitura argumentativa', 'Identificar tese, argumento e evidência em textos de opinião.', '## Conceito\n\nA tese é a posição defendida; argumentos sustentam essa posição e evidências tornam a defesa verificável.\n\n## Intuição\n\nEm um texto que defende bibliotecas abertas no fim de semana, a tese é ampliar o acesso; dados de frequência são evidências.\n\n## Erro comum\n\nErro comum: confundir assunto com tese. Dica: formule a posição do autor em uma frase completa.', 'Em um texto que defende bibliotecas abertas no fim de semana, a tese é ampliar o acesso; dados de frequência são evidências.', array['Erro comum: confundir assunto com tese. Dica: formule a posição do autor em uma frase completa.', 'Explique qual pista textual orientou sua escolha.']::text[], 7),
    ('READING_INFERENCE', 'Inferência de leitura', 'Construir inferências conectando pistas do texto ao conhecimento de mundo.', '## Conceito\n\nInferir não é inventar: é concluir algo apoiado por informações explícitas e pela situação apresentada.\n\n## Intuição\n\nSe o texto diz que Clara levou guarda-chuva e o céu escureceu, podemos inferir que havia chance de chuva.\n\n## Erro comum\n\nErro comum: escolher uma conclusão possível, mas sem apoio. Dica: aponte a pista textual que sustenta cada inferência.', 'Se o texto diz que Clara levou guarda-chuva e o céu escureceu, podemos inferir que havia chance de chuva.', array['Erro comum: escolher uma conclusão possível, mas sem apoio. Dica: aponte a pista textual que sustenta cada inferência.', 'Explique qual pista textual orientou sua escolha.']::text[], 7),
    ('TEXTUAL_COHESION', 'Coesão textual', 'Relacionar ideias com conectivos, pronomes e retomadas claras.', '## Conceito\n\nCoesão é a ligação visível entre partes do texto; ela ajuda o leitor a saber como uma frase se conecta à outra.\n\n## Intuição\n\nEm ''Choveu muito. Por isso, a quadra fechou'', o conectivo explicita consequência. Em ''Maria leu o artigo e depois o resumiu'', o pronome retoma artigo.\n\n## Erro comum\n\nErro comum: escolher conectivo apenas pelo som. Dica: nomeie a relação lógica antes de escolher a palavra.', 'Em ''Choveu muito. Por isso, a quadra fechou'', o conectivo explicita consequência. Em ''Maria leu o artigo e depois o resumiu'', o pronome retoma artigo.', array['Erro comum: escolher conectivo apenas pelo som. Dica: nomeie a relação lógica antes de escolher a palavra.', 'Explique qual pista textual orientou sua escolha.']::text[], 7)
  ) as lesson_row(skill_code, title, summary, content_markdown, worked_example, tips, estimated_minutes)
  loop
    select canonical.id into skill_id from public.learning_curriculum_skills canonical join public.learning_curriculum_catalogs catalog on catalog.id = canonical.catalog_id
     where catalog.code = 'TECESCOLA_CORE' and catalog.version = '1.0' and canonical.code = item.skill_code and canonical.active limit 1;
    if skill_id is null then raise exception 'TECESCOLA_V2_SKILL_MISSING:%', item.skill_code; end if;
    insert into public.learning_skill_lessons(canonical_skill_id, version, title, summary, content_markdown, worked_example, tips, estimated_minutes, metadata)
    values (skill_id, 2, item.title, item.summary, item.content_markdown, item.worked_example, item.tips, item.estimated_minutes, jsonb_build_object('content_pack', 'tec-escola-core-v2', 'engine_version', 'V2'))
    on conflict (canonical_skill_id, version) do update set title = excluded.title, summary = excluded.summary, content_markdown = excluded.content_markdown, worked_example = excluded.worked_example, tips = excluded.tips, estimated_minutes = excluded.estimated_minutes, metadata = excluded.metadata, active = true, updated_at = now();
  end loop;

  for item in select * from (values
    ('FRACTIONS', 'MATEMATICA', 'PROBE', 'Uma barra dividida em 8 partes iguais tem 3 partes pintadas. Qual fração representa a parte pintada?', '["3/8","5/8","3/5","8/3"]'::jsonb, '"3/8"'::jsonb, 'O numerador conta as partes pintadas e o denominador conta as partes iguais.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PROBE","content_pack":"tec-escola-core-v2","content_question_id":"fractions-1","misconception_code":null}'::jsonb),
    ('FRACTIONS', 'MATEMATICA', 'PROBE', 'Qual fração é equivalente a 1/2?', '["2/4","1/3","3/5","4/6"]'::jsonb, '"2/4"'::jsonb, 'Multiplicar numerador e denominador por 2 mantém a mesma parte.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PROBE","content_pack":"tec-escola-core-v2","content_question_id":"fractions-2","misconception_code":null}'::jsonb),
    ('FRACTIONS', 'MATEMATICA', 'PROBE', 'Em 5/7, o que indica o número 7?', '["O total de partes iguais","As partes escolhidas","A quantidade de objetos","O resultado da divisão"]'::jsonb, '"O total de partes iguais"'::jsonb, 'O denominador indica em quantas partes iguais o todo foi dividido.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PROBE","content_pack":"tec-escola-core-v2","content_question_id":"fractions-3","misconception_code":null}'::jsonb),
    ('FRACTIONS', 'MATEMATICA', 'PRACTICE', 'Quanto é 1/2 + 1/4?', '["3/4","2/6","1/6","4/8"]'::jsonb, '"3/4"'::jsonb, 'Transforme 1/2 em 2/4 e some os numeradores.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"fractions-4","misconception_code":"fraction_add_direct_components"}'::jsonb),
    ('FRACTIONS', 'MATEMATICA', 'PRACTICE', 'Quanto é 5/6 - 1/3?', '["1/2","4/3","2/6","5/3"]'::jsonb, '"1/2"'::jsonb, 'Como 1/3 = 2/6, temos 5/6 - 2/6 = 3/6 = 1/2.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"fractions-5","misconception_code":null}'::jsonb),
    ('FRACTIONS', 'MATEMATICA', 'PRACTICE', 'Qual é o resultado de 2/3 x 3/4?', '["1/2","5/7","6/7","2/9"]'::jsonb, '"1/2"'::jsonb, 'Multiplique os numeradores e denominadores e simplifique 6/12.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"fractions-6","misconception_code":null}'::jsonb),
    ('FRACTIONS', 'MATEMATICA', 'PRACTICE', 'Qual fração é maior?', '["3/5","1/2","2/5","4/10"]'::jsonb, '"3/5"'::jsonb, 'Em décimos, 3/5 = 6/10 e 1/2 = 5/10.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"fractions-7","misconception_code":null}'::jsonb),
    ('FRACTIONS', 'MATEMATICA', 'TRANSFER', 'Uma turma leu 2/5 de um livro pela manhã e 1/10 à tarde. Que parte foi lida no dia?', '["1/2","3/15","2/10","1/4"]'::jsonb, '"1/2"'::jsonb, '2/5 = 4/10; 4/10 + 1/10 = 5/10 = 1/2.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"TRANSFER","content_pack":"tec-escola-core-v2","content_question_id":"fractions-8","misconception_code":null}'::jsonb),
    ('FRACTIONS', 'MATEMATICA', 'TRANSFER', 'Uma fita de 3/4 m foi cortada em pedaços de 1/8 m. Quantos pedaços completos foram obtidos?', '["6","3","8","12"]'::jsonb, '"6"'::jsonb, '3/4 = 6/8, então cabem seis pedaços de 1/8.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"TRANSFER","content_pack":"tec-escola-core-v2","content_question_id":"fractions-9","misconception_code":null}'::jsonb),
    ('FRACTIONS', 'MATEMATICA', 'LOCK_IN', 'Uma pessoa gastou 3/8 do salário e depois mais 1/4. Qual fração restou?', '["3/8","5/8","1/8","7/8"]'::jsonb, '"3/8"'::jsonb, 'O gasto foi 3/8 + 2/8 = 5/8; resta 3/8.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"LOCK_IN","content_pack":"tec-escola-core-v2","content_question_id":"fractions-10","misconception_code":null}'::jsonb),
    ('FRACTIONS', 'MATEMATICA', 'LOCK_IN', 'Por que 2/3 não é igual a 2/5?', '["Os numeradores iguais não compensam denominadores diferentes","Porque 3 é maior que 5","Porque toda fração é menor que 1/2","Porque os numeradores deveriam ser diferentes"]'::jsonb, '"Os numeradores iguais não compensam denominadores diferentes"'::jsonb, 'Com o mesmo numerador, dividir o todo em menos partes produz partes maiores.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"LOCK_IN","content_pack":"tec-escola-core-v2","content_question_id":"fractions-11","misconception_code":null}'::jsonb),
    ('FRACTIONS', 'MATEMATICA', 'REVIEW', 'Qual estratégia é mais segura para somar 3/4 e 2/3?', '["Encontrar um denominador comum antes de somar","Somar os quatro números","Somar os denominadores e manter o maior","Subtrair os numeradores"]'::jsonb, '"Encontrar um denominador comum antes de somar"'::jsonb, 'Denominadores comuns representam partes do mesmo tamanho.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"REVIEW","content_pack":"tec-escola-core-v2","content_question_id":"fractions-12","misconception_code":null}'::jsonb),
    ('RATIO_PROPORTION', 'MATEMATICA', 'PROBE', 'A razão entre 2 meninas e 3 meninos pode ser escrita como:', '["2:3","3:2","2+3","5:2"]'::jsonb, '"2:3"'::jsonb, 'A ordem indicada preserva meninas no primeiro termo e meninos no segundo.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PROBE","content_pack":"tec-escola-core-v2","content_question_id":"ratio_proportion-1","misconception_code":null}'::jsonb),
    ('RATIO_PROPORTION', 'MATEMATICA', 'PROBE', 'Se 4 ingressos custam R$40, qual é o preço unitário?', '["R$10","R$8","R$36","R$44"]'::jsonb, '"R$10"'::jsonb, 'Divida o custo total pela quantidade.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PROBE","content_pack":"tec-escola-core-v2","content_question_id":"ratio_proportion-2","misconception_code":null}'::jsonb),
    ('RATIO_PROPORTION', 'MATEMATICA', 'PROBE', 'Qual igualdade forma uma proporção?', '["2/3 = 4/6","2/3 = 3/4","2+3 = 4+6","2/3 = 6/4"]'::jsonb, '"2/3 = 4/6"'::jsonb, 'As duas razões representam o mesmo valor.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PROBE","content_pack":"tec-escola-core-v2","content_question_id":"ratio_proportion-3","misconception_code":null}'::jsonb),
    ('RATIO_PROPORTION', 'MATEMATICA', 'PRACTICE', 'Se 2 cadernos custam R$10, quanto custam 6?', '["R$30","R$20","R$25","R$60"]'::jsonb, '"R$30"'::jsonb, 'Seis é três vezes dois, então o custo também é triplicado.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"ratio_proportion-4","misconception_code":null}'::jsonb),
    ('RATIO_PROPORTION', 'MATEMATICA', 'PRACTICE', 'Uma receita para 4 pessoas usa 300 g de arroz. Para 6 pessoas, usa:', '["450 g","350 g","600 g","200 g"]'::jsonb, '"450 g"'::jsonb, 'A quantidade por pessoa é 75 g; 75 x 6 = 450.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"ratio_proportion-5","misconception_code":null}'::jsonb),
    ('RATIO_PROPORTION', 'MATEMATICA', 'PRACTICE', 'Em uma escala 1:100, 2 cm representam:', '["2 m","20 cm","100 m","200 m"]'::jsonb, '"2 m"'::jsonb, '2 cm x 100 = 200 cm = 2 m.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"ratio_proportion-6","misconception_code":null}'::jsonb),
    ('RATIO_PROPORTION', 'MATEMATICA', 'PRACTICE', 'Se 5 trabalhadores fazem uma tarefa em 12 dias, a afirmação diretamente proporcional é:', '["Mais trabalhadores podem reduzir o tempo, mantendo a produtividade","Dobrar trabalhadores dobra os dias","O tempo não depende de trabalhadores","A tarefa fica maior"]'::jsonb, '"Mais trabalhadores podem reduzir o tempo, mantendo a produtividade"'::jsonb, 'A relação depende da produtividade e da quantidade de trabalho.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"ratio_proportion-7","misconception_code":null}'::jsonb),
    ('RATIO_PROPORTION', 'MATEMATICA', 'TRANSFER', 'Uma escola mantém 1 monitor para cada 25 alunos. Para 150 alunos, quantos monitores são necessários?', '["6","5","25","150"]'::jsonb, '"6"'::jsonb, '150 dividido por 25 mantém a razão de atendimento.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"TRANSFER","content_pack":"tec-escola-core-v2","content_question_id":"ratio_proportion-8","misconception_code":null}'::jsonb),
    ('RATIO_PROPORTION', 'MATEMATICA', 'TRANSFER', 'Uma maquete usa escala 1:50. Uma parede real de 4 m deve medir:', '["8 cm","2 cm","50 cm","200 cm"]'::jsonb, '"8 cm"'::jsonb, '4 m = 400 cm; 400/50 = 8 cm.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"TRANSFER","content_pack":"tec-escola-core-v2","content_question_id":"ratio_proportion-9","misconception_code":null}'::jsonb),
    ('RATIO_PROPORTION', 'MATEMATICA', 'LOCK_IN', 'Um suco mistura concentrado e água na razão 1:4. Em 10 copos, quantos são de concentrado?', '["2","1","4","5"]'::jsonb, '"2"'::jsonb, 'Há cinco partes no total; 10/5 = 2 para cada parte.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"LOCK_IN","content_pack":"tec-escola-core-v2","content_question_id":"ratio_proportion-10","misconception_code":null}'::jsonb),
    ('RATIO_PROPORTION', 'MATEMATICA', 'LOCK_IN', 'Por que 3/5 = 6/10?', '["Os dois termos foram multiplicados por 2","Somaram-se 3 e 5","O denominador foi reduzido","A razão mudou de sentido"]'::jsonb, '"Os dois termos foram multiplicados por 2"'::jsonb, 'Multiplicar os dois termos pelo mesmo número conserva a razão.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"LOCK_IN","content_pack":"tec-escola-core-v2","content_question_id":"ratio_proportion-11","misconception_code":null}'::jsonb),
    ('RATIO_PROPORTION', 'MATEMATICA', 'REVIEW', 'Para resolver x/8 = 3/4, é adequado:', '["Fazer produto cruzado e obter 4x = 24","Somar 8 e 4","Dividir 3 por 8 sem considerar 4","Trocar x por 3"]'::jsonb, '"Fazer produto cruzado e obter 4x = 24"'::jsonb, 'O produto cruzado preserva a igualdade entre as razões.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"REVIEW","content_pack":"tec-escola-core-v2","content_question_id":"ratio_proportion-12","misconception_code":null}'::jsonb),
    ('PERCENTAGE', 'MATEMATICA', 'PROBE', '25% corresponde a qual fração simplificada?', '["1/4","1/5","1/2","25/10"]'::jsonb, '"1/4"'::jsonb, '25 em cada 100 equivale a um quarto.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PROBE","content_pack":"tec-escola-core-v2","content_question_id":"percentage-1","misconception_code":null}'::jsonb),
    ('PERCENTAGE', 'MATEMATICA', 'PROBE', 'Em 200 alunos, 10% correspondem a:', '["20 alunos","10 alunos","2 alunos","100 alunos"]'::jsonb, '"20 alunos"'::jsonb, '10/100 x 200 = 20.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PROBE","content_pack":"tec-escola-core-v2","content_question_id":"percentage-2","misconception_code":null}'::jsonb),
    ('PERCENTAGE', 'MATEMATICA', 'PROBE', 'Qual número decimal representa 45%?', '["0,45","4,5","45,0","0,045"]'::jsonb, '"0,45"'::jsonb, 'Divida a porcentagem por 100.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PROBE","content_pack":"tec-escola-core-v2","content_question_id":"percentage-3","misconception_code":null}'::jsonb),
    ('PERCENTAGE', 'MATEMATICA', 'PRACTICE', 'Quanto é 25% de 80?', '["20","15","25","40"]'::jsonb, '"20"'::jsonb, 'Um quarto de 80 é 20.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"percentage-4","misconception_code":null}'::jsonb),
    ('PERCENTAGE', 'MATEMATICA', 'PRACTICE', 'Uma camisa de R$120 tem desconto de 15%. O desconto é:', '["R$18","R$15","R$102","R$105"]'::jsonb, '"R$18"'::jsonb, '0,15 x 120 = 18.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"percentage-5","misconception_code":null}'::jsonb),
    ('PERCENTAGE', 'MATEMATICA', 'PRACTICE', 'Um preço de R$50 aumenta 20%. O novo preço é:', '["R$60","R$70","R$55","R$40"]'::jsonb, '"R$60"'::jsonb, '20% de 50 é 10; 50 + 10 = 60.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"percentage-6","misconception_code":null}'::jsonb),
    ('PERCENTAGE', 'MATEMATICA', 'PRACTICE', 'Em uma turma de 40 alunos, 30 foram aprovados. A taxa de aprovação é:', '["75%","70%","30%","25%"]'::jsonb, '"75%"'::jsonb, '30/40 = 0,75 = 75%.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"percentage-7","misconception_code":null}'::jsonb),
    ('PERCENTAGE', 'MATEMATICA', 'TRANSFER', 'Uma conta de R$240 recebe 12% de taxa. Qual é o total?', '["R$268,80","R$252","R$28,80","R$228"]'::jsonb, '"R$268,80"'::jsonb, '12% de 240 é 28,80; some à conta.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"TRANSFER","content_pack":"tec-escola-core-v2","content_question_id":"percentage-8","misconception_code":null}'::jsonb),
    ('PERCENTAGE', 'MATEMATICA', 'TRANSFER', 'Uma população cai 8% de 5 000. Qual é a nova população?', '["4 600","4 920","4 000","5 008"]'::jsonb, '"4 600"'::jsonb, '8% de 5 000 é 400; subtraia 400.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"TRANSFER","content_pack":"tec-escola-core-v2","content_question_id":"percentage-9","misconception_code":null}'::jsonb),
    ('PERCENTAGE', 'MATEMATICA', 'LOCK_IN', 'Um produto passa de R$80 para R$100. O aumento percentual foi:', '["25%","20%","80%","125%"]'::jsonb, '"25%"'::jsonb, 'O aumento foi 20 sobre a base 80: 20/80 = 25%.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"LOCK_IN","content_pack":"tec-escola-core-v2","content_question_id":"percentage-10","misconception_code":null}'::jsonb),
    ('PERCENTAGE', 'MATEMATICA', 'LOCK_IN', 'Por que descontos sucessivos de 10% não equivalem a desconto único de 20%?', '["A segunda redução usa uma base já reduzida","Porque 10 + 10 é 30","Porque percentuais não podem ser somados","Porque o preço final sempre aumenta"]'::jsonb, '"A segunda redução usa uma base já reduzida"'::jsonb, 'A segunda redução é calculada sobre 90% do preço original.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"LOCK_IN","content_pack":"tec-escola-core-v2","content_question_id":"percentage-11","misconception_code":null}'::jsonb),
    ('PERCENTAGE', 'MATEMATICA', 'REVIEW', 'Para conferir se 18 é 15% de 120, devemos:', '["Calcular 0,15 x 120 e comparar com 18","Dividir 18 por 15","Somar 15 e 120","Multiplicar 15 x 120 sem dividir por 100"]'::jsonb, '"Calcular 0,15 x 120 e comparar com 18"'::jsonb, 'A forma decimal explicita a divisão por cem.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"REVIEW","content_pack":"tec-escola-core-v2","content_question_id":"percentage-12","misconception_code":null}'::jsonb),
    ('EQUATIONS', 'MATEMATICA', 'PROBE', 'Qual valor resolve x + 5 = 9?', '["4","14","5","-4"]'::jsonb, '"4"'::jsonb, 'Subtraia 5 dos dois lados.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PROBE","content_pack":"tec-escola-core-v2","content_question_id":"equations-1","misconception_code":null}'::jsonb),
    ('EQUATIONS', 'MATEMATICA', 'PROBE', 'Em 3x = 18, x vale:', '["6","15","21","54"]'::jsonb, '"6"'::jsonb, 'Divida os dois lados por 3.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PROBE","content_pack":"tec-escola-core-v2","content_question_id":"equations-2","misconception_code":null}'::jsonb),
    ('EQUATIONS', 'MATEMATICA', 'PROBE', 'Qual expressão representa ''o dobro de x mais 3''?', '["2x + 3","x + 6","2(x + 3)","x/2 + 3"]'::jsonb, '"2x + 3"'::jsonb, 'Dobro de x é 2x; depois somamos 3.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PROBE","content_pack":"tec-escola-core-v2","content_question_id":"equations-3","misconception_code":null}'::jsonb),
    ('EQUATIONS', 'MATEMATICA', 'PRACTICE', 'Qual valor resolve 2x + 4 = 10?', '["3","2","4","7"]'::jsonb, '"3"'::jsonb, '2x = 6 e x = 3.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"equations-4","misconception_code":null}'::jsonb),
    ('EQUATIONS', 'MATEMATICA', 'PRACTICE', 'Resolva 5x - 7 = 18.', '["5","3","25","11"]'::jsonb, '"5"'::jsonb, 'Some 7 e divida o resultado 25 por 5.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"equations-5","misconception_code":null}'::jsonb),
    ('EQUATIONS', 'MATEMATICA', 'PRACTICE', 'Em 4(x - 2) = 20, x vale:', '["7","5","3","18"]'::jsonb, '"7"'::jsonb, 'Divida por 4: x - 2 = 5; então x = 7.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"equations-6","misconception_code":null}'::jsonb),
    ('EQUATIONS', 'MATEMATICA', 'PRACTICE', 'A equação x/3 + 2 = 6 tem solução:', '["12","4","8","18"]'::jsonb, '"12"'::jsonb, 'Subtraia 2 e multiplique por 3.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"equations-7","misconception_code":null}'::jsonb),
    ('EQUATIONS', 'MATEMATICA', 'TRANSFER', 'Um táxi cobra R$8 fixos e R$3 por km. Uma corrida custou R$29. Quantos km foram percorridos?', '["7","9","21","3"]'::jsonb, '"7"'::jsonb, '3x + 8 = 29, então 3x = 21 e x = 7.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"TRANSFER","content_pack":"tec-escola-core-v2","content_question_id":"equations-8","misconception_code":null}'::jsonb),
    ('EQUATIONS', 'MATEMATICA', 'TRANSFER', 'A soma de um número com seu dobro é 36. Qual é o número?', '["12","18","9","24"]'::jsonb, '"12"'::jsonb, 'x + 2x = 36, logo 3x = 36.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"TRANSFER","content_pack":"tec-escola-core-v2","content_question_id":"equations-9","misconception_code":null}'::jsonb),
    ('EQUATIONS', 'MATEMATICA', 'LOCK_IN', 'Ao resolver 2(x+3)=14, qual verificação confirma x=4?', '["2(4+3)=14","2(4-3)=14","4+3=14","2x+3=14"]'::jsonb, '"2(4+3)=14"'::jsonb, 'Substituir x em toda a expressão original.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"LOCK_IN","content_pack":"tec-escola-core-v2","content_question_id":"equations-10","misconception_code":null}'::jsonb),
    ('EQUATIONS', 'MATEMATICA', 'LOCK_IN', 'Por que se subtrai 4 dos dois lados em 2x+4=10?', '["Para preservar a igualdade e deixar o termo com x isolado","Para trocar o sinal de x","Para eliminar o 10","Para dobrar a solução"]'::jsonb, '"Para preservar a igualdade e deixar o termo com x isolado"'::jsonb, 'A mesma operação nos dois lados mantém a equação equivalente.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"LOCK_IN","content_pack":"tec-escola-core-v2","content_question_id":"equations-11","misconception_code":null}'::jsonb),
    ('EQUATIONS', 'MATEMATICA', 'REVIEW', 'Qual resultado é impossível para uma equação se a substituição não produz igualdade?', '["A resposta está incorreta","A incógnita virou porcentagem","A equação deixou de ter números","Toda solução é válida"]'::jsonb, '"A resposta está incorreta"'::jsonb, 'A substituição é uma checagem direta da solução.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"REVIEW","content_pack":"tec-escola-core-v2","content_question_id":"equations-12","misconception_code":null}'::jsonb),
    ('FUNCTIONS_INTRO', 'MATEMATICA', 'PROBE', 'Em uma função, a entrada é geralmente representada por:', '["x","f(x)","o resultado","o gráfico"]'::jsonb, '"x"'::jsonb, 'x é a variável independente mais comum.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PROBE","content_pack":"tec-escola-core-v2","content_question_id":"functions_intro-1","misconception_code":null}'::jsonb),
    ('FUNCTIONS_INTRO', 'MATEMATICA', 'PROBE', 'Se f(x)=x+2, qual é f(3)?', '["5","3","6","1"]'::jsonb, '"5"'::jsonb, 'Substitua x por 3.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PROBE","content_pack":"tec-escola-core-v2","content_question_id":"functions_intro-2","misconception_code":null}'::jsonb),
    ('FUNCTIONS_INTRO', 'MATEMATICA', 'PROBE', 'Uma função associa cada entrada a:', '["Uma única saída","Duas saídas obrigatórias","Nenhuma saída","A própria entrada sempre"]'::jsonb, '"Uma única saída"'::jsonb, 'Essa é a condição que define uma função.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PROBE","content_pack":"tec-escola-core-v2","content_question_id":"functions_intro-3","misconception_code":null}'::jsonb),
    ('FUNCTIONS_INTRO', 'MATEMATICA', 'PRACTICE', 'Na tabela x=1,2,3 e f(x)=4,6,8, qual é a regra?', '["f(x)=2x+2","f(x)=x+3","f(x)=4x","f(x)=x+2"]'::jsonb, '"f(x)=2x+2"'::jsonb, 'Cada saída é o dobro da entrada mais 2.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"functions_intro-4","misconception_code":null}'::jsonb),
    ('FUNCTIONS_INTRO', 'MATEMATICA', 'PRACTICE', 'Se g(x)=3x-1, g(4) é:', '["11","12","7","3"]'::jsonb, '"11"'::jsonb, '3 x 4 - 1 = 11.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"functions_intro-5","misconception_code":null}'::jsonb),
    ('FUNCTIONS_INTRO', 'MATEMATICA', 'PRACTICE', 'Qual par pertence a f(x)=x²?', '["(3,9)","(3,6)","(2,5)","(0,1)"]'::jsonb, '"(3,9)"'::jsonb, 'O quadrado de 3 é 9.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"functions_intro-6","misconception_code":null}'::jsonb),
    ('FUNCTIONS_INTRO', 'MATEMATICA', 'PRACTICE', 'Quando a entrada aumenta 1 em f(x)=5x, a saída aumenta:', '["5","1","0","25"]'::jsonb, '"5"'::jsonb, 'O coeficiente de x é a taxa de variação.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"functions_intro-7","misconception_code":null}'::jsonb),
    ('FUNCTIONS_INTRO', 'MATEMATICA', 'TRANSFER', 'Uma tarifa é dada por T(h)=12+4h. Quanto custa usar 5 horas?', '["R$32","R$20","R$60","R$17"]'::jsonb, '"R$32"'::jsonb, 'A taxa fixa é 12 e o uso custa 4 x 5.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"TRANSFER","content_pack":"tec-escola-core-v2","content_question_id":"functions_intro-8","misconception_code":null}'::jsonb),
    ('FUNCTIONS_INTRO', 'MATEMATICA', 'TRANSFER', 'Uma relação tempo-distância tem d(t)=60t. O que 60 representa?', '["A taxa de 60 km por hora","A distância inicial","O tempo final","O número de viagens"]'::jsonb, '"A taxa de 60 km por hora"'::jsonb, 'O coeficiente liga distância e tempo.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"TRANSFER","content_pack":"tec-escola-core-v2","content_question_id":"functions_intro-9","misconception_code":null}'::jsonb),
    ('FUNCTIONS_INTRO', 'MATEMATICA', 'LOCK_IN', 'Por que uma tabela com uma entrada ligada a duas saídas diferentes não define função?', '["A unicidade da saída foi quebrada","Porque a tabela tem duas colunas","Porque x não pode ser número","Porque toda função é linear"]'::jsonb, '"A unicidade da saída foi quebrada"'::jsonb, 'Cada entrada precisa determinar uma única saída.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"LOCK_IN","content_pack":"tec-escola-core-v2","content_question_id":"functions_intro-10","misconception_code":null}'::jsonb),
    ('FUNCTIONS_INTRO', 'MATEMATICA', 'LOCK_IN', 'Em f(x)=2x+1, qual é a saída quando x=0?', '["1","0","2","-1"]'::jsonb, '"1"'::jsonb, 'O termo constante permanece quando x é zero.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"LOCK_IN","content_pack":"tec-escola-core-v2","content_question_id":"functions_intro-11","misconception_code":null}'::jsonb),
    ('FUNCTIONS_INTRO', 'MATEMATICA', 'REVIEW', 'Para verificar f(2)=9 em f(x)=4x+1, devemos:', '["Calcular 4(2)+1 e comparar com 9","Calcular 4+2+1","Dividir 9 por 2","Usar x=9"]'::jsonb, '"Calcular 4(2)+1 e comparar com 9"'::jsonb, 'Aplicar a lei da função é a checagem correta.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"REVIEW","content_pack":"tec-escola-core-v2","content_question_id":"functions_intro-12","misconception_code":null}'::jsonb),
    ('LINEAR_FUNCTION', 'MATEMATICA', 'PROBE', 'Na função f(x)=3x+2, qual é o coeficiente angular?', '["3","2","x","5"]'::jsonb, '"3"'::jsonb, 'É o número que multiplica x.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PROBE","content_pack":"tec-escola-core-v2","content_question_id":"linear_function-1","misconception_code":null}'::jsonb),
    ('LINEAR_FUNCTION', 'MATEMATICA', 'PROBE', 'Em f(x)=4x+7, f(0) vale:', '["7","4","0","11"]'::jsonb, '"7"'::jsonb, 'O valor inicial é o termo independente.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PROBE","content_pack":"tec-escola-core-v2","content_question_id":"linear_function-2","misconception_code":null}'::jsonb),
    ('LINEAR_FUNCTION', 'MATEMATICA', 'PROBE', 'Qual expressão é uma função afim?', '["2x+5","x²+1","1/x","raiz de x"]'::jsonb, '"2x+5"'::jsonb, 'A forma ax+b tem x apenas no primeiro grau.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PROBE","content_pack":"tec-escola-core-v2","content_question_id":"linear_function-3","misconception_code":null}'::jsonb),
    ('LINEAR_FUNCTION', 'MATEMATICA', 'PRACTICE', 'Na função f(x)=2x+1, qual é f(3)?', '["7","5","6","9"]'::jsonb, '"7"'::jsonb, '2 x 3 + 1 = 7.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"linear_function-4","misconception_code":null}'::jsonb),
    ('LINEAR_FUNCTION', 'MATEMATICA', 'PRACTICE', 'O gráfico de f(x)=-x+4 é decrescente porque:', '["O coeficiente de x é negativo","O termo constante é 4","x aparece uma vez","A função tem gráfico"]'::jsonb, '"O coeficiente de x é negativo"'::jsonb, 'A saída diminui quando x aumenta.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"linear_function-5","misconception_code":null}'::jsonb),
    ('LINEAR_FUNCTION', 'MATEMATICA', 'PRACTICE', 'Qual é a raiz de f(x)=2x-6?', '["3","-3","6","2"]'::jsonb, '"3"'::jsonb, 'Faça 2x-6=0.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"linear_function-6","misconception_code":null}'::jsonb),
    ('LINEAR_FUNCTION', 'MATEMATICA', 'PRACTICE', 'Uma função passa por (0,5) e (1,8). Sua taxa de variação é:', '["3","5","8","13"]'::jsonb, '"3"'::jsonb, 'A saída aumentou 3 quando a entrada aumentou 1.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"linear_function-7","misconception_code":null}'::jsonb),
    ('LINEAR_FUNCTION', 'MATEMATICA', 'TRANSFER', 'Um estacionamento cobra R$10 de entrada e R$4 por hora. Após 6 horas, o custo é:', '["R$34","R$24","R$60","R$14"]'::jsonb, '"R$34"'::jsonb, 'C(h)=10+4h; C(6)=34.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"TRANSFER","content_pack":"tec-escola-core-v2","content_question_id":"linear_function-8","misconception_code":null}'::jsonb),
    ('LINEAR_FUNCTION', 'MATEMATICA', 'TRANSFER', 'Uma planta mede 12 cm e cresce 2 cm por semana. Após 9 semanas, mede:', '["30 cm","18 cm","21 cm","24 cm"]'::jsonb, '"30 cm"'::jsonb, 'P(t)=12+2t; P(9)=30.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"TRANSFER","content_pack":"tec-escola-core-v2","content_question_id":"linear_function-9","misconception_code":null}'::jsonb),
    ('LINEAR_FUNCTION', 'MATEMATICA', 'LOCK_IN', 'Em um gráfico, o ponto onde a reta cruza o eixo y representa:', '["O valor inicial b","A raiz sempre","A inclinação a","O maior x"]'::jsonb, '"O valor inicial b"'::jsonb, 'No eixo y, x=0; resta o termo b.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"LOCK_IN","content_pack":"tec-escola-core-v2","content_question_id":"linear_function-10","misconception_code":null}'::jsonb),
    ('LINEAR_FUNCTION', 'MATEMATICA', 'LOCK_IN', 'Se f(x)=5x-10, aumentar x em 2 aumenta f(x) em:', '["10","2","5","-10"]'::jsonb, '"10"'::jsonb, 'A variação é a x 2 = 5 x 2.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"LOCK_IN","content_pack":"tec-escola-core-v2","content_question_id":"linear_function-11","misconception_code":null}'::jsonb),
    ('LINEAR_FUNCTION', 'MATEMATICA', 'REVIEW', 'Para decidir se f(x)=3x+1 modela um custo, devemos verificar:', '["Se há valor inicial 1 e aumento constante de 3 por unidade","Somente se x é positivo","Se o gráfico é uma curva","Se o custo sempre é zero"]'::jsonb, '"Se há valor inicial 1 e aumento constante de 3 por unidade"'::jsonb, 'O modelo precisa corresponder às duas partes da situação.', 'TECESCOLA_CORE_V2_MATEMATICA', '{"adaptive_v2_purpose":"REVIEW","content_pack":"tec-escola-core-v2","content_question_id":"linear_function-12","misconception_code":null}'::jsonb),
    ('READING_ARGUMENT', 'LINGUAGENS', 'PROBE', 'Em um texto de opinião, a tese é:', '["A posição central defendida pelo autor","A quantidade de parágrafos","A fonte da tinta","O nome do leitor"]'::jsonb, '"A posição central defendida pelo autor"'::jsonb, 'A tese responde ao que o autor quer defender.', 'TECESCOLA_CORE_V2_PORTUGUES', '{"adaptive_v2_purpose":"PROBE","content_pack":"tec-escola-core-v2","content_question_id":"reading_argument-1","misconception_code":null}'::jsonb),
    ('READING_ARGUMENT', 'LINGUAGENS', 'PROBE', 'Qual elemento melhor sustenta uma afirmação sobre transporte público?', '["Dados de tempo de espera coletados em pesquisa","Uma cor favorita","O tamanho do título","Uma palavra repetida"]'::jsonb, '"Dados de tempo de espera coletados em pesquisa"'::jsonb, 'A evidência precisa se relacionar verificavelmente à afirmação.', 'TECESCOLA_CORE_V2_PORTUGUES', '{"adaptive_v2_purpose":"PROBE","content_pack":"tec-escola-core-v2","content_question_id":"reading_argument-2","misconception_code":null}'::jsonb),
    ('READING_ARGUMENT', 'LINGUAGENS', 'PRACTICE', 'A expressão ''por isso'' em um argumento costuma introduzir:', '["Uma consequência ou conclusão","Uma comparação de tamanho","Uma personagem","Uma definição de cor"]'::jsonb, '"Uma consequência ou conclusão"'::jsonb, 'O conectivo indica relação lógica entre ideias.', 'TECESCOLA_CORE_V2_PORTUGUES', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"reading_argument-3","misconception_code":null}'::jsonb),
    ('READING_ARGUMENT', 'LINGUAGENS', 'PRACTICE', 'Se o autor afirma ''a escola deve plantar árvores'' e cita a redução da temperatura no pátio, o dado é:', '["Uma evidência para a proposta","A tese contrária","O título","Uma saudação"]'::jsonb, '"Uma evidência para a proposta"'::jsonb, 'O dado apoia a relação entre árvores e conforto térmico.', 'TECESCOLA_CORE_V2_PORTUGUES', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"reading_argument-4","misconception_code":null}'::jsonb),
    ('READING_ARGUMENT', 'LINGUAGENS', 'PRACTICE', 'Qual pergunta ajuda a localizar a tese?', '["Qual posição o autor quer que o leitor aceite?","Quantas letras há no texto?","Quem imprimiu a folha?","Qual fonte foi usada?"]'::jsonb, '"Qual posição o autor quer que o leitor aceite?"'::jsonb, 'A pergunta busca a posição defendida.', 'TECESCOLA_CORE_V2_PORTUGUES', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"reading_argument-5","misconception_code":null}'::jsonb),
    ('READING_ARGUMENT', 'LINGUAGENS', 'TRANSFER', 'Um artigo defende hortas escolares e cita que alunos passaram a consumir mais verduras. Esse trecho funciona como:', '["Evidência relacionada à tese","Tema sem relação","Conclusão obrigatória","Título"]'::jsonb, '"Evidência relacionada à tese"'::jsonb, 'O dado torna a defesa mais concreta.', 'TECESCOLA_CORE_V2_PORTUGUES', '{"adaptive_v2_purpose":"TRANSFER","content_pack":"tec-escola-core-v2","content_question_id":"reading_argument-6","misconception_code":null}'::jsonb),
    ('READING_ARGUMENT', 'LINGUAGENS', 'LOCK_IN', 'Por que um exemplo isolado não prova sozinho uma tese geral?', '["Ele pode ilustrar, mas não representa necessariamente todos os casos","Porque exemplos não têm palavras","Porque toda tese é falsa","Porque dados só servem para títulos"]'::jsonb, '"Ele pode ilustrar, mas não representa necessariamente todos os casos"'::jsonb, 'A força da evidência depende da relação e do alcance da afirmação.', 'TECESCOLA_CORE_V2_PORTUGUES', '{"adaptive_v2_purpose":"LOCK_IN","content_pack":"tec-escola-core-v2","content_question_id":"reading_argument-7","misconception_code":null}'::jsonb),
    ('READING_ARGUMENT', 'LINGUAGENS', 'REVIEW', 'Para avaliar um argumento, é importante verificar:', '["Se a evidência realmente sustenta a tese","Somente o tamanho do texto","A cor do papel","O número de vírgulas"]'::jsonb, '"Se a evidência realmente sustenta a tese"'::jsonb, 'A relação entre tese e evidência é o núcleo da análise.', 'TECESCOLA_CORE_V2_PORTUGUES', '{"adaptive_v2_purpose":"REVIEW","content_pack":"tec-escola-core-v2","content_question_id":"reading_argument-8","misconception_code":null}'::jsonb),
    ('READING_INFERENCE', 'LINGUAGENS', 'PROBE', 'Inferir em um texto significa:', '["Concluir algo a partir de pistas e conhecimentos pertinentes","Copiar a primeira palavra","Ignorar o texto","Inventar qualquer final"]'::jsonb, '"Concluir algo a partir de pistas e conhecimentos pertinentes"'::jsonb, 'A inferência precisa ser sustentada por pistas.', 'TECESCOLA_CORE_V2_PORTUGUES', '{"adaptive_v2_purpose":"PROBE","content_pack":"tec-escola-core-v2","content_question_id":"reading_inference-1","misconception_code":null}'::jsonb),
    ('READING_INFERENCE', 'LINGUAGENS', 'PROBE', 'Se o personagem fechou o casaco e tremeu, é razoável inferir que:', '["Ele sentiu frio","Ele estava com fome","Era meio-dia","Ele comprou um livro"]'::jsonb, '"Ele sentiu frio"'::jsonb, 'As ações funcionam como pistas do estado do personagem.', 'TECESCOLA_CORE_V2_PORTUGUES', '{"adaptive_v2_purpose":"PROBE","content_pack":"tec-escola-core-v2","content_question_id":"reading_inference-2","misconception_code":null}'::jsonb),
    ('READING_INFERENCE', 'LINGUAGENS', 'PRACTICE', 'A frase ''a rua estava molhada e havia guarda-chuvas abertos'' sugere:', '["Que choveu ou estava chovendo","Que fazia muito calor","Que a rua estava vazia","Que era feriado"]'::jsonb, '"Que choveu ou estava chovendo"'::jsonb, 'As duas pistas apontam para chuva.', 'TECESCOLA_CORE_V2_PORTUGUES', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"reading_inference-3","misconception_code":null}'::jsonb),
    ('READING_INFERENCE', 'LINGUAGENS', 'PRACTICE', 'Se Ana apagou as luzes, trancou a porta e saiu, podemos concluir que:', '["Ela deixou o local","Ela começou uma festa","Ela estava cozinhando","Ela perdeu a chave"]'::jsonb, '"Ela deixou o local"'::jsonb, 'As ações encadeadas indicam saída, embora o texto não diga literalmente.', 'TECESCOLA_CORE_V2_PORTUGUES', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"reading_inference-4","misconception_code":null}'::jsonb),
    ('READING_INFERENCE', 'LINGUAGENS', 'PRACTICE', 'Uma inferência forte deve:', '["Combinar pistas do texto sem contradizê-las","Depender só de opinião","Ignorar o contexto","Repetir o título"]'::jsonb, '"Combinar pistas do texto sem contradizê-las"'::jsonb, 'A coerência com as pistas evita interpretações arbitrárias.', 'TECESCOLA_CORE_V2_PORTUGUES', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"reading_inference-5","misconception_code":null}'::jsonb),
    ('READING_INFERENCE', 'LINGUAGENS', 'TRANSFER', 'O texto diz que a praça amanheceu coberta de folhas e galhos. A inferência mais apoiada é:', '["Houve vento forte ou tempestade durante a noite","A praça recebeu um prêmio","As árvores foram pintadas","Era dia de feira"]'::jsonb, '"Houve vento forte ou tempestade durante a noite"'::jsonb, 'Folhas e galhos espalhados são pistas de vento ou tempestade.', 'TECESCOLA_CORE_V2_PORTUGUES', '{"adaptive_v2_purpose":"TRANSFER","content_pack":"tec-escola-core-v2","content_question_id":"reading_inference-6","misconception_code":null}'::jsonb),
    ('READING_INFERENCE', 'LINGUAGENS', 'LOCK_IN', 'Por que duas inferências podem ser possíveis, mas uma ser melhor?', '["A melhor tem mais pistas textuais a favor","A melhor é sempre a mais longa","A pior usa mais palavras","Toda interpretação tem a mesma prova"]'::jsonb, '"A melhor tem mais pistas textuais a favor"'::jsonb, 'A qualidade depende do suporte encontrado no texto.', 'TECESCOLA_CORE_V2_PORTUGUES', '{"adaptive_v2_purpose":"LOCK_IN","content_pack":"tec-escola-core-v2","content_question_id":"reading_inference-7","misconception_code":null}'::jsonb),
    ('READING_INFERENCE', 'LINGUAGENS', 'REVIEW', 'Ao revisar uma inferência, pergunte:', '["Qual trecho sustenta minha conclusão?","Qual é minha cor preferida?","Quantas páginas tem o livro?","Quem digitou o texto?"]'::jsonb, '"Qual trecho sustenta minha conclusão?"'::jsonb, 'Essa pergunta separa inferência de palpite.', 'TECESCOLA_CORE_V2_PORTUGUES', '{"adaptive_v2_purpose":"REVIEW","content_pack":"tec-escola-core-v2","content_question_id":"reading_inference-8","misconception_code":null}'::jsonb),
    ('TEXTUAL_COHESION', 'LINGUAGENS', 'PROBE', 'Qual conectivo indica consequência?', '["por isso","porém","embora","enquanto"]'::jsonb, '"por isso"'::jsonb, 'Por isso apresenta um resultado decorrente da ideia anterior.', 'TECESCOLA_CORE_V2_PORTUGUES', '{"adaptive_v2_purpose":"PROBE","content_pack":"tec-escola-core-v2","content_question_id":"textual_cohesion-1","misconception_code":null}'::jsonb),
    ('TEXTUAL_COHESION', 'LINGUAGENS', 'PROBE', 'Em ''Lucas pegou o livro e o abriu'', o pronome ''o'' retoma:', '["livro","Lucas","pegou","abriu"]'::jsonb, '"livro"'::jsonb, 'O pronome evita repetir o termo já apresentado.', 'TECESCOLA_CORE_V2_PORTUGUES', '{"adaptive_v2_purpose":"PROBE","content_pack":"tec-escola-core-v2","content_question_id":"textual_cohesion-2","misconception_code":null}'::jsonb),
    ('TEXTUAL_COHESION', 'LINGUAGENS', 'PRACTICE', 'Complete: ''Estudou bastante; ___, conseguiu melhorar''.', '["por isso","embora","porém","enquanto"]'::jsonb, '"por isso"'::jsonb, 'A segunda oração é consequência da primeira.', 'TECESCOLA_CORE_V2_PORTUGUES', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"textual_cohesion-3","misconception_code":null}'::jsonb),
    ('TEXTUAL_COHESION', 'LINGUAGENS', 'PRACTICE', 'Complete: ''Queria sair, ___ estava chovendo''.', '["mas","portanto","porque","assim"]'::jsonb, '"mas"'::jsonb, 'Mas introduz oposição à expectativa anterior.', 'TECESCOLA_CORE_V2_PORTUGUES', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"textual_cohesion-4","misconception_code":null}'::jsonb),
    ('TEXTUAL_COHESION', 'LINGUAGENS', 'PRACTICE', 'Qual palavra retoma melhor ''as crianças''?', '["elas","ele","isso","onde"]'::jsonb, '"elas"'::jsonb, 'O pronome deve concordar em gênero e número.', 'TECESCOLA_CORE_V2_PORTUGUES', '{"adaptive_v2_purpose":"PRACTICE","content_pack":"tec-escola-core-v2","content_question_id":"textual_cohesion-5","misconception_code":null}'::jsonb),
    ('TEXTUAL_COHESION', 'LINGUAGENS', 'TRANSFER', 'Em ''A biblioteca ampliou o horário. Essa mudança ajudou os estudantes'', ''essa mudança'' retoma:', '["A ampliação do horário","A biblioteca como prédio","Os estudantes","Uma opinião futura"]'::jsonb, '"A ampliação do horário"'::jsonb, 'A expressão resume a ação da frase anterior.', 'TECESCOLA_CORE_V2_PORTUGUES', '{"adaptive_v2_purpose":"TRANSFER","content_pack":"tec-escola-core-v2","content_question_id":"textual_cohesion-6","misconception_code":null}'::jsonb),
    ('TEXTUAL_COHESION', 'LINGUAGENS', 'LOCK_IN', 'Por que trocar ''portanto'' por ''porém'' pode mudar o sentido?', '["Um indica conclusão e o outro indica oposição","As duas palavras são sinônimas","Porque um é verbo","Porque conectivos não têm função"]'::jsonb, '"Um indica conclusão e o outro indica oposição"'::jsonb, 'A escolha do conectivo define a relação entre ideias.', 'TECESCOLA_CORE_V2_PORTUGUES', '{"adaptive_v2_purpose":"LOCK_IN","content_pack":"tec-escola-core-v2","content_question_id":"textual_cohesion-7","misconception_code":null}'::jsonb),
    ('TEXTUAL_COHESION', 'LINGUAGENS', 'REVIEW', 'Para revisar a coesão de um parágrafo, verifique:', '["Se pronomes e conectivos deixam claras as relações e retomadas","Somente o número de linhas","A cor do título","A ordem alfabética das palavras"]'::jsonb, '"Se pronomes e conectivos deixam claras as relações e retomadas"'::jsonb, 'A clareza das conexões é o critério relevante.', 'TECESCOLA_CORE_V2_PORTUGUES', '{"adaptive_v2_purpose":"REVIEW","content_pack":"tec-escola-core-v2","content_question_id":"textual_cohesion-8","misconception_code":null}'::jsonb)
  ) as question_row(skill_code, subject_area, purpose, statement, options, correct_answer, explanation, provenance, metadata)
  loop
    select canonical.id into skill_id from public.learning_curriculum_skills canonical join public.learning_curriculum_catalogs catalog on catalog.id = canonical.catalog_id
     where catalog.code = 'TECESCOLA_CORE' and catalog.version = '1.0' and canonical.code = item.skill_code and canonical.active limit 1;
    select question.id into question_id from public.learning_question_bank question where question.source_type = 'TECESCOLA_CORE_V2' and question.statement = item.statement limit 1;
    if question_id is null then
      insert into public.learning_question_bank(package_type, source_type, source_name, subject_area, domain, topic, statement, options, correct_answer, explanation, difficulty, estimated_minutes, provenance, metadata, active)
      values ('TECESCOLA', 'TECESCOLA_CORE_V2', 'TecEscola Core V2', item.subject_area, item.subject_area, item.skill_code, item.statement, item.options, item.correct_answer, item.explanation, 'MEDIUM', 3, item.provenance, item.metadata, true) returning id into question_id;
    else
      update public.learning_question_bank set options = item.options, correct_answer = item.correct_answer, explanation = item.explanation, provenance = item.provenance, metadata = item.metadata, active = true, updated_at = now() where id = question_id;
    end if;
    insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role) values (question_id, skill_id, 'PRIMARY') on conflict (question_bank_id, canonical_skill_id) do nothing;
  end loop;

  for item in select * from (values
    ('LINEAR_FUNCTION', 'EQUATIONS')
  ) as prerequisite_row(skill_code, prerequisite_code)
  loop
    select canonical.id into skill_id from public.learning_curriculum_skills canonical join public.learning_curriculum_catalogs catalog on catalog.id = canonical.catalog_id
     where catalog.code = 'TECESCOLA_CORE' and catalog.version = '1.0' and canonical.code = item.skill_code and canonical.active limit 1;
    select canonical.id into prerequisite_id from public.learning_curriculum_skills canonical join public.learning_curriculum_catalogs catalog on catalog.id = canonical.catalog_id
     where catalog.code = 'TECESCOLA_CORE' and catalog.version = '1.0' and canonical.code = item.prerequisite_code and canonical.active limit 1;
    if skill_id is null or prerequisite_id is null then raise exception 'TECESCOLA_V2_PREREQUISITE_MISSING:%:%', item.skill_code, item.prerequisite_code; end if;
    insert into public.learning_skill_prerequisites(skill_id, prerequisite_skill_id) values (skill_id, prerequisite_id) on conflict do nothing;
  end loop;

  for skill_row in select distinct canonical.id, canonical.code from public.learning_curriculum_skills canonical join public.learning_curriculum_catalogs catalog on catalog.id = canonical.catalog_id where catalog.code = 'TECESCOLA_CORE' and catalog.version = '1.0' and canonical.code in ('FRACTIONS', 'RATIO_PROPORTION', 'PERCENTAGE', 'EQUATIONS', 'FUNCTIONS_INTRO', 'LINEAR_FUNCTION', 'READING_ARGUMENT', 'READING_INFERENCE', 'TEXTUAL_COHESION')
  loop
    for purpose_row in select purpose from (values ('PROBE'), ('PRACTICE'), ('TRANSFER'), ('LOCK_IN'), ('REVIEW')) as purposes(purpose)
    loop
      select question_set.id into set_id from public.learning_question_sets question_set where question_set.scope = 'GLOBAL' and question_set.canonical_skill_id = skill_row.id and question_set.purpose = purpose_row.purpose and question_set.version = 2 limit 1;
      if set_id is null then
        insert into public.learning_question_sets(scope, canonical_skill_id, purpose, version, metadata) values ('GLOBAL', skill_row.id, purpose_row.purpose, 2, jsonb_build_object('content_pack', 'tec-escola-core-v2')) returning id into set_id;
      end if;
      delete from public.learning_question_set_items where question_set_id = set_id;
      position_index := 0;
      for question_row in select question.id from public.learning_question_bank question join public.learning_question_bank_skill_links link on link.question_bank_id = question.id where link.canonical_skill_id = skill_row.id and question.source_type = 'TECESCOLA_CORE_V2' and question.metadata->>'adaptive_v2_purpose' = purpose_row.purpose and question.active order by question.metadata->>'content_question_id', question.id
      loop
        insert into public.learning_question_set_items(question_set_id, question_bank_id, position) values (set_id, question_row.id, position_index);
        position_index := position_index + 1;
      end loop;
      if position_index = 0 then raise exception 'TECESCOLA_V2_PURPOSE_SET_EMPTY:%:%', skill_row.code, purpose_row.purpose; end if;
    end loop;
  end loop;
end;
$seed$;
alter table public.learning_question_sets enable row level security;
alter table public.learning_question_set_items enable row level security;
alter table public.learning_guided_session_events enable row level security;
alter table public.learning_guided_step_attempts enable row level security;

create policy learning_question_sets_select on public.learning_question_sets for select to authenticated using (
  active and (scope = 'GLOBAL' or public.can_access_institution(institution_id) or teacher_profile_id = auth.uid())
);
create policy learning_question_set_items_select on public.learning_question_set_items for select to authenticated using (
  exists (select 1 from public.learning_question_sets set_row where set_row.id = question_set_id and set_row.active and (set_row.scope = 'GLOBAL' or public.can_access_institution(set_row.institution_id) or set_row.teacher_profile_id = auth.uid()))
);
create policy learning_guided_session_events_select on public.learning_guided_session_events for select to authenticated using (
  private.learning_student_owns_state(institution_id, student_id) or public.can_manage_institution_operations(institution_id)
);
create policy learning_guided_step_attempts_select on public.learning_guided_step_attempts for select to authenticated using (
  private.learning_student_owns_state(institution_id, student_id) or public.can_manage_institution_operations(institution_id)
);

-- Students never need the answer key from the question-bank table. Teachers
-- receive authoring fields through this scoped RPC instead of a broad table
-- grant, while the guided-step RPC above exposes only pre-submit content.
create or replace function public.list_teacher_learning_question_bank(p_institution_id uuid)
returns table(
  id uuid,
  package_type text,
  source_type text,
  source_name text,
  source_year integer,
  subject_area text,
  topic text,
  statement text,
  options jsonb,
  correct_answer jsonb,
  explanation text,
  difficulty text
)
language sql stable security definer set search_path = ''
as $$
  select question.id, question.package_type, question.source_type, question.source_name,
         question.source_year, question.subject_area, question.topic, question.statement,
         question.options, question.correct_answer, question.explanation, question.difficulty
    from public.learning_question_bank question
   where question.active
     and (
       (question.institution_id is null and question.package_type in ('TECESCOLA', 'ENEM'))
       or (question.institution_id = p_institution_id and public.can_access_institution(p_institution_id))
     )
   order by question.created_at desc
   limit 100;
$$;

revoke all on table public.learning_question_sets, public.learning_question_set_items, public.learning_guided_session_events, public.learning_guided_step_attempts from anon;
grant select on table public.learning_question_sets, public.learning_question_set_items, public.learning_guided_session_events, public.learning_guided_step_attempts to authenticated;
grant all on table public.learning_question_sets, public.learning_question_set_items, public.learning_guided_session_events, public.learning_guided_step_attempts to service_role;
revoke select on table public.learning_question_bank from authenticated;
grant select (
  id, institution_id, owner_profile_id, package_type, source_type, source_name, source_year,
  source_exam, source_application, source_day, source_number, subject_area, domain, topic,
  subtopic, statement, options, difficulty, estimated_minutes, provenance, source_reference,
  metadata, active, version, created_at, updated_at
) on table public.learning_question_bank to authenticated;
revoke all on function private.learning_v2_scope_student(uuid, uuid), private.pick_learning_question_set_v2(uuid, uuid, uuid, text), private.refresh_learning_student_skill_state_v2(uuid, uuid, uuid), private.pick_learning_v2_next_skill(uuid, uuid, uuid), private.append_guided_v2_next_step(public.learning_guided_sessions, public.learning_guided_steps, text, text) from public, anon, authenticated;
revoke all on function public.start_guided_learning_session_v2(uuid, uuid, uuid), public.get_guided_learning_session_v2(uuid, uuid), public.get_guided_learning_step_v2(uuid), public.advance_guided_learning_session_v2(uuid, uuid, text, text), public.submit_guided_learning_step_v2(uuid, jsonb, text) from public, anon;
grant execute on function public.start_guided_learning_session_v2(uuid, uuid, uuid), public.get_guided_learning_session_v2(uuid, uuid), public.get_guided_learning_step_v2(uuid), public.advance_guided_learning_session_v2(uuid, uuid, text, text), public.submit_guided_learning_step_v2(uuid, jsonb, text) to authenticated;
revoke all on function public.list_teacher_learning_question_bank(uuid) from public, anon;
grant execute on function public.list_teacher_learning_question_bank(uuid) to authenticated;
revoke all on function public.get_teacher_guided_learning_insights_v2(uuid), public.resolve_teacher_guided_learning_session_v2(uuid, text, uuid) from public, anon;
grant execute on function public.get_teacher_guided_learning_insights_v2(uuid), public.resolve_teacher_guided_learning_session_v2(uuid, text, uuid) to authenticated;

-- The old self-reported score path cannot mint V2 evidence or mastery.
create or replace function public.complete_learning_skill_review(p_review_id uuid, p_score integer)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  raise exception 'LEARNING_REVIEW_REQUIRES_REAL_QUESTIONS';
end;
$$;

notify pgrst, 'reload schema';
commit;
