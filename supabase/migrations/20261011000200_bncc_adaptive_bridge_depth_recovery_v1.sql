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

-- Recover sessions paused by the old step-counting bug without deleting evidence.
do $recover$
declare
  paused_session record;
  recovery_step_id uuid;
  next_position integer;
  bridge_skill_ids jsonb;
  bridge_depth integer;
begin
  for paused_session in
    select session.*
      from public.learning_guided_sessions session
     where session.planner_version = 'V4'
       and session.status = 'PAUSED'
       and session.decision_reason = 'MAX_ACTIVE_BRIDGE_DEPTH_REACHED'
     order by session.updated_at
  loop
    select step.id
      into recovery_step_id
      from public.learning_guided_steps step
     where step.session_id = paused_session.id
       and step.metadata->>'bridge_limit_recovery' = 'true'
     order by step.position desc
     limit 1;

    select coalesce(jsonb_agg(visited.skill_id::text order by visited.first_position), '[]'::jsonb)
      into bridge_skill_ids
      from (
        select step.canonical_skill_id as skill_id, min(step.position) as first_position
          from public.learning_guided_steps step
         where step.session_id = paused_session.id
           and step.canonical_skill_id <> paused_session.original_target_canonical_skill_id
         group by step.canonical_skill_id
      ) visited;
    bridge_depth := jsonb_array_length(bridge_skill_ids);

    if recovery_step_id is null then
      select coalesce(max(step.position), -1) + 1
        into next_position
        from public.learning_guided_steps step
       where step.session_id = paused_session.id;

      insert into public.learning_guided_steps(
        institution_id, session_id, canonical_skill_id, step_type, purpose,
        position, status, started_at, metadata
      ) values (
        paused_session.institution_id, paused_session.id,
        paused_session.original_target_canonical_skill_id,
        'RETURN_TO_TARGET', null, next_position, 'ACTIVE', now(),
        jsonb_build_object(
          'bridge_limit_recovery', true,
          'mastery_unproven', true,
          'reason', 'MAX_ACTIVE_BRIDGE_DEPTH_REACHED'
        )
      ) returning id into recovery_step_id;
    end if;

    update public.learning_guided_sessions
       set status = 'ACTIVE',
           current_canonical_skill_id = original_target_canonical_skill_id,
           current_canonical_subject_id = original_target_canonical_subject_id,
           current_step_id = recovery_step_id,
           decision_reason = 'MAX_ACTIVE_BRIDGE_DEPTH_RETURNED_TO_TARGET',
           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
             'bridge_depth', bridge_depth,
             'bridge_skill_ids', bridge_skill_ids,
             'runtime_reason', 'MAX_ACTIVE_BRIDGE_DEPTH_RETURNED_TO_TARGET',
             'mastery_unproven', true
           ),
           updated_at = now()
     where id = paused_session.id;

    insert into public.learning_guided_session_events(
      institution_id, session_id, student_id, event_type, step_id,
      idempotency_key, payload
    ) values (
      paused_session.institution_id, paused_session.id, paused_session.student_id,
      'REPLANNED', recovery_step_id,
      'v4-bridge-depth-recovery:' || paused_session.id::text,
      jsonb_build_object(
        'runtime_reason', 'MAX_ACTIVE_BRIDGE_DEPTH_RETURNED_TO_TARGET',
        'mastery_unproven', true,
        'bridge_depth', bridge_depth
      )
    ) on conflict do nothing;
  end loop;
end;
$recover$;

commit;
