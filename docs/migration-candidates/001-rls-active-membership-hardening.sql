-- MIGRATION CANDIDATE / REVIEW ONLY
-- Do not execute directly in production.
-- Do not run through Supabase CLI yet.
-- This file is intentionally stored under docs/migration-candidates, not supabase/migrations.
-- Requires baseline/reconciliation before becoming a real migration.
-- Review in staging first.

create or replace function public.is_institution_admin(target_institution_id uuid)
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

create or replace function public.can_view_institution_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  -- Filtering the target membership as active can block management of inactive
  -- users. The mandatory active filter is on the viewer membership.
  select exists (
    select 1
    from public.memberships as viewer_membership
    join public.memberships as target_membership
      on target_membership.institution_id = viewer_membership.institution_id
    where viewer_membership.profile_id = auth.uid()
      and viewer_membership.role in ('ADMIN', 'DIRECTOR')
      and viewer_membership.active is true
      and target_membership.profile_id = target_profile_id
  );
$function$;

drop policy if exists "Users can view academic_years from own institution"
  on public.academic_years;

create policy "Users can view academic_years from own institution"
  on public.academic_years
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships as membership
      where membership.profile_id = auth.uid()
        and membership.institution_id = academic_years.institution_id
        and membership.active is true
    )
  );

drop policy if exists "Users can view classes from own institution"
  on public.classes;

create policy "Users can view classes from own institution"
  on public.classes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships as membership
      where membership.profile_id = auth.uid()
        and membership.institution_id = classes.institution_id
        and membership.active is true
    )
  );

drop policy if exists "Users can view enrollments from own institution"
  on public.enrollments;

create policy "Users can view enrollments from own institution"
  on public.enrollments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.students as student
      join public.classes as class
        on class.id = enrollments.class_id
       and class.institution_id = student.institution_id
      join public.academic_years as academic_year
        on academic_year.id = enrollments.academic_year_id
       and academic_year.institution_id = student.institution_id
      join public.memberships as membership
        on membership.institution_id = student.institution_id
      where student.id = enrollments.student_id
        and membership.profile_id = auth.uid()
        and membership.active is true
    )
  );

drop policy if exists "Users can view guardianships from own institution"
  on public.guardianships;

create policy "Users can view guardianships from own institution"
  on public.guardianships
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.students as student
      join public.memberships as membership
        on membership.institution_id = student.institution_id
      where student.id = guardianships.student_id
        and membership.profile_id = auth.uid()
        and membership.active is true
    )
  );

drop policy if exists "Users can view own institution"
  on public.institutions;

create policy "Users can view own institution"
  on public.institutions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships as membership
      where membership.profile_id = auth.uid()
        and membership.institution_id = institutions.id
        and membership.active is true
    )
  );

drop policy if exists "Users can view own memberships"
  on public.memberships;

create policy "Users can view own memberships"
  on public.memberships
  for select
  to authenticated
  using (
    profile_id = auth.uid()
    and active is true
  );

drop policy if exists "Institution admins can view memberships"
  on public.memberships;

create policy "Institution admins can view memberships"
  on public.memberships
  for select
  to authenticated
  using (
    public.is_institution_admin(institution_id)
  );

drop policy if exists "Users can view own profile"
  on public.profiles;

create policy "Users can view own profile"
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
  );

drop policy if exists "Institution admins can view institution profiles"
  on public.profiles;

create policy "Institution admins can view institution profiles"
  on public.profiles
  for select
  to authenticated
  using (
    public.can_view_institution_profile(id)
  );

drop policy if exists "Users can view own institution students"
  on public.students;

create policy "Users can view own institution students"
  on public.students
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships as membership
      where membership.profile_id = auth.uid()
        and membership.institution_id = students.institution_id
        and membership.active is true
    )
  );

drop policy if exists "Users can view students from own institution"
  on public.students;

create policy "Users can view students from own institution"
  on public.students
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships as membership
      where membership.profile_id = auth.uid()
        and membership.institution_id = students.institution_id
        and membership.active is true
    )
  );

drop policy if exists "Institution admins can insert students"
  on public.students;

create policy "Institution admins can insert students"
  on public.students
  for insert
  to authenticated
  with check (
    public.is_institution_admin(institution_id)
  );

drop policy if exists "Institution admins can update students"
  on public.students;

create policy "Institution admins can update students"
  on public.students
  for update
  to authenticated
  using (
    public.is_institution_admin(institution_id)
  )
  with check (
    public.is_institution_admin(institution_id)
  );

drop policy if exists "Users can view subject_offerings from own institution"
  on public.subject_offerings;

create policy "Users can view subject_offerings from own institution"
  on public.subject_offerings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.classes as class
      join public.subjects as subject
        on subject.id = subject_offerings.subject_id
       and subject.institution_id = class.institution_id
      join public.terms as term
        on term.id = subject_offerings.term_id
      join public.academic_years as academic_year
        on academic_year.id = term.academic_year_id
       and academic_year.institution_id = class.institution_id
      join public.memberships as membership
        on membership.institution_id = class.institution_id
      where class.id = subject_offerings.class_id
        and membership.profile_id = auth.uid()
        and membership.active is true
    )
  );

drop policy if exists "Users can view subjects from own institution"
  on public.subjects;

create policy "Users can view subjects from own institution"
  on public.subjects
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships as membership
      where membership.profile_id = auth.uid()
        and membership.institution_id = subjects.institution_id
        and membership.active is true
    )
  );

drop policy if exists "Users can view terms from own institution"
  on public.terms;

create policy "Users can view terms from own institution"
  on public.terms
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.academic_years as academic_year
      join public.memberships as membership
        on membership.institution_id = academic_year.institution_id
      where academic_year.id = terms.academic_year_id
        and membership.profile_id = auth.uid()
        and membership.active is true
    )
  );

-- OPTIONAL / REVIEW SEPARATELY
-- Revoking anon EXECUTE must be tested because policies may depend on EXECUTE
-- privilege during RLS evaluation.
-- revoke execute on function public.is_institution_admin(uuid) from anon;
-- revoke execute on function public.can_view_institution_profile(uuid) from anon;

-- POST-MIGRATION READ-ONLY CHECKS
-- select pg_get_functiondef('public.is_institution_admin(uuid)'::regprocedure);
-- select pg_get_functiondef('public.can_view_institution_profile(uuid)'::regprocedure);
--
-- select schemaname, tablename, policyname, cmd, qual, with_check
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
-- order by tablename, policyname;
--
-- select n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
-- from pg_class as c
-- join pg_namespace as n
--   on n.oid = c.relnamespace
-- where n.nspname = 'public'
--   and c.relname in (
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
-- order by c.relname;
--
-- select role, active, count(*)
-- from public.memberships
-- group by role, active
-- order by role, active;
