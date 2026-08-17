-- Academic automation foundation.
-- Additive migration: existing academic tables remain the source of truth for
-- classes, curriculum, offerings and the currently published timetable.

begin;

create table if not exists public.teacher_subjects (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  teacher_profile_id uuid not null references public.profiles(id) on delete restrict,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  primary_subject boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists teacher_subjects_active_unique
  on public.teacher_subjects (institution_id, teacher_profile_id, subject_id)
  where active is true;
create index if not exists teacher_subjects_teacher_idx
  on public.teacher_subjects (institution_id, teacher_profile_id);

create table if not exists public.teacher_availability (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  teacher_profile_id uuid not null references public.profiles(id) on delete restrict,
  day_of_week smallint not null check (day_of_week between 1 and 6),
  start_time time without time zone not null,
  end_time time without time zone not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_availability_time_range_check check (start_time < end_time)
);

create index if not exists teacher_availability_lookup_idx
  on public.teacher_availability (institution_id, teacher_profile_id, day_of_week);

create table if not exists public.school_time_slots (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  shift text not null check (length(trim(shift)) between 1 and 40),
  day_of_week smallint not null check (day_of_week between 1 and 6),
  slot_number smallint not null check (slot_number between 1 and 30),
  start_time time without time zone not null,
  end_time time without time zone not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_time_slots_time_range_check check (start_time < end_time),
  constraint school_time_slots_unique_position unique (institution_id, shift, day_of_week, slot_number)
);

create table if not exists public.curriculum_templates (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 120),
  grade_level text,
  stage text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.curriculum_template_items (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  template_id uuid not null references public.curriculum_templates(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  weekly_lessons smallint not null check (weekly_lessons between 1 and 20),
  lesson_duration_minutes smallint not null check (lesson_duration_minutes between 15 and 180),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_template_items_unique_subject unique (template_id, subject_id)
);

create table if not exists public.timetable_versions (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 120),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  generation_source text not null default 'MANUAL',
  source_version_id uuid references public.timetable_versions(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists timetable_versions_scope_idx
  on public.timetable_versions (institution_id, academic_year_id, status);

create table if not exists public.timetable_version_entries (
  id uuid primary key default extensions.uuid_generate_v4(),
  version_id uuid not null references public.timetable_versions(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  subject_offering_id uuid not null references public.subject_offerings(id) on delete restrict,
  room_id uuid references public.rooms(id) on delete restrict,
  day_of_week smallint not null check (day_of_week between 1 and 6),
  start_time time without time zone not null,
  end_time time without time zone not null,
  locked boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timetable_version_entries_time_range_check check (start_time < end_time)
);

create index if not exists timetable_version_entries_scope_idx
  on public.timetable_version_entries (institution_id, academic_year_id, term_id, version_id);

-- Backfill existing assignments into the capability table. This is intentionally
-- idempotent and does not alter the existing subject_offerings rows.
insert into public.teacher_subjects (institution_id, teacher_profile_id, subject_id)
select distinct c.institution_id, so.teacher_profile_id, so.subject_id
from public.subject_offerings as so
join public.classes as c on c.id = so.class_id
join public.subjects as s on s.id = so.subject_id
where c.institution_id = s.institution_id
on conflict (institution_id, teacher_profile_id, subject_id) where active is true do nothing;

create or replace function private.validate_teacher_subject_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.memberships m
    join public.profiles p on p.id = m.profile_id
    where m.institution_id = new.institution_id
      and m.profile_id = new.teacher_profile_id
      and m.role = 'TEACHER'::public.user_role
      and m.active is true
      and p.active is true
  ) then
    raise exception 'Teacher does not belong to this institution.' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.subjects s
    where s.id = new.subject_id
      and s.institution_id = new.institution_id
  ) then
    raise exception 'Subject does not belong to this institution.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists teacher_subjects_validate_tenant on public.teacher_subjects;
create trigger teacher_subjects_validate_tenant
before insert or update of institution_id, teacher_profile_id, subject_id
on public.teacher_subjects
for each row execute function private.validate_teacher_subject_tenant();

create or replace function private.validate_teacher_availability_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.memberships m
    join public.profiles p on p.id = m.profile_id
    where m.institution_id = new.institution_id
      and m.profile_id = new.teacher_profile_id
      and m.role = 'TEACHER'::public.user_role
      and m.active is true
      and p.active is true
  ) then
    raise exception 'Teacher does not belong to this institution.' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.teacher_availability a
    where a.institution_id = new.institution_id
      and a.teacher_profile_id = new.teacher_profile_id
      and a.day_of_week = new.day_of_week
      and a.active is true
      and a.id is distinct from new.id
      and a.start_time < new.end_time
      and new.start_time < a.end_time
  ) then
    raise exception 'TEACHER_AVAILABILITY_OVERLAP' using errcode = '23P01';
  end if;

  return new;
end;
$$;

drop trigger if exists teacher_availability_validate_tenant on public.teacher_availability;
create trigger teacher_availability_validate_tenant
before insert or update of institution_id, teacher_profile_id, day_of_week, start_time, end_time, active
on public.teacher_availability
for each row execute function private.validate_teacher_availability_tenant();

create or replace function private.validate_school_time_slot_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.institutions i where i.id = new.institution_id and i.active is true) then
    raise exception 'Institution does not exist.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists school_time_slots_validate_tenant on public.school_time_slots;
create trigger school_time_slots_validate_tenant
before insert or update of institution_id
on public.school_time_slots
for each row execute function private.validate_school_time_slot_tenant();

create or replace function private.validate_curriculum_template_item_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.curriculum_templates t
    join public.subjects s on s.institution_id = t.institution_id
    where t.id = new.template_id
      and t.institution_id = new.institution_id
      and s.id = new.subject_id
      and s.institution_id = new.institution_id
  ) then
    raise exception 'Curriculum template item tenant mismatch.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists curriculum_template_items_validate_tenant on public.curriculum_template_items;
create trigger curriculum_template_items_validate_tenant
before insert or update of institution_id, template_id, subject_id
on public.curriculum_template_items
for each row execute function private.validate_curriculum_template_item_tenant();

-- Existing timetable conflicts must only compare offerings whose terms overlap.
create or replace function private.timetable_terms_overlap(left_offering uuid, right_offering uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.subject_offerings left_so
    join public.terms left_term on left_term.id = left_so.term_id
    join public.subject_offerings right_so on right_so.id = right_offering
    join public.terms right_term on right_term.id = right_so.term_id
    where left_so.id = left_offering
      and left_term.start_date <= right_term.end_date
      and right_term.start_date <= left_term.end_date
  );
$$;

create or replace function private.check_timetable_entry_room_conflict()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.room_id is not null and new.active is true then
    if exists (
      select 1 from public.timetable_entries entry
      where entry.room_id = new.room_id
        and entry.day_of_week = new.day_of_week
        and entry.active is true
        and entry.id is distinct from new.id
        and entry.start_time < new.end_time
        and new.start_time < entry.end_time
        and private.timetable_terms_overlap(entry.subject_offering_id, new.subject_offering_id)
    ) then
      raise exception 'ROOM_ALREADY_BOOKED' using hint = 'This room is already booked at this time and period.';
    end if;
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
declare teacher_profile_id uuid;
begin
  if new.active is not true then return new; end if;
  select so.teacher_profile_id into teacher_profile_id
  from public.subject_offerings so where so.id = new.subject_offering_id;

  if exists (
    select 1
    from public.timetable_entries entry
    join public.subject_offerings offering on offering.id = entry.subject_offering_id
    where offering.teacher_profile_id = teacher_profile_id
      and entry.day_of_week = new.day_of_week
      and entry.active is true
      and entry.id is distinct from new.id
      and entry.start_time < new.end_time
      and new.start_time < entry.end_time
      and private.timetable_terms_overlap(entry.subject_offering_id, new.subject_offering_id)
  ) then
    raise exception 'TEACHER_ALREADY_BOOKED' using hint = 'This teacher is already assigned at this time and period.';
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
declare class_id uuid;
begin
  if new.active is not true then return new; end if;
  select so.class_id into class_id
  from public.subject_offerings so where so.id = new.subject_offering_id;

  if exists (
    select 1
    from public.timetable_entries entry
    join public.subject_offerings offering on offering.id = entry.subject_offering_id
    where offering.class_id = class_id
      and entry.day_of_week = new.day_of_week
      and entry.active is true
      and entry.id is distinct from new.id
      and entry.start_time < new.end_time
      and new.start_time < entry.end_time
      and private.timetable_terms_overlap(entry.subject_offering_id, new.subject_offering_id)
  ) then
    raise exception 'CLASS_ALREADY_BOOKED' using hint = 'This class already has a lesson at this time and period.';
  end if;
  return new;
end;
$$;

drop trigger if exists timetable_entries_check_room_conflict on public.timetable_entries;
create trigger timetable_entries_check_room_conflict
before insert or update of subject_offering_id, room_id, day_of_week, start_time, end_time, active
on public.timetable_entries for each row execute function private.check_timetable_entry_room_conflict();

drop trigger if exists timetable_entries_check_teacher_conflict on public.timetable_entries;
create trigger timetable_entries_check_teacher_conflict
before insert or update of subject_offering_id, day_of_week, start_time, end_time, active
on public.timetable_entries for each row execute function private.check_timetable_entry_teacher_conflict();

drop trigger if exists timetable_entries_check_class_conflict on public.timetable_entries;
create trigger timetable_entries_check_class_conflict
before insert or update of subject_offering_id, day_of_week, start_time, end_time, active
on public.timetable_entries for each row execute function private.check_timetable_entry_class_conflict();

-- Atomic year creation. The client sends reviewed dates; the server only accepts
-- terms inside the year and rejects overlaps/duplicates.
create or replace function public.create_academic_year_with_terms(
  p_institution_id uuid,
  p_name text,
  p_start_date date,
  p_end_date date,
  p_active boolean,
  p_terms jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_year public.academic_years;
  term_item jsonb;
  term_start date;
  term_end date;
  term_name text;
  new_term public.terms;
  previous_end date;
begin
  if not public.is_institution_admin(p_institution_id) then
    raise exception 'INSTITUTION_OPERATION_FORBIDDEN' using errcode = '42501';
  end if;
  if p_start_date > p_end_date then raise exception 'ACADEMIC_YEAR_DATE_ORDER'; end if;
  if jsonb_typeof(p_terms) <> 'array' or jsonb_array_length(p_terms) = 0 then raise exception 'ACADEMIC_YEAR_TERMS_REQUIRED'; end if;
  if exists (select 1 from public.academic_years y where y.institution_id = p_institution_id and lower(trim(y.name)) = lower(trim(p_name))) then raise exception 'ACADEMIC_YEAR_DUPLICATE'; end if;

  insert into public.academic_years (institution_id, name, start_date, end_date, active)
  values (p_institution_id, trim(p_name), p_start_date, p_end_date, coalesce(p_active, true))
  returning * into new_year;

  for term_item in select value from jsonb_array_elements(p_terms) loop
    term_name := trim(term_item->>'name');
    term_start := (term_item->>'start_date')::date;
    term_end := (term_item->>'end_date')::date;
    if term_start > term_end or term_start < p_start_date or term_end > p_end_date then
      raise exception 'TERM_OUTSIDE_ACADEMIC_YEAR';
    end if;
    if exists (select 1 from public.terms t where t.academic_year_id = new_year.id and lower(trim(t.name)) = lower(term_name)) then raise exception 'TERM_DUPLICATE'; end if;
    if previous_end is not null and term_start <= previous_end then
      raise exception 'TERM_OVERLAP';
    end if;
    insert into public.terms (academic_year_id, name, start_date, end_date, active)
    values (new_year.id, term_name, term_start, term_end, coalesce((term_item->>'active')::boolean, true))
    returning * into new_term;
    previous_end := term_end;
  end loop;

  return jsonb_build_object('year_id', new_year.id, 'term_count', jsonb_array_length(p_terms));
exception when others then
  raise;
end;
$$;

-- Idempotent annual shortcut. It deliberately preserves term-level offerings.
create or replace function public.create_whole_year_assignment(
  p_institution_id uuid,
  p_class_id uuid,
  p_subject_id uuid,
  p_teacher_profile_id uuid,
  p_academic_year_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare term_item record; inserted_count integer := 0;
begin
  if not public.is_institution_admin(p_institution_id) then
    raise exception 'INSTITUTION_OPERATION_FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from public.classes c where c.id = p_class_id and c.institution_id = p_institution_id and c.academic_year_id = p_academic_year_id) then raise exception 'CLASS_SCOPE_MISMATCH'; end if;
  if not exists (select 1 from public.subjects s where s.id = p_subject_id and s.institution_id = p_institution_id) then raise exception 'SUBJECT_SCOPE_MISMATCH'; end if;
  if not exists (select 1 from public.teacher_subjects ts where ts.institution_id = p_institution_id and ts.teacher_profile_id = p_teacher_profile_id and ts.subject_id = p_subject_id and ts.active is true) then raise exception 'TEACHER_SUBJECT_NOT_AUTHORIZED'; end if;
  for term_item in select t.id from public.terms t where t.academic_year_id = p_academic_year_id and t.active is true order by t.start_date loop
    if not exists (select 1 from public.subject_offerings so where so.class_id = p_class_id and so.subject_id = p_subject_id and so.term_id = term_item.id and so.active is true) then
      insert into public.subject_offerings (class_id, subject_id, teacher_profile_id, term_id, active)
      values (p_class_id, p_subject_id, p_teacher_profile_id, term_item.id, true);
      inserted_count := inserted_count + 1;
    end if;
  end loop;
  return inserted_count;
end;
$$;

-- Apply a school-defined curriculum model without copying students or grades.
create or replace function public.apply_curriculum_template(
  p_institution_id uuid,
  p_template_id uuid,
  p_class_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare class_item uuid; template_item record; applied_count integer := 0;
begin
  if not public.can_manage_institution_operations(p_institution_id) then raise exception 'INSTITUTION_OPERATION_FORBIDDEN' using errcode = '42501'; end if;
  if not exists (select 1 from public.curriculum_templates ct where ct.id = p_template_id and ct.institution_id = p_institution_id and ct.active is true) then raise exception 'CURRICULUM_TEMPLATE_SCOPE_MISMATCH'; end if;
  foreach class_item in array p_class_ids loop
    if not exists (select 1 from public.classes c where c.id = class_item and c.institution_id = p_institution_id) then raise exception 'CLASS_SCOPE_MISMATCH'; end if;
    for template_item in select * from public.curriculum_template_items where template_id = p_template_id and institution_id = p_institution_id and active is true loop
      insert into public.class_curriculum_items (institution_id, class_id, subject_id, weekly_lessons, lesson_duration_minutes, needs_review, active)
      values (p_institution_id, class_item, template_item.subject_id, template_item.weekly_lessons, template_item.lesson_duration_minutes, false, true)
      on conflict (class_id, subject_id) do update set weekly_lessons = excluded.weekly_lessons, lesson_duration_minutes = excluded.lesson_duration_minutes, active = true, needs_review = false, updated_at = now();
      if found then applied_count := applied_count + 1; end if;
    end loop;
  end loop;
  return applied_count;
end;
$$;

-- Publication projects one validated version into the existing entries table.
create or replace function public.publish_timetable_version(p_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare version_row public.timetable_versions; entry_row record; published_count integer := 0;
begin
  select * into version_row from public.timetable_versions where id = p_version_id for update;
  if not found or not public.can_manage_institution_operations(version_row.institution_id) then raise exception 'TIMETABLE_VERSION_FORBIDDEN' using errcode = '42501'; end if;
  if version_row.status <> 'DRAFT' then raise exception 'TIMETABLE_VERSION_NOT_DRAFT'; end if;
  if exists (select 1 from public.timetable_version_entries e where e.version_id = p_version_id and e.institution_id <> version_row.institution_id) then raise exception 'TIMETABLE_VERSION_SCOPE_MISMATCH'; end if;

  update public.timetable_entries te set active = false
  where te.institution_id = version_row.institution_id
    and te.subject_offering_id in (
      select so.id from public.subject_offerings so join public.terms t on t.id = so.term_id where t.academic_year_id = version_row.academic_year_id
    );

  for entry_row in select * from public.timetable_version_entries where version_id = p_version_id and active is true loop
    insert into public.timetable_entries (institution_id, subject_offering_id, room_id, day_of_week, start_time, end_time, active)
    values (version_row.institution_id, entry_row.subject_offering_id, entry_row.room_id, entry_row.day_of_week, entry_row.start_time, entry_row.end_time, true);
    published_count := published_count + 1;
  end loop;

  update public.timetable_versions set status = 'ARCHIVED', updated_at = now()
  where institution_id = version_row.institution_id and academic_year_id = version_row.academic_year_id and status = 'PUBLISHED' and id <> p_version_id;
  update public.timetable_versions set status = 'PUBLISHED', published_at = now(), updated_at = now() where id = p_version_id;
  return jsonb_build_object('version_id', p_version_id, 'published_entries', published_count);
end;
$$;

alter table public.teacher_subjects enable row level security;
alter table public.teacher_availability enable row level security;
alter table public.school_time_slots enable row level security;
alter table public.curriculum_templates enable row level security;
alter table public.curriculum_template_items enable row level security;
alter table public.timetable_versions enable row level security;
alter table public.timetable_version_entries enable row level security;

drop policy if exists teacher_subjects_select_policy on public.teacher_subjects;
create policy teacher_subjects_select_policy on public.teacher_subjects for select to authenticated using (public.can_access_institution(institution_id));
drop policy if exists teacher_subjects_write_policy on public.teacher_subjects;
create policy teacher_subjects_write_policy on public.teacher_subjects for all to authenticated using (public.can_manage_institution_operations(institution_id)) with check (public.can_manage_institution_operations(institution_id));

drop policy if exists teacher_availability_select_policy on public.teacher_availability;
create policy teacher_availability_select_policy on public.teacher_availability for select to authenticated using (public.can_access_institution(institution_id));
drop policy if exists teacher_availability_write_policy on public.teacher_availability;
create policy teacher_availability_write_policy on public.teacher_availability for all to authenticated using (public.can_manage_institution_operations(institution_id)) with check (public.can_manage_institution_operations(institution_id));

drop policy if exists school_time_slots_select_policy on public.school_time_slots;
create policy school_time_slots_select_policy on public.school_time_slots for select to authenticated using (public.can_access_institution(institution_id));
drop policy if exists school_time_slots_write_policy on public.school_time_slots;
create policy school_time_slots_write_policy on public.school_time_slots for all to authenticated using (public.can_manage_institution_operations(institution_id)) with check (public.can_manage_institution_operations(institution_id));

drop policy if exists curriculum_templates_select_policy on public.curriculum_templates;
create policy curriculum_templates_select_policy on public.curriculum_templates for select to authenticated using (public.can_access_institution(institution_id));
drop policy if exists curriculum_templates_write_policy on public.curriculum_templates;
create policy curriculum_templates_write_policy on public.curriculum_templates for all to authenticated using (public.can_manage_institution_operations(institution_id)) with check (public.can_manage_institution_operations(institution_id));

drop policy if exists curriculum_template_items_select_policy on public.curriculum_template_items;
create policy curriculum_template_items_select_policy on public.curriculum_template_items for select to authenticated using (public.can_access_institution(institution_id));
drop policy if exists curriculum_template_items_write_policy on public.curriculum_template_items;
create policy curriculum_template_items_write_policy on public.curriculum_template_items for all to authenticated using (public.can_manage_institution_operations(institution_id)) with check (public.can_manage_institution_operations(institution_id));

drop policy if exists timetable_versions_select_policy on public.timetable_versions;
create policy timetable_versions_select_policy on public.timetable_versions for select to authenticated using (public.can_access_institution(institution_id));
drop policy if exists timetable_versions_write_policy on public.timetable_versions;
create policy timetable_versions_write_policy on public.timetable_versions for all to authenticated using (public.can_manage_institution_operations(institution_id)) with check (public.can_manage_institution_operations(institution_id));

drop policy if exists timetable_version_entries_select_policy on public.timetable_version_entries;
create policy timetable_version_entries_select_policy on public.timetable_version_entries for select to authenticated using (public.can_access_institution(institution_id));
drop policy if exists timetable_version_entries_write_policy on public.timetable_version_entries;
create policy timetable_version_entries_write_policy on public.timetable_version_entries for all to authenticated using (public.can_manage_institution_operations(institution_id)) with check (public.can_manage_institution_operations(institution_id));

revoke all on function public.create_academic_year_with_terms(uuid, text, date, date, boolean, jsonb) from public, anon;
revoke all on function public.create_whole_year_assignment(uuid, uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.apply_curriculum_template(uuid, uuid, uuid[]) from public, anon;
revoke all on function public.publish_timetable_version(uuid) from public, anon;
grant execute on function public.create_academic_year_with_terms(uuid, text, date, date, boolean, jsonb) to authenticated, service_role;
grant execute on function public.create_whole_year_assignment(uuid, uuid, uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.apply_curriculum_template(uuid, uuid, uuid[]) to authenticated, service_role;
grant execute on function public.publish_timetable_version(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
