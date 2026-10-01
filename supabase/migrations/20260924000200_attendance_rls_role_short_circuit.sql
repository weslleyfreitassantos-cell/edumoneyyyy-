begin;

-- Attendance reads share permissive policies for students and guardians. The
-- old helpers entered the other role's correlated attendance-record scan even
-- when auth.uid() could not have that role. Short-circuit by the exact active
-- institution role before evaluating the expensive branch.
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
  select case
    when not private.has_exact_institution_role(
      target_institution_id,
      array['STUDENT'::public.user_role]
    ) then false
    else
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
      )
  end;
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
  select case
    when not private.has_exact_institution_role(
      target_institution_id,
      array['STUDENT'::public.user_role]
    ) then false
    else exists (
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
    )
  end;
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
  select case
    when not private.has_exact_institution_role(
      target_institution_id,
      array['GUARDIAN'::public.user_role]
    ) then false
    else
      private.is_current_profile_active()
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
      )
  end;
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
  select case
    when not private.has_exact_institution_role(
      target_institution_id,
      array['GUARDIAN'::public.user_role]
    ) then false
    else exists (
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
    )
  end;
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

notify pgrst, 'reload schema';

commit;
