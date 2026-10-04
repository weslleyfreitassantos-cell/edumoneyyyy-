begin;

-- The pedagogical surface is authorized by the teacher's actual offering,
-- not by tenant membership alone.  The subject link is the canonical bridge
-- between an institutional subject and the adaptive curriculum area.
create or replace function private.learning_teacher_subject_area(
  target_institution_id uuid,
  target_subject_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select link.subject_area
    from public.learning_curriculum_subject_links link
   where link.institution_id = target_institution_id
     and link.subject_id = target_subject_id
     and link.active
   limit 1;
$$;

create or replace function private.learning_teacher_can_access_subject_scope(
  target_institution_id uuid,
  target_class_id uuid,
  target_subject_id uuid,
  target_student_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.memberships membership
      join public.classes school_class
        on school_class.id = target_class_id
       and school_class.institution_id = target_institution_id
       and school_class.active
      join public.subjects subject
        on subject.id = target_subject_id
       and subject.institution_id = target_institution_id
       and subject.active
      join public.subject_offerings offering
        on offering.class_id = school_class.id
       and offering.subject_id = subject.id
       and offering.teacher_profile_id = auth.uid()
       and offering.active
     where membership.profile_id = auth.uid()
       and membership.institution_id = target_institution_id
       and membership.role = 'TEACHER'::public.user_role
       and membership.active
       and (
         target_student_id is null
         or exists (
           select 1
             from public.enrollments enrollment
            where enrollment.student_id = target_student_id
              and enrollment.class_id = school_class.id
              and enrollment.active
              and lower(btrim(enrollment.status)) = 'active'
         )
       )
  );
$$;

create or replace function private.learning_teacher_skill_in_subject(
  target_institution_id uuid,
  target_subject_id uuid,
  target_skill_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.learning_curriculum_skills skill
     where skill.id = target_skill_id
       and skill.active
       and skill.subject_area = private.learning_teacher_subject_area(
         target_institution_id,
         target_subject_id
       )
  );
$$;

create or replace function public.list_teacher_learning_subjects(p_institution_id uuid)
returns table(subject_id uuid, subject_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select subject.id, subject.name
    from public.memberships membership
    join public.subject_offerings offering
      on offering.teacher_profile_id = auth.uid()
     and offering.active
    join public.classes school_class
      on school_class.id = offering.class_id
     and school_class.institution_id = p_institution_id
     and school_class.active
    join public.subjects subject
      on subject.id = offering.subject_id
     and subject.institution_id = p_institution_id
     and subject.active
   where membership.profile_id = auth.uid()
     and membership.institution_id = p_institution_id
     and membership.role = 'TEACHER'::public.user_role
     and membership.active
   group by subject.id, subject.name
   order by subject.name;
$$;

create or replace function public.list_teacher_learning_classes(
  p_institution_id uuid,
  p_subject_id uuid
)
returns table(class_id uuid, class_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select school_class.id, school_class.name
    from public.memberships membership
    join public.subject_offerings offering
      on offering.teacher_profile_id = auth.uid()
     and offering.subject_id = p_subject_id
     and offering.active
    join public.subjects subject
      on subject.id = offering.subject_id
     and subject.institution_id = p_institution_id
     and subject.active
    join public.classes school_class
      on school_class.id = offering.class_id
     and school_class.institution_id = p_institution_id
     and school_class.active
   where membership.profile_id = auth.uid()
     and membership.institution_id = p_institution_id
     and membership.role = 'TEACHER'::public.user_role
     and membership.active
   group by school_class.id, school_class.name
   order by school_class.name;
$$;

drop function if exists public.list_teacher_learning_students(uuid);
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
    count(distinct error_note.id) filter (
      where error_note.canonical_skill_id is not null
        and private.learning_teacher_skill_in_subject(
          p_institution_id,
          p_subject_id,
          error_note.canonical_skill_id
        )
    ),
    coalesce(round(avg(state_row.mastery_estimate)), 0),
    (
      select session.status
        from public.learning_guided_sessions session
        join public.learning_curriculum_skills target_skill
          on target_skill.id = session.target_canonical_skill_id
       where session.institution_id = p_institution_id
         and session.student_id = student.id
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
  left join public.learning_error_notebook error_note
    on error_note.institution_id = p_institution_id
   and error_note.student_id = student.id
   and error_note.status = 'OPEN'
  left join public.learning_student_skill_state state_row
    on state_row.institution_id = p_institution_id
   and state_row.student_id = student.id
   and private.learning_teacher_skill_in_subject(
     p_institution_id,
     p_subject_id,
     state_row.canonical_skill_id
   )
  where student.institution_id = p_institution_id
    and student.active
    and private.learning_teacher_can_access_subject_scope(
      p_institution_id,
      p_class_id,
      p_subject_id,
      student.id
    )
  group by student.id, profile.full_name, enrolled_class.id, enrolled_class.name
  order by enrolled_class.name, profile.full_name;
$$;

drop function if exists public.get_teacher_learning_student_detail(uuid, uuid);
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

drop function if exists public.get_teacher_student_knowledge_graph_v3(uuid, uuid);
create or replace function public.get_teacher_student_knowledge_graph_v3(
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
    raise exception 'LEARNING_KNOWLEDGE_GRAPH_SCOPE_DENIED';
  end if;

  return jsonb_build_object(
    'student_id', p_student_id,
    'skills', coalesce((
      select jsonb_agg(jsonb_build_object(
        'subject', subject.code,
        'subject_name', subject.name,
        'skill', skill.code,
        'skill_title', skill.title,
        'state', coalesce(state.state, 'UNKNOWN'),
        'mastery', coalesce(state.mastery_estimate, 0),
        'confidence', coalesce(state.confidence, 0),
        'evidence_count', coalesce(state.evidence_count, 0),
        'strong_evidence_count', coalesce(state.strong_evidence_count, 0),
        'last_evidence_at', state.last_evidence_at,
        'confirmed_misconceptions', coalesce((
          select jsonb_agg(jsonb_build_object(
            'code', tag.code,
            'state', signal.state,
            'confidence', signal.confidence
          ))
            from public.learning_misconception_signals signal
            join public.learning_misconception_tags tag
              on tag.id = signal.misconception_tag_id
           where signal.institution_id = p_institution_id
             and signal.student_id = p_student_id
             and signal.canonical_skill_id = skill.id
             and signal.state in ('CONFIRMED', 'RECOVERING')
        ), '[]'::jsonb)
      ) order by subject.code, skill.code)
        from public.learning_curriculum_skills skill
        join public.learning_canonical_subjects subject
          on subject.id = skill.canonical_subject_id
         and subject.active
        left join public.learning_student_skill_state state
          on state.institution_id = p_institution_id
         and state.student_id = p_student_id
         and state.canonical_skill_id = skill.id
       where skill.active
         and private.learning_teacher_skill_in_subject(
           p_institution_id,
           p_subject_id,
           skill.id
         )
    ), '[]'::jsonb)
  );
end;
$$;

drop function if exists public.get_teacher_class_knowledge_heatmap_v3(uuid, uuid);
create or replace function public.get_teacher_class_knowledge_heatmap_v3(
  p_institution_id uuid,
  p_class_id uuid,
  p_subject_id uuid
)
returns table(
  subject_code text,
  skill_code text,
  mastered_count integer,
  practicing_count integer,
  needs_review_count integer,
  unknown_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.learning_teacher_can_access_subject_scope(
    p_institution_id,
    p_class_id,
    p_subject_id
  ) then
    raise exception 'LEARNING_TEACHER_SUBJECT_SCOPE_DENIED';
  end if;

  return query
  select subject.code, skill.code,
    count(*) filter (where state.state = 'MASTERED')::integer,
    count(*) filter (where state.state in ('INTRODUCED', 'PRACTICING'))::integer,
    count(*) filter (where state.state = 'NEEDS_REVIEW')::integer,
    count(*) filter (where state.state is null or state.state = 'UNKNOWN')::integer
    from public.enrollments enrollment
    join public.students student
      on student.id = enrollment.student_id
     and student.institution_id = p_institution_id
     and student.active
    cross join public.learning_curriculum_skills skill
    join public.learning_canonical_subjects subject
      on subject.id = skill.canonical_subject_id
     and subject.active
    left join public.learning_student_skill_state state
      on state.institution_id = p_institution_id
     and state.student_id = student.id
     and state.canonical_skill_id = skill.id
   where enrollment.class_id = p_class_id
     and enrollment.active
     and lower(btrim(enrollment.status)) = 'active'
     and skill.active
     and private.learning_teacher_skill_in_subject(
       p_institution_id,
       p_subject_id,
       skill.id
     )
   group by subject.code, skill.code
   order by subject.code, skill.code;
end;
$$;

revoke all on function public.list_teacher_learning_subjects(uuid) from public, anon;
revoke all on function public.list_teacher_learning_classes(uuid, uuid) from public, anon;
revoke all on function public.list_teacher_learning_students(uuid, uuid, uuid) from public, anon;
revoke all on function public.get_teacher_learning_student_detail(uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.get_teacher_student_knowledge_graph_v3(uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.get_teacher_class_knowledge_heatmap_v3(uuid, uuid, uuid) from public, anon;
grant execute on function public.list_teacher_learning_subjects(uuid) to authenticated;
grant execute on function public.list_teacher_learning_classes(uuid, uuid) to authenticated;
grant execute on function public.list_teacher_learning_students(uuid, uuid, uuid) to authenticated;
grant execute on function public.get_teacher_learning_student_detail(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.get_teacher_student_knowledge_graph_v3(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.get_teacher_class_knowledge_heatmap_v3(uuid, uuid, uuid) to authenticated;

revoke all on function private.learning_teacher_subject_area(uuid, uuid) from public, anon, authenticated;
revoke all on function private.learning_teacher_can_access_subject_scope(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.learning_teacher_skill_in_subject(uuid, uuid, uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
