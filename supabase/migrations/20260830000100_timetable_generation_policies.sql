-- Persist the institution rules used by timetable preparation and generation.

begin;

alter table public.academic_policies
  add column if not exists school_days smallint[] not null default array[1, 2, 3, 4, 5]::smallint[],
  add column if not exists default_lesson_duration_minutes smallint not null default 50,
  add column if not exists max_lessons_per_day smallint not null default 8,
  add column if not exists max_teacher_lessons_per_day smallint not null default 8,
  add column if not exists max_teacher_lessons_per_week smallint not null default 40,
  add column if not exists max_consecutive_subject_lessons smallint not null default 2,
  add column if not exists max_subject_lessons_per_day smallint not null default 5,
  add column if not exists require_teacher_availability boolean not null default true,
  add column if not exists require_room_for_generation boolean not null default false,
  add column if not exists allow_shared_rooms boolean not null default true;

alter table public.academic_policies
  drop constraint if exists academic_policies_school_days_valid,
  drop constraint if exists academic_policies_timetable_limits_valid;

alter table public.academic_policies
  add constraint academic_policies_school_days_valid
    check (
      cardinality(school_days) between 1 and 6
      and school_days <@ array[1, 2, 3, 4, 5, 6]::smallint[]
    ),
  add constraint academic_policies_timetable_limits_valid
    check (
      default_lesson_duration_minutes between 15 and 180
      and max_lessons_per_day between 1 and 30
      and max_teacher_lessons_per_day between 1 and 30
      and max_teacher_lessons_per_week between 1 and 180
      and max_consecutive_subject_lessons between 1 and 6
      and max_subject_lessons_per_day between 1 and 12
    );

alter table public.timetable_versions
  add column if not exists generation_shift text not null default 'TODOS';

alter table public.timetable_versions
  drop constraint if exists timetable_versions_generation_shift_valid;

alter table public.timetable_versions
  add constraint timetable_versions_generation_shift_valid
    check (generation_shift in ('TODOS', 'MATUTINO', 'VESPERTINO', 'INTEGRAL', 'NOTURNO'));

alter table public.timetable_entries
  add column if not exists academic_year_id uuid references public.academic_years(id) on delete restrict,
  add column if not exists term_id uuid references public.terms(id) on delete restrict;

update public.timetable_entries entry
set academic_year_id = term.academic_year_id,
    term_id = offering.term_id
from public.subject_offerings offering
join public.terms term on term.id = offering.term_id
where offering.id = entry.subject_offering_id
  and (entry.academic_year_id is null or entry.term_id is null);

create index if not exists timetable_entries_academic_scope_idx
  on public.timetable_entries (institution_id, academic_year_id, term_id, active);

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
      and version_row.generation_shift <> 'TODOS'
      and private.normalize_academic_shift(class_record.shift) <> private.normalize_academic_shift(version_row.generation_shift)
  ) then
    raise exception 'TIMETABLE_VERSION_SHIFT_MISMATCH';
  end if;

  if exists (
    select 1
    from public.timetable_version_entries entry
    where entry.version_id = p_version_id
      and not (entry.day_of_week = any(configured_school_days))
  ) then
    raise exception 'TIMETABLE_DAY_NOT_CONFIGURED';
  end if;

  if configured_require_room and exists (
    select 1
    from public.timetable_version_entries entry
    where entry.version_id = p_version_id
      and entry.room_id is null
  ) then
    raise exception 'ROOM_REQUIRED';
  end if;

  if not configured_allow_shared_rooms and exists (
    select 1
    from public.timetable_version_entries entry
    join public.rooms room on room.id = entry.room_id
    where entry.version_id = p_version_id
      and (room.class_id is null or room.class_id <> entry.class_id)
  ) then
    raise exception 'ROOM_NOT_ASSIGNED_TO_CLASS';
  end if;

  if exists (
    select entry.class_id, entry.day_of_week
    from public.timetable_version_entries entry
    where entry.version_id = p_version_id
    group by entry.class_id, entry.day_of_week
    having count(*) > configured_max_lessons_per_day
  ) then
    raise exception 'CLASS_DAILY_LESSONS_LIMIT';
  end if;

  if exists (
    select offering.class_id, offering.subject_id, entry.day_of_week
    from public.timetable_version_entries entry
    join public.subject_offerings offering on offering.id = entry.subject_offering_id
    where entry.version_id = p_version_id
    group by offering.class_id, offering.subject_id, entry.day_of_week
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
          order by entry.start_time
        ) as previous_end_time
      from public.timetable_version_entries entry
      join public.subject_offerings offering on offering.id = entry.subject_offering_id
      where entry.version_id = p_version_id
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
    select offering.teacher_profile_id, entry.day_of_week
    from public.timetable_version_entries entry
    join public.subject_offerings offering on offering.id = entry.subject_offering_id
    where entry.version_id = p_version_id
    group by offering.teacher_profile_id, entry.day_of_week
    having count(*) > configured_max_teacher_lessons_per_day
  ) then
    raise exception 'TEACHER_DAILY_LESSONS_LIMIT';
  end if;

  if exists (
    select offering.teacher_profile_id
    from public.timetable_version_entries entry
    join public.subject_offerings offering on offering.id = entry.subject_offering_id
    where entry.version_id = p_version_id
    group by offering.teacher_profile_id
    having count(*) > configured_max_teacher_lessons_per_week
  ) then
    raise exception 'TEACHER_WEEKLY_LESSONS_LIMIT';
  end if;

  if exists (
    select 1
    from public.timetable_version_entries entry
    join public.subject_offerings offering on offering.id = entry.subject_offering_id
    where entry.version_id = p_version_id
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

  if exists (
    select 1
    from public.timetable_version_entries left_entry
    join public.subject_offerings left_offering on left_offering.id = left_entry.subject_offering_id
    join public.terms left_term on left_term.id = left_offering.term_id
    join public.timetable_version_entries right_entry
      on right_entry.version_id = left_entry.version_id
     and right_entry.id <> left_entry.id
    join public.subject_offerings right_offering on right_offering.id = right_entry.subject_offering_id
    join public.terms right_term on right_term.id = right_offering.term_id
    where left_entry.version_id = p_version_id
      and left_entry.day_of_week = right_entry.day_of_week
      and left_entry.start_time < right_entry.end_time
      and right_entry.start_time < left_entry.end_time
      and left_term.start_date <= right_term.end_date
      and right_term.start_date <= left_term.end_date
      and (
        left_offering.class_id = right_offering.class_id
        or left_offering.teacher_profile_id = right_offering.teacher_profile_id
        or (left_entry.room_id is not null and left_entry.room_id = right_entry.room_id)
      )
  ) then
    raise exception 'TIMETABLE_VERSION_CONFLICT';
  end if;

  for entry_row in
    select offering.id, curriculum.weekly_lessons
    from public.subject_offerings offering
    join public.class_curriculum_items curriculum
      on curriculum.class_id = offering.class_id
     and curriculum.subject_id = offering.subject_id
    where offering.active is true
      and exists (
        select 1
        from public.timetable_version_entries entry
        where entry.version_id = p_version_id
          and entry.subject_offering_id = offering.id
      )
  loop
    select count(*) into generated_lessons
    from public.timetable_version_entries entry
    where entry.version_id = p_version_id
      and entry.subject_offering_id = entry_row.id
      and entry.active is true;
    required_lessons := entry_row.weekly_lessons;
    if generated_lessons <> required_lessons then
      raise exception 'WEEKLY_LESSONS_MISMATCH';
    end if;
  end loop;

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

  for entry_row in
    select *
    from public.timetable_version_entries
    where version_id = p_version_id
      and active is true
  loop
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
    values (
      version_row.institution_id,
      entry_row.academic_year_id,
      entry_row.term_id,
      entry_row.subject_offering_id,
      entry_row.room_id,
      entry_row.day_of_week,
      entry_row.start_time,
      entry_row.end_time,
      true
    );
    published_count := published_count + 1;
  end loop;

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

notify pgrst, 'reload schema';
commit;
