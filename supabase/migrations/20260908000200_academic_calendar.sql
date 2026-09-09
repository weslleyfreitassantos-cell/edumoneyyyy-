begin;

create type public.academic_calendar_event_type as enum (
  'HOLIDAY',
  'RECESS',
  'SCHOOL_EVENT',
  'MEETING',
  'ASSESSMENT',
  'CLASS_SUSPENSION',
  'OTHER'
);

create type public.academic_calendar_audience as enum (
  'ALL',
  'STUDENTS',
  'GUARDIANS',
  'TEACHERS',
  'STAFF',
  'CLASS'
);

create table public.academic_calendar_events (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  title text not null,
  description text,
  event_type public.academic_calendar_event_type not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  audience public.academic_calendar_audience not null default 'ALL',
  class_id uuid references public.classes(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_calendar_events_title_length_check
    check (char_length(trim(title)) between 1 and 160),
  constraint academic_calendar_events_description_length_check
    check (description is null or char_length(description) <= 12000),
  constraint academic_calendar_events_dates_check
    check (ends_at is null or ends_at >= starts_at),
  constraint academic_calendar_events_class_audience_check
    check (
      (audience = 'CLASS' and class_id is not null)
      or (audience <> 'CLASS' and class_id is null)
    )
);

create index academic_calendar_events_institution_starts_at_idx
  on public.academic_calendar_events(institution_id, starts_at);

create index academic_calendar_events_institution_active_idx
  on public.academic_calendar_events(institution_id, active, starts_at);

create index academic_calendar_events_academic_year_idx
  on public.academic_calendar_events(academic_year_id);

create index academic_calendar_events_class_idx
  on public.academic_calendar_events(class_id);

create index academic_calendar_events_subject_idx
  on public.academic_calendar_events(subject_id);

create or replace function private.validate_academic_calendar_event_references()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.class_id is not null and not exists (
    select 1
    from public.classes as class_record
    where class_record.id = new.class_id
      and class_record.institution_id = new.institution_id
  ) then
    raise exception 'A turma do evento não pertence à instituição informada.';
  end if;

  if new.academic_year_id is not null and not exists (
    select 1
    from public.academic_years as academic_year
    where academic_year.id = new.academic_year_id
      and academic_year.institution_id = new.institution_id
  ) then
    raise exception 'O ano letivo do evento não pertence à instituição informada.';
  end if;

  if new.subject_id is not null and not exists (
    select 1
    from public.subjects as subject
    where subject.id = new.subject_id
      and subject.institution_id = new.institution_id
  ) then
    raise exception 'A disciplina do evento não pertence à instituição informada.';
  end if;

  return new;
end;
$$;

create trigger academic_calendar_events_validate_references
before insert or update on public.academic_calendar_events
for each row
execute function private.validate_academic_calendar_event_references();

create trigger academic_calendar_events_touch_updated_at
before update on public.academic_calendar_events
for each row
execute function public.touch_academic_record_updated_at();

create or replace function private.is_active_student_of_calendar_class(
  target_institution_id uuid,
  target_class_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.students as student
    join public.enrollments as enrollment
      on enrollment.student_id = student.id
     and enrollment.class_id = target_class_id
     and enrollment.active is true
    where student.profile_id = auth.uid()
      and student.institution_id = target_institution_id
      and student.active is true
  );
$$;

create or replace function private.is_active_guardian_of_calendar_class(
  target_institution_id uuid,
  target_class_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.guardianships as guardianship
    join public.students as student
      on student.id = guardianship.student_id
    join public.enrollments as enrollment
      on enrollment.student_id = student.id
     and enrollment.class_id = target_class_id
     and enrollment.active is true
    where guardianship.guardian_profile_id = auth.uid()
      and guardianship.active is true
      and student.institution_id = target_institution_id
      and student.active is true
  );
$$;

create or replace function private.is_active_teacher_of_calendar_class(
  target_institution_id uuid,
  target_class_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships as membership
    join public.subject_offerings as offering
      on offering.teacher_profile_id = membership.profile_id
     and offering.class_id = target_class_id
     and offering.active is true
    join public.classes as class_record
      on class_record.id = offering.class_id
     and class_record.institution_id = target_institution_id
    where membership.profile_id = auth.uid()
      and membership.institution_id = target_institution_id
      and membership.role = 'TEACHER'::public.user_role
      and membership.active is true
  );
$$;

alter table public.academic_calendar_events enable row level security;

create policy academic_calendar_events_staff_select
on public.academic_calendar_events
for select
to authenticated
using (
  private.has_institution_role(
    institution_id,
    array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]
  )
);

create policy academic_calendar_events_staff_insert
on public.academic_calendar_events
for insert
to authenticated
with check (
  private.has_institution_role(
    institution_id,
    array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]
  )
  and created_by = auth.uid()
);

create policy academic_calendar_events_staff_update
on public.academic_calendar_events
for update
to authenticated
using (
  private.has_institution_role(
    institution_id,
    array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]
  )
)
with check (
  private.has_institution_role(
    institution_id,
    array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]
  )
);

create policy academic_calendar_events_student_select
on public.academic_calendar_events
for select
to authenticated
using (
  active is true
  and (
    audience in ('ALL', 'STUDENTS')
    or (
      audience = 'CLASS'
      and private.is_active_student_of_calendar_class(institution_id, class_id)
    )
  )
  and private.is_active_student_of_institution(institution_id)
);

create policy academic_calendar_events_guardian_select
on public.academic_calendar_events
for select
to authenticated
using (
  active is true
  and (
    audience in ('ALL', 'GUARDIANS')
    or (
      audience = 'CLASS'
      and private.is_active_guardian_of_calendar_class(institution_id, class_id)
    )
  )
  and private.is_active_guardian_of_institution(institution_id)
);

create policy academic_calendar_events_teacher_select
on public.academic_calendar_events
for select
to authenticated
using (
  active is true
  and (
    audience in ('ALL', 'TEACHERS')
    or (
      audience = 'CLASS'
      and private.is_active_teacher_of_calendar_class(institution_id, class_id)
    )
  )
  and exists (
    select 1
    from public.memberships as membership
    where membership.profile_id = auth.uid()
      and membership.institution_id = institution_id
      and membership.role = 'TEACHER'::public.user_role
      and membership.active is true
  )
);

revoke all on function private.validate_academic_calendar_event_references() from public, anon, authenticated;
revoke all on function private.is_active_student_of_calendar_class(uuid, uuid) from public, anon, authenticated;
revoke all on function private.is_active_guardian_of_calendar_class(uuid, uuid) from public, anon, authenticated;
revoke all on function private.is_active_teacher_of_calendar_class(uuid, uuid) from public, anon, authenticated;

grant select, insert, update
on public.academic_calendar_events
to authenticated;

commit;
