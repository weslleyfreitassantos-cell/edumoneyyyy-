begin;

-- Make the inclusive workspace match the roles exposed by the application.
create or replace function private.inclusive_is_manager(target_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships membership
    where membership.profile_id = (select auth.uid())
      and membership.institution_id = target_institution_id
      and membership.active is true
      and membership.role in ('ADMIN', 'DIRECTOR', 'SECRETARY')
  );
$$;

create or replace function private.inclusive_teacher_can_student(target_institution_id uuid, target_student_id uuid)
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
      and enrollment.status = 'active'
      and offering.active is true
      and offering.teacher_profile_id = (select auth.uid())
      and class.institution_id = target_institution_id
      and class.active is true
  );
$$;

create or replace function private.inclusive_can_view_student(target_institution_id uuid, target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.inclusive_is_manager(target_institution_id)
    or private.inclusive_teacher_can_student(target_institution_id, target_student_id)
    or private.inclusive_aee_can_student(target_institution_id, target_student_id);
$$;

-- This is a separate permissive policy so the existing student self/guardian
-- boundary remains intact while authorized inclusive staff can find their roster.
drop policy if exists students_inclusive_select_policy on public.students;
create policy students_inclusive_select_policy
on public.students
for select
to authenticated
using (private.inclusive_can_view_student(institution_id, id));

alter table public.inclusive_pei_plans
  add column if not exists registration_bridge_created boolean not null default false;

alter table public.inclusive_aee_plans
  add column if not exists academic_year_id uuid references public.academic_years(id) on delete restrict,
  add column if not exists class_id uuid references public.classes(id) on delete restrict,
  add column if not exists registration_bridge_created boolean not null default false;

-- Preserve historical rows but remove duplicate active drafts before enforcing
-- one editable plan per institution/student/year. Archived history can repeat.
with ranked as (
  select id,
         row_number() over (
           partition by institution_id, student_id, academic_year_id
           order by (status = 'ACTIVE') desc, updated_at desc, created_at desc, id
         ) as row_number
  from public.inclusive_pei_plans
)
update public.inclusive_pei_plans plan
set status = 'ARCHIVED', updated_at = now()
from ranked
where plan.id = ranked.id
  and ranked.row_number > 1
  and plan.status <> 'ARCHIVED';

with ranked as (
  select id,
         row_number() over (
           partition by institution_id, student_id, academic_year_id
           order by (status = 'ACTIVE') desc, updated_at desc, created_at desc, id
         ) as row_number
  from public.inclusive_aee_plans
)
update public.inclusive_aee_plans plan
set status = 'ARCHIVED', updated_at = now()
from ranked
where plan.id = ranked.id
  and ranked.row_number > 1
  and plan.status <> 'ARCHIVED';

create unique index if not exists inclusive_pei_editable_identity_unique
on public.inclusive_pei_plans (
  institution_id,
  student_id,
  coalesce(academic_year_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
where status <> 'ARCHIVED';

create unique index if not exists inclusive_aee_editable_identity_unique
on public.inclusive_aee_plans (
  institution_id,
  student_id,
  coalesce(academic_year_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
where status <> 'ARCHIVED';

create index if not exists inclusive_pei_year_class_idx
  on public.inclusive_pei_plans (institution_id, academic_year_id, class_id, student_id);

create index if not exists inclusive_aee_year_class_idx
  on public.inclusive_aee_plans (institution_id, academic_year_id, class_id, student_id);

notify pgrst, 'reload schema';
commit;
