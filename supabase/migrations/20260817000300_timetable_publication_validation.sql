-- Server-side validation for draft timetable publication.

begin;

create or replace function private.validate_timetable_version_entry_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  offering_class_id uuid;
  offering_term_id uuid;
  offering_institution_id uuid;
  offering_teacher_id uuid;
  offering_subject_id uuid;
begin
  select so.class_id, so.term_id, c.institution_id, so.teacher_profile_id, so.subject_id
    into offering_class_id, offering_term_id, offering_institution_id, offering_teacher_id, offering_subject_id
  from public.subject_offerings so
  join public.classes c on c.id = so.class_id
  where so.id = new.subject_offering_id;

  if offering_class_id is null or offering_institution_id is distinct from new.institution_id or offering_class_id is distinct from new.class_id or offering_term_id is distinct from new.term_id or offering_teacher_id is null or offering_subject_id is null then
    raise exception 'TIMETABLE_VERSION_ENTRY_SCOPE_MISMATCH' using errcode = '23514';
  end if;
  if not exists (select 1 from public.terms t where t.id = new.term_id and t.academic_year_id = new.academic_year_id) then
    raise exception 'TIMETABLE_VERSION_TERM_SCOPE_MISMATCH' using errcode = '23514';
  end if;
  if new.room_id is not null and not exists (select 1 from public.rooms r where r.id = new.room_id and r.institution_id = new.institution_id) then
    raise exception 'TIMETABLE_VERSION_ROOM_SCOPE_MISMATCH' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists timetable_version_entries_validate_scope on public.timetable_version_entries;
create trigger timetable_version_entries_validate_scope
before insert or update of institution_id, academic_year_id, term_id, class_id, subject_offering_id, room_id
on public.timetable_version_entries
for each row execute function private.validate_timetable_version_entry_scope();

create or replace function public.publish_timetable_version(p_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  version_row public.timetable_versions;
  entry_row record;
  published_count integer := 0;
  required_lessons integer;
  generated_lessons integer;
begin
  select * into version_row from public.timetable_versions where id = p_version_id for update;
  if not found or not public.can_manage_institution_operations(version_row.institution_id) then raise exception 'TIMETABLE_VERSION_FORBIDDEN' using errcode = '42501'; end if;
  if version_row.status <> 'DRAFT' then raise exception 'TIMETABLE_VERSION_NOT_DRAFT'; end if;

  if exists (
    select 1 from public.timetable_version_entries e
    join public.subject_offerings so on so.id = e.subject_offering_id
    join public.classes c on c.id = so.class_id
    join public.terms t on t.id = so.term_id
    where e.version_id = p_version_id
      and (e.institution_id <> version_row.institution_id or c.institution_id <> version_row.institution_id or t.academic_year_id <> version_row.academic_year_id)
  ) then raise exception 'TIMETABLE_VERSION_SCOPE_MISMATCH'; end if;

  if exists (
    select 1
    from public.timetable_version_entries e
    join public.subject_offerings so on so.id = e.subject_offering_id
    where e.version_id = p_version_id
      and not exists (select 1 from public.teacher_subjects ts where ts.institution_id = version_row.institution_id and ts.teacher_profile_id = so.teacher_profile_id and ts.subject_id = so.subject_id and ts.active is true)
  ) then raise exception 'TEACHER_SUBJECT_NOT_AUTHORIZED'; end if;

  if exists (
    select 1
    from public.timetable_version_entries e
    join public.subject_offerings so on so.id = e.subject_offering_id
    join public.classes c on c.id = so.class_id
    where e.version_id = p_version_id
      and not exists (
        select 1 from public.teacher_availability a
        where a.institution_id = version_row.institution_id and a.teacher_profile_id = so.teacher_profile_id and a.day_of_week = e.day_of_week and a.active is true and a.start_time <= e.start_time and a.end_time >= e.end_time
      )
  ) then raise exception 'TEACHER_NOT_AVAILABLE'; end if;

  if exists (
    select 1
    from public.timetable_version_entries e
    join public.subject_offerings so on so.id = e.subject_offering_id
    join public.classes c on c.id = so.class_id
    where e.version_id = p_version_id
      and not exists (
        select 1 from public.school_time_slots slot
        where slot.institution_id = version_row.institution_id and slot.shift = coalesce(c.shift, slot.shift) and slot.day_of_week = e.day_of_week and slot.active is true and slot.start_time <= e.start_time and slot.end_time >= e.end_time
      )
  ) then raise exception 'SCHOOL_TIME_SLOT_NOT_CONFIGURED'; end if;

  if exists (
    select 1
    from public.timetable_version_entries left_entry
    join public.subject_offerings left_so on left_so.id = left_entry.subject_offering_id
    join public.terms left_term on left_term.id = left_so.term_id
    join public.timetable_version_entries right_entry on right_entry.version_id = left_entry.version_id and right_entry.id <> left_entry.id
    join public.subject_offerings right_so on right_so.id = right_entry.subject_offering_id
    join public.terms right_term on right_term.id = right_so.term_id
    where left_entry.version_id = p_version_id
      and left_entry.day_of_week = right_entry.day_of_week
      and left_entry.start_time < right_entry.end_time
      and right_entry.start_time < left_entry.end_time
      and left_term.start_date <= right_term.end_date
      and right_term.start_date <= left_term.end_date
      and (left_so.class_id = right_so.class_id or left_so.teacher_profile_id = right_so.teacher_profile_id or (left_entry.room_id is not null and left_entry.room_id = right_entry.room_id))
  ) then raise exception 'TIMETABLE_VERSION_CONFLICT'; end if;

  for entry_row in select so.id, ci.weekly_lessons from public.subject_offerings so join public.class_curriculum_items ci on ci.class_id = so.class_id and ci.subject_id = so.subject_id where so.active is true and exists (select 1 from public.timetable_version_entries e where e.version_id = p_version_id and e.subject_offering_id = so.id) loop
    select count(*) into generated_lessons from public.timetable_version_entries where version_id = p_version_id and subject_offering_id = entry_row.id and active is true;
    required_lessons := entry_row.weekly_lessons;
    if generated_lessons <> required_lessons then raise exception 'WEEKLY_LESSONS_MISMATCH'; end if;
  end loop;

  update public.timetable_entries te set active = false
  where te.institution_id = version_row.institution_id and te.subject_offering_id in (select so.id from public.subject_offerings so join public.terms t on t.id = so.term_id where t.academic_year_id = version_row.academic_year_id);

  for entry_row in select * from public.timetable_version_entries where version_id = p_version_id and active is true loop
    insert into public.timetable_entries (institution_id, subject_offering_id, room_id, day_of_week, start_time, end_time, active)
    values (version_row.institution_id, entry_row.subject_offering_id, entry_row.room_id, entry_row.day_of_week, entry_row.start_time, entry_row.end_time, true);
    published_count := published_count + 1;
  end loop;

  update public.timetable_versions set status = 'ARCHIVED', updated_at = now() where institution_id = version_row.institution_id and academic_year_id = version_row.academic_year_id and status = 'PUBLISHED' and id <> p_version_id;
  update public.timetable_versions set status = 'PUBLISHED', published_at = now(), updated_at = now() where id = p_version_id;
  return jsonb_build_object('version_id', p_version_id, 'published_entries', published_count);
end;
$$;

revoke all on function public.publish_timetable_version(uuid) from public, anon;
grant execute on function public.publish_timetable_version(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
