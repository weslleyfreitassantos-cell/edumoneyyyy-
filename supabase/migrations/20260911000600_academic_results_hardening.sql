-- Harden the academic results lifecycle without rewriting the historical
-- assessment, grade, or term-closing migrations.

begin;

create or replace function private.prevent_closed_assessment_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE')
      and old.status = 'CLOSED' then
    raise exception
      'Avaliacoes fechadas nao podem ser alteradas.'
      using errcode = '23514';
  end if;

  if tg_op in ('UPDATE', 'DELETE')
      and exists (
        select 1
        from public.term_closures as closure
        where closure.subject_offering_id = old.subject_offering_id
          and closure.term_id = old.term_id
          and closure.status = 'CLOSED'
      ) then
    raise exception
      'Avaliacoes de periodo fechado nao podem ser alteradas sem reabertura.'
      using errcode = '23514';
  end if;

  if tg_op in ('INSERT', 'UPDATE')
      and exists (
        select 1
        from public.term_closures as closure
        where closure.subject_offering_id = new.subject_offering_id
          and closure.term_id = new.term_id
          and closure.status = 'CLOSED'
      ) then
    raise exception
      'Avaliacoes de periodo fechado nao podem ser alteradas sem reabertura.'
      using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function private.prevent_closed_grade_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_assessment_id uuid;
  new_assessment_id uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    old_assessment_id := old.assessment_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    new_assessment_id := new.assessment_id;
  end if;

  if exists (
    select 1
    from public.assessments as assessment
    where assessment.id = coalesce(new_assessment_id, old_assessment_id)
      and assessment.status <> 'PUBLISHED'
  ) then
    raise exception
      'Notas somente podem ser alteradas em avaliacoes publicadas.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.assessments as assessment
    join public.term_closures as closure
      on closure.subject_offering_id = assessment.subject_offering_id
     and closure.term_id = assessment.term_id
     and closure.status = 'CLOSED'
    where assessment.id in (old_assessment_id, new_assessment_id)
  ) then
    raise exception
      'Notas de periodo fechado nao podem ser alteradas sem reabertura.'
      using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$$;

alter function private.prevent_closed_assessment_mutation() owner to postgres;
alter function private.prevent_closed_grade_mutation() owner to postgres;

revoke all on function private.prevent_closed_assessment_mutation()
  from public, anon, authenticated;
revoke all on function private.prevent_closed_grade_mutation()
  from public, anon, authenticated;
grant execute on function private.prevent_closed_assessment_mutation()
  to service_role;
grant execute on function private.prevent_closed_grade_mutation()
  to service_role;

drop trigger if exists assessments_prevent_closed_mutation
  on public.assessments;
create trigger assessments_prevent_closed_mutation
before insert or update or delete on public.assessments
for each row
execute function private.prevent_closed_assessment_mutation();

drop trigger if exists grades_prevent_closed_mutation
  on public.grades;
create trigger grades_prevent_closed_mutation
before insert or update or delete on public.grades
for each row
execute function private.prevent_closed_grade_mutation();

-- Keep every student, guardian, and report-card path subject to the current
-- profile check, including the existing-grade branches used after closing.
create or replace function private.can_student_view_assessment(
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
    private.is_current_profile_active()
    and private.has_exact_institution_role(
      target_institution_id,
      array['STUDENT'::public.user_role]
    )
    and exists (
      select 1
      from public.assessments as assessment
      where assessment.id = target_assessment_id
        and assessment.institution_id = target_institution_id
        and assessment.status in ('PUBLISHED', 'CLOSED')
        and (
          private.is_student_enrolled_in_offering(
            assessment.subject_offering_id,
            target_institution_id
          )
          or exists (
            select 1
            from public.grades as grade
            join public.students as student
              on student.id = grade.student_id
            where grade.assessment_id = assessment.id
              and grade.institution_id = target_institution_id
              and student.profile_id = auth.uid()
              and student.institution_id = target_institution_id
          )
        )
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
    private.is_current_profile_active()
    and private.has_exact_institution_role(
      target_institution_id,
      array['STUDENT'::public.user_role]
    )
    and private.is_student_owner(
      target_student_id,
      target_institution_id
    )
    and exists (
      select 1
      from public.assessments as assessment
      where assessment.id = target_assessment_id
        and assessment.institution_id = target_institution_id
        and assessment.status in ('PUBLISHED', 'CLOSED')
    )
    and exists (
      select 1
      from public.grades as grade
      where grade.assessment_id = target_assessment_id
        and grade.student_id = target_student_id
        and grade.institution_id = target_institution_id
    );
$$;

create or replace function private.can_guardian_view_assessment(
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
    private.is_current_profile_active()
    and private.has_exact_institution_role(
      target_institution_id,
      array['GUARDIAN'::public.user_role]
    )
    and exists (
      select 1
      from public.assessments as assessment
      join public.subject_offerings as offering
        on offering.id = assessment.subject_offering_id
      join public.enrollments as enrollment
        on enrollment.class_id = offering.class_id
      join public.students as student
        on student.id = enrollment.student_id
      join public.guardianships as guardianship
        on guardianship.student_id = student.id
      where assessment.id = target_assessment_id
        and assessment.institution_id = target_institution_id
        and assessment.status in ('PUBLISHED', 'CLOSED')
        and student.institution_id = target_institution_id
        and guardianship.guardian_profile_id = auth.uid()
        and guardianship.active is true
        and enrollment.enrolled_at <= (
          assessment.assessment_date::timestamp
          + interval '1 day'
        )::timestamptz
        and (
          (
            enrollment.active is true
            and upper(enrollment.status) = 'ACTIVE'
          )
          or exists (
            select 1
            from public.grades as grade
            where grade.assessment_id = assessment.id
              and grade.student_id = student.id
              and grade.institution_id = target_institution_id
          )
        )
    );
$$;

create or replace function private.can_guardian_view_grade(
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
      join public.assessments as assessment
        on assessment.id = target_assessment_id
      where guardianship.student_id = target_student_id
        and guardianship.guardian_profile_id = auth.uid()
        and guardianship.active is true
        and student.institution_id = target_institution_id
        and assessment.institution_id = target_institution_id
        and assessment.status in ('PUBLISHED', 'CLOSED')
        and exists (
          select 1
          from public.grades as grade
          where grade.assessment_id = target_assessment_id
            and grade.student_id = target_student_id
            and grade.institution_id = target_institution_id
        )
    );
$$;

create or replace function private.can_view_student_term_result(
  target_student_id uuid,
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
    and (
      public.can_manage_institution_operations(target_institution_id)
      or private.is_student_owner(
        target_student_id,
        target_institution_id
      )
      or exists (
        select 1
        from public.guardianships as guardianship
        join public.students as student
          on student.id = guardianship.student_id
        where guardianship.student_id = target_student_id
          and guardianship.guardian_profile_id = auth.uid()
          and private.has_exact_institution_role(
            target_institution_id,
            array['GUARDIAN'::public.user_role]
          )
          and guardianship.active is true
          and student.institution_id = target_institution_id
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
        and attendance_session.institution_id = target_institution_id
        and attendance_session.status = 'CLOSED'
        and exists (
          select 1
          from public.attendance_records as attendance_record
          where attendance_record.attendance_session_id = target_session_id
            and attendance_record.student_id = target_student_id
            and attendance_record.institution_id = target_institution_id
        )
    );
$$;

comment on function private.prevent_closed_assessment_mutation() is
  'Prevents assessment changes after its assessment or term is closed.';

comment on function private.prevent_closed_grade_mutation() is
  'Allows grade changes only for published assessments and open terms.';

commit;
