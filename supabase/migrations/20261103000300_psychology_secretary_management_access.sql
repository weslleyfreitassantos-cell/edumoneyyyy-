begin;

-- Keep the school-management boundary explicit for every Psychology workflow.
-- The generic institution helper remains the source for platform-level access;
-- this membership check guarantees an active school secretary is included.
create or replace function private.psychology_is_manager(target_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_current_profile_active()
    and (
      public.can_manage_institution_operations(target_institution_id)
      or exists (
        select 1
        from public.memberships membership
        where membership.profile_id = auth.uid()
          and membership.institution_id = target_institution_id
          and membership.active is true
          and membership.role in (
            'DIRECTOR'::public.user_role,
            'SECRETARY'::public.user_role
          )
      )
    );
$$;

revoke all on function private.psychology_is_manager(uuid) from public, anon, authenticated;
grant execute on function private.psychology_is_manager(uuid) to authenticated, service_role;

commit;
