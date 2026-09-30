begin;

-- Adaptive Learning V2 is an additive, server-planned journey. Existing V1
-- sessions remain readable and callable for legacy installations.
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
         count(*) filter (where evidence.source in ('LOCK_IN', 'REVIEW'))::integer,
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
      if next_skill is null then
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
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', question.id, 'statement', question.statement, 'options', question.options, 'difficulty', question.difficulty, 'position', item.position) order by item.position) from public.learning_question_set_items item join public.learning_question_bank question on question.id = item.question_bank_id and question.active where item.question_set_id = step_row.question_set_id), '[]'::jsonb)
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
  for item in select bank.id, bank.correct_answer, bank.explanation, set_item.position from public.learning_question_set_items set_item join public.learning_question_bank bank on bank.id = set_item.question_bank_id and bank.active where set_item.question_set_id = step_row.question_set_id order by set_item.position loop
    total := total + 1;
    select value into answer_item from jsonb_array_elements(p_answers) value where value->>'question_bank_id' = item.id::text limit 1;
    submitted := coalesce(answer_item->'answer', 'null'::jsonb);
    expected := coalesce(item.correct_answer, 'null'::jsonb);
    correct := submitted = expected;
    if correct then correct_count := correct_count + 1; end if;
    feedback := feedback || jsonb_build_array(jsonb_build_object('question_bank_id', item.id, 'is_correct', correct, 'correct_answer', item.correct_answer, 'explanation', item.explanation));
  end loop;
  if total = 0 then raise exception 'LEARNING_GUIDED_QUESTION_SET_EMPTY'; end if;
  score := round((correct_count::numeric / total::numeric) * 100, 2);
  insert into public.learning_guided_step_attempts(institution_id, session_id, step_id, student_id, purpose, answers, feedback, score, correct_count, total_questions, idempotency_key)
  values (session_row.institution_id, session_row.id, step_row.id, session_row.student_id, step_row.purpose, p_answers, feedback, score, correct_count, total, p_idempotency_key) returning id into attempt_id;
  insert into public.learning_skill_evidence(institution_id, student_id, canonical_skill_id, source, correct, score, metadata)
  values (session_row.institution_id, session_row.student_id, step_row.canonical_skill_id,
    case step_row.purpose when 'PROBE' then 'DIAGNOSTIC' when 'TRANSFER' then 'PRACTICE' else step_row.purpose end,
    score >= 80, score, jsonb_build_object('engine_version', 'V2', 'guided_step_id', step_row.id, 'guided_attempt_id', attempt_id, 'purpose', step_row.purpose));
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
  replan_count integer
)
language sql stable security definer set search_path = ''
as $$
  select session.id, session.student_id, profile.full_name, session.class_id, session.subject_id,
         session.target_canonical_skill_id, session.status, session.decision_reason, session.replan_count
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

-- Global sets are a safe fallback over the existing bank. They are only
-- created when the skill already has linked, active questions.
do $$
declare skill_row record; purpose_row text; set_id uuid; question_row record; position_index integer;
begin
  for skill_row in select distinct link.canonical_skill_id from public.learning_question_bank_skill_links link join public.learning_question_bank bank on bank.id = link.question_bank_id and bank.active where bank.institution_id is null loop
    foreach purpose_row in array array['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'] loop
      select id into set_id from public.learning_question_sets where scope = 'GLOBAL' and canonical_skill_id = skill_row.canonical_skill_id and purpose = purpose_row and version = 1 limit 1;
      if set_id is null then insert into public.learning_question_sets(scope, canonical_skill_id, purpose, version, metadata) values ('GLOBAL', skill_row.canonical_skill_id, purpose_row, 1, jsonb_build_object('fallback', true)) returning id into set_id; end if;
      position_index := 0;
      for question_row in select link.question_bank_id from public.learning_question_bank_skill_links link join public.learning_question_bank bank on bank.id = link.question_bank_id and bank.active where link.canonical_skill_id = skill_row.canonical_skill_id and bank.institution_id is null order by bank.difficulty nulls last, bank.created_at, bank.id limit 5 loop
        insert into public.learning_question_set_items(question_set_id, question_bank_id, position) values (set_id, question_row.question_bank_id, position_index) on conflict (question_set_id, question_bank_id) do nothing;
        position_index := position_index + 1;
      end loop;
    end loop;
  end loop;
end;
$$;

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
