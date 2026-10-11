begin;

-- Recover a V8 preview session paused by the legacy transition guard. This is
-- intentionally narrow: only the allowlisted demo student, a V8 target, and
-- the known CONTENT_NOT_READY runtime state can be recovered.
create or replace function private.recover_bncc_v8_demo_preview_session(
  p_session_id uuid,
  p_institution_id uuid,
  p_student_id uuid,
  p_target_canonical_skill_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.learning_guided_sessions%rowtype;
  target_skill public.learning_curriculum_skills%rowtype;
  lesson_id uuid;
  next_position integer;
  recovered_step uuid;
begin
  if not private.bncc_demo_preview_allowed(p_institution_id, p_student_id) then
    return null;
  end if;

  select session.*
    into session_row
    from public.learning_guided_sessions session
   where session.id = p_session_id
     and session.institution_id = p_institution_id
     and session.student_id = p_student_id
     and session.target_canonical_skill_id = p_target_canonical_skill_id
     and session.planner_version = 'V4'
     and session.status = 'PAUSED'
     and session.current_step_id is null
     and session.metadata->>'adaptive_policy_version' = 'V8'
     and session.metadata->>'runtime_reason' = 'CONTENT_NOT_READY'
   for update;
  if not found then
    return null;
  end if;

  select skill.*
    into target_skill
    from public.learning_curriculum_skills skill
   where skill.id = p_target_canonical_skill_id
     and skill.active
     and skill.node_kind = 'LEAF'
     and skill.bncc_alignment_status = 'CANDIDATE'
     and skill.publication_status = 'STAGING'
     and skill.content_readiness = 'CONTENT_READY'
     and not skill.mastery_targetable
     and skill.metadata->>'content_pack' = 'TECESCOLA_BNCC_DEEP_LEARNING_V8';
  if not found then
    return null;
  end if;

  select lesson.id
    into lesson_id
    from public.learning_skill_lessons lesson
   where lesson.canonical_skill_id = p_target_canonical_skill_id
     and lesson.active
   order by lesson.version desc, lesson.id
   limit 1;
  if lesson_id is null then
    return null;
  end if;

  select coalesce(max(step.position), -1) + 1
    into next_position
    from public.learning_guided_steps step
   where step.session_id = session_row.id;

  insert into public.learning_guided_steps(
    institution_id, session_id, canonical_skill_id, step_type, purpose,
    position, status, lesson_id, started_at, metadata
  ) values (
    p_institution_id, session_row.id, p_target_canonical_skill_id, 'LESSON', null,
    next_position, 'ACTIVE', lesson_id, now(),
    jsonb_build_object('demo_preview_recovery', true, 'recovered_from', 'CONTENT_NOT_READY', 'content_version', 5)
  ) returning id into recovered_step;

  update public.learning_guided_sessions
     set status = 'ACTIVE',
         current_step_id = recovered_step,
         current_canonical_skill_id = p_target_canonical_skill_id,
         decision_reason = 'V8_PREVIEW_RECOVERY',
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
           'runtime_reason', null,
           'demo_preview_recovery', true,
           'recovered_from', 'CONTENT_NOT_READY'
         ),
         updated_at = now()
   where id = session_row.id;

  insert into public.learning_guided_session_events(
    institution_id, session_id, student_id, event_type, step_id, idempotency_key, payload
  ) values (
    p_institution_id, session_row.id, p_student_id, 'REPLANNED', recovered_step,
    'v8-demo-recovery:' || session_row.id::text,
    jsonb_build_object('step_type', 'LESSON', 'reason', 'V8_PREVIEW_RECOVERY', 'demo_preview', true)
  );

  return recovered_step;
end;
$$;

revoke all on function private.recover_bncc_v8_demo_preview_session(uuid, uuid, uuid, uuid) from public, anon, authenticated;

-- The V7 transition guard remains valid for its own preview pack. Extend the
-- same narrow allowlist check to V8 without relaxing ordinary V4 behavior.
do $migration$
declare
  function_row record;
begin
  for function_row in
    select pg_get_functiondef(proc.oid) as definition
      from pg_proc proc
      join pg_namespace namespace on namespace.oid = proc.pronamespace
     where namespace.nspname = 'private'
       and proc.proname = 'append_guided_v4_next_step'
       and pg_get_functiondef(proc.oid) like '%TECESCOLA_BNCC_HIGH_SCHOOL_FIRST_YEAR_V4%'
  loop
    execute replace(
      function_row.definition,
      'preview_skill.metadata->>''content_pack'' = ''TECESCOLA_BNCC_HIGH_SCHOOL_FIRST_YEAR_V4''',
      'preview_skill.metadata->>''content_pack'' in (''TECESCOLA_BNCC_HIGH_SCHOOL_FIRST_YEAR_V4'', ''TECESCOLA_BNCC_DEEP_LEARNING_V8'')'
    );
  end loop;
end;
$migration$;

-- Preserve the V8 session when it has a paused current step and recover only
-- the exact state produced by the legacy CONTENT_NOT_READY guard.
do $migration$
declare
  function_row record;
begin
  for function_row in
    select pg_get_functiondef(proc.oid) as definition
      from pg_proc proc
      join pg_namespace namespace on namespace.oid = proc.pronamespace
     where namespace.nspname = 'public'
       and proc.proname = 'start_guided_learning_session_v4'
       and pg_get_functiondef(proc.oid) like '%if found and existing.planner_version = ''V4'' then%'
  loop
    execute replace(
      function_row.definition,
      $old$  if found and existing.planner_version = 'V4' then
    return jsonb_build_object('session_id', existing.id, 'created', false, 'current_step_id', existing.current_step_id, 'engine_version', 'V4');
  end if;$old$,
      $new$  if found and existing.planner_version = 'V4' then
    if existing.current_step_id is null and v8_demo then
      first_step := private.recover_bncc_v8_demo_preview_session(existing.id, p_institution_id, p_student_id, p_target_canonical_skill_id);
    end if;
    return jsonb_build_object('session_id', existing.id, 'created', false, 'current_step_id', coalesce(first_step, existing.current_step_id), 'engine_version', 'V4');
  end if;$new$
    );
  end loop;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
