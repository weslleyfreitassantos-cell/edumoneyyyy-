begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

alter table public.reenrollment_academic_closures
  add column if not exists closure_status text not null default 'LEGACY_UNVERIFIED',
  add column if not exists summary jsonb not null default '{}'::jsonb,
  add column if not exists source_digest text,
  add column if not exists current_run_id uuid;

alter table public.reenrollment_academic_closures
  drop constraint if exists reenrollment_academic_closures_status_v26_check;
alter table public.reenrollment_academic_closures
  add constraint reenrollment_academic_closures_status_v26_check
  check (closure_status in ('LEGACY_UNVERIFIED', 'CLOSED', 'STALE'));

create table public.reenrollment_academic_year_close_runs (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  run_number integer not null,
  closure_status text not null check (closure_status in ('LEGACY_UNVERIFIED', 'CLOSED')),
  source_digest text,
  summary jsonb not null default '{}'::jsonb,
  calculation_method text not null default 'ARITHMETIC_MEAN_PER_SUBJECT_V1',
  academic_policy_id uuid references public.academic_policies(id) on delete restrict,
  closed_by uuid not null references public.profiles(id) on delete restrict,
  closed_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (institution_id, academic_year_id, run_number)
);

create table public.student_academic_year_results (
  id uuid primary key default extensions.uuid_generate_v4(),
  close_run_id uuid not null references public.reenrollment_academic_year_close_runs(id) on delete restrict,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  source_enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  source_grade_level text,
  result_status text not null check (result_status in ('APPROVED', 'FAILED', 'GRADUATING')),
  average_percentage numeric(5, 2) not null check (average_percentage between 0 and 100),
  attendance_percentage numeric(5, 2) not null check (attendance_percentage between 0 and 100),
  subject_results jsonb not null,
  is_current boolean not null default true,
  finalized_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (close_run_id, student_id)
);

create index reenrollment_year_close_run_lookup_v26
  on public.reenrollment_academic_year_close_runs(institution_id, academic_year_id, run_number desc);
create index student_academic_year_result_lookup_v26
  on public.student_academic_year_results(institution_id, academic_year_id, student_id, finalized_at desc);

alter table public.reenrollment_academic_closures enable row level security;
alter table public.reenrollment_academic_year_close_runs enable row level security;
alter table public.student_academic_year_results enable row level security;

drop policy if exists reenrollment_year_close_runs_staff_v26
  on public.reenrollment_academic_year_close_runs;
create policy reenrollment_year_close_runs_staff_v26
on public.reenrollment_academic_year_close_runs
for select to authenticated
using (public.can_manage_institution_operations(institution_id));

drop policy if exists student_academic_year_results_authorized_v26
  on public.student_academic_year_results;
create policy student_academic_year_results_authorized_v26
on public.student_academic_year_results
for select to authenticated
using (
  public.can_manage_institution_operations(institution_id)
  or (is_current and private.reenrollment_user_can_act_on_student(institution_id, student_id))
);

revoke all on table public.reenrollment_academic_year_close_runs from public, anon, authenticated;
revoke all on table public.student_academic_year_results from public, anon, authenticated;
grant select on table public.reenrollment_academic_year_close_runs to authenticated;
grant select on table public.student_academic_year_results to authenticated;
grant all on table public.reenrollment_academic_year_close_runs to service_role;
grant all on table public.student_academic_year_results to service_role;

-- Preserve the date, actor, and notes of closures written by the earlier marker-only flow.
insert into public.reenrollment_academic_year_close_runs (
  institution_id, academic_year_id, run_number, closure_status, summary,
  calculation_method, closed_by, closed_at, notes
)
select closure.institution_id, closure.academic_year_id, 0, 'LEGACY_UNVERIFIED',
       jsonb_build_object('legacy_marker_only', true), 'LEGACY_MARKER_ONLY',
       closure.closed_by, closure.closed_at, closure.notes
from public.reenrollment_academic_closures closure
where not exists (
  select 1 from public.reenrollment_academic_year_close_runs run
  where run.institution_id = closure.institution_id
    and run.academic_year_id = closure.academic_year_id
    and run.run_number = 0
);

update public.reenrollment_academic_closures closure
set current_run_id = run.id,
    summary = coalesce(closure.summary, run.summary),
    closure_status = case when closure.closure_status = 'CLOSED' then 'CLOSED' else 'LEGACY_UNVERIFIED' end
from public.reenrollment_academic_year_close_runs run
where run.institution_id = closure.institution_id
  and run.academic_year_id = closure.academic_year_id
  and run.run_number = 0
  and closure.current_run_id is null;

alter table public.reenrollment_academic_closures
  drop constraint if exists reenrollment_academic_closures_current_run_v26_fk;
alter table public.reenrollment_academic_closures
  add constraint reenrollment_academic_closures_current_run_v26_fk
  foreign key (current_run_id)
  references public.reenrollment_academic_year_close_runs(id)
  on delete restrict;

alter table public.reenrollment_grade_rules
  add column if not exists justification text,
  add column if not exists exception_approved boolean not null default false;
update public.reenrollment_grade_rules
set justification = coalesce(nullif(trim(justification), ''), 'Regra legada preservada; revisar antes de aplicar como exceção.')
where justification is null or trim(justification) = '';
alter table public.reenrollment_grade_rules
  alter column justification set not null;
alter table public.reenrollment_grade_rules
  drop constraint if exists reenrollment_grade_rules_justification_v26_check;
alter table public.reenrollment_grade_rules
  add constraint reenrollment_grade_rules_justification_v26_check
  check (length(trim(justification)) > 0);

alter table public.reenrollment_academic_results
  drop constraint if exists reenrollment_academic_results_decision_origin_v26_check;
alter table public.reenrollment_academic_results
  drop constraint if exists reenrollment_academic_results_decision_origin_check;
alter table public.reenrollment_academic_results
  add constraint reenrollment_academic_results_decision_origin_v26_check
  check (decision_origin in ('ACADEMIC_TEAM', 'CLASS_COUNCIL', 'MANUAL_REVIEW', 'ACADEMIC_CALCULATION'));

create or replace function private.normalize_reenrollment_grade_level_v26(p_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized text;
  grade_number text;
  grade_match text[];
begin
  normalized := lower(trim(coalesce(p_value, '')));
  normalized := translate(normalized, 'áàâãéêíóôõúç', 'aaaaeeiooouc');
  normalized := regexp_replace(normalized, '[ºª°.]', '', 'g');

  if normalized ~ '(ensino[[:space:]]+medio|(^|[^a-z])em([^a-z]|$))' then
    grade_number := substring(normalized from '([1-3])');
    if grade_number is not null then return grade_number || ' EM'; end if;
    return null;
  end if;

  grade_match := regexp_match(normalized, '(^|[^0-9])([1-9])([^0-9]|$)');
  if grade_match is null then return null; end if;
  return grade_match[2];
end;
$$;

create or replace function private.next_reenrollment_grade_label_v26(p_level text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case upper(trim(coalesce(p_level, '')))
    when '1' then '1º ano'
    when '2' then '2º ano'
    when '3' then '3º ano'
    when '4' then '4º ano'
    when '5' then '5º ano'
    when '6' then '6º ano'
    when '7' then '7º ano'
    when '8' then '8º ano'
    when '9' then '9º ano'
    when '1 EM' then '1ª série do Ensino Médio'
    when '2 EM' then '2ª série do Ensino Médio'
    when '3 EM' then '3ª série do Ensino Médio'
    else null
  end;
$$;

-- Use a table-valued calculation so the preview and committed snapshot share exactly one rule.
create or replace function private.calculate_reenrollment_year_results_v26(
  p_institution_id uuid,
  p_academic_year_id uuid
)
returns table (
  student_id uuid,
  source_enrollment_id uuid,
  source_grade_level text,
  result_status text,
  average_percentage numeric,
  attendance_percentage numeric,
  subject_results jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with policy_row as (
    select policy.id, policy.minimum_grade_percentage,
           policy.minimum_attendance_percentage, policy.decimal_places
    from public.academic_policies policy
    where policy.institution_id = p_institution_id
      and policy.academic_year_id = p_academic_year_id
      and policy.active is true
  ), active_enrollments as (
    select enrollment.id as enrollment_id, enrollment.student_id,
           enrollment.class_id, class_record.grade_level, enrollment.enrolled_at
    from public.enrollments enrollment
    join public.classes class_record on class_record.id = enrollment.class_id
    join public.students student on student.id = enrollment.student_id
    where enrollment.academic_year_id = p_academic_year_id
      and enrollment.active is true
      and upper(enrollment.status) = 'ACTIVE'
      and class_record.institution_id = p_institution_id
      and class_record.academic_year_id = p_academic_year_id
      and class_record.active is true
      and student.institution_id = p_institution_id
      and student.active is true
  ), active_offerings as (
    select offering.id, offering.class_id, offering.subject_id, term.id as term_id,
           term.end_date as term_end_date, subject_record.name as subject_name
    from public.subject_offerings offering
    join public.classes class_record on class_record.id = offering.class_id
    join public.terms term on term.id = offering.term_id
    join public.subjects subject_record on subject_record.id = offering.subject_id
    where offering.active is true
      and class_record.institution_id = p_institution_id
      and class_record.academic_year_id = p_academic_year_id
      and class_record.active is true
      and term.academic_year_id = p_academic_year_id
      and term.active is true
      and subject_record.institution_id = p_institution_id
      and subject_record.active is true
  ), by_subject as (
    select enrollment.student_id, enrollment.enrollment_id,
           enrollment.grade_level as source_grade_level,
           offering.subject_id, offering.subject_name,
           round(avg(result.final_grade_percentage), policy.decimal_places) as grade_average,
           round(avg(result.attendance_percentage), policy.decimal_places) as attendance_average,
           bool_or(result.recovery_percentage is not null) as recovery_applied
    from active_enrollments enrollment
    join active_offerings offering on offering.class_id = enrollment.class_id
    join public.student_term_results result
      on result.institution_id = p_institution_id
     and result.academic_year_id = p_academic_year_id
     and result.student_id = enrollment.student_id
     and result.subject_offering_id = offering.id
     and result.term_id = offering.term_id
     and result.finalized_at is not null
     and result.result_status <> 'PENDING'
     and result.final_grade_percentage is not null
     and result.attendance_percentage is not null
      and enrollment.enrolled_at <= (offering.term_end_date::timestamp + interval '1 day')::timestamptz
    cross join policy_row policy
    group by enrollment.student_id, enrollment.enrollment_id,
             enrollment.grade_level, offering.subject_id,
             offering.subject_name, policy.decimal_places
  ), subject_decisions as (
    select subject.student_id, subject.enrollment_id, subject.source_grade_level,
           subject.subject_id, subject.subject_name,
           subject.grade_average, subject.attendance_average, subject.recovery_applied,
           policy.minimum_grade_percentage, policy.minimum_attendance_percentage,
           subject.grade_average >= policy.minimum_grade_percentage
             and subject.attendance_average >= policy.minimum_attendance_percentage as passed
    from by_subject subject
    cross join policy_row policy
  ), student_decisions as (
    select subject.student_id, subject.enrollment_id, subject.source_grade_level,
           case
             when bool_and(subject.passed)
               and private.normalize_reenrollment_grade_level_v26(subject.source_grade_level) = '3 EM'
               then 'GRADUATING'
             when bool_and(subject.passed) then 'APPROVED'
             else 'FAILED'
           end as annual_status,
           round(avg(subject.grade_average), policy.decimal_places) as annual_average,
           round(avg(subject.attendance_average), policy.decimal_places) as annual_attendance,
           jsonb_agg(jsonb_build_object(
             'subject_id', subject.subject_id,
             'subject_name', subject.subject_name,
             'average_percentage', subject.grade_average,
             'attendance_percentage', subject.attendance_average,
             'recovery_applied', subject.recovery_applied,
             'result_status', case when subject.passed then 'APPROVED' else 'FAILED' end
           ) order by subject.subject_name, subject.subject_id) as subjects
    from subject_decisions subject
    cross join policy_row policy
    group by subject.student_id, subject.enrollment_id,
             subject.source_grade_level, policy.decimal_places
  )
  select decision.student_id, decision.enrollment_id,
         decision.source_grade_level, decision.annual_status,
         decision.annual_average, decision.annual_attendance, decision.subjects
  from student_decisions decision;
$$;

create or replace function private.reenrollment_year_close_preview_v26(
  p_institution_id uuid,
  p_academic_year_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  class_count integer := 0;
  class_without_offering_count integer := 0;
  term_count integer := 0;
  offering_count integer := 0;
  closed_offering_count integer := 0;
  enrollment_count integer := 0;
  duplicate_enrollment_count integer := 0;
  expected_result_count integer := 0;
  complete_result_count integer := 0;
  draft_recovery_count integer := 0;
  approved_student_count integer := 0;
  failed_student_count integer := 0;
  graduating_student_count integer := 0;
  recovery_student_count integer := 0;
  missing_result_student_count integer := 0;
  recovery_not_applied_count integer := 0;
  transfer_review_student_count integer := 0;
  policy_count integer := 0;
  source_digest_value text;
  closure_state text;
  closure_digest text;
  current_run uuid;
  closure_closed_at timestamptz;
  closure_closed_by uuid;
  closure_actor_name text;
  current_run_number integer;
  current_run_method text;
  blocker_list jsonb := '[]'::jsonb;
  result_state text;
  summary jsonb;
begin
  if auth.uid() is null or not public.can_manage_institution_operations(p_institution_id) then
    raise exception 'REENROLLMENT_CLOSURE_NOT_ALLOWED' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.academic_years year_record
    where year_record.id = p_academic_year_id
      and year_record.institution_id = p_institution_id
  ) then
    raise exception 'REENROLLMENT_YEAR_NOT_IN_INSTITUTION';
  end if;

  select count(*) into class_count
  from public.classes class_record
  where class_record.institution_id = p_institution_id
    and class_record.academic_year_id = p_academic_year_id
    and class_record.active is true;

  select count(*) into term_count
  from public.terms term
  where term.academic_year_id = p_academic_year_id and term.active is true;

  select count(*), count(*) filter (where closure.status = 'CLOSED')
    into offering_count, closed_offering_count
  from public.subject_offerings offering
  join public.classes class_record on class_record.id = offering.class_id
  join public.terms term on term.id = offering.term_id
  left join public.term_closures closure
    on closure.subject_offering_id = offering.id
   and closure.term_id = offering.term_id
   and closure.institution_id = p_institution_id
   and closure.academic_year_id = p_academic_year_id
  where offering.active is true
    and class_record.institution_id = p_institution_id
    and class_record.academic_year_id = p_academic_year_id
    and class_record.active is true
    and term.academic_year_id = p_academic_year_id
    and term.active is true;

  select count(*) into class_without_offering_count
  from public.classes class_record
  where class_record.institution_id = p_institution_id
    and class_record.academic_year_id = p_academic_year_id
    and class_record.active is true
    and not exists (
      select 1 from public.subject_offerings offering
      join public.terms term on term.id = offering.term_id
      where offering.class_id = class_record.id
        and offering.active is true
        and term.academic_year_id = p_academic_year_id
        and term.active is true
    );

  select count(*) into enrollment_count
  from public.enrollments enrollment
  join public.classes class_record on class_record.id = enrollment.class_id
  join public.students student on student.id = enrollment.student_id
  where enrollment.academic_year_id = p_academic_year_id
    and enrollment.active is true
    and upper(enrollment.status) = 'ACTIVE'
    and class_record.institution_id = p_institution_id
    and class_record.academic_year_id = p_academic_year_id
    and class_record.active is true
    and student.institution_id = p_institution_id
    and student.active is true;

  select count(*) into duplicate_enrollment_count
  from (
    select enrollment.student_id
    from public.enrollments enrollment
    join public.classes class_record on class_record.id = enrollment.class_id
    join public.students student on student.id = enrollment.student_id
    where enrollment.academic_year_id = p_academic_year_id
      and enrollment.active is true
      and upper(enrollment.status) = 'ACTIVE'
      and class_record.institution_id = p_institution_id
      and class_record.active is true
    group by enrollment.student_id
    having count(*) > 1
  ) duplicates;

  with active_enrollments as (
    select enrollment.student_id, enrollment.class_id, enrollment.enrolled_at
    from public.enrollments enrollment
    join public.classes class_record on class_record.id = enrollment.class_id
    join public.students student on student.id = enrollment.student_id
    where enrollment.academic_year_id = p_academic_year_id
      and enrollment.active is true
      and upper(enrollment.status) = 'ACTIVE'
      and class_record.institution_id = p_institution_id
      and class_record.academic_year_id = p_academic_year_id
      and class_record.active is true
      and student.institution_id = p_institution_id
      and student.active is true
  ), expected as (
    select enrollment.student_id, offering.id as offering_id,
           offering.term_id, closure.status as closure_status,
           result.id as result_id, result.finalized_at,
           result.final_grade_percentage, result.attendance_percentage,
           result.result_status, result.recovery_percentage,
           recovery.status as recovery_status,
           recovery.recovery_percentage as published_recovery_percentage
    from active_enrollments enrollment
    join public.subject_offerings offering
      on offering.class_id = enrollment.class_id and offering.active is true
    join public.terms term
      on term.id = offering.term_id
     and term.academic_year_id = p_academic_year_id
     and term.active is true
    left join public.term_closures closure
      on closure.institution_id = p_institution_id
     and closure.academic_year_id = p_academic_year_id
     and closure.subject_offering_id = offering.id
     and closure.term_id = offering.term_id
    left join public.student_term_results result
      on result.institution_id = p_institution_id
     and result.academic_year_id = p_academic_year_id
     and result.student_id = enrollment.student_id
     and result.subject_offering_id = offering.id
     and result.term_id = offering.term_id
    left join public.student_term_recoveries recovery
      on recovery.institution_id = p_institution_id
     and recovery.academic_year_id = p_academic_year_id
     and recovery.student_id = enrollment.student_id
     and recovery.subject_offering_id = offering.id
     and recovery.term_id = offering.term_id
    where enrollment.enrolled_at <= (term.end_date::timestamp + interval '1 day')::timestamptz
  )
  select count(*), count(*) filter (
           where expected.closure_status = 'CLOSED'
             and expected.finalized_at is not null
             and expected.result_status is distinct from 'PENDING'
             and expected.final_grade_percentage is not null
             and expected.attendance_percentage is not null
         ), count(*) filter (
           where exists (
             select 1 from public.student_term_recoveries recovery
             where recovery.institution_id = p_institution_id
               and recovery.academic_year_id = p_academic_year_id
               and recovery.student_id = expected.student_id
               and recovery.subject_offering_id = expected.offering_id
               and recovery.term_id = expected.term_id
               and recovery.status = 'DRAFT'
           )
         ), count(distinct expected.student_id) filter (
             where expected.closure_status is distinct from 'CLOSED'
                or expected.finalized_at is null
                or expected.result_status is null
                or expected.result_status = 'PENDING'
                or expected.final_grade_percentage is null
                or expected.attendance_percentage is null
         ), count(distinct expected.student_id) filter (
             where expected.recovery_status = 'DRAFT'
         ), count(distinct expected.student_id) filter (
             where expected.recovery_status = 'PUBLISHED'
               and expected.recovery_percentage is distinct from expected.published_recovery_percentage
         )
    into expected_result_count, complete_result_count, draft_recovery_count,
         missing_result_student_count, recovery_student_count, recovery_not_applied_count
  from expected;

  select count(distinct active_enrollment.student_id)
    into transfer_review_student_count
  from public.enrollments active_enrollment
  join public.classes active_class on active_class.id = active_enrollment.class_id
  join public.students student on student.id = active_enrollment.student_id
  where active_enrollment.academic_year_id = p_academic_year_id
    and active_enrollment.active is true
    and upper(active_enrollment.status) = 'ACTIVE'
    and active_class.institution_id = p_institution_id
    and active_class.academic_year_id = p_academic_year_id
    and active_class.active is true
    and student.institution_id = p_institution_id
    and student.active is true
    and exists (
      select 1
      from public.enrollments prior_enrollment
      join public.classes prior_class on prior_class.id = prior_enrollment.class_id
      where prior_enrollment.student_id = active_enrollment.student_id
        and prior_enrollment.academic_year_id = p_academic_year_id
        and prior_enrollment.id <> active_enrollment.id
        and prior_enrollment.class_id <> active_enrollment.class_id
        and (prior_enrollment.active is false or upper(prior_enrollment.status) <> 'ACTIVE')
        and prior_class.institution_id = p_institution_id
        and prior_class.academic_year_id = p_academic_year_id
    );

  select count(*) into policy_count
  from public.academic_policies policy
  where policy.institution_id = p_institution_id
    and policy.academic_year_id = p_academic_year_id
    and policy.active is true;

  select count(*) filter (where result.result_status = 'APPROVED'),
         count(*) filter (where result.result_status = 'FAILED'),
         count(*) filter (where result.result_status = 'GRADUATING')
    into approved_student_count, failed_student_count, graduating_student_count
  from private.calculate_reenrollment_year_results_v26(p_institution_id, p_academic_year_id) result;

  with source_parts as (
    select 'C:' || class_record.id::text || ':' || coalesce(class_record.grade_level, '') || ':' || class_record.active::text as part
    from public.classes class_record
    where class_record.institution_id = p_institution_id
      and class_record.academic_year_id = p_academic_year_id
      and class_record.active is true
    union all
    select 'T:' || term.id::text || ':' || coalesce(term.name, '') || ':' || term.active::text || ':' || coalesce(term.end_date::text, '')
    from public.terms term where term.academic_year_id = p_academic_year_id
    union all
    select 'O:' || offering.id::text || ':' || offering.class_id::text || ':' || offering.subject_id::text || ':' || offering.term_id::text || ':' || offering.active::text
    from public.subject_offerings offering
    join public.classes class_record on class_record.id = offering.class_id
    where class_record.institution_id = p_institution_id
      and class_record.academic_year_id = p_academic_year_id
    union all
    select 'SUB:' || subject.id::text || ':' || subject.active::text
    from public.subjects subject
    join public.subject_offerings offering on offering.subject_id = subject.id
    join public.classes class_record on class_record.id = offering.class_id
    where subject.institution_id = p_institution_id
      and class_record.institution_id = p_institution_id
      and class_record.academic_year_id = p_academic_year_id
    union all
    select 'C:' || closure.subject_offering_id::text || ':' || closure.term_id::text || ':' || closure.status
    from public.term_closures closure
    where closure.institution_id = p_institution_id
      and closure.academic_year_id = p_academic_year_id
    union all
    select 'E:' || enrollment.id::text || ':' || enrollment.student_id::text || ':' || enrollment.class_id::text || ':' || enrollment.active::text || ':' || upper(enrollment.status) || ':' || enrollment.enrolled_at::text
    from public.enrollments enrollment
    join public.classes class_record on class_record.id = enrollment.class_id
    where enrollment.academic_year_id = p_academic_year_id
      and class_record.institution_id = p_institution_id
    union all
    select 'S:' || student.id::text || ':' || student.active::text
    from public.students student
    where student.institution_id = p_institution_id
    union all
    select 'R:' || result.id::text || ':' || result.student_id::text || ':' || result.subject_offering_id::text || ':' || result.term_id::text || ':' || coalesce(result.grade_percentage::text, '') || ':' || coalesce(result.final_grade_percentage::text, '') || ':' || coalesce(result.recovery_percentage::text, '') || ':' || coalesce(result.attendance_percentage::text, '') || ':' || result.result_status || ':' || coalesce(result.finalized_at::text, '')
    from public.student_term_results result
    where result.institution_id = p_institution_id
      and result.academic_year_id = p_academic_year_id
    union all
    select 'X:' || recovery.id::text || ':' || recovery.student_id::text || ':' || recovery.status || ':' || recovery.recovery_percentage::text
    from public.student_term_recoveries recovery
    where recovery.institution_id = p_institution_id
      and recovery.academic_year_id = p_academic_year_id
    union all
    select 'P:' || policy.id::text || ':' || policy.minimum_grade_percentage::text || ':' || policy.minimum_attendance_percentage::text || ':' || policy.decimal_places::text
    from public.academic_policies policy
    where policy.institution_id = p_institution_id
      and policy.academic_year_id = p_academic_year_id
  )
  select encode(extensions.digest(convert_to(coalesce(string_agg(source_parts.part, E'\n' order by source_parts.part), ''), 'UTF8'), 'sha256'), 'hex')
    into source_digest_value
  from source_parts;

  if class_count = 0 then blocker_list := blocker_list || jsonb_build_array('NO_ACTIVE_CLASSES'); end if;
  if term_count = 0 then blocker_list := blocker_list || jsonb_build_array('NO_ACTIVE_TERMS'); end if;
  if offering_count = 0 then blocker_list := blocker_list || jsonb_build_array('NO_ACTIVE_OFFERINGS'); end if;
  if class_without_offering_count > 0 then blocker_list := blocker_list || jsonb_build_array('CLASSES_WITHOUT_OFFERINGS'); end if;
  if enrollment_count = 0 then blocker_list := blocker_list || jsonb_build_array('NO_ACTIVE_ENROLLMENTS'); end if;
  if duplicate_enrollment_count > 0 then blocker_list := blocker_list || jsonb_build_array('DUPLICATE_ACTIVE_ENROLLMENTS'); end if;
  if offering_count > closed_offering_count then blocker_list := blocker_list || jsonb_build_array('PENDING_TERM_CLOSURES'); end if;
  if expected_result_count = 0 or expected_result_count > complete_result_count then blocker_list := blocker_list || jsonb_build_array('MISSING_FINAL_RESULTS'); end if;
  if draft_recovery_count > 0 then blocker_list := blocker_list || jsonb_build_array('DRAFT_RECOVERIES'); end if;
  if recovery_not_applied_count > 0 then blocker_list := blocker_list || jsonb_build_array('PUBLISHED_RECOVERY_NOT_APPLIED'); end if;
  if transfer_review_student_count > 0 then blocker_list := blocker_list || jsonb_build_array('TRANSFER_HISTORY_REQUIRES_REVIEW'); end if;
  if policy_count <> 1 then blocker_list := blocker_list || jsonb_build_array('ACADEMIC_POLICY_MISSING_OR_AMBIGUOUS'); end if;

  select closure.closure_status, closure.source_digest, closure.current_run_id
    into closure_state, closure_digest, current_run
  from public.reenrollment_academic_closures closure
  where closure.institution_id = p_institution_id
    and closure.academic_year_id = p_academic_year_id;

  select closure.closed_at, closure.closed_by, profile.full_name,
         run.run_number, run.calculation_method
    into closure_closed_at, closure_closed_by, closure_actor_name,
         current_run_number, current_run_method
  from public.reenrollment_academic_closures closure
  left join public.profiles profile on profile.id = closure.closed_by
  left join public.reenrollment_academic_year_close_runs run on run.id = closure.current_run_id
  where closure.institution_id = p_institution_id
    and closure.academic_year_id = p_academic_year_id;

  if jsonb_array_length(blocker_list) > 0 then
    result_state := 'HAS_BLOCKERS';
  elsif closure_state = 'CLOSED' and closure_digest = source_digest_value then
    result_state := 'ALREADY_CLOSED';
  elsif closure_state in ('CLOSED', 'STALE') then
    result_state := 'READY_AFTER_SOURCE_CHANGE';
  elsif closure_state = 'LEGACY_UNVERIFIED' then
    result_state := 'READY_AFTER_LEGACY_MARKER';
  else
    result_state := 'READY';
  end if;

  summary := jsonb_build_object(
    'active_classes', class_count,
    'classes_without_offerings', class_without_offering_count,
    'active_terms', term_count,
    'active_offerings', offering_count,
    'closed_offerings', closed_offering_count,
    'pending_offerings', greatest(offering_count - closed_offering_count, 0),
    'active_enrollments', enrollment_count,
    'duplicate_enrollment_students', duplicate_enrollment_count,
    'expected_student_period_results', expected_result_count,
    'complete_student_period_results', complete_result_count,
    'missing_student_period_results', greatest(expected_result_count - complete_result_count, 0),
    'students_missing_final_results', missing_result_student_count,
    'draft_recoveries', draft_recovery_count,
    'students_in_recovery', recovery_student_count,
    'published_recoveries_not_applied', recovery_not_applied_count,
    'students_requiring_transfer_review', transfer_review_student_count,
    'approved_students', approved_student_count,
    'failed_students', failed_student_count,
    'graduating_students', graduating_student_count,
    'policy_count', policy_count
  );

  return jsonb_build_object(
    'state', result_state,
    'can_close', jsonb_array_length(blocker_list) = 0 and result_state <> 'ALREADY_CLOSED',
    'blockers', blocker_list,
    'summary', summary,
    'source_digest', source_digest_value,
    'current_run_id', current_run,
    'closure_status', closure_state,
    'closed_at', closure_closed_at,
    'closed_by', closure_closed_by,
    'closed_by_name', closure_actor_name,
    'run_number', current_run_number,
    'calculation_method', current_run_method
  );
end;
$$;

create or replace function public.get_reenrollment_year_close_preview_v26(
  p_institution_id uuid,
  p_academic_year_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.reenrollment_year_close_preview_v26(p_institution_id, p_academic_year_id);
$$;

revoke all on function private.normalize_reenrollment_grade_level_v26(text) from public, anon, authenticated;
revoke all on function private.next_reenrollment_grade_label_v26(text) from public, anon, authenticated;
revoke all on function private.calculate_reenrollment_year_results_v26(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function private.reenrollment_year_close_preview_v26(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_reenrollment_year_close_preview_v26(uuid, uuid) from public, anon;
grant execute on function public.get_reenrollment_year_close_preview_v26(uuid, uuid) to authenticated;

create or replace function private.sync_reenrollment_request_year_result_v26(
  p_request_id uuid,
  p_run_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.reenrollment_requests%rowtype;
  campaign public.reenrollment_campaigns%rowtype;
  annual_result public.student_academic_year_results%rowtype;
  existing_academic_result public.reenrollment_academic_results%rowtype;
  close_run public.reenrollment_academic_year_close_runs%rowtype;
  grade_rule public.reenrollment_grade_rules%rowtype;
  source_level text;
  next_level text;
  next_grade text;
  result_status_value text;
  pending_reason_value text;
  candidate_class_id uuid;
  available_class_count integer := 0;
  total_class_count integer := 0;
  previous_finalizing text;
begin
  select * into request_row from public.reenrollment_requests
  where id = p_request_id for update;
  if not found then return; end if;

  select * into campaign from public.reenrollment_campaigns
  where id = request_row.campaign_id;
  select * into close_run from public.reenrollment_academic_year_close_runs
  where id = p_run_id and institution_id = request_row.institution_id
    and academic_year_id = campaign.source_academic_year_id
    and closure_status = 'CLOSED';
  if not found then return; end if;

  select * into annual_result from public.student_academic_year_results
  where close_run_id = close_run.id and student_id = request_row.student_id
    and institution_id = request_row.institution_id;
  if not found then return; end if;

  candidate_class_id := null;
  available_class_count := 0;

  select * into existing_academic_result
  from public.reenrollment_academic_results result
  where result.request_id = request_row.id;
  if found
    and existing_academic_result.decision_origin = 'CLASS_COUNCIL'
    and existing_academic_result.homologated_at is not null then
    insert into public.reenrollment_audit_events (
      institution_id, campaign_id, request_id, action, actor_profile_id, metadata
    ) values (
      request_row.institution_id, request_row.campaign_id, request_row.id,
      'HOMOLOGATED_CLASS_COUNCIL_RESULT_PRESERVED', close_run.closed_by,
      jsonb_build_object('close_run_id', close_run.id,
        'result_status', existing_academic_result.result_status)
    );
    perform private.finalize_reenrollment_v25_core(request_row.id);
    return;
  end if;

  source_level := private.normalize_reenrollment_grade_level_v26(annual_result.source_grade_level);
  result_status_value := annual_result.result_status;
  next_grade := null;
  pending_reason_value := null;

  select * into grade_rule from public.reenrollment_grade_rules rule
  where rule.institution_id = request_row.institution_id
    and rule.active is true
    and rule.exception_approved is true
    and lower(trim(rule.source_grade_level)) = lower(trim(coalesce(annual_result.source_grade_level, '')))
  limit 1;

  if found and grade_rule.promotion_policy = 'GRADUATE' then
    result_status_value := 'GRADUATING';
  elsif found and grade_rule.promotion_policy = 'MANUAL' then
      pending_reason_value := 'SERIE_DESTINO_NAO_DEFINIDA';
  elsif found and grade_rule.promotion_policy = 'RETAIN' then
      next_grade := annual_result.source_grade_level;
  elsif found and grade_rule.promotion_policy = 'PROMOTE' then
    next_grade := grade_rule.destination_grade_level;
    select min(class_record.grade_level) into next_grade
    from public.classes class_record
    where class_record.institution_id = request_row.institution_id
      and class_record.academic_year_id = campaign.destination_academic_year_id
      and class_record.active is true
      and private.normalize_reenrollment_grade_level_v26(class_record.grade_level)
        = private.normalize_reenrollment_grade_level_v26(grade_rule.destination_grade_level);
    next_grade := coalesce(next_grade, grade_rule.destination_grade_level);
  elsif annual_result.result_status = 'FAILED' then
    next_grade := annual_result.source_grade_level;
  elsif annual_result.result_status = 'GRADUATING' then
    result_status_value := 'GRADUATING';
  elsif source_level = '3 EM' then
    result_status_value := 'GRADUATING';
  elsif source_level is null then
    pending_reason_value := 'SERIE_DESTINO_NAO_DEFINIDA';
  else
    next_level := case source_level
      when '1' then '2' when '2' then '3' when '3' then '4'
      when '4' then '5' when '5' then '6' when '6' then '7'
      when '7' then '8' when '8' then '9' when '9' then '1 EM'
      when '1 EM' then '2 EM' when '2 EM' then '3 EM'
      else null end;
    next_grade := private.next_reenrollment_grade_label_v26(next_level);
    select min(class_record.grade_level) into next_grade
    from public.classes class_record
    where class_record.institution_id = request_row.institution_id
      and class_record.academic_year_id = campaign.destination_academic_year_id
      and class_record.active is true
      and private.normalize_reenrollment_grade_level_v26(class_record.grade_level) = next_level;
    next_grade := coalesce(next_grade, private.next_reenrollment_grade_label_v26(next_level));
    if next_grade is null then pending_reason_value := 'SERIE_DESTINO_NAO_DEFINIDA'; end if;
  end if;

  if result_status_value <> 'GRADUATING' and next_grade is not null then
    select count(*) into total_class_count
    from public.classes class_record
    where class_record.institution_id = request_row.institution_id
      and class_record.academic_year_id = campaign.destination_academic_year_id
      and class_record.active is true
      and private.normalize_reenrollment_grade_level_v26(class_record.grade_level)
        = private.normalize_reenrollment_grade_level_v26(next_grade)
      and lower(trim(class_record.grade_level)) = lower(trim(next_grade));

    if request_row.destination_class_id is not null then
      select class_record.id into candidate_class_id
      from public.classes class_record
      where class_record.id = request_row.destination_class_id
        and class_record.institution_id = request_row.institution_id
        and class_record.academic_year_id = campaign.destination_academic_year_id
        and class_record.active is true
        and private.normalize_reenrollment_grade_level_v26(class_record.grade_level)
          = private.normalize_reenrollment_grade_level_v26(next_grade)
        and lower(trim(class_record.grade_level)) = lower(trim(next_grade))
        and (
          class_record.capacity <= 0
          or (select count(*) from public.enrollments enrollment
              where enrollment.class_id = class_record.id and enrollment.active is true)
             < class_record.capacity
        );
      if found then available_class_count := 1; end if;
    end if;

    if candidate_class_id is null then
      select count(*), (array_agg(candidate.id order by candidate.id))[1]
        into available_class_count, candidate_class_id
      from (
        select class_record.id
        from public.classes class_record
        where class_record.institution_id = request_row.institution_id
          and class_record.academic_year_id = campaign.destination_academic_year_id
          and class_record.active is true
          and private.normalize_reenrollment_grade_level_v26(class_record.grade_level)
            = private.normalize_reenrollment_grade_level_v26(next_grade)
          and lower(trim(class_record.grade_level)) = lower(trim(next_grade))
          and (
            class_record.capacity <= 0
            or (select count(*) from public.enrollments enrollment
                where enrollment.class_id = class_record.id and enrollment.active is true)
               < class_record.capacity
          )
        order by class_record.id
      ) candidate;
    end if;
    if total_class_count = 0 then
      candidate_class_id := null;
      pending_reason_value := 'TURMA_DESTINO_NAO_DEFINIDA';
    elsif available_class_count = 1 then
      pending_reason_value := null;
    elsif available_class_count = 0 then
      candidate_class_id := null;
      pending_reason_value := 'SEM_VAGA_NA_TURMA';
    else
      candidate_class_id := null;
      pending_reason_value := 'TURMA_DESTINO_NAO_DEFINIDA';
    end if;
  elsif result_status_value = 'GRADUATING' then
    pending_reason_value := 'CONCLUIDOR_TRATAMENTO_PROPRIO';
  end if;

  previous_finalizing := current_setting('tecescola.reenrollment_v25_finalizing', true);
  perform set_config('tecescola.reenrollment_v25_finalizing', 'on', true);

  update public.reenrollment_requests
  set source_grade_level = annual_result.source_grade_level,
      academic_status = result_status_value,
      destination_grade_level = next_grade,
      destination_class_id = candidate_class_id,
      pending_reason = pending_reason_value,
      request_status = case
        when confirmed_at is null then request_status
        when result_status_value = 'GRADUATING' then 'AWAITING_ACADEMIC_RESULT'
        when pending_reason_value is not null then 'AWAITING_ACADEMIC_RESULT'
        else 'READY_FOR_ENROLLMENT'
      end,
      reviewed_by = close_run.closed_by,
      reviewed_at = close_run.closed_at,
      updated_at = now()
  where id = request_row.id;

  insert into public.reenrollment_academic_results (
    institution_id, request_id, student_id, source_academic_year_id,
    result_status, average_percentage, attendance_percentage,
    recovery_pending, decision_origin, notes, recorded_by,
    academic_year_closed_at, homologated_by, homologated_at
  ) values (
    request_row.institution_id, request_row.id, request_row.student_id,
    campaign.source_academic_year_id, result_status_value,
    annual_result.average_percentage, annual_result.attendance_percentage,
    false, 'ACADEMIC_CALCULATION',
    'Média aritmética por disciplina; fechamento ' || close_run.id::text,
    close_run.closed_by, close_run.closed_at, close_run.closed_by, close_run.closed_at
  )
  on conflict (request_id) do update set
    result_status = excluded.result_status,
    average_percentage = excluded.average_percentage,
    attendance_percentage = excluded.attendance_percentage,
    recovery_pending = false,
    decision_origin = 'ACADEMIC_CALCULATION',
    notes = excluded.notes,
    recorded_by = excluded.recorded_by,
    academic_year_closed_at = excluded.academic_year_closed_at,
    homologated_by = excluded.homologated_by,
    homologated_at = excluded.homologated_at,
    updated_at = now();

  perform set_config(
    'tecescola.reenrollment_v25_finalizing',
    coalesce(previous_finalizing, 'off'),
    true
  );

  insert into public.reenrollment_audit_events (
    institution_id, campaign_id, request_id, action, actor_profile_id, metadata
  ) values (
    request_row.institution_id, request_row.campaign_id, request_row.id,
    'ANNUAL_RESULT_AUTOMATICALLY_CALCULATED', close_run.closed_by,
    jsonb_build_object('close_run_id', close_run.id, 'result_status', result_status_value,
      'destination_grade_level', next_grade, 'destination_class_id', candidate_class_id,
      'pending_reason', pending_reason_value)
  );

  if result_status_value = 'GRADUATING' then
    insert into public.reenrollment_completion_records (
      institution_id, campaign_id, request_id, student_id, status, created_by
    ) values (
      request_row.institution_id, request_row.campaign_id, request_row.id,
      request_row.student_id, 'PENDING', close_run.closed_by
    ) on conflict (request_id) do nothing;
  end if;

  perform private.finalize_reenrollment_v25_core(request_row.id);
end;
$$;

create or replace function public.close_reenrollment_academic_year_v2(
  p_institution_id uuid,
  p_academic_year_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  preview jsonb;
  blocker_list jsonb;
  summary jsonb;
  digest_value text;
  existing public.reenrollment_academic_closures%rowtype;
  policy_id_value uuid;
  next_run_number integer;
  close_run public.reenrollment_academic_year_close_runs%rowtype;
  result_row record;
  request_id_value uuid;
begin
  if auth.uid() is null or not public.can_manage_institution_operations(p_institution_id) then
    raise exception 'REENROLLMENT_CLOSURE_NOT_ALLOWED' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_institution_id::text || ':' || p_academic_year_id::text, 0));
  preview := private.reenrollment_year_close_preview_v26(p_institution_id, p_academic_year_id);
  blocker_list := preview -> 'blockers';
  if jsonb_array_length(coalesce(blocker_list, '[]'::jsonb)) > 0 then
    raise exception 'REENROLLMENT_YEAR_CLOSE_HAS_BLOCKERS'
      using detail = preview::text, errcode = '23514';
  end if;

  select * into existing from public.reenrollment_academic_closures closure
  where closure.institution_id = p_institution_id
    and closure.academic_year_id = p_academic_year_id
  for update;
  digest_value := preview ->> 'source_digest';
  if found and existing.closure_status = 'CLOSED' and existing.source_digest = digest_value then
    return jsonb_build_object('state', 'ALREADY_CLOSED', 'replayed', true,
      'summary', existing.summary, 'closed_at', existing.closed_at,
      'current_run_id', existing.current_run_id);
  end if;

  summary := preview -> 'summary';
  select policy.id into policy_id_value
  from public.academic_policies policy
  where policy.institution_id = p_institution_id
    and policy.academic_year_id = p_academic_year_id
    and policy.active is true;

  select coalesce(max(run.run_number), 0) + 1 into next_run_number
  from public.reenrollment_academic_year_close_runs run
  where run.institution_id = p_institution_id
    and run.academic_year_id = p_academic_year_id;

  update public.student_academic_year_results
  set is_current = false
  where institution_id = p_institution_id
    and academic_year_id = p_academic_year_id
    and is_current is true;

  insert into public.reenrollment_academic_year_close_runs (
    institution_id, academic_year_id, run_number, closure_status,
    source_digest, summary, calculation_method, academic_policy_id,
    closed_by, closed_at, notes
  ) values (
    p_institution_id, p_academic_year_id, next_run_number, 'CLOSED',
    digest_value, summary, 'ARITHMETIC_MEAN_PER_SUBJECT_V1', policy_id_value,
    auth.uid(), now(), nullif(trim(coalesce(p_notes, '')), '')
  ) returning * into close_run;

  insert into public.student_academic_year_results (
    close_run_id, institution_id, academic_year_id, student_id,
    source_enrollment_id, source_grade_level, result_status,
    average_percentage, attendance_percentage, subject_results, finalized_at
  )
  select close_run.id, p_institution_id, p_academic_year_id,
         calculated.student_id, calculated.source_enrollment_id,
         calculated.source_grade_level, calculated.result_status,
         calculated.average_percentage, calculated.attendance_percentage,
         calculated.subject_results, close_run.closed_at
  from private.calculate_reenrollment_year_results_v26(p_institution_id, p_academic_year_id) calculated;

  insert into public.reenrollment_academic_closures (
    institution_id, academic_year_id, closed_by, closed_at, notes,
    closure_status, summary, source_digest, current_run_id
  ) values (
    p_institution_id, p_academic_year_id, auth.uid(), close_run.closed_at,
    nullif(trim(coalesce(p_notes, '')), ''), 'CLOSED', summary, digest_value, close_run.id
  ) on conflict (institution_id, academic_year_id) do update set
    closed_by = excluded.closed_by,
    closed_at = excluded.closed_at,
    notes = excluded.notes,
    closure_status = 'CLOSED',
    summary = excluded.summary,
    source_digest = excluded.source_digest,
    current_run_id = excluded.current_run_id;

  for result_row in
    select request.id
    from public.reenrollment_requests request
    join public.reenrollment_campaigns campaign on campaign.id = request.campaign_id
    where request.institution_id = p_institution_id
      and campaign.source_academic_year_id = p_academic_year_id
      and request.request_status not in ('ENROLLED', 'CANCELLED', 'REJECTED')
    order by request.created_at, request.id
  loop
    perform private.sync_reenrollment_request_year_result_v26(result_row.id, close_run.id);
  end loop;

  insert into public.reenrollment_audit_events (
    institution_id, campaign_id, action, actor_profile_id, metadata
  ) values (
    p_institution_id, null, 'ACADEMIC_YEAR_CLOSED', auth.uid(),
    jsonb_build_object('academic_year_id', p_academic_year_id,
      'close_run_id', close_run.id, 'run_number', close_run.run_number,
      'calculation_method', close_run.calculation_method,
      'source_digest', close_run.source_digest, 'summary', close_run.summary)
  );

  return jsonb_build_object('state', 'CLOSED', 'replayed', false,
    'summary', summary, 'closed_at', close_run.closed_at,
    'closed_by', close_run.closed_by, 'current_run_id', close_run.id,
    'run_number', close_run.run_number,
    'calculation_method', close_run.calculation_method);
end;
$$;

revoke all on function private.sync_reenrollment_request_year_result_v26(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.close_reenrollment_academic_year_v2(uuid, uuid, text) from public, anon;
grant execute on function public.close_reenrollment_academic_year_v2(uuid, uuid, text) to authenticated;

-- A request started after year close reuses the audited snapshot rather than waiting for staff re-review.
create or replace function public.create_reenrollment_request_v2(
  target_campaign_id uuid,
  target_student_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_request jsonb;
  request_row public.reenrollment_requests%rowtype;
  campaign public.reenrollment_campaigns%rowtype;
  closure public.reenrollment_academic_closures%rowtype;
begin
  if auth.uid() is null then raise exception 'REENROLLMENT_AUTH_REQUIRED'; end if;
  created_request := private.create_reenrollment_request_v1(target_campaign_id, target_student_id);
  select * into request_row from public.reenrollment_requests
  where id = (created_request ->> 'id')::uuid for update;
  select * into campaign from public.reenrollment_campaigns where id = request_row.campaign_id;
  select * into closure from public.reenrollment_academic_closures
  where institution_id = request_row.institution_id
    and academic_year_id = campaign.source_academic_year_id
    and closure_status = 'CLOSED';

  if found and closure.current_run_id is not null then
    perform private.sync_reenrollment_request_year_result_v26(request_row.id, closure.current_run_id);
  end if;

  select * into request_row from public.reenrollment_requests where id = request_row.id;
  return to_jsonb(request_row);
end;
$$;

revoke all on function public.create_reenrollment_request_v2(uuid, uuid) from public, anon;
grant execute on function public.create_reenrollment_request_v2(uuid, uuid) to authenticated;

-- Replace V24's rule-required state while preserving its tested visibility core.
do $$
begin
  if to_regprocedure('public.get_my_reenrollment_status_core_v26(uuid)') is null
    and to_regprocedure('public.get_my_reenrollment_status_v23(uuid)') is not null then
    execute 'alter function public.get_my_reenrollment_status_v23(uuid) rename to get_my_reenrollment_status_core_v26';
  end if;
end;
$$;
revoke all on function public.get_my_reenrollment_status_core_v26(uuid) from public, anon, authenticated;
grant execute on function public.get_my_reenrollment_status_core_v26(uuid) to current_user;

create or replace function public.get_my_reenrollment_status_v23(p_institution_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payload jsonb;
  campaigns jsonb := '[]'::jsonb;
  students jsonb;
  campaign_item jsonb;
  student_item jsonb;
begin
  payload := public.get_my_reenrollment_status_core_v26(p_institution_id);
  if coalesce(jsonb_typeof(payload -> 'campaigns'), '') <> 'array' then return payload; end if;
  for campaign_item in select value from jsonb_array_elements(payload -> 'campaigns') loop
    students := '[]'::jsonb;
    for student_item in select value from jsonb_array_elements(coalesce(campaign_item -> 'eligible_students', '[]'::jsonb)) loop
      if student_item ->> 'eligibility_state' = 'GRADE_RULE_REQUIRED' then
        student_item := jsonb_set(student_item, '{eligibility_state}', to_jsonb('ELIGIBLE'::text), true);
      end if;
      students := students || jsonb_build_array(student_item);
    end loop;
    campaign_item := jsonb_set(campaign_item, '{eligible_students}', students, true);
    campaigns := campaigns || jsonb_build_array(campaign_item);
  end loop;
  return jsonb_set(payload, '{campaigns}', campaigns, true);
end;
$$;
revoke all on function public.get_my_reenrollment_status_v23(uuid) from public, anon;
grant execute on function public.get_my_reenrollment_status_v23(uuid) to authenticated;

create or replace function private.invalidate_reenrollment_year_close_v26()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  data_row jsonb;
  data_rows jsonb[];
  institution_value uuid;
  year_value uuid;
  stale_run_id uuid;
begin
  if tg_table_name = 'students' then
    select coalesce(array_agg(jsonb_build_object(
      'institution_id', context.institution_id,
      'academic_year_id', context.academic_year_id
    )), '{}'::jsonb[])
      into data_rows
    from (
      select distinct class_record.institution_id, enrollment.academic_year_id
      from public.enrollments enrollment
      join public.classes class_record on class_record.id = enrollment.class_id
      where enrollment.student_id = case when tg_op = 'DELETE' then old.id else new.id end
    ) context;
  elsif tg_table_name = 'subjects' then
    select coalesce(array_agg(jsonb_build_object(
      'institution_id', context.institution_id,
      'academic_year_id', context.academic_year_id
    )), '{}'::jsonb[])
      into data_rows
    from (
      select distinct class_record.institution_id, class_record.academic_year_id
      from public.subject_offerings offering
      join public.classes class_record on class_record.id = offering.class_id
      where offering.subject_id = case when tg_op = 'DELETE' then old.id else new.id end
    ) context;
  elsif tg_op = 'UPDATE' then
    data_rows := array[to_jsonb(old), to_jsonb(new)];
  elsif tg_op = 'DELETE' then
    data_rows := array[to_jsonb(old)];
  else
    data_rows := array[to_jsonb(new)];
  end if;

  foreach data_row in array data_rows loop
    institution_value := null;
    year_value := null;
    stale_run_id := null;

    if tg_table_name in ('term_closures', 'student_term_results', 'student_term_recoveries', 'academic_policies') then
      institution_value := (data_row ->> 'institution_id')::uuid;
      year_value := (data_row ->> 'academic_year_id')::uuid;
    elsif tg_table_name in ('students', 'subjects') then
      institution_value := (data_row ->> 'institution_id')::uuid;
      year_value := (data_row ->> 'academic_year_id')::uuid;
    elsif tg_table_name = 'classes' then
      institution_value := (data_row ->> 'institution_id')::uuid;
      year_value := (data_row ->> 'academic_year_id')::uuid;
    elsif tg_table_name = 'enrollments' then
      select class_record.institution_id into institution_value
      from public.classes class_record
      where class_record.id = (data_row ->> 'class_id')::uuid;
      year_value := (data_row ->> 'academic_year_id')::uuid;
    elsif tg_table_name = 'subject_offerings' then
      select class_record.institution_id, class_record.academic_year_id
        into institution_value, year_value
      from public.classes class_record
      where class_record.id = (data_row ->> 'class_id')::uuid;
    elsif tg_table_name = 'terms' then
      select year_record.institution_id, year_record.id
        into institution_value, year_value
      from public.academic_years year_record
      where year_record.id = (data_row ->> 'academic_year_id')::uuid;
    else
      continue;
    end if;

    if institution_value is null or year_value is null then continue; end if;

    update public.reenrollment_academic_closures closure
    set closure_status = 'STALE'
    where closure.institution_id = institution_value
      and closure.academic_year_id = year_value
      and closure.closure_status = 'CLOSED'
    returning closure.current_run_id into stale_run_id;

    if stale_run_id is not null then
      update public.reenrollment_academic_results academic_result
      set result_status = 'INCOMPLETE',
          homologated_at = null,
          homologated_by = null,
          notes = 'Resultado anual invalidado porque os dados acadêmicos de origem foram alterados.',
          updated_at = now()
      from public.reenrollment_requests request
      join public.reenrollment_campaigns campaign on campaign.id = request.campaign_id
      where academic_result.request_id = request.id
        and request.institution_id = institution_value
        and campaign.source_academic_year_id = year_value
        and academic_result.decision_origin = 'ACADEMIC_CALCULATION'
        and academic_result.homologated_at is not null;

      update public.student_academic_year_results
      set is_current = false
      where close_run_id = stale_run_id and is_current is true;
    end if;
  end loop;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.invalidate_reenrollment_year_close_v26() from public, anon, authenticated;

drop trigger if exists reenrollment_year_close_invalidate_terms_v26 on public.term_closures;
create trigger reenrollment_year_close_invalidate_terms_v26
after insert or update of status or delete on public.term_closures
for each row execute function private.invalidate_reenrollment_year_close_v26();
drop trigger if exists reenrollment_year_close_invalidate_results_v26 on public.student_term_results;
create trigger reenrollment_year_close_invalidate_results_v26
after insert or update or delete on public.student_term_results
for each row execute function private.invalidate_reenrollment_year_close_v26();
drop trigger if exists reenrollment_year_close_invalidate_recoveries_v26 on public.student_term_recoveries;
create trigger reenrollment_year_close_invalidate_recoveries_v26
after insert or update of status, recovery_percentage or delete on public.student_term_recoveries
for each row execute function private.invalidate_reenrollment_year_close_v26();
drop trigger if exists reenrollment_year_close_invalidate_policies_v26 on public.academic_policies;
create trigger reenrollment_year_close_invalidate_policies_v26
after insert or update or delete on public.academic_policies
for each row execute function private.invalidate_reenrollment_year_close_v26();
drop trigger if exists reenrollment_year_close_invalidate_classes_v26 on public.classes;
create trigger reenrollment_year_close_invalidate_classes_v26
after insert or update of active, grade_level, academic_year_id or delete on public.classes
for each row execute function private.invalidate_reenrollment_year_close_v26();
drop trigger if exists reenrollment_year_close_invalidate_students_v26 on public.students;
create trigger reenrollment_year_close_invalidate_students_v26
after update of active on public.students
for each row execute function private.invalidate_reenrollment_year_close_v26();
drop trigger if exists reenrollment_year_close_invalidate_subjects_v26 on public.subjects;
create trigger reenrollment_year_close_invalidate_subjects_v26
after update of active on public.subjects
for each row execute function private.invalidate_reenrollment_year_close_v26();
drop trigger if exists reenrollment_year_close_invalidate_enrollments_v26 on public.enrollments;
create trigger reenrollment_year_close_invalidate_enrollments_v26
after insert or update of active, status, enrolled_at, class_id, academic_year_id, student_id or delete on public.enrollments
for each row execute function private.invalidate_reenrollment_year_close_v26();
drop trigger if exists reenrollment_year_close_invalidate_offerings_v26 on public.subject_offerings;
create trigger reenrollment_year_close_invalidate_offerings_v26
after insert or update of active, class_id, subject_id, term_id or delete on public.subject_offerings
for each row execute function private.invalidate_reenrollment_year_close_v26();
drop trigger if exists reenrollment_year_close_invalidate_academic_terms_v26 on public.terms;
create trigger reenrollment_year_close_invalidate_academic_terms_v26
after update of active, academic_year_id, end_date or delete on public.terms
for each row execute function private.invalidate_reenrollment_year_close_v26();

-- Auto-select a class only when one compatible class has capacity; the finalizer still locks and rechecks capacity.
create or replace function private.resolve_reenrollment_destination_class_v26()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  data_rows jsonb[] := '{}'::jsonb[];
  data_row jsonb;
  class_ids uuid[] := '{}'::uuid[];
  institution_value uuid;
  year_value uuid;
  request_row record;
  current_class public.classes%rowtype;
  candidate_count integer;
  chosen_class_id uuid;
  pending_reason_value text;
begin
  if pg_trigger_depth() > 1 or current_setting('tecescola.reenrollment_v25_finalizing', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_table_name = 'classes' then
    if tg_op in ('UPDATE', 'DELETE') then data_rows := array_append(data_rows, to_jsonb(old)); end if;
    if tg_op in ('INSERT', 'UPDATE') then data_rows := array_append(data_rows, to_jsonb(new)); end if;
  else
    if tg_op in ('UPDATE', 'DELETE') and old.class_id is not null then
      class_ids := array_append(class_ids, old.class_id);
    end if;
    if tg_op in ('INSERT', 'UPDATE') and new.class_id is not null then
      class_ids := array_append(class_ids, new.class_id);
    end if;
    select coalesce(array_agg(jsonb_build_object(
      'institution_id', class_record.institution_id,
      'academic_year_id', class_record.academic_year_id
    )), '{}'::jsonb[])
      into data_rows
    from public.classes class_record
    where class_record.id = any(class_ids);
  end if;

  foreach data_row in array data_rows loop
    institution_value := nullif(data_row ->> 'institution_id', '')::uuid;
    year_value := nullif(data_row ->> 'academic_year_id', '')::uuid;
    if institution_value is null or year_value is null then continue; end if;

    for request_row in
      select request.id, request.institution_id, request.destination_grade_level,
             request.destination_class_id, request.pending_reason,
             campaign.destination_academic_year_id
      from public.reenrollment_requests request
      join public.reenrollment_campaigns campaign on campaign.id = request.campaign_id
      where request.institution_id = institution_value
        and campaign.destination_academic_year_id = year_value
        and request.destination_grade_level is not null
        and request.request_status not in ('ENROLLED', 'CANCELLED', 'REJECTED')
      order by request.created_at, request.id
    loop
      current_class := null;
      if request_row.destination_class_id is not null then
        select * into current_class
        from public.classes class_record
        where class_record.id = request_row.destination_class_id
          and class_record.institution_id = institution_value
          and class_record.academic_year_id = year_value
          and class_record.active is true
          and private.normalize_reenrollment_grade_level_v26(class_record.grade_level)
            = private.normalize_reenrollment_grade_level_v26(request_row.destination_grade_level)
          and lower(trim(class_record.grade_level)) = lower(trim(request_row.destination_grade_level))
          and (class_record.capacity <= 0 or (
            select count(*) from public.enrollments enrollment
            where enrollment.class_id = class_record.id and enrollment.active is true
          ) < class_record.capacity);
        if found then continue; end if;
      end if;

      select count(*), (array_agg(candidate.id order by candidate.id))[1]
        into candidate_count, chosen_class_id
      from (
        select class_record.id
        from public.classes class_record
        where class_record.institution_id = institution_value
          and class_record.academic_year_id = year_value
          and class_record.active is true
          and private.normalize_reenrollment_grade_level_v26(class_record.grade_level)
            = private.normalize_reenrollment_grade_level_v26(request_row.destination_grade_level)
          and lower(trim(class_record.grade_level)) = lower(trim(request_row.destination_grade_level))
          and (class_record.capacity <= 0 or (
            select count(*) from public.enrollments enrollment
            where enrollment.class_id = class_record.id and enrollment.active is true
          ) < class_record.capacity)
        order by class_record.id
      ) candidate;

      if candidate_count = 1 then
        pending_reason_value := nullif(array_to_string(array(
          select trim(reason)
          from unnest(string_to_array(coalesce(request_row.pending_reason, ''), ';')) reason
          where trim(reason) not in ('TURMA_DESTINO_NAO_DEFINIDA', 'TURMA_DESTINO_INVALIDA', 'SEM_VAGA_NA_TURMA')
            and trim(reason) <> ''
        ), '; '), '');
        update public.reenrollment_requests
        set destination_class_id = chosen_class_id,
            pending_reason = pending_reason_value,
            updated_at = now()
        where id = request_row.id
          and destination_class_id is distinct from chosen_class_id;
        if found and auth.uid() is not null
          and public.can_manage_institution_operations(institution_value) then
          perform private.finalize_reenrollment_v25_core(request_row.id);
        end if;
      else
        pending_reason_value := concat_ws('; ',
          nullif(array_to_string(array(
            select trim(reason)
            from unnest(string_to_array(coalesce(request_row.pending_reason, ''), ';')) reason
            where trim(reason) not in ('TURMA_DESTINO_NAO_DEFINIDA', 'TURMA_DESTINO_INVALIDA', 'SEM_VAGA_NA_TURMA')
              and trim(reason) <> ''
          ), '; '), ''),
          case when candidate_count = 0 then 'SEM_VAGA_NA_TURMA' else 'TURMA_DESTINO_NAO_DEFINIDA' end
        );
        update public.reenrollment_requests
        set destination_class_id = null,
            pending_reason = pending_reason_value,
            updated_at = now()
        where id = request_row.id
          and (destination_class_id is not null or pending_reason is distinct from pending_reason_value);
      end if;
    end loop;
  end loop;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.resolve_reenrollment_destination_class_v26() from public, anon, authenticated;

drop trigger if exists reenrollment_resolve_destination_class_v26 on public.classes;
create trigger reenrollment_resolve_destination_class_v26
after insert or update of active, capacity, grade_level, academic_year_id or delete on public.classes
for each row execute function private.resolve_reenrollment_destination_class_v26();
drop trigger if exists reenrollment_resolve_destination_enrollment_v26 on public.enrollments;
create trigger reenrollment_resolve_destination_enrollment_v26
after insert or update of active, class_id or delete on public.enrollments
for each row execute function private.resolve_reenrollment_destination_class_v26();

create or replace function public.get_reenrollment_destination_classes_v26(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.reenrollment_requests%rowtype;
  campaign public.reenrollment_campaigns%rowtype;
  class_options jsonb;
begin
  if auth.uid() is null then raise exception 'REENROLLMENT_AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into request_row from public.reenrollment_requests where id = p_request_id;
  if not found or not public.can_manage_institution_operations(request_row.institution_id) then
    raise exception 'REENROLLMENT_DESTINATION_CLASS_NOT_ALLOWED' using errcode = '42501';
  end if;
  if request_row.destination_grade_level is null then return '[]'::jsonb; end if;
  select * into campaign from public.reenrollment_campaigns where id = request_row.campaign_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', candidate.id,
    'name', candidate.name,
    'grade_level', candidate.grade_level,
    'shift', candidate.shift,
    'capacity', candidate.capacity,
    'active_enrollments', candidate.active_enrollments,
    'available_seats', case when candidate.capacity <= 0 then null
      else candidate.capacity - candidate.active_enrollments end
  ) order by candidate.name, candidate.id), '[]'::jsonb)
    into class_options
  from (
    select class_record.id, class_record.name, class_record.grade_level,
           class_record.shift, class_record.capacity,
           count(enrollment.id)::integer as active_enrollments
    from public.classes class_record
    left join public.enrollments enrollment
      on enrollment.class_id = class_record.id and enrollment.active is true
    where class_record.institution_id = request_row.institution_id
      and class_record.academic_year_id = campaign.destination_academic_year_id
      and class_record.active is true
      and private.normalize_reenrollment_grade_level_v26(class_record.grade_level)
        = private.normalize_reenrollment_grade_level_v26(request_row.destination_grade_level)
      and lower(trim(class_record.grade_level)) = lower(trim(request_row.destination_grade_level))
    group by class_record.id
    having class_record.capacity <= 0 or count(enrollment.id) < class_record.capacity
  ) candidate;

  return class_options;
end;
$$;

create or replace function public.assign_reenrollment_destination_class_v26(
  p_request_id uuid,
  p_class_id uuid,
  p_justification text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.reenrollment_requests%rowtype;
  campaign public.reenrollment_campaigns%rowtype;
  destination_class public.classes%rowtype;
  current_count integer;
  next_pending_reason text;
  previous_finalizing text;
begin
  if auth.uid() is null then raise exception 'REENROLLMENT_AUTH_REQUIRED' using errcode = '42501'; end if;
  if nullif(trim(coalesce(p_justification, '')), '') is null then
    raise exception 'REENROLLMENT_CLASS_ASSIGNMENT_JUSTIFICATION_REQUIRED';
  end if;
  select * into request_row from public.reenrollment_requests
  where id = p_request_id for update;
  if not found or not public.can_manage_institution_operations(request_row.institution_id) then
    raise exception 'REENROLLMENT_DESTINATION_CLASS_NOT_ALLOWED' using errcode = '42501';
  end if;
  if request_row.request_status in ('ENROLLED', 'CANCELLED', 'REJECTED') then
    raise exception 'REENROLLMENT_REQUEST_NOT_ASSIGNABLE';
  end if;
  if request_row.destination_grade_level is null
    or request_row.academic_status not in ('APPROVED', 'FAILED', 'RETAINED') then
    raise exception 'REENROLLMENT_ACADEMIC_RESULT_NOT_READY';
  end if;

  select * into campaign from public.reenrollment_campaigns where id = request_row.campaign_id;
  select * into destination_class from public.classes class_record
  where class_record.id = p_class_id
    and class_record.institution_id = request_row.institution_id
    and class_record.academic_year_id = campaign.destination_academic_year_id
    and class_record.active is true
    and private.normalize_reenrollment_grade_level_v26(class_record.grade_level)
      = private.normalize_reenrollment_grade_level_v26(request_row.destination_grade_level)
    and lower(trim(class_record.grade_level)) = lower(trim(request_row.destination_grade_level))
  for update;
  if not found then raise exception 'REENROLLMENT_DESTINATION_CLASS_INVALID'; end if;

  select count(*)::integer into current_count
  from public.enrollments enrollment
  where enrollment.class_id = destination_class.id and enrollment.active is true;
  if destination_class.capacity > 0 and current_count >= destination_class.capacity then
    raise exception 'REENROLLMENT_DESTINATION_CLASS_FULL';
  end if;

  next_pending_reason := nullif(array_to_string(array(
    select trim(reason)
    from unnest(string_to_array(coalesce(request_row.pending_reason, ''), ';')) reason
    where trim(reason) not in ('TURMA_DESTINO_NAO_DEFINIDA', 'TURMA_DESTINO_INVALIDA', 'SEM_VAGA_NA_TURMA')
      and trim(reason) <> ''
  ), '; '), '');

  update public.reenrollment_requests
  set destination_class_id = destination_class.id,
      pending_reason = next_pending_reason,
      updated_at = now()
  where id = request_row.id;

  insert into public.reenrollment_audit_events (
    institution_id, campaign_id, request_id, action, actor_profile_id, metadata
  ) values (
    request_row.institution_id, request_row.campaign_id, request_row.id,
    'DESTINATION_CLASS_ASSIGNED', auth.uid(),
    jsonb_build_object('class_id', destination_class.id,
      'class_name', destination_class.name, 'justification', trim(p_justification))
  );

  previous_finalizing := current_setting('tecescola.reenrollment_v25_finalizing', true);
  perform set_config('tecescola.reenrollment_v25_finalizing', 'on', true);
  perform private.finalize_reenrollment_v25_core(request_row.id);
  perform set_config(
    'tecescola.reenrollment_v25_finalizing',
    coalesce(previous_finalizing, 'off'),
    true
  );

  select * into request_row from public.reenrollment_requests where id = request_row.id;
  return to_jsonb(request_row);
end;
$$;

revoke all on function public.get_reenrollment_destination_classes_v26(uuid) from public, anon;
grant execute on function public.get_reenrollment_destination_classes_v26(uuid) to authenticated;
revoke all on function public.assign_reenrollment_destination_class_v26(uuid, uuid, text) from public, anon;
grant execute on function public.assign_reenrollment_destination_class_v26(uuid, uuid, text) to authenticated;

create or replace function public.save_reenrollment_grade_rule_v26(
  p_institution_id uuid,
  p_source_grade_level text,
  p_destination_grade_level text,
  p_destination_stage text,
  p_promotion_policy text,
  p_justification text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rule_row public.reenrollment_grade_rules%rowtype;
  request_row record;
begin
  if auth.uid() is null or not public.is_institution_admin(p_institution_id) then
    raise exception 'REENROLLMENT_GRADE_RULE_NOT_ALLOWED' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_source_grade_level, '')), '') is null then raise exception 'REENROLLMENT_SOURCE_GRADE_REQUIRED'; end if;
  if nullif(trim(coalesce(p_justification, '')), '') is null then raise exception 'REENROLLMENT_EXCEPTION_JUSTIFICATION_REQUIRED'; end if;
  if p_promotion_policy not in ('PROMOTE', 'RETAIN', 'GRADUATE', 'MANUAL') then raise exception 'REENROLLMENT_PROMOTION_POLICY_INVALID'; end if;
  if p_promotion_policy not in ('GRADUATE', 'MANUAL') and nullif(trim(coalesce(p_destination_grade_level, '')), '') is null then
    raise exception 'REENROLLMENT_DESTINATION_GRADE_REQUIRED';
  end if;
  if p_promotion_policy = 'PROMOTE' and not exists (
    select 1 from public.classes class_record
    where class_record.institution_id = p_institution_id
      and class_record.active is true
      and private.normalize_reenrollment_grade_level_v26(class_record.grade_level)
        = private.normalize_reenrollment_grade_level_v26(p_destination_grade_level)
  ) then
    raise exception 'REENROLLMENT_DESTINATION_GRADE_NOT_IN_INSTITUTION';
  end if;

  insert into public.reenrollment_grade_rules (
    institution_id, source_grade_level, destination_grade_level,
    destination_stage, promotion_policy, active, created_by,
    justification, exception_approved
  ) values (
    p_institution_id, trim(p_source_grade_level), nullif(trim(p_destination_grade_level), ''),
    nullif(trim(p_destination_stage), ''), p_promotion_policy, true, auth.uid(),
    trim(p_justification), true
  ) on conflict (institution_id, (lower(trim(source_grade_level)))) do update set
    destination_grade_level = excluded.destination_grade_level,
    destination_stage = excluded.destination_stage,
    promotion_policy = excluded.promotion_policy,
    active = true,
    updated_at = now(),
    justification = excluded.justification,
    exception_approved = true
  returning * into rule_row;

  insert into public.reenrollment_audit_events (
    institution_id, action, actor_profile_id, metadata
  ) values (
    p_institution_id, 'GRADE_PROGRESSION_EXCEPTION_UPDATED', auth.uid(),
    jsonb_build_object('rule_id', rule_row.id, 'source_grade_level', rule_row.source_grade_level,
      'destination_grade_level', rule_row.destination_grade_level,
      'promotion_policy', rule_row.promotion_policy, 'justification', rule_row.justification)
  );

  for request_row in
    select request.id, closure.current_run_id
    from public.reenrollment_requests request
    join public.reenrollment_campaigns campaign on campaign.id = request.campaign_id
    join public.reenrollment_academic_closures closure
      on closure.institution_id = request.institution_id
     and closure.academic_year_id = campaign.source_academic_year_id
     and closure.closure_status = 'CLOSED'
    where request.institution_id = p_institution_id
      and private.normalize_reenrollment_grade_level_v26(request.source_grade_level)
        = private.normalize_reenrollment_grade_level_v26(p_source_grade_level)
      and closure.current_run_id is not null
      and request.request_status not in ('ENROLLED', 'CANCELLED', 'REJECTED')
  loop
    perform private.sync_reenrollment_request_year_result_v26(request_row.id, request_row.current_run_id);
  end loop;
  return to_jsonb(rule_row);
end;
$$;

revoke all on function public.save_reenrollment_grade_rule_v24(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.save_reenrollment_grade_rule_v26(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.save_reenrollment_grade_rule_v26(uuid, text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
commit;
