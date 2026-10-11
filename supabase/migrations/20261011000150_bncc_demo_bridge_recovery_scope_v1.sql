begin;

create or replace function private.enforce_bncc_discipline_journey_step_v9()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.learning_guided_sessions%rowtype;
  migration_recovery boolean;
begin
  select session.* into session_row
    from public.learning_guided_sessions session
   where session.id = new.session_id;
  if not found then
    raise exception 'LEARNING_GUIDED_SESSION_NOT_FOUND';
  end if;

  if session_row.discipline_journey_id is not null then
    migration_recovery := coalesce(
      session_user = 'postgres'
      and session_row.id = '5f74e2d4-04e8-42e3-996f-ed39dc91fdac'::uuid
      and session_row.institution_id = '1663123e-5046-41c5-a7db-f712da058536'::uuid
      and session_row.planner_version = 'V4'
      and session_row.status = 'PAUSED'
      and session_row.decision_reason = 'MAX_ACTIVE_BRIDGE_DEPTH_REACHED'
      and new.institution_id = session_row.institution_id
      and new.step_type = 'RETURN_TO_TARGET'
      and new.purpose is null
      and new.status = 'ACTIVE'
      and new.canonical_skill_id = session_row.original_target_canonical_skill_id
      and session_row.target_canonical_skill_id = session_row.original_target_canonical_skill_id
      and coalesce(new.metadata->>'bridge_limit_recovery' = 'true', false)
      and coalesce(new.metadata->>'mastery_unproven' = 'true', false)
      and new.metadata->>'reason' = 'MAX_ACTIVE_BRIDGE_DEPTH_REACHED'
      and private.bncc_demo_preview_allowed(session_row.institution_id, session_row.student_id)
      and exists (
        select 1
          from public.learning_bncc_discipline_journeys journey
          join private.learning_demo_subject_bindings binding
            on binding.institution_id = session_row.institution_id
           and binding.canonical_subject_id = journey.canonical_subject_id
          join public.learning_curriculum_skills skill
            on skill.id = journey.execution_skill_id
           and skill.id = session_row.original_target_canonical_skill_id
           and skill.active
           and skill.node_kind = 'LEAF'
           and skill.content_readiness = 'ADAPTIVE_READY'
           and skill.mastery_targetable
           and skill.metadata->>'content_pack' = 'tec-escola-core-v4'
         where journey.id = session_row.discipline_journey_id
           and journey.active
           and journey.publication_status = 'DEMO_PREVIEW'
           and journey.mapping_status = 'MAPPING_PENDING'
           and journey.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING'
           and journey.suggested_stage = 'ENSINO_MEDIO'
           and journey.suggested_grade = 1
           and exists (
             select 1
               from public.enrollments enrollment
               join public.classes class
                 on class.id = enrollment.class_id
                and class.institution_id = session_row.institution_id
                and class.active
               cross join lateral private.normalize_learning_grade_context(class.grade_level) normalized(value)
              where enrollment.student_id = session_row.student_id
                and enrollment.active
                and upper(enrollment.status::text) = 'ACTIVE'
                and normalized.value->>'stage' = journey.suggested_stage
                and nullif(normalized.value->>'grade_level', '')::smallint = journey.suggested_grade
           )
      ),
      false
    );

    if not private.learning_v2_scope_student(session_row.institution_id, session_row.student_id)
       and not migration_recovery then
      raise exception 'LEARNING_V9_DEMO_SCOPE_DENIED';
    end if;

    if not migration_recovery then
      perform private.assert_bncc_discipline_journey_v9(
        session_row.institution_id, session_row.student_id,
        session_row.discipline_journey_id, session_row.target_canonical_skill_id
      );
      if not exists (
        select 1
          from public.learning_bncc_discipline_journeys journey
          join public.learning_curriculum_skills step_skill
            on step_skill.id = new.canonical_skill_id
           and step_skill.active
           and step_skill.node_kind = 'LEAF'
           and step_skill.content_readiness = 'ADAPTIVE_READY'
           and step_skill.mastery_targetable
         where journey.id = session_row.discipline_journey_id
           and (
             step_skill.canonical_subject_id = journey.canonical_subject_id
             or new.canonical_skill_id in (
               with recursive prerequisite_walk(skill_id, depth) as (
                 select edge.prerequisite_skill_id, 1
                   from public.learning_skill_prerequisites edge
                  where edge.skill_id = journey.execution_skill_id
                 union
                 select edge.prerequisite_skill_id, prerequisite_walk.depth + 1
                   from prerequisite_walk
                   join public.learning_skill_prerequisites edge
                     on edge.skill_id = prerequisite_walk.skill_id
                  where prerequisite_walk.depth < 8
               )
               select prerequisite_walk.skill_id from prerequisite_walk
             )
           )
      ) then
        raise exception 'LEARNING_V9_STEP_SKILL_OUT_OF_DISCIPLINE';
      end if;
    end if;
  end if;
  return new;
end;
$$;

commit;
