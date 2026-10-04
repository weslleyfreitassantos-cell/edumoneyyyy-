begin;

-- Keep the teacher roster aligned with the knowledge map when legacy imports
-- use ACTIVE instead of the canonical lowercase enrollment status.
create or replace function public.list_teacher_learning_students(p_institution_id uuid)
returns table (
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
    count(distinct error_note.id),
    coalesce(round(avg(state_row.mastery_estimate), 0), 0),
    (
      select session.status
        from public.learning_guided_sessions session
       where session.institution_id = p_institution_id
         and session.student_id = student.id
       order by session.updated_at desc
       limit 1
    ),
    (
      select skill.title
        from public.learning_guided_sessions session
        join public.learning_curriculum_skills skill
          on skill.id = session.target_canonical_skill_id
       where session.institution_id = p_institution_id
         and session.student_id = student.id
       order by session.updated_at desc
       limit 1
    )
  from public.students student
  join public.profiles profile on profile.id = student.profile_id
  join public.enrollments enrollment
    on enrollment.student_id = student.id
   and enrollment.active
   and lower(btrim(enrollment.status)) = 'active'
  join public.classes enrolled_class
    on enrolled_class.id = enrollment.class_id
   and enrolled_class.institution_id = p_institution_id
   and enrolled_class.active
  left join public.learning_error_notebook error_note
    on error_note.institution_id = p_institution_id
   and error_note.student_id = student.id
   and error_note.status = 'OPEN'
  left join public.learning_student_skill_state state_row
    on state_row.institution_id = p_institution_id
   and state_row.student_id = student.id
  where student.institution_id = p_institution_id
    and student.active
    and (
      public.can_manage_institution_operations(p_institution_id)
      or private.learning_teacher_can_access_student_any(p_institution_id, student.id)
    )
  group by student.id, profile.full_name, enrolled_class.id, enrolled_class.name
  order by enrolled_class.name, profile.full_name;
$$;

commit;
