-- Let a student remove an expired appointment that was never started from
-- their active list. Keep the appointment row and audit history intact.
begin;

create or replace function public.psychology_cancel_appointment(target_appointment_id uuid, operation_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_appointment public.psychology_appointments%rowtype;
  v_event public.psychology_appointment_events%rowtype;
  cutoff integer;
  caller_is_student boolean;
  expired_unstarted_student_appointment boolean;
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
    where event.operation_key = $2;
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

  expired_unstarted_student_appointment := coalesce(caller_is_student, false)
    and v_appointment.ends_at <= now()
    and exists (select 1 from public.psychology_sessions session
      where session.appointment_id = target_appointment_id and session.status = 'WAITING');

  if v_appointment.status <> 'SCHEDULED'
    or (not expired_unstarted_student_appointment and (
      v_appointment.starts_at <= now()
      or (coalesce(caller_is_student, false)
        and v_appointment.starts_at - make_interval(mins => coalesce(cutoff, 60)) <= now())
    )) then
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

notify pgrst, 'reload schema';
commit;
