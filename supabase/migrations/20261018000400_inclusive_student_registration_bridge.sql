begin;

-- Connect enrollment inclusion flags to the inclusive education workspaces.
-- Only an explicitly authorized institutional manager may create these drafts.
-- There is deliberately no arbitrary staff fallback: a missing actor keeps the
-- enrollment valid and leaves the inclusive record for an authorized review.
alter table public.inclusive_pei_plans
  add column if not exists registration_bridge_created boolean not null default false;

alter table public.inclusive_aee_plans
  add column if not exists academic_year_id uuid references public.academic_years(id) on delete restrict,
  add column if not exists class_id uuid references public.classes(id) on delete restrict,
  add column if not exists registration_bridge_created boolean not null default false;

create or replace function private.ensure_inclusive_student_registration(
  target_institution_id uuid,
  target_student_id uuid,
  target_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  health_row public.student_health_information%rowtype;
  actor_id uuid;
  enrollment_year_id uuid;
  enrollment_class_id uuid;
  pei_id uuid;
  aee_id uuid;
  pei_created boolean := false;
  aee_created boolean := false;
begin
  if not exists (
    select 1
    from public.students student
    where student.id = target_student_id
      and student.institution_id = target_institution_id
      and student.active is true
  ) then
    return jsonb_build_object('registered', false, 'reason', 'student_not_active');
  end if;

  select * into health_row
  from public.student_health_information health
  where health.student_id = target_student_id
    and health.institution_id = target_institution_id;

  select membership.profile_id into actor_id
  from public.memberships membership
  where membership.profile_id = target_actor_id
    and membership.institution_id = target_institution_id
    and membership.active is true
    and membership.role in ('ADMIN', 'DIRECTOR', 'SECRETARY')
  limit 1;

  if actor_id is null then
    return jsonb_build_object('registered', false, 'reason', 'no_authorized_actor');
  end if;

  if not found or not (
    coalesce(health_row.autism, false)
    or coalesce(health_row.giftedness, false)
    or coalesce(health_row.needs_special_education, false)
  ) then
    update public.inclusive_pei_plans
    set status = 'ARCHIVED', updated_by = actor_id, updated_at = now()
    where institution_id = target_institution_id
      and student_id = target_student_id
      and registration_bridge_created is true
      and status = 'DRAFT';

    update public.inclusive_aee_plans
    set status = 'ARCHIVED', updated_by = actor_id, updated_at = now()
    where institution_id = target_institution_id
      and student_id = target_student_id
      and registration_bridge_created is true
      and status = 'DRAFT';

    return jsonb_build_object('registered', false, 'reason', 'no_inclusion_flag');
  end if;

  select enrollment.academic_year_id, enrollment.class_id
    into enrollment_year_id, enrollment_class_id
  from public.enrollments enrollment
  join public.classes class on class.id = enrollment.class_id
  where enrollment.student_id = target_student_id
    and enrollment.academic_year_id is not null
    and enrollment.active is true
    and enrollment.status = 'active'
    and class.institution_id = target_institution_id
    and class.active is true
  order by enrollment.enrolled_at desc, enrollment.created_at desc
  limit 1;

  if enrollment_year_id is null then
    return jsonb_build_object('registered', false, 'reason', 'no_active_enrollment');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_institution_id::text || ':' || target_student_id::text || ':' || enrollment_year_id::text, 0)
  );

  select plan.id into pei_id
  from public.inclusive_pei_plans plan
  where plan.institution_id = target_institution_id
    and plan.student_id = target_student_id
    and plan.academic_year_id = enrollment_year_id
  order by plan.updated_at desc, plan.created_at desc
  limit 1;

  if pei_id is null then
    insert into public.inclusive_pei_plans (
      institution_id, student_id, academic_year_id, class_id, status,
      registration_bridge_created, created_by, updated_by
    ) values (
      target_institution_id, target_student_id, enrollment_year_id, enrollment_class_id,
      'DRAFT', true, actor_id, actor_id
    ) returning id into pei_id;
    pei_created := true;
  elsif exists (
    select 1 from public.inclusive_pei_plans plan
    where plan.id = pei_id and plan.registration_bridge_created is true and plan.class_id is null
  ) then
    update public.inclusive_pei_plans
    set class_id = enrollment_class_id, updated_by = actor_id, updated_at = now()
    where id = pei_id;
  end if;

  if coalesce(health_row.needs_special_education, false) then
    select plan.id into aee_id
    from public.inclusive_aee_plans plan
    where plan.institution_id = target_institution_id
      and plan.student_id = target_student_id
      and plan.academic_year_id = enrollment_year_id
    order by plan.updated_at desc, plan.created_at desc
    limit 1;

    if aee_id is null then
      insert into public.inclusive_aee_plans (
        institution_id, student_id, academic_year_id, class_id, pei_plan_id,
        responsible_profile_id, status, registration_bridge_created, created_by, updated_by
      ) values (
        target_institution_id, target_student_id, enrollment_year_id, enrollment_class_id, pei_id,
        actor_id, 'DRAFT', true, actor_id, actor_id
      ) returning id into aee_id;
      aee_created := true;
    elsif exists (
      select 1 from public.inclusive_aee_plans plan
      where plan.id = aee_id and plan.registration_bridge_created is true
        and (plan.class_id is null or plan.pei_plan_id is null)
    ) then
      update public.inclusive_aee_plans
      set class_id = coalesce(class_id, enrollment_class_id),
          pei_plan_id = coalesce(pei_plan_id, pei_id),
          updated_by = actor_id,
          updated_at = now()
      where id = aee_id;
    end if;
  else
    update public.inclusive_aee_plans
    set status = 'ARCHIVED', updated_by = actor_id, updated_at = now()
    where institution_id = target_institution_id
      and student_id = target_student_id
      and registration_bridge_created is true
      and status = 'DRAFT';
  end if;

  return jsonb_build_object(
    'registered', true,
    'pei_id', pei_id,
    'pei_created', pei_created,
    'aee_id', aee_id,
    'aee_created', aee_created,
    'academic_year_id', enrollment_year_id,
    'class_id', enrollment_class_id
  );
end;
$$;

create or replace function public.sync_inclusive_student_registration_from_health()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform private.ensure_inclusive_student_registration(
    new.institution_id,
    new.student_id,
    auth.uid()
  );
  return new;
end;
$$;

drop trigger if exists student_health_inclusive_registration_bridge
  on public.student_health_information;

create trigger student_health_inclusive_registration_bridge
after insert or update of autism, giftedness, needs_special_education
on public.student_health_information
for each row
execute function public.sync_inclusive_student_registration_from_health();

revoke all on function private.ensure_inclusive_student_registration(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.sync_inclusive_student_registration_from_health() from public, anon, authenticated;

commit;
