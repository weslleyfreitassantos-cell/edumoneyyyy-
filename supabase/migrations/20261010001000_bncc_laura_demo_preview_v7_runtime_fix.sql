begin;

-- Keep the normal V4 readiness gate intact. The only exception is the
-- already allowlisted demonstration institution and its four STAGING skills.
-- This repairs the lesson-to-practice transition without promoting content.
-- The seeded skills remain PEDAGOGICAL_REVIEW_PENDING.
do $migration$
declare
  function_row record;
begin
  for function_row in
    select pg_get_functiondef(proc.oid) as definition
      from pg_proc proc
      join pg_namespace namespace
        on namespace.oid = proc.pronamespace
     where namespace.nspname = 'private'
       and proc.proname = 'append_guided_v4_next_step'
       and pg_get_functiondef(proc.oid) like '%if coalesce(next_readiness, ''GRAPH_ONLY'') <> ''ADAPTIVE_READY'' then%'
  loop
    execute replace(
      function_row.definition,
      $old$if coalesce(next_readiness, 'GRAPH_ONLY') <> 'ADAPTIVE_READY' then$old$,
      $new$if coalesce(next_readiness, 'GRAPH_ONLY') <> 'ADAPTIVE_READY'
     and not (
       private.bncc_demo_preview_allowed(session_row.institution_id, session_row.student_id)
       and next_skill = session_row.target_canonical_skill_id
       and exists (
         select 1
           from public.learning_curriculum_skills preview_skill
          where preview_skill.id = next_skill
            and preview_skill.active
            and preview_skill.publication_status = 'STAGING'
            and preview_skill.content_readiness = 'CONTENT_READY'
            and not preview_skill.mastery_targetable
            and preview_skill.metadata->>'content_pack' = 'TECESCOLA_BNCC_HIGH_SCHOOL_FIRST_YEAR_V4'
       )
     ) then$new$
    );
  end loop;
end;
$migration$;

-- A previous attempt could already have persisted a demo session in PAUSED /
-- CONTENT_NOT_READY. Recovery is deliberately narrow and idempotent: it only
-- reopens the lesson for the allowlisted student and exact demo target.
create or replace function private.recover_bncc_demo_preview_session(
  p_session_id uuid,
  p_institution_id uuid,
  p_student_id uuid,
  p_target_canonical_skill_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
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
     and skill.publication_status = 'STAGING'
     and skill.content_readiness = 'CONTENT_READY'
     and not skill.mastery_targetable
     and skill.metadata->>'content_pack' = 'TECESCOLA_BNCC_HIGH_SCHOOL_FIRST_YEAR_V4';
  if not found then
    return null;
  end if;

  select lesson.id
    into lesson_id
    from public.learning_skill_lessons lesson
   where lesson.canonical_skill_id = p_target_canonical_skill_id
     and lesson.version = 4
     and lesson.active
   order by lesson.id
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
    jsonb_build_object('demo_preview_recovery', true, 'recovered_from', 'CONTENT_NOT_READY')
  ) returning id into recovered_step;

  update public.learning_guided_sessions
     set status = 'ACTIVE',
         current_step_id = recovered_step,
         current_canonical_skill_id = p_target_canonical_skill_id,
         decision_reason = 'V4_TARGET_READY',
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
    'v4-demo-recovery:' || session_row.id::text,
    jsonb_build_object('step_type', 'LESSON', 'reason', 'V4_TARGET_READY', 'demo_preview', true)
  );

  return recovered_step;
end;
$function$;

revoke all on function private.recover_bncc_demo_preview_session(uuid, uuid, uuid, uuid) from public, anon, authenticated;

do $migration$
declare
  function_row record;
begin
  for function_row in
    select pg_get_functiondef(proc.oid) as definition
      from pg_proc proc
      join pg_namespace namespace
        on namespace.oid = proc.pronamespace
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
    if existing.current_step_id is null then
      first_step := private.recover_bncc_demo_preview_session(existing.id, p_institution_id, p_student_id, p_target_canonical_skill_id);
    end if;
    return jsonb_build_object('session_id', existing.id, 'created', false, 'current_step_id', coalesce(first_step, existing.current_step_id), 'engine_version', 'V4');
  end if;$new$
    );
  end loop;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
