begin;

-- Re-apply the public discovery and protected scope after V4 has seeded its
-- content. The pre-V4 trigger prevents an exposure window while this file is
-- waiting to run, and these predicates remain the permanent runtime gate.
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
  with enrollment_context as (
    select distinct on (enrollment.student_id, enrollment.class_id)
      enrollment.student_id,
      enrollment.class_id,
      normalized.value->>'stage' as stage,
      nullif(normalized.value->>'grade_level', '')::smallint as parsed_grade
    from public.enrollments enrollment
    join public.classes class on class.id = enrollment.class_id
      and class.institution_id = p_institution_id
      and class.active
    cross join lateral private.normalize_learning_grade_context(class.grade_level) normalized(value)
    where enrollment.student_id = p_student_id
      and enrollment.active
      and enrollment.status = 'active'
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
      (select count(*)::integer
         from public.learning_skill_lessons lesson
        where lesson.canonical_skill_id = skill.id
          and lesson.version = 4
          and lesson.active) > 0 as has_lesson,
      (select count(*)::integer
         from public.learning_question_set_items item
         join public.learning_question_sets question_set
           on question_set.id = item.question_set_id
          and question_set.scope = 'GLOBAL'
          and question_set.version = 4
          and question_set.active
        where question_set.canonical_skill_id = skill.id) as question_count,
      state.mastery_estimate as progress,
      session.id as active_session_id,
      session.status as active_session_status
    from enrollment_context context
    join public.learning_curriculum_grade_targets target
      on target.stage = context.stage
     and target.grade_level = context.parsed_grade
     and target.active
    join public.learning_curriculum_skills skill
      on skill.id = target.canonical_skill_id
     and skill.active
     and skill.node_kind = 'LEAF'
     and skill.bncc_alignment_status = 'MAPPED'
     and skill.publication_status = 'PUBLISHED'
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
     and skill.content_readiness = 'ADAPTIVE_READY'
     and skill.mastery_targetable
     and skill.bncc_alignment_status = 'MAPPED'
     and skill.publication_status = 'PUBLISHED'
     and skill.metadata->>'official_code' is not null
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
       and enrollment.status = 'active'
       and normalized.value->>'stage' = target_stage
       and nullif(normalized.value->>'grade_level', '')::smallint = target_grade
  ) then
    raise exception 'LEARNING_V4_TARGET_NOT_ELIGIBLE';
  end if;
end;
$$;

revoke all on function private.assert_bncc_guided_session_scope(uuid, uuid, uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
