-- Fix ambiguous PL/pgSQL variable names in conflict triggers
--
-- The original 20260727000200 migration used variable names (class_id,
-- teacher_profile_id) that shadowed column names, causing "column reference
-- is ambiguous" errors on INSERT/UPDATE.
--
-- This migration renames them to v_class_id and v_teacher_profile_id
-- and does NOT recreate any tables, policies, or data.

begin;

-- ============================================================
-- 1. Fix: teacher conflict trigger
-- ============================================================

create or replace function private.check_timetable_entry_teacher_conflict()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher_profile_id uuid;
begin
  if new.active is not true then
    return new;
  end if;

  select offering.teacher_profile_id
  into v_teacher_profile_id
  from public.subject_offerings as offering
  where offering.id = new.subject_offering_id;

  if exists (
    select 1
    from public.timetable_entries as entry
    join public.subject_offerings as offering
      on offering.id = entry.subject_offering_id
    where offering.teacher_profile_id = v_teacher_profile_id
      and entry.day_of_week = new.day_of_week
      and entry.active is true
      and entry.id is distinct from new.id
      and entry.start_time < new.end_time
      and new.start_time < entry.end_time
  ) then
    raise exception 'TEACHER_ALREADY_BOOKED'
      using hint = 'This teacher is already assigned at this time.';
  end if;

  return new;
end;
$$;

revoke all on function private.check_timetable_entry_teacher_conflict()
  from public, anon, authenticated;

grant execute on function private.check_timetable_entry_teacher_conflict()
  to service_role;

-- ============================================================
-- 2. Fix: class conflict trigger
-- ============================================================

create or replace function private.check_timetable_entry_class_conflict()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
begin
  if new.active is not true then
    return new;
  end if;

  select offering.class_id
  into v_class_id
  from public.subject_offerings as offering
  where offering.id = new.subject_offering_id;

  if exists (
    select 1
    from public.timetable_entries as entry
    join public.subject_offerings as offering
      on offering.id = entry.subject_offering_id
    where offering.class_id = v_class_id
      and entry.day_of_week = new.day_of_week
      and entry.active is true
      and entry.id is distinct from new.id
      and entry.start_time < new.end_time
      and new.start_time < entry.end_time
  ) then
    raise exception 'CLASS_ALREADY_BOOKED'
      using hint = 'This class already has a lesson at this time.';
  end if;

  return new;
end;
$$;

revoke all on function private.check_timetable_entry_class_conflict()
  from public, anon, authenticated;

grant execute on function private.check_timetable_entry_class_conflict()
  to service_role;

notify pgrst, 'reload schema';

commit;
