begin;

-- Keep the same authorization boundaries while avoiding nested helper calls for
-- every attendance row. The indexed identity, membership, session, and record
-- joins let PostgreSQL evaluate the proof directly.
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
    private.is_current_profile_active()
    and public.is_institution_operational(target_institution_id)
    and exists (
      select 1
      from public.students as student
      join public.memberships as membership
        on membership.profile_id = student.profile_id
       and membership.institution_id = student.institution_id
       and membership.active is true
       and membership.role = 'STUDENT'::public.user_role
      join public.attendance_records as attendance_record
        on attendance_record.student_id = student.id
       and attendance_record.attendance_session_id = target_session_id
       and attendance_record.institution_id = target_institution_id
      join public.attendance_sessions as attendance_session
        on attendance_session.id = attendance_record.attendance_session_id
       and attendance_session.institution_id = target_institution_id
       and attendance_session.status = 'CLOSED'
      where student.id = target_student_id
        and student.profile_id = (select auth.uid())
        and student.institution_id = target_institution_id
        and student.active is true
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
  select
    private.is_current_profile_active()
    and public.is_institution_operational(target_institution_id)
    and exists (
      select 1
      from public.students as student
      join public.memberships as membership
        on membership.profile_id = student.profile_id
       and membership.institution_id = student.institution_id
       and membership.active is true
       and membership.role = 'STUDENT'::public.user_role
      join public.attendance_records as attendance_record
        on attendance_record.student_id = student.id
       and attendance_record.attendance_session_id = target_session_id
       and attendance_record.institution_id = target_institution_id
      join public.attendance_sessions as attendance_session
        on attendance_session.id = attendance_record.attendance_session_id
       and attendance_session.institution_id = target_institution_id
       and attendance_session.status = 'CLOSED'
      where student.profile_id = (select auth.uid())
        and student.institution_id = target_institution_id
        and student.active is true
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
       and student.institution_id = target_institution_id
      join public.attendance_records as attendance_record
        on attendance_record.student_id = student.id
       and attendance_record.attendance_session_id = target_session_id
       and attendance_record.institution_id = target_institution_id
      join public.attendance_sessions as attendance_session
        on attendance_session.id = attendance_record.attendance_session_id
       and attendance_session.institution_id = target_institution_id
       and attendance_session.status = 'CLOSED'
      where guardianship.student_id = target_student_id
        and guardianship.guardian_profile_id = (select auth.uid())
        and guardianship.active is true
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
       and student.institution_id = target_institution_id
      join public.attendance_records as attendance_record
        on attendance_record.student_id = student.id
       and attendance_record.attendance_session_id = target_session_id
       and attendance_record.institution_id = target_institution_id
      join public.attendance_sessions as attendance_session
        on attendance_session.id = attendance_record.attendance_session_id
       and attendance_session.institution_id = target_institution_id
       and attendance_session.status = 'CLOSED'
      where guardianship.guardian_profile_id = (select auth.uid())
        and guardianship.active is true
    );
$$;

alter function private.can_student_view_attendance(uuid, uuid, uuid)
  owner to postgres;
alter function private.can_student_view_attendance_session(uuid, uuid)
  owner to postgres;
alter function private.can_guardian_view_attendance(uuid, uuid, uuid)
  owner to postgres;
alter function private.can_guardian_view_attendance_session(uuid, uuid)
  owner to postgres;

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
      case
        when (select private.current_profile_has_role(
          'STUDENT'::public.user_role
        )) then private.can_student_view_attendance_session(
          id,
          institution_id
        )
        else false
      end
      or case
        when (select private.current_profile_has_role(
          'GUARDIAN'::public.user_role
        )) then private.can_guardian_view_attendance_session(
          id,
          institution_id
        )
        else false
      end
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
  or case
    when (select private.current_profile_has_role(
      'STUDENT'::public.user_role
    )) then private.can_student_view_attendance(
      student_id,
      attendance_session_id,
      institution_id
    )
    else false
  end
  or case
    when (select private.current_profile_has_role(
      'GUARDIAN'::public.user_role
    )) then private.can_guardian_view_attendance(
      student_id,
      attendance_session_id,
      institution_id
    )
    else false
  end
);

notify pgrst, 'reload schema';

commit;
