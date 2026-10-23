begin;

-- Forward-only migration ID assigned after checking live ledger and PR collisions.

create or replace function public.list_teacher_learning_students(
  p_institution_id uuid,
  p_class_id uuid,
  p_subject_id uuid
)
returns table(
  student_id uuid,
  full_name text,
  class_id uuid,
  class_name text,
  open_error_count bigint,
  average_mastery numeric,
  active_session_status text,
  target_skill_title text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    student.id,
    coalesce(profile.full_name, 'Aluno'),
    enrolled_class.id,
    enrolled_class.name,
    error_summary.open_error_count,
    mastery_summary.average_mastery,
    (
      select session.status
        from public.learning_guided_sessions session
        join public.learning_curriculum_skills target_skill
          on target_skill.id = session.target_canonical_skill_id
       where session.institution_id = p_institution_id
         and session.student_id = student.id
         and session.class_id = p_class_id
         and session.status in ('ACTIVE', 'PAUSED', 'NEEDS_TEACHER_SUPPORT')
         and private.learning_teacher_skill_in_subject(
           p_institution_id,
           p_subject_id,
           target_skill.id
         )
       order by session.updated_at desc
       limit 1
    ),
    (
      select target_skill.title
        from public.learning_guided_sessions session
        join public.learning_curriculum_skills target_skill
          on target_skill.id = session.target_canonical_skill_id
       where session.institution_id = p_institution_id
         and session.student_id = student.id
         and session.class_id = p_class_id
         and session.status in ('ACTIVE', 'PAUSED', 'NEEDS_TEACHER_SUPPORT')
         and private.learning_teacher_skill_in_subject(
           p_institution_id,
           p_subject_id,
           target_skill.id
         )
       order by session.updated_at desc
       limit 1
    )
  from public.students student
  join public.profiles profile on profile.id = student.profile_id
  join public.enrollments enrollment
    on enrollment.student_id = student.id
   and enrollment.class_id = p_class_id
   and enrollment.active
   and lower(btrim(enrollment.status)) = 'active'
  join public.classes enrolled_class
    on enrolled_class.id = enrollment.class_id
   and enrolled_class.institution_id = p_institution_id
   and enrolled_class.active
  join public.subject_offerings offering
    on offering.class_id = enrolled_class.id
   and offering.subject_id = p_subject_id
   and offering.teacher_profile_id = auth.uid()
   and offering.active
  cross join lateral (
    select count(*)::bigint as open_error_count
      from public.learning_error_notebook error_note
     where error_note.institution_id = p_institution_id
       and error_note.student_id = student.id
       and error_note.status = 'OPEN'
       and error_note.canonical_skill_id is not null
       and private.learning_teacher_skill_in_subject(
         p_institution_id,
         p_subject_id,
         error_note.canonical_skill_id
       )
  ) error_summary
  cross join lateral (
    select round(avg(state_row.mastery_estimate)) as average_mastery
      from public.learning_student_skill_state state_row
     where state_row.institution_id = p_institution_id
       and state_row.student_id = student.id
       and state_row.evidence_count > 0
       and private.learning_teacher_skill_in_subject(
         p_institution_id,
         p_subject_id,
         state_row.canonical_skill_id
       )
  ) mastery_summary
  where student.institution_id = p_institution_id
    and student.active
    and private.learning_teacher_can_access_subject_scope(
      p_institution_id,
      p_class_id,
      p_subject_id,
      student.id
    )
  order by enrolled_class.name, profile.full_name;
$$;

create or replace function public.get_teacher_learning_student_detail(
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
as $$
declare
  student_row record;
begin
  if not private.learning_teacher_can_access_subject_scope(
    p_institution_id,
    p_class_id,
    p_subject_id,
    p_student_id
  ) then
    raise exception 'LEARNING_TEACHER_SUBJECT_SCOPE_DENIED';
  end if;

  select student.id, coalesce(profile.full_name, 'Aluno') as full_name,
         enrollment.class_id, enrolled_class.name as class_name
    into student_row
    from public.students student
    join public.profiles profile on profile.id = student.profile_id
    join public.enrollments enrollment
      on enrollment.student_id = student.id
     and enrollment.class_id = p_class_id
     and enrollment.active
     and lower(btrim(enrollment.status)) = 'active'
    join public.classes enrolled_class
      on enrolled_class.id = enrollment.class_id
     and enrolled_class.institution_id = p_institution_id
     and enrolled_class.active
   where student.id = p_student_id
     and student.institution_id = p_institution_id
     and student.active
   limit 1;

  return jsonb_build_object(
    'student', jsonb_build_object(
      'id', student_row.id,
      'full_name', student_row.full_name,
      'class_id', student_row.class_id,
      'class_name', student_row.class_name
    ),
    'progress', coalesce((
      select jsonb_agg(jsonb_build_object(
        'canonical_skill_id', state_row.canonical_skill_id,
        'skill_title', skill.title,
        'state', state_row.state,
        'mastery_estimate', state_row.mastery_estimate,
        'evidence_count', state_row.evidence_count,
        'confidence', state_row.confidence,
        'updated_at', state_row.updated_at
      ) order by state_row.updated_at desc)
        from public.learning_student_skill_state state_row
        join public.learning_curriculum_skills skill
          on skill.id = state_row.canonical_skill_id
       where state_row.institution_id = p_institution_id
         and state_row.student_id = p_student_id
         and private.learning_teacher_skill_in_subject(
           p_institution_id,
           p_subject_id,
           skill.id
         )
    ), '[]'::jsonb),
    'open_errors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', error_note.id,
        'question_id', error_note.question_id,
        'question_bank_id', error_note.question_bank_id,
        'canonical_skill_id', error_note.canonical_skill_id,
        'error_count', error_note.error_count,
        'last_missed_at', error_note.last_missed_at,
        'last_reviewed_at', error_note.last_reviewed_at
      ) order by error_note.last_missed_at desc)
        from public.learning_error_notebook error_note
       where error_note.institution_id = p_institution_id
         and error_note.student_id = p_student_id
         and error_note.status = 'OPEN'
         and private.learning_teacher_skill_in_subject(
           p_institution_id,
           p_subject_id,
           error_note.canonical_skill_id
         )
    ), '[]'::jsonb),
    'guided_sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', session.id,
        'target_canonical_skill_id', session.target_canonical_skill_id,
        'target_skill_title', target_skill.title,
        'status', session.status,
        'started_at', session.started_at,
        'completed_at', session.completed_at,
        'steps', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', step.id,
            'step_type', step.step_type,
            'position', step.position,
            'status', step.status,
            'attempts', step.attempts,
            'title', step_skill.title
          ) order by step.position)
            from public.learning_guided_steps step
            join public.learning_curriculum_skills step_skill
              on step_skill.id = step.canonical_skill_id
           where step.session_id = session.id
        ), '[]'::jsonb)
      ) order by session.updated_at desc)
        from public.learning_guided_sessions session
        join public.learning_curriculum_skills target_skill
          on target_skill.id = session.target_canonical_skill_id
       where session.institution_id = p_institution_id
         and session.student_id = p_student_id
         and session.class_id = p_class_id
         and private.learning_teacher_skill_in_subject(
           p_institution_id,
           p_subject_id,
           target_skill.id
         )
    ), '[]'::jsonb),
    'recent_attempts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', attempt.id,
        'activity_id', attempt.activity_id,
        'activity_title', activity.title,
        'score', attempt.score,
        'total_points', attempt.total_points,
        'completed_at', attempt.completed_at
      ) order by attempt.completed_at desc)
        from public.learning_attempts attempt
        join public.learning_activities activity
          on activity.id = attempt.activity_id
       where attempt.institution_id = p_institution_id
         and attempt.student_id = p_student_id
         and attempt.completed_at is not null
         and activity.teacher_id = auth.uid()
         and activity.subject_id = p_subject_id
         and exists (
           select 1 from public.learning_assignments assignment
            where assignment.activity_id = activity.id
              and assignment.class_id = p_class_id
         )
       limit 10
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_teacher_guided_learning_attempts(
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
as $$
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
$$;

revoke all on function public.list_teacher_learning_students(uuid, uuid, uuid) from public, anon;
revoke all on function public.get_teacher_learning_student_detail(uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.get_teacher_guided_learning_attempts(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.list_teacher_learning_students(uuid, uuid, uuid) to authenticated;
grant execute on function public.get_teacher_learning_student_detail(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.get_teacher_guided_learning_attempts(uuid, uuid, uuid, uuid) to authenticated;

commit;
