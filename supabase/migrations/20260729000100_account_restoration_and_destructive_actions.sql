begin;

-- ============================================================
-- Tabela de auditoria para ações destrutivas globais
-- ============================================================
create table if not exists public.platform_destructive_actions (
  id uuid primary key default extensions.uuid_generate_v4(),
  action_type text not null,
  target_account_id uuid null,
  target_account_name text not null,
  performed_by_profile_id uuid null
    references public.profiles(id) on delete set null,
  reason text not null,
  summary jsonb not null default '{}'::jsonb,
  result_status text not null default 'FAILED',
  error_message text null,
  created_at timestamptz not null default now(),
  constraint platform_destructive_actions_action_type_check
    check (action_type in ('RESTORE', 'HARD_DELETE')),
  constraint platform_destructive_actions_result_status_check
    check (result_status in ('SUCCESS', 'PARTIAL_SUCCESS', 'FAILED')),
  constraint platform_destructive_actions_reason_length_check
    check (length(reason) between 10 and 500)
);

create index if not exists platform_destructive_actions_created_at_idx
  on public.platform_destructive_actions(created_at desc);

create index if not exists platform_destructive_actions_type_idx
  on public.platform_destructive_actions(action_type);

alter table public.platform_destructive_actions
  enable row level security;

drop policy if exists platform_destructive_actions_select_policy
  on public.platform_destructive_actions;

create policy platform_destructive_actions_select_policy
on public.platform_destructive_actions
for select
to authenticated
using (public.is_platform_super_admin());

revoke all on table public.platform_destructive_actions
  from public, anon, authenticated;

grant select on table public.platform_destructive_actions
  to authenticated;

grant all on table public.platform_destructive_actions
  to service_role;

-- ============================================================
-- RPC: restore_client_account
-- Restaura uma conta CANCELED para ACTIVE com auditoria
-- ============================================================
create or replace function public.restore_client_account(
  target_account_id uuid,
  actor_profile_id uuid,
  change_reason text default null
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
  normalized_reason text;
  created_event_id uuid;
begin
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

  if account_record.status <> 'CANCELED' then
    raise exception 'ACCOUNT_NOT_CANCELED'
      using errcode = 'P0001';
  end if;

  if normalized_reason is null
      or not (length(normalized_reason) between 10 and 500) then
    raise exception 'ACCOUNT_STATUS_REASON_REQUIRED'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.account_domains
    where account_id <> account_record.id
      and lower(hostname) in (
        select lower(hostname)
        from public.account_domains
        where account_id = account_record.id
      )
  ) then
    raise exception 'ACCOUNT_DOMAIN_CONFLICT'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = account_record.owner_profile_id
      and active is true
  ) then
    raise exception 'ACCOUNT_OWNER_INACTIVE'
      using errcode = 'P0001';
  end if;

  update public.accounts
  set status = 'ACTIVE'
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
    'ACTIVE',
    normalized_reason,
    jsonb_build_object('source', 'restore-client-account')
  )
  returning id into created_event_id;

  return query
    select
      account_record.id,
      account_record.status,
      'ACTIVE'::text,
      account_record.institution_limit,
      created_event_id,
      true;
end;
$$;

revoke all on function public.restore_client_account(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.restore_client_account(uuid, uuid, text)
  to service_role;

-- ============================================================
-- RPC: hard_delete_client_account
-- Exclui fisicamente uma conta CANCELED e todos os dados
-- associados, de forma transacional.
-- ============================================================
create or replace function public.hard_delete_client_account(
  target_account_id uuid,
  actor_profile_id uuid,
  change_reason text,
  confirmation_email text,
  confirmation_text text,
  acknowledgement boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_record public.accounts%rowtype;
  actor_profile public.profiles%rowtype;
  normalized_reason text;
  audit_id uuid;
  summary jsonb;
  institution_ids uuid[];
  total_institutions int;
  total_memberships int;
  total_students int;
  total_guardianships int;
  total_classes int;
  total_subjects int;
  total_rooms int;
  total_enrollments int;
  total_offerings int;
  total_timetable int;
  total_curriculum int;
  total_grades int;
  total_attendance_records int;
  total_attendance_sessions int;
  total_assessments int;
  total_term_results int;
  total_term_closures int;
  total_academic_years int;
  total_terms int;
  total_policies int;
  total_counters int;
  total_branding int;
  total_domains int;
  total_events int;
  exclusive_profiles uuid[] := array[]::uuid[];
  shared_profiles uuid[] := array[]::uuid[];
  owner_preserved boolean;
  linked_profile record;
begin
  -- ========== VALIDATION ==========
  select *
  into account_record
  from public.accounts as account
  where account.id = target_account_id
  for update;

  if not found then
    raise exception 'ACCOUNT_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  if account_record.status <> 'CANCELED' then
    raise exception 'ACCOUNT_NOT_CANCELED'
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

  if normalized_reason is null
      or not (length(normalized_reason) between 10 and 500) then
    raise exception 'HARD_DELETE_REASON_REQUIRED'
      using errcode = 'P0001';
  end if;

  select *
  into actor_profile
  from public.profiles
  where id = actor_profile_id;

  if not found then
    raise exception 'ACTOR_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  if account_record.owner_profile_id = actor_profile_id then
    raise exception 'CANNOT_DELETE_OWN_ACCOUNT'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.profiles
    where id = account_record.owner_profile_id
      and email = 'superadmin@admin.com'
  ) then
    raise exception 'CANNOT_DELETE_SUPERADMIN_ACCOUNT'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = account_record.owner_profile_id
      and email = confirmation_email
  ) then
    raise exception 'CONFIRMATION_EMAIL_MISMATCH'
      using errcode = 'P0001';
  end if;

  if confirmation_text <> 'EXCLUIR DEFINITIVAMENTE' then
    raise exception 'CONFIRMATION_TEXT_INVALID'
      using errcode = 'P0001';
  end if;

  if acknowledgement is not true then
    raise exception 'ACKNOWLEDGEMENT_REQUIRED'
      using errcode = 'P0001';
  end if;

  -- ========== CAPTURE INSTITUTIONS ==========
  select coalesce(array_agg(id), array[]::uuid[])
  into institution_ids
  from public.institutions
  where account_id = target_account_id;

  -- ========== CLASSIFY PROFILES BEFORE DELETION ==========
  owner_preserved := false;

  for linked_profile in
    select distinct m.profile_id as pid
    from public.memberships m
    where m.institution_id = any(institution_ids)
      and m.profile_id is not null
    union
    select distinct s.profile_id as pid
    from public.students s
    where s.institution_id = any(institution_ids)
      and s.profile_id is not null
    union
    select distinct g.guardian_profile_id as pid
    from public.guardianships g
    where g.student_id in (
      select st.id from public.students st
      where st.institution_id = any(institution_ids)
    )
      and g.guardian_profile_id is not null
    union
    select distinct so.teacher_profile_id as pid
    from public.subject_offerings so
    where so.class_id in (
      select c.id from public.classes c
      where c.institution_id = any(institution_ids)
    )
      and so.teacher_profile_id is not null
  loop
    if linked_profile.pid = account_record.owner_profile_id then
      owner_preserved := true;
    end if;

    if exists (
      select 1
      from public.memberships
      where profile_id = linked_profile.pid
        and institution_id <> all(institution_ids)
        and active is true
    ) or exists (
      select 1
      from public.accounts
      where owner_profile_id = linked_profile.pid
        and id <> target_account_id
    ) or exists (
      select 1
      from public.profiles
      where id = linked_profile.pid
        and (
          platform_role = 'SUPER_ADMIN'
          or email = 'superadmin@admin.com'
        )
    ) then
      shared_profiles := array_append(shared_profiles, linked_profile.pid);
    else
      exclusive_profiles := array_append(exclusive_profiles, linked_profile.pid);
    end if;
  end loop;

  -- Ensure owner is never in exclusive list (preserved)
  if owner_preserved then
    exclusive_profiles := array_remove(exclusive_profiles, account_record.owner_profile_id);
    if not (account_record.owner_profile_id = any(shared_profiles)) then
      shared_profiles := array_append(shared_profiles, account_record.owner_profile_id);
    end if;
  end if;

  -- ========== COUNTING ==========
  select count(*) into total_institutions
  from public.institutions where account_id = target_account_id;

  select count(*) into total_memberships
  from public.memberships where institution_id = any(institution_ids);

  select count(*) into total_students
  from public.students where institution_id = any(institution_ids);

  select count(*) into total_guardianships
  from public.guardianships
  where student_id in (select id from public.students where institution_id = any(institution_ids));

  select count(*) into total_classes
  from public.classes where institution_id = any(institution_ids);

  select count(*) into total_subjects
  from public.subjects where institution_id = any(institution_ids);

  select count(*) into total_rooms
  from public.rooms where institution_id = any(institution_ids);

  select count(*) into total_enrollments
  from public.enrollments
  where class_id in (select id from public.classes where institution_id = any(institution_ids));

  select count(*) into total_offerings
  from public.subject_offerings
  where class_id in (select id from public.classes where institution_id = any(institution_ids));

  select count(*) into total_timetable
  from public.timetable_entries where institution_id = any(institution_ids);

  select count(*) into total_curriculum
  from public.class_curriculum_items where institution_id = any(institution_ids);

  select count(*) into total_assessments
  from public.assessments where institution_id = any(institution_ids);

  select count(*) into total_grades
  from public.grades where institution_id = any(institution_ids);

  select count(*) into total_attendance_sessions
  from public.attendance_sessions where institution_id = any(institution_ids);

  select count(*) into total_attendance_records
  from public.attendance_records where institution_id = any(institution_ids);

  select count(*) into total_term_results
  from public.student_term_results where institution_id = any(institution_ids);

  select count(*) into total_term_closures
  from public.term_closures where institution_id = any(institution_ids);

  select count(*) into total_academic_years
  from public.academic_years where institution_id = any(institution_ids);

  select count(*) into total_terms
  from public.terms
  where academic_year_id in (select id from public.academic_years where institution_id = any(institution_ids));

  select count(*) into total_policies
  from public.academic_policies where institution_id = any(institution_ids);

  select count(*) into total_counters
  from public.student_registration_counters where institution_id = any(institution_ids);

  select count(*) into total_domains
  from public.account_domains where account_id = target_account_id;

  select count(*) into total_events
  from public.account_status_events where account_id = target_account_id;

  select count(*) into total_branding
  from public.branding_settings where account_id = target_account_id;

  -- ========== CREATE AUDIT ENTRY ==========
  summary := jsonb_build_object(
    'institutions', total_institutions,
    'memberships', total_memberships,
    'students', total_students,
    'guardianships', total_guardianships,
    'classes', total_classes,
    'subjects', total_subjects,
    'rooms', total_rooms,
    'enrollments', total_enrollments,
    'subjectOfferings', total_offerings,
    'timetableEntries', total_timetable,
    'curriculumItems', total_curriculum,
    'assessments', total_assessments,
    'grades', total_grades,
    'attendanceSessions', total_attendance_sessions,
    'attendanceRecords', total_attendance_records,
    'studentTermResults', total_term_results,
    'termClosures', total_term_closures,
    'academicYears', total_academic_years,
    'terms', total_terms,
    'academicPolicies', total_policies,
    'registrationCounters', total_counters,
    'domains', total_domains,
    'statusEvents', total_events,
    'brandingSettings', total_branding
  );

  insert into public.platform_destructive_actions (
    action_type, target_account_id, target_account_name,
    performed_by_profile_id, reason, summary, result_status
  )
  values (
    'HARD_DELETE', target_account_id, account_record.name,
    actor_profile_id, normalized_reason, summary, 'SUCCESS'
  )
  returning id into audit_id;

  -- ========== DELETE DATA (institution-scoped) ==========
  delete from public.attendance_records where institution_id = any(institution_ids);
  delete from public.attendance_sessions where institution_id = any(institution_ids);
  delete from public.grades where institution_id = any(institution_ids);
  delete from public.assessments where institution_id = any(institution_ids);
  delete from public.student_term_results where institution_id = any(institution_ids);
  delete from public.term_closures where institution_id = any(institution_ids);
  delete from public.timetable_entries where institution_id = any(institution_ids);
  delete from public.class_curriculum_items where institution_id = any(institution_ids);
  delete from public.subject_offerings
    where class_id in (select id from public.classes where institution_id = any(institution_ids));
  delete from public.enrollments
    where class_id in (select id from public.classes where institution_id = any(institution_ids));
  delete from public.guardianships
    where student_id in (select id from public.students where institution_id = any(institution_ids));
  delete from public.students where institution_id = any(institution_ids);
  delete from public.classes where institution_id = any(institution_ids);
  delete from public.subjects where institution_id = any(institution_ids);
  delete from public.rooms where institution_id = any(institution_ids);
  delete from public.academic_policies where institution_id = any(institution_ids);
  delete from public.terms
    where academic_year_id in (select id from public.academic_years where institution_id = any(institution_ids));
  delete from public.academic_years where institution_id = any(institution_ids);
  delete from public.student_registration_counters where institution_id = any(institution_ids);
  delete from public.memberships where institution_id = any(institution_ids);

  -- ========== DELETE DATA (account-scoped) ==========
  delete from public.account_domains where account_id = target_account_id;
  delete from public.account_status_events where account_id = target_account_id;
  delete from public.branding_settings where account_id = target_account_id;

  -- ========== DELETE INSTITUTIONS ==========
  delete from public.institutions where account_id = target_account_id;

  -- ========== DELETE ACCOUNT ==========
  delete from public.accounts where id = target_account_id;

  -- ========== RETURN ==========
  return jsonb_build_object(
    'accountId', target_account_id,
    'accountName', account_record.name,
    'auditId', audit_id,
    'summary', summary,
    'ownerPreserved', owner_preserved,
    'exclusiveProfileIds', exclusive_profiles,
    'sharedProfileIds', shared_profiles
  );
end;
$$;

revoke all on function public.hard_delete_client_account(uuid, uuid, text, text, text, boolean)
  from public, anon, authenticated;

grant execute on function public.hard_delete_client_account(uuid, uuid, text, text, text, boolean)
  to service_role;

commit;
