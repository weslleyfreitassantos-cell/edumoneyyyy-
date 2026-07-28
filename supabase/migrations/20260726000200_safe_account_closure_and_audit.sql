begin;

create table if not exists public.account_status_events (
  id uuid primary key default extensions.uuid_generate_v4(),
  account_id uuid not null
    references public.accounts(id) on delete restrict,
  actor_profile_id uuid null
    references public.profiles(id) on delete set null,
  previous_status text not null,
  new_status text not null,
  reason text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint account_status_events_previous_status_check
    check (previous_status in ('ACTIVE', 'SUSPENDED', 'CANCELED')),
  constraint account_status_events_new_status_check
    check (new_status in ('ACTIVE', 'SUSPENDED', 'CANCELED')),
  constraint account_status_events_reason_length_check
    check (
      reason is null
      or length(reason) between 10 and 500
    ),
  constraint account_status_events_reason_required_check
    check (
      new_status = 'ACTIVE'
      or reason is not null
    )
);

create index if not exists account_status_events_account_id_idx
  on public.account_status_events(account_id);

create index if not exists account_status_events_created_at_idx
  on public.account_status_events(created_at desc);

alter table public.account_status_events
  enable row level security;

drop policy if exists account_status_events_select_policy
  on public.account_status_events;

create policy account_status_events_select_policy
on public.account_status_events
for select
to authenticated
using (public.is_platform_super_admin());

revoke all on table public.account_status_events
  from public, anon, authenticated;

grant select on table public.account_status_events
  to authenticated;

grant all on table public.account_status_events
  to service_role;

create or replace function public.is_institution_operational(
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
    left join public.accounts as account
      on account.id = institution.account_id
    where institution.id = target_institution_id
      and institution.active is true
      and (
        institution.account_id is null
        or account.status = 'ACTIVE'
      )
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
    public.is_institution_operational(target_institution_id)
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
    public.is_institution_operational(target_institution_id)
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
    public.is_institution_operational(target_institution_id)
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
    public.is_institution_operational(target_institution_id)
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

create or replace function public.change_account_status(
  target_account_id uuid,
  target_status text,
  actor_profile_id uuid,
  change_reason text default null,
  change_metadata jsonb default '{}'::jsonb
)
returns table (
  account_id uuid,
  previous_status text,
  new_status text,
  institution_limit integer,
  audit_event_id uuid,
  status_changed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_record public.accounts%rowtype;
  normalized_status text;
  normalized_reason text;
  created_event_id uuid;
begin
  normalized_status := upper(trim(target_status));

  if normalized_status not in ('ACTIVE', 'SUSPENDED', 'CANCELED') then
    raise exception 'ACCOUNT_STATUS_TRANSITION_INVALID'
      using errcode = 'P0001';
  end if;

  select *
  into account_record
  from public.accounts as account
  where account.id = target_account_id
  for update;

  if not found then
    raise exception 'ACCOUNT_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  normalized_reason := nullif(
    btrim(
      regexp_replace(
        coalesce(change_reason, ''),
        '\s+',
        ' ',
        'g'
      )
    ),
    ''
  );

  if account_record.status = normalized_status then
    return query
      select
        account_record.id,
        account_record.status,
        account_record.status,
        account_record.institution_limit,
        null::uuid,
        false;
    return;
  end if;

  if account_record.status = 'CANCELED' then
    raise exception 'ACCOUNT_ALREADY_CANCELED'
      using errcode = 'P0001';
  end if;

  if not (
    (account_record.status = 'ACTIVE' and normalized_status in ('SUSPENDED', 'CANCELED'))
    or (account_record.status = 'SUSPENDED' and normalized_status in ('ACTIVE', 'CANCELED'))
  ) then
    raise exception 'ACCOUNT_STATUS_TRANSITION_INVALID'
      using errcode = 'P0001';
  end if;

  if normalized_status in ('SUSPENDED', 'CANCELED')
      and normalized_reason is null then
    raise exception 'ACCOUNT_STATUS_REASON_REQUIRED'
      using errcode = 'P0001';
  end if;

  if normalized_reason is not null
      and not (length(normalized_reason) between 10 and 500) then
    raise exception 'ACCOUNT_STATUS_REASON_REQUIRED'
      using errcode = 'P0001';
  end if;

  update public.accounts
  set status = normalized_status
  where id = account_record.id;

  insert into public.account_status_events (
    account_id,
    actor_profile_id,
    previous_status,
    new_status,
    reason,
    metadata
  )
  values (
    account_record.id,
    actor_profile_id,
    account_record.status,
    normalized_status,
    normalized_reason,
    coalesce(change_metadata, '{}'::jsonb)
  )
  returning id into created_event_id;

  return query
    select
      account_record.id,
      account_record.status,
      normalized_status,
      account_record.institution_limit,
      created_event_id,
      true;
end;
$$;

revoke all on function public.is_institution_operational(uuid)
  from public, anon, authenticated;

revoke all on function public.change_account_status(uuid, text, uuid, text, jsonb)
  from public, anon, authenticated;

grant execute on function public.is_institution_operational(uuid)
  to authenticated, service_role;

grant execute on function public.change_account_status(uuid, text, uuid, text, jsonb)
  to service_role;

commit;
