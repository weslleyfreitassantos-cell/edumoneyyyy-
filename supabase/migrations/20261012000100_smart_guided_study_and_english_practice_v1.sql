begin;

create or replace function private.assert_bncc_discipline_journey_v9(
  p_institution_id uuid,
  p_student_id uuid,
  p_journey_id uuid,
  p_execution_skill_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  journey_row public.learning_bncc_discipline_journeys%rowtype;
  active_context_count integer;
begin
  if not private.learning_v2_scope_student(p_institution_id, p_student_id)
     or not private.bncc_demo_preview_allowed(p_institution_id, p_student_id) then
    raise exception 'LEARNING_V9_DEMO_SCOPE_DENIED';
  end if;

  select journey.* into journey_row
    from public.learning_bncc_discipline_journeys journey
    join private.learning_demo_subject_bindings binding
      on binding.institution_id = p_institution_id
     and binding.canonical_subject_id = journey.canonical_subject_id
   where journey.id = p_journey_id
     and journey.active
     and journey.publication_status = 'DEMO_PREVIEW'
     and journey.mapping_status = 'MAPPING_PENDING'
     and journey.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'
     and journey.suggested_stage is not null
     and journey.suggested_grade is not null
     and journey.suggested_grade > 0
     and (p_execution_skill_id is null or journey.execution_skill_id = p_execution_skill_id)
     and exists (
       select 1
         from public.learning_curriculum_skills skill
        where skill.id = journey.execution_skill_id
          and skill.active
          and skill.node_kind = 'LEAF'
          and skill.content_readiness = 'ADAPTIVE_READY'
          and skill.mastery_targetable
          and skill.metadata->>'content_pack' = 'tec-escola-core-v4'
     );
  if not found then
    raise exception 'LEARNING_V9_JOURNEY_NOT_AVAILABLE';
  end if;

  select count(*)::integer into active_context_count
    from (
      select distinct enrollment.class_id, enrollment.academic_year_id,
             normalized.value->>'stage' as stage,
             nullif(normalized.value->>'grade_level', '')::smallint as grade_level
        from public.enrollments enrollment
        join public.classes class
          on class.id = enrollment.class_id
         and class.institution_id = p_institution_id
         and class.academic_year_id = enrollment.academic_year_id
         and class.active
        join public.academic_years academic_year
          on academic_year.id = enrollment.academic_year_id
         and academic_year.institution_id = p_institution_id
         and academic_year.active
        cross join lateral private.normalize_learning_grade_context(class.grade_level) normalized(value)
       where enrollment.student_id = p_student_id
         and enrollment.active
         and upper(enrollment.status::text) = 'ACTIVE'
    ) contexts;

  if active_context_count > 1 then
    raise exception 'LEARNING_V9_AMBIGUOUS_ENROLLMENT';
  elsif active_context_count = 0 or not exists (
    select 1
      from public.enrollments enrollment
      join public.classes class
        on class.id = enrollment.class_id
       and class.institution_id = p_institution_id
       and class.academic_year_id = enrollment.academic_year_id
       and class.active
      join public.academic_years academic_year
        on academic_year.id = enrollment.academic_year_id
       and academic_year.institution_id = p_institution_id
       and academic_year.active
      cross join lateral private.normalize_learning_grade_context(class.grade_level) normalized(value)
     where enrollment.student_id = p_student_id
       and enrollment.active
       and upper(enrollment.status::text) = 'ACTIVE'
       and normalized.value->>'stage' = journey_row.suggested_stage
       and nullif(normalized.value->>'grade_level', '')::smallint = journey_row.suggested_grade
  ) then
    raise exception 'LEARNING_V9_GRADE_NOT_ELIGIBLE';
  end if;
end;
$$;

create or replace function private.recommend_guided_discipline_study_v10(
  p_institution_id uuid,
  p_student_id uuid,
  p_subject_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  subject_row record;
  context_row record;
  context_count integer;
  candidate_row record;
  session_row record;
  result_state text;
begin
  if not private.learning_v2_scope_student(p_institution_id, p_student_id)
     or not private.bncc_demo_preview_allowed(p_institution_id, p_student_id) then
    raise exception 'LEARNING_V10_DEMO_SCOPE_DENIED';
  end if;

  select subject.id, subject.name, binding.canonical_subject_id
    into subject_row
    from public.subjects subject
    join private.learning_demo_subject_bindings binding
      on binding.institution_id = p_institution_id
     and binding.subject_id = subject.id
   where subject.id = p_subject_id
     and subject.institution_id = p_institution_id
     and subject.active;
  if not found then
    return jsonb_build_object('state', 'NO_BNCC_MAPPING');
  end if;

  with active_contexts as (
    select distinct enrollment.class_id, enrollment.academic_year_id,
           normalized.value->>'stage' as stage,
           nullif(normalized.value->>'grade_level', '')::smallint as grade_level,
           academic_year.end_date
      from public.enrollments enrollment
      join public.classes class
        on class.id = enrollment.class_id
       and class.institution_id = p_institution_id
       and class.academic_year_id = enrollment.academic_year_id
       and class.active
      join public.academic_years academic_year
        on academic_year.id = enrollment.academic_year_id
       and academic_year.institution_id = p_institution_id
       and academic_year.active
      cross join lateral private.normalize_learning_grade_context(class.grade_level) normalized(value)
     where enrollment.student_id = p_student_id
       and enrollment.academic_year_id = class.academic_year_id
       and enrollment.active
       and upper(enrollment.status::text) = 'ACTIVE'
  )
  select count(*)::integer into context_count from active_contexts;

  if context_count = 0 then
    return jsonb_build_object('state', 'NO_ACTIVE_ENROLLMENT');
  elsif context_count > 1 then
    return jsonb_build_object('state', 'AMBIGUOUS_ENROLLMENT');
  end if;

  with active_contexts as (
    select distinct enrollment.class_id, enrollment.academic_year_id,
           normalized.value->>'stage' as stage,
           nullif(normalized.value->>'grade_level', '')::smallint as grade_level,
           academic_year.end_date
      from public.enrollments enrollment
      join public.classes class
        on class.id = enrollment.class_id
       and class.institution_id = p_institution_id
       and class.academic_year_id = enrollment.academic_year_id
       and class.active
      join public.academic_years academic_year
        on academic_year.id = enrollment.academic_year_id
       and academic_year.institution_id = p_institution_id
       and academic_year.active
      cross join lateral private.normalize_learning_grade_context(class.grade_level) normalized(value)
     where enrollment.student_id = p_student_id
       and enrollment.active
       and upper(enrollment.status::text) = 'ACTIVE'
  )
  select * into context_row
    from active_contexts
   order by end_date desc, academic_year_id, class_id
   limit 1;

  if not exists (
    select 1
      from public.learning_bncc_discipline_journeys journey
     where journey.canonical_subject_id = subject_row.canonical_subject_id
       and journey.active
       and journey.publication_status = 'DEMO_PREVIEW'
       and journey.mapping_status = 'MAPPING_PENDING'
       and journey.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'
  ) then
    return jsonb_build_object('state', 'NO_ELIGIBLE_CONTENT');
  end if;

  if not exists (
    select 1
      from public.learning_bncc_discipline_journeys journey
     where journey.canonical_subject_id = subject_row.canonical_subject_id
       and journey.active
       and journey.publication_status = 'DEMO_PREVIEW'
       and journey.mapping_status = 'MAPPING_PENDING'
       and journey.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'
       and journey.suggested_stage = context_row.stage
       and journey.suggested_grade = context_row.grade_level
  ) then
    return jsonb_build_object(
      'state', 'GRADE_NOT_SUPPORTED',
      'stage', context_row.stage,
      'grade_level', context_row.grade_level
    );
  end if;

  select session.id as session_id,
         session.discipline_journey_id as journey_id,
         session.target_canonical_skill_id as execution_skill_id,
         session.current_step_id,
         session.status as session_status,
         session.decision_reason,
         coalesce(journey.title, skill.title) as title,
         journey.unit_title,
         coalesce(state.mastery_estimate, 0)::numeric as progress,
         journey.pedagogical_review_status,
         session.metadata->>'demonstration_only' = 'true' as demonstration_only
    into session_row
    from public.learning_guided_sessions session
    join public.learning_curriculum_skills skill
      on skill.id = session.target_canonical_skill_id
    left join public.learning_bncc_discipline_journeys journey
      on journey.id = session.discipline_journey_id
     and journey.canonical_subject_id = subject_row.canonical_subject_id
    left join public.learning_student_skill_state state
      on state.institution_id = p_institution_id
     and state.student_id = p_student_id
     and state.canonical_skill_id = session.target_canonical_skill_id
   where session.institution_id = p_institution_id
     and session.student_id = p_student_id
     and session.class_id = context_row.class_id
     and session.status in ('ACTIVE', 'PAUSED', 'NEEDS_TEACHER_SUPPORT')
     and (skill.canonical_subject_id = subject_row.canonical_subject_id
          or journey.canonical_subject_id = subject_row.canonical_subject_id)
   order by case session.status when 'ACTIVE' then 0 when 'PAUSED' then 1 else 2 end,
            session.updated_at desc, session.id
   limit 1;

  if found then
    if session_row.session_status = 'NEEDS_TEACHER_SUPPORT' then
      result_state := case
        when session_row.decision_reason in ('CONTENT_EXHAUSTED', 'REMEDIATION_QUESTION_POOL_EXHAUSTED')
          then 'CONTENT_EXHAUSTED'
        else 'NEEDS_TEACHER_SUPPORT'
      end;
      return jsonb_build_object(
        'state', result_state,
        'stage', context_row.stage,
        'grade_level', context_row.grade_level,
        'title', session_row.title,
        'unit_title', session_row.unit_title,
        'progress', session_row.progress,
        'session_id', session_row.session_id,
        'journey_id', session_row.journey_id,
        'execution_skill_id', session_row.execution_skill_id,
        'current_step_id', session_row.current_step_id,
        'session_status', session_row.session_status,
        'demonstration_only', coalesce(session_row.demonstration_only, true),
        'pedagogical_review_status', coalesce(session_row.pedagogical_review_status, 'PEDAGOGICAL_REVIEW_PENDING')
      );
    end if;

    return jsonb_build_object(
      'state', 'ACTIVE',
      'action', 'RESUME',
      'stage', context_row.stage,
      'grade_level', context_row.grade_level,
      'title', session_row.title,
      'unit_title', session_row.unit_title,
      'progress', session_row.progress,
      'session_id', session_row.session_id,
      'journey_id', session_row.journey_id,
      'execution_skill_id', session_row.execution_skill_id,
      'current_step_id', session_row.current_step_id,
      'session_status', session_row.session_status,
      'demonstration_only', coalesce(session_row.demonstration_only, true),
      'pedagogical_review_status', coalesce(session_row.pedagogical_review_status, 'PEDAGOGICAL_REVIEW_PENDING')
    );
  end if;

  with eligible as (
    select journey.id as journey_id,
           journey.journey_code,
           journey.execution_skill_id,
           journey.title,
           journey.unit_title,
           journey.metadata->>'learning_role' as learning_role,
           journey.pedagogical_review_status,
           skill.title as skill_title,
           skill.grade_level as skill_grade,
           coalesce(state.state, 'UNKNOWN') as mastery_state,
           coalesce(state.mastery_estimate, 0)::numeric as progress,
           coalesce(state.evidence_count, 0) as evidence_count,
           state.last_evidence_at,
           exists (
             select 1 from public.learning_skill_reviews review
              where review.institution_id = p_institution_id
                and review.student_id = p_student_id
                and review.canonical_skill_id = skill.id
                and review.completed_at is null
                and review.review_due_at <= now()
           ) or coalesce(state.state, 'UNKNOWN') = 'NEEDS_REVIEW' as review_due,
           exists (
             select 1 from public.learning_skill_evidence evidence
              where evidence.institution_id = p_institution_id
                and evidence.student_id = p_student_id
                and evidence.canonical_skill_id = skill.id
           ) or coalesce(state.evidence_count, 0) > 0 or exists (
             select 1 from public.learning_guided_sessions previous_session
              where previous_session.institution_id = p_institution_id
                and previous_session.student_id = p_student_id
                and previous_session.discipline_journey_id = journey.id
                and previous_session.status = 'COMPLETED'
           ) as has_progress,
           (select count(*)::integer
              from public.learning_skill_prerequisites prerequisite
              left join public.learning_student_skill_state prerequisite_state
                on prerequisite_state.institution_id = p_institution_id
               and prerequisite_state.student_id = p_student_id
               and prerequisite_state.canonical_skill_id = prerequisite.prerequisite_skill_id
             where prerequisite.skill_id = skill.id
               and coalesce(prerequisite_state.state, 'UNKNOWN') <> 'MASTERED'
           ) as unmastered_prerequisites
      from public.learning_bncc_discipline_journeys journey
      join private.learning_demo_subject_bindings binding
        on binding.institution_id = p_institution_id
       and binding.subject_id = p_subject_id
       and binding.canonical_subject_id = journey.canonical_subject_id
      join public.learning_curriculum_skills skill
        on skill.id = journey.execution_skill_id
       and skill.active
       and skill.node_kind = 'LEAF'
       and skill.content_readiness = 'ADAPTIVE_READY'
       and skill.mastery_targetable
       and skill.metadata->>'content_pack' = 'tec-escola-core-v4'
      left join public.learning_student_skill_state state
        on state.institution_id = p_institution_id
       and state.student_id = p_student_id
       and state.canonical_skill_id = skill.id
     where journey.active
       and journey.publication_status = 'DEMO_PREVIEW'
       and journey.mapping_status = 'MAPPING_PENDING'
       and journey.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'
       and journey.suggested_stage = context_row.stage
       and journey.suggested_grade = context_row.grade_level
       and exists (
         select 1 from public.learning_skill_lessons lesson
          where lesson.canonical_skill_id = skill.id
            and lesson.active and lesson.version = 4
       )
       and (select count(distinct item.question_bank_id)::integer
              from public.learning_question_sets question_set
              join public.learning_question_set_items item on item.question_set_id = question_set.id
              join public.learning_question_bank bank on bank.id = item.question_bank_id and bank.active
             where question_set.canonical_skill_id = skill.id
               and question_set.scope = 'GLOBAL'
               and question_set.version = 4
               and question_set.active) >= 2
       and not exists (
         select 1 from (values ('PROBE'), ('PRACTICE'), ('TRANSFER'), ('LOCK_IN'), ('REVIEW')) purpose(name)
          where not exists (
            select 1 from public.learning_question_sets question_set
            join public.learning_question_set_items item on item.question_set_id = question_set.id
            join public.learning_question_bank bank on bank.id = item.question_bank_id and bank.active
             where question_set.canonical_skill_id = skill.id
               and question_set.scope = 'GLOBAL'
               and question_set.version = 4
               and question_set.active
               and question_set.purpose = purpose.name
          )
       )
       and exists (
         select 1 from public.learning_question_sets probe_set
         join public.learning_question_set_items probe_item on probe_item.question_set_id = probe_set.id
         join public.learning_question_bank probe_bank on probe_bank.id = probe_item.question_bank_id and probe_bank.active
          where probe_set.canonical_skill_id = skill.id
            and probe_set.scope = 'GLOBAL'
            and probe_set.version = 4
            and probe_set.active
            and probe_set.purpose = 'PROBE'
          group by probe_set.id
         having count(distinct probe_item.question_bank_id) >= 2
       )
  )
  select eligible.* into candidate_row
    from eligible
   where eligible.review_due
      or (
        eligible.mastery_state <> 'MASTERED'
        and (
          eligible.has_progress
          or (eligible.learning_role = 'INTRODUCTORY_CONTENT' and eligible.evidence_count = 0)
        )
      )
   order by eligible.review_due desc,
            eligible.has_progress desc,
            case when eligible.has_progress then eligible.progress else 0 end asc,
            eligible.unmastered_prerequisites asc,
            case when eligible.learning_role = 'INTRODUCTORY_CONTENT' then 0 else 1 end,
            eligible.skill_grade asc nulls last,
            eligible.unit_title,
            eligible.journey_code
   limit 1;

  if not found then
    if exists (
      select 1
        from public.learning_bncc_discipline_journeys journey
        join public.learning_curriculum_skills skill
          on skill.id = journey.execution_skill_id
         and skill.active
         and skill.node_kind = 'LEAF'
         and skill.content_readiness = 'ADAPTIVE_READY'
         and skill.mastery_targetable
         and skill.metadata->>'content_pack' = 'tec-escola-core-v4'
       where journey.canonical_subject_id = subject_row.canonical_subject_id
         and journey.active
         and journey.publication_status = 'DEMO_PREVIEW'
         and journey.mapping_status = 'MAPPING_PENDING'
         and journey.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'
         and journey.suggested_stage = context_row.stage
         and journey.suggested_grade = context_row.grade_level
         and journey.metadata->>'learning_role' = 'INTRODUCTORY_CONTENT'
         and exists (
           select 1 from public.learning_skill_lessons lesson
            where lesson.canonical_skill_id = skill.id and lesson.active and lesson.version = 4
         )
         and not exists (
           select 1 from (values ('PROBE'), ('PRACTICE'), ('TRANSFER'), ('LOCK_IN'), ('REVIEW')) purpose(name)
            where not exists (
              select 1
                from public.learning_question_sets question_set
                join public.learning_question_set_items item on item.question_set_id = question_set.id
                join public.learning_question_bank bank on bank.id = item.question_bank_id and bank.active
               where question_set.canonical_skill_id = skill.id
                 and question_set.scope = 'GLOBAL'
                 and question_set.version = 4
                 and question_set.active
                 and question_set.purpose = purpose.name
            )
         )
    ) and not exists (
      select 1
        from public.learning_bncc_discipline_journeys journey
        join public.learning_curriculum_skills skill
          on skill.id = journey.execution_skill_id
         and skill.active
         and skill.node_kind = 'LEAF'
         and skill.content_readiness = 'ADAPTIVE_READY'
         and skill.mastery_targetable
         and skill.metadata->>'content_pack' = 'tec-escola-core-v4'
        left join public.learning_student_skill_state state
          on state.institution_id = p_institution_id
         and state.student_id = p_student_id
         and state.canonical_skill_id = skill.id
       where journey.canonical_subject_id = subject_row.canonical_subject_id
         and journey.active
         and journey.publication_status = 'DEMO_PREVIEW'
         and journey.mapping_status = 'MAPPING_PENDING'
         and journey.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'
         and journey.suggested_stage = context_row.stage
         and journey.suggested_grade = context_row.grade_level
         and journey.metadata->>'learning_role' = 'INTRODUCTORY_CONTENT'
         and coalesce(state.state, 'UNKNOWN') <> 'MASTERED'
         and exists (
           select 1 from public.learning_skill_lessons lesson
            where lesson.canonical_skill_id = skill.id and lesson.active and lesson.version = 4
         )
         and not exists (
           select 1 from (values ('PROBE'), ('PRACTICE'), ('TRANSFER'), ('LOCK_IN'), ('REVIEW')) purpose(name)
            where not exists (
              select 1
                from public.learning_question_sets question_set
                join public.learning_question_set_items item on item.question_set_id = question_set.id
                join public.learning_question_bank bank on bank.id = item.question_bank_id and bank.active
               where question_set.canonical_skill_id = skill.id
                 and question_set.scope = 'GLOBAL'
                 and question_set.version = 4
                 and question_set.active
                 and question_set.purpose = purpose.name
            )
         )
    ) then
      return jsonb_build_object(
        'state', 'CONTENT_EXHAUSTED',
        'stage', context_row.stage,
        'grade_level', context_row.grade_level
      );
    end if;
    return jsonb_build_object(
      'state', 'NO_ELIGIBLE_CONTENT',
      'stage', context_row.stage,
      'grade_level', context_row.grade_level
    );
  end if;

  return jsonb_build_object(
    'state', case when candidate_row.review_due then 'REVIEW' else 'READY' end,
    'action', case when candidate_row.review_due then 'REVIEW' else 'START' end,
    'stage', context_row.stage,
    'grade_level', context_row.grade_level,
    'title', candidate_row.title,
    'unit_title', candidate_row.unit_title,
    'progress', candidate_row.progress,
    'journey_id', candidate_row.journey_id,
    'execution_skill_id', candidate_row.execution_skill_id,
    'learning_role', candidate_row.learning_role,
    'demonstration_only', true,
    'pedagogical_review_status', candidate_row.pedagogical_review_status
  );
end;
$$;

create or replace function public.get_recommended_guided_study_v10(
  p_institution_id uuid,
  p_subject_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  student_ids uuid[];
  student_id uuid;
begin
  select coalesce(array_agg(student.id), '{}'::uuid[]) into student_ids
    from public.students student
   where student.profile_id = auth.uid()
     and student.institution_id = p_institution_id
     and student.active;
  if cardinality(student_ids) <> 1 then
    raise exception 'LEARNING_STUDENT_SCOPE_DENIED';
  end if;
  student_id := student_ids[1];
  return private.recommend_guided_discipline_study_v10(p_institution_id, student_id, p_subject_id);
end;
$$;

create or replace function public.start_recommended_guided_study_v10(
  p_institution_id uuid,
  p_subject_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  student_ids uuid[];
  student_id uuid;
  recommendation jsonb;
  started jsonb;
  session_row public.learning_guided_sessions%rowtype;
begin
  select coalesce(array_agg(student.id), '{}'::uuid[]) into student_ids
    from public.students student
   where student.profile_id = auth.uid()
     and student.institution_id = p_institution_id
     and student.active;
  if cardinality(student_ids) <> 1 then
    raise exception 'LEARNING_STUDENT_SCOPE_DENIED';
  end if;
  student_id := student_ids[1];

  perform pg_advisory_xact_lock(hashtextextended(
    student_id::text || ':' || p_institution_id::text || ':' || p_subject_id::text,
    0
  ));

  recommendation := private.recommend_guided_discipline_study_v10(
    p_institution_id, student_id, p_subject_id
  );
  if recommendation->>'state' = 'ACTIVE' then
    return recommendation || jsonb_build_object('created', false);
  end if;
  if recommendation->>'state' not in ('READY', 'REVIEW') then
    raise exception 'LEARNING_V10_RECOMMENDATION_NOT_STARTABLE:%', recommendation->>'state';
  end if;

  started := public.start_guided_discipline_journey_v9(
    p_institution_id,
    student_id,
    (recommendation->>'journey_id')::uuid
  );
  select session.* into session_row
    from public.learning_guided_sessions session
   where session.id = (started->>'session_id')::uuid
     and session.institution_id = p_institution_id
     and session.student_id = student_id;
  if not found then
    raise exception 'LEARNING_V10_SESSION_NOT_FOUND';
  end if;

  if session_row.class_id is distinct from (
    select enrollment.class_id
      from public.enrollments enrollment
      join public.classes class
        on class.id = enrollment.class_id
       and class.institution_id = p_institution_id
       and class.academic_year_id = enrollment.academic_year_id
       and class.active
      join public.academic_years academic_year
        on academic_year.id = enrollment.academic_year_id
       and academic_year.institution_id = p_institution_id
       and academic_year.active
     where enrollment.student_id = student_id
       and enrollment.active
       and upper(enrollment.status::text) = 'ACTIVE'
     order by academic_year.end_date desc, enrollment.updated_at desc, enrollment.id
     limit 1
  ) then
    raise exception 'LEARNING_V10_ENROLLMENT_CONTEXT_CHANGED';
  end if;

  return jsonb_build_object(
    'state', 'ACTIVE',
    'action', recommendation->>'action',
    'created', coalesce((started->>'created')::boolean, false),
    'session_id', session_row.id,
    'journey_id', session_row.discipline_journey_id,
    'execution_skill_id', session_row.target_canonical_skill_id,
    'current_step_id', session_row.current_step_id,
    'session_status', session_row.status,
    'title', recommendation->>'title',
    'unit_title', recommendation->>'unit_title',
    'stage', recommendation->>'stage',
    'grade_level', recommendation->'grade_level',
    'progress', recommendation->'progress',
    'demonstration_only', true,
    'pedagogical_review_status', 'PEDAGOGICAL_REVIEW_PENDING'
  );
end;
$$;

revoke all on function private.recommend_guided_discipline_study_v10(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.get_recommended_guided_study_v10(uuid, uuid),
  public.start_recommended_guided_study_v10(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_recommended_guided_study_v10(uuid, uuid),
  public.start_recommended_guided_study_v10(uuid, uuid) to authenticated;

create or replace function public.list_enem_simulation_templates_v2(p_institution_id uuid)
returns table(
  id uuid,
  title text,
  simulation_type text,
  area text,
  subject text,
  question_count integer,
  duration_minutes integer,
  available_count integer,
  language_options jsonb,
  metadata jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with templates as (
    select simulation.id, simulation.title, simulation.simulation_type, simulation.area,
           simulation.question_count, simulation.duration_minutes, simulation.metadata
      from public.learning_simulations simulation
     where simulation.status = 'PUBLISHED'
       and simulation.metadata->>'dynamic_pool' = 'true'
       and (simulation.institution_id is null or simulation.institution_id = p_institution_id)
  ), counts as (
    select template.*,
      case
        when template.metadata->>'enem_mode' = 'AREA' and template.area = 'LINGUAGENS' then
          case when (select count(*) from private.enem_ready_provider_text_questions(template.area, null, null)) >= 40
                    and ((select count(*) from private.enem_ready_provider_text_questions(template.area, null, 'ENGLISH')) >= 5
                      or (select count(*) from private.enem_ready_provider_text_questions(template.area, null, 'SPANISH')) >= 5)
               then 45 else 0 end
        when template.metadata->>'enem_mode' = 'SUBJECT' and template.metadata->>'enem_subject' = 'INGLES' then
          (select count(*)::integer from private.enem_ready_provider_text_questions(null, 'INGLES', 'ENGLISH'))
        when template.metadata->>'enem_mode' = 'SUBJECT' and template.metadata->>'enem_subject' = 'ESPANHOL' then
          (select count(*)::integer from private.enem_ready_provider_text_questions(null, 'ESPANHOL', 'SPANISH'))
        else (select count(*)::integer from private.enem_ready_provider_text_questions(template.area, template.metadata->>'enem_subject', null))
      end as pool_count,
      case
        when template.metadata->>'enem_mode' = 'AREA' and template.area = 'LINGUAGENS' then
          case
            when (select count(*) from private.enem_ready_provider_text_questions(template.area, null, 'ENGLISH')) >= 5
             and (select count(*) from private.enem_ready_provider_text_questions(template.area, null, 'SPANISH')) >= 5 then '["ENGLISH", "SPANISH"]'::jsonb
            when (select count(*) from private.enem_ready_provider_text_questions(template.area, null, 'ENGLISH')) >= 5 then '["ENGLISH"]'::jsonb
            when (select count(*) from private.enem_ready_provider_text_questions(template.area, null, 'SPANISH')) >= 5 then '["SPANISH"]'::jsonb
            else '[]'::jsonb
          end
        else '[]'::jsonb
      end as available_languages
    from templates template
  )
  select counts.id,
         counts.title,
         counts.simulation_type,
         counts.area,
         counts.metadata->>'enem_subject',
         case
           when counts.metadata->>'enem_mode' = 'SUBJECT'
            and counts.metadata->>'enem_subject' = 'INGLES'
            and counts.pool_count > 0
             then least(counts.question_count, counts.pool_count)
           else counts.question_count
         end::integer,
         counts.duration_minutes,
         counts.pool_count,
         counts.available_languages,
         case
           when counts.metadata->>'enem_mode' = 'SUBJECT'
            and counts.metadata->>'enem_subject' = 'INGLES'
             then counts.metadata || jsonb_build_object(
               'planned_question_count', counts.question_count,
               'reduced_practice', counts.pool_count > 0 and counts.pool_count < counts.question_count
             )
           else counts.metadata
         end
    from counts
   where (counts.metadata->>'enem_mode' = 'SUBJECT'
          and counts.metadata->>'enem_subject' = 'INGLES')
      or counts.pool_count >= counts.question_count
   order by case when counts.metadata->>'enem_mode' = 'AREA' then 0 else 1 end, counts.title;
$$;

revoke all on function public.list_enem_simulation_templates_v2(uuid) from public, anon;
grant execute on function public.list_enem_simulation_templates_v2(uuid) to authenticated;

create or replace function public.start_enem_simulation_attempt_v3(
  p_institution_id uuid,
  p_student_id uuid,
  p_simulation_id uuid,
  p_language_choice text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  simulation_row public.learning_simulations%rowtype;
  existing_attempt public.learning_simulation_attempts%rowtype;
  attempt_id uuid;
  question_row record;
  selected_questions uuid[] := '{}'::uuid[];
  selected_structured_content uuid[] := '{}'::uuid[];
  requested_count integer;
  available_count integer;
  snapshot_count integer;
  language_choice text := upper(nullif(trim(p_language_choice), ''));
begin
  select simulation.* into simulation_row
    from public.learning_simulations simulation
   where simulation.id = p_simulation_id
     and simulation.status = 'PUBLISHED'
     and simulation.metadata->>'dynamic_pool' = 'true'
     and simulation.metadata->>'enem_mode' = 'SUBJECT'
     and simulation.metadata->>'enem_subject' = 'INGLES'
     and (simulation.institution_id is null or simulation.institution_id = p_institution_id);
  if not found then
    return public.start_enem_simulation_attempt_v2(
      p_institution_id, p_student_id, p_simulation_id, p_language_choice
    );
  end if;

  if language_choice is not null and language_choice <> 'ENGLISH' then
    raise exception 'ENEM_LANGUAGE_CHOICE_INVALID';
  end if;

  if not exists (
    select 1 from public.students student
     where student.id = p_student_id
       and student.institution_id = p_institution_id
       and student.profile_id = auth.uid()
       and student.active
  ) then
    raise exception 'LEARNING_STUDENT_SCOPE_DENIED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_student_id::text || ':' || p_simulation_id::text || ':' || private.current_enem_content_revision(),
    0
  ));

  select attempt.* into existing_attempt
    from public.learning_simulation_attempts attempt
   where attempt.simulation_id = p_simulation_id
     and attempt.student_id = p_student_id
     and attempt.status = 'IN_PROGRESS'
     and attempt.content_revision = private.current_enem_content_revision()
   order by attempt.started_at desc
   limit 1;
  if found then
    select count(*)::integer into snapshot_count
      from public.learning_simulation_attempt_questions attempt_question
     where attempt_question.attempt_id = existing_attempt.id
       and attempt_question.structured_content_id is not null
       and attempt_question.occurrence_id is null;
    if snapshot_count <> existing_attempt.total_questions then
      raise exception 'ENEM_ATTEMPT_SNAPSHOT_INCOMPLETE';
    end if;
    return jsonb_build_object(
      'attempt_id', existing_attempt.id,
      'created', false,
      'question_count', existing_attempt.total_questions,
      'language_choice', existing_attempt.answers->>'__language_choice',
      'content_revision', existing_attempt.content_revision
    );
  end if;

  select count(*)::integer into available_count
    from private.enem_ready_provider_text_questions(null, 'INGLES', 'ENGLISH');
  requested_count := least(simulation_row.question_count, available_count);
  if requested_count < 1 then
    raise exception 'ENEM_PROVIDER_TEXT_POOL_INSUFFICIENT';
  end if;

  for question_row in
    select ready.*
      from private.enem_ready_provider_text_questions(null, 'INGLES', 'ENGLISH') ready
     order by random()
     limit requested_count
  loop
    selected_questions := array_append(selected_questions, question_row.question_id);
    selected_structured_content := array_append(selected_structured_content, question_row.structured_content_id);
  end loop;

  if coalesce(array_length(selected_questions, 1), 0) <> requested_count
     or coalesce(array_length(selected_structured_content, 1), 0) <> requested_count then
    raise exception 'ENEM_PROVIDER_TEXT_POOL_INSUFFICIENT';
  end if;

  insert into public.learning_simulation_attempts(
    institution_id, simulation_id, student_id, total_questions, content_revision, answers
  ) values (
    p_institution_id, p_simulation_id, p_student_id, requested_count,
    private.current_enem_content_revision(), jsonb_build_object('__language_choice', language_choice)
  ) returning id into attempt_id;

  for question_row in
    select selected.question_bank_id, selected.structured_content_id, selected.position
      from unnest(selected_questions, selected_structured_content)
           with ordinality selected(question_bank_id, structured_content_id, position)
  loop
    insert into public.learning_simulation_attempt_questions(
      attempt_id, position, question_bank_id, occurrence_id, structured_content_id
    ) values (
      attempt_id, question_row.position, question_row.question_bank_id, null, question_row.structured_content_id
    );
  end loop;

  return jsonb_build_object(
    'attempt_id', attempt_id,
    'created', true,
    'question_count', requested_count,
    'language_choice', language_choice,
    'content_revision', private.current_enem_content_revision()
  );
exception
  when unique_violation then
    select attempt.* into existing_attempt
      from public.learning_simulation_attempts attempt
     where attempt.simulation_id = p_simulation_id
       and attempt.student_id = p_student_id
       and attempt.status = 'IN_PROGRESS'
       and attempt.content_revision = private.current_enem_content_revision()
     order by attempt.started_at desc
     limit 1;
    if existing_attempt.id is null then raise; end if;
    return jsonb_build_object(
      'attempt_id', existing_attempt.id,
      'created', false,
      'question_count', existing_attempt.total_questions,
      'language_choice', existing_attempt.answers->>'__language_choice',
      'content_revision', existing_attempt.content_revision
    );
end;
$$;

revoke all on function public.start_enem_simulation_attempt_v3(uuid, uuid, uuid, text)
  from public, anon;
grant execute on function public.start_enem_simulation_attempt_v3(uuid, uuid, uuid, text)
  to authenticated;

notify pgrst, 'reload schema';
commit;
