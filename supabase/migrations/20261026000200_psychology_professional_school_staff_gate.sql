create or replace function private.psychology_can_manage_professionals(target_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and private.psychology_is_manager(target_institution_id)
    and exists (
      select 1
        from public.memberships membership
       where membership.profile_id = auth.uid()
         and membership.institution_id = target_institution_id
         and membership.active is true
         and membership.role in (
           'DIRECTOR'::public.user_role,
           'SECRETARY'::public.user_role
         )
    );
$$;

revoke all on function private.psychology_can_manage_professionals(uuid)
  from public, anon;
grant execute on function private.psychology_can_manage_professionals(uuid)
  to authenticated, service_role;

create or replace function public.psychology_register_professional(
  target_institution_id uuid,
  target_profile_id uuid,
  target_crp_registration text,
  target_crp_state text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare changed_profile uuid;
begin
  if not private.psychology_can_manage_professionals(target_institution_id) then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  if not exists (
    select 1
      from public.memberships membership
      join public.profiles profile on profile.id = membership.profile_id
     where membership.profile_id = target_profile_id
       and membership.institution_id = target_institution_id
       and membership.role = 'PSYCHOLOGIST'::public.user_role
       and membership.active is true
       and profile.active is true
  ) then
    raise exception using message = 'PROFESSIONAL_MEMBERSHIP_REQUIRED', errcode = 'P0001';
  end if;
  if target_crp_registration !~ '^[0-9./-]{2,20}$'
    or upper(target_crp_state) !~ '^[A-Z]{2}$' then
    raise exception using message = 'INVALID_PROFESSIONAL_REGISTRATION', errcode = 'P0001';
  end if;
  insert into public.psychology_professionals (profile_id, crp_registration, crp_state)
  values (target_profile_id, target_crp_registration, upper(target_crp_state))
  on conflict (profile_id) do update set
    crp_registration = excluded.crp_registration,
    crp_state = excluded.crp_state,
    verification_status = case
      when public.psychology_professionals.verification_status = 'VERIFIED' then 'PENDING'
      else public.psychology_professionals.verification_status
    end,
    verified_at = null,
    verified_by = null,
    updated_at = now()
  returning profile_id into changed_profile;

  insert into public.psychology_professional_institutions (
    professional_profile_id, institution_id, active
  ) values (changed_profile, target_institution_id, false)
  on conflict (professional_profile_id, institution_id) do nothing;

  insert into public.psychology_audit_events (
    institution_id, actor_profile_id, action, subject_id
  ) values (
    target_institution_id, auth.uid(), 'PROFESSIONAL_REGISTERED', target_profile_id
  );

  return jsonb_build_object('profile_id', changed_profile, 'verification_status', 'PENDING');
end;
$$;

create or replace function public.psychology_verify_professional(
  target_institution_id uuid,
  target_profile_id uuid,
  human_crp_verified boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.psychology_can_manage_professionals(target_institution_id)
    or human_crp_verified is not true then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;

  update public.psychology_professionals professional
     set verification_status = 'VERIFIED',
         verified_at = now(),
         verified_by = auth.uid(),
         updated_at = now()
   where professional.profile_id = target_profile_id
     and professional.active is true
     and exists (
       select 1
         from public.psychology_professional_institutions link
        where link.professional_profile_id = professional.profile_id
          and link.institution_id = target_institution_id
     );
  if not found then
    raise exception using message = 'PROFESSIONAL_NOT_FOUND', errcode = 'P0001';
  end if;

  update public.psychology_professional_institutions
     set active = true
   where professional_profile_id = target_profile_id
     and institution_id = target_institution_id;

  insert into public.psychology_audit_events (
    institution_id, actor_profile_id, action, subject_id
  ) values (
    target_institution_id, auth.uid(), 'CRP_VERIFIED', target_profile_id
  );
end;
$$;
