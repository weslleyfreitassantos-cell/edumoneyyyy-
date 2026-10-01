-- Read-only preview for copying a draft day. The mutation remains in the
-- existing copy_timetable_draft_day RPC and is only called after confirmation.

begin;

create or replace function private.assert_viewable_timetable_draft(
  p_version_id uuid,
  p_institution_id uuid
)
returns public.timetable_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  version_row public.timetable_versions;
begin
  if not public.can_manage_institution_operations(p_institution_id) then
    raise exception 'TIMETABLE_VERSION_FORBIDDEN' using errcode = '42501';
  end if;

  select v.* into version_row
  from public.timetable_versions v
  where v.id = p_version_id
    and v.institution_id = p_institution_id;

  if not found then
    raise exception 'TIMETABLE_VERSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if version_row.status <> 'DRAFT' then
    raise exception 'TIMETABLE_VERSION_NOT_DRAFT' using errcode = '55000';
  end if;
  return version_row;
end;
$$;

create or replace function public.preview_timetable_draft_day_copy(
  p_version_id uuid,
  p_institution_id uuid,
  p_source_day smallint,
  p_target_day smallint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_entry record;
  total_count integer := 0;
  copyable_count integer := 0;
  conflict_count integer := 0;
  details jsonb := '[]'::jsonb;
begin
  perform private.assert_viewable_timetable_draft(p_version_id, p_institution_id);
  if p_source_day not between 1 and 6 or p_target_day not between 1 and 6 or p_source_day = p_target_day then
    raise exception 'TIMETABLE_COPY_DAY_INVALID' using errcode = '22023';
  end if;

  for source_entry in
    select * from public.timetable_version_entries
    where version_id = p_version_id and institution_id = p_institution_id
      and day_of_week = p_source_day and active is true
  loop
    total_count := total_count + 1;
    if exists (
      select 1 from public.timetable_version_entries existing
      where existing.version_id = p_version_id and existing.institution_id = p_institution_id
        and existing.active is true and existing.class_id = source_entry.class_id
        and existing.term_id = source_entry.term_id and existing.day_of_week = p_target_day
        and existing.start_time = source_entry.start_time and existing.end_time = source_entry.end_time
    ) then
      conflict_count := conflict_count + 1;
      details := details || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'class_id', source_entry.class_id, 'term_id', source_entry.term_id,
        'subject_offering_id', source_entry.subject_offering_id,
        'start_time', source_entry.start_time, 'end_time', source_entry.end_time,
        'copyable', false, 'reason', 'TARGET_CELL_OCCUPIED'
      ));
    else
      begin
        -- This is the same scope check used by the mutating RPC, but this
        -- branch performs no insert and therefore remains read-only.
        perform private.assert_timetable_draft_entry_scope(
          p_institution_id, source_entry.academic_year_id, source_entry.term_id,
          source_entry.class_id, source_entry.subject_offering_id, source_entry.room_id,
          p_target_day, source_entry.start_time, source_entry.end_time
        );
        copyable_count := copyable_count + 1;
        details := details || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'class_id', source_entry.class_id, 'term_id', source_entry.term_id,
          'subject_offering_id', source_entry.subject_offering_id,
          'start_time', source_entry.start_time, 'end_time', source_entry.end_time,
          'copyable', true
        ));
      exception when others then
        conflict_count := conflict_count + 1;
        details := details || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'class_id', source_entry.class_id, 'term_id', source_entry.term_id,
          'subject_offering_id', source_entry.subject_offering_id,
          'start_time', source_entry.start_time, 'end_time', source_entry.end_time,
          'copyable', false, 'reason', sqlerrm
        ));
      end;
    end if;
  end loop;

  return pg_catalog.jsonb_build_object(
    'total', total_count,
    'copyable', copyable_count,
    'conflicts', conflict_count,
    'details', details,
    'source_day', p_source_day,
    'target_day', p_target_day
  );
end;
$$;

revoke all on function public.preview_timetable_draft_day_copy(uuid, uuid, smallint, smallint) from public, anon;
grant execute on function public.preview_timetable_draft_day_copy(uuid, uuid, smallint, smallint) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
