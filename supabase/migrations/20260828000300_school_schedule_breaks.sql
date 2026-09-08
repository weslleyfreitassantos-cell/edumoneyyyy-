-- Institution-wide recess and lunch windows used by timetable generation.
-- These windows are not lessons: they block lesson allocation for a shift/day.

begin;

create table if not exists public.school_schedule_breaks (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null
    references public.institutions(id)
    on delete cascade,
  shift text not null,
  day_of_week smallint not null
    check (day_of_week between 1 and 6),
  name text not null
    check (length(trim(name)) between 1 and 80),
  start_time time without time zone not null,
  end_time time without time zone not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_schedule_breaks_supported_shift
    check (shift in ('MATUTINO', 'VESPERTINO', 'INTEGRAL', 'NOTURNO')),
  constraint school_schedule_breaks_time_range
    check (start_time < end_time)
);

create index if not exists school_schedule_breaks_lookup_idx
  on public.school_schedule_breaks (institution_id, shift, day_of_week, start_time)
  where active is true;

create trigger school_schedule_breaks_touch_updated_at
before update on public.school_schedule_breaks
for each row
execute function public.touch_academic_record_updated_at();

alter table public.school_schedule_breaks enable row level security;
revoke all on table public.school_schedule_breaks from anon;
grant select, insert, update, delete on table public.school_schedule_breaks to authenticated;

drop policy if exists school_schedule_breaks_select_policy
  on public.school_schedule_breaks;
create policy school_schedule_breaks_select_policy
on public.school_schedule_breaks
for select to authenticated
using (public.can_access_institution(institution_id));

drop policy if exists school_schedule_breaks_write_policy
  on public.school_schedule_breaks;
create policy school_schedule_breaks_write_policy
on public.school_schedule_breaks
for all to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

create or replace function public.replace_school_schedule_breaks(
  p_institution_id uuid,
  p_shift text,
  p_breaks jsonb
)
returns setof public.school_schedule_breaks
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_shift text := upper(trim(p_shift));
begin
  if not public.is_institution_admin(p_institution_id) then
    raise exception 'SCHOOL_SCHEDULE_BREAKS_FORBIDDEN' using errcode = '42501';
  end if;

  if normalized_shift is null
    or normalized_shift not in ('MATUTINO', 'VESPERTINO', 'INTEGRAL', 'NOTURNO') then
    raise exception 'SCHOOL_SCHEDULE_BREAK_SHIFT_INVALID' using errcode = '22023';
  end if;

  if p_breaks is null or jsonb_typeof(p_breaks) <> 'array' then
    raise exception 'SCHOOL_SCHEDULE_BREAKS_PAYLOAD_INVALID' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_breaks) as item(
      day_of_week integer,
      name text,
      start_time time without time zone,
      end_time time without time zone
    )
    where item.day_of_week is null
      or item.day_of_week not between 1 and 6
      or length(trim(coalesce(item.name, ''))) not between 1 and 80
      or item.start_time is null
      or item.end_time is null
      or item.start_time >= item.end_time
  ) then
    raise exception 'SCHOOL_SCHEDULE_BREAK_INVALID' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_breaks) with ordinality as left_item(
      day_of_week integer,
      name text,
      start_time time without time zone,
      end_time time without time zone,
      ordinal bigint
    )
    join jsonb_to_recordset(p_breaks) with ordinality as right_item(
      day_of_week integer,
      name text,
      start_time time without time zone,
      end_time time without time zone,
      ordinal bigint
    )
      on left_item.day_of_week = right_item.day_of_week
     and left_item.start_time < right_item.end_time
     and right_item.start_time < left_item.end_time
     and left_item.ordinal < right_item.ordinal
  ) then
    raise exception 'SCHOOL_SCHEDULE_BREAKS_OVERLAP' using errcode = '23P01';
  end if;

  delete from public.school_schedule_breaks
  where institution_id = p_institution_id
    and shift = normalized_shift;

  insert into public.school_schedule_breaks (
    institution_id,
    shift,
    day_of_week,
    name,
    start_time,
    end_time,
    active
  )
  select
    p_institution_id,
    normalized_shift,
    item.day_of_week,
    trim(item.name),
    item.start_time,
    item.end_time,
    true
  from jsonb_to_recordset(p_breaks) as item(
    day_of_week integer,
    name text,
    start_time time without time zone,
    end_time time without time zone
  );

  return query
  select *
  from public.school_schedule_breaks
  where institution_id = p_institution_id
    and shift = normalized_shift
    and active is true
  order by day_of_week, start_time;
end;
$$;

revoke all on function public.replace_school_schedule_breaks(uuid, text, jsonb) from public, anon;
grant execute on function public.replace_school_schedule_breaks(uuid, text, jsonb) to authenticated, service_role;

create or replace function private.normalize_academic_shift(p_shift text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case lower(trim(coalesce(p_shift, '')))
    when 'manha' then 'MATUTINO'
    when 'manhã' then 'MATUTINO'
    when 'matutino' then 'MATUTINO'
    when 'tarde' then 'VESPERTINO'
    when 'vespertino' then 'VESPERTINO'
    when 'integral' then 'INTEGRAL'
    when 'noite' then 'NOTURNO'
    when 'noturno' then 'NOTURNO'
    else null
  end;
$$;

create or replace function private.validate_timetable_entry_schedule_break()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  class_shift text;
begin
  if new.active is not true then
    return new;
  end if;

  select c.shift
    into class_shift
  from public.subject_offerings so
  join public.classes c on c.id = so.class_id
  where so.id = new.subject_offering_id;

  if exists (
    select 1
    from public.school_schedule_breaks b
    where b.institution_id = new.institution_id
      and b.shift = private.normalize_academic_shift(class_shift)
      and b.day_of_week = new.day_of_week
      and b.active is true
      and b.start_time < new.end_time
      and new.start_time < b.end_time
  ) then
    raise exception 'TIMETABLE_ENTRY_DURING_SCHEDULE_BREAK' using errcode = '23P01';
  end if;

  return new;
end;
$$;

drop trigger if exists timetable_entries_validate_schedule_break
  on public.timetable_entries;
create trigger timetable_entries_validate_schedule_break
before insert or update of institution_id, subject_offering_id, day_of_week, start_time, end_time, active
on public.timetable_entries
for each row
execute function private.validate_timetable_entry_schedule_break();

notify pgrst, 'reload schema';
commit;
