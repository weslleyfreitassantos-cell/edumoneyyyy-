-- Align school-manager permissions and protect onboarding data integrity.
-- This migration is intentionally additive: it does not delete or rewrite
-- enrollment history, and the unique index fails safely if live duplicates
-- exist and require manual review.

begin;

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
    public.is_institution_operational(target_institution_id)
    and (
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
      )
    );
$$;

-- Normalize values already observed in the database before enforcing the
-- canonical values used by the application.
update public.classes
set shift = case
  when upper(btrim(shift)) like '%INTEGRAL%' then 'INTEGRAL'
  when upper(btrim(shift)) like '%VESPERT%' or upper(btrim(shift)) like '%TARDE%' then 'VESPERTINO'
  when upper(btrim(shift)) like '%NOTURN%' or upper(btrim(shift)) like '%NOITE%' then 'NOTURNO'
  when upper(btrim(shift)) like '%MATUT%' or upper(btrim(shift)) like '%MANH%' then 'MATUTINO'
  else shift
end
where shift is not null
  and upper(btrim(shift)) not in ('MATUTINO', 'VESPERTINO', 'INTEGRAL', 'NOTURNO');

update public.school_time_slots
set shift = case
  when upper(btrim(shift)) like '%INTEGRAL%' then 'INTEGRAL'
  when upper(btrim(shift)) like '%VESPERT%' or upper(btrim(shift)) like '%TARDE%' then 'VESPERTINO'
  when upper(btrim(shift)) like '%NOTURN%' or upper(btrim(shift)) like '%NOITE%' then 'NOTURNO'
  when upper(btrim(shift)) like '%MATUT%' or upper(btrim(shift)) like '%MANH%' then 'MATUTINO'
  else shift
end
where upper(btrim(shift)) not in ('MATUTINO', 'VESPERTINO', 'INTEGRAL', 'NOTURNO');

update public.school_schedule_breaks
set shift = case
  when upper(btrim(shift)) like '%INTEGRAL%' then 'INTEGRAL'
  when upper(btrim(shift)) like '%VESPERT%' or upper(btrim(shift)) like '%TARDE%' then 'VESPERTINO'
  when upper(btrim(shift)) like '%NOTURN%' or upper(btrim(shift)) like '%NOITE%' then 'NOTURNO'
  when upper(btrim(shift)) like '%MATUT%' or upper(btrim(shift)) like '%MANH%' then 'MATUTINO'
  else shift
end
where upper(btrim(shift)) not in ('MATUTINO', 'VESPERTINO', 'INTEGRAL', 'NOTURNO');

alter table public.classes
  drop constraint if exists classes_supported_shift;
alter table public.classes
  add constraint classes_supported_shift
  check (shift is null or shift in ('MATUTINO', 'VESPERTINO', 'INTEGRAL', 'NOTURNO'));

alter table public.school_time_slots
  drop constraint if exists school_time_slots_supported_shift;
alter table public.school_time_slots
  add constraint school_time_slots_supported_shift
  check (shift in ('MATUTINO', 'VESPERTINO', 'INTEGRAL', 'NOTURNO'));

alter table public.school_schedule_breaks
  drop constraint if exists school_schedule_breaks_supported_shift;
alter table public.school_schedule_breaks
  add constraint school_schedule_breaks_supported_shift
  check (shift in ('MATUTINO', 'VESPERTINO', 'INTEGRAL', 'NOTURNO'));

-- One active enrollment per student/year. Historical statuses remain
-- available, including canceled, transferred and closed records.
create unique index if not exists enrollments_active_student_year_unique
  on public.enrollments (student_id, academic_year_id)
  where active is true and lower(btrim(status)) = 'active';

commit;
