-- Allow institution-scoped ADMIN memberships for account-backed schools.
-- Account owners remain administrators through owns_institution().

create or replace function public.is_institution_admin(
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_institution_operational(target_institution_id)
    and (
      public.is_platform_super_admin()
      or public.owns_institution(target_institution_id)
      or exists (
        select 1
        from public.memberships as membership
        where membership.profile_id = auth.uid()
          and membership.institution_id = target_institution_id
          and membership.active is true
          and membership.role = any (
            array[
              'ADMIN'::public.user_role,
              'DIRECTOR'::public.user_role
            ]
          )
      )
    );
$$;

create or replace function public.can_manage_institution_operations(
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_institution_operational(target_institution_id)
    and (
      public.is_platform_super_admin()
      or public.owns_institution(target_institution_id)
      or exists (
        select 1
        from public.memberships as membership
        where membership.profile_id = auth.uid()
          and membership.institution_id = target_institution_id
          and membership.active is true
          and membership.role = any (
            array[
              'ADMIN'::public.user_role,
              'DIRECTOR'::public.user_role,
              'SECRETARY'::public.user_role
            ]
          )
      )
    );
$$;

revoke all on function public.is_institution_admin(uuid)
  from public, anon, authenticated;

revoke all on function public.can_manage_institution_operations(uuid)
  from public, anon, authenticated;

grant execute on function public.is_institution_admin(uuid)
  to authenticated, service_role;

grant execute on function public.can_manage_institution_operations(uuid)
  to authenticated, service_role;
