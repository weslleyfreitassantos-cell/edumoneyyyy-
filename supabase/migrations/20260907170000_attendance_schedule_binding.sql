-- Bind new attendance sessions to a published timetable entry.

begin;

create or replace function private.validate_attendance_session_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_day smallint;
begin
  -- Keep legacy sessions readable when they were created without a schedule.
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

notify pgrst, 'reload schema';

commit;
