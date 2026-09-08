begin;

create table if not exists public.institution_announcements (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  title text not null,
  message text not null,
  audience text not null default 'ALL',
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institution_announcements_title_length_check
    check (char_length(trim(title)) between 3 and 160),
  constraint institution_announcements_message_length_check
    check (char_length(trim(message)) between 3 and 12000),
  constraint institution_announcements_audience_check
    check (audience in ('ALL', 'STUDENTS', 'GUARDIANS')),
  constraint institution_announcements_dates_check
    check (ends_at is null or ends_at > starts_at)
);

create index if not exists institution_announcements_audience_idx
  on public.institution_announcements(institution_id, audience, active, starts_at desc);

create or replace function private.is_active_student_of_institution(
  target_institution_id uuid
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
    where student.profile_id = auth.uid()
      and student.institution_id = target_institution_id
      and student.active is true
  );
$$;

create or replace function private.is_active_guardian_of_institution(
  target_institution_id uuid
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
    where guardianship.guardian_profile_id = auth.uid()
      and guardianship.active is true
      and student.institution_id = target_institution_id
      and student.active is true
  );
$$;

alter table public.institution_announcements enable row level security;

drop policy if exists guardianships_student_select
  on public.guardianships;

create policy guardianships_student_select
on public.guardianships
for select
to authenticated
using (
  exists (
    select 1
    from public.students as student
    where student.id = guardianships.student_id
      and student.profile_id = auth.uid()
  )
);

drop policy if exists institution_announcements_staff_access
  on public.institution_announcements;
drop policy if exists institution_announcements_staff_select
  on public.institution_announcements;
drop policy if exists institution_announcements_staff_insert
  on public.institution_announcements;
drop policy if exists institution_announcements_staff_update
  on public.institution_announcements;
drop policy if exists institution_announcements_staff_delete
  on public.institution_announcements;

create policy institution_announcements_staff_select
on public.institution_announcements
for select
to authenticated
using (
  private.has_institution_role(
    institution_id,
    array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]
  )
);

create policy institution_announcements_staff_insert
on public.institution_announcements
for insert
to authenticated
with check (
  private.has_institution_role(
    institution_id,
    array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]
  )
  and created_by = auth.uid()
);

create policy institution_announcements_staff_update
on public.institution_announcements
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

create policy institution_announcements_staff_delete
on public.institution_announcements
for delete
to authenticated
using (
  private.has_institution_role(
    institution_id,
    array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]
  )
);

drop policy if exists institution_announcements_student_select
  on public.institution_announcements;

create policy institution_announcements_student_select
on public.institution_announcements
for select
to authenticated
using (
  active is true
  and starts_at <= now()
  and (ends_at is null or ends_at >= now())
  and audience in ('ALL', 'STUDENTS')
  and private.is_active_student_of_institution(institution_id)
);

drop policy if exists institution_announcements_guardian_select
  on public.institution_announcements;

create policy institution_announcements_guardian_select
on public.institution_announcements
for select
to authenticated
using (
  active is true
  and starts_at <= now()
  and (ends_at is null or ends_at >= now())
  and audience in ('ALL', 'GUARDIANS')
  and private.is_active_guardian_of_institution(institution_id)
);

revoke all
on function private.is_active_student_of_institution(uuid)
from public, anon, authenticated;

revoke all
on function private.is_active_guardian_of_institution(uuid)
from public, anon, authenticated;

grant execute
on function private.is_active_student_of_institution(uuid)
to authenticated, service_role;

grant execute
on function private.is_active_guardian_of_institution(uuid)
to authenticated, service_role;

grant select, insert, update, delete
on public.institution_announcements
to authenticated;

commit;
