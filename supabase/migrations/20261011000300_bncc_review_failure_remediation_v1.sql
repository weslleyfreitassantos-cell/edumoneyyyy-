begin;

create or replace function private.append_guided_v4_next_step(
  session_row public.learning_guided_sessions,
  completed_step public.learning_guided_steps,
  outcome text,
  event_key text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  next_step uuid;
  next_skill uuid;
  candidate_skill uuid;
  candidate_readiness text;
  next_readiness text;
  next_lesson uuid;
  next_position integer;
  bridge_skill_ids jsonb;
  bridge_depth integer;
begin
  if exists (
    select 1
      from public.learning_guided_session_events event
     where event.session_id = session_row.id
       and event.idempotency_key = event_key
  ) then
    return null;
  end if;

  if jsonb_typeof(session_row.metadata->'bridge_skill_ids') = 'array' then
    bridge_skill_ids := session_row.metadata->'bridge_skill_ids';
  else
    select coalesce(jsonb_agg(visited.skill_id::text order by visited.first_position), '[]'::jsonb)
      into bridge_skill_ids
      from (
        select step.canonical_skill_id as skill_id, min(step.position) as first_position
          from public.learning_guided_steps step
         where step.session_id = session_row.id
           and step.canonical_skill_id <> session_row.original_target_canonical_skill_id
         group by step.canonical_skill_id
      ) visited;
  end if;
  bridge_depth := jsonb_array_length(bridge_skill_ids);

  if completed_step.step_type = 'REVIEW' and outcome = 'GAP' then
    if coalesce(session_row.replan_count, 0) < 2 then
      select lesson.id
        into next_lesson
        from public.learning_skill_lessons lesson
       where lesson.canonical_skill_id = session_row.original_target_canonical_skill_id
         and lesson.active
         and nullif(btrim(lesson.title), '') is not null
         and nullif(btrim(lesson.content_markdown), '') is not null
         and nullif(btrim(lesson.worked_example), '') is not null
       order by lesson.version desc
       limit 1;

      if next_lesson is not null then
        next_position := completed_step.position + 1;
        insert into public.learning_guided_steps(
          institution_id, session_id, canonical_skill_id, step_type, purpose,
          position, status, lesson_id, started_at, metadata
        ) values (
          session_row.institution_id, session_row.id,
          session_row.original_target_canonical_skill_id, 'LESSON', null,
          next_position, 'ACTIVE', next_lesson, now(),
          jsonb_build_object(
            'review_remediation', true,
            'mastery_unproven', true,
            'reason', 'REVIEW_FAILED',
            'failed_step_id', completed_step.id
          )
        ) returning id into next_step;

        update public.learning_guided_sessions
           set status = 'ACTIVE',
               current_canonical_skill_id = original_target_canonical_skill_id,
               current_canonical_subject_id = original_target_canonical_subject_id,
               current_step_id = next_step,
               replan_count = coalesce(replan_count, 0) + 1,
               decision_reason = 'REVIEW_REMEDIATION_REQUIRED',
               metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
                 'bridge_depth', bridge_depth,
                 'bridge_skill_ids', bridge_skill_ids,
                 'runtime_reason', 'REVIEW_REMEDIATION_REQUIRED',
                 'mastery_unproven', true,
                 'review_remediation_step_id', next_step
               ),
               updated_at = now()
         where id = session_row.id;

        insert into public.learning_guided_session_events(
          institution_id, session_id, student_id, event_type, step_id,
          idempotency_key, payload
        ) values (
          session_row.institution_id, session_row.id, session_row.student_id,
          'REPLANNED', next_step, event_key || ':review-remediation',
          jsonb_build_object(
            'runtime_reason', 'REVIEW_REMEDIATION_REQUIRED',
            'mastery_unproven', true,
            'failed_step_id', completed_step.id,
            'replan_count', coalesce(session_row.replan_count, 0) + 1
          )
        );
        return next_step;
      end if;

      update public.learning_guided_sessions
         set status = 'NEEDS_TEACHER_SUPPORT',
             current_step_id = null,
             decision_reason = 'REVIEW_REMEDIATION_CONTENT_UNAVAILABLE',
             metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
               'runtime_reason', 'REVIEW_REMEDIATION_CONTENT_UNAVAILABLE',
               'mastery_unproven', true,
               'failed_step_id', completed_step.id
             ),
             updated_at = now()
       where id = session_row.id;

      insert into public.learning_guided_session_events(
        institution_id, session_id, student_id, event_type, step_id,
        idempotency_key, payload
      ) values (
        session_row.institution_id, session_row.id, session_row.student_id,
        'TEACHER_SUPPORT_REQUIRED', completed_step.id, event_key || ':review-content-unavailable',
        jsonb_build_object('reason', 'REVIEW_REMEDIATION_CONTENT_UNAVAILABLE', 'mastery_unproven', true)
      );
      return null;
    end if;

    update public.learning_guided_sessions
       set status = 'NEEDS_TEACHER_SUPPORT',
           current_step_id = null,
           decision_reason = 'TEACHER_SUPPORT_REQUIRED',
           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
             'runtime_reason', 'REVIEW_REMEDIATION_LIMIT_REACHED',
             'mastery_unproven', true,
             'review_remediation_limit_reached', true,
             'failed_step_id', completed_step.id
           ),
           updated_at = now()
     where id = session_row.id;

    insert into public.learning_guided_session_events(
      institution_id, session_id, student_id, event_type, step_id,
      idempotency_key, payload
    ) values (
      session_row.institution_id, session_row.id, session_row.student_id,
      'TEACHER_SUPPORT_REQUIRED', completed_step.id, event_key || ':review-support',
      jsonb_build_object(
        'reason', 'REVIEW_REMEDIATION_LIMIT_REACHED',
        'mastery_unproven', true,
        'failed_step_id', completed_step.id
      )
    );
    return null;
  end if;

  if completed_step.step_type = 'REVIEW' and outcome <> 'SUCCESS' then
    raise exception 'LEARNING_GUIDED_REVIEW_OUTCOME_INVALID';
  end if;

  if bridge_depth >= 2 and completed_step.canonical_skill_id <> session_row.original_target_canonical_skill_id then
    update public.learning_guided_sessions
       set status = 'PAUSED',
           current_step_id = null,
           decision_reason = 'MAX_ACTIVE_BRIDGE_DEPTH_REACHED',
           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
             'bridge_depth', bridge_depth,
             'bridge_skill_ids', bridge_skill_ids,
             'runtime_reason', 'MAX_ACTIVE_BRIDGE_DEPTH_REACHED'
           ),
           updated_at = now()
     where id = session_row.id;
    insert into public.learning_guided_session_events(
      institution_id, session_id, student_id, event_type, step_id,
      idempotency_key, payload
    ) values (
      session_row.institution_id, session_row.id, session_row.student_id,
      'REPLANNED', completed_step.id, event_key,
      jsonb_build_object('bridge_depth', bridge_depth, 'runtime_reason', 'MAX_ACTIVE_BRIDGE_DEPTH_REACHED')
    );
    return null;
  end if;

  if completed_step.step_type = 'LOCK_IN' and outcome = 'SUCCESS' then
    candidate_skill := private.pick_learning_v2_next_skill(
      session_row.institution_id,
      session_row.student_id,
      session_row.target_canonical_skill_id
    );

    if candidate_skill is not null
       and candidate_skill <> session_row.target_canonical_skill_id
       and bridge_depth >= 2
       and not (bridge_skill_ids @> jsonb_build_array(candidate_skill::text)) then
      insert into public.learning_guided_steps(
        institution_id, session_id, canonical_skill_id, step_type, purpose,
        position, status, started_at, metadata
      ) values (
        session_row.institution_id, session_row.id,
        session_row.original_target_canonical_skill_id,
        'RETURN_TO_TARGET', null, completed_step.position + 1,
        'ACTIVE', now(),
        jsonb_build_object(
          'mastery_unproven', true,
          'reason', 'MAX_ACTIVE_BRIDGE_DEPTH_REACHED',
          'unresolved_prerequisite_skill_id', candidate_skill
        )
      ) returning id into next_step;

      update public.learning_guided_sessions
         set status = 'ACTIVE',
             current_canonical_skill_id = original_target_canonical_skill_id,
             current_canonical_subject_id = original_target_canonical_subject_id,
             current_step_id = next_step,
             decision_reason = 'MAX_ACTIVE_BRIDGE_DEPTH_RETURNED_TO_TARGET',
             metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
               'bridge_depth', bridge_depth,
               'bridge_skill_ids', bridge_skill_ids,
               'runtime_reason', 'MAX_ACTIVE_BRIDGE_DEPTH_RETURNED_TO_TARGET',
               'mastery_unproven', true,
               'unresolved_prerequisite_skill_id', candidate_skill
             ),
             updated_at = now()
       where id = session_row.id;

      insert into public.learning_guided_session_events(
        institution_id, session_id, student_id, event_type, step_id,
        idempotency_key, payload
      ) values (
        session_row.institution_id, session_row.id, session_row.student_id,
        'REPLANNED', next_step, event_key || ':bridge-limit-return',
        jsonb_build_object(
          'runtime_reason', 'MAX_ACTIVE_BRIDGE_DEPTH_RETURNED_TO_TARGET',
          'mastery_unproven', true,
          'bridge_depth', bridge_depth,
          'unresolved_prerequisite_skill_id', candidate_skill
        )
      );
      return next_step;
    end if;

    if candidate_skill is not null and candidate_skill <> session_row.target_canonical_skill_id then
      select skill.content_readiness
        into candidate_readiness
        from public.learning_curriculum_skills skill
       where skill.id = candidate_skill and skill.active;
      if coalesce(candidate_readiness, 'GRAPH_ONLY') <> 'ADAPTIVE_READY' then
        update public.learning_guided_sessions
           set status = 'PAUSED', current_step_id = null,
               decision_reason = 'CONTENT_NOT_READY',
               metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
                 'bridge_depth', bridge_depth,
                 'bridge_skill_ids', bridge_skill_ids,
                 'runtime_reason', 'CONTENT_NOT_READY',
                 'skipped_canonical_skill_id', candidate_skill
               ),
               updated_at = now()
         where id = session_row.id;
        insert into public.learning_guided_session_events(
          institution_id, session_id, student_id, event_type, step_id,
          idempotency_key, payload
        ) values (
          session_row.institution_id, session_row.id, session_row.student_id,
          'REPLANNED', completed_step.id, event_key,
          jsonb_build_object('canonical_skill_id', candidate_skill, 'runtime_reason', 'CONTENT_NOT_READY')
        );
        return null;
      end if;
    end if;
  end if;

  next_step := private.append_guided_v2_next_step(session_row, completed_step, outcome, event_key);
  if next_step is null then return null; end if;

  select step.canonical_skill_id
    into next_skill
    from public.learning_guided_steps step
   where step.id = next_step;
  select skill.content_readiness
    into next_readiness
    from public.learning_curriculum_skills skill
   where skill.id = next_skill and skill.active;

  if coalesce(next_readiness, 'GRAPH_ONLY') <> 'ADAPTIVE_READY' then
    update public.learning_guided_steps
       set status = 'SKIPPED',
           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('runtime_reason', 'CONTENT_NOT_READY'),
           updated_at = now()
     where id = next_step;
    update public.learning_guided_sessions
       set status = 'PAUSED', current_step_id = null,
           decision_reason = 'CONTENT_NOT_READY',
           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
             'bridge_depth', bridge_depth,
             'bridge_skill_ids', bridge_skill_ids,
             'runtime_reason', 'CONTENT_NOT_READY',
             'skipped_canonical_skill_id', next_skill
           ),
           updated_at = now()
     where id = session_row.id;
    insert into public.learning_guided_session_events(
      institution_id, session_id, student_id, event_type, step_id,
      idempotency_key, payload
    ) values (
      session_row.institution_id, session_row.id, session_row.student_id,
      'REPLANNED', next_step, event_key || ':content-not-ready',
      jsonb_build_object('canonical_skill_id', next_skill, 'runtime_reason', 'CONTENT_NOT_READY')
    );
    return null;
  end if;

  if next_skill = session_row.original_target_canonical_skill_id then
    bridge_skill_ids := '[]'::jsonb;
    bridge_depth := 0;
  elsif not (bridge_skill_ids @> jsonb_build_array(next_skill::text)) then
    bridge_skill_ids := bridge_skill_ids || jsonb_build_array(next_skill::text);
    bridge_depth := jsonb_array_length(bridge_skill_ids);
  end if;

  update public.learning_guided_sessions
     set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
       'bridge_depth', bridge_depth,
       'bridge_skill_ids', bridge_skill_ids,
       'runtime_reason', null
     ),
         updated_at = now()
   where id = session_row.id;
  return next_step;
end;
$$;

commit;
