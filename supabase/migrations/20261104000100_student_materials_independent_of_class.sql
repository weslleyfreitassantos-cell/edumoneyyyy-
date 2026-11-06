begin;

create or replace function public.list_student_learning_subjects(p_institution_id uuid)
returns table (
  id uuid,
  name text,
  code text,
  has_published_activities boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    subject.id,
    subject.name,
    subject.code,
    exists (
      select 1
        from public.learning_activities activity
       where activity.institution_id = p_institution_id
         and activity.subject_id = subject.id
         and activity.status = 'PUBLISHED'
    ) as has_published_activities
    from public.subjects subject
   where subject.institution_id = p_institution_id
     and coalesce(subject.active, true)
     and exists (
       select 1
         from public.students student
        where student.profile_id = auth.uid()
          and student.institution_id = p_institution_id
          and student.active is true
     )
     and (
       exists (
         select 1
           from public.students student
           join public.enrollments enrollment
             on enrollment.student_id = student.id
            and enrollment.active is true
            and lower(enrollment.status) = 'active'
           join public.academic_years academic_year
             on academic_year.id = enrollment.academic_year_id
            and academic_year.institution_id = p_institution_id
            and academic_year.active is true
           join public.subject_offerings offering
             on offering.class_id = enrollment.class_id
            and offering.subject_id = subject.id
            and offering.active is true
          where student.profile_id = auth.uid()
            and student.institution_id = p_institution_id
            and student.active is true
       )
       or exists (
         select 1
           from public.learning_activities activity
          where activity.institution_id = p_institution_id
            and activity.subject_id = subject.id
            and activity.status = 'PUBLISHED'
       )
     )
   order by subject.name;
$$;

create or replace function public.list_student_learning_activities(p_institution_id uuid)
returns table (
  id uuid,
  subject_id uuid,
  unit_id uuid,
  skill_id uuid,
  teacher_id uuid,
  title text,
  description text,
  activity_type text,
  status text,
  created_at timestamptz,
  subjects jsonb,
  learning_questions jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    activity.id,
    activity.subject_id,
    activity.unit_id,
    activity.skill_id,
    activity.teacher_id,
    activity.title,
    activity.description,
    activity.activity_type,
    activity.status,
    activity.created_at,
    jsonb_build_object('name', subject.name),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', question.id,
            'question_text', question.question_text,
            'question_type', question.question_type,
            'options_json', question.options_json,
            'points', question.points,
            'sort_order', question.sort_order
          )
          order by question.sort_order, question.id
        )
          from public.learning_questions question
         where question.activity_id = activity.id
      ),
      '[]'::jsonb
    )
    from public.learning_activities activity
    join public.subjects subject
      on subject.id = activity.subject_id
   where activity.institution_id = p_institution_id
     and activity.status = 'PUBLISHED'
     and subject.institution_id = p_institution_id
     and coalesce(subject.active, true)
     and exists (
       select 1
         from public.students student
        where student.profile_id = auth.uid()
          and student.institution_id = p_institution_id
          and student.active is true
     )
   order by activity.created_at desc;
$$;

revoke all on function public.list_student_learning_subjects(uuid) from public, anon;
revoke all on function public.list_student_learning_activities(uuid) from public, anon;
grant execute on function public.list_student_learning_subjects(uuid) to authenticated;
grant execute on function public.list_student_learning_activities(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
