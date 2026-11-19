begin;

grant usage on schema private to authenticated, service_role;

create or replace function private.inclusive_member_belongs(
  target_institution_id uuid,
  target_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships membership
    where membership.profile_id = target_profile_id
      and membership.institution_id = target_institution_id
      and membership.active is true
      and membership.role in ('ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER')
  );
$$;

create or replace function private.inclusive_document_belongs(
  target_institution_id uuid,
  target_document_type text,
  target_document_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case target_document_type
    when 'PEI' then exists (
      select 1
      from public.inclusive_pei_plans plan
      where plan.id = target_document_id
        and plan.institution_id = target_institution_id
    )
    when 'AEE' then exists (
      select 1
      from public.inclusive_aee_plans plan
      where plan.id = target_document_id
        and plan.institution_id = target_institution_id
    )
    else false
  end;
$$;

drop policy if exists inclusive_aee_assignment_select on public.inclusive_aee_assignments;
create policy inclusive_aee_assignment_select
on public.inclusive_aee_assignments
for select
to authenticated
using (
  private.inclusive_student_belongs(institution_id, student_id)
  and (
    private.inclusive_is_manager(institution_id)
    or (
      professional_profile_id = (select auth.uid())
      and private.inclusive_member_belongs(institution_id, professional_profile_id)
    )
  )
);

drop policy if exists inclusive_aee_assignment_write on public.inclusive_aee_assignments;
create policy inclusive_aee_assignment_write
on public.inclusive_aee_assignments
for all
to authenticated
using (
  private.inclusive_student_belongs(institution_id, student_id)
  and private.inclusive_is_manager(institution_id)
)
with check (
  private.inclusive_student_belongs(institution_id, student_id)
  and private.inclusive_member_belongs(institution_id, professional_profile_id)
  and private.inclusive_is_manager(institution_id)
);

drop policy if exists inclusive_revision_select on public.inclusive_document_revisions;
create policy inclusive_revision_select
on public.inclusive_document_revisions
for select
to authenticated
using (
  private.inclusive_is_manager(institution_id)
  and private.inclusive_document_belongs(institution_id, document_type, document_id)
);

drop policy if exists inclusive_revision_insert on public.inclusive_document_revisions;
create policy inclusive_revision_insert
on public.inclusive_document_revisions
for insert
to authenticated
with check (
  private.inclusive_is_manager(institution_id)
  and private.inclusive_document_belongs(institution_id, document_type, document_id)
  and changed_by = (select auth.uid())
);

revoke all on function private.inclusive_member_belongs(uuid, uuid) from public, anon, authenticated;
revoke all on function private.inclusive_document_belongs(uuid, text, uuid) from public, anon, authenticated;
grant execute on function private.inclusive_member_belongs(uuid, uuid) to authenticated;
grant execute on function private.inclusive_document_belongs(uuid, text, uuid) to authenticated;

commit;
