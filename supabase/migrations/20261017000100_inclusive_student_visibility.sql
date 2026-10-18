-- Allow the inclusive education selector to expose only students that the
-- current professional is authorized to support.
begin;

drop policy if exists students_select_policy
  on public.students;

create policy students_select_policy
on public.students
for select
to authenticated
using (
  private.is_current_profile_active()
  and (
    public.can_manage_institution_operations(institution_id)
    or profile_id = (select auth.uid())
    or private.is_guardian_of_student(id)
    or private.inclusive_teacher_can_student(institution_id, id)
    or private.inclusive_aee_can_student(institution_id, id)
  )
);

commit;
