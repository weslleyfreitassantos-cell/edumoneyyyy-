begin;

create table if not exists public.privacy_audit_events (
  id uuid primary key default extensions.uuid_generate_v4(),
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  institution_id uuid null references public.institutions(id) on delete set null,
  event_type text not null check (
    event_type in (
      'DATA_EXPORT',
      'RETENTION_DRY_RUN',
      'ANONYMIZATION',
      'HARD_DELETE',
      'ACCOUNT_DELETE'
    )
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists privacy_audit_events_actor_idx
  on public.privacy_audit_events(actor_profile_id, created_at desc);

create index if not exists privacy_audit_events_institution_idx
  on public.privacy_audit_events(institution_id, created_at desc);

alter table public.privacy_audit_events enable row level security;

drop policy if exists privacy_audit_events_select_own on public.privacy_audit_events;
create policy privacy_audit_events_select_own
  on public.privacy_audit_events
  for select
  to authenticated
  using (actor_profile_id = (select auth.uid()));

revoke all on table public.privacy_audit_events from public, anon, authenticated;
grant select on table public.privacy_audit_events to authenticated;
grant all on table public.privacy_audit_events to service_role;

create table if not exists public.privacy_retention_policies (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid null references public.institutions(id) on delete cascade,
  data_category text not null,
  action text not null check (action in ('KEEP', 'ANONYMIZE_AFTER', 'DELETE_AFTER', 'LEGAL_HOLD')),
  after_days integer null check (after_days is null or after_days > 0),
  legal_hold boolean not null default false,
  active boolean not null default true,
  created_by_profile_id uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint privacy_retention_policy_scope_check check (
    action in ('KEEP', 'LEGAL_HOLD') or after_days is not null
  )
);

create unique index if not exists privacy_retention_policy_scope_category_idx
  on public.privacy_retention_policies(
    coalesce(institution_id, '00000000-0000-0000-0000-000000000000'::uuid),
    data_category
  )
  where active;

alter table public.privacy_retention_policies enable row level security;

drop policy if exists privacy_retention_policies_select on public.privacy_retention_policies;
create policy privacy_retention_policies_select
  on public.privacy_retention_policies
  for select
  to authenticated
  using (
    (institution_id is not null and public.is_institution_admin(institution_id))
    or (institution_id is null and public.is_platform_super_admin())
  );

drop policy if exists privacy_retention_policies_manage on public.privacy_retention_policies;
create policy privacy_retention_policies_manage
  on public.privacy_retention_policies
  for all
  to authenticated
  using (
    (institution_id is not null and public.is_institution_admin(institution_id))
    or (institution_id is null and public.is_platform_super_admin())
  )
  with check (
    (institution_id is not null and public.is_institution_admin(institution_id))
    or (institution_id is null and public.is_platform_super_admin())
  );

revoke all on table public.privacy_retention_policies from public, anon, authenticated;
grant select, insert, update, delete on table public.privacy_retention_policies to authenticated;
grant all on table public.privacy_retention_policies to service_role;

create or replace function public.export_current_user_data()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_user_id uuid := (select auth.uid());
  export_payload jsonb;
begin
  if current_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  with owned_students as materialized (
    select student.id
      from public.students student
     where student.profile_id = current_user_id
    union
    select guardianship.student_id
      from public.guardianships guardianship
     where guardianship.guardian_profile_id = current_user_id
       and guardianship.active
  ),
  visible_institutions as materialized (
    select membership.institution_id
      from public.memberships membership
     where membership.profile_id = current_user_id
    union
    select institution.id
      from public.institutions institution
      join public.accounts account on account.id = institution.account_id
     where account.owner_profile_id = current_user_id
  )
  select jsonb_build_object(
    'schema_version', '1',
    'exported_at', now(),
    'ownership', jsonb_build_object(
      'account', 'account owner or authenticated profile',
      'institution', 'membership or account ownership',
      'profile', 'authenticated profile',
      'student', 'student profile or active guardianship',
      'guardian', 'authenticated guardian profile'
    ),
    'profile', (
      select to_jsonb(profile_row)
        from public.profiles profile_row
       where profile_row.id = current_user_id
    ),
    'accounts', coalesce((
      select jsonb_agg(to_jsonb(account_row) order by account_row.created_at)
        from public.accounts account_row
       where account_row.owner_profile_id = current_user_id
    ), '[]'::jsonb),
    'institutions', coalesce((
      select jsonb_agg(to_jsonb(institution_row) order by institution_row.created_at)
        from public.institutions institution_row
       where institution_row.id in (select institution_id from visible_institutions)
    ), '[]'::jsonb),
    'memberships', coalesce((
      select jsonb_agg(to_jsonb(membership_row) order by membership_row.joined_at)
        from public.memberships membership_row
       where membership_row.profile_id = current_user_id
    ), '[]'::jsonb),
    'students', coalesce((
      select jsonb_agg(to_jsonb(student_row) order by student_row.created_at)
        from public.students student_row
       where student_row.id in (select id from owned_students)
    ), '[]'::jsonb),
    'guardianships', coalesce((
      select jsonb_agg(to_jsonb(guardianship_row) order by guardianship_row.created_at)
        from public.guardianships guardianship_row
       where guardianship_row.guardian_profile_id = current_user_id
    ), '[]'::jsonb),
    'enrollments', coalesce((
      select jsonb_agg(to_jsonb(enrollment_row) order by enrollment_row.created_at)
        from public.enrollments enrollment_row
       where enrollment_row.student_id in (select id from owned_students)
    ), '[]'::jsonb),
    'attendance', coalesce((
      select jsonb_agg(to_jsonb(attendance_row) order by attendance_row.created_at)
        from public.attendance_records attendance_row
       where attendance_row.student_id in (select id from owned_students)
    ), '[]'::jsonb),
    'grades', coalesce((
      select jsonb_agg(to_jsonb(grade_row) order by grade_row.created_at)
        from public.grades grade_row
       where grade_row.student_id in (select id from owned_students)
    ), '[]'::jsonb),
    'term_results', coalesce((
      select jsonb_agg(to_jsonb(result_row) order by result_row.created_at)
        from public.student_term_results result_row
       where result_row.student_id in (select id from owned_students)
    ), '[]'::jsonb),
    'adaptive', jsonb_build_object(
      'attempts', coalesce((
        select jsonb_agg(to_jsonb(attempt_row) order by attempt_row.started_at)
          from public.learning_attempts attempt_row
         where attempt_row.student_id in (select id from owned_students)
      ), '[]'::jsonb),
      'answers', coalesce((
        select jsonb_agg(to_jsonb(answer_row) order by answer_row.id)
          from public.learning_answers answer_row
         where answer_row.attempt_id in (
           select attempt_row.id
             from public.learning_attempts attempt_row
            where attempt_row.student_id in (select id from owned_students)
         )
      ), '[]'::jsonb),
      'skill_progress', coalesce((
        select jsonb_agg(to_jsonb(progress_row) order by progress_row.updated_at)
          from public.learning_skill_progress progress_row
         where progress_row.student_id in (select id from owned_students)
      ), '[]'::jsonb),
      'skill_state', coalesce((
        select jsonb_agg(to_jsonb(state_row) order by state_row.updated_at)
          from public.learning_student_skill_state state_row
         where state_row.student_id in (select id from owned_students)
      ), '[]'::jsonb),
      'guided_sessions', coalesce((
        select jsonb_agg(to_jsonb(session_row) order by session_row.created_at)
          from public.learning_guided_sessions session_row
         where session_row.student_id in (select id from owned_students)
      ), '[]'::jsonb),
      'simulation_attempts', coalesce((
        select jsonb_agg(to_jsonb(simulation_row) order by simulation_row.started_at)
          from public.learning_simulation_attempts simulation_row
         where simulation_row.student_id in (select id from owned_students)
      ), '[]'::jsonb)
    )
  )
  into export_payload;

  insert into public.privacy_audit_events (
    actor_profile_id,
    event_type,
    metadata
  )
  values (
    current_user_id,
    'DATA_EXPORT',
    jsonb_build_object(
      'scope', 'authenticated_user',
      'schema_version', '1'
    )
  );

  return export_payload;
end;
$$;

revoke all on function public.export_current_user_data() from public, anon;
grant execute on function public.export_current_user_data() to authenticated, service_role;

create or replace function public.preview_privacy_retention(
  target_institution_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_user_id uuid := (select auth.uid());
  policies jsonb;
begin
  if current_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if target_institution_id is null then
    if not public.is_platform_super_admin() then
      raise exception 'PLATFORM_ADMIN_REQUIRED';
    end if;
  elsif not public.is_institution_admin(target_institution_id) then
    raise exception 'INSTITUTION_ADMIN_REQUIRED';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', policy.id,
        'institution_id', policy.institution_id,
        'data_category', policy.data_category,
        'action', policy.action,
        'after_days', policy.after_days,
        'legal_hold', policy.legal_hold,
        'active', policy.active,
        'dry_run', true,
        'would_change', 0
      )
      order by policy.data_category
    ),
    '[]'::jsonb
  )
  into policies
  from public.privacy_retention_policies policy
  where policy.active
    and (
      policy.institution_id = target_institution_id
      or (target_institution_id is null and policy.institution_id is null)
    );

  insert into public.privacy_audit_events (
    actor_profile_id,
    institution_id,
    event_type,
    metadata
  )
  values (
    current_user_id,
    target_institution_id,
    'RETENTION_DRY_RUN',
    jsonb_build_object('dry_run', true, 'policy_count', jsonb_array_length(policies))
  );

  return jsonb_build_object(
    'dry_run', true,
    'institution_id', target_institution_id,
    'policies', policies,
    'actions', '[]'::jsonb
  );
end;
$$;

revoke all on function public.preview_privacy_retention(uuid) from public, anon;
grant execute on function public.preview_privacy_retention(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
