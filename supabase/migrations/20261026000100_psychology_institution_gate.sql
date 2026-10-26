create or replace function public.psychology_can_manage_module(target_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and private.is_current_profile_active()
    and private.psychology_is_manager(target_institution_id);
$$;

revoke all on function public.psychology_can_manage_module(uuid) from public, anon;
grant execute on function public.psychology_can_manage_module(uuid) to authenticated;

create or replace function public.psychology_list_my_authorization_targets(target_institution_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if auth.uid() is null or not private.is_current_profile_active()
    or not exists (select 1 from public.memberships membership
      where membership.profile_id = auth.uid()
        and membership.institution_id = target_institution_id and membership.active is true
        and membership.role in ('STUDENT'::public.user_role, 'GUARDIAN'::public.user_role)) then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  if not private.psychology_module_is_enabled(target_institution_id) then
    raise exception using message = 'MODULE_DISABLED', errcode = 'P0001';
  end if;

  with eligible_students as (
    select student.id as student_id, profile.full_name,
      student.birth_date > (current_date - interval '18 years')::date as is_minor
    from public.students student
    join public.profiles profile on profile.id = student.profile_id
    join public.memberships membership on membership.profile_id = student.profile_id
      and membership.institution_id = student.institution_id
    where student.institution_id = target_institution_id and student.active is true
      and profile.active is true and membership.active is true
      and membership.role = 'STUDENT'::public.user_role and student.profile_id = auth.uid()
    union
    select student.id as student_id, profile.full_name,
      student.birth_date > (current_date - interval '18 years')::date as is_minor
    from public.guardianships guardianship
    join public.students student on student.id = guardianship.student_id
      and student.institution_id = target_institution_id and student.active is true
    join public.profiles profile on profile.id = student.profile_id and profile.active is true
    join public.memberships student_membership on student_membership.profile_id = student.profile_id
      and student_membership.institution_id = student.institution_id
      and student_membership.active is true
      and student_membership.role = 'STUDENT'::public.user_role
    join public.memberships guardian_membership on guardian_membership.profile_id = auth.uid()
      and guardian_membership.institution_id = target_institution_id
      and guardian_membership.role = 'GUARDIAN'::public.user_role and guardian_membership.active is true
    where guardianship.guardian_profile_id = auth.uid() and guardianship.active is true
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'student_id', eligible.student_id,
    'student_name', eligible.full_name,
    'is_minor', eligible.is_minor,
    'authorization_status', coalesce(consent.status, 'NONE'),
    'is_signatory', consent.signatory_profile_id = auth.uid()
  ) order by eligible.full_name), '[]'::jsonb)
  into result
  from eligible_students eligible
  left join public.psychology_authorizations consent
    on consent.institution_id = target_institution_id
    and consent.student_id = eligible.student_id;
  return result;
end;
$$;

create or replace function public.psychology_revoke_authorization(target_student_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare institution_key uuid;
begin
  select consent.institution_id into institution_key
  from public.psychology_authorizations consent
  where consent.student_id = target_student_id and consent.status = 'ACTIVE'
    and (consent.signatory_profile_id = auth.uid()
      or exists (select 1 from public.students student where student.id = consent.student_id
        and student.profile_id = auth.uid() and student.birth_date <= (current_date - interval '18 years')::date));
  if institution_key is null then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  if not private.psychology_module_is_enabled(institution_key) then
    raise exception using message = 'MODULE_DISABLED', errcode = 'P0001';
  end if;

  update public.psychology_authorizations consent
  set status = 'REVOKED', revoked_at = now(), updated_at = now()
  where consent.student_id = target_student_id and consent.institution_id = institution_key
    and consent.status = 'ACTIVE'
    and (consent.signatory_profile_id = auth.uid()
      or exists (select 1 from public.students student where student.id = consent.student_id
        and student.profile_id = auth.uid() and student.birth_date <= (current_date - interval '18 years')::date));
  insert into public.psychology_audit_events (institution_id, actor_profile_id, action, subject_id)
  values (institution_key, auth.uid(), 'AUTHORIZATION_REVOKED', target_student_id);
end;
$$;

drop policy if exists psychology_authorizations_select on public.psychology_authorizations;
create policy psychology_authorizations_select on public.psychology_authorizations
  for select to authenticated using (
    public.psychology_module_enabled(psychology_authorizations.institution_id)
    and (
      psychology_authorizations.signatory_profile_id = (select auth.uid())
      or exists (select 1 from public.students student
        where student.id = psychology_authorizations.student_id and student.profile_id = (select auth.uid()))
      or exists (select 1 from public.psychology_assignments assignment
        where assignment.institution_id = psychology_authorizations.institution_id
          and assignment.student_id = psychology_authorizations.student_id
          and assignment.professional_profile_id = (select auth.uid())
          and private.psychology_professional_has_student_access(
            psychology_authorizations.institution_id, psychology_authorizations.student_id))
    )
  );

drop policy if exists psychology_professionals_select on public.psychology_professionals;
create policy psychology_professionals_select on public.psychology_professionals
  for select to authenticated using (
    exists (select 1 from public.psychology_professional_institutions link
      where link.professional_profile_id = psychology_professionals.profile_id
        and private.psychology_is_manager(link.institution_id))
    or (psychology_professionals.profile_id = (select auth.uid())
      and exists (select 1 from public.psychology_professional_institutions link
        where link.professional_profile_id = psychology_professionals.profile_id
          and public.psychology_module_enabled(link.institution_id)
          and private.psychology_is_professional(link.institution_id)))
  );

drop policy if exists psychology_professional_institutions_select on public.psychology_professional_institutions;
create policy psychology_professional_institutions_select on public.psychology_professional_institutions
  for select to authenticated using (
    private.psychology_is_manager(institution_id)
    or (professional_profile_id = (select auth.uid())
      and public.psychology_module_enabled(institution_id)
      and private.psychology_is_professional(institution_id))
  );

drop policy if exists psychology_assignments_select on public.psychology_assignments;
create policy psychology_assignments_select on public.psychology_assignments
  for select to authenticated using (
    private.psychology_is_manager(institution_id)
    or (public.psychology_module_enabled(institution_id)
      and (
        (professional_profile_id = (select auth.uid())
          and private.psychology_professional_has_student_access(institution_id, student_id))
        or exists (select 1 from public.students student
          where student.id = psychology_assignments.student_id
            and student.profile_id = (select auth.uid())
            and private.psychology_student_is_assigned(
              psychology_assignments.institution_id, psychology_assignments.student_id))
      ))
  );

drop policy if exists psychology_availability_rules_select on public.psychology_availability_rules;
create policy psychology_availability_rules_select on public.psychology_availability_rules
  for select to authenticated using (
    public.psychology_module_enabled(psychology_availability_rules.institution_id)
    and (
      psychology_availability_rules.professional_profile_id = (select auth.uid())
        and private.psychology_is_professional(psychology_availability_rules.institution_id)
      or private.psychology_is_manager(psychology_availability_rules.institution_id)
    )
  );

drop policy if exists psychology_availability_exceptions_select on public.psychology_availability_exceptions;
create policy psychology_availability_exceptions_select on public.psychology_availability_exceptions
  for select to authenticated using (
    public.psychology_module_enabled(psychology_availability_exceptions.institution_id)
    and (
      psychology_availability_exceptions.professional_profile_id = (select auth.uid())
        and private.psychology_is_professional(psychology_availability_exceptions.institution_id)
      or private.psychology_is_manager(psychology_availability_exceptions.institution_id)
    )
  );

revoke all on function public.psychology_list_my_authorization_targets(uuid),
  public.psychology_revoke_authorization(uuid) from public, anon, authenticated;
grant execute on function public.psychology_list_my_authorization_targets(uuid),
  public.psychology_revoke_authorization(uuid) to authenticated;
