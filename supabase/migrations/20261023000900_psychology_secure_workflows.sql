begin;

-- The psychologist must be assigned to the specific student, not merely to the school.
create or replace function private.psychology_can_access_appointment(target_appointment_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.psychology_appointments appointment
    join public.students student on student.id = appointment.student_id
    where appointment.id = target_appointment_id
      and private.psychology_module_is_enabled(appointment.institution_id)
      and (
        (student.profile_id = auth.uid()
          and private.psychology_student_is_assigned(appointment.institution_id, appointment.student_id))
        or (appointment.professional_profile_id = auth.uid()
          and private.psychology_professional_has_student_access(
            appointment.institution_id, appointment.student_id))
      )
  );
$$;

create or replace function private.psychology_can_access_note(target_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.psychology_sessions session
    join public.psychology_appointments appointment on appointment.id = session.appointment_id
    where session.id = target_session_id
      and appointment.professional_profile_id = auth.uid()
      and private.psychology_module_is_enabled(appointment.institution_id)
      and private.psychology_professional_has_student_access(
        appointment.institution_id, appointment.student_id)
  );
$$;

create or replace function public.psychology_module_enabled(target_institution_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_current_profile_active()
    and exists (select 1 from public.memberships membership
      where membership.profile_id = auth.uid()
        and membership.institution_id = target_institution_id and membership.active is true)
    and private.psychology_module_is_enabled(target_institution_id);
$$;

create or replace function public.psychology_set_module_enabled(
  target_institution_id uuid,
  target_enabled boolean
)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if target_enabled is null or not private.psychology_is_manager(target_institution_id) then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;

  insert into public.psychology_module_settings (institution_id, enabled, updated_by, updated_at)
  values (target_institution_id, target_enabled, auth.uid(), now())
  on conflict (institution_id) do update set
    enabled = excluded.enabled,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  insert into public.psychology_audit_events (institution_id, actor_profile_id, action)
  values (target_institution_id, auth.uid(),
    case when target_enabled then 'MODULE_ENABLED' else 'MODULE_DISABLED' end);

  return target_enabled;
end;
$$;

create or replace function public.psychology_list_management_candidates(target_institution_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not private.psychology_is_manager(target_institution_id) then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  select jsonb_build_object(
    'professionals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'profile_id', profile.id, 'full_name', profile.full_name, 'email', profile.email,
        'registered', professional.profile_id is not null,
        'verification_status', professional.verification_status,
        'crp_registration', professional.crp_registration, 'crp_state', professional.crp_state,
        'linked', coalesce(link.active, false)
      ) order by profile.full_name)
      from public.memberships membership
      join public.profiles profile on profile.id = membership.profile_id
      left join public.psychology_professionals professional on professional.profile_id = profile.id
      left join public.psychology_professional_institutions link
        on link.professional_profile_id = profile.id and link.institution_id = target_institution_id
      where membership.institution_id = target_institution_id
        and membership.role = 'PSYCHOLOGIST'::public.user_role
        and membership.active is true and profile.active is true
    ), '[]'::jsonb),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id', student.id, 'profile_id', profile.id, 'full_name', profile.full_name,
        'registration_number', student.registration_number,
        'assigned', exists (select 1 from public.psychology_assignments assignment
          where assignment.institution_id = target_institution_id
            and assignment.student_id = student.id and assignment.active is true
            and assignment.starts_on <= current_date
            and (assignment.ends_on is null or assignment.ends_on >= current_date)),
        'assigned_professionals', coalesce((
          select jsonb_agg(jsonb_build_object(
            'profile_id', assignment.professional_profile_id,
            'full_name', professional_profile.full_name
          ) order by professional_profile.full_name)
          from public.psychology_assignments assignment
          join public.profiles professional_profile
            on professional_profile.id = assignment.professional_profile_id
          where assignment.institution_id = target_institution_id
            and assignment.student_id = student.id
            and assignment.active is true
            and assignment.starts_on <= current_date
            and (assignment.ends_on is null or assignment.ends_on >= current_date)
        ), '[]'::jsonb),
        'authorization_status', consent.status
      ) order by profile.full_name)
      from public.students student
      join public.profiles profile on profile.id = student.profile_id
      join public.memberships membership on membership.profile_id = profile.id
        and membership.institution_id = target_institution_id
      left join public.psychology_authorizations consent
        on consent.institution_id = target_institution_id and consent.student_id = student.id
      where student.institution_id = target_institution_id
        and student.active is true and membership.active is true
        and membership.role = 'STUDENT'::public.user_role and profile.active is true
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function private.psychology_resolve_slot(
  target_institution_id uuid,
  target_student_id uuid,
  target_professional_profile_id uuid,
  target_starts_at timestamptz
)
returns table (resolved_ends_at timestamptz, resolved_preparation_minutes integer)
language sql stable security definer set search_path = '' as $$
  select target_starts_at + make_interval(mins => rule.session_minutes),
    rule.preparation_minutes
  from public.psychology_availability_rules rule
  where rule.institution_id = target_institution_id
    and rule.professional_profile_id = target_professional_profile_id
    and rule.active is true
    and rule.valid_from <= (target_starts_at at time zone rule.timezone)::date
    and (rule.valid_until is null or rule.valid_until >= (target_starts_at at time zone rule.timezone)::date)
    and extract(dow from (target_starts_at at time zone rule.timezone))::integer = rule.day_of_week
    and exists (
      select 1 from generate_series(
        ((target_starts_at at time zone rule.timezone)::date + rule.start_local),
        ((target_starts_at at time zone rule.timezone)::date + rule.end_local
          - make_interval(mins => rule.session_minutes)),
        make_interval(mins => rule.session_minutes + rule.preparation_minutes)
      ) as candidate(local_start)
      where candidate.local_start = target_starts_at at time zone rule.timezone
    )
    and not exists (
      select 1 from public.psychology_availability_exceptions exception
      where exception.institution_id = rule.institution_id
        and exception.professional_profile_id = rule.professional_profile_id
        and tstzrange(exception.starts_at, exception.ends_at, '[)')
          && tstzrange(target_starts_at,
            target_starts_at + make_interval(mins => rule.session_minutes + rule.preparation_minutes), '[)')
    )
    and private.psychology_module_is_enabled(target_institution_id)
    and private.psychology_student_is_assigned(target_institution_id, target_student_id)
    and private.psychology_professional_is_eligible(target_institution_id, target_professional_profile_id)
  order by rule.start_local
  limit 1;
$$;

revoke all on function private.psychology_resolve_slot(uuid, uuid, uuid, timestamptz)
  from public, anon, authenticated;

create or replace function public.psychology_list_my_authorization_targets(target_institution_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null or not private.is_current_profile_active()
    or not exists (select 1 from public.memberships membership
      where membership.profile_id = auth.uid()
        and membership.institution_id = target_institution_id and membership.active is true
        and membership.role in ('STUDENT'::public.user_role, 'GUARDIAN'::public.user_role)) then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
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

create or replace function public.psychology_register_professional(
  target_institution_id uuid, target_profile_id uuid, target_crp_registration text, target_crp_state text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare changed_profile uuid;
begin
  if not private.psychology_is_manager(target_institution_id) then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  if not exists (select 1 from public.memberships membership
    join public.profiles profile on profile.id = membership.profile_id
    where membership.profile_id = target_profile_id and membership.institution_id = target_institution_id
      and membership.role = 'PSYCHOLOGIST'::public.user_role
      and membership.active is true and profile.active is true) then
    raise exception using message = 'PROFESSIONAL_MEMBERSHIP_REQUIRED', errcode = 'P0001';
  end if;
  if target_crp_registration !~ '^[0-9./-]{2,20}$' or upper(target_crp_state) !~ '^[A-Z]{2}$' then
    raise exception using message = 'INVALID_PROFESSIONAL_REGISTRATION', errcode = 'P0001';
  end if;
  insert into public.psychology_professionals (profile_id, crp_registration, crp_state)
  values (target_profile_id, target_crp_registration, upper(target_crp_state))
  on conflict (profile_id) do update set
    crp_registration = excluded.crp_registration, crp_state = excluded.crp_state,
    verification_status = case when public.psychology_professionals.verification_status = 'VERIFIED'
      then 'PENDING' else public.psychology_professionals.verification_status end,
    verified_at = null, verified_by = null, updated_at = now()
  returning profile_id into changed_profile;
  insert into public.psychology_professional_institutions (professional_profile_id, institution_id, active)
  values (changed_profile, target_institution_id, false)
  on conflict (professional_profile_id, institution_id) do nothing;
  insert into public.psychology_audit_events (institution_id, actor_profile_id, action, subject_id)
  values (target_institution_id, auth.uid(), 'PROFESSIONAL_REGISTERED', target_profile_id);
  return jsonb_build_object('profile_id', changed_profile, 'verification_status', 'PENDING');
end;
$$;

create or replace function public.psychology_verify_professional(
  target_institution_id uuid, target_profile_id uuid, human_crp_verified boolean
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.psychology_is_manager(target_institution_id) or human_crp_verified is not true then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  update public.psychology_professionals professional
  set verification_status = 'VERIFIED', verified_at = now(), verified_by = auth.uid(), updated_at = now()
  where professional.profile_id = target_profile_id and professional.active is true
    and exists (select 1 from public.psychology_professional_institutions link
      where link.professional_profile_id = professional.profile_id and link.institution_id = target_institution_id);
  if not found then raise exception using message = 'PROFESSIONAL_NOT_FOUND', errcode = 'P0001'; end if;
  update public.psychology_professional_institutions set active = true
  where professional_profile_id = target_profile_id and institution_id = target_institution_id;
  insert into public.psychology_audit_events (institution_id, actor_profile_id, action, subject_id)
  values (target_institution_id, auth.uid(), 'CRP_VERIFIED', target_profile_id);
end;
$$;

create or replace function public.psychology_set_student_assignment(
  target_institution_id uuid, target_student_id uuid, target_professional_profile_id uuid, make_active boolean
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare assignment_id uuid;
begin
  if not private.psychology_is_manager(target_institution_id) then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  if not exists (select 1 from public.students student
    join public.memberships membership on membership.profile_id = student.profile_id
      and membership.institution_id = student.institution_id
    where student.id = target_student_id and student.institution_id = target_institution_id
      and student.active is true and membership.active is true
      and membership.role = 'STUDENT'::public.user_role)
  then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  if make_active and not exists (select 1 from public.psychology_professionals professional
      join public.psychology_professional_institutions link on link.professional_profile_id = professional.profile_id
      where professional.profile_id = target_professional_profile_id
        and link.institution_id = target_institution_id and link.active is true
        and professional.active is true and professional.verification_status = 'VERIFIED') then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  if not make_active and not exists (select 1 from public.psychology_assignments assignment
    where assignment.institution_id = target_institution_id
      and assignment.student_id = target_student_id
      and assignment.professional_profile_id = target_professional_profile_id
      and assignment.active is true) then
    raise exception using message = 'ASSIGNMENT_NOT_FOUND', errcode = 'P0001';
  end if;
  if make_active then
    update public.psychology_assignments assignment
    set active = false, ends_on = least(coalesce(ends_on, current_date), current_date)
    where assignment.institution_id = target_institution_id and assignment.student_id = target_student_id
      and assignment.professional_profile_id = target_professional_profile_id and assignment.active is true;
    insert into public.psychology_assignments (institution_id, student_id, professional_profile_id, created_by)
    values (target_institution_id, target_student_id, target_professional_profile_id, auth.uid())
    returning id into assignment_id;
  else
    update public.psychology_assignments assignment
    set active = false, ends_on = current_date
    where assignment.institution_id = target_institution_id and assignment.student_id = target_student_id
      and assignment.professional_profile_id = target_professional_profile_id and assignment.active is true
    returning id into assignment_id;
  end if;
  insert into public.psychology_audit_events (institution_id, actor_profile_id, action, subject_id)
  values (target_institution_id, auth.uid(), 'ASSIGNMENT_CHANGED', target_student_id);
  return assignment_id;
end;
$$;

create or replace function public.psychology_record_authorization(
  target_student_id uuid, accept_privacy_notice boolean, accept_service_terms boolean, authorize_treatment boolean
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare student_row public.students%rowtype;
  guardian_membership boolean;
  signatory_kind text;
begin
  if accept_privacy_notice is not true or accept_service_terms is not true or authorize_treatment is not true then
    raise exception using message = 'AUTHORIZATION_REQUIRED', errcode = 'P0001';
  end if;
  if auth.uid() is null or not private.is_current_profile_active() then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  select student.* into student_row from public.students student
    join public.profiles profile on profile.id = student.profile_id and profile.active is true
    join public.memberships student_membership on student_membership.profile_id = student.profile_id
      and student_membership.institution_id = student.institution_id
      and student_membership.active is true
      and student_membership.role = 'STUDENT'::public.user_role
    where student.id = target_student_id and student.active is true;
  if not found or student_row.birth_date is null then
    raise exception using message = 'AUTHORIZATION_REQUIRED', errcode = 'P0001';
  end if;
  if not private.psychology_module_is_enabled(student_row.institution_id) then
    raise exception using message = 'AUTHORIZATION_REQUIRED', errcode = 'P0001';
  end if;
  if student_row.birth_date > (current_date - interval '18 years')::date then
    select exists (select 1 from public.guardianships guardianship
      join public.memberships membership on membership.profile_id = guardianship.guardian_profile_id
        and membership.institution_id = student_row.institution_id
      where guardianship.student_id = target_student_id and guardianship.guardian_profile_id = auth.uid()
        and guardianship.active is true and membership.active is true
        and membership.role = 'GUARDIAN'::public.user_role) into guardian_membership;
    if not guardian_membership then raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001'; end if;
    signatory_kind := 'GUARDIAN';
  else
    if student_row.profile_id <> auth.uid() or not exists (select 1 from public.memberships membership
      where membership.profile_id = student_row.profile_id and membership.institution_id = student_row.institution_id
        and membership.active is true and membership.role = 'STUDENT'::public.user_role) then
      raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
    end if;
    signatory_kind := 'STUDENT';
  end if;
  insert into public.psychology_authorizations (
    institution_id, student_id, signatory_profile_id, signatory_kind,
    privacy_notice_version, service_terms_version, treatment_authorization_version,
    status, confirmed_at, revoked_at, updated_at
  ) values (
    student_row.institution_id, student_row.id, auth.uid(), signatory_kind,
    'privacy-2026-01', 'service-2026-01', 'treatment-2026-01', 'ACTIVE', now(), null, now()
  ) on conflict (institution_id, student_id) do update set
    signatory_profile_id = excluded.signatory_profile_id, signatory_kind = excluded.signatory_kind,
    privacy_notice_version = excluded.privacy_notice_version, service_terms_version = excluded.service_terms_version,
    treatment_authorization_version = excluded.treatment_authorization_version,
    status = 'ACTIVE', confirmed_at = now(), revoked_at = null, updated_at = now();
  insert into public.psychology_audit_events (institution_id, actor_profile_id, action, subject_id)
  values (student_row.institution_id, auth.uid(), 'AUTHORIZATION_CONFIRMED', student_row.id);
  return jsonb_build_object('student_id', student_row.id, 'status', 'ACTIVE', 'confirmed_at', now());
end;
$$;

create or replace function public.psychology_revoke_authorization(target_student_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare institution_key uuid;
begin
  update public.psychology_authorizations consent
  set status = 'REVOKED', revoked_at = now(), updated_at = now()
  where consent.student_id = target_student_id and consent.status = 'ACTIVE'
    and (consent.signatory_profile_id = auth.uid()
      or exists (select 1 from public.students student where student.id = consent.student_id
        and student.profile_id = auth.uid() and student.birth_date <= (current_date - interval '18 years')::date))
  returning institution_id into institution_key;
  if institution_key is null then raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001'; end if;
  insert into public.psychology_audit_events (institution_id, actor_profile_id, action, subject_id)
  values (institution_key, auth.uid(), 'AUTHORIZATION_REVOKED', target_student_id);
end;
$$;

create or replace function public.psychology_list_available_slots(
  target_institution_id uuid, target_student_id uuid, from_date date default current_date
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not private.psychology_module_is_enabled(target_institution_id)
    or not exists (select 1 from public.students student
      where student.id = target_student_id and student.profile_id = auth.uid()
        and student.institution_id = target_institution_id and student.active is true)
    or not private.psychology_student_is_assigned(target_institution_id, target_student_id) then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'professional_profile_id', slots.professional_profile_id,
    'professional_name', slots.professional_name,
    'crp_registration', slots.crp_registration, 'crp_state', slots.crp_state,
    'starts_at', slots.starts_at, 'ends_at', slots.ends_at, 'timezone', slots.timezone
  ) order by slots.starts_at), '[]'::jsonb)
  into result
  from (
    select rule.professional_profile_id, profile.full_name as professional_name,
      professional.crp_registration, professional.crp_state,
      slot.local_start at time zone rule.timezone as starts_at,
      (slot.local_start + make_interval(mins => rule.session_minutes)) at time zone rule.timezone as ends_at,
      rule.timezone
    from public.psychology_availability_rules rule
    join public.psychology_assignments assignment
      on assignment.institution_id = rule.institution_id
      and assignment.professional_profile_id = rule.professional_profile_id
      and assignment.student_id = target_student_id and assignment.active is true
      and assignment.starts_on <= current_date
      and (assignment.ends_on is null or assignment.ends_on >= current_date)
      and private.psychology_professional_is_eligible(target_institution_id, rule.professional_profile_id)
    join public.psychology_professionals professional on professional.profile_id = rule.professional_profile_id
    join public.profiles profile on profile.id = professional.profile_id
    cross join lateral generate_series(
      greatest(from_date, (now() at time zone rule.timezone)::date)::timestamp,
      least(from_date + 30, (now() at time zone rule.timezone)::date + 30)::timestamp,
      interval '1 day'
    ) as calendar_day(local_date)
    cross join lateral generate_series(
      calendar_day.local_date + rule.start_local,
      calendar_day.local_date + rule.end_local - make_interval(mins => rule.session_minutes),
      make_interval(mins => rule.session_minutes + rule.preparation_minutes)
    ) as slot(local_start)
    where rule.institution_id = target_institution_id and rule.active is true
      and rule.valid_from <= slot.local_start::date
      and (rule.valid_until is null or rule.valid_until >= slot.local_start::date)
      and extract(dow from slot.local_start)::integer = rule.day_of_week
      and slot.local_start at time zone rule.timezone >= now() + interval '10 minutes'
      and not exists (select 1 from public.psychology_availability_exceptions exception
        where exception.institution_id = rule.institution_id
          and exception.professional_profile_id = rule.professional_profile_id
          and tstzrange(exception.starts_at, exception.ends_at, '[)')
            && tstzrange(slot.local_start at time zone rule.timezone,
              (slot.local_start + make_interval(mins => rule.session_minutes + rule.preparation_minutes)) at time zone rule.timezone, '[)'))
      and not exists (select 1 from public.psychology_appointments appointment
        where appointment.status = 'SCHEDULED'
          and ((appointment.student_id = target_student_id
              and tstzrange(appointment.starts_at, appointment.ends_at, '[)')
                && tstzrange(slot.local_start at time zone rule.timezone,
                  (slot.local_start + make_interval(mins => rule.session_minutes)) at time zone rule.timezone, '[)'))
            or (appointment.professional_profile_id = rule.professional_profile_id
              and tstzrange(appointment.starts_at,
                appointment.ends_at + appointment.preparation_minutes * interval '1 minute', '[)')
                && tstzrange(slot.local_start at time zone rule.timezone,
                  (slot.local_start + make_interval(mins => rule.session_minutes + rule.preparation_minutes)) at time zone rule.timezone, '[)'))))
    order by starts_at
    limit 300
  ) slots;
  return result;
end;
$$;

create or replace function public.psychology_book_appointment(
  target_institution_id uuid, target_student_id uuid, target_professional_profile_id uuid,
  target_starts_at timestamptz, client_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing public.psychology_appointments%rowtype;
  resolved_end timestamptz;
  prep_minutes integer;
  appointment_id uuid;
begin
  if client_idempotency_key is null then
    raise exception using message = 'INVALID_IDEMPOTENCY_KEY', errcode = 'P0001';
  end if;
  if auth.uid() is null or not private.psychology_module_is_enabled(target_institution_id)
    or not exists (select 1 from public.students student where student.id = target_student_id
      and student.profile_id = auth.uid() and student.institution_id = target_institution_id and student.active is true)
    or not private.psychology_student_is_assigned(target_institution_id, target_student_id) then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(auth.uid()::text || ':' || client_idempotency_key::text, 0)
  );
  select appointment.* into existing from public.psychology_appointments appointment
    where appointment.created_by = auth.uid() and appointment.idempotency_key = client_idempotency_key;
  if found then
    if existing.institution_id = target_institution_id and existing.student_id = target_student_id
      and existing.professional_profile_id = target_professional_profile_id and existing.starts_at = target_starts_at then
      return jsonb_build_object('appointment_id', existing.id, 'status', existing.status);
    end if;
    raise exception using message = 'IDEMPOTENCY_KEY_REUSED', errcode = 'P0001';
  end if;
  if target_starts_at < now() + interval '10 minutes' or target_starts_at > now() + interval '30 days' then
    raise exception using message = 'SLOT_UNAVAILABLE', errcode = 'P0001';
  end if;
  select slot.resolved_ends_at, slot.resolved_preparation_minutes into resolved_end, prep_minutes
  from private.psychology_resolve_slot(target_institution_id, target_student_id,
    target_professional_profile_id, target_starts_at) slot;
  if resolved_end is null then raise exception using message = 'SLOT_UNAVAILABLE', errcode = 'P0001'; end if;
  insert into public.psychology_appointments (
    institution_id, student_id, professional_profile_id, starts_at, ends_at,
    preparation_minutes, created_by, idempotency_key
  ) values (target_institution_id, target_student_id, target_professional_profile_id,
    target_starts_at, resolved_end, prep_minutes, auth.uid(), client_idempotency_key)
  returning id into appointment_id;
  insert into public.psychology_appointment_events (appointment_id, actor_profile_id, action, next_starts_at)
    values (appointment_id, auth.uid(), 'BOOKED', target_starts_at);
  insert into public.psychology_audit_events (institution_id, actor_profile_id, action, subject_id)
    values (target_institution_id, auth.uid(), 'APPOINTMENT_BOOKED', appointment_id);
  return jsonb_build_object('appointment_id', appointment_id, 'status', 'SCHEDULED');
exception when exclusion_violation then
  raise exception using message = 'SLOT_UNAVAILABLE', errcode = 'P0001';
end;
$$;

create or replace function public.psychology_list_appointments(
  target_institution_id uuid,
  from_at timestamptz default now() - interval '30 days',
  through_at timestamptz default now() + interval '30 days'
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not private.psychology_module_is_enabled(target_institution_id)
    or not (private.psychology_is_manager(target_institution_id)
      or private.psychology_is_professional(target_institution_id)
      or exists (select 1 from public.students student
        join public.memberships membership on membership.profile_id = student.profile_id
          and membership.institution_id = student.institution_id
        where student.institution_id = target_institution_id and student.profile_id = auth.uid()
          and student.active is true and membership.active is true
          and membership.role = 'STUDENT'::public.user_role)) then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  if through_at <= from_at
    or through_at > now() + interval '91 days'
    or through_at - from_at > interval '90 days' then
    raise exception using message = 'INVALID_DATE_RANGE', errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'appointment_id', appointment.id, 'student_id', appointment.student_id,
    'student_name', student_profile.full_name,
    'professional_profile_id', appointment.professional_profile_id,
    'professional_name', professional_profile.full_name,
    'crp_registration', professional.crp_registration, 'crp_state', professional.crp_state,
    'starts_at', appointment.starts_at, 'ends_at', appointment.ends_at,
    'status', appointment.status, 'session_id', session.id, 'session_status', session.status
  ) order by appointment.starts_at), '[]'::jsonb) into result
  from public.psychology_appointments appointment
  join public.students student on student.id = appointment.student_id
  join public.profiles student_profile on student_profile.id = student.profile_id
  join public.psychology_professionals professional on professional.profile_id = appointment.professional_profile_id
  join public.profiles professional_profile on professional_profile.id = professional.profile_id
  join public.psychology_sessions session on session.appointment_id = appointment.id
  where appointment.institution_id = target_institution_id
    and appointment.starts_at >= from_at and appointment.starts_at < through_at
    and (private.psychology_is_manager(target_institution_id)
      or private.psychology_can_access_appointment(appointment.id));
  return result;
end;
$$;

create or replace function public.psychology_check_session_access(target_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and private.is_current_profile_active()
    and private.psychology_can_access_session(target_session_id);
$$;

create or replace function public.psychology_cancel_appointment(target_appointment_id uuid, operation_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_appointment public.psychology_appointments%rowtype;
  v_event public.psychology_appointment_events%rowtype;
  cutoff integer;
  caller_is_student boolean;
begin
  if operation_key is null then
    raise exception using message = 'INVALID_IDEMPOTENCY_KEY', errcode = 'P0001';
  end if;
  select * into v_appointment from public.psychology_appointments
    where id = target_appointment_id for update;
  if not found then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  if not private.psychology_module_is_enabled(v_appointment.institution_id)
    or not private.psychology_can_access_appointment(target_appointment_id) then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(operation_key::text, 0));
  select event.* into v_event from public.psychology_appointment_events event
    where event.operation_key = operation_key;
  if found then
    if v_event.appointment_id = target_appointment_id and v_event.actor_profile_id = auth.uid()
      and v_event.action = 'CANCELLED' then
      return jsonb_build_object('appointment_id', v_appointment.id, 'status', v_appointment.status);
    end if;
    raise exception using message = 'IDEMPOTENCY_KEY_REUSED', errcode = 'P0001';
  end if;
  if exists (select 1 from public.psychology_sessions session
    where session.appointment_id = target_appointment_id and session.status <> 'WAITING') then
    raise exception using message = 'CANCELLATION_WINDOW_CLOSED', errcode = 'P0001';
  end if;
  select setting.cancellation_cutoff_minutes into cutoff from public.psychology_module_settings setting
    where setting.institution_id = v_appointment.institution_id;
  select student.profile_id = auth.uid() into caller_is_student from public.students student
    where student.id = v_appointment.student_id;
  if v_appointment.status <> 'SCHEDULED' or v_appointment.starts_at <= now()
    or (coalesce(caller_is_student, false)
      and v_appointment.starts_at - make_interval(mins => coalesce(cutoff, 60)) <= now()) then
    raise exception using message = 'CANCELLATION_WINDOW_CLOSED', errcode = 'P0001';
  end if;
  update public.psychology_appointments set status = 'CANCELLED', updated_at = now() where id = v_appointment.id;
  insert into public.psychology_appointment_events (
    appointment_id, actor_profile_id, action, previous_starts_at, operation_key
  ) values (v_appointment.id, auth.uid(), 'CANCELLED', v_appointment.starts_at, operation_key);
  insert into public.psychology_audit_events (institution_id, actor_profile_id, action, subject_id)
    values (v_appointment.institution_id, auth.uid(), 'APPOINTMENT_CANCELLED', v_appointment.id);
  return jsonb_build_object('appointment_id', v_appointment.id, 'status', 'CANCELLED');
end;
$$;

create or replace function public.psychology_reschedule_appointment(
  target_appointment_id uuid, new_starts_at timestamptz, operation_key uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_appointment public.psychology_appointments%rowtype;
  v_event public.psychology_appointment_events%rowtype;
  old_start timestamptz;
  new_end timestamptz;
  prep_minutes integer;
  caller_is_student boolean;
  cutoff integer;
begin
  if operation_key is null then
    raise exception using message = 'INVALID_IDEMPOTENCY_KEY', errcode = 'P0001';
  end if;
  select * into v_appointment from public.psychology_appointments
    where id = target_appointment_id for update;
  if not found or not private.psychology_module_is_enabled(v_appointment.institution_id)
    or not private.psychology_can_access_appointment(target_appointment_id) then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(operation_key::text, 0));
  select event.* into v_event from public.psychology_appointment_events event
    where event.operation_key = operation_key;
  if found then
    if v_event.appointment_id = target_appointment_id and v_event.actor_profile_id = auth.uid()
      and v_event.action = 'RESCHEDULED' and v_event.next_starts_at = new_starts_at then
      return jsonb_build_object('appointment_id', v_appointment.id, 'status', v_appointment.status, 'starts_at', v_appointment.starts_at);
    end if;
    raise exception using message = 'IDEMPOTENCY_KEY_REUSED', errcode = 'P0001';
  end if;
  select student.profile_id = auth.uid() into caller_is_student
    from public.students student where student.id = v_appointment.student_id;
  select setting.cancellation_cutoff_minutes into cutoff from public.psychology_module_settings setting
    where setting.institution_id = v_appointment.institution_id;
  if not coalesce(caller_is_student, false) or v_appointment.status <> 'SCHEDULED'
    or exists (select 1 from public.psychology_sessions session
      where session.appointment_id = target_appointment_id and session.status <> 'WAITING')
    or v_appointment.starts_at <= now() or new_starts_at < now() + interval '10 minutes'
    or v_appointment.starts_at - make_interval(mins => coalesce(cutoff, 60)) <= now()
    or new_starts_at > now() + interval '30 days' then
    raise exception using message = 'CANCELLATION_WINDOW_CLOSED', errcode = 'P0001';
  end if;
  select slot.resolved_ends_at, slot.resolved_preparation_minutes into new_end, prep_minutes
    from private.psychology_resolve_slot(v_appointment.institution_id, v_appointment.student_id,
      v_appointment.professional_profile_id, new_starts_at) slot;
  if new_end is null then raise exception using message = 'SLOT_UNAVAILABLE', errcode = 'P0001'; end if;
  old_start := v_appointment.starts_at;
  update public.psychology_appointments set starts_at = new_starts_at, ends_at = new_end,
    preparation_minutes = prep_minutes, updated_at = now() where id = v_appointment.id;
  insert into public.psychology_appointment_events (
    appointment_id, actor_profile_id, action, previous_starts_at, next_starts_at, operation_key
  ) values (v_appointment.id, auth.uid(), 'RESCHEDULED', old_start, new_starts_at, operation_key);
  insert into public.psychology_audit_events (institution_id, actor_profile_id, action, subject_id)
    values (v_appointment.institution_id, auth.uid(), 'APPOINTMENT_RESCHEDULED', v_appointment.id);
  return jsonb_build_object('appointment_id', v_appointment.id, 'status', 'SCHEDULED', 'starts_at', new_starts_at);
exception when exclusion_violation then
  raise exception using message = 'SLOT_UNAVAILABLE', errcode = 'P0001';
end;
$$;

create or replace function public.psychology_set_availability_rule(
  target_institution_id uuid, target_rule_id uuid, target_day_of_week smallint,
  target_start_local time, target_end_local time, target_timezone text,
  target_session_minutes integer, target_preparation_minutes integer,
  target_valid_from date, target_valid_until date, target_active boolean
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare saved_id uuid;
begin
  if not private.psychology_module_is_enabled(target_institution_id)
    or not private.psychology_is_professional(target_institution_id)
    or target_start_local >= target_end_local or target_day_of_week not between 0 and 6
    or target_session_minutes not between 20 and 120 or target_preparation_minutes not between 0 and 60
    or not exists (select 1 from pg_catalog.pg_timezone_names zone where zone.name = target_timezone)
    or (target_valid_until is not null and target_valid_until < target_valid_from) then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  if target_rule_id is not null then
    update public.psychology_availability_rules rule set
      day_of_week = target_day_of_week, start_local = target_start_local, end_local = target_end_local,
      timezone = target_timezone, session_minutes = target_session_minutes,
      preparation_minutes = target_preparation_minutes, valid_from = target_valid_from,
      valid_until = target_valid_until, active = target_active
    where rule.id = target_rule_id and rule.institution_id = target_institution_id
      and rule.professional_profile_id = auth.uid()
    returning id into saved_id;
    if saved_id is null then raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001'; end if;
  else
    insert into public.psychology_availability_rules (
      institution_id, professional_profile_id, day_of_week, start_local, end_local, timezone,
      session_minutes, preparation_minutes, valid_from, valid_until, active
    ) values (
      target_institution_id, auth.uid(), target_day_of_week, target_start_local, target_end_local,
      target_timezone, target_session_minutes, target_preparation_minutes, target_valid_from, target_valid_until, target_active
    ) returning id into saved_id;
  end if;
  return saved_id;
exception when exclusion_violation then
  raise exception using message = 'SLOT_UNAVAILABLE', errcode = 'P0001';
end;
$$;

create or replace function public.psychology_add_availability_block(
  target_institution_id uuid, target_starts_at timestamptz, target_ends_at timestamptz
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare block_id uuid;
begin
  if not private.psychology_module_is_enabled(target_institution_id)
    or not private.psychology_is_professional(target_institution_id)
    or target_starts_at <= now() or target_ends_at <= target_starts_at then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  insert into public.psychology_availability_exceptions (
    institution_id, professional_profile_id, starts_at, ends_at
  ) values (target_institution_id, auth.uid(), target_starts_at, target_ends_at)
  returning id into block_id;
  return block_id;
end;
$$;

create or replace function public.psychology_remove_availability_block(target_institution_id uuid, target_block_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.psychology_module_is_enabled(target_institution_id)
    or not private.psychology_is_professional(target_institution_id) then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  delete from public.psychology_availability_exceptions block
  where block.id = target_block_id and block.institution_id = target_institution_id
    and block.professional_profile_id = auth.uid() and block.starts_at > now();
  if not found then raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001'; end if;
end;
$$;

create or replace function private.psychology_create_session_for_appointment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.psychology_sessions (appointment_id, status)
  values (new.id, 'WAITING');
  return new;
end;
$$;
revoke all on function private.psychology_create_session_for_appointment() from public, anon, authenticated;
create trigger psychology_appointment_create_session
  after insert on public.psychology_appointments
  for each row execute function private.psychology_create_session_for_appointment();

create or replace function public.psychology_start_session(target_session_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_appointment public.psychology_appointments%rowtype;
  v_session public.psychology_sessions%rowtype;
begin
  select * into v_session from public.psychology_sessions where id = target_session_id for update;
  if not found then raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001'; end if;
  select * into v_appointment from public.psychology_appointments where id = v_session.appointment_id;
  if v_appointment.professional_profile_id <> auth.uid()
    or not private.psychology_module_is_enabled(v_appointment.institution_id)
    or not private.psychology_is_professional(v_appointment.institution_id)
    or not private.psychology_can_access_appointment(v_appointment.id) then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  if v_session.status = 'IN_PROGRESS' then
    return jsonb_build_object('session_id', v_session.id, 'status', v_session.status, 'ends_at', v_session.ends_at);
  end if;
  if v_session.status <> 'WAITING' or v_appointment.status <> 'SCHEDULED'
    or now() < v_appointment.starts_at - interval '10 minutes' or now() > v_appointment.ends_at then
    raise exception using message = 'SESSION_NOT_STARTED', errcode = 'P0001';
  end if;
  update public.psychology_sessions set status = 'IN_PROGRESS', started_at = now(), ends_at = v_appointment.ends_at
  where id = v_session.id;
  insert into public.psychology_audit_events (institution_id, actor_profile_id, action, subject_id)
    values (v_appointment.institution_id, auth.uid(), 'SESSION_STARTED', v_appointment.id);
  return jsonb_build_object('session_id', v_session.id, 'status', 'IN_PROGRESS', 'ends_at', v_appointment.ends_at);
end;
$$;

create or replace function public.psychology_close_session(target_session_id uuid, outcome text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_appointment public.psychology_appointments%rowtype;
  v_session public.psychology_sessions%rowtype;
begin
  if outcome not in ('COMPLETED', 'NO_SHOW') then
    raise exception using message = 'INVALID_OUTCOME', errcode = 'P0001';
  end if;
  select * into v_session from public.psychology_sessions where id = target_session_id for update;
  if not found then raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001'; end if;
  select * into v_appointment from public.psychology_appointments
    where id = v_session.appointment_id for update;
  if v_appointment.professional_profile_id <> auth.uid()
    or not private.psychology_module_is_enabled(v_appointment.institution_id)
    or not private.psychology_is_professional(v_appointment.institution_id)
    or not private.psychology_can_access_appointment(v_appointment.id) then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  if v_session.status = 'CLOSED' then
    return jsonb_build_object('session_id', v_session.id, 'status', 'CLOSED', 'appointment_status', v_appointment.status);
  end if;
  if (outcome = 'COMPLETED' and v_session.status <> 'IN_PROGRESS')
    or (outcome = 'NO_SHOW' and (v_session.status <> 'WAITING' or now() < v_appointment.ends_at)) then
    raise exception using message = 'SESSION_NOT_STARTED', errcode = 'P0001';
  end if;
  update public.psychology_sessions set status = 'CLOSED', closed_at = now() where id = v_session.id;
  update public.psychology_appointments set status = outcome, updated_at = now() where id = v_appointment.id;
  insert into public.psychology_appointment_events (appointment_id, actor_profile_id, action, previous_starts_at)
    values (v_appointment.id, auth.uid(), outcome, v_appointment.starts_at);
  insert into public.psychology_audit_events (institution_id, actor_profile_id, action, subject_id)
    values (v_appointment.institution_id, auth.uid(), 'SESSION_CLOSED', v_appointment.id);
  return jsonb_build_object('session_id', v_session.id, 'status', 'CLOSED', 'appointment_status', outcome);
end;
$$;

create or replace function public.psychology_send_message(
  target_session_id uuid, message_body text, client_message_key uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_session public.psychology_sessions%rowtype;
  v_appointment public.psychology_appointments%rowtype;
  message_id bigint;
  existing_body text;
begin
  if client_message_key is null then
    raise exception using message = 'INVALID_IDEMPOTENCY_KEY', errcode = 'P0001';
  end if;
  if auth.uid() is null or message_body is null or length(btrim(message_body)) not between 1 and 2000 then
    raise exception using message = 'INVALID_MESSAGE', errcode = 'P0001';
  end if;
  select * into v_session from public.psychology_sessions where id = target_session_id;
  if not found then raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001'; end if;
  select * into v_appointment from public.psychology_appointments where id = v_session.appointment_id;
  if v_appointment.status <> 'SCHEDULED'
    or not private.psychology_module_is_enabled(v_appointment.institution_id)
    or not private.psychology_can_access_session(target_session_id) then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  if v_session.status <> 'IN_PROGRESS' or v_session.ends_at is null or now() > v_session.ends_at then
    raise exception using message = 'SESSION_CLOSED', errcode = 'P0001';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_session_id::text || ':' || auth.uid()::text || ':' || client_message_key::text, 0)
  );
  select message.id, message.body into message_id, existing_body from public.psychology_messages message
  where message.session_id = target_session_id and message.sender_profile_id = auth.uid()
    and message.client_message_key = client_message_key;
  if message_id is not null then
    if existing_body is distinct from btrim(message_body) then
      raise exception using message = 'IDEMPOTENCY_KEY_REUSED', errcode = 'P0001';
    end if;
    return jsonb_build_object('message_id', message_id, 'status', 'SENT');
  end if;
  if (select count(*) from public.psychology_messages message
    where message.session_id = target_session_id and message.sender_profile_id = auth.uid()
      and message.created_at > now() - interval '1 minute') >= 30 then
    raise exception using message = 'MESSAGE_RATE_LIMIT', errcode = 'P0001';
  end if;
  insert into public.psychology_messages (session_id, sender_profile_id, client_message_key, body)
  values (target_session_id, auth.uid(), client_message_key, btrim(message_body))
  returning id into message_id;
  return jsonb_build_object('message_id', message_id, 'status', 'SENT');
end;
$$;

create or replace function public.psychology_save_note_draft(
  target_session_id uuid, expected_version integer, note_content jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_appointment public.psychology_appointments%rowtype;
  v_note public.psychology_notes%rowtype;
  next_version integer;
begin
  select appointment.* into v_appointment from public.psychology_sessions session
    join public.psychology_appointments appointment on appointment.id = session.appointment_id
    where session.id = target_session_id;
  if not found or v_appointment.professional_profile_id <> auth.uid()
    or not private.psychology_module_is_enabled(v_appointment.institution_id)
    or not private.psychology_can_access_note(target_session_id) then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  if jsonb_typeof(note_content) <> 'object'
    or (select count(*) from jsonb_object_keys(note_content)) > 4
    or exists (select 1 from jsonb_each(note_content) field
      where field.key not in ('objective', 'session_record', 'referrals', 'next_steps')
        or jsonb_typeof(field.value) <> 'string' or length(field.value #>> '{}') > 10000) then
    raise exception using message = 'INVALID_NOTE', errcode = 'P0001';
  end if;
  select * into v_note from public.psychology_notes where session_id = target_session_id for update;
  if not found then
    if expected_version <> 0 then raise exception using message = 'VERSION_CONFLICT', errcode = 'P0001'; end if;
    insert into public.psychology_notes (session_id, author_profile_id, version, content)
      values (target_session_id, auth.uid(), 1, note_content) returning * into v_note;
    insert into public.psychology_note_versions (note_id, version, kind, content, author_profile_id)
      values (v_note.id, 1, 'DRAFT_SAVE', note_content, auth.uid());
    next_version := 1;
  else
    if v_note.author_profile_id <> auth.uid() or v_note.status <> 'DRAFT' or v_note.version <> expected_version then
      raise exception using message = 'VERSION_CONFLICT', errcode = 'P0001';
    end if;
    next_version := v_note.version + 1;
    update public.psychology_notes set version = next_version, content = note_content, updated_at = now()
      where id = v_note.id;
    insert into public.psychology_note_versions (note_id, version, kind, content, author_profile_id)
      values (v_note.id, next_version, 'DRAFT_SAVE', note_content, auth.uid());
  end if;
  insert into public.psychology_audit_events (institution_id, actor_profile_id, action, subject_id)
    values (v_appointment.institution_id, auth.uid(), 'NOTE_SAVED', target_session_id);
  return jsonb_build_object('version', next_version, 'status', 'DRAFT');
end;
$$;

create or replace function public.psychology_finalize_note(target_session_id uuid, expected_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_note public.psychology_notes%rowtype;
  v_appointment public.psychology_appointments%rowtype;
  next_version integer;
begin
  select appointment.* into v_appointment from public.psychology_sessions session
    join public.psychology_appointments appointment on appointment.id = session.appointment_id
    where session.id = target_session_id;
  if not found or v_appointment.professional_profile_id <> auth.uid()
    or not private.psychology_module_is_enabled(v_appointment.institution_id)
    or not private.psychology_can_access_note(target_session_id) then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  select * into v_note from public.psychology_notes where session_id = target_session_id for update;
  if not found or v_note.status <> 'DRAFT' or v_note.author_profile_id <> auth.uid()
    or v_note.version <> expected_version then
    raise exception using message = 'VERSION_CONFLICT', errcode = 'P0001';
  end if;
  next_version := v_note.version + 1;
  update public.psychology_notes set status = 'FINALIZED', version = next_version,
    finalized_at = now(), updated_at = now() where id = v_note.id;
  insert into public.psychology_note_versions (note_id, version, kind, content, author_profile_id)
    values (v_note.id, next_version, 'FINALIZED', v_note.content, auth.uid());
  insert into public.psychology_audit_events (institution_id, actor_profile_id, action, subject_id)
    values (v_appointment.institution_id, auth.uid(), 'NOTE_FINALIZED', target_session_id);
  return jsonb_build_object('version', next_version, 'status', 'FINALIZED');
end;
$$;

create or replace function public.psychology_add_note_addendum(
  target_session_id uuid, expected_version integer, addendum_content jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_note public.psychology_notes%rowtype;
  v_appointment public.psychology_appointments%rowtype;
  next_version integer;
begin
  select appointment.* into v_appointment from public.psychology_sessions session
    join public.psychology_appointments appointment on appointment.id = session.appointment_id
    where session.id = target_session_id;
  if not found or v_appointment.professional_profile_id <> auth.uid()
    or not private.psychology_module_is_enabled(v_appointment.institution_id)
    or not private.psychology_can_access_note(target_session_id) then
    raise exception using message = 'NOT_AUTHORIZED', errcode = 'P0001';
  end if;
  if jsonb_typeof(addendum_content) <> 'object'
    or (select count(*) from jsonb_object_keys(addendum_content)) <> 1
    or not (addendum_content ? 'addendum') or jsonb_typeof(addendum_content->'addendum') <> 'string'
    or length(addendum_content->>'addendum') not between 1 and 10000 then
    raise exception using message = 'INVALID_NOTE', errcode = 'P0001';
  end if;
  select * into v_note from public.psychology_notes where session_id = target_session_id for update;
  if not found or v_note.status <> 'FINALIZED' or v_note.author_profile_id <> auth.uid()
    or v_note.version <> expected_version then
    raise exception using message = 'VERSION_CONFLICT', errcode = 'P0001';
  end if;
  next_version := v_note.version + 1;
  update public.psychology_notes set version = next_version, updated_at = now() where id = v_note.id;
  insert into public.psychology_note_versions (note_id, version, kind, content, author_profile_id)
    values (v_note.id, next_version, 'ADDENDUM', addendum_content, auth.uid());
  insert into public.psychology_audit_events (institution_id, actor_profile_id, action, subject_id)
    values (v_appointment.institution_id, auth.uid(), 'NOTE_ADDENDUM', target_session_id);
  return jsonb_build_object('version', next_version, 'status', 'FINALIZED');
end;
$$;

revoke all on function private.psychology_can_access_appointment(uuid),
  private.psychology_can_access_note(uuid) from public, anon, authenticated;
grant execute on function private.psychology_can_access_appointment(uuid),
  private.psychology_can_access_note(uuid) to authenticated, service_role;

revoke all on function public.psychology_module_enabled(uuid),
  public.psychology_set_module_enabled(uuid, boolean),
  public.psychology_list_management_candidates(uuid),
  public.psychology_list_my_authorization_targets(uuid),
  public.psychology_register_professional(uuid, uuid, text, text),
  public.psychology_verify_professional(uuid, uuid, boolean),
  public.psychology_set_student_assignment(uuid, uuid, uuid, boolean),
  public.psychology_record_authorization(uuid, boolean, boolean, boolean),
  public.psychology_revoke_authorization(uuid),
  public.psychology_list_available_slots(uuid, uuid, date),
  public.psychology_book_appointment(uuid, uuid, uuid, timestamptz, uuid),
  public.psychology_list_appointments(uuid, timestamptz, timestamptz),
  public.psychology_check_session_access(uuid),
  public.psychology_cancel_appointment(uuid, uuid),
  public.psychology_reschedule_appointment(uuid, timestamptz, uuid),
  public.psychology_set_availability_rule(uuid, uuid, smallint, time, time, text, integer, integer, date, date, boolean),
  public.psychology_add_availability_block(uuid, timestamptz, timestamptz),
  public.psychology_remove_availability_block(uuid, uuid),
  public.psychology_start_session(uuid),
  public.psychology_close_session(uuid, text),
  public.psychology_send_message(uuid, text, uuid),
  public.psychology_save_note_draft(uuid, integer, jsonb),
  public.psychology_finalize_note(uuid, integer),
  public.psychology_add_note_addendum(uuid, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.psychology_module_enabled(uuid),
  public.psychology_set_module_enabled(uuid, boolean),
  public.psychology_list_management_candidates(uuid),
  public.psychology_list_my_authorization_targets(uuid),
  public.psychology_register_professional(uuid, uuid, text, text),
  public.psychology_verify_professional(uuid, uuid, boolean),
  public.psychology_set_student_assignment(uuid, uuid, uuid, boolean),
  public.psychology_record_authorization(uuid, boolean, boolean, boolean),
  public.psychology_revoke_authorization(uuid),
  public.psychology_list_available_slots(uuid, uuid, date),
  public.psychology_book_appointment(uuid, uuid, uuid, timestamptz, uuid),
  public.psychology_list_appointments(uuid, timestamptz, timestamptz),
  public.psychology_check_session_access(uuid),
  public.psychology_cancel_appointment(uuid, uuid),
  public.psychology_reschedule_appointment(uuid, timestamptz, uuid),
  public.psychology_set_availability_rule(uuid, uuid, smallint, time, time, text, integer, integer, date, date, boolean),
  public.psychology_add_availability_block(uuid, timestamptz, timestamptz),
  public.psychology_remove_availability_block(uuid, uuid),
  public.psychology_start_session(uuid),
  public.psychology_close_session(uuid, text),
  public.psychology_send_message(uuid, text, uuid),
  public.psychology_save_note_draft(uuid, integer, jsonb),
  public.psychology_finalize_note(uuid, integer),
  public.psychology_add_note_addendum(uuid, integer, jsonb)
  to authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'psychology_messages') then
    alter publication supabase_realtime add table public.psychology_messages;
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
