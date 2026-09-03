-- Remove legacy read policies that were left alongside the tenant-scoped
-- policies. The duplicates make PostgreSQL evaluate the authorization
-- helpers repeatedly for relational queries under RLS.

begin;

drop policy if exists "Users can view academic_years from own institution"
  on public.academic_years;

drop policy if exists "Users can view classes from own institution"
  on public.classes;

drop policy if exists "Users can view enrollments from own institution"
  on public.enrollments;

drop policy if exists "Users can view guardianships from own institution"
  on public.guardianships;

drop policy if exists "Users can view own institution"
  on public.institutions;

drop policy if exists "Institution admins can view memberships"
  on public.memberships;

drop policy if exists "Users can view own memberships"
  on public.memberships;

drop policy if exists "Institution admins can view institution profiles"
  on public.profiles;

drop policy if exists "Users can view own profile"
  on public.profiles;

drop policy if exists "Users can view own institution students"
  on public.students;

drop policy if exists "Users can view students from own institution"
  on public.students;

drop policy if exists "Users can view subject_offerings from own institution"
  on public.subject_offerings;

drop policy if exists "Users can view subjects from own institution"
  on public.subjects;

drop policy if exists "Users can view terms from own institution"
  on public.terms;

commit;
