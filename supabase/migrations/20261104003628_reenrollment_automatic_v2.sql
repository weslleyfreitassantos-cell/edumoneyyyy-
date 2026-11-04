-- TECESCOLA Rematricula Automatica V2
-- Additive and opt-in: no production migration or enrollment is executed here.

begin;

-- V1 allowed legacy academic labels. V2 keeps them and adds the official
-- annual outcomes without guessing a destination from a class name.
alter table public.reenrollment_requests
  add column if not exists destination_stage text,
  add column if not exists pending_reason text,
  add column if not exists final_enrollment_id uuid references public.enrollments(id) on delete restrict,
  add column if not exists finalized_by uuid references public.profiles(id) on delete set null,
  add column if not exists finalized_at timestamptz,
  add column if not exists receipt_code text;

alter table public.reenrollment_requests
  drop constraint if exists reenrollment_requests_academic_status_check;
alter table public.reenrollment_requests
  add constraint reenrollment_requests_academic_status_check
  check (academic_status in (
    'NOT_EVALUATED', 'PENDING', 'APPROVED', 'RECOVERY', 'RETAINED',
    'FAILED', 'INCOMPLETE', 'GRADUATING', 'TRANSFERRED', 'INELIGIBLE'
  ));

alter table public.reenrollment_academic_results
  add column if not exists academic_year_closed_at timestamptz,
  add column if not exists homologated_by uuid references public.profiles(id) on delete set null,
  add column if not exists homologated_at timestamptz;

alter table public.reenrollment_academic_results
  drop constraint if exists reenrollment_academic_results_result_status_check;
alter table public.reenrollment_academic_results
  add constraint reenrollment_academic_results_result_status_check
  check (result_status in (
    'PENDING', 'APPROVED', 'RECOVERY', 'RETAINED', 'FAILED', 'INCOMPLETE',
    'GRADUATING', 'TRANSFERRED', 'INELIGIBLE'
  ));

alter table public.reenrollment_campaigns
  add column if not exists finance_mode text not null default 'MANUAL',
  add column if not exists finance_monthly_amount_cents bigint,
  add column if not exists finance_enrollment_fee_cents bigint not null default 0,
  add column if not exists finance_installment_count integer,
  add column if not exists finance_first_due_date date,
  add column if not exists finance_due_day integer,
  add column if not exists finance_scholarship_per_installment_cents bigint not null default 0,
  add column if not exists finance_discount_per_installment_cents bigint not null default 0,
  add column if not exists finance_punctuality_discount_cents bigint not null default 0,
  add column if not exists finance_fine_rate_bps integer not null default 0,
  add column if not exists finance_monthly_interest_rate_bps integer not null default 0,
  add column if not exists finance_grace_days integer not null default 0,
  add column if not exists finance_allow_manual_clearance boolean not null default false;

alter table public.reenrollment_campaigns
  add constraint reenrollment_campaign_finance_mode_check
  check (finance_mode in ('NOT_REQUIRED', 'MANUAL', 'AUTO')),
  add constraint reenrollment_campaign_finance_amounts_check
  check (
    coalesce(finance_enrollment_fee_cents, 0) >= 0
    and coalesce(finance_scholarship_per_installment_cents, 0) >= 0
    and coalesce(finance_discount_per_installment_cents, 0) >= 0
    and coalesce(finance_punctuality_discount_cents, 0) >= 0
    and coalesce(finance_fine_rate_bps, 0) between 0 and 10000
    and coalesce(finance_monthly_interest_rate_bps, 0) between 0 and 10000
    and coalesce(finance_grace_days, 0) between 0 and 365
  ),
  add constraint reenrollment_campaign_finance_terms_check
  check (
    finance_monthly_amount_cents is null
    or finance_monthly_amount_cents > 0
  ),
  add constraint reenrollment_campaign_finance_schedule_check
  check (
    finance_installment_count is null
    or finance_installment_count between 1 and 60
  ),
  add constraint reenrollment_campaign_finance_due_day_check
  check (
    finance_due_day is null
    or finance_due_day between 1 and 31
  );

create index if not exists reenrollment_request_final_enrollment_idx
  on public.reenrollment_requests(institution_id, final_enrollment_id)
  where final_enrollment_id is not null;

create unique index if not exists reenrollment_request_receipt_uidx
  on public.reenrollment_requests(receipt_code)
  where receipt_code is not null;

create table if not exists public.reenrollment_academic_closures (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  closed_by uuid not null references public.profiles(id) on delete restrict,
  closed_at timestamptz not null default now(),
  notes text,
  unique (institution_id, academic_year_id)
);

create table if not exists public.reenrollment_grade_rules (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  source_grade_level text not null,
  destination_grade_level text,
  destination_stage text,
  promotion_policy text not null default 'PROMOTE'
    check (promotion_policy in ('PROMOTE', 'RETAIN', 'GRADUATE', 'MANUAL')),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reenrollment_grade_rule_source_not_blank
    check (length(trim(source_grade_level)) > 0),
  constraint reenrollment_grade_rule_destination_required
    check (promotion_policy = 'GRADUATE' or length(trim(coalesce(destination_grade_level, ''))) > 0)
);

create table if not exists public.reenrollment_document_requirements (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  campaign_id uuid not null references public.reenrollment_campaigns(id) on delete cascade,
  document_type text not null,
  required boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint reenrollment_document_requirement_type_not_blank
    check (length(trim(document_type)) > 0)
);

create table if not exists public.reenrollment_finance_links (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  campaign_id uuid not null references public.reenrollment_campaigns(id) on delete cascade,
  request_id uuid not null references public.reenrollment_requests(id) on delete cascade,
  contract_id uuid references public.financial_contracts(id) on delete restrict,
  primary_invoice_id uuid references public.invoices(id) on delete restrict,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'CLEARED', 'BLOCKED', 'WAIVED')),
  confirmation_origin text not null default 'NONE'
    check (confirmation_origin in ('NONE', 'INVOICE_PAID', 'MANUAL_NO_BANK_SETTLEMENT')),
  manual_clearance boolean not null default false,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  cleared_by uuid references public.profiles(id) on delete set null,
  cleared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id)
);

create table if not exists public.reenrollment_completion_records (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  campaign_id uuid not null references public.reenrollment_campaigns(id) on delete cascade,
  request_id uuid not null references public.reenrollment_requests(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'COMPLETED', 'TRANSFERRED')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id)
);

create index if not exists reenrollment_academic_closure_idx
  on public.reenrollment_academic_closures(institution_id, academic_year_id);
create index if not exists reenrollment_grade_rule_idx
  on public.reenrollment_grade_rules(institution_id, active, lower(source_grade_level));
create unique index if not exists reenrollment_grade_rule_uidx
  on public.reenrollment_grade_rules(institution_id, lower(trim(source_grade_level)));
create index if not exists reenrollment_document_requirement_idx
  on public.reenrollment_document_requirements(institution_id, campaign_id, required);
create unique index if not exists reenrollment_document_requirement_uidx
  on public.reenrollment_document_requirements(campaign_id, lower(trim(document_type)));
create index if not exists reenrollment_finance_link_idx
  on public.reenrollment_finance_links(institution_id, status, request_id);
create index if not exists reenrollment_completion_idx
  on public.reenrollment_completion_records(institution_id, status, request_id);

alter table public.reenrollment_academic_closures enable row level security;
alter table public.reenrollment_grade_rules enable row level security;
alter table public.reenrollment_document_requirements enable row level security;
alter table public.reenrollment_finance_links enable row level security;
alter table public.reenrollment_completion_records enable row level security;

drop policy if exists reenrollment_academic_closure_staff on public.reenrollment_academic_closures;
create policy reenrollment_academic_closure_staff
on public.reenrollment_academic_closures for all to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists reenrollment_grade_rule_staff on public.reenrollment_grade_rules;
create policy reenrollment_grade_rule_staff
on public.reenrollment_grade_rules for all to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists reenrollment_document_requirement_staff on public.reenrollment_document_requirements;
create policy reenrollment_document_requirement_staff
on public.reenrollment_document_requirements for all to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists reenrollment_finance_link_select on public.reenrollment_finance_links;
create policy reenrollment_finance_link_select
on public.reenrollment_finance_links for select to authenticated
using (
  public.can_manage_institution_operations(institution_id)
  or exists (
    select 1 from public.reenrollment_requests request
    where request.id = request_id
      and private.reenrollment_user_can_act_on_student(request.institution_id, request.student_id)
  )
);

drop policy if exists reenrollment_completion_select on public.reenrollment_completion_records;
create policy reenrollment_completion_select
on public.reenrollment_completion_records for select to authenticated
using (
  public.can_manage_institution_operations(institution_id)
  or private.reenrollment_user_can_act_on_student(institution_id, student_id)
);

revoke all on table public.reenrollment_academic_closures from public, anon, authenticated;
revoke all on table public.reenrollment_grade_rules from public, anon, authenticated;
revoke all on table public.reenrollment_document_requirements from public, anon, authenticated;
revoke all on table public.reenrollment_finance_links from public, anon, authenticated;
revoke all on table public.reenrollment_completion_records from public, anon, authenticated;
grant select on table public.reenrollment_academic_closures to authenticated;
grant select on table public.reenrollment_grade_rules to authenticated;
grant select on table public.reenrollment_document_requirements to authenticated;
grant select on table public.reenrollment_finance_links to authenticated;
grant select on table public.reenrollment_completion_records to authenticated;

create or replace function public.create_reenrollment_request_v2(
  target_campaign_id uuid,
  target_student_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_request jsonb;
  request_row public.reenrollment_requests%rowtype;
  rule_row public.reenrollment_grade_rules%rowtype;
begin
  if auth.uid() is null then
    raise exception 'REENROLLMENT_AUTH_REQUIRED';
  end if;

  created_request := private.create_reenrollment_request_v1(
    target_campaign_id,
    target_student_id
  );

  select * into request_row
  from public.reenrollment_requests
  where id = (created_request ->> 'id')::uuid
  for update;

  if request_row.destination_grade_level is null then
    select * into rule_row
    from public.reenrollment_grade_rules
    where institution_id = request_row.institution_id
      and active is true
      and lower(trim(source_grade_level)) = lower(trim(coalesce(request_row.source_grade_level, '')))
    limit 1;

    if not found then
      raise exception 'REENROLLMENT_GRADE_RULE_REQUIRED';
    end if;

    if rule_row.promotion_policy = 'GRADUATE' then
      update public.reenrollment_requests
      set destination_stage = rule_row.destination_stage,
          pending_reason = 'CONCLUIDOR_TRATAMENTO_PROPRIO',
          updated_at = now()
      where id = request_row.id
      returning * into request_row;
    elsif rule_row.promotion_policy = 'MANUAL' then
      update public.reenrollment_requests
      set destination_stage = rule_row.destination_stage,
          pending_reason = 'SERIE_DESTINO_NAO_DEFINIDA',
          updated_at = now()
      where id = request_row.id
      returning * into request_row;
    else
      update public.reenrollment_requests
      set destination_grade_level = case
            when rule_row.promotion_policy = 'RETAIN' then request_row.source_grade_level
            else rule_row.destination_grade_level
          end,
          destination_stage = rule_row.destination_stage,
          updated_at = now()
      where id = request_row.id
      returning * into request_row;
    end if;
  end if;

  return to_jsonb(request_row);
end;
$$;

create or replace function public.close_reenrollment_academic_year_v2(
  p_institution_id uuid,
  p_academic_year_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_row public.reenrollment_academic_closures%rowtype;
begin
  if auth.uid() is null or not public.can_manage_institution_operations(p_institution_id) then
    raise exception 'REENROLLMENT_CLOSURE_NOT_ALLOWED';
  end if;

  if not exists (
    select 1 from public.academic_years academic_year
    where academic_year.id = p_academic_year_id
      and academic_year.institution_id = p_institution_id
  ) then
    raise exception 'REENROLLMENT_YEAR_NOT_IN_INSTITUTION';
  end if;

  insert into public.reenrollment_academic_closures (
    institution_id, academic_year_id, closed_by, notes
  ) values (
    p_institution_id, p_academic_year_id, auth.uid(), nullif(btrim(coalesce(p_notes, '')), '')
  )
  on conflict (institution_id, academic_year_id) do update set
    closed_by = excluded.closed_by,
    closed_at = now(),
    notes = excluded.notes
  returning * into result_row;

  return to_jsonb(result_row);
end;
$$;

create or replace function public.homologate_reenrollment_result_v2(
  p_request_id uuid,
  p_result_status text,
  p_recovery_pending boolean default false,
  p_average_percentage numeric default null,
  p_attendance_percentage numeric default null,
  p_decision_origin text default 'ACADEMIC_TEAM',
  p_destination_grade_level text default null,
  p_destination_stage text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.reenrollment_requests%rowtype;
  campaign public.reenrollment_campaigns%rowtype;
  rule_row public.reenrollment_grade_rules%rowtype;
  closure_row public.reenrollment_academic_closures%rowtype;
  result_row public.reenrollment_academic_results%rowtype;
  next_grade text;
  next_stage text;
  next_request_status text;
begin
  if auth.uid() is null then
    raise exception 'REENROLLMENT_AUTH_REQUIRED';
  end if;
  if p_result_status not in ('APPROVED', 'FAILED', 'RETAINED', 'RECOVERY', 'INCOMPLETE', 'GRADUATING', 'TRANSFERRED', 'INELIGIBLE') then
    raise exception 'REENROLLMENT_INVALID_ANNUAL_RESULT';
  end if;
  if p_decision_origin not in ('ACADEMIC_TEAM', 'CLASS_COUNCIL', 'MANUAL_REVIEW') then
    raise exception 'REENROLLMENT_INVALID_DECISION_ORIGIN';
  end if;
  if p_result_status = 'RECOVERY' and not p_recovery_pending then
    raise exception 'REENROLLMENT_RECOVERY_FLAG_REQUIRED';
  end if;

  select * into request_row
  from public.reenrollment_requests request
  where request.id = p_request_id
  for update;
  if not found or not public.can_manage_institution_operations(request_row.institution_id) then
    raise exception 'REENROLLMENT_REVIEW_NOT_ALLOWED';
  end if;

  select * into campaign
  from public.reenrollment_campaigns
  where id = request_row.campaign_id;

  select * into closure_row
  from public.reenrollment_academic_closures
  where institution_id = request_row.institution_id
    and academic_year_id = campaign.source_academic_year_id;
  if not found then
    raise exception 'REENROLLMENT_ACADEMIC_YEAR_NOT_CLOSED';
  end if;

  if p_average_percentage is not null and (p_average_percentage < 0 or p_average_percentage > 100) then
    raise exception 'REENROLLMENT_INVALID_AVERAGE';
  end if;
  if p_attendance_percentage is not null and (p_attendance_percentage < 0 or p_attendance_percentage > 100) then
    raise exception 'REENROLLMENT_INVALID_ATTENDANCE';
  end if;

  next_grade := nullif(btrim(coalesce(p_destination_grade_level, '')), '');
  next_stage := nullif(btrim(coalesce(p_destination_stage, '')), '');

  select * into rule_row
  from public.reenrollment_grade_rules
  where institution_id = request_row.institution_id
    and active is true
    and lower(trim(source_grade_level)) = lower(trim(coalesce(request_row.source_grade_level, '')))
  limit 1;

  if p_result_status in ('APPROVED', 'FAILED', 'RETAINED') then
    if p_result_status in ('FAILED', 'RETAINED') then
      next_grade := request_row.source_grade_level;
    elsif next_grade is null then
      next_grade := request_row.destination_grade_level;
    end if;
    if p_result_status = 'APPROVED' and found then
      if rule_row.promotion_policy = 'GRADUATE' then
        raise exception 'REENROLLMENT_GRADUATING_RESULT_REQUIRED';
      end if;
      if rule_row.promotion_policy <> 'MANUAL' and next_grade is not null
        and lower(trim(next_grade)) <> lower(trim(coalesce(rule_row.destination_grade_level, ''))) then
        raise exception 'REENROLLMENT_DESTINATION_GRADE_MISMATCH';
      end if;
      next_stage := coalesce(next_stage, rule_row.destination_stage);
    end if;
    if next_grade is null and found and rule_row.promotion_policy not in ('GRADUATE', 'MANUAL') then
      next_grade := case when rule_row.promotion_policy = 'RETAIN'
        then request_row.source_grade_level else rule_row.destination_grade_level end;
      next_stage := coalesce(next_stage, rule_row.destination_stage);
    end if;
    if next_grade is null then
      raise exception 'REENROLLMENT_DESTINATION_GRADE_REQUIRED';
    end if;
  end if;

  insert into public.reenrollment_academic_results (
    institution_id, request_id, student_id, source_academic_year_id,
    result_status, average_percentage, attendance_percentage,
    recovery_pending, decision_origin, notes, recorded_by,
    academic_year_closed_at, homologated_by, homologated_at
  ) values (
    request_row.institution_id, request_row.id, request_row.student_id,
    campaign.source_academic_year_id, p_result_status,
    p_average_percentage, p_attendance_percentage, p_recovery_pending,
    p_decision_origin, nullif(btrim(coalesce(p_notes, '')), ''), auth.uid(),
    closure_row.closed_at, auth.uid(), now()
  )
  on conflict (request_id) do update set
    result_status = excluded.result_status,
    average_percentage = excluded.average_percentage,
    attendance_percentage = excluded.attendance_percentage,
    recovery_pending = excluded.recovery_pending,
    decision_origin = excluded.decision_origin,
    notes = excluded.notes,
    recorded_by = excluded.recorded_by,
    academic_year_closed_at = excluded.academic_year_closed_at,
    homologated_by = excluded.homologated_by,
    homologated_at = excluded.homologated_at,
    updated_at = now()
  returning * into result_row;

  if p_result_status in ('APPROVED', 'FAILED', 'RETAINED') then
    update public.reenrollment_requests
    set academic_status = p_result_status,
        destination_grade_level = next_grade,
        destination_stage = next_stage,
        request_status = case
          when confirmed_at is null then request_status
          else 'READY_FOR_ENROLLMENT'
        end,
        pending_reason = null,
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        notes = nullif(btrim(coalesce(p_notes, '')), ''),
        updated_at = now()
    where id = request_row.id
    returning * into request_row;
  else
    next_request_status := case
      when p_result_status = 'GRADUATING' then 'AWAITING_ACADEMIC_RESULT'
      else 'AWAITING_ACADEMIC_RESULT'
    end;
    update public.reenrollment_requests
    set academic_status = p_result_status,
        request_status = next_request_status,
        pending_reason = case
          when p_result_status = 'RECOVERY' then 'RECUPERACAO_PENDENTE'
          when p_result_status = 'INCOMPLETE' then 'RESULTADO_INCOMPLETO'
          when p_result_status = 'GRADUATING' then 'CONCLUIDOR_TRATAMENTO_PROPRIO'
          else 'RESULTADO_NAO_ELEGIVEL'
        end,
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        notes = nullif(btrim(coalesce(p_notes, '')), ''),
        updated_at = now()
    where id = request_row.id
    returning * into request_row;
  end if;

  insert into public.reenrollment_audit_events (
    institution_id, campaign_id, request_id, action, actor_profile_id, metadata
  ) values (
    request_row.institution_id, request_row.campaign_id, request_row.id,
    'ANNUAL_RESULT_HOMOLOGATED', auth.uid(),
    jsonb_build_object('result_status', p_result_status, 'decision_origin', p_decision_origin)
  );

  if p_result_status = 'GRADUATING' then
    insert into public.reenrollment_completion_records (
      institution_id, campaign_id, request_id, student_id, status, notes, created_by
    ) values (
      request_row.institution_id, request_row.campaign_id, request_row.id,
      request_row.student_id, 'PENDING', nullif(btrim(coalesce(p_notes, '')), ''), auth.uid()
    )
    on conflict (request_id) do update set
      notes = excluded.notes,
      updated_at = now();
  end if;

  return jsonb_build_object('request', to_jsonb(request_row), 'result', to_jsonb(result_row));
end;
$$;

create or replace function public.ensure_reenrollment_finance_v2(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.reenrollment_requests%rowtype;
  campaign public.reenrollment_campaigns%rowtype;
  existing_link public.reenrollment_finance_links%rowtype;
  responsible_profile_id uuid;
  finance_result jsonb;
  contract_id uuid;
  invoice_id uuid;
begin
  if auth.uid() is null then
    raise exception 'REENROLLMENT_AUTH_REQUIRED';
  end if;

  select * into request_row
  from public.reenrollment_requests request
  where request.id = p_request_id
  for update;
  if not found or not public.can_manage_institution_operations(request_row.institution_id) then
    raise exception 'REENROLLMENT_FINANCE_NOT_ALLOWED';
  end if;

  select * into campaign
  from public.reenrollment_campaigns
  where id = request_row.campaign_id;

  if not campaign.require_financial_clearance or campaign.finance_mode = 'NOT_REQUIRED' then
    update public.reenrollment_requests
    set financial_status = 'NOT_REQUIRED', updated_at = now()
    where id = request_row.id
    returning * into request_row;
    return jsonb_build_object('request', to_jsonb(request_row), 'required', false);
  end if;

  select * into existing_link
  from public.reenrollment_finance_links
  where request_id = request_row.id
  for update;
  if found then
    return jsonb_build_object(
      'request', to_jsonb(request_row),
      'finance_link', to_jsonb(existing_link),
      'replayed', true
    );
  end if;

  if campaign.finance_mode <> 'AUTO' then
    insert into public.reenrollment_finance_links (
      institution_id, campaign_id, request_id, status, confirmation_origin, notes, created_by
    ) values (
      request_row.institution_id, request_row.campaign_id, request_row.id,
      'PENDING', 'NONE', 'Aguardando liquidacao financeira manual autorizada.', auth.uid()
    )
    returning * into existing_link;
    return jsonb_build_object(
      'request', to_jsonb(request_row),
      'finance_link', to_jsonb(existing_link),
      'manual_required', true
    );
  end if;

  if campaign.finance_monthly_amount_cents is null
    or campaign.finance_installment_count is null
    or campaign.finance_first_due_date is null
    or campaign.finance_due_day is null then
    raise exception 'REENROLLMENT_FINANCE_TERMS_NOT_CONFIGURED';
  end if;

  select guardianship.guardian_profile_id into responsible_profile_id
  from public.guardianships guardianship
  join public.profiles profile on profile.id = guardianship.guardian_profile_id
    and profile.active is true
  where guardianship.student_id = request_row.student_id
    and guardianship.active is true
  order by guardianship.is_primary desc, guardianship.created_at asc
  limit 1;

  if responsible_profile_id is null then
    raise exception 'REENROLLMENT_FINANCIAL_RESPONSIBLE_NOT_FOUND';
  end if;

  finance_result := public.finance_create_contract_v2(
    request_row.institution_id,
    request_row.student_id,
    null,
    campaign.destination_academic_year_id,
    responsible_profile_id,
    campaign.finance_monthly_amount_cents,
    campaign.finance_enrollment_fee_cents,
    campaign.finance_installment_count,
    campaign.finance_first_due_date,
    campaign.finance_due_day,
    campaign.finance_scholarship_per_installment_cents,
    campaign.finance_discount_per_installment_cents,
    campaign.finance_punctuality_discount_cents,
    campaign.finance_fine_rate_bps,
    campaign.finance_monthly_interest_rate_bps,
    campaign.finance_grace_days,
    'Rematricula automatica ' || request_row.protocol,
    'reenrollment:' || request_row.id::text
  );

  contract_id := (finance_result ->> 'contract_id')::uuid;
  invoice_id := (finance_result -> 'invoice_ids' ->> 0)::uuid;

  insert into public.reenrollment_finance_links (
    institution_id, campaign_id, request_id, contract_id, primary_invoice_id,
    status, confirmation_origin, created_by
  ) values (
    request_row.institution_id, request_row.campaign_id, request_row.id,
    contract_id, invoice_id, 'PENDING', 'NONE', auth.uid()
  )
  returning * into existing_link;

  update public.reenrollment_requests
  set financial_status = 'PENDING',
      request_status = 'AWAITING_PAYMENT',
      pending_reason = 'PAGAMENTO_PENDENTE',
      updated_at = now()
  where id = request_row.id
  returning * into request_row;

  insert into public.reenrollment_audit_events (
    institution_id, campaign_id, request_id, action, actor_profile_id, metadata
  ) values (
    request_row.institution_id, request_row.campaign_id, request_row.id,
    'FINANCE_CONTRACT_LINKED', auth.uid(),
    jsonb_build_object('contract_id', contract_id, 'primary_invoice_id', invoice_id)
  );

  return jsonb_build_object(
    'request', to_jsonb(request_row),
    'finance_link', to_jsonb(existing_link),
    'finance_result', finance_result,
    'replayed', false
  );
end;
$$;

create or replace function public.clear_reenrollment_finance_v2(
  p_request_id uuid,
  p_status text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.reenrollment_requests%rowtype;
  campaign public.reenrollment_campaigns%rowtype;
  link_row public.reenrollment_finance_links%rowtype;
  next_origin text;
begin
  if auth.uid() is null or p_status not in ('CLEARED', 'BLOCKED', 'WAIVED') then
    raise exception 'REENROLLMENT_INVALID_FINANCIAL_DECISION';
  end if;

  select * into request_row
  from public.reenrollment_requests request
  where request.id = p_request_id
  for update;
  if not found or not public.can_manage_institution_operations(request_row.institution_id) then
    raise exception 'REENROLLMENT_FINANCE_NOT_ALLOWED';
  end if;
  select * into campaign from public.reenrollment_campaigns where id = request_row.campaign_id;

  if p_status = 'CLEARED' and not campaign.finance_allow_manual_clearance then
    raise exception 'REENROLLMENT_MANUAL_CLEARANCE_NOT_ALLOWED';
  end if;
  next_origin := case when p_status = 'CLEARED' then 'MANUAL_NO_BANK_SETTLEMENT' else 'NONE' end;

  insert into public.reenrollment_finance_links (
    institution_id, campaign_id, request_id, status, confirmation_origin,
    manual_clearance, notes, created_by, cleared_by, cleared_at
  ) values (
    request_row.institution_id, request_row.campaign_id, request_row.id,
    p_status, next_origin, p_status = 'CLEARED',
    nullif(btrim(coalesce(p_notes, '')), ''), auth.uid(), auth.uid(), now()
  )
  on conflict (request_id) do update set
    status = excluded.status,
    confirmation_origin = excluded.confirmation_origin,
    manual_clearance = excluded.manual_clearance,
    notes = excluded.notes,
    cleared_by = excluded.cleared_by,
    cleared_at = excluded.cleared_at,
    updated_at = now()
  returning * into link_row;

  update public.reenrollment_requests
  set financial_status = p_status,
      request_status = case when p_status in ('BLOCKED', 'PENDING') then 'AWAITING_PAYMENT' else 'READY_FOR_ENROLLMENT' end,
      pending_reason = case when p_status = 'CLEARED' or p_status = 'WAIVED' then null else 'PAGAMENTO_PENDENTE' end,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = request_row.id
  returning * into request_row;

  insert into public.reenrollment_audit_events (
    institution_id, campaign_id, request_id, action, actor_profile_id, metadata
  ) values (
    request_row.institution_id, request_row.campaign_id, request_row.id,
    'FINANCE_STATUS_REVIEWED', auth.uid(),
    jsonb_build_object('status', p_status, 'manual_no_bank_settlement', p_status = 'CLEARED')
  );

  return jsonb_build_object('request', to_jsonb(request_row), 'finance_link', to_jsonb(link_row));
end;
$$;

create or replace function public.finalize_reenrollment_v2(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.reenrollment_requests%rowtype;
  campaign public.reenrollment_campaigns%rowtype;
  result_row public.reenrollment_academic_results%rowtype;
  destination_class public.classes%rowtype;
  finance_link public.reenrollment_finance_links%rowtype;
  invoice_row public.invoices%rowtype;
  v_receipt_code text;
  v_pending_reason text;
  blockers jsonb := '[]'::jsonb;
  pending_documents integer := 0;
  active_enrollment_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'REENROLLMENT_AUTH_REQUIRED';
  end if;

  select request.* into request_row
  from public.reenrollment_requests request
  where request.id = p_request_id
  for update;
  if not found or not public.can_manage_institution_operations(request_row.institution_id) then
    raise exception 'REENROLLMENT_FINALIZE_NOT_ALLOWED';
  end if;

  select * into campaign
  from public.reenrollment_campaigns
  where id = request_row.campaign_id;

  perform pg_advisory_xact_lock(hashtextextended(
    request_row.student_id::text || ':' || campaign.destination_academic_year_id::text,
    0
  ));

  if request_row.request_status = 'ENROLLED' and request_row.final_enrollment_id is not null then
    return jsonb_build_object(
      'ready', true,
      'replayed', true,
      'enrollment_id', request_row.final_enrollment_id,
      'receipt_code', request_row.receipt_code
    );
  end if;

  if not exists (
    select 1 from public.reenrollment_contract_acceptances acceptance
    where acceptance.request_id = request_row.id
      and acceptance.contract_version = campaign.contract_version
      and acceptance.contract_hash = campaign.contract_hash
  ) then
    blockers := blockers || jsonb_build_array('CONTRATO_NAO_ACEITO');
    v_pending_reason := concat_ws('; ', v_pending_reason, 'CONTRATO_NAO_ACEITO');
  end if;

  select * into result_row
  from public.reenrollment_academic_results result
  where result.request_id = request_row.id
  for update;
  if not found or result_row.homologated_at is null then
    blockers := blockers || jsonb_build_array('RESULTADO_NAO_HOMOLOGADO');
    v_pending_reason := concat_ws('; ', v_pending_reason, 'RESULTADO_NAO_HOMOLOGADO');
  elsif result_row.result_status in ('RECOVERY', 'INCOMPLETE') then
    blockers := blockers || jsonb_build_array(
      case when result_row.result_status = 'RECOVERY' then 'RECUPERACAO_PENDENTE' else 'RESULTADO_INCOMPLETO' end
    );
    v_pending_reason := concat_ws('; ', v_pending_reason,
      case when result_row.result_status = 'RECOVERY' then 'RECUPERACAO_PENDENTE' else 'RESULTADO_INCOMPLETO' end
    );
  elsif result_row.result_status = 'GRADUATING' then
    blockers := blockers || jsonb_build_array('CONCLUIDOR_TRATAMENTO_PROPRIO');
    v_pending_reason := concat_ws('; ', v_pending_reason, 'CONCLUIDOR_TRATAMENTO_PROPRIO');
  elsif result_row.result_status not in ('APPROVED', 'FAILED', 'RETAINED') then
    blockers := blockers || jsonb_build_array('RESULTADO_NAO_ELEGIVEL');
    v_pending_reason := concat_ws('; ', v_pending_reason, 'RESULTADO_NAO_ELEGIVEL');
  end if;

  if coalesce(result_row.result_status, '') <> 'GRADUATING' and request_row.destination_grade_level is null then
    blockers := blockers || jsonb_build_array('SERIE_DESTINO_NAO_DEFINIDA');
    v_pending_reason := concat_ws('; ', v_pending_reason, 'SERIE_DESTINO_NAO_DEFINIDA');
  end if;

  if coalesce(result_row.result_status, '') <> 'GRADUATING' and request_row.destination_class_id is null then
    blockers := blockers || jsonb_build_array('TURMA_DESTINO_NAO_DEFINIDA');
    v_pending_reason := concat_ws('; ', v_pending_reason, 'TURMA_DESTINO_NAO_DEFINIDA');
  elsif coalesce(result_row.result_status, '') <> 'GRADUATING' then
    select * into destination_class
    from public.classes class_record
    where class_record.id = request_row.destination_class_id
      and class_record.institution_id = request_row.institution_id
      and class_record.academic_year_id = campaign.destination_academic_year_id
      and class_record.active is true
    for update;
    if not found then
      blockers := blockers || jsonb_build_array('TURMA_DESTINO_INVALIDA');
      v_pending_reason := concat_ws('; ', v_pending_reason, 'TURMA_DESTINO_INVALIDA');
    elsif lower(trim(coalesce(destination_class.grade_level, ''))) <> lower(trim(coalesce(request_row.destination_grade_level, ''))) then
      blockers := blockers || jsonb_build_array('TURMA_SERIE_INCOMPATIVEL');
      v_pending_reason := concat_ws('; ', v_pending_reason, 'TURMA_SERIE_INCOMPATIVEL');
    else
      select count(*) into active_enrollment_count
      from public.enrollments enrollment
      where enrollment.class_id = destination_class.id
        and enrollment.active is true;
      if destination_class.capacity > 0 and active_enrollment_count >= destination_class.capacity then
        blockers := blockers || jsonb_build_array('SEM_VAGA_NA_TURMA');
        v_pending_reason := concat_ws('; ', v_pending_reason, 'SEM_VAGA_NA_TURMA');
      end if;
    end if;
  end if;

  select count(*) into pending_documents
  from public.reenrollment_document_requirements requirement
  where requirement.campaign_id = campaign.id
    and requirement.required is true
    and not exists (
      select 1 from public.student_documents document
      where document.student_id = request_row.student_id
        and document.institution_id = request_row.institution_id
        and lower(trim(document.document_type)) = lower(trim(requirement.document_type))
        and document.status in ('VALIDATED', 'DISPENSED')
    );
  if pending_documents > 0 then
    blockers := blockers || jsonb_build_array('DOCUMENTOS_PENDENTES');
    v_pending_reason := concat_ws('; ', v_pending_reason, 'DOCUMENTOS_PENDENTES');
  end if;

  if campaign.require_financial_clearance then
    select * into finance_link
    from public.reenrollment_finance_links link
    where link.request_id = request_row.id
    for update;
    if not found then
      blockers := blockers || jsonb_build_array('VINCULO_FINANCEIRO_AUSENTE');
      v_pending_reason := concat_ws('; ', v_pending_reason, 'VINCULO_FINANCEIRO_AUSENTE');
    elsif finance_link.status = 'WAIVED' then
      null;
    elsif finance_link.status = 'CLEARED' and finance_link.manual_clearance then
      if not campaign.finance_allow_manual_clearance then
        blockers := blockers || jsonb_build_array('LIQUIDACAO_MANUAL_NAO_AUTORIZADA');
        v_pending_reason := concat_ws('; ', v_pending_reason, 'LIQUIDACAO_MANUAL_NAO_AUTORIZADA');
      end if;
    elsif finance_link.primary_invoice_id is null then
      blockers := blockers || jsonb_build_array('FATURA_NAO_GERADA');
      v_pending_reason := concat_ws('; ', v_pending_reason, 'FATURA_NAO_GERADA');
    else
      select * into invoice_row
      from public.invoices invoice
      where invoice.id = finance_link.primary_invoice_id
        and invoice.institution_id = request_row.institution_id
      for update;
      if not found
        or invoice_row.status::text <> 'PAID'
        or invoice_row.amount_paid < invoice_row.amount_due
        or exists (
          select 1 from public.payments payment
          where payment.invoice_id = invoice_row.id
            and payment.status::text = 'REVERSED'
        ) then
        blockers := blockers || jsonb_build_array('PAGAMENTO_NAO_LIQUIDADO');
        v_pending_reason := concat_ws('; ', v_pending_reason, 'PAGAMENTO_NAO_LIQUIDADO');
      end if;
    end if;
  end if;

  if exists (
    select 1 from public.enrollments enrollment
    where enrollment.student_id = request_row.student_id
      and enrollment.academic_year_id = campaign.destination_academic_year_id
      and enrollment.active is true
      and enrollment.id is distinct from request_row.final_enrollment_id
  ) then
    blockers := blockers || jsonb_build_array('MATRICULA_ATIVA_DUPLICADA');
    v_pending_reason := concat_ws('; ', v_pending_reason, 'MATRICULA_ATIVA_DUPLICADA');
  end if;

  if jsonb_array_length(blockers) > 0 then
    update public.reenrollment_requests
    set request_status = case
          when v_pending_reason like '%PAGAMENTO%'
            or v_pending_reason like '%FINANCEIRO%'
            or v_pending_reason like '%FATURA%'
            then 'AWAITING_PAYMENT'
          when v_pending_reason like '%RESULTADO%'
            or v_pending_reason like '%RECUPERACAO%'
            then 'AWAITING_ACADEMIC_RESULT'
          else request_status
        end,
        pending_reason = v_pending_reason,
        updated_at = now()
    where id = request_row.id
    returning * into request_row;
    return jsonb_build_object(
      'ready', false,
      'replayed', false,
      'blockers', blockers,
      'pending_reason', v_pending_reason,
      'request', to_jsonb(request_row)
    );
  end if;

  insert into public.enrollments (
    student_id, class_id, academic_year_id, status, active
  ) values (
    request_row.student_id, request_row.destination_class_id,
    campaign.destination_academic_year_id, 'active', true
  ) returning id into request_row.final_enrollment_id;

  v_receipt_code := coalesce(request_row.receipt_code, 'RMT-' || upper(substr(replace(extensions.uuid_generate_v4()::text, '-', ''), 1, 12)));

  update public.reenrollment_requests
  set request_status = 'ENROLLED',
      final_enrollment_id = request_row.final_enrollment_id,
      finalized_by = auth.uid(),
      finalized_at = now(),
      receipt_code = v_receipt_code,
      pending_reason = null,
      updated_at = now()
  where id = request_row.id
  returning * into request_row;

  insert into public.reenrollment_audit_events (
    institution_id, campaign_id, request_id, action, actor_profile_id, metadata
  ) values (
    request_row.institution_id, request_row.campaign_id, request_row.id,
    'ENROLLMENT_EFFECTIVATED', auth.uid(),
    jsonb_build_object('enrollment_id', request_row.final_enrollment_id, 'receipt_code', v_receipt_code)
  );

  return jsonb_build_object(
    'ready', true,
    'replayed', false,
    'enrollment_id', request_row.final_enrollment_id,
    'receipt_code', v_receipt_code,
    'request', to_jsonb(request_row)
  );
end;
$$;

create or replace function public.reenrollment_dashboard_v2(
  p_institution_id uuid,
  p_campaign_id uuid default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  page_number integer := greatest(1, coalesce(p_page, 1));
  page_size integer := least(100, greatest(1, coalesce(p_page_size, 25)));
  total_count bigint;
  rows_json jsonb;
  counts_json jsonb;
begin
  if auth.uid() is null or not public.can_manage_institution_operations(p_institution_id) then
    raise exception 'REENROLLMENT_DASHBOARD_NOT_ALLOWED';
  end if;

  select count(*) into total_count
  from public.reenrollment_requests request
  where request.institution_id = p_institution_id
    and (p_campaign_id is null or request.campaign_id = p_campaign_id);

  select coalesce(jsonb_object_agg(grouped.request_status, grouped.total), '{}'::jsonb)
  into counts_json
  from (
    select request.request_status, count(*) as total
    from public.reenrollment_requests request
    where request.institution_id = p_institution_id
      and (p_campaign_id is null or request.campaign_id = p_campaign_id)
    group by request.request_status
  ) grouped;

  select coalesce(jsonb_agg(to_jsonb(page_rows) order by page_rows.created_at desc), '[]'::jsonb)
  into rows_json
  from (
    select request.id, request.campaign_id, request.student_id,
      student_profile.full_name as student_name,
      request.protocol, request.source_grade_level,
      request.destination_grade_level, request.destination_class_id,
      destination_class.name as destination_class_name,
      request.academic_status, request.request_status,
      request.financial_status, request.pending_reason,
      request.final_enrollment_id, request.receipt_code,
      request.created_at, request.updated_at
    from public.reenrollment_requests request
    join public.students student on student.id = request.student_id
      and student.institution_id = request.institution_id
    join public.profiles student_profile on student_profile.id = student.profile_id
    left join public.classes destination_class on destination_class.id = request.destination_class_id
    where request.institution_id = p_institution_id
      and (p_campaign_id is null or request.campaign_id = p_campaign_id)
    order by request.created_at desc
    limit page_size offset (page_number - 1) * page_size
  ) page_rows;

  return jsonb_build_object(
    'rows', rows_json,
    'total_count', total_count,
    'page', page_number,
    'page_size', page_size,
    'counts_by_status', counts_json
  );
end;
$$;

revoke all on function public.create_reenrollment_request_v2(uuid, uuid) from public, anon;
revoke all on function public.close_reenrollment_academic_year_v2(uuid, uuid, text) from public, anon;
revoke all on function public.homologate_reenrollment_result_v2(uuid, text, boolean, numeric, numeric, text, text, text, text) from public, anon;
revoke all on function public.ensure_reenrollment_finance_v2(uuid) from public, anon;
revoke all on function public.clear_reenrollment_finance_v2(uuid, text, text) from public, anon;
revoke all on function public.finalize_reenrollment_v2(uuid) from public, anon;
revoke all on function public.reenrollment_dashboard_v2(uuid, uuid, integer, integer) from public, anon;
grant execute on function public.create_reenrollment_request_v2(uuid, uuid) to authenticated;
grant execute on function public.close_reenrollment_academic_year_v2(uuid, uuid, text) to authenticated;
grant execute on function public.homologate_reenrollment_result_v2(uuid, text, boolean, numeric, numeric, text, text, text, text) to authenticated;
grant execute on function public.ensure_reenrollment_finance_v2(uuid) to authenticated;
grant execute on function public.clear_reenrollment_finance_v2(uuid, text, text) to authenticated;
grant execute on function public.finalize_reenrollment_v2(uuid) to authenticated;
grant execute on function public.reenrollment_dashboard_v2(uuid, uuid, integer, integer) to authenticated;

revoke all on function public.create_reenrollment_request_v2(uuid, uuid) from public;
revoke all on function public.close_reenrollment_academic_year_v2(uuid, uuid, text) from public;
revoke all on function public.homologate_reenrollment_result_v2(uuid, text, boolean, numeric, numeric, text, text, text, text) from public;
revoke all on function public.ensure_reenrollment_finance_v2(uuid) from public;
revoke all on function public.clear_reenrollment_finance_v2(uuid, text, text) from public;
revoke all on function public.finalize_reenrollment_v2(uuid) from public;
revoke all on function public.reenrollment_dashboard_v2(uuid, uuid, integer, integer) from public;

notify pgrst, 'reload schema';
commit;
