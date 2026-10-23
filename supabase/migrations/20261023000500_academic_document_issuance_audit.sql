begin;

create table public.academic_document_issuances (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  document_type text not null check (document_type in (
    'ENROLLMENT_DECLARATION',
    'REGISTRATION_SHEET',
    'ATTENDANCE_DECLARATION',
    'REENROLLMENT_RECEIPT',
    'TRANSCRIPT_PREVIEW'
  )),
  enrollment_id uuid references public.enrollments(id) on delete restrict,
  academic_year_id uuid references public.academic_years(id) on delete restrict,
  issued_at timestamptz not null default now()
);

create index academic_document_issuances_student_recent_idx
  on public.academic_document_issuances(institution_id, student_id, issued_at desc);

alter table public.academic_document_issuances enable row level security;

create policy academic_document_issuances_manager_read
  on public.academic_document_issuances
  for select to authenticated
  using (
    private.has_institution_role(
      institution_id,
      array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]
    )
  );

revoke all on public.academic_document_issuances from public, anon, authenticated;
grant select on public.academic_document_issuances to authenticated;

create or replace function public.record_academic_document_issuance(
  p_institution_id uuid,
  p_student_id uuid,
  p_document_type text,
  p_enrollment_id uuid default null,
  p_academic_year_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_issuance_id uuid;
  v_enrollment record;
  v_year_start date;
  v_expected_count integer;
  v_complete_count integer;
begin
  if auth.uid() is null or not private.has_institution_role(
    p_institution_id,
    array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]
  ) then
    raise exception using errcode = '42501', message = 'ACADEMIC_DOCUMENT_FORBIDDEN';
  end if;

  if p_document_type is null or p_document_type not in (
    'ENROLLMENT_DECLARATION', 'REGISTRATION_SHEET', 'ATTENDANCE_DECLARATION',
    'REENROLLMENT_RECEIPT', 'TRANSCRIPT_PREVIEW'
  ) or not exists (
    select 1 from public.students student
     where student.id = p_student_id
       and student.institution_id = p_institution_id
  ) then
    raise exception using errcode = '22023', message = 'ACADEMIC_DOCUMENT_INVALID';
  end if;

  if p_academic_year_id is not null and not exists (
    select 1 from public.academic_years academic_year
     where academic_year.id = p_academic_year_id
       and academic_year.institution_id = p_institution_id
  ) then
    raise exception using errcode = '22023', message = 'ACADEMIC_DOCUMENT_INVALID';
  end if;

  if p_enrollment_id is not null then
    select enrollment.id, enrollment.student_id, enrollment.class_id,
           enrollment.academic_year_id, enrollment.active, enrollment.status,
           class.institution_id as class_institution_id,
           class.academic_year_id as class_year_id
      into v_enrollment
      from public.enrollments enrollment
      join public.classes class on class.id = enrollment.class_id
     where enrollment.id = p_enrollment_id
       and enrollment.student_id = p_student_id;
    if not found
      or v_enrollment.class_institution_id <> p_institution_id
      or v_enrollment.class_year_id <> v_enrollment.academic_year_id
      or (p_academic_year_id is not null and v_enrollment.academic_year_id <> p_academic_year_id)
    then
      raise exception using errcode = '22023', message = 'ACADEMIC_DOCUMENT_INVALID';
    end if;
  end if;

  if p_document_type in ('ENROLLMENT_DECLARATION', 'ATTENDANCE_DECLARATION', 'REENROLLMENT_RECEIPT')
    and (p_enrollment_id is null or v_enrollment.active is distinct from true
      or upper(coalesce(v_enrollment.status, '')) <> 'ACTIVE')
  then
    raise exception using errcode = '55000', message = 'ACADEMIC_DOCUMENT_ACTIVE_ENROLLMENT_REQUIRED';
  end if;

  if p_document_type = 'ATTENDANCE_DECLARATION' then
    if p_academic_year_id is null or p_academic_year_id <> v_enrollment.academic_year_id then
      raise exception using errcode = '22023', message = 'ACADEMIC_DOCUMENT_INVALID';
    end if;

    select count(*) into v_expected_count
      from public.subject_offerings offering
      join public.classes class on class.id = offering.class_id
      join public.terms term on term.id = offering.term_id
     where offering.active is true
       and offering.class_id = v_enrollment.class_id
       and class.institution_id = p_institution_id
       and class.academic_year_id = p_academic_year_id
       and term.academic_year_id = p_academic_year_id;

    select count(*) into v_complete_count
      from public.subject_offerings offering
      join public.classes class on class.id = offering.class_id
      join public.terms term on term.id = offering.term_id
     where offering.active is true
       and offering.class_id = v_enrollment.class_id
       and class.institution_id = p_institution_id
       and class.academic_year_id = p_academic_year_id
       and term.academic_year_id = p_academic_year_id
       and exists (
         select 1 from public.student_term_results result
          where result.institution_id = p_institution_id
            and result.student_id = p_student_id
            and result.academic_year_id = p_academic_year_id
            and result.term_id = offering.term_id
            and result.subject_offering_id = offering.id
            and result.finalized_at is not null
            and result.attendance_percentage is not null
       );

    if v_expected_count = 0 or v_complete_count <> v_expected_count then
      raise exception using errcode = '55000', message = 'ACADEMIC_DOCUMENT_ATTENDANCE_INCOMPLETE';
    end if;
  elsif p_document_type = 'REENROLLMENT_RECEIPT' then
    select academic_year.start_date into v_year_start
      from public.academic_years academic_year
     where academic_year.id = v_enrollment.academic_year_id
       and academic_year.institution_id = p_institution_id;
    if v_year_start is null or not exists (
      select 1
        from public.enrollments previous_enrollment
        join public.academic_years previous_year
          on previous_year.id = previous_enrollment.academic_year_id
       where previous_enrollment.student_id = p_student_id
         and previous_enrollment.id <> p_enrollment_id
         and previous_year.institution_id = p_institution_id
         and previous_year.end_date < v_year_start
    ) then
      raise exception using errcode = '55000', message = 'ACADEMIC_DOCUMENT_REENROLLMENT_NOT_FOUND';
    end if;
  end if;

  insert into public.academic_document_issuances(
    institution_id, student_id, actor_profile_id, document_type,
    enrollment_id, academic_year_id
  ) values (
    p_institution_id, p_student_id, auth.uid(), p_document_type,
    p_enrollment_id, p_academic_year_id
  ) returning id into v_issuance_id;

  return v_issuance_id;
end;
$$;

revoke all on function public.record_academic_document_issuance(uuid, uuid, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.record_academic_document_issuance(uuid, uuid, text, uuid, uuid)
  to authenticated;

comment on table public.academic_document_issuances is
  'Audit metadata for academic document print actions; stores references and actor only, never document contents or health data.';

notify pgrst, 'reload schema';
commit;
