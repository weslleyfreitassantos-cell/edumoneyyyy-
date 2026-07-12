-- Consolidates assessments and grades access for the end-to-end flow.
--
-- Do not apply remotely until the hosted migration history is reconciled.

begin;

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.can_view_grades_institution(
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
      and student.active is true
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
          from public.grades as existing_grade
          where existing_grade.assessment_id =
            target_assessment_id
            and existing_grade.student_id =
              target_student_id
        )
      )
  );
$$;

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
  select exists (
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
            and student.institution_id =
              target_institution_id
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
    private.is_student_owner(
      target_student_id,
      target_institution_id
    )
    and exists (
      select 1
      from public.assessments as assessment
      where assessment.id = target_assessment_id
        and assessment.institution_id =
          target_institution_id
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
  select exists (
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
            and grade.institution_id =
              target_institution_id
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
  select exists (
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
      and assessment.institution_id =
        target_institution_id
      and assessment.status in ('PUBLISHED', 'CLOSED')
      and exists (
        select 1
        from public.grades as grade
        where grade.assessment_id =
          target_assessment_id
          and grade.student_id = target_student_id
          and grade.institution_id =
            target_institution_id
      )
  );
$$;

create or replace function private.validate_grade_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assessment_institution_id uuid;
  assessment_offering_id uuid;
  assessment_max_score numeric(7, 2);
  assessment_date date;
  offering_class_id uuid;
  student_institution_id uuid;
begin
  select
    assessment.institution_id,
    assessment.subject_offering_id,
    assessment.max_score,
    assessment.assessment_date
  into
    assessment_institution_id,
    assessment_offering_id,
    assessment_max_score,
    assessment_date
  from public.assessments as assessment
  where assessment.id = new.assessment_id;

  if not found then
    raise exception
      'A avaliação informada não existe.'
      using errcode = '23503';
  end if;

  select offering.class_id
  into offering_class_id
  from public.subject_offerings as offering
  where offering.id = assessment_offering_id;

  if not found then
    raise exception
      'A oferta vinculada à avaliação não existe.'
      using errcode = '23503';
  end if;

  select student.institution_id
  into student_institution_id
  from public.students as student
  where student.id = new.student_id;

  if not found then
    raise exception
      'O aluno informado não existe.'
      using errcode = '23503';
  end if;

  if new.institution_id
      is distinct from assessment_institution_id then
    raise exception
      'A nota deve pertencer à mesma instituição da avaliação.'
      using errcode = '23514';
  end if;

  if new.institution_id
      is distinct from student_institution_id then
    raise exception
      'A nota deve pertencer à mesma instituição do aluno.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.enrollments as enrollment
    where enrollment.student_id = new.student_id
      and enrollment.class_id = offering_class_id
      and enrollment.enrolled_at <= (
        assessment_date::timestamp + interval '1 day'
      )::timestamptz
      and (
        (
          enrollment.active is true
          and upper(enrollment.status) = 'ACTIVE'
        )
        or exists (
          select 1
          from public.grades as existing_grade
          where existing_grade.assessment_id =
            new.assessment_id
            and existing_grade.student_id = new.student_id
            and (
              tg_op = 'UPDATE'
              or existing_grade.id = new.id
            )
        )
      )
  ) then
    raise exception
      'O aluno não possui matrícula válida na turma vinculada à avaliação.'
      using errcode = '23514';
  end if;

  if new.score is not null
      and new.score > assessment_max_score then
    raise exception
      'A nota não pode ultrapassar a pontuação máxima da avaliação.'
      using errcode = '23514';
  end if;

  if new.status = 'GRADED'
      and (
        new.recorded_at is null
        or tg_op = 'INSERT'
        or old.status is distinct from new.status
        or old.score is distinct from new.score
      ) then
    new.recorded_at = now();
  end if;

  if new.status <> 'GRADED' then
    new.recorded_at = null;
  end if;

  return new;
end;
$$;

alter function private.can_view_grades_institution(uuid)
  owner to postgres;

alter function private.is_student_enrolled_for_assessment(uuid, uuid, uuid)
  owner to postgres;

alter function private.can_student_view_assessment(uuid, uuid)
  owner to postgres;

alter function private.can_student_view_grade(uuid, uuid, uuid)
  owner to postgres;

alter function private.can_guardian_view_assessment(uuid, uuid)
  owner to postgres;

alter function private.can_guardian_view_grade(uuid, uuid, uuid)
  owner to postgres;

alter function private.validate_grade_integrity()
  owner to postgres;

revoke all on function private.can_view_grades_institution(uuid)
  from public, anon, authenticated;

revoke all on function
  private.is_student_enrolled_for_assessment(uuid, uuid, uuid)
  from public, anon, authenticated;

revoke all on function private.can_student_view_assessment(uuid, uuid)
  from public, anon, authenticated;

revoke all on function private.can_student_view_grade(uuid, uuid, uuid)
  from public, anon, authenticated;

revoke all on function private.can_guardian_view_assessment(uuid, uuid)
  from public, anon, authenticated;

revoke all on function private.can_guardian_view_grade(uuid, uuid, uuid)
  from public, anon, authenticated;

revoke all on function private.validate_grade_integrity()
  from public, anon, authenticated;

grant execute on function private.can_view_grades_institution(uuid)
  to authenticated, service_role;

grant execute on function
  private.is_student_enrolled_for_assessment(uuid, uuid, uuid)
  to authenticated, service_role;

grant execute on function private.can_student_view_assessment(uuid, uuid)
  to authenticated, service_role;

grant execute on function private.can_student_view_grade(uuid, uuid, uuid)
  to authenticated, service_role;

grant execute on function private.can_guardian_view_assessment(uuid, uuid)
  to authenticated, service_role;

grant execute on function private.can_guardian_view_grade(uuid, uuid, uuid)
  to authenticated, service_role;

grant execute on function private.validate_grade_integrity()
  to service_role;

revoke delete on table public.assessments
  from authenticated;

revoke delete on table public.grades
  from authenticated;

grant select, insert, update
  on table public.assessments
  to authenticated;

grant select, insert, update
  on table public.grades
  to authenticated;

drop policy if exists assessments_select_policy
  on public.assessments;

create policy assessments_select_policy
on public.assessments
for select
to authenticated
using (
  private.can_view_grades_institution(institution_id)
  or private.is_teacher_for_offering(
    subject_offering_id,
    institution_id
  )
  or private.can_student_view_assessment(
    id,
    institution_id
  )
  or private.can_guardian_view_assessment(
    id,
    institution_id
  )
);

drop policy if exists grades_select_policy
  on public.grades;

create policy grades_select_policy
on public.grades
for select
to authenticated
using (
  private.can_view_grades_institution(institution_id)
  or private.can_manage_assessment(
    assessment_id,
    institution_id
  )
  or private.can_student_view_grade(
    student_id,
    assessment_id,
    institution_id
  )
  or private.can_guardian_view_grade(
    student_id,
    assessment_id,
    institution_id
  )
);

drop policy if exists assessments_delete_policy
  on public.assessments;

drop policy if exists grades_delete_policy
  on public.grades;

commit;
