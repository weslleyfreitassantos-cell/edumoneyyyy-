begin;

-- Align the public discovery and start wrapper with the V8 demonstration pack.
-- The exception remains backend-only, institution-scoped, and limited to the
-- four CONTENT_READY skills that are still awaiting pedagogical review.
create or replace function public.list_student_guided_learning_targets(
  p_institution_id uuid,
  p_student_id uuid
)
returns table(
  target_canonical_skill_id uuid,
  subject_id uuid,
  catalog_id uuid,
  catalog_code text,
  official_code text,
  title text,
  subject_area text,
  stage text,
  grade_level smallint,
  availability_status text,
  progress numeric,
  has_lesson boolean,
  question_count integer,
  active_session_id uuid,
  active_session_status text,
  reason text
)
language sql
stable
security definer
set search_path = ''
as $$
  with access as (
    select private.bncc_demo_preview_allowed(p_institution_id, p_student_id) as demo_allowed
  ), enrollment_context as (
    select distinct on (enrollment.student_id, enrollment.class_id)
      enrollment.student_id,
      enrollment.class_id,
      normalized.value->>'stage' as stage,
      nullif(normalized.value->>'grade_level', '')::smallint as parsed_grade
    from public.enrollments enrollment
    join public.classes class
      on class.id = enrollment.class_id
     and class.institution_id = p_institution_id
     and class.active
    cross join lateral private.normalize_learning_grade_context(class.grade_level) normalized(value)
    where enrollment.student_id = p_student_id
      and enrollment.active
      and upper(enrollment.status::text) = 'ACTIVE'
    order by enrollment.student_id, enrollment.class_id, enrollment.updated_at desc
  ), skills as (
    select distinct
      skill.id,
      null::uuid as subject_id,
      skill.catalog_id,
      catalog.code as catalog_code,
      skill.metadata->>'official_code' as official_code,
      skill.title,
      skill.subject_area,
      target.stage,
      target.grade_level,
      skill.content_readiness,
      skill.mastery_targetable,
      skill.publication_status,
      access.demo_allowed
        and skill.publication_status = 'STAGING'
        and skill.content_readiness = 'CONTENT_READY'
        and not skill.mastery_targetable
        and skill.metadata->>'content_pack' = 'TECESCOLA_BNCC_DEEP_LEARNING_V8' as demo_preview,
      (select count(*)::integer
         from public.learning_skill_lessons lesson
        where lesson.canonical_skill_id = skill.id
          and lesson.active
          and lesson.version = (select max(latest.version)
                                  from public.learning_skill_lessons latest
                                 where latest.canonical_skill_id = skill.id
                                   and latest.active)) > 0 as has_lesson,
      (select count(*)::integer
         from public.learning_question_set_items item
         join public.learning_question_sets question_set
           on question_set.id = item.question_set_id
          and question_set.scope = 'GLOBAL'
          and question_set.active
          and question_set.version = (select max(latest.version)
                                        from public.learning_question_sets latest
                                       where latest.canonical_skill_id = skill.id
                                         and latest.scope = 'GLOBAL'
                                         and latest.active)
        where question_set.canonical_skill_id = skill.id) as question_count,
      state.mastery_estimate as progress,
      session.id as active_session_id,
      session.status as active_session_status
    from enrollment_context context
    cross join access
    join public.learning_curriculum_grade_targets target
      on target.stage = context.stage
     and target.grade_level = context.parsed_grade
     and target.active
    join public.learning_curriculum_skills skill
      on skill.id = target.canonical_skill_id
     and skill.active
     and skill.node_kind = 'LEAF'
     and (
       skill.bncc_alignment_status = 'MAPPED'
       or (
         access.demo_allowed
         and skill.bncc_alignment_status = 'CANDIDATE'
         and skill.publication_status = 'STAGING'
         and skill.content_readiness = 'CONTENT_READY'
         and not skill.mastery_targetable
         and skill.metadata->>'content_pack' = 'TECESCOLA_BNCC_DEEP_LEARNING_V8'
       )
     )
     and (
       skill.publication_status = 'PUBLISHED'
       or (
         access.demo_allowed
         and skill.publication_status = 'STAGING'
         and skill.content_readiness = 'CONTENT_READY'
         and not skill.mastery_targetable
         and skill.metadata->>'content_pack' = 'TECESCOLA_BNCC_DEEP_LEARNING_V8'
       )
     )
    join public.learning_curriculum_catalogs catalog
      on catalog.id = skill.catalog_id
     and catalog.active
     and catalog.code = 'BNCC_2018'
    left join public.learning_student_skill_state state
      on state.institution_id = p_institution_id
     and state.student_id = p_student_id
     and state.canonical_skill_id = skill.id
    left join lateral (
      select guided.id, guided.status
        from public.learning_guided_sessions guided
       where guided.institution_id = p_institution_id
         and guided.student_id = p_student_id
         and guided.target_canonical_skill_id = skill.id
         and guided.status in ('ACTIVE', 'PAUSED')
       order by guided.updated_at desc
       limit 1
    ) session on true
    where context.stage is not null
      and context.parsed_grade is not null
  )
  select skills.id,
         skills.subject_id,
         skills.catalog_id,
         skills.catalog_code,
         skills.official_code,
         skills.title,
         skills.subject_area,
         skills.stage,
         skills.grade_level,
         case
           when skills.demo_preview and skills.has_lesson and skills.question_count > 0 then 'DEMO_PREVIEW'
           when skills.content_readiness <> 'ADAPTIVE_READY' or not skills.has_lesson then 'NO_LESSON'
           when skills.question_count = 0 then 'NO_QUESTIONS'
           when skills.active_session_id is null then 'NO_ACTIVE_SESSION'
           else 'READY'
         end,
         coalesce(skills.progress, 0),
         skills.has_lesson,
         skills.question_count,
         skills.active_session_id,
         skills.active_session_status,
         case
           when skills.demo_preview and skills.has_lesson and skills.question_count > 0 then 'Prévia demonstrativa: conteúdo tecnicamente disponível; revisão pedagógica pendente.'
           when skills.content_readiness <> 'ADAPTIVE_READY' or not skills.has_lesson then 'BNCC skill mapped, but the published lesson is not ready.'
           when skills.question_count = 0 then 'BNCC skill mapped, but no published exercises are available.'
           when skills.active_session_id is null then 'No active guided session.'
           else 'Guided session available.'
         end
    from skills
   where private.learning_v2_scope_student(p_institution_id, p_student_id)
   order by skills.subject_area, skills.grade_level, skills.title;
$$;

create or replace function private.assert_bncc_guided_session_scope(
  p_institution_id uuid,
  p_student_id uuid,
  p_target_canonical_skill_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_stage text;
  target_grade smallint;
begin
  if not private.learning_v2_scope_student(p_institution_id, p_student_id) then
    raise exception 'LEARNING_V4_TARGET_NOT_ELIGIBLE';
  end if;

  select grade.stage, grade.grade_level
    into target_stage, target_grade
    from public.learning_curriculum_skills skill
    join public.learning_curriculum_catalogs catalog
      on catalog.id = skill.catalog_id
     and catalog.code = 'BNCC_2018'
     and catalog.active
    join public.learning_curriculum_grade_targets grade
      on grade.canonical_skill_id = skill.id
     and grade.catalog_id = skill.catalog_id
     and grade.active
   where skill.id = p_target_canonical_skill_id
     and skill.active
     and skill.node_kind = 'LEAF'
     and skill.bncc_alignment_status in ('MAPPED', 'CANDIDATE')
     and skill.metadata->>'official_code' is not null
     and (
       (
         skill.content_readiness = 'ADAPTIVE_READY'
         and skill.mastery_targetable
         and skill.publication_status = 'PUBLISHED'
       )
       or (
         private.bncc_demo_preview_allowed(p_institution_id, p_student_id)
         and skill.content_readiness = 'CONTENT_READY'
         and not skill.mastery_targetable
         and skill.publication_status = 'STAGING'
         and skill.metadata->>'content_pack' = 'TECESCOLA_BNCC_DEEP_LEARNING_V8'
       )
     )
   limit 1;

  if target_stage is null then
    raise exception 'LEARNING_V4_BNCC_MAPPING_REQUIRED';
  end if;

  if not exists (
    select 1
      from public.enrollments enrollment
      join public.classes class
        on class.id = enrollment.class_id
       and class.institution_id = p_institution_id
       and class.active
      cross join lateral private.normalize_learning_grade_context(class.grade_level) normalized(value)
     where enrollment.student_id = p_student_id
       and enrollment.active
       and upper(enrollment.status::text) = 'ACTIVE'
       and normalized.value->>'stage' = target_stage
       and nullif(normalized.value->>'grade_level', '')::smallint = target_grade
  ) then
    raise exception 'LEARNING_V4_TARGET_NOT_ELIGIBLE';
  end if;
end;
$$;

-- Reinstall the V8 start implementation with the same allowlist gate used by
-- discovery and the public wrapper. Normal published V4 targets keep the
-- existing behavior; only the four V8 preview skills use the V8 policy.
create or replace function public.start_guided_learning_session_v4(
  p_institution_id uuid,
  p_student_id uuid,
  p_target_canonical_skill_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_skill public.learning_curriculum_skills%rowtype;
  existing public.learning_guided_sessions%rowtype;
  created public.learning_guided_sessions%rowtype;
  first_lesson uuid;
  first_step uuid;
  question_set uuid;
  target_subject_id uuid;
  enrollment_class_id uuid;
  target_institution_skill_id uuid;
  v8_demo boolean;
begin
  if not private.learning_v2_scope_student(p_institution_id, p_student_id) then
    raise exception 'LEARNING_STUDENT_SCOPE_DENIED';
  end if;

  select skill.*
    into target_skill
    from public.learning_curriculum_skills skill
   where skill.id = p_target_canonical_skill_id
     and skill.active
     and skill.node_kind = 'LEAF'
     and skill.bncc_alignment_status in ('MAPPED', 'CANDIDATE')
     and (
       (
         skill.content_readiness = 'ADAPTIVE_READY'
         and skill.mastery_targetable
         and skill.publication_status = 'PUBLISHED'
       )
       or (
         private.bncc_demo_preview_allowed(p_institution_id, p_student_id)
         and skill.content_readiness = 'CONTENT_READY'
         and not skill.mastery_targetable
         and skill.publication_status = 'STAGING'
         and skill.metadata->>'content_pack' = 'TECESCOLA_BNCC_DEEP_LEARNING_V8'
       )
     );
  if not found then
    raise exception 'LEARNING_V4_TARGET_NOT_READY';
  end if;

  v8_demo := target_skill.code in ('EM13MAT101', 'EM13LGG303', 'EM13CNT101', 'EM13CHS103');

  select session.*
    into existing
    from public.learning_guided_sessions session
   where session.institution_id = p_institution_id
     and session.student_id = p_student_id
     and session.target_canonical_skill_id = p_target_canonical_skill_id
     and session.status in ('ACTIVE', 'PAUSED')
   order by session.updated_at desc
   limit 1;
  if found and existing.planner_version = 'V4' then
    return jsonb_build_object('session_id', existing.id, 'created', false, 'current_step_id', existing.current_step_id, 'engine_version', 'V4');
  end if;
  if found then
    raise exception 'LEARNING_V4_EXISTING_SESSION_OTHER_ENGINE' using detail = 'An active or paused V2/V3 session owns this target; continue it with the V2-compatible service fallback.';
  end if;

  select link.learning_skill_id, unit.subject_id
    into target_institution_skill_id, target_subject_id
    from public.learning_skill_canonical_links link
    join public.learning_skills skill on skill.id = link.learning_skill_id and skill.active
    join public.learning_units unit on unit.id = skill.unit_id and unit.active
   where link.institution_id = p_institution_id
     and link.canonical_skill_id = p_target_canonical_skill_id
     and link.active
   order by link.created_at
   limit 1;

  select enrollment.class_id
    into enrollment_class_id
    from public.enrollments enrollment
   where enrollment.student_id = p_student_id
     and enrollment.active
     and upper(enrollment.status::text) = 'ACTIVE'
   order by enrollment.created_at desc
   limit 1;

  if not v8_demo then
    select lesson.id
      into first_lesson
      from public.learning_skill_lessons lesson
     where lesson.canonical_skill_id = p_target_canonical_skill_id
       and lesson.version = 4
       and lesson.active
     order by lesson.id
     limit 1;
    if first_lesson is null then
      select set_row.id
        into question_set
        from public.learning_question_sets set_row
       where set_row.scope = 'GLOBAL'
         and set_row.institution_id is null
         and set_row.teacher_profile_id is null
         and set_row.canonical_skill_id = p_target_canonical_skill_id
         and set_row.purpose = 'PROBE'
         and set_row.version = 4
         and set_row.active
         and exists (
           select 1
             from public.learning_question_set_items item
             join public.learning_question_bank bank on bank.id = item.question_bank_id and bank.active
            where item.question_set_id = set_row.id
         )
       limit 1;
      if question_set is null then
        raise exception 'LEARNING_V4_QUESTION_SET_EMPTY';
      end if;
    end if;
    insert into public.learning_guided_sessions(
      institution_id, student_id, target_canonical_skill_id, original_target_canonical_skill_id,
      current_canonical_skill_id, target_institution_skill_id, subject_id, class_id,
      planner_version, decision_reason, metadata
    ) values (
      p_institution_id, p_student_id, p_target_canonical_skill_id, p_target_canonical_skill_id,
      p_target_canonical_skill_id, target_institution_skill_id, target_subject_id, enrollment_class_id,
      'V4', 'V4_TARGET_READY', jsonb_build_object('engine_version', 'V4', 'decision_reason', 'V4_TARGET_READY', 'replan_count', 0)
    ) returning * into created;
    insert into public.learning_guided_steps(
      institution_id, session_id, canonical_skill_id, step_type, purpose, position,
      status, lesson_id, question_set_id, started_at
    ) values (
      p_institution_id, created.id, p_target_canonical_skill_id,
      case when first_lesson is null then 'PROBE' else 'LESSON' end,
      case when first_lesson is null then 'PROBE' else null end,
      0, 'ACTIVE', first_lesson, question_set, now()
    ) returning id into first_step;
    update public.learning_guided_sessions set current_step_id = first_step where id = created.id;
    insert into public.learning_guided_session_events(institution_id, session_id, student_id, event_type, step_id, idempotency_key, payload)
    values (p_institution_id, created.id, p_student_id, 'SESSION_STARTED', first_step, 'v4-session-start:' || created.id::text, jsonb_build_object('engine_version', 'V4', 'decision_reason', 'V4_TARGET_READY'));
    insert into public.learning_guided_session_events(institution_id, session_id, student_id, event_type, step_id, idempotency_key, payload)
    values (p_institution_id, created.id, p_student_id, 'STEP_STARTED', first_step, 'v4-step-start:' || first_step::text, jsonb_build_object('step_type', case when first_lesson is null then 'PROBE' else 'LESSON' end));
    return jsonb_build_object('session_id', created.id, 'created', true, 'current_step_id', first_step, 'engine_version', 'V4');
  end if;

  select set_row.id
    into question_set
    from public.learning_question_sets set_row
   where set_row.scope = 'GLOBAL'
     and set_row.institution_id is null
     and set_row.teacher_profile_id is null
     and set_row.canonical_skill_id = p_target_canonical_skill_id
     and set_row.purpose = 'PROBE'
     and set_row.active
     and exists (
       select 1
         from public.learning_question_set_items item
         join public.learning_question_bank bank on bank.id = item.question_bank_id and bank.active
        where item.question_set_id = set_row.id
     )
   order by set_row.version desc, set_row.id
   limit 1;
  if question_set is null then
    raise exception 'LEARNING_V4_QUESTION_SET_EMPTY';
  end if;
  insert into public.learning_guided_sessions(
    institution_id, student_id, target_canonical_skill_id, original_target_canonical_skill_id,
    current_canonical_skill_id, target_institution_skill_id, subject_id, class_id,
    planner_version, decision_reason, metadata
  ) values (
    p_institution_id, p_student_id, p_target_canonical_skill_id, p_target_canonical_skill_id,
    p_target_canonical_skill_id, target_institution_skill_id, target_subject_id, enrollment_class_id,
    'V4', 'PROBE_REQUIRED', jsonb_build_object('engine_version', 'V4', 'adaptive_policy_version', 'V8', 'content_version', 5, 'decision_reason', 'PROBE_REQUIRED', 'replan_count', 0)
  ) returning * into created;
  insert into public.learning_guided_steps(
    institution_id, session_id, canonical_skill_id, step_type, purpose, position,
    status, question_set_id, started_at
  ) values (
    p_institution_id, created.id, p_target_canonical_skill_id, 'PROBE', 'PROBE',
    0, 'ACTIVE', question_set, now()
  ) returning id into first_step;
  update public.learning_guided_sessions set current_step_id = first_step where id = created.id;
  insert into public.learning_guided_session_events(institution_id, session_id, student_id, event_type, step_id, idempotency_key, payload)
  values (p_institution_id, created.id, p_student_id, 'SESSION_STARTED', first_step, 'v8-session-start:' || created.id::text, jsonb_build_object('engine_version', 'V4', 'content_version', 5, 'decision_reason', 'PROBE_REQUIRED'));
  insert into public.learning_guided_session_events(institution_id, session_id, student_id, event_type, step_id, idempotency_key, payload)
  values (p_institution_id, created.id, p_student_id, 'STEP_STARTED', first_step, 'v8-step-start:' || first_step::text, jsonb_build_object('step_type', 'PROBE', 'content_version', 5));
  return jsonb_build_object('session_id', created.id, 'created', true, 'current_step_id', first_step, 'engine_version', 'V4');
end;
$$;

notify pgrst, 'reload schema';
commit;
