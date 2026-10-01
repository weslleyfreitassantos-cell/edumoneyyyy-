begin;

-- Returns only the minimum metadata required to decide whether a civil date
-- is operationally blocked. Audience remains a visibility concern and does
-- not change the blocking rules.
create or replace function private.academic_day_blockers(
  p_institution_id uuid,
  p_date date,
  p_academic_year_id uuid default null,
  p_class_id uuid default null,
  p_subject_id uuid default null
)
returns table (
  event_id uuid,
  event_type public.academic_calendar_event_type
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    event_record.id as event_id,
    event_record.event_type
  from public.academic_calendar_events as event_record
  where event_record.institution_id = p_institution_id
    and event_record.active is true
    and event_record.all_day is true
    and event_record.event_type in (
      'HOLIDAY'::public.academic_calendar_event_type,
      'RECESS'::public.academic_calendar_event_type,
      'CLASS_SUSPENSION'::public.academic_calendar_event_type
    )
    and (event_record.starts_at at time zone 'UTC')::date <= p_date
    and (coalesce(event_record.ends_at, event_record.starts_at) at time zone 'UTC')::date >= p_date
    and (
      event_record.academic_year_id is null
      or event_record.academic_year_id = p_academic_year_id
    )
    and (
      event_record.class_id is null
      or event_record.class_id = p_class_id
    )
    and (
      event_record.subject_id is null
      or event_record.subject_id = p_subject_id
    )
  order by
    case event_record.event_type
      when 'HOLIDAY'::public.academic_calendar_event_type then 1
      when 'RECESS'::public.academic_calendar_event_type then 2
      when 'CLASS_SUSPENSION'::public.academic_calendar_event_type then 3
    end,
    event_record.id;
$$;

create or replace function public.get_academic_day_blockers(
  p_institution_id uuid,
  p_date date,
  p_academic_year_id uuid default null,
  p_class_id uuid default null,
  p_subject_id uuid default null
)
returns table (
  event_id uuid,
  event_type public.academic_calendar_event_type
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

  return query
    select blockers.event_id, blockers.event_type
    from private.academic_day_blockers(
      p_institution_id,
      p_date,
      p_academic_year_id,
      p_class_id,
      p_subject_id
    ) as blockers;
end;
$$;

revoke all on function private.academic_day_blockers(uuid, date, uuid, uuid, uuid)
  from public, anon, authenticated;

revoke all on function public.get_academic_day_blockers(uuid, date, uuid, uuid, uuid)
  from public, anon;

grant execute on function public.get_academic_day_blockers(uuid, date, uuid, uuid, uuid)
  to authenticated;

commit;
