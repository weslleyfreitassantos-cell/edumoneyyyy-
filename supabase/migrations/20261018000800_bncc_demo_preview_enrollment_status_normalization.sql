create or replace function private.bncc_demo_preview_allowed(
  p_institution_id uuid,
  p_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from private.bncc_demo_preview_institutions preview
      join public.students student
        on student.institution_id = preview.institution_id
       and student.active
      join public.enrollments enrollment
        on enrollment.student_id = student.id
       and enrollment.active
       and upper(enrollment.status::text) = 'ACTIVE'
      join public.classes class
        on class.id = enrollment.class_id
       and class.institution_id = preview.institution_id
       and class.active
     where preview.institution_id = p_institution_id
       and preview.active
       and student.id = p_student_id
  );
$$;

revoke all on function private.bncc_demo_preview_allowed(uuid, uuid)
  from public, anon, authenticated;
