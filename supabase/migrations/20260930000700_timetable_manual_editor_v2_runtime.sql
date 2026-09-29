-- Runtime hardening for the manual timetable editor.
-- The two-slot action is one transaction: either both entries are created or
-- the draft remains unchanged.

begin;

create or replace function public.add_timetable_draft_double_slot(
  p_version_id uuid,
  p_institution_id uuid,
  p_academic_year_id uuid,
  p_term_id uuid,
  p_class_id uuid,
  p_subject_offering_id uuid,
  p_room_id uuid,
  p_day_of_week smallint,
  p_start_time time,
  p_end_time time,
  p_next_start_time time,
  p_next_end_time time,
  p_locked boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_id uuid;
  second_id uuid;
begin
  perform private.assert_editable_timetable_draft(p_version_id, p_institution_id);

  perform private.assert_timetable_draft_entry_scope(
    p_institution_id, p_academic_year_id, p_term_id, p_class_id,
    p_subject_offering_id, p_room_id, p_day_of_week, p_start_time, p_end_time
  );
  perform private.assert_timetable_draft_entry_scope(
    p_institution_id, p_academic_year_id, p_term_id, p_class_id,
    p_subject_offering_id, p_room_id, p_day_of_week, p_next_start_time, p_next_end_time
  );

  if not exists (
    select 1
    from public.school_time_slots current_slot
    join public.school_time_slots next_slot
      on next_slot.institution_id = current_slot.institution_id
      and next_slot.shift = current_slot.shift
      and next_slot.day_of_week = current_slot.day_of_week
      and next_slot.slot_number = current_slot.slot_number + 1
    where current_slot.institution_id = p_institution_id
      and current_slot.day_of_week = p_day_of_week
      and current_slot.start_time = p_start_time
      and current_slot.end_time = p_end_time
      and next_slot.start_time = p_next_start_time
      and next_slot.end_time = p_next_end_time
      and current_slot.active is true
      and next_slot.active is true
  ) then
    raise exception 'TIMETABLE_DOUBLE_SLOT_NOT_CONSECUTIVE' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.timetable_version_entries e
    where e.version_id = p_version_id
      and e.institution_id = p_institution_id
      and e.class_id = p_class_id
      and e.term_id = p_term_id
      and e.active is true
      and (
        (e.start_time = p_start_time and e.end_time = p_end_time)
        or (e.start_time = p_next_start_time and e.end_time = p_next_end_time)
      )
  ) then
    raise exception 'TIMETABLE_SLOT_OCCUPIED' using errcode = '23P01';
  end if;

  insert into public.timetable_version_entries (
    version_id, institution_id, academic_year_id, term_id, class_id,
    subject_offering_id, room_id, day_of_week, start_time, end_time, locked, active
  ) values (
    p_version_id, p_institution_id, p_academic_year_id, p_term_id, p_class_id,
    p_subject_offering_id, p_room_id, p_day_of_week, p_start_time, p_end_time,
    coalesce(p_locked, false), true
  ) returning id into first_id;

  insert into public.timetable_version_entries (
    version_id, institution_id, academic_year_id, term_id, class_id,
    subject_offering_id, room_id, day_of_week, start_time, end_time, locked, active
  ) values (
    p_version_id, p_institution_id, p_academic_year_id, p_term_id, p_class_id,
    p_subject_offering_id, p_room_id, p_day_of_week, p_next_start_time, p_next_end_time,
    coalesce(p_locked, false), true
  ) returning id into second_id;

  return pg_catalog.jsonb_build_object('first_id', first_id, 'second_id', second_id);
end;
$$;

revoke all on function public.add_timetable_draft_double_slot(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, smallint, time, time, time, time, boolean
) from public, anon;
grant execute on function public.add_timetable_draft_double_slot(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, smallint, time, time, time, time, boolean
) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
