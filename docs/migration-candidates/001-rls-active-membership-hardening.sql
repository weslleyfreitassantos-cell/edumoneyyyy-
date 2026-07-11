-- MIGRATION CANDIDATE / REVIEW ONLY
-- Do not execute directly in production.
-- Do not run through Supabase CLI yet.
-- This file is intentionally stored under docs/migration-candidates,
-- not supabase/migrations.
-- Requires baseline/reconciliation before becoming a real migration.
-- Review in staging first.

begin;

-- ============================================================
-- Helper functions
-- ============================================================

create or replace function public.is_institution_admin(
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.memberships as membership
    where membership.profile_id = auth.uid()
      and membership.institution_id = target_institution_id
      and membership.role in ('ADMIN', 'DIRECTOR')
      and membership.active is true
  );
$function$;

create or replace function public.can_view_institution_profile(
  target_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  -- The viewer membership must be active.
  --
  -- The target membership is intentionally not filtered by active status,
  -- because an active administrator or director must be able to view and
  -- manage inactive users from the same institution.
  select exists (
    select 1
    from public.memberships as viewer_membership
    join public.memberships as target_membership
      on target_membership.institution_id =
         viewer_membership.institution_id
    where viewer_membership.profile_id = auth.uid()
      and viewer_membership.role in ('ADMIN', 'DIRECTOR')
      and viewer_membership.active is true
      and target_membership.profile_id = target_profile_id
  );
$function$;

-- ============================================================
-- Academic years
-- ============================================================

drop policy if exists
  "Users can view academic_years from own institution"
  on public.academic_years;

create policy
  "Users can view academic_years from own institution"
  on public.academic_years
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships as membership
      where membership.profile_id = auth.uid()
        and membership.institution_id =
            academic_years.institution_id
        and membership.active is true
    )
  );

-- ============================================================
-- Classes
-- ============================================================

drop policy if exists
  "Users can view classes from own institution"
  on public.classes;

create policy
  "Users can view classes from own institution"
  on public.classes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships as membership
      where membership.profile_id = auth.uid()
        and membership.institution_id =
            classes.institution_id
        and membership.active is true
    )
  );

-- ============================================================
-- Enrollments
-- ============================================================

drop policy if exists
  "Users can view enrollments from own institution"
  on public.enrollments;

create policy
  "Users can view enrollments from own institution"
  on public.enrollments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.students as student
      join public.classes as class_record
        on class_record.id = enrollments.class_id
       and class_record.institution_id =
           student.institution_id
      join public.academic_years as academic_year
        on academic_year.id =
           enrollments.academic_year_id
       and academic_year.institution_id =
           student.institution_id
      join public.memberships as membership
        on membership.institution_id =
           student.institution_id
      where student.id = enrollments.student_id
        and membership.profile_id = auth.uid()
        and membership.active is true
    )
  );

-- ============================================================
-- Guardianships
-- ============================================================

drop policy if exists
  "Users can view guardianships from own institution"
  on public.guardianships;

create policy
  "Users can view guardianships from own institution"
  on public.guardianships
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.students as student
      join public.memberships as membership
        on membership.institution_id =
           student.institution_id
      where student.id = guardianships.student_id
        and membership.profile_id = auth.uid()
        and membership.active is true
    )
  );

-- ============================================================
-- Institutions
-- ============================================================

drop policy if exists
  "Users can view own institution"
  on public.institutions;

create policy
  "Users can view own institution"
  on public.institutions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships as membership
      where membership.profile_id = auth.uid()
        and membership.institution_id =
            institutions.id
        and membership.active is true
    )
  );

-- ============================================================
-- Memberships
-- ============================================================

drop policy if exists
  "Users can view own memberships"
  on public.memberships;

-- A user may read their own membership record even when it is inactive.
-- Access to institutional data remains protected by active-membership
-- checks in the other policies.
create policy
  "Users can view own memberships"
  on public.memberships
  for select
  to authenticated
  using (
    profile_id = auth.uid()
  );

drop policy if exists
  "Institution admins can view memberships"
  on public.memberships;

create policy
  "Institution admins can view memberships"
  on public.memberships
  for select
  to authenticated
  using (
    public.is_institution_admin(institution_id)
  );

-- ============================================================
-- Profiles
-- ============================================================

drop policy if exists
  "Users can view own profile"
  on public.profiles;

create policy
  "Users can view own profile"
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
  );

drop policy if exists
  "Institution admins can view institution profiles"
  on public.profiles;

create policy
  "Institution admins can view institution profiles"
  on public.profiles
  for select
  to authenticated
  using (
    public.can_view_institution_profile(id)
  );

-- ============================================================
-- Students
-- ============================================================

-- Remove both historical policies before creating one canonical
-- active-membership policy.
drop policy if exists
  "Users can view own institution students"
  on public.students;

drop policy if exists
  "Users can view students from own institution"
  on public.students;

create policy
  "Users can view students from own institution"
  on public.students
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships as membership
      where membership.profile_id = auth.uid()
        and membership.institution_id =
            students.institution_id
        and membership.active is true
    )
  );

drop policy if exists
  "Institution admins can insert students"
  on public.students;

create policy
  "Institution admins can insert students"
  on public.students
  for insert
  to authenticated
  with check (
    public.is_institution_admin(institution_id)
  );

drop policy if exists
  "Institution admins can update students"
  on public.students;

create policy
  "Institution admins can update students"
  on public.students
  for update
  to authenticated
  using (
    public.is_institution_admin(institution_id)
  )
  with check (
    public.is_institution_admin(institution_id)
  );

-- ============================================================
-- Subject offerings
-- ============================================================

drop policy if exists
  "Users can view subject_offerings from own institution"
  on public.subject_offerings;

create policy
  "Users can view subject_offerings from own institution"
  on public.subject_offerings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.classes as class_record
      join public.subjects as subject
        on subject.id =
           subject_offerings.subject_id
       and subject.institution_id =
           class_record.institution_id
      join public.terms as term
        on term.id =
           subject_offerings.term_id
      join public.academic_years as academic_year
        on academic_year.id =
           term.academic_year_id
       and academic_year.institution_id =
           class_record.institution_id
      join public.memberships as membership
        on membership.institution_id =
           class_record.institution_id
      where class_record.id =
            subject_offerings.class_id
        and membership.profile_id = auth.uid()
        and membership.active is true
    )
  );

-- ============================================================
-- Subjects
-- ============================================================

drop policy if exists
  "Users can view subjects from own institution"
  on public.subjects;

create policy
  "Users can view subjects from own institution"
  on public.subjects
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships as membership
      where membership.profile_id = auth.uid()
        and membership.institution_id =
            subjects.institution_id
        and membership.active is true
    )
  );

-- ============================================================
-- Terms
-- ============================================================

drop policy if exists
  "Users can view terms from own institution"
  on public.terms;

create policy
  "Users can view terms from own institution"
  on public.terms
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.academic_years as academic_year
      join public.memberships as membership
        on membership.institution_id =
           academic_year.institution_id
      where academic_year.id =
            terms.academic_year_id
        and membership.profile_id = auth.uid()
        and membership.active is true
    )
  );

-- ============================================================
-- Optional privilege hardening
-- ============================================================

-- OPTIONAL / REVIEW SEPARATELY
--
-- Revoking anon EXECUTE must be validated in staging because RLS
-- policies may depend on function execution privileges during policy
-- evaluation.
--
-- revoke execute
--   on function public.is_institution_admin(uuid)
--   from anon;
--
-- revoke execute
--   on function public.can_view_institution_profile(uuid)
--   from anon;

commit;

-- ============================================================
-- POST-MIGRATION READ-ONLY CHECKS
-- ============================================================

-- Function definitions
--
-- select pg_get_functiondef(
--   'public.is_institution_admin(uuid)'::regprocedure
-- );
--
-- select pg_get_functiondef(
--   'public.can_view_institution_profile(uuid)'::regprocedure
-- );

-- Policies
--
-- select
--   schemaname,
--   tablename,
--   policyname,
--   permissive,
--   roles,
--   cmd,
--   qual,
--   with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in (
--     'academic_years',
--     'classes',
--     'enrollments',
--     'guardianships',
--     'institutions',
--     'memberships',
--     'profiles',
--     'students',
--     'subject_offerings',
--     'subjects',
--     'terms'
--   )
-- order by
--   tablename,
--   policyname;

-- RLS status
--
-- select
--   namespace.nspname as schema_name,
--   relation.relname as table_name,
--   relation.relrowsecurity as rls_enabled,
--   relation.relforcerowsecurity as force_rls_enabled
-- from pg_class as relation
-- join pg_namespace as namespace
--   on namespace.oid = relation.relnamespace
-- where namespace.nspname = 'public'
--   and relation.relname in (
--     'academic_years',
--     'classes',
--     'enrollments',
--     'guardianships',
--     'institutions',
--     'memberships',
--     'profiles',
--     'students',
--     'subject_offerings',
--     'subjects',
--     'terms'
--   )
-- order by relation.relname;

-- Membership distribution
--
-- select
--   role,
--   active,
--   count(*) as total
-- from public.memberships
-- group by
--   role,
--   active
-- order by
--   role,
--   active;

-- Function privileges
--
-- select
--   routine.routine_name,
--   has_function_privilege(
--     'anon',
--     format(
--       '%I.%I(uuid)',
--       routine.routine_schema,
--       routine.routine_name
--     ),
--     'EXECUTE'
--   ) as anon_can_execute,
--   has_function_privilege(
--     'authenticated',
--     format(
--       '%I.%I(uuid)',
--       routine.routine_schema,
--       routine.routine_name
--     ),
--     'EXECUTE'
--   ) as authenticated_can_execute,
--   has_function_privilege(
--     'service_role',
--     format(
--       '%I.%I(uuid)',
--       routine.routine_schema,
--       routine.routine_name
--     ),
--     'EXECUTE'
--   ) as service_role_can_execute
-- from information_schema.routines as routine
-- where routine.routine_schema = 'public'
--   and routine.routine_name in (
--     'is_institution_admin',
--     'can_view_institution_profile'
--   )
-- order by routine.routine_name;