-- Keep account administrators out of institution communication data.
-- DIRECTOR and SECRETARY remain the operational communication managers.

create or replace function private.has_exact_institution_role(
  target_institution_id uuid,
  allowed_roles public.user_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships as membership
    where membership.profile_id = auth.uid()
      and membership.institution_id = target_institution_id
      and membership.active is true
      and membership.role = any (allowed_roles)
  );
$$;

revoke all on function private.has_exact_institution_role(uuid, public.user_role[])
  from public, anon, authenticated;

grant execute on function private.has_exact_institution_role(uuid, public.user_role[])
  to authenticated, service_role;

drop policy if exists institution_announcements_staff_select
  on public.institution_announcements;

create policy institution_announcements_staff_select
on public.institution_announcements
for select
to authenticated
using (
  private.has_exact_institution_role(
    institution_id,
    array['DIRECTOR', 'SECRETARY']::public.user_role[]
  )
);

drop policy if exists institution_announcements_staff_insert
  on public.institution_announcements;

create policy institution_announcements_staff_insert
on public.institution_announcements
for insert
to authenticated
with check (
  private.has_exact_institution_role(
    institution_id,
    array['DIRECTOR', 'SECRETARY']::public.user_role[]
  )
  and created_by = auth.uid()
);

drop policy if exists institution_announcements_staff_update
  on public.institution_announcements;

create policy institution_announcements_staff_update
on public.institution_announcements
for update
to authenticated
using (
  private.has_exact_institution_role(
    institution_id,
    array['DIRECTOR', 'SECRETARY']::public.user_role[]
  )
)
with check (
  private.has_exact_institution_role(
    institution_id,
    array['DIRECTOR', 'SECRETARY']::public.user_role[]
  )
);

drop policy if exists institution_announcements_staff_delete
  on public.institution_announcements;

create policy institution_announcements_staff_delete
on public.institution_announcements
for delete
to authenticated
using (
  private.has_exact_institution_role(
    institution_id,
    array['DIRECTOR', 'SECRETARY']::public.user_role[]
  )
);
