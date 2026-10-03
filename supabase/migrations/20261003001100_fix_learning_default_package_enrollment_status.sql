begin;

-- Keep the default-package RPC compatible with the canonical ACTIVE status
-- stored by the enrollment fixtures and the existing application services.
create or replace function public.list_student_learning_packages(
  p_institution_id uuid,
  p_student_id uuid
)
returns table (
  access_id uuid,
  package_id uuid,
  class_id uuid,
  student_id uuid,
  due_at timestamptz,
  access_source text,
  learning_packages jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  context_class_id uuid;
  context_grade text;
  context_stage text;
  context_grade_level smallint;
begin
  select enrollment.class_id, enrolled_class.grade_level
    into context_class_id, context_grade
    from public.enrollments enrollment
    join public.students student
      on student.id = enrollment.student_id
     and student.institution_id = p_institution_id
     and student.active
    join public.classes enrolled_class
      on enrolled_class.id = enrollment.class_id
     and enrolled_class.institution_id = p_institution_id
     and enrolled_class.active
   where enrollment.student_id = p_student_id
     and enrollment.active
     and upper(btrim(enrollment.status)) = 'ACTIVE'
   order by enrollment.enrolled_at desc nulls last
   limit 1;

  if context_class_id is null then
    raise exception 'LEARNING_PACKAGE_STUDENT_NOT_FOUND';
  end if;

  if not (
    exists (
      select 1 from public.students student
       where student.id = p_student_id
         and student.institution_id = p_institution_id
         and student.profile_id = auth.uid()
         and student.active
    )
    or public.can_manage_institution_operations(p_institution_id)
    or exists (
      select 1
        from public.subject_offerings offering
       where offering.class_id = context_class_id
         and offering.teacher_profile_id = auth.uid()
         and offering.active
    )
  ) then
    raise exception 'LEARNING_PACKAGE_STUDENT_SCOPE_DENIED';
  end if;

  context_grade := lower(coalesce(context_grade, ''));
  context_stage := case
    when context_grade ~ '(ensino médio|medio|m[eé]dio|s[eé]rie[[:space:]]+em|(^|[^a-z])em([^a-z]|$))'
      then 'ENSINO_MEDIO'
    else 'ENSINO_FUNDAMENTAL'
  end;
  context_grade_level := nullif((regexp_match(context_grade, '([0-9]{1,2})'))[1], '')::smallint;

  return query
  with eligible_packages as (
    select package.*
      from public.learning_packages package
     where package.active
       and (
         package.visibility = 'GLOBAL'
         or (package.institution_id = p_institution_id and package.visibility in ('INSTITUTION', 'PRIVATE'))
       )
       and (
         exists (
           select 1
             from public.learning_package_assignments assignment
            where assignment.institution_id = p_institution_id
              and assignment.package_id = package.id
              and (
                assignment.student_id = p_student_id
                or (assignment.student_id is null and assignment.class_id = context_class_id)
              )
         )
         or (
           package.package_type = 'TECESCOLA'
           and package.visibility = 'GLOBAL'
           and coalesce((package.metadata ->> 'automatic_default')::boolean, false)
           and (
             not exists (
               select 1 from public.learning_package_default_rules rule
                where rule.package_id = package.id and rule.active
             )
             or exists (
               select 1
                 from public.learning_package_default_rules rule
                where rule.package_id = package.id
                  and rule.active
                  and (rule.stage is null or rule.stage = context_stage)
                  and (rule.grade_level is null or rule.grade_level = context_grade_level)
                  and (
                    rule.subject_area is null
                    or upper(coalesce(package.subject_area, '')) = upper(rule.subject_area)
                  )
             )
           )
         )
       )
  )
  select
    coalesce(
      assignment.id,
      package.id
    ) as access_id,
    package.id as package_id,
    coalesce(assignment.class_id, context_class_id) as class_id,
    coalesce(assignment.student_id, p_student_id) as student_id,
    assignment.due_at,
    case when assignment.id is null then 'AUTOMATIC_DEFAULT' else 'EXPLICIT_ASSIGNMENT' end as access_source,
    jsonb_build_object(
      'id', package.id,
      'package_type', package.package_type,
      'visibility', package.visibility,
      'title', package.title,
      'description', package.description,
      'subject_area', package.subject_area,
      'learning_package_steps', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', step.id,
            'position', step.position,
            'step_type', step.step_type,
            'title', step.title,
            'lesson_id', step.lesson_id,
            'activity_id', step.activity_id
          ) order by step.position
        )
          from public.learning_package_steps step
         where step.package_id = package.id
      ), '[]'::jsonb)
    ) as learning_packages
    from eligible_packages package
    left join lateral (
      select assignment.id, assignment.class_id, assignment.student_id, assignment.due_at
        from public.learning_package_assignments assignment
       where assignment.institution_id = p_institution_id
         and assignment.package_id = package.id
         and (
           assignment.student_id = p_student_id
           or (assignment.student_id is null and assignment.class_id = context_class_id)
         )
       order by (assignment.student_id is not null) desc, assignment.created_at desc
       limit 1
    ) assignment on true
   order by package.created_at desc, package.title;
end;
$$;

notify pgrst, 'reload schema';
commit;
