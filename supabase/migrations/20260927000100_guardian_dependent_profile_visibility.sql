-- Allow guardians to read only profiles of their active, linked students.
begin;

create or replace function private.can_guardian_view_student_profile(
  target_profile_id uuid
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
      from public.students as student
      join public.profiles as student_profile
        on student_profile.id = student.profile_id
       and student_profile.active is true
      join public.guardianships as guardianship
        on guardianship.student_id = student.id
       and guardianship.guardian_profile_id = (select auth.uid())
       and guardianship.active is true
      join public.memberships as guardian_membership
        on guardian_membership.profile_id = (select auth.uid())
       and guardian_membership.institution_id = student.institution_id
       and guardian_membership.role = 'GUARDIAN'::public.user_role
       and guardian_membership.active is true
      where student.profile_id = target_profile_id
        and student.active is true
        and public.is_institution_operational(student.institution_id)
    );
$$;

alter function private.can_guardian_view_student_profile(uuid)
  owner to postgres;

revoke all on function private.can_guardian_view_student_profile(uuid)
  from public, anon, authenticated;

grant execute on function private.can_guardian_view_student_profile(uuid)
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
    id = (select auth.uid())
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
    or private.can_guardian_view_student_profile(profiles.id)
  )
);

notify pgrst, 'reload schema';

commit;
