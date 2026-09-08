-- Allow an institution manager to remove a published generated timetable.
-- Published entries are deactivated before the version is deleted so students
-- no longer see the removed schedule while historical source data remains intact.

begin;

create or replace function public.delete_timetable_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  version_row public.timetable_versions;
begin
  select * into version_row
  from public.timetable_versions
  where id = p_version_id
  for update;

  if not found then
    raise exception 'TIMETABLE_VERSION_FORBIDDEN' using errcode = '42501';
  end if;

  if not public.can_manage_institution_operations(version_row.institution_id) then
    raise exception 'TIMETABLE_VERSION_FORBIDDEN' using errcode = '42501';
  end if;

  if version_row.status not in ('DRAFT', 'PUBLISHED') then
    raise exception 'TIMETABLE_VERSION_NOT_DELETABLE';
  end if;

  if version_row.status = 'PUBLISHED' then
    update public.timetable_entries as entry
    set active = false
    from public.timetable_version_entries as version_entry
    where version_entry.version_id = p_version_id
      and version_entry.active is true
      and entry.institution_id = version_row.institution_id
      and entry.academic_year_id = version_entry.academic_year_id
      and entry.term_id = version_entry.term_id
      and entry.subject_offering_id = version_entry.subject_offering_id
      and entry.day_of_week = version_entry.day_of_week
      and entry.start_time = version_entry.start_time
      and entry.end_time = version_entry.end_time
      and entry.room_id is not distinct from version_entry.room_id
      and entry.active is true;
  end if;

  delete from public.timetable_versions
  where id = p_version_id;
end;
$$;

revoke all on function public.delete_timetable_version(uuid) from public, anon;
grant execute on function public.delete_timetable_version(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
