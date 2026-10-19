begin;

-- Demo preview access is no longer gated by a manually maintained institution
-- allowlist. Keep authenticated student/institution scope and require an active
-- enrollment and active class in the requested institution. Consumers retain
-- their publication, mapping, grade, and pedagogical-review state checks.
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
  select private.learning_v2_scope_student(p_institution_id, p_student_id)
     and exists (
       select 1
         from public.students student
         join public.enrollments enrollment
           on enrollment.student_id = student.id
          and enrollment.active
          and upper(enrollment.status::text) = 'ACTIVE'
         join public.classes class
           on class.id = enrollment.class_id
          and class.institution_id = p_institution_id
          and class.active
        where student.id = p_student_id
          and student.institution_id = p_institution_id
          and student.active
     );
$$;

comment on function private.bncc_demo_preview_allowed(uuid, uuid) is
  'Allows technical demo preview for authenticated institution-scoped students with active enrollment and class; no institution allowlist is required. Content publication, mapping, grade, and review-state checks remain in consuming functions.';

revoke all on function private.bncc_demo_preview_allowed(uuid, uuid)
  from public, anon, authenticated;

commit;
