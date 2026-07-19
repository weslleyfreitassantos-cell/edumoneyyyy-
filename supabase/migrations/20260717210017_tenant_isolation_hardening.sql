-- Tenant isolation hardening for director summary views and structural writes.
--
-- Do not apply this migration to the remote project until the pending
-- migration history has been reviewed.

begin;

-- ============================================================
-- Director summary views
-- ============================================================

alter view public.director_alerts
  set (security_invoker = true);

alter view public.director_class_summary
  set (security_invoker = true);

alter view public.director_student_summary
  set (security_invoker = true);

alter view public.director_teacher_summary
  set (security_invoker = true);

alter view public.director_upcoming_events
  set (security_invoker = true);

revoke all on public.director_alerts
  from public, anon, authenticated;

revoke all on public.director_class_summary
  from public, anon, authenticated;

revoke all on public.director_student_summary
  from public, anon, authenticated;

revoke all on public.director_teacher_summary
  from public, anon, authenticated;

revoke all on public.director_upcoming_events
  from public, anon, authenticated;

-- ============================================================
-- Structural tenant validation helpers
-- ============================================================

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.validate_class_tenant_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.academic_years as academic_year
    where academic_year.id = new.academic_year_id
      and academic_year.institution_id = new.institution_id
  ) then
    raise exception
      'Class institution must match academic year institution.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.validate_enrollment_tenant_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  student_institution_id uuid;
  student_is_active boolean;
  class_institution_id uuid;
  class_academic_year_id uuid;
  class_is_active boolean;
  academic_year_institution_id uuid;
  academic_year_is_active boolean;
begin
  select
    student.institution_id,
    student.active
  into
    student_institution_id,
    student_is_active
  from public.students as student
  where student.id = new.student_id;

  if not found then
    raise exception
      'Enrollment student does not exist.'
      using errcode = '23503';
  end if;

  select
    class.institution_id,
    class.academic_year_id,
    class.active
  into
    class_institution_id,
    class_academic_year_id,
    class_is_active
  from public.classes as class
  where class.id = new.class_id;

  if not found then
    raise exception
      'Enrollment class does not exist.'
      using errcode = '23503';
  end if;

  select
    academic_year.institution_id,
    academic_year.active
  into
    academic_year_institution_id,
    academic_year_is_active
  from public.academic_years as academic_year
  where academic_year.id = new.academic_year_id;

  if not found then
    raise exception
      'Enrollment academic year does not exist.'
      using errcode = '23503';
  end if;

  if student_institution_id is distinct from class_institution_id
      or class_institution_id is distinct from academic_year_institution_id
      or class_academic_year_id is distinct from new.academic_year_id then
    raise exception
      'Enrollment student, class and academic year must belong to the same institution and year.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.validate_subject_offering_tenant_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  class_institution_id uuid;
  class_academic_year_id uuid;
  subject_institution_id uuid;
  term_academic_year_id uuid;
  term_institution_id uuid;
  teacher_membership_exists boolean;
begin
  select
    class.institution_id,
    class.academic_year_id
  into
    class_institution_id,
    class_academic_year_id
  from public.classes as class
  where class.id = new.class_id;

  if not found then
    raise exception
      'Subject offering class does not exist.'
      using errcode = '23503';
  end if;

  select
    subject.institution_id
  into
    subject_institution_id
  from public.subjects as subject
  where subject.id = new.subject_id;

  if not found then
    raise exception
      'Subject offering subject does not exist.'
      using errcode = '23503';
  end if;

  if new.term_id is not null then
    select
      term.academic_year_id,
      academic_year.institution_id
    into
      term_academic_year_id,
      term_institution_id
    from public.terms as term
    join public.academic_years as academic_year
      on academic_year.id = term.academic_year_id
    where term.id = new.term_id;

    if not found then
      raise exception
        'Subject offering term does not exist.'
        using errcode = '23503';
    end if;
  end if;

  teacher_membership_exists := exists (
    select 1
    from public.memberships as membership
    where membership.profile_id = new.teacher_profile_id
      and membership.institution_id = class_institution_id
      and membership.role = 'TEACHER'::public.user_role
  );

  if not teacher_membership_exists then
    raise exception
      'Subject offering teacher must have a teacher membership in the class institution.'
      using errcode = '23514';
  end if;

  if class_institution_id is distinct from subject_institution_id then
    raise exception
      'Subject offering class and subject must belong to the same institution.'
      using errcode = '23514';
  end if;

  if new.term_id is not null then
    if class_institution_id is distinct from term_institution_id
        or class_academic_year_id is distinct from term_academic_year_id then
      raise exception
        'Subject offering term must belong to the same institution and academic year as the class.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.validate_academic_policy_tenant_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.academic_years as academic_year
    where academic_year.id = new.academic_year_id
      and academic_year.institution_id = new.institution_id
  ) then
    raise exception
      'Academic policy institution must match academic year institution.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists classes_validate_tenant_integrity
  on public.classes;

create trigger classes_validate_tenant_integrity
before insert or update of institution_id, academic_year_id
on public.classes
for each row
execute function private.validate_class_tenant_integrity();

drop trigger if exists enrollments_validate_tenant_integrity
  on public.enrollments;

create trigger enrollments_validate_tenant_integrity
before insert or update of student_id, class_id, academic_year_id
on public.enrollments
for each row
execute function private.validate_enrollment_tenant_integrity();

drop trigger if exists subject_offerings_validate_tenant_integrity
  on public.subject_offerings;

create trigger subject_offerings_validate_tenant_integrity
before insert or update of class_id, subject_id, term_id, teacher_profile_id
on public.subject_offerings
for each row
execute function private.validate_subject_offering_tenant_integrity();

drop trigger if exists academic_policies_validate_tenant_integrity
  on public.academic_policies;

create trigger academic_policies_validate_tenant_integrity
before insert or update of institution_id, academic_year_id
on public.academic_policies
for each row
execute function private.validate_academic_policy_tenant_integrity();

revoke all on function private.validate_class_tenant_integrity()
  from public, anon, authenticated;

revoke all on function private.validate_enrollment_tenant_integrity()
  from public, anon, authenticated;

revoke all on function private.validate_subject_offering_tenant_integrity()
  from public, anon, authenticated;

revoke all on function private.validate_academic_policy_tenant_integrity()
  from public, anon, authenticated;

grant execute on function private.validate_class_tenant_integrity()
  to service_role;

grant execute on function private.validate_enrollment_tenant_integrity()
  to service_role;

grant execute on function private.validate_subject_offering_tenant_integrity()
  to service_role;

grant execute on function private.validate_academic_policy_tenant_integrity()
  to service_role;

commit;
