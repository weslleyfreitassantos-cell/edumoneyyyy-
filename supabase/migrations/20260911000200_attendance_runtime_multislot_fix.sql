-- Restore authenticated attendance inserts and the historical per-slot
-- uniqueness model without changing any prior migration.

begin;

-- attendance_sessions.id uses this function as its default. The function only
-- generates UUIDs; RLS and the attendance policies still authorize the insert.
grant execute on function public.uuid_generate_v4()
  to authenticated;

-- The historical constraint includes starts_at and is the canonical session
-- identity. The later offering/date index incorrectly collapsed all slots.
drop index if exists public.attendance_sessions_offering_date_active_unique_idx;

commit;
