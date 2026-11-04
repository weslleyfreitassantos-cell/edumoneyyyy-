-- TECESCOLA Rematrícula Automática V1
-- Additive only. This migration deliberately does not create enrollments or charges.

do $$
begin
  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'public.academic_calendar_event_type'::regtype
      and enumlabel = 'RE_ENROLLMENT'
  ) then
    alter type public.academic_calendar_event_type add value 'RE_ENROLLMENT';
  end if;
end
$$;

create table if not exists public.reenrollment_campaigns (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  source_academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  destination_academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  title text not null,
  description text,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED', 'ARCHIVED')),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  target_audience text not null default 'ACTIVE_STUDENTS'
    check (target_audience in ('ACTIVE_STUDENTS', 'ACTIVE_GUARDIANS', 'ALL')),
  eligible_grade_levels text[] not null default '{}',
  contract_version text not null default 'v1',
  contract_hash text not null default '',
  contract_body text not null default '',
  require_academic_result boolean not null default true,
  require_financial_clearance boolean not null default false,
  allow_class_choice boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reenrollment_campaign_years_different
    check (source_academic_year_id <> destination_academic_year_id),
  constraint reenrollment_campaign_period_valid
    check (opens_at < closes_at),
  constraint reenrollment_campaign_title_not_blank
    check (length(trim(title)) > 0)
);

create unique index if not exists reenrollment_campaign_institution_years_uidx
  on public.reenrollment_campaigns(
    institution_id,
    source_academic_year_id,
    destination_academic_year_id
  );

create index if not exists reenrollment_campaign_open_idx
  on public.reenrollment_campaigns(institution_id, status, opens_at, closes_at);

create table if not exists public.reenrollment_grade_mappings (
  id uuid primary key default extensions.uuid_generate_v4(),
  campaign_id uuid not null references public.reenrollment_campaigns(id) on delete cascade,
  source_grade_level text not null,
  destination_grade_level text,
  destination_stage text,
  promotion_policy text not null default 'AUTO'
    check (promotion_policy in ('AUTO', 'MANUAL', 'NOT_ELIGIBLE')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reenrollment_grade_mapping_source_not_blank
    check (length(trim(source_grade_level)) > 0)
);

create unique index if not exists reenrollment_grade_mapping_uidx
  on public.reenrollment_grade_mappings(campaign_id, lower(trim(source_grade_level)));

create table if not exists public.reenrollment_requests (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  campaign_id uuid not null references public.reenrollment_campaigns(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  source_enrollment_id uuid references public.enrollments(id) on delete restrict,
  source_class_id uuid references public.classes(id) on delete restrict,
  source_grade_level text,
  destination_grade_level text,
  destination_class_id uuid references public.classes(id) on delete restrict,
  academic_status text not null default 'NOT_EVALUATED'
    check (academic_status in ('NOT_EVALUATED', 'PENDING', 'APPROVED', 'RECOVERY', 'RETAINED', 'TRANSFERRED', 'INELIGIBLE')),
  request_status text not null default 'PENDING_CONFIRMATION'
    check (request_status in ('PENDING_CONFIRMATION', 'CONFIRMED', 'AWAITING_ACADEMIC_RESULT', 'AWAITING_PAYMENT', 'READY_FOR_ENROLLMENT', 'ENROLLED', 'CANCELLED', 'REJECTED')),
  financial_status text not null default 'NOT_REQUIRED'
    check (financial_status in ('NOT_REQUIRED', 'PENDING', 'CLEARED', 'BLOCKED', 'WAIVED')),
  protocol text not null default ('RMT-' || upper(substr(replace(extensions.uuid_generate_v4()::text, '-', ''), 1, 12))),
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reenrollment_request_protocol_uidx unique (protocol),
  constraint reenrollment_request_scope_consistent
    check (institution_id is not null)
);

create unique index if not exists reenrollment_request_campaign_student_uidx
  on public.reenrollment_requests(campaign_id, student_id);

create index if not exists reenrollment_request_dashboard_idx
  on public.reenrollment_requests(institution_id, campaign_id, request_status, academic_status);

create index if not exists reenrollment_request_student_idx
  on public.reenrollment_requests(institution_id, student_id, created_at desc);

create table if not exists public.reenrollment_contract_acceptances (
  id uuid primary key default extensions.uuid_generate_v4(),
  request_id uuid not null references public.reenrollment_requests(id) on delete cascade,
  accepted_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  contract_version text not null,
  contract_hash text not null,
  accepted_at timestamptz not null default now(),
  constraint reenrollment_contract_acceptance_version_not_blank
    check (length(trim(contract_version)) > 0),
  constraint reenrollment_contract_acceptance_hash_not_blank
    check (length(trim(contract_hash)) > 0)
);

create unique index if not exists reenrollment_contract_acceptance_uidx
  on public.reenrollment_contract_acceptances(request_id, contract_version);

create table if not exists public.reenrollment_academic_results (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  request_id uuid not null references public.reenrollment_requests(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  source_academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  result_status text not null
    check (result_status in ('PENDING', 'APPROVED', 'RECOVERY', 'RETAINED', 'TRANSFERRED', 'INELIGIBLE')),
  average_percentage numeric(5, 2)
    check (average_percentage is null or (average_percentage >= 0 and average_percentage <= 100)),
  attendance_percentage numeric(5, 2)
    check (attendance_percentage is null or (attendance_percentage >= 0 and attendance_percentage <= 100)),
  recovery_pending boolean not null default false,
  decision_origin text not null default 'ACADEMIC_TEAM'
    check (decision_origin in ('ACADEMIC_TEAM', 'CLASS_COUNCIL', 'MANUAL_REVIEW')),
  notes text,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists reenrollment_academic_result_request_uidx
  on public.reenrollment_academic_results(request_id);

create index if not exists reenrollment_academic_result_student_idx
  on public.reenrollment_academic_results(institution_id, student_id, source_academic_year_id);

create table if not exists public.reenrollment_audit_events (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  campaign_id uuid references public.reenrollment_campaigns(id) on delete set null,
  request_id uuid references public.reenrollment_requests(id) on delete set null,
  action text not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint reenrollment_audit_action_not_blank
    check (length(trim(action)) > 0)
);

create index if not exists reenrollment_audit_request_idx
  on public.reenrollment_audit_events(institution_id, request_id, created_at desc);

alter table public.reenrollment_campaigns enable row level security;
alter table public.reenrollment_grade_mappings enable row level security;
alter table public.reenrollment_requests enable row level security;
alter table public.reenrollment_contract_acceptances enable row level security;
alter table public.reenrollment_academic_results enable row level security;
alter table public.reenrollment_audit_events enable row level security;

drop policy if exists reenrollment_campaign_select on public.reenrollment_campaigns;
create policy reenrollment_campaign_select
on public.reenrollment_campaigns
for select to authenticated
using (
  public.can_manage_institution_operations(institution_id)
  or (
    public.can_access_institution(institution_id)
    and status = 'OPEN'
    and now() >= opens_at
    and now() <= closes_at
  )
);

drop policy if exists reenrollment_campaign_manage on public.reenrollment_campaigns;
create policy reenrollment_campaign_manage
on public.reenrollment_campaigns
for all to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (
  public.can_manage_institution_operations(institution_id)
  and exists (
    select 1 from public.academic_years source_year
    where source_year.id = source_academic_year_id
      and source_year.institution_id = institution_id
  )
  and exists (
    select 1 from public.academic_years destination_year
    where destination_year.id = destination_academic_year_id
      and destination_year.institution_id = institution_id
  )
);

drop policy if exists reenrollment_grade_mapping_select on public.reenrollment_grade_mappings;
create policy reenrollment_grade_mapping_select
on public.reenrollment_grade_mappings
for select to authenticated
using (
  exists (
    select 1
    from public.reenrollment_campaigns campaign
    where campaign.id = campaign_id
      and (
        public.can_manage_institution_operations(campaign.institution_id)
        or public.can_access_institution(campaign.institution_id)
      )
  )
);

drop policy if exists reenrollment_grade_mapping_manage on public.reenrollment_grade_mappings;
create policy reenrollment_grade_mapping_manage
on public.reenrollment_grade_mappings
for all to authenticated
using (
  exists (
    select 1
    from public.reenrollment_campaigns campaign
    where campaign.id = campaign_id
      and public.can_manage_institution_operations(campaign.institution_id)
  )
)
with check (
  exists (
    select 1
    from public.reenrollment_campaigns campaign
    where campaign.id = campaign_id
      and public.can_manage_institution_operations(campaign.institution_id)
  )
);

create or replace function private.reenrollment_user_can_act_on_student(
  target_institution_id uuid,
  target_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.students student
      where student.id = target_student_id
        and student.institution_id = target_institution_id
        and student.active is true
        and (
          (
            student.profile_id = auth.uid()
            and student.birth_date is not null
            and student.birth_date <= (current_date - interval '18 years')::date
          )
          or exists (
            select 1
            from public.guardianships guardianship
            where guardianship.student_id = student.id
              and guardianship.guardian_profile_id = auth.uid()
              and guardianship.active is true
          )
        )
    );
$$;

revoke all on function private.reenrollment_user_can_act_on_student(uuid, uuid) from public;
grant execute on function private.reenrollment_user_can_act_on_student(uuid, uuid) to authenticated;

drop policy if exists reenrollment_request_select on public.reenrollment_requests;
create policy reenrollment_request_select
on public.reenrollment_requests
for select to authenticated
using (
  public.can_manage_institution_operations(institution_id)
  or private.reenrollment_user_can_act_on_student(institution_id, student_id)
);

drop policy if exists reenrollment_contract_acceptance_select on public.reenrollment_contract_acceptances;
create policy reenrollment_contract_acceptance_select
on public.reenrollment_contract_acceptances
for select to authenticated
using (
  exists (
    select 1
    from public.reenrollment_requests request
    where request.id = request_id
      and (
        public.can_manage_institution_operations(request.institution_id)
        or private.reenrollment_user_can_act_on_student(request.institution_id, request.student_id)
      )
  )
);

drop policy if exists reenrollment_result_select on public.reenrollment_academic_results;
create policy reenrollment_result_select
on public.reenrollment_academic_results
for select to authenticated
using (
  public.can_manage_institution_operations(institution_id)
  or private.reenrollment_user_can_act_on_student(institution_id, student_id)
);

drop policy if exists reenrollment_audit_select on public.reenrollment_audit_events;
create policy reenrollment_audit_select
on public.reenrollment_audit_events
for select to authenticated
using (
  public.can_manage_institution_operations(institution_id)
  or exists (
    select 1
    from public.reenrollment_requests request
    where request.id = request_id
      and private.reenrollment_user_can_act_on_student(request.institution_id, request.student_id)
  )
);

create or replace function private.create_reenrollment_request_v1(
  target_campaign_id uuid,
  target_student_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  campaign public.reenrollment_campaigns%rowtype;
  student public.students%rowtype;
  source_enrollment public.enrollments%rowtype;
  source_class public.classes%rowtype;
  grade_mapping public.reenrollment_grade_mappings%rowtype;
  request_row public.reenrollment_requests%rowtype;
  inserted_id uuid;
begin
  if auth.uid() is null then
    raise exception 'REENROLLMENT_AUTH_REQUIRED';
  end if;

  select * into campaign
  from public.reenrollment_campaigns
  where id = target_campaign_id
    and status = 'OPEN'
    and now() between opens_at and closes_at;

  if not found then
    raise exception 'REENROLLMENT_CAMPAIGN_NOT_OPEN';
  end if;

  select * into student
  from public.students
  where id = target_student_id
    and institution_id = campaign.institution_id
    and active is true;

  if not found or not private.reenrollment_user_can_act_on_student(campaign.institution_id, target_student_id) then
    raise exception 'REENROLLMENT_STUDENT_NOT_ALLOWED';
  end if;

  select enrollment, class_record
  into source_enrollment, source_class
  from public.enrollments enrollment
  join public.classes class_record on class_record.id = enrollment.class_id
  where enrollment.student_id = target_student_id
    and enrollment.academic_year_id = campaign.source_academic_year_id
    and enrollment.active is true
    and class_record.active is true
  order by enrollment.enrolled_at desc
  limit 1;

  if source_enrollment.id is null then
    raise exception 'REENROLLMENT_NO_SOURCE_ENROLLMENT';
  end if;

  select * into grade_mapping
  from public.reenrollment_grade_mappings
  where campaign_id = campaign.id
    and active is true
    and lower(trim(source_grade_level)) = lower(trim(coalesce(source_class.grade_level, '')))
  limit 1;

  if coalesce(array_length(campaign.eligible_grade_levels, 1), 0) > 0
    and not (coalesce(source_class.grade_level, '') = any (campaign.eligible_grade_levels)) then
    raise exception 'REENROLLMENT_GRADE_NOT_ELIGIBLE';
  end if;

  if grade_mapping.promotion_policy = 'NOT_ELIGIBLE' then
    raise exception 'REENROLLMENT_GRADE_NOT_ELIGIBLE';
  end if;

  insert into public.reenrollment_requests (
    institution_id,
    campaign_id,
    student_id,
    source_enrollment_id,
    source_class_id,
    source_grade_level,
    destination_grade_level,
    academic_status,
    request_status,
    financial_status
  ) values (
    campaign.institution_id,
    campaign.id,
    student.id,
    source_enrollment.id,
    source_class.id,
    source_class.grade_level,
    grade_mapping.destination_grade_level,
    case when campaign.require_academic_result then 'NOT_EVALUATED' else 'APPROVED' end,
    'PENDING_CONFIRMATION',
    case when campaign.require_financial_clearance then 'PENDING' else 'NOT_REQUIRED' end
  )
  on conflict (campaign_id, student_id) do nothing
  returning id into inserted_id;

  if inserted_id is not null then
    insert into public.reenrollment_audit_events (
      institution_id, campaign_id, request_id, action, actor_profile_id, metadata
    ) values (
      campaign.institution_id,
      campaign.id,
      inserted_id,
      'REQUEST_CREATED',
      auth.uid(),
      jsonb_build_object('source_academic_year_id', campaign.source_academic_year_id)
    );
  end if;

  select * into request_row
  from public.reenrollment_requests
  where campaign_id = campaign.id
    and student_id = student.id;

  return to_jsonb(request_row);
end;
$$;

create or replace function private.accept_reenrollment_contract_v1(
  target_request_id uuid,
  accepted_contract_version text,
  accepted_contract_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.reenrollment_requests%rowtype;
  campaign public.reenrollment_campaigns%rowtype;
  acceptance public.reenrollment_contract_acceptances%rowtype;
begin
  if auth.uid() is null then raise exception 'REENROLLMENT_AUTH_REQUIRED'; end if;

  select request.* into request_row
  from public.reenrollment_requests request
  where request.id = target_request_id;

  if not found or not private.reenrollment_user_can_act_on_student(request_row.institution_id, request_row.student_id) then
    raise exception 'REENROLLMENT_REQUEST_NOT_ALLOWED';
  end if;

  select * into campaign from public.reenrollment_campaigns where id = request_row.campaign_id;
  if accepted_contract_version <> campaign.contract_version
    or accepted_contract_hash <> campaign.contract_hash
    or length(trim(accepted_contract_hash)) = 0 then
    raise exception 'REENROLLMENT_CONTRACT_VERSION_MISMATCH';
  end if;

  insert into public.reenrollment_contract_acceptances (
    request_id, accepted_by_profile_id, contract_version, contract_hash
  ) values (
    request_row.id, auth.uid(), accepted_contract_version, accepted_contract_hash
  )
  on conflict (request_id, contract_version) do update set
    accepted_by_profile_id = excluded.accepted_by_profile_id,
    accepted_at = now();

  select * into acceptance
  from public.reenrollment_contract_acceptances
  where request_id = request_row.id
    and contract_version = accepted_contract_version;

  insert into public.reenrollment_audit_events (
    institution_id, campaign_id, request_id, action, actor_profile_id, metadata
  ) values (
    request_row.institution_id,
    request_row.campaign_id,
    request_row.id,
    'CONTRACT_ACCEPTED',
    auth.uid(),
    jsonb_build_object('contract_version', accepted_contract_version)
  );

  return to_jsonb(acceptance);
end;
$$;

create or replace function private.confirm_reenrollment_request_v1(
  target_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.reenrollment_requests%rowtype;
  campaign public.reenrollment_campaigns%rowtype;
begin
  if auth.uid() is null then raise exception 'REENROLLMENT_AUTH_REQUIRED'; end if;

  select request.* into request_row
  from public.reenrollment_requests request
  where request.id = target_request_id;

  if not found or not private.reenrollment_user_can_act_on_student(request_row.institution_id, request_row.student_id) then
    raise exception 'REENROLLMENT_REQUEST_NOT_ALLOWED';
  end if;

  select * into campaign from public.reenrollment_campaigns where id = request_row.campaign_id;
  if campaign.status <> 'OPEN' or now() not between campaign.opens_at and campaign.closes_at then
    raise exception 'REENROLLMENT_CAMPAIGN_NOT_OPEN';
  end if;

  if not exists (
    select 1 from public.reenrollment_contract_acceptances acceptance
    where acceptance.request_id = request_row.id
      and acceptance.contract_version = campaign.contract_version
  ) then
    raise exception 'REENROLLMENT_CONTRACT_NOT_ACCEPTED';
  end if;

  update public.reenrollment_requests
  set request_status = 'CONFIRMED',
      confirmed_by = auth.uid(),
      confirmed_at = now(),
      updated_at = now()
  where id = request_row.id
  returning * into request_row;

  insert into public.reenrollment_audit_events (
    institution_id, campaign_id, request_id, action, actor_profile_id
  ) values (
    request_row.institution_id, request_row.campaign_id, request_row.id,
    'REQUEST_CONFIRMED', auth.uid()
  );

  return to_jsonb(request_row);
end;
$$;

create or replace function private.review_reenrollment_request_v1(
  target_request_id uuid,
  next_academic_status text,
  next_financial_status text,
  next_destination_class_id uuid default null,
  review_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.reenrollment_requests%rowtype;
  campaign public.reenrollment_campaigns%rowtype;
  next_request_status text;
begin
  if auth.uid() is null then raise exception 'REENROLLMENT_AUTH_REQUIRED'; end if;

  select request.* into request_row
  from public.reenrollment_requests request
  where request.id = target_request_id;

  if not found or not public.can_manage_institution_operations(request_row.institution_id) then
    raise exception 'REENROLLMENT_REVIEW_NOT_ALLOWED';
  end if;

  select * into campaign from public.reenrollment_campaigns where id = request_row.campaign_id;

  if next_destination_class_id is not null and not exists (
    select 1
    from public.classes class_record
    where class_record.id = next_destination_class_id
      and class_record.institution_id = request_row.institution_id
      and class_record.academic_year_id = campaign.destination_academic_year_id
      and class_record.active is true
  ) then
    raise exception 'REENROLLMENT_DESTINATION_CLASS_INVALID';
  end if;

  next_request_status := case
    when next_academic_status in ('PENDING', 'RECOVERY', 'RETAINED', 'TRANSFERRED', 'INELIGIBLE') then 'AWAITING_ACADEMIC_RESULT'
    when next_financial_status in ('PENDING', 'BLOCKED') then 'AWAITING_PAYMENT'
    when next_academic_status = 'APPROVED' then 'READY_FOR_ENROLLMENT'
    else request_row.request_status
  end;

  update public.reenrollment_requests
  set academic_status = next_academic_status,
      financial_status = next_financial_status,
      destination_class_id = next_destination_class_id,
      request_status = next_request_status,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      notes = review_notes,
      updated_at = now()
  where id = request_row.id
  returning * into request_row;

  insert into public.reenrollment_academic_results (
    institution_id, request_id, student_id, source_academic_year_id,
    result_status, decision_origin, notes, recorded_by
  ) values (
    request_row.institution_id, request_row.id, request_row.student_id,
    campaign.source_academic_year_id, next_academic_status,
    'MANUAL_REVIEW', review_notes, auth.uid()
  )
  on conflict (request_id) do update set
    result_status = excluded.result_status,
    decision_origin = excluded.decision_origin,
    notes = excluded.notes,
    recorded_by = excluded.recorded_by,
    updated_at = now();

  insert into public.reenrollment_audit_events (
    institution_id, campaign_id, request_id, action, actor_profile_id, metadata
  ) values (
    request_row.institution_id, request_row.campaign_id, request_row.id,
    'REQUEST_REVIEWED', auth.uid(),
    jsonb_build_object('academic_status', next_academic_status, 'financial_status', next_financial_status)
  );

  return to_jsonb(request_row);
end;
$$;

create or replace function public.create_reenrollment_request_v1(
  target_campaign_id uuid,
  target_student_id uuid
)
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select private.create_reenrollment_request_v1(target_campaign_id, target_student_id);
$$;

create or replace function public.accept_reenrollment_contract_v1(
  target_request_id uuid,
  accepted_contract_version text,
  accepted_contract_hash text
)
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select private.accept_reenrollment_contract_v1(target_request_id, accepted_contract_version, accepted_contract_hash);
$$;

create or replace function public.confirm_reenrollment_request_v1(
  target_request_id uuid
)
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select private.confirm_reenrollment_request_v1(target_request_id);
$$;

create or replace function public.review_reenrollment_request_v1(
  target_request_id uuid,
  next_academic_status text,
  next_financial_status text,
  next_destination_class_id uuid default null,
  review_notes text default null
)
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select private.review_reenrollment_request_v1(
    target_request_id,
    next_academic_status,
    next_financial_status,
    next_destination_class_id,
    review_notes
  );
$$;

revoke all on table public.reenrollment_campaigns from anon, authenticated;
revoke all on table public.reenrollment_grade_mappings from anon, authenticated;
revoke all on table public.reenrollment_requests from anon, authenticated;
revoke all on table public.reenrollment_contract_acceptances from anon, authenticated;
revoke all on table public.reenrollment_academic_results from anon, authenticated;
revoke all on table public.reenrollment_audit_events from anon, authenticated;

grant select on table public.reenrollment_campaigns to authenticated;
grant insert, update, delete on table public.reenrollment_campaigns to authenticated;
grant select on table public.reenrollment_grade_mappings to authenticated;
grant insert, update, delete on table public.reenrollment_grade_mappings to authenticated;
grant select on table public.reenrollment_requests to authenticated;
grant select on table public.reenrollment_contract_acceptances to authenticated;
grant select on table public.reenrollment_academic_results to authenticated;
grant select on table public.reenrollment_audit_events to authenticated;

revoke all on function private.create_reenrollment_request_v1(uuid, uuid) from public;
revoke all on function private.accept_reenrollment_contract_v1(uuid, text, text) from public;
revoke all on function private.confirm_reenrollment_request_v1(uuid) from public;
revoke all on function private.review_reenrollment_request_v1(uuid, text, text, uuid, text) from public;

revoke all on function public.create_reenrollment_request_v1(uuid, uuid) from public, anon;
revoke all on function public.accept_reenrollment_contract_v1(uuid, text, text) from public, anon;
revoke all on function public.confirm_reenrollment_request_v1(uuid) from public, anon;
revoke all on function public.review_reenrollment_request_v1(uuid, text, text, uuid, text) from public, anon;
grant execute on function public.create_reenrollment_request_v1(uuid, uuid) to authenticated;
grant execute on function public.accept_reenrollment_contract_v1(uuid, text, text) to authenticated;
grant execute on function public.confirm_reenrollment_request_v1(uuid) to authenticated;
grant execute on function public.review_reenrollment_request_v1(uuid, text, text, uuid, text) to authenticated;
