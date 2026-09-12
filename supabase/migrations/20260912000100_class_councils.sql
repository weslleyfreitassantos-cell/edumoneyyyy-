begin;

create table public.class_councils (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  status text not null default 'DRAFT',
  scheduled_at timestamptz,
  opened_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  reopened_at timestamptz,
  general_notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  opened_by uuid references public.profiles(id) on delete set null,
  completed_by uuid references public.profiles(id) on delete set null,
  canceled_by uuid references public.profiles(id) on delete set null,
  reopened_by uuid references public.profiles(id) on delete set null,
  reopen_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_councils_status_check
    check (status in ('DRAFT', 'OPEN', 'COMPLETED', 'CANCELED')),
  constraint class_councils_reopen_reason_check
    check (reopen_reason is null or length(btrim(reopen_reason)) > 0)
);

create unique index class_councils_active_context_unique_idx
  on public.class_councils (institution_id, academic_year_id, term_id, class_id)
  where status <> 'CANCELED';

create index class_councils_institution_status_idx
  on public.class_councils (institution_id, status, scheduled_at desc);

create index class_councils_context_idx
  on public.class_councils (institution_id, academic_year_id, term_id, class_id);

create table public.class_council_participants (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  council_id uuid not null references public.class_councils(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  participant_role public.user_role not null,
  added_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint class_council_participants_role_check
    check (participant_role in ('DIRECTOR', 'SECRETARY', 'TEACHER')),
  constraint class_council_participants_unique_profile
    unique (council_id, profile_id)
);

create index class_council_participants_council_idx
  on public.class_council_participants (council_id, participant_role);

create table public.class_council_student_notes (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  council_id uuid not null references public.class_councils(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  student_name text not null,
  registration_number text not null,
  class_name text not null,
  snapshot_at timestamptz not null default now(),
  average_grade numeric,
  attendance_percentage numeric,
  low_performance_subjects integer not null default 0 check (low_performance_subjects >= 0),
  low_attendance_subjects integer not null default 0 check (low_attendance_subjects >= 0),
  pending_items integer not null default 0 check (pending_items >= 0),
  risk_level text not null check (risk_level in ('NORMAL', 'ATTENTION', 'CRITICAL')),
  risk_reasons jsonb not null default '[]'::jsonb check (jsonb_typeof(risk_reasons) = 'array'),
  data_status text not null check (data_status in ('PARTIAL', 'OFFICIAL')),
  teacher_contributions jsonb not null default '{}'::jsonb check (jsonb_typeof(teacher_contributions) = 'object'),
  observation text,
  resolution text,
  follow_up_category text,
  follow_up_text text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_council_student_notes_unique_student
    unique (council_id, student_id),
  constraint class_council_student_notes_follow_up_check
    check (follow_up_category is null or follow_up_category in ('NONE', 'MONITOR', 'INDIVIDUAL_PLAN', 'FAMILY_MEETING', 'REFERRAL', 'OTHER'))
);

create index class_council_student_notes_council_idx
  on public.class_council_student_notes (council_id, risk_level, data_status);

create index class_council_student_notes_student_idx
  on public.class_council_student_notes (institution_id, student_id);

create or replace function private.class_council_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger class_councils_touch_updated_at
before update on public.class_councils
for each row execute function private.class_council_touch_updated_at();

create trigger class_council_student_notes_touch_updated_at
before update on public.class_council_student_notes
for each row execute function private.class_council_touch_updated_at();

create or replace function private.class_council_context_is_valid(
  p_institution_id uuid,
  p_academic_year_id uuid,
  p_term_id uuid,
  p_class_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.academic_years as academic_year
    join public.terms as term
      on term.id = p_term_id
     and term.academic_year_id = academic_year.id
    join public.classes as class
      on class.id = p_class_id
     and class.academic_year_id = academic_year.id
    where academic_year.id = p_academic_year_id
      and academic_year.institution_id = p_institution_id
      and class.institution_id = p_institution_id
  );
$$;

create or replace function private.is_teacher_for_class_council(
  p_council_id uuid,
  p_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_current_profile_active()
    and exists (
      select 1
      from public.class_councils as council
      join public.subject_offerings as offering
        on offering.class_id = council.class_id
       and offering.term_id = council.term_id
       and offering.teacher_profile_id = auth.uid()
       and offering.active is true
      join public.classes as class
        on class.id = council.class_id
       and class.institution_id = p_institution_id
       and class.active is true
      join public.memberships as membership
        on membership.profile_id = auth.uid()
       and membership.institution_id = p_institution_id
       and membership.role = 'TEACHER'::public.user_role
       and membership.active is true
      where council.id = p_council_id
        and council.institution_id = p_institution_id
    );
$$;

create or replace function private.class_council_staff_can_manage(
  p_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_exact_institution_role(
    p_institution_id,
    array['DIRECTOR', 'SECRETARY']::public.user_role[]
  );
$$;

create or replace function private.class_council_director_can_manage(
  p_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_exact_institution_role(
    p_institution_id,
    array['DIRECTOR']::public.user_role[]
  );
$$;

create or replace function private.class_council_validate_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.class_council_context_is_valid(
    new.institution_id,
    new.academic_year_id,
    new.term_id,
    new.class_id
  ) then
    raise exception 'CLASS_COUNCIL_CONTEXT_INVALID' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger class_councils_validate_context
before insert or update on public.class_councils
for each row execute function private.class_council_validate_context();

create or replace function private.class_council_protect_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed_transition text := current_setting('edumanager.class_council_transition', true);
begin
  if new.institution_id <> old.institution_id
     or new.academic_year_id <> old.academic_year_id
     or new.term_id <> old.term_id
     or new.class_id <> old.class_id
     or new.created_by <> old.created_by
     or new.created_at <> old.created_at then
    raise exception 'CLASS_COUNCIL_CONTEXT_IMMUTABLE' using errcode = '42501';
  end if;

  if new.status <> old.status then
    if allowed_transition is null or allowed_transition <> lower(new.status) then
      raise exception 'CLASS_COUNCIL_LIFECYCLE_RPC_REQUIRED' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger class_councils_protect_transition
before update on public.class_councils
for each row execute function private.class_council_protect_transition();

create or replace function private.class_council_validate_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  council_row public.class_councils;
begin
  select * into council_row
  from public.class_councils
  where id = new.council_id;

  if council_row.id is null
     or council_row.institution_id <> new.institution_id
     or council_row.status not in ('DRAFT', 'OPEN') then
    raise exception 'CLASS_COUNCIL_PARTICIPANT_CONTEXT_INVALID' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.memberships as membership
    join public.profiles as profile on profile.id = membership.profile_id
    where membership.profile_id = new.profile_id
      and membership.institution_id = new.institution_id
      and membership.role = new.participant_role
      and membership.active is true
      and profile.active is true
  ) then
    raise exception 'CLASS_COUNCIL_PARTICIPANT_NOT_ELIGIBLE' using errcode = '23514';
  end if;

  if new.participant_role = 'TEACHER'::public.user_role
     and not exists (
       select 1
       from public.subject_offerings as offering
       where offering.class_id = council_row.class_id
         and offering.term_id = council_row.term_id
         and offering.teacher_profile_id = new.profile_id
         and offering.active is true
     ) then
    raise exception 'CLASS_COUNCIL_TEACHER_NOT_ASSIGNED' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger class_council_participants_validate
before insert or update on public.class_council_participants
for each row execute function private.class_council_validate_participant();

create or replace function private.class_council_validate_student_note()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  council_row public.class_councils;
begin
  select * into council_row
  from public.class_councils
  where id = new.council_id;

  if council_row.id is null
     or council_row.institution_id <> new.institution_id
     or not exists (
       select 1
       from public.students as student
       join public.enrollments as enrollment
         on enrollment.student_id = student.id
        and enrollment.class_id = council_row.class_id
        and enrollment.academic_year_id = council_row.academic_year_id
        and enrollment.active is true
        and enrollment.status = 'ACTIVE'
       where student.id = new.student_id
         and student.institution_id = new.institution_id
         and student.active is true
     ) then
    raise exception 'CLASS_COUNCIL_STUDENT_CONTEXT_INVALID' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger class_council_student_notes_validate
before insert or update on public.class_council_student_notes
for each row execute function private.class_council_validate_student_note();

create or replace function public.create_class_council(
  p_institution_id uuid,
  p_academic_year_id uuid,
  p_term_id uuid,
  p_class_id uuid,
  p_scheduled_at timestamptz default null,
  p_general_notes text default null
)
returns public.class_councils
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.class_councils;
begin
  if not private.class_council_director_can_manage(p_institution_id) then
    raise exception 'CLASS_COUNCIL_FORBIDDEN' using errcode = '42501';
  end if;
  if not private.class_council_context_is_valid(p_institution_id, p_academic_year_id, p_term_id, p_class_id) then
    raise exception 'CLASS_COUNCIL_CONTEXT_INVALID' using errcode = '23514';
  end if;

  insert into public.class_councils (
    institution_id, academic_year_id, term_id, class_id,
    scheduled_at, general_notes, created_by
  ) values (
    p_institution_id, p_academic_year_id, p_term_id, p_class_id,
    p_scheduled_at, nullif(btrim(p_general_notes), ''), auth.uid()
  ) returning * into result;
  return result;
exception when unique_violation then
  raise exception 'CLASS_COUNCIL_ALREADY_EXISTS' using errcode = '23505';
end;
$$;

create or replace function public.open_class_council(
  p_council_id uuid,
  p_snapshots jsonb
)
returns public.class_councils
language plpgsql
security definer
set search_path = ''
as $$
declare
  council_row public.class_councils;
  result public.class_councils;
  expected_count integer;
  snapshot_count integer;
  distinct_snapshot_count integer;
begin
  select * into council_row
  from public.class_councils
  where id = p_council_id
  for update;

  if council_row.id is null or not private.class_council_director_can_manage(council_row.institution_id) then
    raise exception 'CLASS_COUNCIL_FORBIDDEN' using errcode = '42501';
  end if;
  if council_row.status <> 'DRAFT' then
    raise exception 'CLASS_COUNCIL_INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_snapshots) <> 'array' then
    raise exception 'CLASS_COUNCIL_SNAPSHOT_INVALID' using errcode = '22023';
  end if;
  if exists (select 1 from public.class_council_student_notes where council_id = p_council_id) then
    raise exception 'CLASS_COUNCIL_SNAPSHOT_ALREADY_EXISTS' using errcode = '23505';
  end if;

  select count(*) into expected_count
  from public.enrollments as enrollment
  join public.students as student on student.id = enrollment.student_id
  where enrollment.class_id = council_row.class_id
    and enrollment.academic_year_id = council_row.academic_year_id
    and enrollment.active is true
    and enrollment.status = 'ACTIVE'
    and student.institution_id = council_row.institution_id
    and student.active is true;

  select count(*), count(distinct (value->>'student_id'))
    into snapshot_count, distinct_snapshot_count
  from jsonb_array_elements(p_snapshots) as item(value);

  if snapshot_count <> expected_count or snapshot_count <> distinct_snapshot_count then
    raise exception 'CLASS_COUNCIL_SNAPSHOT_INCOMPLETE' using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_snapshots) as item(value)
    where not exists (
      select 1
      from public.enrollments as enrollment
      join public.students as student on student.id = enrollment.student_id
      where enrollment.student_id = (item.value->>'student_id')::uuid
        and enrollment.class_id = council_row.class_id
        and enrollment.academic_year_id = council_row.academic_year_id
        and enrollment.active is true
        and enrollment.status = 'ACTIVE'
        and student.institution_id = council_row.institution_id
        and student.active is true
    )
    or coalesce(item.value->>'risk_level', '') not in ('NORMAL', 'ATTENTION', 'CRITICAL')
    or coalesce(item.value->>'data_status', '') not in ('PARTIAL', 'OFFICIAL')
  ) then
    raise exception 'CLASS_COUNCIL_SNAPSHOT_INVALID' using errcode = '23514';
  end if;

  insert into public.class_council_student_notes (
    institution_id, council_id, student_id, student_name,
    registration_number, class_name, snapshot_at, average_grade,
    attendance_percentage, low_performance_subjects,
    low_attendance_subjects, pending_items, risk_level,
    risk_reasons, data_status
  )
  select
    council_row.institution_id,
    council_row.id,
    (item.value->>'student_id')::uuid,
    item.value->>'full_name',
    item.value->>'registration_number',
    item.value->>'class_name',
    now(),
    nullif(item.value->>'average_grade', '')::numeric,
    nullif(item.value->>'attendance_percentage', '')::numeric,
    coalesce((item.value->>'low_performance_subjects')::integer, 0),
    coalesce((item.value->>'low_attendance_subjects')::integer, 0),
    coalesce((item.value->>'pending_items')::integer, 0),
    item.value->>'risk_level',
    coalesce(item.value->'risk_reasons', '[]'::jsonb),
    item.value->>'data_status'
  from jsonb_array_elements(p_snapshots) as item(value);

  perform set_config('edumanager.class_council_transition', 'open', true);
  update public.class_councils
  set status = 'OPEN', opened_at = now(), opened_by = auth.uid()
  where id = p_council_id
  returning * into result;
  return result;
end;
$$;

create or replace function public.complete_class_council(
  p_council_id uuid
)
returns public.class_councils
language plpgsql
security definer
set search_path = ''
as $$
declare
  council_row public.class_councils;
  result public.class_councils;
begin
  select * into council_row from public.class_councils where id = p_council_id for update;
  if council_row.id is null or not private.class_council_director_can_manage(council_row.institution_id) then
    raise exception 'CLASS_COUNCIL_FORBIDDEN' using errcode = '42501';
  end if;
  if council_row.status <> 'OPEN' then
    raise exception 'CLASS_COUNCIL_INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.class_council_participants where council_id = p_council_id) then
    raise exception 'CLASS_COUNCIL_PARTICIPANTS_REQUIRED' using errcode = '23514';
  end if;
  if not exists (select 1 from public.class_council_student_notes where council_id = p_council_id) then
    raise exception 'CLASS_COUNCIL_SNAPSHOT_REQUIRED' using errcode = '23514';
  end if;

  perform set_config('edumanager.class_council_transition', 'completed', true);
  update public.class_councils
  set status = 'COMPLETED', completed_at = now(), completed_by = auth.uid()
  where id = p_council_id
  returning * into result;
  return result;
end;
$$;

create or replace function public.reopen_class_council(
  p_council_id uuid,
  p_reason text
)
returns public.class_councils
language plpgsql
security definer
set search_path = ''
as $$
declare
  council_row public.class_councils;
  result public.class_councils;
begin
  select * into council_row from public.class_councils where id = p_council_id for update;
  if council_row.id is null or not private.class_council_director_can_manage(council_row.institution_id) then
    raise exception 'CLASS_COUNCIL_FORBIDDEN' using errcode = '42501';
  end if;
  if council_row.status <> 'COMPLETED' then
    raise exception 'CLASS_COUNCIL_INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'CLASS_COUNCIL_REOPEN_REASON_REQUIRED' using errcode = '23514';
  end if;

  perform set_config('edumanager.class_council_transition', 'open', true);
  update public.class_councils
  set status = 'OPEN', reopened_at = now(), reopened_by = auth.uid(), reopen_reason = btrim(p_reason)
  where id = p_council_id
  returning * into result;
  return result;
end;
$$;

create or replace function public.cancel_class_council(
  p_council_id uuid
)
returns public.class_councils
language plpgsql
security definer
set search_path = ''
as $$
declare
  council_row public.class_councils;
  result public.class_councils;
begin
  select * into council_row from public.class_councils where id = p_council_id for update;
  if council_row.id is null or not private.class_council_director_can_manage(council_row.institution_id) then
    raise exception 'CLASS_COUNCIL_FORBIDDEN' using errcode = '42501';
  end if;
  if council_row.status not in ('DRAFT', 'OPEN') then
    raise exception 'CLASS_COUNCIL_INVALID_TRANSITION' using errcode = 'P0001';
  end if;

  perform set_config('edumanager.class_council_transition', 'canceled', true);
  update public.class_councils
  set status = 'CANCELED', canceled_at = now(), canceled_by = auth.uid()
  where id = p_council_id
  returning * into result;
  return result;
end;
$$;

create or replace function public.add_class_council_participant(
  p_council_id uuid,
  p_profile_id uuid,
  p_participant_role public.user_role
)
returns public.class_council_participants
language plpgsql
security definer
set search_path = ''
as $$
declare
  council_row public.class_councils;
  result public.class_council_participants;
begin
  select * into council_row from public.class_councils where id = p_council_id;
  if council_row.id is null or not private.class_council_staff_can_manage(council_row.institution_id) then
    raise exception 'CLASS_COUNCIL_FORBIDDEN' using errcode = '42501';
  end if;
  if council_row.status not in ('DRAFT', 'OPEN') then
    raise exception 'CLASS_COUNCIL_CLOSED' using errcode = 'P0001';
  end if;
  insert into public.class_council_participants (
    institution_id, council_id, profile_id, participant_role, added_by
  ) values (
    council_row.institution_id, council_row.id, p_profile_id, p_participant_role, auth.uid()
  ) returning * into result;
  return result;
exception when unique_violation then
  raise exception 'CLASS_COUNCIL_PARTICIPANT_ALREADY_EXISTS' using errcode = '23505';
end;
$$;

create or replace function public.remove_class_council_participant(
  p_participant_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant_row public.class_council_participants;
begin
  select * into participant_row from public.class_council_participants where id = p_participant_id;
  if participant_row.id is null or not private.class_council_staff_can_manage(participant_row.institution_id) then
    raise exception 'CLASS_COUNCIL_FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.class_councils
    where id = participant_row.council_id and status in ('DRAFT', 'OPEN')
  ) then
    raise exception 'CLASS_COUNCIL_CLOSED' using errcode = 'P0001';
  end if;
  delete from public.class_council_participants where id = p_participant_id;
  return true;
end;
$$;

create or replace function public.update_class_council_student_note(
  p_council_id uuid,
  p_student_id uuid,
  p_observation text default null,
  p_resolution text default null,
  p_follow_up_category text default null,
  p_follow_up_text text default null,
  p_teacher_contribution text default null
)
returns public.class_council_student_notes
language plpgsql
security definer
set search_path = ''
as $$
declare
  council_row public.class_councils;
  result public.class_council_student_notes;
  is_staff boolean;
begin
  select * into council_row from public.class_councils where id = p_council_id;
  if council_row.id is null then
    raise exception 'CLASS_COUNCIL_NOT_FOUND' using errcode = 'P0002';
  end if;
  if council_row.status not in ('DRAFT', 'OPEN') then
    raise exception 'CLASS_COUNCIL_CLOSED' using errcode = 'P0001';
  end if;

  is_staff := private.class_council_staff_can_manage(council_row.institution_id);
  if is_staff then
    if p_teacher_contribution is not null then
      raise exception 'CLASS_COUNCIL_NOTE_ROLE_INVALID' using errcode = '42501';
    end if;
    update public.class_council_student_notes
    set observation = coalesce(p_observation, observation),
        resolution = coalesce(p_resolution, resolution),
        follow_up_category = coalesce(p_follow_up_category, follow_up_category),
        follow_up_text = coalesce(p_follow_up_text, follow_up_text),
        updated_by = auth.uid()
    where council_id = p_council_id and student_id = p_student_id
    returning * into result;
  elsif private.is_teacher_for_class_council(p_council_id, council_row.institution_id) then
    if p_observation is not null or p_resolution is not null or p_follow_up_category is not null or p_follow_up_text is not null then
      raise exception 'CLASS_COUNCIL_NOTE_ROLE_INVALID' using errcode = '42501';
    end if;
    update public.class_council_student_notes
    set teacher_contributions = case
          when p_teacher_contribution is null then teacher_contributions - auth.uid()::text
          else jsonb_set(teacher_contributions, array[auth.uid()::text], to_jsonb(p_teacher_contribution), true)
        end,
        updated_by = auth.uid()
    where council_id = p_council_id and student_id = p_student_id
    returning * into result;
  else
    raise exception 'CLASS_COUNCIL_FORBIDDEN' using errcode = '42501';
  end if;

  if result.id is null then
    raise exception 'CLASS_COUNCIL_STUDENT_NOTE_NOT_FOUND' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

alter table public.class_councils enable row level security;
alter table public.class_council_participants enable row level security;
alter table public.class_council_student_notes enable row level security;

revoke all on table public.class_councils, public.class_council_participants, public.class_council_student_notes from public, anon, authenticated;
grant select on table public.class_councils, public.class_council_participants, public.class_council_student_notes to authenticated;
grant update (scheduled_at, general_notes) on table public.class_councils to authenticated;
grant all on table public.class_councils, public.class_council_participants, public.class_council_student_notes to service_role;

drop policy if exists class_councils_select_policy on public.class_councils;
create policy class_councils_select_policy
on public.class_councils for select to authenticated
using (
  private.class_council_staff_can_manage(institution_id)
  or private.is_teacher_for_class_council(id, institution_id)
);

drop policy if exists class_councils_update_policy on public.class_councils;
create policy class_councils_update_policy
on public.class_councils for update to authenticated
using (
  private.class_council_staff_can_manage(institution_id)
  and status in ('DRAFT', 'OPEN')
)
with check (
  private.class_council_staff_can_manage(institution_id)
  and status in ('DRAFT', 'OPEN')
);

drop policy if exists class_council_participants_select_policy on public.class_council_participants;
create policy class_council_participants_select_policy
on public.class_council_participants for select to authenticated
using (
  private.class_council_staff_can_manage(institution_id)
  or private.is_teacher_for_class_council(council_id, institution_id)
);

drop policy if exists class_council_student_notes_select_policy on public.class_council_student_notes;
create policy class_council_student_notes_select_policy
on public.class_council_student_notes for select to authenticated
using (
  private.class_council_staff_can_manage(institution_id)
  or private.is_teacher_for_class_council(council_id, institution_id)
);

revoke all on function private.class_council_context_is_valid(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.is_teacher_for_class_council(uuid, uuid) from public, anon, authenticated;
revoke all on function private.class_council_staff_can_manage(uuid) from public, anon, authenticated;
revoke all on function private.class_council_director_can_manage(uuid) from public, anon, authenticated;
revoke all on function private.class_council_validate_context() from public, anon, authenticated;
revoke all on function private.class_council_protect_transition() from public, anon, authenticated;
revoke all on function private.class_council_validate_participant() from public, anon, authenticated;
revoke all on function private.class_council_validate_student_note() from public, anon, authenticated;

grant execute on function private.class_council_staff_can_manage(uuid)
  to authenticated, service_role;
grant execute on function private.class_council_director_can_manage(uuid)
  to authenticated, service_role;
grant execute on function private.is_teacher_for_class_council(uuid, uuid)
  to authenticated, service_role;

revoke all on function public.create_class_council(uuid, uuid, uuid, uuid, timestamptz, text) from public, anon, authenticated;
revoke all on function public.open_class_council(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.complete_class_council(uuid) from public, anon, authenticated;
revoke all on function public.reopen_class_council(uuid, text) from public, anon, authenticated;
revoke all on function public.cancel_class_council(uuid) from public, anon, authenticated;
revoke all on function public.add_class_council_participant(uuid, uuid, public.user_role) from public, anon, authenticated;
revoke all on function public.remove_class_council_participant(uuid) from public, anon, authenticated;
revoke all on function public.update_class_council_student_note(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_class_council(uuid, uuid, uuid, uuid, timestamptz, text) to authenticated, service_role;
grant execute on function public.open_class_council(uuid, jsonb) to authenticated, service_role;
grant execute on function public.complete_class_council(uuid) to authenticated, service_role;
grant execute on function public.reopen_class_council(uuid, text) to authenticated, service_role;
grant execute on function public.cancel_class_council(uuid) to authenticated, service_role;
grant execute on function public.add_class_council_participant(uuid, uuid, public.user_role) to authenticated, service_role;
grant execute on function public.remove_class_council_participant(uuid) to authenticated, service_role;
grant execute on function public.update_class_council_student_note(uuid, uuid, text, text, text, text, text) to authenticated, service_role;

revoke all on function private.class_council_touch_updated_at() from public, anon, authenticated;
grant execute on function private.class_council_touch_updated_at() to service_role;

commit;
