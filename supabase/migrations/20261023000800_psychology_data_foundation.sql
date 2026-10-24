begin;

create extension if not exists btree_gist;

-- Absence means disabled. Browser roles never read or change this control row.
create table public.psychology_module_settings (
  institution_id uuid primary key references public.institutions(id) on delete restrict,
  enabled boolean not null default false,
  session_minutes integer not null default 50 check (session_minutes between 20 and 120),
  preparation_minutes integer not null default 10 check (preparation_minutes between 0 and 60),
  booking_horizon_days integer not null default 30 check (booking_horizon_days between 1 and 90),
  cancellation_cutoff_minutes integer not null default 60 check (cancellation_cutoff_minutes between 0 and 10080),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete restrict
);

create table public.psychology_professionals (
  profile_id uuid primary key references public.profiles(id) on delete restrict,
  crp_registration text not null check (crp_registration ~ '^[0-9./-]{2,20}$'),
  crp_state text not null check (crp_state ~ '^[A-Z]{2}$'),
  verification_status text not null default 'PENDING' check (verification_status in ('PENDING', 'VERIFIED', 'SUSPENDED')),
  active boolean not null default true,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((verification_status = 'VERIFIED') = (verified_at is not null and verified_by is not null))
);

create table public.psychology_professional_institutions (
  professional_profile_id uuid not null references public.psychology_professionals(profile_id) on delete restrict,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (professional_profile_id, institution_id)
);

create table public.psychology_assignments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  professional_profile_id uuid not null references public.psychology_professionals(profile_id) on delete restrict,
  starts_on date not null default current_date,
  ends_on date,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);
create unique index psychology_assignments_one_active_link
  on public.psychology_assignments (institution_id, student_id, professional_profile_id)
  where active is true;
create index psychology_assignments_student_active_idx
  on public.psychology_assignments (institution_id, student_id, active);
create index psychology_assignments_professional_active_idx
  on public.psychology_assignments (institution_id, professional_profile_id, active);

create table public.psychology_authorizations (
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  signatory_profile_id uuid not null references public.profiles(id) on delete restrict,
  signatory_kind text not null check (signatory_kind in ('STUDENT', 'GUARDIAN')),
  privacy_notice_version text not null,
  service_terms_version text not null,
  treatment_authorization_version text not null,
  status text not null check (status in ('ACTIVE', 'REVOKED')),
  confirmed_at timestamptz not null default now(),
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (institution_id, student_id),
  check ((status = 'REVOKED') = (revoked_at is not null))
);
create index psychology_authorizations_signatory_idx
  on public.psychology_authorizations (signatory_profile_id, status);

create table public.psychology_availability_rules (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  professional_profile_id uuid not null references public.psychology_professionals(profile_id) on delete restrict,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_local time not null,
  end_local time not null,
  timezone text not null default 'America/Sao_Paulo',
  session_minutes integer not null default 50 check (session_minutes between 20 and 120),
  preparation_minutes integer not null default 10 check (preparation_minutes between 0 and 60),
  valid_from date not null default current_date,
  valid_until date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (start_local < end_local),
  check (valid_until is null or valid_until >= valid_from)
);
alter table public.psychology_availability_rules
  add constraint psychology_availability_rules_no_overlap
  exclude using gist (
    professional_profile_id with =,
    institution_id with =,
    day_of_week with =,
    daterange(valid_from, valid_until, '[]') with &&,
    tsrange(date '2000-01-03' + start_local, date '2000-01-03' + end_local, '[)') with &&
  ) where (active is true);
create index psychology_availability_rules_lookup_idx
  on public.psychology_availability_rules (institution_id, professional_profile_id, day_of_week, valid_from, valid_until)
  where active is true;

create table public.psychology_availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  professional_profile_id uuid not null references public.psychology_professionals(profile_id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null default 'BLOCKED' check (reason = 'BLOCKED'),
  created_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

create table public.psychology_appointments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  professional_profile_id uuid not null references public.psychology_professionals(profile_id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  preparation_minutes integer not null default 10 check (preparation_minutes between 0 and 60),
  status text not null default 'SCHEDULED' check (status in ('SCHEDULED', 'CANCELLED', 'COMPLETED', 'NO_SHOW')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at),
  unique (created_by, idempotency_key)
);
alter table public.psychology_appointments
  add constraint psychology_appointments_no_student_overlap
  exclude using gist (student_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
  where (status = 'SCHEDULED');
alter table public.psychology_appointments
  add constraint psychology_appointments_no_professional_overlap
  exclude using gist (
    professional_profile_id with =,
    tsrange(
      starts_at at time zone 'UTC',
      (ends_at at time zone 'UTC') + preparation_minutes * interval '1 minute',
      '[)'
    ) with &&
  ) where (status = 'SCHEDULED');
create index psychology_appointments_student_schedule_idx
  on public.psychology_appointments (institution_id, student_id, starts_at desc);
create index psychology_appointments_professional_schedule_idx
  on public.psychology_appointments (institution_id, professional_profile_id, starts_at);

create table public.psychology_appointment_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.psychology_appointments(id) on delete restrict,
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('BOOKED', 'CANCELLED', 'RESCHEDULED', 'COMPLETED', 'NO_SHOW')),
  previous_starts_at timestamptz,
  next_starts_at timestamptz,
  operation_key uuid unique,
  created_at timestamptz not null default now()
);

create table public.psychology_sessions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.psychology_appointments(id) on delete restrict,
  status text not null default 'WAITING' check (status in ('WAITING', 'IN_PROGRESS', 'CLOSED')),
  started_at timestamptz,
  ends_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'WAITING' and started_at is null and closed_at is null)
    or (status = 'IN_PROGRESS' and started_at is not null and closed_at is null)
    or (status = 'CLOSED' and closed_at is not null))
);
create table public.psychology_messages (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.psychology_sessions(id) on delete restrict,
  sender_profile_id uuid not null references public.profiles(id) on delete restrict,
  client_message_key uuid not null,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  unique (session_id, sender_profile_id, client_message_key)
);
create index psychology_messages_session_cursor_idx
  on public.psychology_messages (session_id, id);

create table public.psychology_notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.psychology_sessions(id) on delete restrict,
  author_profile_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'FINALIZED')),
  version integer not null default 0 check (version >= 0),
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  finalized_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check ((status = 'FINALIZED') = (finalized_at is not null))
);
create table public.psychology_note_versions (
  id bigint generated always as identity primary key,
  note_id uuid not null references public.psychology_notes(id) on delete restrict,
  version integer not null check (version > 0),
  kind text not null check (kind in ('DRAFT_SAVE', 'FINALIZED', 'ADDENDUM')),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  author_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (note_id, version)
);
create index psychology_notes_author_idx on public.psychology_notes (author_profile_id, updated_at desc);

create table public.psychology_audit_events (
  id bigint generated always as identity primary key,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('MODULE_ENABLED', 'MODULE_DISABLED', 'PROFESSIONAL_REGISTERED', 'CRP_VERIFIED', 'ASSIGNMENT_CHANGED', 'AUTHORIZATION_CONFIRMED', 'AUTHORIZATION_REVOKED', 'APPOINTMENT_BOOKED', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_RESCHEDULED', 'SESSION_STARTED', 'SESSION_CLOSED', 'NOTE_SAVED', 'NOTE_FINALIZED', 'NOTE_ADDENDUM')),
  subject_id uuid,
  created_at timestamptz not null default now()
);
create index psychology_audit_events_institution_idx
  on public.psychology_audit_events (institution_id, created_at desc);

create or replace function private.psychology_module_is_enabled(target_institution_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select setting.enabled
    from public.psychology_module_settings setting
    where setting.institution_id = target_institution_id
  ), false)
    and public.is_institution_operational(target_institution_id)
    and private.is_current_profile_active();
$$;

create or replace function private.psychology_is_manager(target_institution_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_current_profile_active()
    and public.can_manage_institution_operations(target_institution_id);
$$;

create or replace function private.psychology_professional_is_eligible(target_institution_id uuid, target_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
      select 1
      from public.psychology_professionals professional
      join public.psychology_professional_institutions link
        on link.professional_profile_id = professional.profile_id
      join public.memberships membership
        on membership.profile_id = professional.profile_id
       and membership.institution_id = link.institution_id
      where professional.profile_id = target_profile_id
        and link.institution_id = target_institution_id
        and link.active is true
        and membership.active is true
        and membership.role = 'PSYCHOLOGIST'::public.user_role
        and professional.active is true
        and professional.verification_status = 'VERIFIED'
        and exists (select 1 from public.profiles profile
          where profile.id = professional.profile_id and profile.active is true)
    );
$$;

create or replace function private.psychology_is_professional(target_institution_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_current_profile_active()
    and private.psychology_module_is_enabled(target_institution_id)
    and private.psychology_professional_is_eligible(target_institution_id, auth.uid());
$$;

create or replace function private.psychology_student_is_assigned(target_institution_id uuid, target_student_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_current_profile_active()
    and exists (
      select 1
      from public.psychology_assignments assignment
      join public.students student
        on student.id = assignment.student_id
       and student.institution_id = assignment.institution_id
      join public.memberships student_membership
        on student_membership.profile_id = student.profile_id
       and student_membership.institution_id = assignment.institution_id
      join public.psychology_professionals professional
        on professional.profile_id = assignment.professional_profile_id
      join public.psychology_professional_institutions professional_link
        on professional_link.professional_profile_id = professional.profile_id
       and professional_link.institution_id = assignment.institution_id
      join public.memberships professional_membership
        on professional_membership.profile_id = professional.profile_id
       and professional_membership.institution_id = assignment.institution_id
      join public.psychology_authorizations authorization
        on authorization.institution_id = assignment.institution_id
       and authorization.student_id = student.id
       and authorization.status = 'ACTIVE'
      where assignment.institution_id = target_institution_id
        and assignment.student_id = target_student_id
        and student.profile_id = auth.uid()
        and assignment.active is true
        and (assignment.ends_on is null or assignment.ends_on >= current_date)
        and assignment.starts_on <= current_date
        and student.active is true
        and student_membership.active is true
        and student_membership.role = 'STUDENT'::public.user_role
        and professional.active is true
        and professional.verification_status = 'VERIFIED'
        and professional_link.active is true
        and professional_membership.active is true
        and professional_membership.role = 'PSYCHOLOGIST'::public.user_role
    );
$$;

create or replace function private.psychology_professional_has_student_access(
  target_institution_id uuid,
  target_student_id uuid
)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_current_profile_active()
    and private.psychology_module_is_enabled(target_institution_id)
    and exists (
      select 1
      from public.psychology_assignments assignment
      join public.students student
        on student.id = assignment.student_id
       and student.institution_id = assignment.institution_id
      join public.memberships student_membership
        on student_membership.profile_id = student.profile_id
       and student_membership.institution_id = assignment.institution_id
      join public.psychology_authorizations authorization
        on authorization.institution_id = assignment.institution_id
       and authorization.student_id = student.id
       and authorization.status = 'ACTIVE'
      join public.psychology_professionals professional
        on professional.profile_id = assignment.professional_profile_id
      join public.psychology_professional_institutions professional_link
        on professional_link.professional_profile_id = professional.profile_id
       and professional_link.institution_id = assignment.institution_id
      join public.memberships professional_membership
        on professional_membership.profile_id = professional.profile_id
       and professional_membership.institution_id = assignment.institution_id
      where assignment.institution_id = target_institution_id
        and assignment.student_id = target_student_id
        and assignment.professional_profile_id = auth.uid()
        and assignment.active is true
        and assignment.starts_on <= current_date
        and (assignment.ends_on is null or assignment.ends_on >= current_date)
        and student.active is true
        and student_membership.active is true
        and student_membership.role = 'STUDENT'::public.user_role
        and private.psychology_professional_is_eligible(target_institution_id, auth.uid())
    );
$$;

create or replace function private.psychology_can_access_appointment(target_appointment_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.psychology_appointments appointment
    join public.students student on student.id = appointment.student_id
    where appointment.id = target_appointment_id
      and private.psychology_module_is_enabled(appointment.institution_id)
      and (
        (student.profile_id = auth.uid()
          and private.psychology_student_is_assigned(appointment.institution_id, appointment.student_id))
        or (appointment.professional_profile_id = auth.uid()
          and private.psychology_professional_has_student_access(
            appointment.institution_id, appointment.student_id))
      )
  );
$$;

create or replace function private.psychology_can_access_session(target_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.psychology_sessions session
    join public.psychology_appointments appointment on appointment.id = session.appointment_id
    where session.id = target_session_id
      and private.psychology_can_access_appointment(appointment.id)
  );
$$;

create or replace function private.psychology_can_access_note(target_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.psychology_sessions session
    join public.psychology_appointments appointment on appointment.id = session.appointment_id
    where session.id = target_session_id
      and appointment.professional_profile_id = auth.uid()
      and private.psychology_module_is_enabled(appointment.institution_id)
      and private.psychology_professional_has_student_access(
        appointment.institution_id, appointment.student_id)
  );
$$;

revoke all on function private.psychology_module_is_enabled(uuid) from public, anon, authenticated;
revoke all on function private.psychology_is_manager(uuid) from public, anon, authenticated;
revoke all on function private.psychology_professional_is_eligible(uuid, uuid) from public, anon, authenticated;
revoke all on function private.psychology_is_professional(uuid) from public, anon, authenticated;
revoke all on function private.psychology_student_is_assigned(uuid, uuid) from public, anon, authenticated;
revoke all on function private.psychology_professional_has_student_access(uuid, uuid) from public, anon, authenticated;
revoke all on function private.psychology_can_access_appointment(uuid) from public, anon, authenticated;
revoke all on function private.psychology_can_access_session(uuid) from public, anon, authenticated;
revoke all on function private.psychology_can_access_note(uuid) from public, anon, authenticated;
grant execute on function private.psychology_module_is_enabled(uuid) to service_role;
grant execute on function private.psychology_is_manager(uuid) to authenticated, service_role;
grant execute on function private.psychology_is_professional(uuid) to authenticated, service_role;
grant execute on function private.psychology_student_is_assigned(uuid, uuid) to authenticated, service_role;
grant execute on function private.psychology_professional_has_student_access(uuid, uuid) to authenticated, service_role;
grant execute on function private.psychology_can_access_appointment(uuid) to authenticated, service_role;
grant execute on function private.psychology_can_access_session(uuid) to authenticated, service_role;
grant execute on function private.psychology_can_access_note(uuid) to authenticated, service_role;

alter table public.psychology_module_settings enable row level security;
alter table public.psychology_professionals enable row level security;
alter table public.psychology_professional_institutions enable row level security;
alter table public.psychology_assignments enable row level security;
alter table public.psychology_authorizations enable row level security;
alter table public.psychology_availability_rules enable row level security;
alter table public.psychology_availability_exceptions enable row level security;
alter table public.psychology_appointments enable row level security;
alter table public.psychology_appointment_events enable row level security;
alter table public.psychology_sessions enable row level security;
alter table public.psychology_messages enable row level security;
alter table public.psychology_notes enable row level security;
alter table public.psychology_note_versions enable row level security;
alter table public.psychology_audit_events enable row level security;

create policy psychology_professionals_select on public.psychology_professionals
  for select to authenticated using (
    profile_id = (select auth.uid())
    or exists (select 1 from public.psychology_professional_institutions link
      where link.professional_profile_id = profile_id and private.psychology_is_manager(link.institution_id))
  );
create policy psychology_professional_institutions_select on public.psychology_professional_institutions
  for select to authenticated using (
    professional_profile_id = (select auth.uid())
    or private.psychology_is_manager(institution_id)
  );
create policy psychology_assignments_select on public.psychology_assignments
  for select to authenticated using (
    private.psychology_is_manager(institution_id)
    or (professional_profile_id = (select auth.uid())
      and private.psychology_professional_has_student_access(institution_id, student_id))
    or exists (select 1 from public.students student
      where student.id = student_id and student.profile_id = (select auth.uid())
        and private.psychology_student_is_assigned(institution_id, student_id))
  );
create policy psychology_authorizations_select on public.psychology_authorizations
  for select to authenticated using (
    signatory_profile_id = (select auth.uid())
    or exists (select 1 from public.students student where student.id = student_id and student.profile_id = (select auth.uid()))
    or exists (select 1 from public.psychology_assignments assignment
      where assignment.institution_id = institution_id and assignment.student_id = student_id
        and assignment.professional_profile_id = (select auth.uid())
        and private.psychology_professional_has_student_access(institution_id, student_id))
  );
create policy psychology_availability_rules_select on public.psychology_availability_rules
  for select to authenticated using (
    professional_profile_id = (select auth.uid())
      and private.psychology_is_professional(institution_id)
    or private.psychology_is_manager(institution_id)
  );
create policy psychology_availability_exceptions_select on public.psychology_availability_exceptions
  for select to authenticated using (
    professional_profile_id = (select auth.uid())
      and private.psychology_is_professional(institution_id)
    or private.psychology_is_manager(institution_id)
  );
create policy psychology_appointments_select on public.psychology_appointments
  for select to authenticated using (private.psychology_can_access_appointment(id));
create policy psychology_appointment_events_select on public.psychology_appointment_events
  for select to authenticated using (
    exists (select 1 from public.psychology_appointments appointment
      where appointment.id = appointment_id and private.psychology_can_access_appointment(appointment.id))
  );
create policy psychology_sessions_select on public.psychology_sessions
  for select to authenticated using (private.psychology_can_access_session(id));
create policy psychology_messages_select on public.psychology_messages
  for select to authenticated using (private.psychology_can_access_session(session_id));
create policy psychology_notes_select on public.psychology_notes
  for select to authenticated using (
    author_profile_id = (select auth.uid())
    and private.psychology_can_access_note(session_id)
  );
create policy psychology_note_versions_select on public.psychology_note_versions
  for select to authenticated using (
    exists (select 1 from public.psychology_notes note
      where note.id = note_id and note.author_profile_id = (select auth.uid())
        and private.psychology_can_access_note(note.session_id))
  );
create policy psychology_audit_events_select on public.psychology_audit_events
  for select to authenticated using (private.psychology_is_manager(institution_id));

revoke all on public.psychology_module_settings, public.psychology_professionals,
  public.psychology_professional_institutions, public.psychology_assignments,
  public.psychology_authorizations, public.psychology_availability_rules,
  public.psychology_availability_exceptions, public.psychology_appointments,
  public.psychology_appointment_events, public.psychology_sessions,
  public.psychology_messages, public.psychology_notes,
  public.psychology_note_versions, public.psychology_audit_events
  from public, anon, authenticated;
grant select on public.psychology_professionals, public.psychology_professional_institutions,
  public.psychology_assignments, public.psychology_authorizations,
  public.psychology_availability_rules, public.psychology_availability_exceptions,
  public.psychology_appointments, public.psychology_appointment_events,
  public.psychology_sessions, public.psychology_messages,
  public.psychology_notes, public.psychology_note_versions
  to authenticated;
grant all on public.psychology_module_settings, public.psychology_professionals,
  public.psychology_professional_institutions, public.psychology_assignments,
  public.psychology_authorizations, public.psychology_availability_rules,
  public.psychology_availability_exceptions, public.psychology_appointments,
  public.psychology_appointment_events, public.psychology_sessions,
  public.psychology_messages, public.psychology_notes,
  public.psychology_note_versions, public.psychology_audit_events
  to service_role;

commit;
