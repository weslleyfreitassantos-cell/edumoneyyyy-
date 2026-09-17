-- Student and guardian academic views need the teacher name attached to an
-- offering. Keep the visibility tenant-scoped and read-only.
begin;

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
  )
);

notify pgrst, 'reload schema';
commit;
