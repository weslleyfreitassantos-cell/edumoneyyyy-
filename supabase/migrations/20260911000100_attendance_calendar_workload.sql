-- Bind new attendance sessions to the academic calendar and expose
-- tenant-scoped planned versus delivered workload progress.

begin;

create or replace function private.validate_attendance_session_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_day smallint;
  offering_academic_year_id uuid;
  offering_class_id uuid;
  offering_subject_id uuid;
begin
  -- Keep legacy sessions readable when their structural schedule fields do
  -- not change, even if a later calendar event blocks the date.
  if tg_op = 'UPDATE'
     and old.institution_id is not distinct from new.institution_id
     and old.subject_offering_id is not distinct from new.subject_offering_id
     and old.session_date is not distinct from new.session_date
     and old.starts_at is not distinct from new.starts_at
     and old.ends_at is not distinct from new.ends_at then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.starts_at is null
     and old.ends_at is null
     and new.starts_at is null
     and new.ends_at is null then
    return new;
  end if;

  if new.starts_at is null or new.ends_at is null then
    raise exception 'ATTENDANCE_SCHEDULE_NOT_FOUND'
      using errcode = '23514';
  end if;

  expected_day := extract(isodow from new.session_date)::smallint;

  if expected_day not between 1 and 6
     or not exists (
       select 1
       from public.timetable_entries as timetable_entry
       where timetable_entry.institution_id = new.institution_id
         and timetable_entry.subject_offering_id = new.subject_offering_id
         and timetable_entry.day_of_week = expected_day
         and timetable_entry.start_time = new.starts_at
         and timetable_entry.end_time = new.ends_at
         and timetable_entry.active is true
     ) then
    raise exception 'ATTENDANCE_SCHEDULE_NOT_FOUND'
      using errcode = '23514';
  end if;

  select
    term_record.academic_year_id,
    offering.class_id,
    offering.subject_id
  into
    offering_academic_year_id,
    offering_class_id,
    offering_subject_id
  from public.subject_offerings as offering
  join public.classes as class_record
    on class_record.id = offering.class_id
  join public.subjects as subject_record
    on subject_record.id = offering.subject_id
  join public.terms as term_record
    on term_record.id = offering.term_id
  where offering.id = new.subject_offering_id
    and class_record.institution_id = new.institution_id
    and subject_record.institution_id = new.institution_id;

  if not found then
    raise exception 'ATTENDANCE_SCHEDULE_NOT_FOUND'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from private.academic_day_blockers(
      new.institution_id,
      new.session_date,
      offering_academic_year_id,
      offering_class_id,
      offering_subject_id
    )
  ) then
    raise exception 'ATTENDANCE_CALENDAR_BLOCKED'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

alter function private.validate_attendance_session_schedule()
  owner to postgres;

revoke all on function private.validate_attendance_session_schedule()
  from public, anon, authenticated;

grant execute on function private.validate_attendance_session_schedule()
  to service_role;

drop trigger if exists attendance_sessions_validate_schedule
  on public.attendance_sessions;

create trigger attendance_sessions_validate_schedule
before insert or update of
  institution_id,
  subject_offering_id,
  session_date,
  starts_at,
  ends_at
on public.attendance_sessions
for each row
execute function private.validate_attendance_session_schedule();

create or replace function private.subject_offering_workload_progress(
  p_institution_id uuid,
  p_subject_offering_id uuid,
  p_reference_date date
)
returns table (
  subject_offering_id uuid,
  term_start_date date,
  term_end_date date,
  reference_date date,
  planned_occurrences bigint,
  planned_occurrences_to_date bigint,
  suspended_occurrences bigint,
  delivered_sessions bigint,
  planned_minutes bigint,
  planned_minutes_to_date bigint,
  delivered_minutes bigint,
  completion_percent numeric,
  delivery_vs_plan_to_date_percent numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with resolved_offering as (
    select
      offering.id as subject_offering_id,
      offering.class_id,
      offering.subject_id,
      offering.term_id,
      term_record.academic_year_id,
      term_record.start_date as term_start_date,
      term_record.end_date as term_end_date
    from public.subject_offerings as offering
    join public.classes as class_record
      on class_record.id = offering.class_id
    join public.subjects as subject_record
      on subject_record.id = offering.subject_id
    join public.terms as term_record
      on term_record.id = offering.term_id
    where offering.id = p_subject_offering_id
      and class_record.institution_id = p_institution_id
      and subject_record.institution_id = p_institution_id
      and offering.active is true
      and class_record.active is true
      and subject_record.active is true
  ),
  timetable_occurrences as (
    select
      resolved.subject_offering_id,
      calendar_date::date as occurrence_date,
      timetable_entry.start_time,
      timetable_entry.end_time,
      exists (
        select 1
        from private.academic_day_blockers(
          p_institution_id,
          calendar_date::date,
          resolved.academic_year_id,
          resolved.class_id,
          resolved.subject_id
        )
      ) as is_blocked
    from resolved_offering as resolved
    cross join lateral pg_catalog.generate_series(
      resolved.term_start_date,
      resolved.term_end_date,
      '1 day'::interval
    ) as generated_date(calendar_date)
    join public.timetable_entries as timetable_entry
      on timetable_entry.institution_id = p_institution_id
     and timetable_entry.subject_offering_id = resolved.subject_offering_id
     and timetable_entry.active is true
     and timetable_entry.day_of_week = extract(isodow from calendar_date)::smallint
     and (
       timetable_entry.term_id = resolved.term_id
       or timetable_entry.term_id is null
     )
     and (
       timetable_entry.academic_year_id = resolved.academic_year_id
       or timetable_entry.academic_year_id is null
     )
  ),
  planned as (
    select
      resolved.subject_offering_id,
      resolved.term_start_date,
      resolved.term_end_date,
      count(timetable_occurrence.occurrence_date)
        filter (where timetable_occurrence.is_blocked is false) as planned_occurrences,
      count(timetable_occurrence.occurrence_date)
        filter (
          where timetable_occurrence.is_blocked is false
            and timetable_occurrence.occurrence_date <= p_reference_date
        ) as planned_occurrences_to_date,
      count(timetable_occurrence.occurrence_date)
        filter (where timetable_occurrence.is_blocked is true) as suspended_occurrences,
      coalesce(sum(
        extract(epoch from (
          timetable_occurrence.end_time - timetable_occurrence.start_time
        )) / 60
      ) filter (where timetable_occurrence.is_blocked is false), 0)::bigint as planned_minutes,
      coalesce(sum(
        extract(epoch from (
          timetable_occurrence.end_time - timetable_occurrence.start_time
        )) / 60
      ) filter (
        where timetable_occurrence.is_blocked is false
          and timetable_occurrence.occurrence_date <= p_reference_date
      ), 0)::bigint as planned_minutes_to_date
    from resolved_offering as resolved
    left join timetable_occurrences as timetable_occurrence
      on timetable_occurrence.subject_offering_id = resolved.subject_offering_id
    group by
      resolved.subject_offering_id,
      resolved.term_start_date,
      resolved.term_end_date
  ),
  delivered as (
    select
      resolved.subject_offering_id,
      count(session_record.id) as delivered_sessions,
      coalesce(sum(
        extract(epoch from (
          session_record.ends_at - session_record.starts_at
        )) / 60
      ) filter (
        where session_record.starts_at is not null
          and session_record.ends_at is not null
      ), 0)::bigint as delivered_minutes
    from resolved_offering as resolved
    left join public.attendance_sessions as session_record
      on session_record.institution_id = p_institution_id
     and session_record.subject_offering_id = resolved.subject_offering_id
     and session_record.status = 'CLOSED'
     and session_record.session_date >= resolved.term_start_date
     and session_record.session_date <= resolved.term_end_date
     and session_record.session_date <= p_reference_date
    group by resolved.subject_offering_id
  ),
  metrics as (
    select
      planned.subject_offering_id,
      planned.term_start_date,
      planned.term_end_date,
      p_reference_date as reference_date,
      planned.planned_occurrences,
      planned.planned_occurrences_to_date,
      planned.suspended_occurrences,
      coalesce(delivered.delivered_sessions, 0)::bigint as delivered_sessions,
      planned.planned_minutes,
      planned.planned_minutes_to_date,
      coalesce(delivered.delivered_minutes, 0)::bigint as delivered_minutes
    from planned
    left join delivered
      on delivered.subject_offering_id = planned.subject_offering_id
  )
  select
    metrics.subject_offering_id,
    metrics.term_start_date,
    metrics.term_end_date,
    metrics.reference_date,
    metrics.planned_occurrences,
    metrics.planned_occurrences_to_date,
    metrics.suspended_occurrences,
    metrics.delivered_sessions,
    metrics.planned_minutes,
    metrics.planned_minutes_to_date,
    metrics.delivered_minutes,
    case
      when metrics.planned_minutes = 0 then null
      else round(metrics.delivered_minutes * 100.0 / metrics.planned_minutes, 2)
    end as completion_percent,
    case
      when metrics.planned_minutes_to_date = 0 then null
      else round(metrics.delivered_minutes * 100.0 / metrics.planned_minutes_to_date, 2)
    end as delivery_vs_plan_to_date_percent
  from metrics;
$$;

revoke all on function private.subject_offering_workload_progress(uuid, uuid, date)
  from public, anon, authenticated;

grant execute on function private.subject_offering_workload_progress(uuid, uuid, date)
  to service_role;

create or replace function public.get_subject_offering_workload_progress(
  p_institution_id uuid,
  p_subject_offering_id uuid,
  p_reference_date date default current_date
)
returns table (
  subject_offering_id uuid,
  term_start_date date,
  term_end_date date,
  reference_date date,
  planned_occurrences bigint,
  planned_occurrences_to_date bigint,
  suspended_occurrences bigint,
  delivered_sessions bigint,
  planned_minutes bigint,
  planned_minutes_to_date bigint,
  delivered_minutes bigint,
  completion_percent numeric,
  delivery_vs_plan_to_date_percent numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Autenticação necessária.';
  end if;

  if not public.can_access_institution(p_institution_id) then
    raise exception using
      errcode = '42501',
      message = 'Sem acesso à instituição informada.';
  end if;

  if not (
    public.can_manage_institution_operations(p_institution_id)
    or private.is_teacher_for_offering(
      p_subject_offering_id,
      p_institution_id
    )
  ) then
    raise exception using
      errcode = '42501',
      message = 'Sem permissão para consultar a carga horária desta atribuição.';
  end if;

  if not exists (
    select 1
    from public.subject_offerings as offering
    join public.classes as class_record
      on class_record.id = offering.class_id
    join public.subjects as subject_record
      on subject_record.id = offering.subject_id
    where offering.id = p_subject_offering_id
      and class_record.institution_id = p_institution_id
      and subject_record.institution_id = p_institution_id
      and offering.active is true
  ) then
    raise exception using
      errcode = 'P0002',
      message = 'A atribuição selecionada não foi encontrada.';
  end if;

  return query
    select progress.*
    from private.subject_offering_workload_progress(
      p_institution_id,
      p_subject_offering_id,
      p_reference_date
    ) as progress;
end;
$$;

revoke all on function public.get_subject_offering_workload_progress(uuid, uuid, date)
  from public, anon;

grant execute on function public.get_subject_offering_workload_progress(uuid, uuid, date)
  to authenticated;

notify pgrst, 'reload schema';

commit;
