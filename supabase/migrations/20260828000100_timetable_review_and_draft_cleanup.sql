-- Keep draft review queries fast and make proposal cleanup safe at the database boundary.
begin;

create index if not exists timetable_version_entries_review_idx
  on public.timetable_version_entries (version_id, institution_id, class_id, day_of_week, start_time);

create or replace function public.delete_timetable_draft(p_version_id uuid)
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
  if version_row.status <> 'DRAFT' then
    raise exception 'TIMETABLE_VERSION_NOT_DRAFT';
  end if;

  delete from public.timetable_versions where id = p_version_id;
end;
$$;

revoke all on function public.delete_timetable_draft(uuid) from public, anon;
grant execute on function public.delete_timetable_draft(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
