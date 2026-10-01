begin;

-- Role branches in the attendance policies are mutually exclusive for most
-- requests. Evaluate the current profile's active role once per statement so
-- a student request never scans guardian records row by row (and vice versa).
create or replace function private.current_profile_has_role(
  target_role public.user_role
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
      from public.memberships as membership
      where membership.profile_id = (select auth.uid())
        and membership.role = target_role
        and membership.active is true
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
  select
    private.is_current_profile_active()
    and private.has_exact_institution_role(
      target_institution_id,
      array['GUARDIAN'::public.user_role]
    )
    and exists (
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

alter function private.current_profile_has_role(public.user_role)
  owner to postgres;
alter function private.can_student_view_attendance(uuid, uuid, uuid)
  owner to postgres;
alter function private.can_student_view_attendance_session(uuid, uuid)
  owner to postgres;
alter function private.can_guardian_view_attendance(uuid, uuid, uuid)
  owner to postgres;
alter function private.can_guardian_view_attendance_session(uuid, uuid)
  owner to postgres;

revoke all on function private.current_profile_has_role(public.user_role)
  from public, anon, authenticated;
grant execute on function private.current_profile_has_role(public.user_role)
  to authenticated, service_role;

revoke all on function private.can_student_view_attendance(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.can_student_view_attendance_session(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.can_guardian_view_attendance(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.can_guardian_view_attendance_session(uuid, uuid)
  from public, anon, authenticated;

grant execute on function private.can_student_view_attendance(uuid, uuid, uuid)
  to authenticated, service_role;
grant execute on function private.can_student_view_attendance_session(uuid, uuid)
  to authenticated, service_role;
grant execute on function private.can_guardian_view_attendance(uuid, uuid, uuid)
  to authenticated, service_role;
grant execute on function private.can_guardian_view_attendance_session(uuid, uuid)
  to authenticated, service_role;

drop policy if exists attendance_sessions_select_policy
  on public.attendance_sessions;
create policy attendance_sessions_select_policy
on public.attendance_sessions
for select
to authenticated
using (
  private.can_view_attendance_institution(institution_id)
  or private.is_teacher_for_offering(subject_offering_id, institution_id)
  or (
    status = 'CLOSED'
    and (
      (
        (select private.current_profile_has_role(
          'STUDENT'::public.user_role
        ))
        and private.can_student_view_attendance_session(
          id,
          institution_id
        )
      )
      or (
        (select private.current_profile_has_role(
          'GUARDIAN'::public.user_role
        ))
        and private.can_guardian_view_attendance_session(
          id,
          institution_id
        )
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
  or (
    (select private.current_profile_has_role(
      'STUDENT'::public.user_role
    ))
    and private.can_student_view_attendance(
      student_id,
      attendance_session_id,
      institution_id
    )
  )
  or (
    (select private.current_profile_has_role(
      'GUARDIAN'::public.user_role
    ))
    and private.can_guardian_view_attendance(
      student_id,
      attendance_session_id,
      institution_id
    )
  )
);

notify pgrst, 'reload schema';

commit;
