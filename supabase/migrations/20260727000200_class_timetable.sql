-- Class Timetable (Grade Semanal de Horários)
--
-- Adds rooms table and timetable_entries to define the weekly
-- class schedule from Monday to Saturday, with room assignment,
-- teacher assignment, and conflict detection.
--
-- Conflicts detected:
--   ROOM_ALREADY_BOOKED        – same room, day, overlapping time
--   TEACHER_ALREADY_BOOKED     – same teacher, day, overlapping time
--   CLASS_ALREADY_BOOKED       – same class, day, overlapping time

begin;

-- ============================================================
-- 1. Table: rooms
-- ============================================================

create table public.rooms (
  id uuid primary key
    default extensions.uuid_generate_v4(),

  institution_id uuid not null
    references public.institutions(id)
    on delete restrict,

  name text not null
    check (length(name) between 1 and 120),

  code text,
  capacity smallint
    check (capacity between 1 and 500),

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rooms_institution_idx
  on public.rooms (institution_id);

-- ============================================================
-- 2. Table: timetable_entries
-- ============================================================

create table public.timetable_entries (
  id uuid primary key
    default extensions.uuid_generate_v4(),

  institution_id uuid not null
    references public.institutions(id)
    on delete restrict,

  subject_offering_id uuid not null
    references public.subject_offerings(id)
    on delete restrict,

  room_id uuid
    references public.rooms(id)
    on delete restrict,

  day_of_week smallint not null
    check (day_of_week between 1 and 6),

  start_time time without time zone not null,
  end_time time without time zone not null,

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint timetable_entries_time_range_check
    check (start_time < end_time)
);

create index timetable_entries_institution_idx
  on public.timetable_entries (institution_id);

create index timetable_entries_class_idx
  on public.timetable_entries using btree (institution_id, day_of_week);

-- ============================================================
-- 3. Trigger: auto-update updated_at (rooms)
-- ============================================================

create or replace function private.set_rooms_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rooms_set_updated_at
  on public.rooms;

create trigger rooms_set_updated_at
before update on public.rooms
for each row
execute function private.set_rooms_updated_at();

revoke all on function private.set_rooms_updated_at()
  from public, anon, authenticated;

grant execute on function private.set_rooms_updated_at()
  to service_role;

-- ============================================================
-- 4. Trigger: auto-update updated_at (timetable_entries)
-- ============================================================

create or replace function private.set_timetable_entries_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists timetable_entries_set_updated_at
  on public.timetable_entries;

create trigger timetable_entries_set_updated_at
before update on public.timetable_entries
for each row
execute function private.set_timetable_entries_updated_at();

revoke all on function private.set_timetable_entries_updated_at()
  from public, anon, authenticated;

grant execute on function private.set_timetable_entries_updated_at()
  to service_role;

-- ============================================================
-- 5. Tenant integrity validation (rooms)
-- ============================================================

create or replace function private.validate_rooms_tenant_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.institutions
    where id = new.institution_id
  ) then
    raise exception 'Room institution does not exist.'
      using errcode = '23503';
  end if;

  return new;
end;
$$;

drop trigger if exists rooms_validate_tenant_integrity
  on public.rooms;

create trigger rooms_validate_tenant_integrity
before insert or update of institution_id
on public.rooms
for each row
execute function private.validate_rooms_tenant_integrity();

revoke all on function private.validate_rooms_tenant_integrity()
  from public, anon, authenticated;

grant execute on function private.validate_rooms_tenant_integrity()
  to service_role;

-- ============================================================
-- 6. Tenant integrity validation (timetable_entries)
-- ============================================================

create or replace function private.validate_timetable_entry_tenant_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  offering_institution_id uuid;
begin
  -- Validate subject_offering belongs to the same institution
  select classes.institution_id
  into offering_institution_id
  from public.subject_offerings as offering
  join public.classes as classes
    on classes.id = offering.class_id
  where offering.id = new.subject_offering_id;

  if not found then
    raise exception 'Subject offering not found.'
      using errcode = '23503';
  end if;

  if offering_institution_id is distinct from new.institution_id then
    raise exception 'Timetable entry institution must match subject offering institution.'
      using errcode = '23514';
  end if;

  -- Validate room belongs to the same institution (if provided)
  if new.room_id is not null then
    if not exists (
      select 1 from public.rooms as room
      where room.id = new.room_id
        and room.institution_id = new.institution_id
    ) then
      raise exception 'Room not found in this institution.'
        using errcode = '23503';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists timetable_entries_validate_tenant_integrity
  on public.timetable_entries;

create trigger timetable_entries_validate_tenant_integrity
before insert or update of institution_id, subject_offering_id, room_id
on public.timetable_entries
for each row
execute function private.validate_timetable_entry_tenant_integrity();

revoke all on function private.validate_timetable_entry_tenant_integrity()
  from public, anon, authenticated;

grant execute on function private.validate_timetable_entry_tenant_integrity()
  to service_role;

-- ============================================================
-- 7. Conflict detection: room double-booking
-- ============================================================

create or replace function private.check_timetable_entry_room_conflict()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.room_id is not null and new.active is true then
    if exists (
      select 1
      from public.timetable_entries as entry
      where entry.room_id = new.room_id
        and entry.day_of_week = new.day_of_week
        and entry.active is true
        and entry.id is distinct from new.id
        and entry.start_time < new.end_time
        and new.start_time < entry.end_time
    ) then
      raise exception 'ROOM_ALREADY_BOOKED'
        using hint = 'This room is already booked at this time.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists timetable_entries_check_room_conflict
  on public.timetable_entries;

create trigger timetable_entries_check_room_conflict
before insert or update of room_id, day_of_week, start_time, end_time, active
on public.timetable_entries
for each row
execute function private.check_timetable_entry_room_conflict();

revoke all on function private.check_timetable_entry_room_conflict()
  from public, anon, authenticated;

grant execute on function private.check_timetable_entry_room_conflict()
  to service_role;

-- ============================================================
-- 8. Conflict detection: teacher double-booking
-- ============================================================

create or replace function private.check_timetable_entry_teacher_conflict()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  teacher_profile_id uuid;
begin
  if new.active is not true then
    return new;
  end if;

  select offering.teacher_profile_id
  into teacher_profile_id
  from public.subject_offerings as offering
  where offering.id = new.subject_offering_id;

  if exists (
    select 1
    from public.timetable_entries as entry
    join public.subject_offerings as offering
      on offering.id = entry.subject_offering_id
    where offering.teacher_profile_id = teacher_profile_id
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

drop trigger if exists timetable_entries_check_teacher_conflict
  on public.timetable_entries;

create trigger timetable_entries_check_teacher_conflict
before insert or update of subject_offering_id, day_of_week, start_time, end_time, active
on public.timetable_entries
for each row
execute function private.check_timetable_entry_teacher_conflict();

revoke all on function private.check_timetable_entry_teacher_conflict()
  from public, anon, authenticated;

grant execute on function private.check_timetable_entry_teacher_conflict()
  to service_role;

-- ============================================================
-- 9. Conflict detection: class double-booking
-- ============================================================

create or replace function private.check_timetable_entry_class_conflict()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  class_id uuid;
begin
  if new.active is not true then
    return new;
  end if;

  select offering.class_id
  into class_id
  from public.subject_offerings as offering
  where offering.id = new.subject_offering_id;

  if exists (
    select 1
    from public.timetable_entries as entry
    join public.subject_offerings as offering
      on offering.id = entry.subject_offering_id
    where offering.class_id = class_id
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

drop trigger if exists timetable_entries_check_class_conflict
  on public.timetable_entries;

create trigger timetable_entries_check_class_conflict
before insert or update of subject_offering_id, day_of_week, start_time, end_time, active
on public.timetable_entries
for each row
execute function private.check_timetable_entry_class_conflict();

revoke all on function private.check_timetable_entry_class_conflict()
  from public, anon, authenticated;

grant execute on function private.check_timetable_entry_class_conflict()
  to service_role;

-- ============================================================
-- 10. RLS
-- ============================================================

alter table public.rooms enable row level security;

drop policy if exists rooms_select_policy
  on public.rooms;

create policy rooms_select_policy
on public.rooms
for select
to authenticated
using (
  public.can_access_institution(institution_id)
);

drop policy if exists rooms_write_policy
  on public.rooms;

create policy rooms_write_policy
on public.rooms
for insert
to authenticated
with check (
  public.can_manage_institution_operations(institution_id)
);

drop policy if exists rooms_update_policy
  on public.rooms;

create policy rooms_update_policy
on public.rooms
for update
to authenticated
using (
  public.can_manage_institution_operations(institution_id)
)
with check (
  public.can_manage_institution_operations(institution_id)
);

-- No delete policy for rooms — soft-deactivate via active = false.

alter table public.timetable_entries enable row level security;

drop policy if exists timetable_entries_select_policy
  on public.timetable_entries;

create policy timetable_entries_select_policy
on public.timetable_entries
for select
to authenticated
using (
  public.can_access_institution(institution_id)
);

drop policy if exists timetable_entries_write_policy
  on public.timetable_entries;

create policy timetable_entries_write_policy
on public.timetable_entries
for insert
to authenticated
with check (
  public.can_manage_institution_operations(institution_id)
);

drop policy if exists timetable_entries_update_policy
  on public.timetable_entries;

create policy timetable_entries_update_policy
on public.timetable_entries
for update
to authenticated
using (
  public.can_manage_institution_operations(institution_id)
)
with check (
  public.can_manage_institution_operations(institution_id)
);

-- No delete policy — entries are soft-deactivated via active = false.

notify pgrst, 'reload schema';

commit;
