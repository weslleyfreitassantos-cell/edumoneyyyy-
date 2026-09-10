-- Keep account administrators out of institution communication data.
-- DIRECTOR and SECRETARY remain the operational communication managers.

drop policy if exists institution_announcements_staff_select
  on public.institution_announcements;

create policy institution_announcements_staff_select
on public.institution_announcements
for select
to authenticated
using (
  private.has_institution_role(
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
  private.has_institution_role(
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
  private.has_institution_role(
    institution_id,
    array['DIRECTOR', 'SECRETARY']::public.user_role[]
  )
)
with check (
  private.has_institution_role(
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
  private.has_institution_role(
    institution_id,
    array['DIRECTOR', 'SECRETARY']::public.user_role[]
  )
);
