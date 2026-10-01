-- Serialize writes that compete for the same timetable resource before the
-- existing conflict checks inspect committed timetable rows.
begin;

create or replace function private.lock_timetable_resource(
  p_resource_type text,
  p_resource_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_resource_id is null then
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      pg_catalog.concat('timetable:', p_resource_type, ':', p_resource_id::text),
      0
    )
  );
end;
$$;

revoke all on function private.lock_timetable_resource(text, uuid)
  from public, anon, authenticated;

grant execute on function private.lock_timetable_resource(text, uuid)
  to service_role;

create or replace function private.validate_timetable_entry_tenant_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_institution_id uuid;
  v_class_academic_year_id uuid;
  v_subject_institution_id uuid;
  v_term_institution_id uuid;
  v_term_academic_year_id uuid;
  v_offering_term_id uuid;
  v_teacher_profile_id uuid;
begin
  select
    class_record.institution_id,
    class_record.academic_year_id,
    subject_record.institution_id,
    academic_year.institution_id,
    term_record.academic_year_id,
    term_record.id,
    offering.teacher_profile_id
  into
    v_class_institution_id,
    v_class_academic_year_id,
    v_subject_institution_id,
    v_term_institution_id,
    v_term_academic_year_id,
    v_offering_term_id,
    v_teacher_profile_id
  from public.subject_offerings as offering
  join public.classes as class_record
    on class_record.id = offering.class_id
  join public.subjects as subject_record
    on subject_record.id = offering.subject_id
  join public.terms as term_record
    on term_record.id = offering.term_id
  join public.academic_years as academic_year
    on academic_year.id = term_record.academic_year_id
  where offering.id = new.subject_offering_id;

  if not found then
    raise exception 'Subject offering not found.'
      using errcode = '23503';
  end if;

  if v_class_institution_id is distinct from new.institution_id
      or v_subject_institution_id is distinct from new.institution_id
      or v_term_institution_id is distinct from new.institution_id
      or v_class_academic_year_id is distinct from v_term_academic_year_id then
    raise exception 'Timetable entry related records must belong to the same institution and academic year.'
      using errcode = '23514';
  end if;

  if new.academic_year_id is not null
      and new.academic_year_id is distinct from v_class_academic_year_id then
    raise exception 'Timetable entry academic year must match subject offering.'
      using errcode = '23514';
  end if;

  if new.term_id is not null
      and new.term_id is distinct from v_offering_term_id then
    raise exception 'Timetable entry term must match subject offering.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.memberships as membership
    where membership.profile_id = v_teacher_profile_id
      and membership.institution_id = new.institution_id
      and membership.role = 'TEACHER'::public.user_role
  ) then
    raise exception 'Timetable entry teacher must have a teacher membership in this institution.'
      using errcode = '23514';
  end if;

  if new.room_id is not null and not exists (
    select 1
    from public.rooms as room
    where room.id = new.room_id
      and room.institution_id = new.institution_id
  ) then
    raise exception 'Room not found in this institution.'
      using errcode = '23503';
  end if;

  return new;
end;
$$;

drop trigger if exists timetable_entries_validate_tenant_integrity
  on public.timetable_entries;
create trigger timetable_entries_validate_tenant_integrity
before insert or update of institution_id, academic_year_id, term_id, subject_offering_id, room_id
on public.timetable_entries
for each row
execute function private.validate_timetable_entry_tenant_integrity();

create or replace function private.check_timetable_entry_room_conflict()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.room_id is null or new.active is not true then
    return new;
  end if;

  perform private.lock_timetable_resource('room', new.room_id);

  if exists (
    select 1
    from public.timetable_entries as entry
    where entry.institution_id = new.institution_id
      and entry.room_id = new.room_id
      and entry.day_of_week = new.day_of_week
      and entry.active is true
      and entry.id is distinct from new.id
      and entry.start_time < new.end_time
      and new.start_time < entry.end_time
      and private.timetable_terms_overlap(entry.subject_offering_id, new.subject_offering_id)
  ) then
    raise exception 'ROOM_ALREADY_BOOKED'
      using hint = 'This room is already booked at this time and period.';
  end if;

  return new;
end;
$$;

create or replace function private.check_timetable_entry_teacher_conflict()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher_profile_id uuid;
begin
  if new.active is not true then
    return new;
  end if;

  select offering.teacher_profile_id
  into v_teacher_profile_id
  from public.subject_offerings as offering
  where offering.id = new.subject_offering_id;

  perform private.lock_timetable_resource('teacher', v_teacher_profile_id);

  if exists (
    select 1
    from public.timetable_entries as entry
    join public.subject_offerings as offering
      on offering.id = entry.subject_offering_id
    where entry.institution_id = new.institution_id
      and offering.teacher_profile_id = v_teacher_profile_id
      and entry.day_of_week = new.day_of_week
      and entry.active is true
      and entry.id is distinct from new.id
      and entry.start_time < new.end_time
      and new.start_time < entry.end_time
      and private.timetable_terms_overlap(entry.subject_offering_id, new.subject_offering_id)
  ) then
    raise exception 'TEACHER_ALREADY_BOOKED'
      using hint = 'This teacher is already assigned at this time and period.';
  end if;

  return new;
end;
$$;

create or replace function private.check_timetable_entry_class_conflict()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
begin
  if new.active is not true then
    return new;
  end if;

  select offering.class_id
  into v_class_id
  from public.subject_offerings as offering
  where offering.id = new.subject_offering_id;

  perform private.lock_timetable_resource('class', v_class_id);

  if exists (
    select 1
    from public.timetable_entries as entry
    join public.subject_offerings as offering
      on offering.id = entry.subject_offering_id
    where entry.institution_id = new.institution_id
      and offering.class_id = v_class_id
      and entry.day_of_week = new.day_of_week
      and entry.active is true
      and entry.id is distinct from new.id
      and entry.start_time < new.end_time
      and new.start_time < entry.end_time
      and private.timetable_terms_overlap(entry.subject_offering_id, new.subject_offering_id)
  ) then
    raise exception 'CLASS_ALREADY_BOOKED'
      using hint = 'This class already has a lesson at this time and period.';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_timetable_entry_tenant_integrity()
  from public, anon, authenticated;
revoke all on function private.check_timetable_entry_room_conflict()
  from public, anon, authenticated;
revoke all on function private.check_timetable_entry_teacher_conflict()
  from public, anon, authenticated;
revoke all on function private.check_timetable_entry_class_conflict()
  from public, anon, authenticated;

grant execute on function private.validate_timetable_entry_tenant_integrity()
  to service_role;
grant execute on function private.check_timetable_entry_room_conflict()
  to service_role;
grant execute on function private.check_timetable_entry_teacher_conflict()
  to service_role;
grant execute on function private.check_timetable_entry_class_conflict()
  to service_role;

drop trigger if exists timetable_entries_check_room_conflict
  on public.timetable_entries;
create trigger timetable_entries_check_room_conflict
before insert or update of subject_offering_id, room_id, day_of_week, start_time, end_time, active
on public.timetable_entries
for each row
execute function private.check_timetable_entry_room_conflict();

drop trigger if exists timetable_entries_check_teacher_conflict
  on public.timetable_entries;
create trigger timetable_entries_check_teacher_conflict
before insert or update of subject_offering_id, day_of_week, start_time, end_time, active
on public.timetable_entries
for each row
execute function private.check_timetable_entry_teacher_conflict();

drop trigger if exists timetable_entries_check_class_conflict
  on public.timetable_entries;
create trigger timetable_entries_check_class_conflict
before insert or update of subject_offering_id, day_of_week, start_time, end_time, active
on public.timetable_entries
for each row
execute function private.check_timetable_entry_class_conflict();

notify pgrst, 'reload schema';
commit;
