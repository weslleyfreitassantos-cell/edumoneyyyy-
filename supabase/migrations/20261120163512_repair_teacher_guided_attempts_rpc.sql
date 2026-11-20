begin;

-- Forward-only repair: the 20261022000100 migration is partly present on the production VPS.
-- Do not replace a function if a later deployment already provided one.
do $teacher_rpc_repair$
begin
  if to_regprocedure('public.get_teacher_guided_learning_attempts(uuid,uuid,uuid,uuid)') is null then
    execute $canonical_definition$
create function public.get_teacher_guided_learning_attempts(
  p_institution_id uuid,
  p_student_id uuid,
  p_class_id uuid,
  p_subject_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $rpc_body$
begin
  if not private.learning_teacher_can_access_subject_scope(
    p_institution_id,
    p_class_id,
    p_subject_id,
    p_student_id
  ) then
    raise exception 'LEARNING_TEACHER_SUBJECT_SCOPE_DENIED';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', recent.id,
      'source', recent.source,
      'activity_id', recent.activity_id,
      'activity_title', recent.activity_title,
      'score', recent.score,
      'total_points', recent.total_points,
      'completed_at', recent.completed_at
    ) order by recent.completed_at desc)
      from (
        select
          attempt.id,
          'GUIDED'::text as source,
          null::uuid as activity_id,
          concat_ws(' · ', skill.title, case coalesce(attempt.purpose, step.step_type)
            when 'PROBE' then 'Diagnóstico'
            when 'DIAGNOSTIC' then 'Diagnóstico'
            when 'PRACTICE' then 'Prática'
            when 'TRANSFER' then 'Transferência'
            when 'LOCK_IN' then 'Consolidação'
            when 'REVIEW' then 'Revisão'
            else 'Estudo guiado'
          end) as activity_title,
          attempt.correct_count::numeric as score,
          attempt.total_questions::numeric as total_points,
          attempt.submitted_at as completed_at
        from public.learning_guided_step_attempts attempt
        join public.learning_guided_sessions session
          on session.id = attempt.session_id
         and session.institution_id = attempt.institution_id
         and session.student_id = attempt.student_id
        join public.learning_guided_steps step
          on step.id = attempt.step_id
         and step.session_id = session.id
        join public.learning_curriculum_skills skill
          on skill.id = step.canonical_skill_id
       where attempt.institution_id = p_institution_id
         and attempt.student_id = p_student_id
         and session.class_id = p_class_id
         and private.learning_teacher_skill_in_subject(
           p_institution_id,
           p_subject_id,
           skill.id
         )
       order by attempt.submitted_at desc
       limit 10
      ) recent
  ), '[]'::jsonb);
end;
$rpc_body$;
    $canonical_definition$;
  end if;
end;
$teacher_rpc_repair$;

revoke all on function public.get_teacher_guided_learning_attempts(uuid,uuid,uuid,uuid)
  from public, anon;
grant execute on function public.get_teacher_guided_learning_attempts(uuid,uuid,uuid,uuid)
  to authenticated;

commit;
