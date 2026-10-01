-- Create a timetable version and all of its entries in one transaction.
-- A failed entry insert must not leave an orphan DRAFT version behind.

begin;

create or replace function public.create_timetable_draft(
  p_institution_id uuid,
  p_academic_year_id uuid,
  p_name text,
  p_generation_source text,
  p_generation_shift text,
  p_created_by uuid,
  p_source_version_id uuid,
  p_entries jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_version_id uuid;
  entries_payload jsonb := coalesce(p_entries, '[]'::jsonb);
begin
  if not public.can_manage_institution_operations(p_institution_id) then
    raise exception 'TIMETABLE_VERSION_FORBIDDEN' using errcode = '42501';
  end if;

  if auth.uid() is not null and p_created_by is distinct from auth.uid() then
    raise exception 'TIMETABLE_VERSION_CREATED_BY_MISMATCH' using errcode = '42501';
  end if;

  if jsonb_typeof(entries_payload) <> 'array' then
    raise exception 'TIMETABLE_ENTRIES_MUST_BE_ARRAY' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.academic_years academic_year
    where academic_year.id = p_academic_year_id
      and academic_year.institution_id = p_institution_id
  ) then
    raise exception 'TIMETABLE_VERSION_SCOPE_MISMATCH' using errcode = '23514';
  end if;

  if p_source_version_id is not null and not exists (
    select 1
    from public.timetable_versions source_version
    where source_version.id = p_source_version_id
      and source_version.institution_id = p_institution_id
      and source_version.academic_year_id = p_academic_year_id
  ) then
    raise exception 'TIMETABLE_SOURCE_VERSION_SCOPE_MISMATCH' using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(entries_payload) as entry(
      academic_year_id uuid,
      term_id uuid,
      class_id uuid,
      subject_offering_id uuid,
      room_id uuid,
      day_of_week smallint,
      start_time time,
      end_time time,
      locked boolean,
      active boolean
    )
    where entry.academic_year_id is distinct from p_academic_year_id
  ) then
    raise exception 'TIMETABLE_VERSION_ENTRY_YEAR_SCOPE_MISMATCH' using errcode = '23514';
  end if;

  insert into public.timetable_versions (
    institution_id,
    academic_year_id,
    name,
    status,
    generation_source,
    generation_shift,
    created_by,
    source_version_id
  )
  values (
    p_institution_id,
    p_academic_year_id,
    p_name,
    'DRAFT',
    p_generation_source,
    p_generation_shift,
    p_created_by,
    p_source_version_id
  )
  returning id into created_version_id;

  insert into public.timetable_version_entries (
    version_id,
    institution_id,
    academic_year_id,
    term_id,
    class_id,
    subject_offering_id,
    room_id,
    day_of_week,
    start_time,
    end_time,
    locked,
    active
  )
  select
    created_version_id,
    p_institution_id,
    entry.academic_year_id,
    entry.term_id,
    entry.class_id,
    entry.subject_offering_id,
    entry.room_id,
    entry.day_of_week,
    entry.start_time,
    entry.end_time,
    coalesce(entry.locked, false),
    coalesce(entry.active, true)
  from jsonb_to_recordset(entries_payload) as entry(
    academic_year_id uuid,
    term_id uuid,
    class_id uuid,
    subject_offering_id uuid,
    room_id uuid,
    day_of_week smallint,
    start_time time,
    end_time time,
    locked boolean,
    active boolean
  );

  return created_version_id;
end;
$$;

revoke all on function public.create_timetable_draft(uuid, uuid, text, text, text, uuid, uuid, jsonb)
  from public, anon;
grant execute on function public.create_timetable_draft(uuid, uuid, text, text, text, uuid, uuid, jsonb)
  to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
