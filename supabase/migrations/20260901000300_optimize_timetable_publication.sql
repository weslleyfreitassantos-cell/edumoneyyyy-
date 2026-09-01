-- Keep publishing viable for large school schedules.
-- Validation remains server-side, but avoids N+1 counting and row-by-row
-- publication work that can exceed the database statement timeout.

begin;

create index if not exists timetable_version_entries_publish_scope_idx
  on public.timetable_version_entries (
    version_id,
    active,
    subject_offering_id,
    term_id,
    class_id,
    day_of_week,
    start_time
  );

create index if not exists timetable_entries_active_institution_time_idx
  on public.timetable_entries (
    institution_id,
    active,
    day_of_week,
    start_time,
    end_time
  );

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

revoke all on function private.check_timetable_entry_teacher_conflict()
  from public, anon, authenticated;
revoke all on function private.check_timetable_entry_class_conflict()
  from public, anon, authenticated;
grant execute on function private.check_timetable_entry_teacher_conflict()
  to service_role;
grant execute on function private.check_timetable_entry_class_conflict()
  to service_role;

create or replace function public.publish_timetable_version(p_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '60s'
as $$
declare
  version_row public.timetable_versions;
  published_count integer := 0;
  configured_school_days smallint[] := array[1, 2, 3, 4, 5]::smallint[];
  configured_max_lessons_per_day integer := 8;
  configured_max_teacher_lessons_per_day integer := 8;
  configured_max_teacher_lessons_per_week integer := 40;
  configured_max_subject_lessons_per_day integer := 5;
  configured_require_room boolean := false;
  configured_allow_shared_rooms boolean := true;
begin
  select * into version_row
  from public.timetable_versions
  where id = p_version_id
  for update;

  if not found or not public.can_manage_institution_operations(version_row.institution_id) then
    raise exception 'TIMETABLE_VERSION_FORBIDDEN' using errcode = '42501';
  end if;
  if version_row.status <> 'DRAFT' then
    raise exception 'TIMETABLE_VERSION_NOT_DRAFT';
  end if;

  select
    coalesce(policy.school_days, configured_school_days),
    coalesce(policy.max_lessons_per_day, configured_max_lessons_per_day),
    coalesce(policy.max_teacher_lessons_per_day, configured_max_teacher_lessons_per_day),
    coalesce(policy.max_teacher_lessons_per_week, configured_max_teacher_lessons_per_week),
    coalesce(policy.max_subject_lessons_per_day, configured_max_subject_lessons_per_day),
    coalesce(policy.require_room_for_generation, configured_require_room),
    coalesce(policy.allow_shared_rooms, configured_allow_shared_rooms)
  into
    configured_school_days,
    configured_max_lessons_per_day,
    configured_max_teacher_lessons_per_day,
    configured_max_teacher_lessons_per_week,
    configured_max_subject_lessons_per_day,
    configured_require_room,
    configured_allow_shared_rooms
  from public.academic_policies policy
  where policy.institution_id = version_row.institution_id
    and policy.academic_year_id = version_row.academic_year_id
    and policy.active is true
  order by policy.updated_at desc
  limit 1;

  if exists (
    select 1
    from public.timetable_version_entries entry
    join public.subject_offerings offering on offering.id = entry.subject_offering_id
    join public.classes class_record on class_record.id = offering.class_id
    join public.terms term on term.id = offering.term_id
    where entry.version_id = p_version_id
      and entry.active is true
      and (
        entry.institution_id <> version_row.institution_id
        or class_record.institution_id <> version_row.institution_id
        or term.academic_year_id <> version_row.academic_year_id
        or entry.class_id <> offering.class_id
        or entry.term_id <> offering.term_id
        or entry.academic_year_id <> term.academic_year_id
      )
  ) then
    raise exception 'TIMETABLE_VERSION_SCOPE_MISMATCH';
  end if;

  if exists (
    select 1
    from public.timetable_version_entries entry
    join public.subject_offerings offering on offering.id = entry.subject_offering_id
    join public.classes class_record on class_record.id = offering.class_id
    where entry.version_id = p_version_id
      and entry.active is true
      and version_row.generation_shift <> 'TODOS'
      and private.normalize_academic_shift(class_record.shift) <> private.normalize_academic_shift(version_row.generation_shift)
  ) then
    raise exception 'TIMETABLE_VERSION_SHIFT_MISMATCH';
  end if;

  if exists (
    select 1
    from public.timetable_version_entries entry
    where entry.version_id = p_version_id
      and entry.active is true
      and not (entry.day_of_week = any(configured_school_days))
  ) then
    raise exception 'TIMETABLE_DAY_NOT_CONFIGURED';
  end if;

  if configured_require_room and exists (
    select 1
    from public.timetable_version_entries entry
    where entry.version_id = p_version_id
      and entry.active is true
      and entry.room_id is null
  ) then
    raise exception 'ROOM_REQUIRED';
  end if;

  if not configured_allow_shared_rooms and exists (
    select 1
    from public.timetable_version_entries entry
    join public.rooms room on room.id = entry.room_id
    where entry.version_id = p_version_id
      and entry.active is true
      and (room.class_id is null or room.class_id <> entry.class_id)
  ) then
    raise exception 'ROOM_NOT_ASSIGNED_TO_CLASS';
  end if;

  if exists (
    select entry.class_id, entry.term_id, entry.day_of_week
    from public.timetable_version_entries entry
    where entry.version_id = p_version_id
      and entry.active is true
    group by entry.class_id, entry.term_id, entry.day_of_week
    having count(*) > configured_max_lessons_per_day
  ) then
    raise exception 'CLASS_DAILY_LESSONS_LIMIT';
  end if;

  if exists (
    select offering.class_id, offering.subject_id, entry.term_id, entry.day_of_week
    from public.timetable_version_entries entry
    join public.subject_offerings offering on offering.id = entry.subject_offering_id
    where entry.version_id = p_version_id
      and entry.active is true
    group by offering.class_id, offering.subject_id, entry.term_id, entry.day_of_week
    having count(*) > configured_max_subject_lessons_per_day
  ) then
    raise exception 'SUBJECT_DAILY_LESSONS_LIMIT';
  end if;

  if exists (
    with ordered_entries as (
      select
        entry.class_id,
        entry.term_id,
        offering.subject_id,
        entry.day_of_week,
        entry.start_time,
        entry.end_time,
        lag(entry.end_time) over (
          partition by entry.class_id, entry.term_id, offering.subject_id, entry.day_of_week
          order by entry.start_time, entry.id
        ) as previous_end_time
      from public.timetable_version_entries entry
      join public.subject_offerings offering on offering.id = entry.subject_offering_id
      where entry.version_id = p_version_id
        and entry.active is true
    ), grouped_entries as (
      select
        *,
        sum(
          case
            when previous_end_time is null or start_time > previous_end_time then 1
            else 0
          end
        ) over (
          partition by class_id, term_id, subject_id, day_of_week
          order by start_time
        ) as consecutive_group
      from ordered_entries
    )
    select class_id, term_id, subject_id, day_of_week, consecutive_group
    from grouped_entries
    group by class_id, term_id, subject_id, day_of_week, consecutive_group
    having count(*) > coalesce((
      select policy.max_consecutive_subject_lessons
      from public.academic_policies policy
      where policy.institution_id = version_row.institution_id
        and policy.academic_year_id = version_row.academic_year_id
        and policy.active is true
      order by policy.updated_at desc
      limit 1
    ), 2)
  ) then
    raise exception 'CONSECUTIVE_SUBJECT_LESSONS_LIMIT';
  end if;

  if exists (
    select offering.teacher_profile_id, entry.term_id, entry.day_of_week
    from public.timetable_version_entries entry
    join public.subject_offerings offering on offering.id = entry.subject_offering_id
    where entry.version_id = p_version_id
      and entry.active is true
    group by offering.teacher_profile_id, entry.term_id, entry.day_of_week
    having count(*) > configured_max_teacher_lessons_per_day
  ) then
    raise exception 'TEACHER_DAILY_LESSONS_LIMIT';
  end if;

  if exists (
    select offering.teacher_profile_id, entry.term_id
    from public.timetable_version_entries entry
    join public.subject_offerings offering on offering.id = entry.subject_offering_id
    where entry.version_id = p_version_id
      and entry.active is true
    group by offering.teacher_profile_id, entry.term_id
    having count(*) > configured_max_teacher_lessons_per_week
  ) then
    raise exception 'TEACHER_WEEKLY_LESSONS_LIMIT';
  end if;

  if exists (
    select 1
    from public.timetable_version_entries entry
    join public.subject_offerings offering on offering.id = entry.subject_offering_id
    where entry.version_id = p_version_id
      and entry.active is true
      and not exists (
        select 1
        from public.teacher_subjects skill
        where skill.institution_id = version_row.institution_id
          and skill.teacher_profile_id = offering.teacher_profile_id
          and skill.subject_id = offering.subject_id
          and skill.active is true
      )
  ) then
    raise exception 'TEACHER_SUBJECT_NOT_AUTHORIZED';
  end if;

  if exists (
    select 1
    from public.timetable_version_entries entry
    join public.subject_offerings offering on offering.id = entry.subject_offering_id
    where entry.version_id = p_version_id
      and entry.active is true
      and not exists (
        select 1
        from public.teacher_availability availability
        where availability.institution_id = version_row.institution_id
          and availability.teacher_profile_id = offering.teacher_profile_id
          and availability.day_of_week = entry.day_of_week
          and availability.active is true
          and availability.start_time <= entry.start_time
          and availability.end_time >= entry.end_time
      )
  ) then
    raise exception 'TEACHER_NOT_AVAILABLE';
  end if;

  if exists (
    select 1
    from public.timetable_version_entries entry
    join public.subject_offerings offering on offering.id = entry.subject_offering_id
    join public.classes class_record on class_record.id = offering.class_id
    where entry.version_id = p_version_id
      and entry.active is true
      and not exists (
        select 1
        from public.school_time_slots slot
        where slot.institution_id = version_row.institution_id
          and (class_record.shift is null or private.normalize_academic_shift(slot.shift) = private.normalize_academic_shift(class_record.shift))
          and slot.day_of_week = entry.day_of_week
          and slot.active is true
          and slot.start_time <= entry.start_time
          and slot.end_time >= entry.end_time
      )
  ) then
    raise exception 'SCHOOL_TIME_SLOT_NOT_CONFIGURED';
  end if;

  if exists (
    select 1
    from public.timetable_version_entries entry
    join public.subject_offerings offering on offering.id = entry.subject_offering_id
    where entry.version_id = p_version_id
      and entry.active is true
      and exists (
        select 1
        from public.school_schedule_breaks schedule_break
        join public.classes class_record on class_record.id = offering.class_id
        where schedule_break.institution_id = version_row.institution_id
          and schedule_break.active is true
          and schedule_break.day_of_week = entry.day_of_week
          and schedule_break.shift = private.normalize_academic_shift(class_record.shift)
          and schedule_break.start_time < entry.end_time
          and entry.start_time < schedule_break.end_time
      )
  ) then
    raise exception 'TIMETABLE_ENTRY_DURING_SCHEDULE_BREAK';
  end if;

  -- Check class, teacher and room collisions separately so each query can use
  -- the version, day and identity columns instead of evaluating one large OR.
  if exists (
    select 1
    from public.timetable_version_entries left_entry
    join public.timetable_version_entries right_entry
      on right_entry.version_id = left_entry.version_id
     and right_entry.id > left_entry.id
     and right_entry.class_id = left_entry.class_id
     and right_entry.day_of_week = left_entry.day_of_week
     and left_entry.start_time < right_entry.end_time
     and right_entry.start_time < left_entry.end_time
     and right_entry.active is true
    join public.terms left_term on left_term.id = left_entry.term_id
    join public.terms right_term on right_term.id = right_entry.term_id
    where left_entry.version_id = p_version_id
      and left_entry.active is true
      and left_term.start_date <= right_term.end_date
      and right_term.start_date <= left_term.end_date
  ) then
    raise exception 'TIMETABLE_VERSION_CONFLICT';
  end if;

  if exists (
    select 1
    from public.timetable_version_entries left_entry
    join public.subject_offerings left_offering
      on left_offering.id = left_entry.subject_offering_id
    join public.timetable_version_entries right_entry
      on right_entry.version_id = left_entry.version_id
     and right_entry.id > left_entry.id
     and right_entry.day_of_week = left_entry.day_of_week
     and left_entry.start_time < right_entry.end_time
     and right_entry.start_time < left_entry.end_time
     and right_entry.active is true
    join public.subject_offerings right_offering
      on right_offering.id = right_entry.subject_offering_id
     and right_offering.teacher_profile_id = left_offering.teacher_profile_id
    join public.terms left_term on left_term.id = left_entry.term_id
    join public.terms right_term on right_term.id = right_entry.term_id
    where left_entry.version_id = p_version_id
      and left_entry.active is true
      and left_term.start_date <= right_term.end_date
      and right_term.start_date <= left_term.end_date
  ) then
    raise exception 'TIMETABLE_VERSION_CONFLICT';
  end if;

  if exists (
    select 1
    from public.timetable_version_entries left_entry
    join public.timetable_version_entries right_entry
      on right_entry.version_id = left_entry.version_id
     and right_entry.id > left_entry.id
     and right_entry.room_id is not null
     and right_entry.room_id = left_entry.room_id
     and right_entry.day_of_week = left_entry.day_of_week
     and left_entry.start_time < right_entry.end_time
     and right_entry.start_time < left_entry.end_time
     and right_entry.active is true
    join public.terms left_term on left_term.id = left_entry.term_id
    join public.terms right_term on right_term.id = right_entry.term_id
    where left_entry.version_id = p_version_id
      and left_entry.active is true
      and left_entry.room_id is not null
      and left_term.start_date <= right_term.end_date
      and right_term.start_date <= left_term.end_date
  ) then
    raise exception 'TIMETABLE_VERSION_CONFLICT';
  end if;

  -- Compare every required offering in one grouped query instead of running
  -- one count query per offering.
  if exists (
    select 1
    from (
      select
        offering.id,
        curriculum.weekly_lessons,
        count(entry.id) as generated_lessons
      from public.subject_offerings offering
      join public.class_curriculum_items curriculum
        on curriculum.class_id = offering.class_id
       and curriculum.subject_id = offering.subject_id
       and curriculum.active is true
      join public.classes class_record on class_record.id = offering.class_id
      join public.terms term on term.id = offering.term_id
      left join public.timetable_version_entries entry
        on entry.version_id = p_version_id
       and entry.subject_offering_id = offering.id
       and entry.active is true
      where offering.active is true
        and class_record.active is true
        and class_record.institution_id = version_row.institution_id
        and term.academic_year_id = version_row.academic_year_id
        and (
          curriculum.is_complementary is false
          or exists (
            select 1
            from public.teacher_subjects skill
            where skill.institution_id = version_row.institution_id
              and skill.subject_id = offering.subject_id
              and skill.active is true
          )
        )
        and (
          version_row.generation_shift = 'TODOS'
          or private.normalize_academic_shift(class_record.shift) = private.normalize_academic_shift(version_row.generation_shift)
        )
      group by offering.id, curriculum.weekly_lessons
    ) workload
    where workload.generated_lessons <> workload.weekly_lessons
  ) then
    raise exception 'WEEKLY_LESSONS_MISMATCH';
  end if;

  update public.timetable_entries entry
  set active = false
  from public.subject_offerings offering
  join public.classes class_record on class_record.id = offering.class_id
  join public.terms term on term.id = offering.term_id
  where entry.subject_offering_id = offering.id
    and entry.institution_id = version_row.institution_id
    and term.academic_year_id = version_row.academic_year_id
    and (
      version_row.generation_shift = 'TODOS'
      or private.normalize_academic_shift(class_record.shift) = private.normalize_academic_shift(version_row.generation_shift)
    );

  insert into public.timetable_entries (
    institution_id,
    academic_year_id,
    term_id,
    subject_offering_id,
    room_id,
    day_of_week,
    start_time,
    end_time,
    active
  )
  select
    version_row.institution_id,
    entry.academic_year_id,
    entry.term_id,
    entry.subject_offering_id,
    entry.room_id,
    entry.day_of_week,
    entry.start_time,
    entry.end_time,
    true
  from public.timetable_version_entries entry
  where entry.version_id = p_version_id
    and entry.active is true;

  get diagnostics published_count = row_count;

  update public.timetable_versions
  set status = 'ARCHIVED', updated_at = now()
  where institution_id = version_row.institution_id
    and academic_year_id = version_row.academic_year_id
    and status = 'PUBLISHED'
    and id <> p_version_id;

  update public.timetable_versions
  set status = 'PUBLISHED', published_at = now(), updated_at = now()
  where id = p_version_id;

  return jsonb_build_object('version_id', p_version_id, 'published_entries', published_count);
end;
$$;

revoke all on function public.publish_timetable_version(uuid) from public, anon;
grant execute on function public.publish_timetable_version(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
