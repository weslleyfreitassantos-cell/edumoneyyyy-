create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function public.is_platform_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = auth.uid()
      and profile.active is true
      and profile.platform_role = 'SUPER_ADMIN'::public.platform_role
  );
$$;

create or replace function public.owns_account(
  target_account_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.accounts as account
    where account.id = target_account_id
      and account.owner_profile_id = auth.uid()
      and account.status = 'ACTIVE'
  );
$$;

create or replace function public.owns_institution(
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.institutions as institution
    join public.accounts as account
      on account.id = institution.account_id
    where institution.id = target_institution_id
      and institution.active is true
      and account.status = 'ACTIVE'
      and account.owner_profile_id = auth.uid()
  );
$$;

create or replace function public.can_access_institution(
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_platform_super_admin()
    or public.owns_institution(target_institution_id)
    or exists (
      select 1
      from public.memberships as membership
      join public.institutions as institution
        on institution.id = membership.institution_id
      where membership.profile_id = auth.uid()
        and membership.institution_id = target_institution_id
        and membership.active is true
        and institution.active is true
    );
$$;

create or replace function public.is_institution_admin(
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_platform_super_admin()
    or public.owns_institution(target_institution_id)
    or exists (
      select 1
      from public.memberships as membership
      where membership.profile_id = auth.uid()
        and membership.institution_id = target_institution_id
        and membership.active is true
        and membership.role = 'DIRECTOR'::public.user_role
    )
    or exists (
      select 1
      from public.memberships as membership
      join public.institutions as institution
        on institution.id = membership.institution_id
      where membership.profile_id = auth.uid()
        and membership.institution_id = target_institution_id
        and membership.active is true
        and membership.role = 'ADMIN'::public.user_role
        and institution.account_id is null
    );
$$;

create or replace function public.can_manage_institution_operations(
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_platform_super_admin()
    or public.owns_institution(target_institution_id)
    or exists (
      select 1
      from public.memberships as membership
      where membership.profile_id = auth.uid()
        and membership.institution_id = target_institution_id
        and membership.active is true
        and membership.role = any (
          array[
            'DIRECTOR'::public.user_role,
            'SECRETARY'::public.user_role
          ]
        )
    )
    or exists (
      select 1
      from public.memberships as membership
      join public.institutions as institution
        on institution.id = membership.institution_id
      where membership.profile_id = auth.uid()
        and membership.institution_id = target_institution_id
        and membership.active is true
        and membership.role = 'ADMIN'::public.user_role
        and institution.account_id is null
    );
$$;

create or replace function private.has_institution_role(
  target_institution_id uuid,
  allowed_roles public.user_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.memberships as membership
      where membership.profile_id = auth.uid()
        and membership.institution_id = target_institution_id
        and membership.active is true
        and membership.role = any (allowed_roles)
    )
    or (
      (
        'ADMIN'::public.user_role = any (allowed_roles)
        or 'DIRECTOR'::public.user_role = any (allowed_roles)
      )
      and public.is_institution_admin(target_institution_id)
    );
$$;

create or replace function private.is_admin_or_director(
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_institution_admin(target_institution_id);
$$;

alter table public.accounts
  enable row level security;

alter table public.institutions
  enable row level security;

alter table public.profiles
  enable row level security;

alter table public.memberships
  enable row level security;

alter table public.students
  enable row level security;

alter table public.guardianships
  enable row level security;

alter table public.academic_years
  enable row level security;

alter table public.terms
  enable row level security;

alter table public.classes
  enable row level security;

alter table public.subjects
  enable row level security;

alter table public.subject_offerings
  enable row level security;

alter table public.enrollments
  enable row level security;

alter table public.student_registration_counters
  enable row level security;

drop policy if exists accounts_select_policy
  on public.accounts;

create policy accounts_select_policy
on public.accounts
for select
to authenticated
using (
  public.is_platform_super_admin()
  or public.owns_account(id)
);

drop policy if exists institutions_select_policy
  on public.institutions;

create policy institutions_select_policy
on public.institutions
for select
to authenticated
using (
  public.can_access_institution(id)
);

drop policy if exists profiles_select_policy
  on public.profiles;

create policy profiles_select_policy
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_platform_super_admin()
  or exists (
    select 1
    from public.memberships as membership
    where membership.profile_id = profiles.id
      and public.can_access_institution(membership.institution_id)
  )
);

drop policy if exists memberships_select_policy
  on public.memberships;

create policy memberships_select_policy
on public.memberships
for select
to authenticated
using (
  profile_id = auth.uid()
  or public.can_access_institution(institution_id)
);

drop policy if exists memberships_update_policy
  on public.memberships;

create policy memberships_update_policy
on public.memberships
for update
to authenticated
using (
  public.can_manage_institution_operations(institution_id)
)
with check (
  public.can_manage_institution_operations(institution_id)
);

drop policy if exists students_select_policy
  on public.students;

create policy students_select_policy
on public.students
for select
to authenticated
using (
  public.can_manage_institution_operations(institution_id)
  or profile_id = auth.uid()
  or exists (
    select 1
    from public.guardianships as guardianship
    where guardianship.student_id = students.id
      and guardianship.guardian_profile_id = auth.uid()
      and guardianship.active is true
  )
);

drop policy if exists students_update_policy
  on public.students;

create policy students_update_policy
on public.students
for update
to authenticated
using (
  public.can_manage_institution_operations(institution_id)
)
with check (
  public.can_manage_institution_operations(institution_id)
);

drop policy if exists guardianships_select_policy
  on public.guardianships;

create policy guardianships_select_policy
on public.guardianships
for select
to authenticated
using (
  guardian_profile_id = auth.uid()
  or exists (
    select 1
    from public.students as student
    where student.id = guardianships.student_id
      and public.can_manage_institution_operations(student.institution_id)
  )
);

drop policy if exists guardianships_update_policy
  on public.guardianships;

create policy guardianships_update_policy
on public.guardianships
for update
to authenticated
using (
  exists (
    select 1
    from public.students as student
    where student.id = guardianships.student_id
      and public.can_manage_institution_operations(student.institution_id)
  )
)
with check (
  exists (
    select 1
    from public.students as student
    where student.id = guardianships.student_id
      and public.can_manage_institution_operations(student.institution_id)
  )
);

drop policy if exists academic_years_select_policy
  on public.academic_years;

create policy academic_years_select_policy
on public.academic_years
for select
to authenticated
using (
  public.can_access_institution(institution_id)
);

drop policy if exists academic_years_write_policy
  on public.academic_years;

create policy academic_years_write_policy
on public.academic_years
for all
to authenticated
using (
  public.is_institution_admin(institution_id)
)
with check (
  public.is_institution_admin(institution_id)
);

drop policy if exists classes_select_policy
  on public.classes;

create policy classes_select_policy
on public.classes
for select
to authenticated
using (
  public.can_access_institution(institution_id)
);

drop policy if exists classes_write_policy
  on public.classes;

create policy classes_write_policy
on public.classes
for all
to authenticated
using (
  public.can_manage_institution_operations(institution_id)
)
with check (
  public.can_manage_institution_operations(institution_id)
);

drop policy if exists subjects_select_policy
  on public.subjects;

create policy subjects_select_policy
on public.subjects
for select
to authenticated
using (
  public.can_access_institution(institution_id)
);

drop policy if exists subjects_write_policy
  on public.subjects;

create policy subjects_write_policy
on public.subjects
for all
to authenticated
using (
  public.is_institution_admin(institution_id)
)
with check (
  public.is_institution_admin(institution_id)
);

drop policy if exists enrollments_select_policy
  on public.enrollments;

create policy enrollments_select_policy
on public.enrollments
for select
to authenticated
using (
  exists (
    select 1
    from public.classes as class
    join public.students as student
      on student.id = enrollments.student_id
    where class.id = enrollments.class_id
      and class.institution_id = student.institution_id
      and public.can_access_institution(class.institution_id)
  )
);

drop policy if exists enrollments_write_policy
  on public.enrollments;

create policy enrollments_write_policy
on public.enrollments
for all
to authenticated
using (
  exists (
    select 1
    from public.classes as class
    where class.id = enrollments.class_id
      and public.can_manage_institution_operations(class.institution_id)
  )
)
with check (
  exists (
    select 1
    from public.classes as class
    where class.id = enrollments.class_id
      and public.can_manage_institution_operations(class.institution_id)
  )
);

drop policy if exists subject_offerings_select_policy
  on public.subject_offerings;

create policy subject_offerings_select_policy
on public.subject_offerings
for select
to authenticated
using (
  teacher_profile_id = auth.uid()
  or exists (
    select 1
    from public.classes as class
    where class.id = subject_offerings.class_id
      and public.can_access_institution(class.institution_id)
  )
);

drop policy if exists subject_offerings_write_policy
  on public.subject_offerings;

create policy subject_offerings_write_policy
on public.subject_offerings
for all
to authenticated
using (
  exists (
    select 1
    from public.classes as class
    where class.id = subject_offerings.class_id
      and public.is_institution_admin(class.institution_id)
  )
)
with check (
  exists (
    select 1
    from public.classes as class
    where class.id = subject_offerings.class_id
      and public.is_institution_admin(class.institution_id)
  )
);

drop policy if exists terms_select_policy
  on public.terms;

create policy terms_select_policy
on public.terms
for select
to authenticated
using (
  exists (
    select 1
    from public.academic_years as academic_year
    where academic_year.id = terms.academic_year_id
      and public.can_access_institution(academic_year.institution_id)
  )
);

drop policy if exists terms_write_policy
  on public.terms;

create policy terms_write_policy
on public.terms
for all
to authenticated
using (
  exists (
    select 1
    from public.academic_years as academic_year
    where academic_year.id = terms.academic_year_id
      and public.is_institution_admin(academic_year.institution_id)
  )
)
with check (
  exists (
    select 1
    from public.academic_years as academic_year
    where academic_year.id = terms.academic_year_id
      and public.is_institution_admin(academic_year.institution_id)
  )
);

drop policy if exists student_registration_counters_service_policy
  on public.student_registration_counters;

create policy student_registration_counters_service_policy
on public.student_registration_counters
for all
to service_role
using (true)
with check (true);

revoke all on function public.is_platform_super_admin()
  from public, anon, authenticated;

revoke all on function public.owns_account(uuid)
  from public, anon, authenticated;

revoke all on function public.owns_institution(uuid)
  from public, anon, authenticated;

revoke all on function public.can_access_institution(uuid)
  from public, anon, authenticated;

revoke all on function public.is_institution_admin(uuid)
  from public, anon, authenticated;

revoke all on function public.can_manage_institution_operations(uuid)
  from public, anon, authenticated;

revoke all on function private.has_institution_role(uuid, public.user_role[])
  from public, anon, authenticated;

revoke all on function private.is_admin_or_director(uuid)
  from public, anon, authenticated;

grant execute on function public.is_platform_super_admin()
  to authenticated, service_role;

grant execute on function public.owns_account(uuid)
  to authenticated, service_role;

grant execute on function public.owns_institution(uuid)
  to authenticated, service_role;

grant execute on function public.can_access_institution(uuid)
  to authenticated, service_role;

grant execute on function public.is_institution_admin(uuid)
  to authenticated, service_role;

grant execute on function public.can_manage_institution_operations(uuid)
  to authenticated, service_role;

grant execute on function private.has_institution_role(uuid, public.user_role[])
  to authenticated, service_role;

grant execute on function private.is_admin_or_director(uuid)
  to authenticated, service_role;

grant select on table public.accounts
  to authenticated;

grant select on table public.institutions
  to authenticated;

grant select on table public.profiles
  to authenticated;

grant select, update on table public.memberships
  to authenticated;

grant select, update on table public.students
  to authenticated;

grant select, update on table public.guardianships
  to authenticated;

grant select, insert, update, delete on table public.academic_years
  to authenticated;

grant select, insert, update, delete on table public.terms
  to authenticated;

grant select, insert, update, delete on table public.classes
  to authenticated;

grant select, insert, update, delete on table public.subjects
  to authenticated;

grant select, insert, update, delete on table public.enrollments
  to authenticated;

grant select, insert, update, delete on table public.subject_offerings
  to authenticated;

grant all on table public.accounts
  to service_role;

grant all on table public.institutions
  to service_role;
