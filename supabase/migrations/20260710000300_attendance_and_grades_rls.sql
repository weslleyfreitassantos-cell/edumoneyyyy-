-- Políticas de segurança para avaliações, notas e frequência.
--
-- Pré-requisito:
--   20260710000200_attendance_and_grades.sql
--
-- Esta migration deve ser revisada antes de qualquer aplicação remota.
-- NÃO executar `supabase db push` no projeto remoto atual enquanto o
-- histórico de migrations não estiver reconciliado.

begin;

-- ============================================================
-- Funções auxiliares privadas
-- ============================================================

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.has_institution_role(
  target_institution_id uuid,
  allowed_roles public.user_role[]
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
    where membership.profile_id = auth.uid()
      and membership.institution_id = target_institution_id
      and membership.active is true
      and membership.role = any (allowed_roles)
  );
$$;

create or replace function private.is_admin_or_director(
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_institution_role(
    target_institution_id,
    array[
      'ADMIN'::public.user_role,
      'DIRECTOR'::public.user_role
    ]
  );
$$;

create or replace function private.offering_belongs_to_institution(
  target_offering_id uuid,
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
    from public.subject_offerings as offering
    join public.classes as class
      on class.id = offering.class_id
    join public.subjects as subject
      on subject.id = offering.subject_id
    where offering.id = target_offering_id
      and class.institution_id = target_institution_id
      and subject.institution_id = target_institution_id
  );
$$;

create or replace function private.is_teacher_for_offering(
  target_offering_id uuid,
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
    from public.subject_offerings as offering
    join public.classes as class
      on class.id = offering.class_id
    join public.subjects as subject
      on subject.id = offering.subject_id
    join public.memberships as membership
      on membership.profile_id = auth.uid()
     and membership.institution_id = class.institution_id
    where offering.id = target_offering_id
      and offering.teacher_profile_id = auth.uid()
      and offering.active is true
      and class.active is true
      and subject.active is true
      and class.institution_id = target_institution_id
      and subject.institution_id = target_institution_id
      and membership.active is true
      and membership.role = 'TEACHER'::public.user_role
  );
$$;

create or replace function private.is_student_owner(
  target_student_id uuid,
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
    join public.memberships as membership
      on membership.profile_id = student.profile_id
     and membership.institution_id = student.institution_id
    where student.id = target_student_id
      and student.profile_id = auth.uid()
      and student.institution_id = target_institution_id
      and student.active is true
      and membership.active is true
      and membership.role = 'STUDENT'::public.user_role
  );
$$;

create or replace function private.is_student_enrolled_in_offering(
  target_offering_id uuid,
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
    from public.subject_offerings as offering
    join public.classes as class
      on class.id = offering.class_id
    join public.enrollments as enrollment
      on enrollment.class_id = class.id
    join public.students as student
      on student.id = enrollment.student_id
    join public.memberships as membership
      on membership.profile_id = student.profile_id
     and membership.institution_id = student.institution_id
    where offering.id = target_offering_id
      and class.institution_id = target_institution_id
      and student.institution_id = target_institution_id
      and student.profile_id = auth.uid()
      and offering.active is true
      and class.active is true
      and enrollment.active is true
      and student.active is true
      and membership.active is true
      and membership.role = 'STUDENT'::public.user_role
  );
$$;

create or replace function private.assessment_belongs_to_institution(
  target_assessment_id uuid,
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
    from public.assessments as assessment
    where assessment.id = target_assessment_id
      and assessment.institution_id = target_institution_id
      and private.offering_belongs_to_institution(
        assessment.subject_offering_id,
        target_institution_id
      )
  );
$$;

create or replace function private.can_manage_assessment(
  target_assessment_id uuid,
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.assessment_belongs_to_institution(
      target_assessment_id,
      target_institution_id
    )
    and (
      private.is_admin_or_director(
        target_institution_id
      )
      or exists (
        select 1
        from public.assessments as assessment
        where assessment.id = target_assessment_id
          and assessment.institution_id = target_institution_id
          and private.is_teacher_for_offering(
            assessment.subject_offering_id,
            target_institution_id
          )
      )
    );
$$;

create or replace function private.is_student_enrolled_for_assessment(
  target_student_id uuid,
  target_assessment_id uuid,
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
    from public.assessments as assessment
    join public.subject_offerings as offering
      on offering.id = assessment.subject_offering_id
    join public.enrollments as enrollment
      on enrollment.class_id = offering.class_id
    join public.students as student
      on student.id = enrollment.student_id
    where assessment.id = target_assessment_id
      and assessment.institution_id = target_institution_id
      and student.id = target_student_id
      and student.institution_id = target_institution_id
      and offering.active is true
      and enrollment.active is true
      and student.active is true
  );
$$;

create or replace function private.can_student_view_grade(
  target_student_id uuid,
  target_assessment_id uuid,
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
      from public.assessments as assessment
      where assessment.id = target_assessment_id
        and assessment.institution_id = target_institution_id
        and assessment.status in ('PUBLISHED', 'CLOSED')
        and private.is_student_enrolled_in_offering(
          assessment.subject_offering_id,
          target_institution_id
        )
    );
$$;

create or replace function private.attendance_session_belongs_to_institution(
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
    where attendance_session.id = target_session_id
      and attendance_session.institution_id = target_institution_id
      and private.offering_belongs_to_institution(
        attendance_session.subject_offering_id,
        target_institution_id
      )
  );
$$;

create or replace function private.can_manage_attendance_session(
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
    private.attendance_session_belongs_to_institution(
      target_session_id,
      target_institution_id
    )
    and (
      private.is_admin_or_director(
        target_institution_id
      )
      or exists (
        select 1
        from public.attendance_sessions as attendance_session
        where attendance_session.id = target_session_id
          and attendance_session.institution_id = target_institution_id
          and private.is_teacher_for_offering(
            attendance_session.subject_offering_id,
            target_institution_id
          )
      )
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
      and enrollment.active is true
      and student.active is true
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
        and attendance_session.institution_id = target_institution_id
        and attendance_session.status = 'CLOSED'
        and private.is_student_enrolled_in_offering(
          attendance_session.subject_offering_id,
          target_institution_id
        )
    );
$$;

-- ============================================================
-- Permissões das funções
-- ============================================================

revoke all on function
  private.has_institution_role(uuid, public.user_role[])
  from public, anon, authenticated;

revoke all on function
  private.is_admin_or_director(uuid)
  from public, anon, authenticated;

revoke all on function
  private.offering_belongs_to_institution(uuid, uuid)
  from public, anon, authenticated;

revoke all on function
  private.is_teacher_for_offering(uuid, uuid)
  from public, anon, authenticated;

revoke all on function
  private.is_student_owner(uuid, uuid)
  from public, anon, authenticated;

revoke all on function
  private.is_student_enrolled_in_offering(uuid, uuid)
  from public, anon, authenticated;

revoke all on function
  private.assessment_belongs_to_institution(uuid, uuid)
  from public, anon, authenticated;

revoke all on function
  private.can_manage_assessment(uuid, uuid)
  from public, anon, authenticated;

revoke all on function
  private.is_student_enrolled_for_assessment(uuid, uuid, uuid)
  from public, anon, authenticated;

revoke all on function
  private.can_student_view_grade(uuid, uuid, uuid)
  from public, anon, authenticated;

revoke all on function
  private.attendance_session_belongs_to_institution(uuid, uuid)
  from public, anon, authenticated;

revoke all on function
  private.can_manage_attendance_session(uuid, uuid)
  from public, anon, authenticated;

revoke all on function
  private.is_student_enrolled_for_attendance_session(uuid, uuid, uuid)
  from public, anon, authenticated;

revoke all on function
  private.can_student_view_attendance(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function
  private.has_institution_role(uuid, public.user_role[])
  to authenticated, service_role;

grant execute on function
  private.is_admin_or_director(uuid)
  to authenticated, service_role;

grant execute on function
  private.offering_belongs_to_institution(uuid, uuid)
  to authenticated, service_role;

grant execute on function
  private.is_teacher_for_offering(uuid, uuid)
  to authenticated, service_role;

grant execute on function
  private.is_student_owner(uuid, uuid)
  to authenticated, service_role;

grant execute on function
  private.is_student_enrolled_in_offering(uuid, uuid)
  to authenticated, service_role;

grant execute on function
  private.assessment_belongs_to_institution(uuid, uuid)
  to authenticated, service_role;

grant execute on function
  private.can_manage_assessment(uuid, uuid)
  to authenticated, service_role;

grant execute on function
  private.is_student_enrolled_for_assessment(uuid, uuid, uuid)
  to authenticated, service_role;

grant execute on function
  private.can_student_view_grade(uuid, uuid, uuid)
  to authenticated, service_role;

grant execute on function
  private.attendance_session_belongs_to_institution(uuid, uuid)
  to authenticated, service_role;

grant execute on function
  private.can_manage_attendance_session(uuid, uuid)
  to authenticated, service_role;

grant execute on function
  private.is_student_enrolled_for_attendance_session(uuid, uuid, uuid)
  to authenticated, service_role;

grant execute on function
  private.can_student_view_attendance(uuid, uuid, uuid)
  to authenticated, service_role;

-- ============================================================
-- Permissões das tabelas
-- ============================================================

revoke all on table public.assessments
  from anon, authenticated;

revoke all on table public.grades
  from anon, authenticated;

revoke all on table public.attendance_sessions
  from anon, authenticated;

revoke all on table public.attendance_records
  from anon, authenticated;

grant select, insert, update, delete
  on table public.assessments
  to authenticated;

grant select, insert, update, delete
  on table public.grades
  to authenticated;

grant select, insert, update, delete
  on table public.attendance_sessions
  to authenticated;

grant select, insert, update, delete
  on table public.attendance_records
  to authenticated;

-- ============================================================
-- Assessments
-- ============================================================

drop policy if exists
  assessments_select_policy
  on public.assessments;

create policy assessments_select_policy
on public.assessments
for select
to authenticated
using (
  private.is_admin_or_director(
    institution_id
  )
  or private.is_teacher_for_offering(
    subject_offering_id,
    institution_id
  )
  or (
    status in ('PUBLISHED', 'CLOSED')
    and private.is_student_enrolled_in_offering(
      subject_offering_id,
      institution_id
    )
  )
);

drop policy if exists
  assessments_insert_policy
  on public.assessments;

create policy assessments_insert_policy
on public.assessments
for insert
to authenticated
with check (
  private.offering_belongs_to_institution(
    subject_offering_id,
    institution_id
  )
  and (
    private.is_admin_or_director(
      institution_id
    )
    or (
      private.is_teacher_for_offering(
        subject_offering_id,
        institution_id
      )
      and created_by = auth.uid()
    )
  )
);

drop policy if exists
  assessments_update_policy
  on public.assessments;

create policy assessments_update_policy
on public.assessments
for update
to authenticated
using (
  private.is_admin_or_director(
    institution_id
  )
  or private.is_teacher_for_offering(
    subject_offering_id,
    institution_id
  )
)
with check (
  private.offering_belongs_to_institution(
    subject_offering_id,
    institution_id
  )
  and (
    private.is_admin_or_director(
      institution_id
    )
    or (
      private.is_teacher_for_offering(
        subject_offering_id,
        institution_id
      )
      and created_by = auth.uid()
    )
  )
);

drop policy if exists
  assessments_delete_policy
  on public.assessments;

create policy assessments_delete_policy
on public.assessments
for delete
to authenticated
using (
  private.is_admin_or_director(
    institution_id
  )
  or private.is_teacher_for_offering(
    subject_offering_id,
    institution_id
  )
);

-- ============================================================
-- Grades
-- ============================================================

drop policy if exists
  grades_select_policy
  on public.grades;

create policy grades_select_policy
on public.grades
for select
to authenticated
using (
  private.is_admin_or_director(
    institution_id
  )
  or private.can_manage_assessment(
    assessment_id,
    institution_id
  )
  or private.can_student_view_grade(
    student_id,
    assessment_id,
    institution_id
  )
);

drop policy if exists
  grades_insert_policy
  on public.grades;

create policy grades_insert_policy
on public.grades
for insert
to authenticated
with check (
  private.can_manage_assessment(
    assessment_id,
    institution_id
  )
  and private.is_student_enrolled_for_assessment(
    student_id,
    assessment_id,
    institution_id
  )
  and (
    private.is_admin_or_director(
      institution_id
    )
    or recorded_by = auth.uid()
  )
);

drop policy if exists
  grades_update_policy
  on public.grades;

create policy grades_update_policy
on public.grades
for update
to authenticated
using (
  private.can_manage_assessment(
    assessment_id,
    institution_id
  )
)
with check (
  private.can_manage_assessment(
    assessment_id,
    institution_id
  )
  and private.is_student_enrolled_for_assessment(
    student_id,
    assessment_id,
    institution_id
  )
  and (
    private.is_admin_or_director(
      institution_id
    )
    or recorded_by = auth.uid()
  )
);

drop policy if exists
  grades_delete_policy
  on public.grades;

create policy grades_delete_policy
on public.grades
for delete
to authenticated
using (
  private.can_manage_assessment(
    assessment_id,
    institution_id
  )
);

-- ============================================================
-- Attendance sessions
-- ============================================================

drop policy if exists
  attendance_sessions_select_policy
  on public.attendance_sessions;

create policy attendance_sessions_select_policy
on public.attendance_sessions
for select
to authenticated
using (
  private.is_admin_or_director(
    institution_id
  )
  or private.is_teacher_for_offering(
    subject_offering_id,
    institution_id
  )
  or (
    status = 'CLOSED'
    and private.is_student_enrolled_in_offering(
      subject_offering_id,
      institution_id
    )
  )
);

drop policy if exists
  attendance_sessions_insert_policy
  on public.attendance_sessions;

create policy attendance_sessions_insert_policy
on public.attendance_sessions
for insert
to authenticated
with check (
  private.offering_belongs_to_institution(
    subject_offering_id,
    institution_id
  )
  and (
    private.is_admin_or_director(
      institution_id
    )
    or (
      private.is_teacher_for_offering(
        subject_offering_id,
        institution_id
      )
      and created_by = auth.uid()
    )
  )
);

drop policy if exists
  attendance_sessions_update_policy
  on public.attendance_sessions;

create policy attendance_sessions_update_policy
on public.attendance_sessions
for update
to authenticated
using (
  private.is_admin_or_director(
    institution_id
  )
  or private.is_teacher_for_offering(
    subject_offering_id,
    institution_id
  )
)
with check (
  private.offering_belongs_to_institution(
    subject_offering_id,
    institution_id
  )
  and (
    private.is_admin_or_director(
      institution_id
    )
    or (
      private.is_teacher_for_offering(
        subject_offering_id,
        institution_id
      )
      and created_by = auth.uid()
    )
  )
);

drop policy if exists
  attendance_sessions_delete_policy
  on public.attendance_sessions;

create policy attendance_sessions_delete_policy
on public.attendance_sessions
for delete
to authenticated
using (
  private.is_admin_or_director(
    institution_id
  )
  or private.is_teacher_for_offering(
    subject_offering_id,
    institution_id
  )
);

-- ============================================================
-- Attendance records
-- ============================================================

drop policy if exists
  attendance_records_select_policy
  on public.attendance_records;

create policy attendance_records_select_policy
on public.attendance_records
for select
to authenticated
using (
  private.is_admin_or_director(
    institution_id
  )
  or private.can_manage_attendance_session(
    attendance_session_id,
    institution_id
  )
  or private.can_student_view_attendance(
    student_id,
    attendance_session_id,
    institution_id
  )
);

drop policy if exists
  attendance_records_insert_policy
  on public.attendance_records;

create policy attendance_records_insert_policy
on public.attendance_records
for insert
to authenticated
with check (
  private.can_manage_attendance_session(
    attendance_session_id,
    institution_id
  )
  and private.is_student_enrolled_for_attendance_session(
    student_id,
    attendance_session_id,
    institution_id
  )
  and (
    private.is_admin_or_director(
      institution_id
    )
    or recorded_by = auth.uid()
  )
);

drop policy if exists
  attendance_records_update_policy
  on public.attendance_records;

create policy attendance_records_update_policy
on public.attendance_records
for update
to authenticated
using (
  private.can_manage_attendance_session(
    attendance_session_id,
    institution_id
  )
)
with check (
  private.can_manage_attendance_session(
    attendance_session_id,
    institution_id
  )
  and private.is_student_enrolled_for_attendance_session(
    student_id,
    attendance_session_id,
    institution_id
  )
  and (
    private.is_admin_or_director(
      institution_id
    )
    or recorded_by = auth.uid()
  )
);

drop policy if exists
  attendance_records_delete_policy
  on public.attendance_records;

create policy attendance_records_delete_policy
on public.attendance_records
for delete
to authenticated
using (
  private.can_manage_attendance_session(
    attendance_session_id,
    institution_id
  )
);

commit;