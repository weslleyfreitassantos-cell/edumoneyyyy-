begin;

-- Enrollment creation writes status='ACTIVE', while legacy rows may use
-- status='active'. Normalize both formats wherever inclusive access depends
-- on the current enrollment.
create or replace function private.inclusive_teacher_can_student(
  target_institution_id uuid,
  target_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments enrollment
    join public.subject_offerings offering on offering.class_id = enrollment.class_id
    join public.classes class on class.id = offering.class_id
    where enrollment.student_id = target_student_id
      and enrollment.academic_year_id is not null
      and enrollment.active is true
      and pg_catalog.upper(pg_catalog.btrim(enrollment.status)) = 'ACTIVE'
      and offering.active is true
      and offering.teacher_profile_id = (select auth.uid())
      and class.institution_id = target_institution_id
      and class.active is true
  );
$$;

-- Inclusion is an explicit educational decision, not an automatic consequence
-- of clinical/health flags. Only the manager action below creates a PEI draft.
drop trigger if exists student_health_inclusive_registration_bridge
  on public.student_health_information;

create or replace function public.register_student_for_inclusive_education(
  p_institution_id uuid,
  p_student_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_academic_year_id uuid;
  v_class_id uuid;
  v_plan_id uuid;
begin
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.memberships membership
    where membership.profile_id = v_actor_id
      and membership.institution_id = p_institution_id
      and membership.active is true
      and membership.role in ('ADMIN', 'DIRECTOR', 'SECRETARY')
  ) then
    raise exception using errcode = '42501', message = 'INCLUSIVE_EDUCATION_MANAGER_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.students student
    where student.id = p_student_id
      and student.institution_id = p_institution_id
      and student.active is true
  ) then
    raise exception using errcode = 'P0001', message = 'STUDENT_NOT_ACTIVE_IN_INSTITUTION';
  end if;

  select enrollment.academic_year_id, enrollment.class_id
    into v_academic_year_id, v_class_id
  from public.enrollments enrollment
  join public.classes class on class.id = enrollment.class_id
  join public.academic_years academic_year on academic_year.id = enrollment.academic_year_id
  where enrollment.student_id = p_student_id
    and enrollment.active is true
    and pg_catalog.upper(pg_catalog.btrim(enrollment.status)) = 'ACTIVE'
    and academic_year.institution_id = p_institution_id
    and academic_year.active is true
    and class.institution_id = p_institution_id
    and class.academic_year_id = enrollment.academic_year_id
    and class.active is true
  order by enrollment.enrolled_at desc, enrollment.created_at desc
  limit 1;

  if v_academic_year_id is null then
    raise exception using errcode = 'P0001', message = 'STUDENT_ACTIVE_ENROLLMENT_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_institution_id::text || ':' || p_student_id::text || ':' || v_academic_year_id::text,
      0
    )
  );

  select plan.id into v_plan_id
  from public.inclusive_pei_plans plan
  where plan.institution_id = p_institution_id
    and plan.student_id = p_student_id
    and plan.academic_year_id = v_academic_year_id
    and plan.status in ('DRAFT', 'ACTIVE')
  order by plan.updated_at desc, plan.created_at desc
  limit 1;

  if v_plan_id is not null then
    return jsonb_build_object('registered', true, 'created', false, 'plan_id', v_plan_id);
  end if;

  insert into public.inclusive_pei_plans (
    institution_id, student_id, academic_year_id, class_id, status,
    created_by, updated_by
  ) values (
    p_institution_id, p_student_id, v_academic_year_id, v_class_id, 'DRAFT',
    v_actor_id, v_actor_id
  ) returning id into v_plan_id;

  return jsonb_build_object('registered', true, 'created', true, 'plan_id', v_plan_id);
end;
$$;

revoke all on function public.register_student_for_inclusive_education(uuid, uuid) from public, anon;
grant execute on function public.register_student_for_inclusive_education(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
