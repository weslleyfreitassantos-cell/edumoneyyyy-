Biblioteca
/
20260710000400_attendance_and_grades_integrity.sql


-- Regras de integridade entre avaliações, notas, frequência e matrículas.
--
-- Pré-requisitos:
--   20260710000200_attendance_and_grades.sql
--   20260710000300_attendance_and_grades_rls.sql
--
-- Esta migration deve ser revisada antes de qualquer aplicação remota.
-- NÃO executar `supabase db push` no projeto remoto atual enquanto o
-- histórico de migrations não estiver reconciliado.

begin;

create schema if not exists private;

-- ============================================================
-- Avaliações
-- ============================================================

create or replace function private.validate_assessment_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  offering_class_institution_id uuid;
  offering_subject_institution_id uuid;
  offering_term_id uuid;
  highest_recorded_score numeric(7, 2);
begin
  select
    class.institution_id,
    subject.institution_id,
    offering.term_id
  into
    offering_class_institution_id,
    offering_subject_institution_id,
    offering_term_id
  from public.subject_offerings as offering
  join public.classes as class
    on class.id = offering.class_id
  join public.subjects as subject
    on subject.id = offering.subject_id
  where offering.id = new.subject_offering_id;

  if not found then
    raise exception
      'A oferta de disciplina informada não existe.'
      using errcode = '23503';
  end if;

  if offering_class_institution_id
      is distinct from offering_subject_institution_id then
    raise exception
      'A turma e a disciplina da oferta pertencem a instituições diferentes.'
      using errcode = '23514';
  end if;

  if new.institution_id
      is distinct from offering_class_institution_id then
    raise exception
      'A avaliação deve pertencer à mesma instituição da oferta de disciplina.'
      using errcode = '23514';
  end if;

  if new.term_id is not null
      and new.term_id is distinct from offering_term_id then
    raise exception
      'O período da avaliação deve corresponder ao período da oferta de disciplina.'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if (
      old.institution_id is distinct from new.institution_id
      or old.subject_offering_id
        is distinct from new.subject_offering_id
    )
    and exists (
      select 1
      from public.grades as grade
      where grade.assessment_id = old.id
    ) then
      raise exception
        'Não é permitido alterar a instituição ou a oferta de uma avaliação que já possui notas.'
        using errcode = '23514';
    end if;

    select max(grade.score)
    into highest_recorded_score
    from public.grades as grade
    where grade.assessment_id = old.id
      and grade.status = 'GRADED';

    if highest_recorded_score is not null
        and new.max_score < highest_recorded_score then
      raise exception
        'A pontuação máxima não pode ser menor que uma nota já registrada.'
        using errcode = '23514';
    end if;
  end if;

  if new.status = 'PUBLISHED'
      and new.published_at is null then
    new.published_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists
  assessments_validate_integrity
  on public.assessments;

create trigger assessments_validate_integrity
before insert or update
on public.assessments
for each row
execute function private.validate_assessment_integrity();

-- ============================================================
-- Notas
-- ============================================================

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
  offering_class_id uuid;
  student_institution_id uuid;
begin
  select
    assessment.institution_id,
    assessment.subject_offering_id,
    assessment.max_score
  into
    assessment_institution_id,
    assessment_offering_id,
    assessment_max_score
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
  ) then
    raise exception
      'O aluno não possui matrícula na turma vinculada à avaliação.'
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

drop trigger if exists
  grades_validate_integrity
  on public.grades;

create trigger grades_validate_integrity
before insert or update
on public.grades
for each row
execute function private.validate_grade_integrity();

-- ============================================================
-- Sessões de frequência
-- ============================================================

create or replace function private.validate_attendance_session_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  offering_class_institution_id uuid;
  offering_subject_institution_id uuid;
begin
  select
    class.institution_id,
    subject.institution_id
  into
    offering_class_institution_id,
    offering_subject_institution_id
  from public.subject_offerings as offering
  join public.classes as class
    on class.id = offering.class_id
  join public.subjects as subject
    on subject.id = offering.subject_id
  where offering.id = new.subject_offering_id;

  if not found then
    raise exception
      'A oferta de disciplina informada não existe.'
      using errcode = '23503';
  end if;

  if offering_class_institution_id
      is distinct from offering_subject_institution_id then
    raise exception
      'A turma e a disciplina da oferta pertencem a instituições diferentes.'
      using errcode = '23514';
  end if;

  if new.institution_id
      is distinct from offering_class_institution_id then
    raise exception
      'A sessão de frequência deve pertencer à mesma instituição da oferta.'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
      and (
        old.institution_id is distinct from new.institution_id
        or old.subject_offering_id
          is distinct from new.subject_offering_id
      )
      and exists (
        select 1
        from public.attendance_records as attendance_record
        where attendance_record.attendance_session_id = old.id
      ) then
    raise exception
      'Não é permitido alterar a instituição ou a oferta de uma sessão que já possui registros de presença.'
      using errcode = '23514';
  end if;

  if new.status = 'CLOSED'
      and new.closed_at is null then
    new.closed_at = now();
  end if;

  if new.status <> 'CLOSED' then
    new.closed_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists
  attendance_sessions_validate_integrity
  on public.attendance_sessions;

create trigger attendance_sessions_validate_integrity
before insert or update
on public.attendance_sessions
for each row
execute function private.validate_attendance_session_integrity();

-- ============================================================
-- Registros de presença
-- ============================================================

create or replace function private.validate_attendance_record_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_institution_id uuid;
  session_offering_id uuid;
  offering_class_id uuid;
  student_institution_id uuid;
begin
  select
    attendance_session.institution_id,
    attendance_session.subject_offering_id
  into
    session_institution_id,
    session_offering_id
  from public.attendance_sessions as attendance_session
  where attendance_session.id = new.attendance_session_id;

  if not found then
    raise exception
      'A sessão de frequência informada não existe.'
      using errcode = '23503';
  end if;

  select offering.class_id
  into offering_class_id
  from public.subject_offerings as offering
  where offering.id = session_offering_id;

  if not found then
    raise exception
      'A oferta vinculada à sessão de frequência não existe.'
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
      is distinct from session_institution_id then
    raise exception
      'O registro de presença deve pertencer à mesma instituição da sessão.'
      using errcode = '23514';
  end if;

  if new.institution_id
      is distinct from student_institution_id then
    raise exception
      'O registro de presença deve pertencer à mesma instituição do aluno.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.enrollments as enrollment
    where enrollment.student_id = new.student_id
      and enrollment.class_id = offering_class_id
  ) then
    raise exception
      'O aluno não possui matrícula na turma vinculada à sessão de frequência.'
      using errcode = '23514';
  end if;

  if new.recorded_at is null then
    new.recorded_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists
  attendance_records_validate_integrity
  on public.attendance_records;

create trigger attendance_records_validate_integrity
before insert or update
on public.attendance_records
for each row
execute function private.validate_attendance_record_integrity();

-- ============================================================
-- Permissões das funções de trigger
-- ============================================================

revoke all on function
  private.validate_assessment_integrity()
  from public, anon, authenticated;

revoke all on function
  private.validate_grade_integrity()
  from public, anon, authenticated;

revoke all on function
  private.validate_attendance_session_integrity()
  from public, anon, authenticated;

revoke all on function
  private.validate_attendance_record_integrity()
  from public, anon, authenticated;

grant execute on function
  private.validate_assessment_integrity()
  to service_role;

grant execute on function
  private.validate_grade_integrity()
  to service_role;

grant execute on function
  private.validate_attendance_session_integrity()
  to service_role;

grant execute on function
  private.validate_attendance_record_integrity()
  to service_role;

commit;