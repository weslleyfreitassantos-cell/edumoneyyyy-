-- Deny user-facing authorization as soon as the authenticated profile is
-- deactivated, even when the client still holds an unexpired JWT.
begin;

create or replace function private.is_current_profile_active()
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
  );
$$;

alter function private.is_current_profile_active()
  owner to postgres;

revoke all on function private.is_current_profile_active()
  from public, anon, authenticated;

grant execute on function private.is_current_profile_active()
  to authenticated, service_role;

create or replace function public.is_platform_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_current_profile_active()
    and exists (
      select 1
      from public.profiles as profile
      where profile.id = auth.uid()
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
  select private.is_current_profile_active()
    and exists (
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
  select private.is_current_profile_active()
    and exists (
      select 1
      from public.institutions as institution
      join public.accounts as account
        on account.id = institution.account_id
      where institution.id = target_institution_id
        and public.is_institution_operational(institution.id)
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
    private.is_current_profile_active()
    and public.is_institution_operational(target_institution_id)
    and (
      public.is_platform_super_admin()
      or public.owns_institution(target_institution_id)
      or exists (
        select 1
        from public.memberships as membership
        where membership.profile_id = auth.uid()
          and membership.institution_id = target_institution_id
          and membership.active is true
      )
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
    private.is_current_profile_active()
    and public.is_institution_operational(target_institution_id)
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
    private.is_current_profile_active()
    and public.is_institution_operational(target_institution_id)
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
              'ADMIN'::public.user_role,
              'DIRECTOR'::public.user_role,
              'SECRETARY'::public.user_role
            ]
          )
      )
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
    private.is_current_profile_active()
    and public.is_institution_operational(target_institution_id)
    and (
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
      )
    );
$$;

create or replace function private.has_exact_institution_role(
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
    private.is_current_profile_active()
    and exists (
      select 1
      from public.memberships as membership
      where membership.profile_id = auth.uid()
        and membership.institution_id = target_institution_id
        and membership.active is true
        and membership.role = any (allowed_roles)
    );
$$;

create or replace function private.is_teacher_for_offering(
  target_offering_id uuid,
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_current_profile_active()
    and public.is_institution_operational(target_institution_id)
    and exists (
      select 1
      from public.subject_offerings as offering
      join public.classes as class
        on class.id = offering.class_id
      join public.subjects as subject
        on subject.id = offering.subject_id
      join public.memberships as membership
        on membership.profile_id = auth.uid()
       and membership.institution_id = class.institution_id
      where offering.id = target_offering_id
        and offering.teacher_profile_id = auth.uid()
        and offering.active is true
        and class.active is true
        and subject.active is true
        and class.institution_id = target_institution_id
        and subject.institution_id = target_institution_id
        and membership.active is true
        and membership.role = 'TEACHER'::public.user_role
    );
$$;

create or replace function private.is_student_owner(
  target_student_id uuid,
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_current_profile_active()
    and public.is_institution_operational(target_institution_id)
    and exists (
      select 1
      from public.students as student
      join public.memberships as membership
        on membership.profile_id = student.profile_id
       and membership.institution_id = student.institution_id
      where student.id = target_student_id
        and student.profile_id = auth.uid()
        and student.institution_id = target_institution_id
        and student.active is true
        and membership.active is true
        and membership.role = 'STUDENT'::public.user_role
    );
$$;

create or replace function private.is_student_enrolled_in_offering(
  target_offering_id uuid,
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_current_profile_active()
    and public.is_institution_operational(target_institution_id)
    and exists (
      select 1
      from public.subject_offerings as offering
      join public.classes as class
        on class.id = offering.class_id
      join public.enrollments as enrollment
        on enrollment.class_id = class.id
      join public.students as student
        on student.id = enrollment.student_id
      join public.memberships as membership
        on membership.profile_id = student.profile_id
       and membership.institution_id = student.institution_id
      where offering.id = target_offering_id
        and class.institution_id = target_institution_id
        and student.institution_id = target_institution_id
        and student.profile_id = auth.uid()
        and offering.active is true
        and class.active is true
        and enrollment.active is true
        and student.active is true
        and membership.active is true
        and membership.role = 'STUDENT'::public.user_role
    );
$$;

create or replace function private.is_guardian_of_student(
  target_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_current_profile_active()
    and exists (
      select 1
      from public.guardianships as guardianship
      where guardianship.student_id = target_student_id
        and guardianship.guardian_profile_id = auth.uid()
        and guardianship.active is true
    );
$$;

create or replace function private.is_active_student_of_institution(
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_current_profile_active()
    and exists (
      select 1
      from public.students as student
      where student.profile_id = auth.uid()
        and student.institution_id = target_institution_id
        and student.active is true
    );
$$;

create or replace function private.is_active_guardian_of_institution(
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_current_profile_active()
    and exists (
      select 1
      from public.guardianships as guardianship
      join public.students as student
        on student.id = guardianship.student_id
      where guardianship.guardian_profile_id = auth.uid()
        and guardianship.active is true
        and student.institution_id = target_institution_id
        and student.active is true
    );
$$;

create or replace function private.is_active_student_of_calendar_class(
  target_institution_id uuid,
  target_class_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_current_profile_active()
    and exists (
      select 1
      from public.students as student
      join public.enrollments as enrollment
        on enrollment.student_id = student.id
       and enrollment.class_id = target_class_id
       and enrollment.active is true
      where student.profile_id = auth.uid()
        and student.institution_id = target_institution_id
        and student.active is true
    );
$$;

create or replace function private.is_active_guardian_of_calendar_class(
  target_institution_id uuid,
  target_class_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_current_profile_active()
    and exists (
      select 1
      from public.guardianships as guardianship
      join public.students as student
        on student.id = guardianship.student_id
      join public.enrollments as enrollment
        on enrollment.student_id = student.id
       and enrollment.class_id = target_class_id
       and enrollment.active is true
      where guardianship.guardian_profile_id = auth.uid()
        and guardianship.active is true
        and student.institution_id = target_institution_id
        and student.active is true
    );
$$;

create or replace function private.is_active_teacher_of_calendar_class(
  target_institution_id uuid,
  target_class_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_current_profile_active()
    and exists (
      select 1
      from public.memberships as membership
      join public.subject_offerings as offering
        on offering.teacher_profile_id = membership.profile_id
       and offering.class_id = target_class_id
       and offering.active is true
      join public.classes as class_record
        on class_record.id = offering.class_id
       and class_record.institution_id = target_institution_id
      where membership.profile_id = auth.uid()
        and membership.institution_id = target_institution_id
        and membership.role = 'TEACHER'::public.user_role
        and membership.active is true
    );
$$;

drop policy if exists profiles_select_policy on public.profiles;
create policy profiles_select_policy
on public.profiles
for select
to authenticated
using (
  private.is_current_profile_active()
  and (
    id = auth.uid()
    or public.is_platform_super_admin()
    or exists (
      select 1
      from public.memberships as membership
      where membership.profile_id = profiles.id
        and public.can_access_institution(membership.institution_id)
    )
  )
);

drop policy if exists profiles_update_own_name_policy on public.profiles;
create policy profiles_update_own_name_policy
on public.profiles
for update
to authenticated
using (
  private.is_current_profile_active()
  and id = auth.uid()
)
with check (
  private.is_current_profile_active()
  and id = auth.uid()
  and full_name = btrim(full_name)
  and char_length(full_name) between 2 and 120
);

drop policy if exists memberships_select_policy on public.memberships;
create policy memberships_select_policy
on public.memberships
for select
to authenticated
using (
  private.is_current_profile_active()
  and (
    profile_id = auth.uid()
    or public.can_access_institution(institution_id)
  )
);

drop policy if exists students_select_policy on public.students;
create policy students_select_policy
on public.students
for select
to authenticated
using (
  private.is_current_profile_active()
  and (
    public.can_manage_institution_operations(institution_id)
    or profile_id = auth.uid()
    or private.is_guardian_of_student(id)
  )
);

drop policy if exists guardianships_select_policy on public.guardianships;
create policy guardianships_select_policy
on public.guardianships
for select
to authenticated
using (
  private.is_current_profile_active()
  and (
    guardian_profile_id = auth.uid()
    or private.can_manage_student(student_id)
  )
);

drop policy if exists guardianships_student_select on public.guardianships;
create policy guardianships_student_select
on public.guardianships
for select
to authenticated
using (
  private.is_current_profile_active()
  and exists (
    select 1
    from public.students as student
    where student.id = guardianships.student_id
      and student.profile_id = auth.uid()
  )
);

drop policy if exists subject_offerings_select_policy on public.subject_offerings;
create policy subject_offerings_select_policy
on public.subject_offerings
for select
to authenticated
using (
  private.is_current_profile_active()
  and (
    teacher_profile_id = auth.uid()
    or exists (
      select 1
      from public.classes as class
      where class.id = subject_offerings.class_id
        and public.can_access_institution(class.institution_id)
    )
  )
);

drop policy if exists academic_calendar_events_teacher_select
  on public.academic_calendar_events;
create policy academic_calendar_events_teacher_select
on public.academic_calendar_events
for select
to authenticated
using (
  private.is_current_profile_active()
  and active is true
  and (
    audience in ('ALL', 'TEACHERS')
    or (
      audience = 'CLASS'
      and private.is_active_teacher_of_calendar_class(institution_id, class_id)
    )
  )
  and exists (
    select 1
    from public.memberships as membership
    where membership.profile_id = auth.uid()
      and membership.institution_id = institution_id
      and membership.role = 'TEACHER'::public.user_role
      and membership.active is true
  )
);

drop policy if exists finance_contract_guardian on public.financial_contracts;
create policy finance_contract_guardian
on public.financial_contracts
for select
to authenticated
using (
  private.is_current_profile_active()
  and financial_responsible_profile_id = auth.uid()
);

drop policy if exists finance_invoice_guardian on public.invoices;
create policy finance_invoice_guardian
on public.invoices
for select
to authenticated
using (
  private.is_current_profile_active()
  and financial_responsible_profile_id = auth.uid()
);

drop policy if exists finance_payment_guardian on public.payments;
create policy finance_payment_guardian
on public.payments
for select
to authenticated
using (
  private.is_current_profile_active()
  and exists (
    select 1
    from public.invoices as invoice
    where invoice.id = payments.invoice_id
      and invoice.financial_responsible_profile_id = auth.uid()
  )
);

drop policy if exists finance_provider_staff on public.payment_provider_accounts;
create policy finance_provider_staff
on public.payment_provider_accounts
for select
to authenticated
using (
  private.is_current_profile_active()
  and exists (
    select 1
    from public.memberships as membership
    where membership.profile_id = auth.uid()
      and membership.institution_id = payment_provider_accounts.institution_id
      and membership.active is true
      and membership.role = any (
        array[
          'ADMIN'::public.user_role,
          'DIRECTOR'::public.user_role,
          'SECRETARY'::public.user_role
        ]
      )
  )
);

-- Learning helpers are also user-facing, so keep their identity checks behind
-- the same database-side barrier without changing their existing role scope.
create or replace function private.learning_is_teacher(target_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.is_current_profile_active()
    and exists (
      select 1
      from public.memberships as membership
      where membership.profile_id = auth.uid()
        and membership.institution_id = target_institution_id
        and membership.role = 'TEACHER'::public.user_role
        and membership.active is true
    );
$$;

create or replace function private.learning_is_assigned_student(
  target_activity_id uuid,
  target_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.is_current_profile_active()
    and exists (
      select 1
      from public.learning_assignments as assignment
      join public.enrollments as enrollment
        on enrollment.class_id = assignment.class_id
       and enrollment.active is true
      join public.students as student
        on student.id = enrollment.student_id
       and student.active is true
      where assignment.activity_id = target_activity_id
        and student.id = target_student_id
        and student.profile_id = auth.uid()
    );
$$;

create or replace function private.learning_is_activity_teacher(
  target_activity_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.is_current_profile_active()
    and exists (
      select 1
      from public.learning_activities as activity
      where activity.id = target_activity_id
        and activity.teacher_id = auth.uid()
    );
$$;

create or replace function private.learning_can_read_activity(
  target_activity_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.is_current_profile_active()
    and (
      private.learning_is_activity_teacher(target_activity_id)
      or exists (
        select 1
        from public.learning_assignments as assignment
        join public.enrollments as enrollment
          on enrollment.class_id = assignment.class_id
         and enrollment.active is true
        join public.students as student
          on student.id = enrollment.student_id
         and student.active is true
        join public.learning_activities as activity
          on activity.id = assignment.activity_id
         and activity.status = 'PUBLISHED'
        where assignment.activity_id = target_activity_id
          and student.profile_id = auth.uid()
      )
    );
$$;

create or replace function private.learning_can_read_assignment(
  target_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.is_current_profile_active()
    and exists (
      select 1
      from public.learning_assignments as assignment
      where assignment.id = target_assignment_id
        and (
          assignment.assigned_by = auth.uid()
          or private.learning_is_activity_teacher(assignment.activity_id)
          or exists (
            select 1
            from public.enrollments as enrollment
            join public.students as student
              on student.id = enrollment.student_id
             and enrollment.active is true
             and student.active is true
            where enrollment.class_id = assignment.class_id
              and student.profile_id = auth.uid()
          )
        )
    );
$$;

create or replace function private.learning_teacher_owns_subject(
  target_institution_id uuid,
  target_subject_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.is_current_profile_active()
    and exists (
      select 1
      from public.subject_offerings as offering
      join public.subjects as subject
        on subject.id = offering.subject_id
      where offering.subject_id = target_subject_id
        and offering.teacher_profile_id = auth.uid()
        and offering.active is true
        and subject.institution_id = target_institution_id
        and subject.active is true
    );
$$;

create or replace function private.learning_teacher_owns_subject_class(
  target_institution_id uuid,
  target_subject_id uuid,
  target_class_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.is_current_profile_active()
    and exists (
      select 1
      from public.subject_offerings as offering
      join public.subjects as subject
        on subject.id = offering.subject_id
      join public.classes as class
        on class.id = offering.class_id
      where offering.subject_id = target_subject_id
        and offering.class_id = target_class_id
        and offering.teacher_profile_id = auth.uid()
        and offering.active is true
        and subject.institution_id = target_institution_id
        and class.institution_id = target_institution_id
        and subject.active is true
        and class.active is true
    );
$$;

create or replace function private.learning_teacher_can_assign_activity(
  target_activity_id uuid,
  target_institution_id uuid,
  target_class_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.is_current_profile_active()
    and exists (
      select 1
      from public.learning_activities as activity
      join public.subjects as subject
        on subject.id = activity.subject_id
      join public.classes as class
        on class.id = target_class_id
      where activity.id = target_activity_id
        and activity.institution_id = target_institution_id
        and activity.teacher_id = auth.uid()
        and subject.institution_id = target_institution_id
        and coalesce(subject.active, true)
        and class.institution_id = target_institution_id
        and coalesce(class.active, true)
        and (
          exists (
            select 1
            from public.subject_offerings as offering
            where offering.subject_id = activity.subject_id
              and offering.class_id = target_class_id
              and offering.teacher_profile_id = auth.uid()
              and coalesce(offering.active, true)
          )
          or exists (
            select 1
            from public.subject_offerings as offering
            join public.subjects as owned_subject
              on owned_subject.id = offering.subject_id
            where offering.class_id = target_class_id
              and offering.teacher_profile_id = auth.uid()
              and coalesce(offering.active, true)
              and owned_subject.institution_id = target_institution_id
              and coalesce(owned_subject.active, true)
          )
        )
    );
$$;

create or replace function private.learning_can_assign_activity(
  target_activity_id uuid,
  target_institution_id uuid,
  target_class_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.learning_teacher_can_assign_activity(
    target_activity_id,
    target_institution_id,
    target_class_id
  );
$$;

create or replace function private.learning_can_read_collection(
  target_collection_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.is_current_profile_active()
    and exists (
      select 1
      from public.learning_collections as collection
      where collection.id = target_collection_id
        and (
          collection.teacher_id = auth.uid()
          or (
            collection.status = 'PUBLISHED'
            and exists (
              select 1
              from public.enrollments as enrollment
              join public.students as student
                on student.id = enrollment.student_id
               and student.active is true
              where enrollment.class_id = collection.class_id
                and enrollment.active is true
                and student.profile_id = auth.uid()
            )
          )
        )
    );
$$;

create or replace function private.learning_can_read_resource(
  target_resource_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.is_current_profile_active()
    and exists (
      select 1
      from public.learning_resources as resource
      where resource.id = target_resource_id
        and private.learning_can_read_collection(resource.collection_id)
        and (
          resource.approved
          or exists (
            select 1
            from public.learning_collections as collection
            where collection.id = resource.collection_id
              and collection.teacher_id = auth.uid()
          )
        )
    );
$$;

create or replace function private.book_is_teacher_for_offering(
  target_offering_id uuid,
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_current_profile_active()
    and public.is_institution_operational(target_institution_id)
    and exists (
      select 1
      from public.subject_offerings as offering
      join public.classes as class
        on class.id = offering.class_id
      join public.subjects as subject
        on subject.id = offering.subject_id
      join public.memberships as membership
        on membership.profile_id = auth.uid()
       and membership.institution_id = class.institution_id
      where offering.id = target_offering_id
        and offering.teacher_profile_id = auth.uid()
        and offering.active is true
        and class.active is true
        and subject.active is true
        and class.institution_id = target_institution_id
        and subject.institution_id = target_institution_id
        and membership.active is true
        and membership.role = 'TEACHER'::public.user_role
    );
$$;

create or replace function private.book_is_student_enrolled_in_offering(
  target_offering_id uuid,
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_current_profile_active()
    and public.is_institution_operational(target_institution_id)
    and exists (
      select 1
      from public.subject_offerings as offering
      join public.classes as class
        on class.id = offering.class_id
      join public.subjects as subject
        on subject.id = offering.subject_id
      join public.enrollments as enrollment
        on enrollment.class_id = class.id
      join public.students as student
        on student.id = enrollment.student_id
      join public.memberships as membership
        on membership.profile_id = student.profile_id
       and membership.institution_id = student.institution_id
      where offering.id = target_offering_id
        and offering.active is true
        and class.active is true
        and class.institution_id = target_institution_id
        and subject.institution_id = target_institution_id
        and student.profile_id = auth.uid()
        and student.institution_id = target_institution_id
        and student.active is true
        and enrollment.active is true
        and membership.active is true
        and membership.role = 'STUDENT'::public.user_role
    );
$$;

revoke all on function private.is_current_profile_active() from public, anon;
grant execute on function private.is_current_profile_active() to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
