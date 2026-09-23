-- Allow students and guardians to read only the teacher profiles attached to
-- an active offering for an active enrollment they are allowed to see.
begin;

create or replace function private.can_view_teacher_profile(
  target_teacher_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_current_profile_active()
    and exists (
      select 1
      from public.memberships as teacher_membership
      join public.subject_offerings as offering
        on offering.teacher_profile_id = teacher_membership.profile_id
       and offering.active is true
      join public.classes as class_record
        on class_record.id = offering.class_id
       and class_record.active is true
      join public.enrollments as enrollment
        on enrollment.class_id = class_record.id
       and enrollment.active is true
      join public.students as student
        on student.id = enrollment.student_id
       and student.active is true
      join public.memberships as student_membership
        on student_membership.profile_id = student.profile_id
       and student_membership.institution_id = student.institution_id
       and student_membership.active is true
       and student_membership.role = 'STUDENT'::public.user_role
      where teacher_membership.profile_id = target_teacher_profile_id
        and teacher_membership.institution_id = class_record.institution_id
        and teacher_membership.active is true
        and teacher_membership.role = 'TEACHER'::public.user_role
        and public.is_institution_operational(class_record.institution_id)
        and (
          student.profile_id = auth.uid()
          or exists (
            select 1
            from public.guardianships as guardianship
            where guardianship.student_id = student.id
              and guardianship.guardian_profile_id = auth.uid()
              and guardianship.active is true
          )
        )
    );
$$;

alter function private.can_view_teacher_profile(uuid) owner to postgres;

revoke all on function private.can_view_teacher_profile(uuid)
  from public, anon;

grant execute on function private.can_view_teacher_profile(uuid)
  to authenticated, service_role;

drop policy if exists profiles_select_policy
  on public.profiles;

create policy profiles_select_policy
on public.profiles
for select
to authenticated
using (
  private.is_current_profile_active()
  and (
    id = auth.uid()
    or public.is_platform_super_admin()
    or exists (
      select 1
      from public.memberships as membership
      where membership.profile_id = profiles.id
        and (
          private.has_exact_institution_role(
            membership.institution_id,
            array['DIRECTOR', 'SECRETARY']::public.user_role[]
          )
          or (
            membership.role = 'DIRECTOR'::public.user_role
            and public.owns_institution(membership.institution_id)
          )
        )
    )
    or exists (
      select 1
      from public.memberships as teacher_membership
      where teacher_membership.profile_id = profiles.id
        and teacher_membership.role = 'TEACHER'::public.user_role
        and teacher_membership.active is true
        and private.can_access_academic_institution(
          teacher_membership.institution_id
        )
    )
    or private.can_view_teacher_profile(profiles.id)
  )
);

notify pgrst, 'reload schema';

commit;
