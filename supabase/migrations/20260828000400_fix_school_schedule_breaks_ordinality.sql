-- Fix PostgreSQL syntax used by replace_school_schedule_breaks.
-- jsonb_to_recordset cannot combine WITH ORDINALITY with a column definition list.

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
    from jsonb_array_elements(p_breaks) with ordinality as left_item(value, ordinal)
    join jsonb_array_elements(p_breaks) with ordinality as right_item(value, ordinal)
      on (left_item.value->>'day_of_week')::integer = (right_item.value->>'day_of_week')::integer
     and (left_item.value->>'start_time')::time < (right_item.value->>'end_time')::time
     and (right_item.value->>'start_time')::time < (left_item.value->>'end_time')::time
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
