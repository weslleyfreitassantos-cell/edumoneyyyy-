-- Consolidates attendance integrity and access for the end-to-end flow.
--
-- Do not apply remotely until the hosted migration history is reconciled.

begin;

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

do $$
begin
  if exists (
    select 1
    from public.attendance_sessions as attendance_session
    where attendance_session.status <> 'CANCELED'
    group by
      attendance_session.subject_offering_id,
      attendance_session.session_date
    having count(*) > 1
  ) then
    raise exception
      'Existing duplicate attendance sessions must be consolidated before enforcing one active session per offering/date.'
      using errcode = '23505';
  end if;
end;
$$;

create unique index if not exists
  attendance_sessions_offering_date_active_unique_idx
  on public.attendance_sessions (
    subject_offering_id,
    session_date
  )
  where status <> 'CANCELED';

create or replace function private.can_view_attendance_institution(
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_manage_institution_operations(
    target_institution_id
  );
$$;

create or replace function private.is_student_enrolled_for_attendance_session(
  target_student_id uuid,
  target_session_id uuid,
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
    from public.attendance_sessions as attendance_session
    join public.subject_offerings as offering
      on offering.id = attendance_session.subject_offering_id
    join public.enrollments as enrollment
      on enrollment.class_id = offering.class_id
    join public.students as student
      on student.id = enrollment.student_id
    where attendance_session.id = target_session_id
      and attendance_session.institution_id = target_institution_id
      and student.id = target_student_id
      and student.institution_id = target_institution_id
      and offering.active is true
      and student.active is true
      and enrollment.enrolled_at <= (
        attendance_session.session_date::timestamp
        + interval '1 day'
      )::timestamptz
      and (
        (
          enrollment.active is true
          and upper(enrollment.status) = 'ACTIVE'
        )
        or exists (
          select 1
          from public.attendance_records as existing_record
          where existing_record.attendance_session_id =
            target_session_id
            and existing_record.student_id =
              target_student_id
        )
      )
  );
$$;

create or replace function private.can_student_view_attendance(
  target_student_id uuid,
  target_session_id uuid,
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_student_owner(
      target_student_id,
      target_institution_id
    )
    and exists (
      select 1
      from public.attendance_sessions as attendance_session
      where attendance_session.id = target_session_id
        and attendance_session.institution_id =
          target_institution_id
        and attendance_session.status = 'CLOSED'
    )
    and exists (
      select 1
      from public.attendance_records as attendance_record
      where attendance_record.attendance_session_id =
        target_session_id
        and attendance_record.student_id = target_student_id
        and attendance_record.institution_id =
          target_institution_id
    );
$$;

create or replace function private.can_student_view_attendance_session(
  target_session_id uuid,
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
    from public.attendance_records as attendance_record
    where attendance_record.attendance_session_id =
      target_session_id
      and attendance_record.institution_id =
        target_institution_id
      and private.can_student_view_attendance(
        attendance_record.student_id,
        target_session_id,
        target_institution_id
      )
  );
$$;

create or replace function private.can_guardian_view_attendance(
  target_student_id uuid,
  target_session_id uuid,
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
    join public.attendance_sessions as attendance_session
      on attendance_session.id = target_session_id
    where guardianship.student_id = target_student_id
      and guardianship.guardian_profile_id = auth.uid()
      and guardianship.active is true
      and student.institution_id = target_institution_id
      and attendance_session.institution_id =
        target_institution_id
      and attendance_session.status = 'CLOSED'
      and exists (
        select 1
        from public.attendance_records as attendance_record
        where attendance_record.attendance_session_id =
          target_session_id
          and attendance_record.student_id = target_student_id
          and attendance_record.institution_id =
            target_institution_id
      )
  );
$$;

create or replace function private.can_guardian_view_attendance_session(
  target_session_id uuid,
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
    from public.attendance_records as attendance_record
    where attendance_record.attendance_session_id =
      target_session_id
      and attendance_record.institution_id =
        target_institution_id
      and private.can_guardian_view_attendance(
        attendance_record.student_id,
        target_session_id,
        target_institution_id
      )
  );
$$;

alter function private.can_view_attendance_institution(uuid)
  owner to postgres;

alter function
  private.is_student_enrolled_for_attendance_session(uuid, uuid, uuid)
  owner to postgres;

alter function private.can_student_view_attendance(uuid, uuid, uuid)
  owner to postgres;

alter function private.can_student_view_attendance_session(uuid, uuid)
  owner to postgres;

alter function private.can_guardian_view_attendance(uuid, uuid, uuid)
  owner to postgres;

alter function private.can_guardian_view_attendance_session(uuid, uuid)
  owner to postgres;

revoke all on function private.can_view_attendance_institution(uuid)
  from public, anon, authenticated;

revoke all on function
  private.is_student_enrolled_for_attendance_session(uuid, uuid, uuid)
  from public, anon, authenticated;

revoke all on function private.can_student_view_attendance(uuid, uuid, uuid)
  from public, anon, authenticated;

revoke all on function private.can_student_view_attendance_session(uuid, uuid)
  from public, anon, authenticated;

revoke all on function private.can_guardian_view_attendance(uuid, uuid, uuid)
  from public, anon, authenticated;

revoke all on function private.can_guardian_view_attendance_session(uuid, uuid)
  from public, anon, authenticated;

grant execute on function private.can_view_attendance_institution(uuid)
  to authenticated, service_role;

grant execute on function
  private.is_student_enrolled_for_attendance_session(uuid, uuid, uuid)
  to authenticated, service_role;

grant execute on function private.can_student_view_attendance(uuid, uuid, uuid)
  to authenticated, service_role;

grant execute on function private.can_student_view_attendance_session(uuid, uuid)
  to authenticated, service_role;

grant execute on function private.can_guardian_view_attendance(uuid, uuid, uuid)
  to authenticated, service_role;

grant execute on function private.can_guardian_view_attendance_session(uuid, uuid)
  to authenticated, service_role;

revoke delete on table public.attendance_sessions
  from authenticated;

revoke delete on table public.attendance_records
  from authenticated;

grant select, insert, update
  on table public.attendance_sessions
  to authenticated;

grant select, insert, update
  on table public.attendance_records
  to authenticated;

drop policy if exists attendance_sessions_select_policy
  on public.attendance_sessions;

create policy attendance_sessions_select_policy
on public.attendance_sessions
for select
to authenticated
using (
  private.can_view_attendance_institution(institution_id)
  or private.is_teacher_for_offering(
    subject_offering_id,
    institution_id
  )
  or (
    status = 'CLOSED'
    and (
      private.can_student_view_attendance_session(
        id,
        institution_id
      )
      or private.can_guardian_view_attendance_session(
        id,
        institution_id
      )
    )
  )
);

drop policy if exists attendance_records_select_policy
  on public.attendance_records;

create policy attendance_records_select_policy
on public.attendance_records
for select
to authenticated
using (
  private.can_view_attendance_institution(institution_id)
  or private.can_manage_attendance_session(
    attendance_session_id,
    institution_id
  )
  or private.can_student_view_attendance(
    student_id,
    attendance_session_id,
    institution_id
  )
  or private.can_guardian_view_attendance(
    student_id,
    attendance_session_id,
    institution_id
  )
);

drop policy if exists attendance_sessions_delete_policy
  on public.attendance_sessions;

drop policy if exists attendance_records_delete_policy
  on public.attendance_records;

commit;
