-- Term closing and report cards for the academic end-to-end flow.
--
-- Do not apply remotely until the hosted migration history is reconciled.

begin;

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create table public.academic_policies (
  id uuid primary key default extensions.uuid_generate_v4(),

  institution_id uuid not null
    references public.institutions(id)
    on delete cascade,

  academic_year_id uuid not null
    references public.academic_years(id)
    on delete restrict,

  minimum_grade_percentage numeric(5, 2) not null,
  minimum_attendance_percentage numeric(5, 2) not null,
  decimal_places integer not null default 1,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint academic_policies_grade_percentage_valid
    check (
      minimum_grade_percentage >= 0
      and minimum_grade_percentage <= 100
    ),

  constraint academic_policies_attendance_percentage_valid
    check (
      minimum_attendance_percentage >= 0
      and minimum_attendance_percentage <= 100
    ),

  constraint academic_policies_decimal_places_valid
    check (decimal_places between 0 and 4)
);

comment on table public.academic_policies is
  'Institution academic rules used to close terms and report cards.';

create unique index academic_policies_active_year_unique_idx
  on public.academic_policies (
    institution_id,
    academic_year_id
  )
  where active is true;

create table public.term_closures (
  id uuid primary key default extensions.uuid_generate_v4(),

  institution_id uuid not null
    references public.institutions(id)
    on delete cascade,

  academic_year_id uuid not null
    references public.academic_years(id)
    on delete restrict,

  term_id uuid not null
    references public.terms(id)
    on delete restrict,

  subject_offering_id uuid not null
    references public.subject_offerings(id)
    on delete restrict,

  status text not null default 'OPEN',

  submitted_by uuid
    references public.profiles(id)
    on delete set null,
  submitted_at timestamptz,

  closed_by uuid
    references public.profiles(id)
    on delete set null,
  closed_at timestamptz,

  reopened_by uuid
    references public.profiles(id)
    on delete set null,
  reopened_at timestamptz,
  reopen_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint term_closures_offering_term_unique
    unique (subject_offering_id, term_id),

  constraint term_closures_status_valid
    check (
      status in (
        'OPEN',
        'SUBMITTED',
        'CLOSED',
        'REOPENED'
      )
    ),

  constraint term_closures_reopen_reason_required
    check (
      status <> 'REOPENED'
      or length(trim(coalesce(reopen_reason, ''))) > 0
    )
);

comment on table public.term_closures is
  'Review state for each subject offering in an academic term.';

create table public.student_term_results (
  id uuid primary key default extensions.uuid_generate_v4(),

  institution_id uuid not null
    references public.institutions(id)
    on delete cascade,

  academic_year_id uuid not null
    references public.academic_years(id)
    on delete restrict,

  term_id uuid not null
    references public.terms(id)
    on delete restrict,

  subject_offering_id uuid not null
    references public.subject_offerings(id)
    on delete restrict,

  student_id uuid not null
    references public.students(id)
    on delete restrict,

  grade_percentage numeric(5, 2),
  attendance_percentage numeric(5, 2),
  result_status text not null default 'PENDING',
  calculated_at timestamptz not null default now(),
  finalized_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint student_term_results_student_offering_term_unique
    unique (
      student_id,
      subject_offering_id,
      term_id
    ),

  constraint student_term_results_grade_percentage_valid
    check (
      grade_percentage is null
      or (
        grade_percentage >= 0
        and grade_percentage <= 100
      )
    ),

  constraint student_term_results_attendance_percentage_valid
    check (
      attendance_percentage is null
      or (
        attendance_percentage >= 0
        and attendance_percentage <= 100
      )
    ),

  constraint student_term_results_status_valid
    check (
      result_status in (
        'PENDING',
        'APPROVED',
        'FAILED_BY_GRADE',
        'FAILED_BY_ATTENDANCE',
        'FAILED_BY_GRADE_AND_ATTENDANCE'
      )
    )
);

comment on table public.student_term_results is
  'Frozen report-card snapshots by student, subject offering and term.';

create index academic_policies_institution_year_idx
  on public.academic_policies (
    institution_id,
    academic_year_id
  );

create index term_closures_institution_term_idx
  on public.term_closures (
    institution_id,
    term_id,
    status
  );

create index term_closures_offering_idx
  on public.term_closures (
    subject_offering_id,
    term_id
  );

create index student_term_results_institution_term_idx
  on public.student_term_results (
    institution_id,
    term_id,
    result_status
  );

create index student_term_results_student_idx
  on public.student_term_results (
    student_id,
    academic_year_id,
    term_id
  );

create trigger academic_policies_touch_updated_at
before update on public.academic_policies
for each row
execute function public.touch_academic_record_updated_at();

create trigger term_closures_touch_updated_at
before update on public.term_closures
for each row
execute function public.touch_academic_record_updated_at();

create trigger student_term_results_touch_updated_at
before update on public.student_term_results
for each row
execute function public.touch_academic_record_updated_at();

create or replace function private.term_offering_belongs_to_context(
  target_institution_id uuid,
  target_academic_year_id uuid,
  target_term_id uuid,
  target_subject_offering_id uuid
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
    join public.terms as term
      on term.id = offering.term_id
    join public.academic_years as academic_year
      on academic_year.id = term.academic_year_id
    where offering.id = target_subject_offering_id
      and offering.term_id = target_term_id
      and term.id = target_term_id
      and term.academic_year_id = target_academic_year_id
      and academic_year.id = target_academic_year_id
      and academic_year.institution_id = target_institution_id
      and class.institution_id = target_institution_id
      and class.academic_year_id = target_academic_year_id
      and subject.institution_id = target_institution_id
      and offering.active is true
      and class.active is true
      and subject.active is true
      and term.active is true
      and academic_year.active is true
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
        and guardianship.active is true
        and student.institution_id = target_institution_id
    );
$$;

create or replace function private.prevent_closed_term_result_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.term_closures as closure
    where closure.institution_id = old.institution_id
      and closure.academic_year_id = old.academic_year_id
      and closure.term_id = old.term_id
      and closure.subject_offering_id = old.subject_offering_id
      and closure.status = 'CLOSED'
  ) then
    raise exception
      'Resultados de periodo fechado nao podem ser alterados sem reabertura.'
      using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function private.prevent_invalid_term_closure_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'CLOSED'
      and new.status <> 'REOPENED' then
    raise exception
      'Periodo fechado so pode ser reaberto com motivo.'
      using errcode = '23514';
  end if;

  if old.status = 'CLOSED'
      and new.status = 'REOPENED'
      and length(trim(coalesce(new.reopen_reason, ''))) = 0 then
    raise exception
      'Informe o motivo da reabertura.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger student_term_results_prevent_closed_update
before update on public.student_term_results
for each row
execute function private.prevent_closed_term_result_change();

create trigger student_term_results_prevent_closed_delete
before delete on public.student_term_results
for each row
execute function private.prevent_closed_term_result_change();

create trigger term_closures_prevent_invalid_update
before update on public.term_closures
for each row
execute function private.prevent_invalid_term_closure_change();

create or replace function public.submit_term_closure(
  p_institution_id uuid,
  p_academic_year_id uuid,
  p_term_id uuid,
  p_subject_offering_id uuid
)
returns public.term_closures
language plpgsql
security definer
set search_path = ''
as $$
declare
  closure_row public.term_closures;
  term_start date;
  term_end date;
  eligible_student_count integer;
  published_assessment_count integer;
  pending_count integer;
  closed_session_count integer;
begin
  if not private.term_offering_belongs_to_context(
    p_institution_id,
    p_academic_year_id,
    p_term_id,
    p_subject_offering_id
  ) then
    raise exception
      'Oferta, periodo e ano letivo nao pertencem ao mesmo contexto.'
      using errcode = '23514';
  end if;

  if not (
    public.is_institution_admin(p_institution_id)
    or private.is_teacher_for_offering(
      p_subject_offering_id,
      p_institution_id
    )
  ) then
    raise exception
      'Usuario sem permissao para enviar o periodo para revisao.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.academic_policies as policy
    where policy.institution_id = p_institution_id
      and policy.academic_year_id = p_academic_year_id
      and policy.active is true
  ) then
    raise exception
      'Configure a politica academica antes de enviar o periodo.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.term_closures as closure
    where closure.subject_offering_id = p_subject_offering_id
      and closure.term_id = p_term_id
      and closure.status = 'CLOSED'
  ) then
    raise exception
      'Periodo ja fechado. Reabra antes de reenviar.'
      using errcode = '23514';
  end if;

  select term.start_date, term.end_date
  into term_start, term_end
  from public.terms as term
  where term.id = p_term_id
    and term.academic_year_id = p_academic_year_id;

  if not found then
    raise exception
      'Periodo academico invalido.'
      using errcode = '23514';
  end if;

  with context as (
    select offering.class_id
    from public.subject_offerings as offering
    where offering.id = p_subject_offering_id
  )
  select count(*)::integer
  into eligible_student_count
  from public.enrollments as enrollment
  join public.students as student
    on student.id = enrollment.student_id
  join context
    on context.class_id = enrollment.class_id
  where enrollment.academic_year_id = p_academic_year_id
    and enrollment.active is true
    and upper(enrollment.status) = 'ACTIVE'
    and enrollment.enrolled_at <= (
      term_end::timestamp + interval '1 day'
    )::timestamptz
    and student.institution_id = p_institution_id
    and student.active is true;

  if eligible_student_count = 0 then
    raise exception
      'Nao ha alunos obrigatorios para fechamento nesta oferta.'
      using errcode = '23514';
  end if;

  select count(*)::integer
  into published_assessment_count
  from public.assessments as assessment
  where assessment.institution_id = p_institution_id
    and assessment.subject_offering_id = p_subject_offering_id
    and assessment.term_id = p_term_id
    and assessment.status in ('PUBLISHED', 'CLOSED');

  if published_assessment_count = 0 then
    raise exception
      'Nao ha avaliacoes publicadas para o periodo.'
      using errcode = '23514';
  end if;

  with context as (
    select offering.class_id
    from public.subject_offerings as offering
    where offering.id = p_subject_offering_id
  ),
  eligible_students as (
    select enrollment.student_id
    from public.enrollments as enrollment
    join public.students as student
      on student.id = enrollment.student_id
    join context
      on context.class_id = enrollment.class_id
    where enrollment.academic_year_id = p_academic_year_id
      and enrollment.active is true
      and upper(enrollment.status) = 'ACTIVE'
      and enrollment.enrolled_at <= (
        term_end::timestamp + interval '1 day'
      )::timestamptz
      and student.institution_id = p_institution_id
      and student.active is true
  ),
  published_assessments as (
    select assessment.id
    from public.assessments as assessment
    where assessment.institution_id = p_institution_id
      and assessment.subject_offering_id = p_subject_offering_id
      and assessment.term_id = p_term_id
      and assessment.status in ('PUBLISHED', 'CLOSED')
  )
  select count(*)::integer
  into pending_count
  from eligible_students as student
  cross join published_assessments as assessment
  left join public.grades as grade
    on grade.assessment_id = assessment.id
   and grade.student_id = student.student_id
   and grade.institution_id = p_institution_id
  where grade.id is null
     or grade.status = 'PENDING';

  if pending_count > 0 then
    raise exception
      'Existem notas pendentes para alunos obrigatorios.'
      using errcode = '23514';
  end if;

  select count(*)::integer
  into closed_session_count
  from public.attendance_sessions as attendance_session
  where attendance_session.institution_id = p_institution_id
    and attendance_session.subject_offering_id = p_subject_offering_id
    and attendance_session.status = 'CLOSED'
    and attendance_session.session_date between term_start and term_end;

  if closed_session_count = 0 then
    raise exception
      'Registre e feche ao menos uma chamada no periodo.'
      using errcode = '23514';
  end if;

  insert into public.term_closures (
    institution_id,
    academic_year_id,
    term_id,
    subject_offering_id,
    status,
    submitted_by,
    submitted_at
  )
  values (
    p_institution_id,
    p_academic_year_id,
    p_term_id,
    p_subject_offering_id,
    'SUBMITTED',
    auth.uid(),
    now()
  )
  on conflict (subject_offering_id, term_id)
  do update set
    status = 'SUBMITTED',
    submitted_by = auth.uid(),
    submitted_at = now()
  returning * into closure_row;

  return closure_row;
end;
$$;

create or replace function public.close_term_closure(
  p_institution_id uuid,
  p_academic_year_id uuid,
  p_term_id uuid,
  p_subject_offering_id uuid
)
returns public.term_closures
language plpgsql
security definer
set search_path = ''
as $$
declare
  closure_row public.term_closures;
  term_start date;
  term_end date;
  policy_row public.academic_policies;
  eligible_student_count integer;
  published_assessment_count integer;
  pending_count integer;
  insufficient_result_count integer;
  closed_session_count integer;
begin
  if not public.is_institution_admin(p_institution_id) then
    raise exception
      'Usuario sem permissao para fechar o periodo.'
      using errcode = '42501';
  end if;

  if not private.term_offering_belongs_to_context(
    p_institution_id,
    p_academic_year_id,
    p_term_id,
    p_subject_offering_id
  ) then
    raise exception
      'Oferta, periodo e ano letivo nao pertencem ao mesmo contexto.'
      using errcode = '23514';
  end if;

  select *
  into policy_row
  from public.academic_policies as policy
  where policy.institution_id = p_institution_id
    and policy.academic_year_id = p_academic_year_id
    and policy.active is true
  limit 1;

  if not found then
    raise exception
      'Configure a politica academica antes de fechar o periodo.'
      using errcode = '23514';
  end if;

  select term.start_date, term.end_date
  into term_start, term_end
  from public.terms as term
  where term.id = p_term_id
    and term.academic_year_id = p_academic_year_id;

  if not found then
    raise exception
      'Periodo academico invalido.'
      using errcode = '23514';
  end if;

  with context as (
    select offering.class_id
    from public.subject_offerings as offering
    where offering.id = p_subject_offering_id
  )
  select count(*)::integer
  into eligible_student_count
  from public.enrollments as enrollment
  join public.students as student
    on student.id = enrollment.student_id
  join context
    on context.class_id = enrollment.class_id
  where enrollment.academic_year_id = p_academic_year_id
    and enrollment.active is true
    and upper(enrollment.status) = 'ACTIVE'
    and enrollment.enrolled_at <= (
      term_end::timestamp + interval '1 day'
    )::timestamptz
    and student.institution_id = p_institution_id
    and student.active is true;

  if eligible_student_count = 0 then
    raise exception
      'Nao ha alunos obrigatorios para fechamento nesta oferta.'
      using errcode = '23514';
  end if;

  select count(*)::integer
  into published_assessment_count
  from public.assessments as assessment
  where assessment.institution_id = p_institution_id
    and assessment.subject_offering_id = p_subject_offering_id
    and assessment.term_id = p_term_id
    and assessment.status in ('PUBLISHED', 'CLOSED');

  if published_assessment_count = 0 then
    raise exception
      'Nao ha avaliacoes publicadas para o periodo.'
      using errcode = '23514';
  end if;

  select *
  into closure_row
  from public.term_closures as closure
  where closure.subject_offering_id = p_subject_offering_id
    and closure.term_id = p_term_id
  for update;

  if found and closure_row.status = 'CLOSED' then
    return closure_row;
  end if;

  with context as (
    select offering.class_id
    from public.subject_offerings as offering
    where offering.id = p_subject_offering_id
  ),
  eligible_students as (
    select enrollment.student_id
    from public.enrollments as enrollment
    join public.students as student
      on student.id = enrollment.student_id
    join context
      on context.class_id = enrollment.class_id
    where enrollment.academic_year_id = p_academic_year_id
      and enrollment.active is true
      and upper(enrollment.status) = 'ACTIVE'
      and enrollment.enrolled_at <= (
        term_end::timestamp + interval '1 day'
      )::timestamptz
      and student.institution_id = p_institution_id
      and student.active is true
  ),
  published_assessments as (
    select assessment.id
    from public.assessments as assessment
    where assessment.institution_id = p_institution_id
      and assessment.subject_offering_id = p_subject_offering_id
      and assessment.term_id = p_term_id
      and assessment.status in ('PUBLISHED', 'CLOSED')
      and assessment.max_score > 0
      and assessment.weight > 0
  )
  select count(*)::integer
  into pending_count
  from eligible_students as student
  cross join published_assessments as assessment
  left join public.grades as grade
    on grade.assessment_id = assessment.id
   and grade.student_id = student.student_id
   and grade.institution_id = p_institution_id
  where grade.id is null
     or grade.status = 'PENDING';

  if pending_count > 0 then
    raise exception
      'Existem notas pendentes para alunos obrigatorios.'
      using errcode = '23514';
  end if;

  select count(*)::integer
  into closed_session_count
  from public.attendance_sessions as attendance_session
  where attendance_session.institution_id = p_institution_id
    and attendance_session.subject_offering_id = p_subject_offering_id
    and attendance_session.status = 'CLOSED'
    and attendance_session.session_date between term_start and term_end;

  if closed_session_count = 0 then
    raise exception
      'Registre e feche ao menos uma chamada no periodo.'
      using errcode = '23514';
  end if;

  with context as (
    select offering.class_id
    from public.subject_offerings as offering
    where offering.id = p_subject_offering_id
  ),
  eligible_students as (
    select enrollment.student_id
    from public.enrollments as enrollment
    join public.students as student
      on student.id = enrollment.student_id
    join context
      on context.class_id = enrollment.class_id
    where enrollment.academic_year_id = p_academic_year_id
      and enrollment.active is true
      and upper(enrollment.status) = 'ACTIVE'
      and enrollment.enrolled_at <= (
        term_end::timestamp + interval '1 day'
      )::timestamptz
      and student.institution_id = p_institution_id
      and student.active is true
  ),
  grade_results as (
    select
      student.student_id,
      case
        when sum(assessment.weight) filter (
          where grade.status = 'GRADED'
            and grade.score is not null
        ) is null then null
        else round(
          (
            sum(
              (grade.score / assessment.max_score)
              * 100
              * assessment.weight
            ) filter (
              where grade.status = 'GRADED'
                and grade.score is not null
            )
            / sum(assessment.weight) filter (
              where grade.status = 'GRADED'
                and grade.score is not null
            )
          )::numeric,
          policy_row.decimal_places
        )
      end as grade_percentage
    from eligible_students as student
    left join public.assessments as assessment
      on assessment.institution_id = p_institution_id
     and assessment.subject_offering_id = p_subject_offering_id
     and assessment.term_id = p_term_id
     and assessment.status in ('PUBLISHED', 'CLOSED')
     and assessment.max_score > 0
     and assessment.weight > 0
    left join public.grades as grade
      on grade.assessment_id = assessment.id
     and grade.student_id = student.student_id
     and grade.institution_id = p_institution_id
    group by student.student_id
  ),
  attendance_results as (
    select
      student.student_id,
      case
        when count(attendance_record.id) = 0 then null
        else round(
          (
            (
              count(attendance_record.id) filter (
                where attendance_record.status in (
                  'PRESENT',
                  'LATE'
                )
              )
            )::numeric
            / count(attendance_record.id)::numeric
            * 100
          ),
          policy_row.decimal_places
        )
      end as attendance_percentage
    from eligible_students as student
    left join public.attendance_sessions as attendance_session
      on attendance_session.institution_id = p_institution_id
     and attendance_session.subject_offering_id = p_subject_offering_id
     and attendance_session.status = 'CLOSED'
     and attendance_session.session_date between term_start and term_end
    left join public.attendance_records as attendance_record
      on attendance_record.attendance_session_id = attendance_session.id
     and attendance_record.student_id = student.student_id
     and attendance_record.institution_id = p_institution_id
    group by student.student_id
  )
  select count(*)::integer
  into insufficient_result_count
  from eligible_students as student
  left join grade_results
    on grade_results.student_id = student.student_id
  left join attendance_results
    on attendance_results.student_id = student.student_id
  where grade_results.grade_percentage is null
     or attendance_results.attendance_percentage is null;

  if insufficient_result_count > 0 then
    raise exception
      'Existem alunos sem dados suficientes para fechamento.'
      using errcode = '23514';
  end if;

  with context as (
    select offering.class_id
    from public.subject_offerings as offering
    where offering.id = p_subject_offering_id
  ),
  eligible_students as (
    select enrollment.student_id
    from public.enrollments as enrollment
    join public.students as student
      on student.id = enrollment.student_id
    join context
      on context.class_id = enrollment.class_id
    where enrollment.academic_year_id = p_academic_year_id
      and enrollment.active is true
      and upper(enrollment.status) = 'ACTIVE'
      and enrollment.enrolled_at <= (
        term_end::timestamp + interval '1 day'
      )::timestamptz
      and student.institution_id = p_institution_id
      and student.active is true
  ),
  grade_results as (
    select
      student.student_id,
      case
        when sum(assessment.weight) filter (
          where grade.status = 'GRADED'
            and grade.score is not null
        ) is null then null
        else round(
          (
            sum(
              (grade.score / assessment.max_score)
              * 100
              * assessment.weight
            ) filter (
              where grade.status = 'GRADED'
                and grade.score is not null
            )
            / sum(assessment.weight) filter (
              where grade.status = 'GRADED'
                and grade.score is not null
            )
          )::numeric,
          policy_row.decimal_places
        )
      end as grade_percentage
    from eligible_students as student
    left join public.assessments as assessment
      on assessment.institution_id = p_institution_id
     and assessment.subject_offering_id = p_subject_offering_id
     and assessment.term_id = p_term_id
     and assessment.status in ('PUBLISHED', 'CLOSED')
     and assessment.max_score > 0
     and assessment.weight > 0
    left join public.grades as grade
      on grade.assessment_id = assessment.id
     and grade.student_id = student.student_id
     and grade.institution_id = p_institution_id
    group by student.student_id
  ),
  attendance_results as (
    select
      student.student_id,
      case
        when count(attendance_record.id) = 0 then null
        else round(
          (
            (
              count(attendance_record.id) filter (
                where attendance_record.status in (
                  'PRESENT',
                  'LATE'
                )
              )
            )::numeric
            / count(attendance_record.id)::numeric
            * 100
          ),
          policy_row.decimal_places
        )
      end as attendance_percentage
    from eligible_students as student
    left join public.attendance_sessions as attendance_session
      on attendance_session.institution_id = p_institution_id
     and attendance_session.subject_offering_id = p_subject_offering_id
     and attendance_session.status = 'CLOSED'
     and attendance_session.session_date between term_start and term_end
    left join public.attendance_records as attendance_record
      on attendance_record.attendance_session_id = attendance_session.id
     and attendance_record.student_id = student.student_id
     and attendance_record.institution_id = p_institution_id
    group by student.student_id
  ),
  calculated_results as (
    select
      student.student_id,
      grade_results.grade_percentage,
      attendance_results.attendance_percentage,
      case
        when grade_results.grade_percentage is null
          or attendance_results.attendance_percentage is null
          then 'PENDING'
        when grade_results.grade_percentage
            >= policy_row.minimum_grade_percentage
          and attendance_results.attendance_percentage
            >= policy_row.minimum_attendance_percentage
          then 'APPROVED'
        when grade_results.grade_percentage
            < policy_row.minimum_grade_percentage
          and attendance_results.attendance_percentage
            < policy_row.minimum_attendance_percentage
          then 'FAILED_BY_GRADE_AND_ATTENDANCE'
        when grade_results.grade_percentage
            < policy_row.minimum_grade_percentage
          then 'FAILED_BY_GRADE'
        else 'FAILED_BY_ATTENDANCE'
      end as result_status
    from eligible_students as student
    left join grade_results
      on grade_results.student_id = student.student_id
    left join attendance_results
      on attendance_results.student_id = student.student_id
  )
  insert into public.student_term_results (
    institution_id,
    academic_year_id,
    term_id,
    subject_offering_id,
    student_id,
    grade_percentage,
    attendance_percentage,
    result_status,
    calculated_at,
    finalized_at
  )
  select
    p_institution_id,
    p_academic_year_id,
    p_term_id,
    p_subject_offering_id,
    calculated_results.student_id,
    calculated_results.grade_percentage,
    calculated_results.attendance_percentage,
    calculated_results.result_status,
    now(),
    now()
  from calculated_results
  where calculated_results.result_status <> 'PENDING'
  on conflict (student_id, subject_offering_id, term_id)
  do update set
    grade_percentage = excluded.grade_percentage,
    attendance_percentage = excluded.attendance_percentage,
    result_status = excluded.result_status,
    calculated_at = excluded.calculated_at,
    finalized_at = excluded.finalized_at;

  insert into public.term_closures (
    institution_id,
    academic_year_id,
    term_id,
    subject_offering_id,
    status,
    closed_by,
    closed_at
  )
  values (
    p_institution_id,
    p_academic_year_id,
    p_term_id,
    p_subject_offering_id,
    'CLOSED',
    auth.uid(),
    now()
  )
  on conflict (subject_offering_id, term_id)
  do update set
    status = 'CLOSED',
    closed_by = auth.uid(),
    closed_at = now()
  returning * into closure_row;

  return closure_row;
end;
$$;

create or replace function public.reopen_term_closure(
  p_institution_id uuid,
  p_term_closure_id uuid,
  p_reopen_reason text
)
returns public.term_closures
language plpgsql
security definer
set search_path = ''
as $$
declare
  closure_row public.term_closures;
begin
  if length(trim(coalesce(p_reopen_reason, ''))) = 0 then
    raise exception
      'Informe o motivo da reabertura.'
      using errcode = '23514';
  end if;

  if not public.is_institution_admin(p_institution_id) then
    raise exception
      'Usuario sem permissao para reabrir o periodo.'
      using errcode = '42501';
  end if;

  update public.term_closures
  set
    status = 'REOPENED',
    reopened_by = auth.uid(),
    reopened_at = now(),
    reopen_reason = trim(p_reopen_reason)
  where id = p_term_closure_id
    and institution_id = p_institution_id
    and status = 'CLOSED'
  returning * into closure_row;

  if not found then
    raise exception
      'Fechamento fechado nao encontrado para reabertura.'
      using errcode = '23514';
  end if;

  return closure_row;
end;
$$;

alter function private.term_offering_belongs_to_context(
  uuid,
  uuid,
  uuid,
  uuid
) owner to postgres;

alter function private.can_view_student_term_result(uuid, uuid)
  owner to postgres;

alter function private.prevent_closed_term_result_change()
  owner to postgres;

alter function private.prevent_invalid_term_closure_change()
  owner to postgres;

alter function public.submit_term_closure(uuid, uuid, uuid, uuid)
  owner to postgres;

alter function public.close_term_closure(uuid, uuid, uuid, uuid)
  owner to postgres;

alter function public.reopen_term_closure(uuid, uuid, text)
  owner to postgres;

revoke all on function private.term_offering_belongs_to_context(
  uuid,
  uuid,
  uuid,
  uuid
) from public, anon, authenticated;

revoke all on function private.can_view_student_term_result(uuid, uuid)
  from public, anon, authenticated;

revoke all on function private.prevent_closed_term_result_change()
  from public, anon, authenticated;

revoke all on function private.prevent_invalid_term_closure_change()
  from public, anon, authenticated;

revoke all on function public.submit_term_closure(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;

revoke all on function public.close_term_closure(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;

revoke all on function public.reopen_term_closure(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function private.term_offering_belongs_to_context(
  uuid,
  uuid,
  uuid,
  uuid
) to authenticated, service_role;

grant execute on function private.can_view_student_term_result(uuid, uuid)
  to authenticated, service_role;

grant execute on function private.prevent_closed_term_result_change()
  to service_role;

grant execute on function private.prevent_invalid_term_closure_change()
  to service_role;

grant execute on function public.submit_term_closure(uuid, uuid, uuid, uuid)
  to authenticated, service_role;

grant execute on function public.close_term_closure(uuid, uuid, uuid, uuid)
  to authenticated, service_role;

grant execute on function public.reopen_term_closure(uuid, uuid, text)
  to authenticated, service_role;

alter table public.academic_policies
  enable row level security;

alter table public.term_closures
  enable row level security;

alter table public.student_term_results
  enable row level security;

revoke all on table public.academic_policies
  from anon, authenticated;

revoke all on table public.term_closures
  from anon, authenticated;

revoke all on table public.student_term_results
  from anon, authenticated;

grant select, insert, update
  on table public.academic_policies
  to authenticated;

grant select
  on table public.term_closures
  to authenticated;

grant select
  on table public.student_term_results
  to authenticated;

grant all on table public.academic_policies
  to service_role;

grant all on table public.term_closures
  to service_role;

grant all on table public.student_term_results
  to service_role;

drop policy if exists academic_policies_select_policy
  on public.academic_policies;

create policy academic_policies_select_policy
on public.academic_policies
for select
to authenticated
using (
  public.can_access_institution(institution_id)
);

drop policy if exists academic_policies_insert_policy
  on public.academic_policies;

create policy academic_policies_insert_policy
on public.academic_policies
for insert
to authenticated
with check (
  public.is_institution_admin(institution_id)
);

drop policy if exists academic_policies_update_policy
  on public.academic_policies;

create policy academic_policies_update_policy
on public.academic_policies
for update
to authenticated
using (
  public.is_institution_admin(institution_id)
)
with check (
  public.is_institution_admin(institution_id)
);

drop policy if exists term_closures_select_policy
  on public.term_closures;

create policy term_closures_select_policy
on public.term_closures
for select
to authenticated
using (
  public.can_manage_institution_operations(institution_id)
  or private.is_teacher_for_offering(
    subject_offering_id,
    institution_id
  )
);

drop policy if exists student_term_results_select_policy
  on public.student_term_results;

create policy student_term_results_select_policy
on public.student_term_results
for select
to authenticated
using (
  private.can_view_student_term_result(
    student_id,
    institution_id
  )
  or private.is_teacher_for_offering(
    subject_offering_id,
    institution_id
  )
);

commit;
