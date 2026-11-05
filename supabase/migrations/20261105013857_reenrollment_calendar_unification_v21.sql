-- TECESCOLA Rematricula V2.1: calendar publication is the single campaign entry point.
-- No invoices, contracts, or enrollments are created by publication.

begin;

create extension if not exists pgcrypto with schema extensions;

alter table public.reenrollment_campaigns
  add column if not exists academic_calendar_event_id uuid
    references public.academic_calendar_events(id) on delete set null,
  add column if not exists show_future_notice boolean not null default false;

create unique index if not exists reenrollment_campaign_calendar_event_uidx
  on public.reenrollment_campaigns(academic_calendar_event_id)
  where academic_calendar_event_id is not null;

create index if not exists reenrollment_campaign_calendar_lookup_idx
  on public.reenrollment_campaigns(institution_id, source_academic_year_id, status, opens_at, closes_at);

-- Keep legacy campaign records and request history. The FK is SET NULL only if
-- an event is physically deleted; normal calendar operations are soft transitions.
create or replace function private.sync_reenrollment_campaign_from_calendar_event_v21()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if new.event_type = 'RE_ENROLLMENT'::public.academic_calendar_event_type
    and new.ends_at is not null then
    update public.reenrollment_campaigns campaign
    set title = new.title,
        description = new.description,
        opens_at = new.starts_at,
        closes_at = new.ends_at,
        status = case
          when new.active and new.ends_at > now() then 'OPEN'
          else 'CLOSED'
        end,
        updated_at = now()
    where campaign.academic_calendar_event_id = new.id
      and campaign.institution_id = new.institution_id
      and (
        campaign.title is distinct from new.title
        or campaign.description is distinct from new.description
        or campaign.opens_at is distinct from new.starts_at
        or campaign.closes_at is distinct from new.ends_at
        or campaign.status is distinct from case
          when new.active and new.ends_at > now() then 'OPEN'
          else 'CLOSED'
        end
      );
  elsif tg_op = 'UPDATE'
    and old.event_type = 'RE_ENROLLMENT'::public.academic_calendar_event_type
    and new.event_type <> 'RE_ENROLLMENT'::public.academic_calendar_event_type
    and exists (
      select 1 from public.reenrollment_campaigns campaign
      where campaign.academic_calendar_event_id = new.id
    ) then
    raise exception 'REENROLLMENT_EVENT_TYPE_LOCKED'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists reenrollment_calendar_event_sync_v21
  on public.academic_calendar_events;
create trigger reenrollment_calendar_event_sync_v21
after insert or update on public.academic_calendar_events
for each row execute function private.sync_reenrollment_campaign_from_calendar_event_v21();

create or replace function private.sync_calendar_event_from_reenrollment_campaign_v21()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 or new.academic_calendar_event_id is null then
    return new;
  end if;

  update public.academic_calendar_events event_record
  set title = new.title,
      description = new.description,
      starts_at = new.opens_at,
      ends_at = new.closes_at,
      active = new.status = 'OPEN' and new.closes_at > now(),
      updated_at = now()
  where event_record.id = new.academic_calendar_event_id
    and event_record.institution_id = new.institution_id
    and (
      event_record.title is distinct from new.title
      or event_record.description is distinct from new.description
      or event_record.starts_at is distinct from new.opens_at
      or event_record.ends_at is distinct from new.closes_at
      or event_record.active is distinct from (new.status = 'OPEN' and new.closes_at > now())
    );

  return new;
end;
$$;

drop trigger if exists reenrollment_campaign_calendar_sync_v21
  on public.reenrollment_campaigns;
create trigger reenrollment_campaign_calendar_sync_v21
after update on public.reenrollment_campaigns
for each row execute function private.sync_calendar_event_from_reenrollment_campaign_v21();

create or replace function public.publish_reenrollment_calendar_event_v21(
  p_event_id uuid,
  p_institution_id uuid,
  p_event jsonb,
  p_campaign jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.academic_calendar_events%rowtype;
  campaign_row public.reenrollment_campaigns%rowtype;
  source_year_id uuid;
  destination_year_id uuid;
  eligible_grades text[];
  title_value text;
  description_value text;
  starts_value timestamptz;
  closes_value timestamptz;
  contract_version_value text;
  contract_body_value text;
  contract_hash_value text;
  finance_mode_value text;
  finance_monthly_amount_value bigint;
  finance_enrollment_fee_value bigint;
  finance_installment_count_value integer;
  finance_first_due_date_value date;
  finance_due_day_value integer;
  finance_scholarship_value bigint;
  finance_discount_value bigint;
  finance_punctuality_discount_value bigint;
  finance_fine_rate_value integer;
  finance_interest_rate_value integer;
  finance_grace_days_value integer;
  finance_manual_clearance_value boolean;
  has_requests boolean;
  has_acceptances boolean;
  prior_event_id uuid;
begin
  if auth.uid() is null then
    raise exception 'REENROLLMENT_AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.can_manage_institution_operations(p_institution_id) then
    raise exception 'REENROLLMENT_PUBLISH_FORBIDDEN' using errcode = '42501';
  end if;
  if jsonb_typeof(p_event) <> 'object' or jsonb_typeof(p_campaign) <> 'object' then
    raise exception 'REENROLLMENT_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_institution_id::text, 217));

  title_value := nullif(btrim(p_event ->> 'title'), '');
  description_value := nullif(btrim(p_event ->> 'description'), '');
  starts_value := nullif(p_event ->> 'starts_at', '')::timestamptz;
  closes_value := nullif(p_event ->> 'ends_at', '')::timestamptz;
  source_year_id := nullif(p_campaign ->> 'source_academic_year_id', '')::uuid;
  destination_year_id := nullif(p_campaign ->> 'destination_academic_year_id', '')::uuid;
  contract_version_value := nullif(btrim(p_campaign ->> 'contract_version'), '');
  contract_body_value := nullif(btrim(p_campaign ->> 'contract_body'), '');
  finance_mode_value := coalesce(nullif(p_campaign ->> 'finance_mode', ''), 'NOT_REQUIRED');
  finance_monthly_amount_value := nullif(p_campaign ->> 'finance_monthly_amount_cents', '')::bigint;
  finance_enrollment_fee_value := coalesce(nullif(p_campaign ->> 'finance_enrollment_fee_cents', '')::bigint, 0);
  finance_installment_count_value := nullif(p_campaign ->> 'finance_installment_count', '')::integer;
  finance_first_due_date_value := nullif(p_campaign ->> 'finance_first_due_date', '')::date;
  finance_due_day_value := nullif(p_campaign ->> 'finance_due_day', '')::integer;
  finance_scholarship_value := coalesce(nullif(p_campaign ->> 'finance_scholarship_per_installment_cents', '')::bigint, 0);
  finance_discount_value := coalesce(nullif(p_campaign ->> 'finance_discount_per_installment_cents', '')::bigint, 0);
  finance_punctuality_discount_value := coalesce(nullif(p_campaign ->> 'finance_punctuality_discount_cents', '')::bigint, 0);
  finance_fine_rate_value := coalesce(nullif(p_campaign ->> 'finance_fine_rate_bps', '')::integer, 0);
  finance_interest_rate_value := coalesce(nullif(p_campaign ->> 'finance_monthly_interest_rate_bps', '')::integer, 0);
  finance_grace_days_value := coalesce(nullif(p_campaign ->> 'finance_grace_days', '')::integer, 0);
  finance_manual_clearance_value := coalesce((p_campaign ->> 'finance_allow_manual_clearance')::boolean, false);

  if title_value is null or char_length(title_value) > 160 then
    raise exception 'REENROLLMENT_TITLE_REQUIRED' using errcode = '22023';
  end if;
  if starts_value is null or closes_value is null or starts_value >= closes_value then
    raise exception 'REENROLLMENT_PERIOD_INVALID' using errcode = '22023';
  end if;
  if source_year_id is null or destination_year_id is null or source_year_id = destination_year_id then
    raise exception 'REENROLLMENT_YEARS_INVALID' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.academic_years year_record
    where year_record.id = source_year_id and year_record.institution_id = p_institution_id
  ) or not exists (
    select 1 from public.academic_years year_record
    where year_record.id = destination_year_id and year_record.institution_id = p_institution_id
  ) then
    raise exception 'REENROLLMENT_YEAR_INSTITUTION_MISMATCH' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_campaign -> 'eligible_grade_levels', '[]'::jsonb)) <> 'array' then
    raise exception 'REENROLLMENT_GRADES_INVALID' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct btrim(value) order by btrim(value)), '{}'::text[])
    into eligible_grades
  from jsonb_array_elements_text(coalesce(p_campaign -> 'eligible_grade_levels', '[]'::jsonb)) grade(value)
  where btrim(value) <> '';
  if coalesce(array_length(eligible_grades, 1), 0) = 0 then
    raise exception 'REENROLLMENT_GRADES_REQUIRED' using errcode = '22023';
  end if;
  if contract_version_value is null or char_length(contract_version_value) > 40
    or contract_body_value is null or char_length(contract_body_value) < 30
    or char_length(contract_body_value) > 20000 then
    raise exception 'REENROLLMENT_CONTRACT_INVALID' using errcode = '22023';
  end if;
  contract_hash_value := 'sha256:' || encode(
    extensions.digest(convert_to(contract_body_value, 'UTF8'), 'sha256'),
    'hex'
  );
  if finance_mode_value not in ('NOT_REQUIRED', 'MANUAL', 'AUTO') then
    raise exception 'REENROLLMENT_FINANCE_MODE_INVALID' using errcode = '22023';
  end if;
  if finance_enrollment_fee_value < 0 or finance_scholarship_value < 0
    or finance_discount_value < 0 or finance_punctuality_discount_value < 0
    or finance_fine_rate_value not between 0 and 10000
    or finance_interest_rate_value not between 0 and 10000
    or finance_grace_days_value not between 0 and 365 then
    raise exception 'REENROLLMENT_FINANCE_TERMS_INVALID' using errcode = '22023';
  end if;
  if finance_mode_value = 'AUTO' and (
    finance_monthly_amount_value is null or finance_monthly_amount_value <= 0
    or finance_installment_count_value is null or finance_installment_count_value not between 1 and 60
    or finance_first_due_date_value is null
    or finance_due_day_value is null or finance_due_day_value not between 1 and 31
  ) then
    raise exception 'REENROLLMENT_FINANCE_TERMS_REQUIRED' using errcode = '22023';
  end if;
  if finance_manual_clearance_value and finance_mode_value <> 'MANUAL' then
    raise exception 'REENROLLMENT_MANUAL_CLEARANCE_INVALID' using errcode = '22023';
  end if;

  select * into campaign_row
  from public.reenrollment_campaigns campaign
  where campaign.academic_calendar_event_id = p_event_id
    and p_event_id is not null
    and campaign.institution_id = p_institution_id
  for update;

  if campaign_row.id is null then
    select * into campaign_row
    from public.reenrollment_campaigns campaign
    where campaign.institution_id = p_institution_id
      and campaign.source_academic_year_id = source_year_id
      and campaign.destination_academic_year_id = destination_year_id
    for update;
  end if;

  if campaign_row.id is not null then
    prior_event_id := campaign_row.academic_calendar_event_id;
    if prior_event_id is not null and prior_event_id is distinct from p_event_id then
      if p_event_id is null then
        select * into event_row from public.academic_calendar_events
        where id = prior_event_id and institution_id = p_institution_id;
        if event_row.id is not null
          and event_row.title = title_value
          and event_row.description is not distinct from description_value
          and event_row.starts_at = starts_value
          and event_row.ends_at = closes_value
          and campaign_row.contract_version = contract_version_value
          and campaign_row.contract_body = contract_body_value
          and campaign_row.eligible_grade_levels = eligible_grades
          and campaign_row.finance_mode = finance_mode_value
          and campaign_row.finance_monthly_amount_cents is not distinct from finance_monthly_amount_value
          and campaign_row.finance_enrollment_fee_cents = finance_enrollment_fee_value
          and campaign_row.finance_installment_count is not distinct from finance_installment_count_value
          and campaign_row.finance_first_due_date is not distinct from finance_first_due_date_value
          and campaign_row.finance_due_day is not distinct from finance_due_day_value
          and campaign_row.finance_scholarship_per_installment_cents = finance_scholarship_value
          and campaign_row.finance_discount_per_installment_cents = finance_discount_value
          and campaign_row.finance_punctuality_discount_cents = finance_punctuality_discount_value
          and campaign_row.finance_fine_rate_bps = finance_fine_rate_value
          and campaign_row.finance_monthly_interest_rate_bps = finance_interest_rate_value
          and campaign_row.finance_grace_days = finance_grace_days_value
          and campaign_row.finance_allow_manual_clearance = finance_manual_clearance_value
          and campaign_row.show_future_notice = coalesce((p_campaign ->> 'show_future_notice')::boolean, false) then
          return jsonb_build_object(
            'event', to_jsonb(event_row),
            'campaign', to_jsonb(campaign_row),
            'replayed', true
          );
        end if;
      end if;
      raise exception 'REENROLLMENT_CAMPAIGN_ALREADY_LINKED'
        using errcode = '23505';
    end if;
  end if;

  if p_event_id is not null then
    select * into event_row from public.academic_calendar_events event_record
    where event_record.id = p_event_id
      and event_record.institution_id = p_institution_id
    for update;
    if not found then
      raise exception 'REENROLLMENT_EVENT_NOT_FOUND' using errcode = '22023';
    end if;
  end if;

  if campaign_row.id is not null then
    select exists (
      select 1 from public.reenrollment_requests request
      where request.campaign_id = campaign_row.id
    ) into has_requests;
    select exists (
      select 1
      from public.reenrollment_contract_acceptances acceptance
      join public.reenrollment_requests request on request.id = acceptance.request_id
      where request.campaign_id = campaign_row.id
    ) into has_acceptances;
    if has_acceptances then
      if campaign_row.contract_version is distinct from contract_version_value
        or campaign_row.contract_body is distinct from contract_body_value then
        raise exception 'REENROLLMENT_CONTRACT_LOCKED_AFTER_ACCEPTANCE'
          using errcode = '23514';
      end if;
      contract_hash_value := campaign_row.contract_hash;
    end if;
    if has_requests and (
      campaign_row.source_academic_year_id is distinct from source_year_id
      or campaign_row.destination_academic_year_id is distinct from destination_year_id
      or campaign_row.eligible_grade_levels is distinct from eligible_grades
      or campaign_row.contract_version is distinct from contract_version_value
      or campaign_row.contract_body is distinct from contract_body_value
      or campaign_row.finance_mode is distinct from finance_mode_value
      or campaign_row.finance_monthly_amount_cents is distinct from finance_monthly_amount_value
      or campaign_row.finance_enrollment_fee_cents is distinct from finance_enrollment_fee_value
      or campaign_row.finance_installment_count is distinct from finance_installment_count_value
      or campaign_row.finance_first_due_date is distinct from finance_first_due_date_value
      or campaign_row.finance_due_day is distinct from finance_due_day_value
      or campaign_row.finance_scholarship_per_installment_cents is distinct from finance_scholarship_value
      or campaign_row.finance_discount_per_installment_cents is distinct from finance_discount_value
      or campaign_row.finance_punctuality_discount_cents is distinct from finance_punctuality_discount_value
      or campaign_row.finance_fine_rate_bps is distinct from finance_fine_rate_value
      or campaign_row.finance_monthly_interest_rate_bps is distinct from finance_interest_rate_value
      or campaign_row.finance_grace_days is distinct from finance_grace_days_value
      or campaign_row.finance_allow_manual_clearance is distinct from finance_manual_clearance_value
    ) then
      raise exception 'REENROLLMENT_CONFIGURATION_LOCKED_AFTER_REQUESTS'
        using errcode = '23514';
    end if;
  end if;

  if p_event_id is null then
    insert into public.academic_calendar_events (
      institution_id, academic_year_id, title, description, event_type,
      starts_at, ends_at, all_day, audience, active, created_by
    ) values (
      p_institution_id, source_year_id, title_value, description_value,
      'RE_ENROLLMENT'::public.academic_calendar_event_type,
      starts_value, closes_value, false, 'ALL'::public.academic_calendar_audience,
      closes_value > now(), auth.uid()
    ) returning * into event_row;
  else
    update public.academic_calendar_events event_record
    set academic_year_id = source_year_id,
        title = title_value,
        description = description_value,
        event_type = 'RE_ENROLLMENT'::public.academic_calendar_event_type,
        starts_at = starts_value,
        ends_at = closes_value,
        all_day = false,
        audience = 'ALL'::public.academic_calendar_audience,
        class_id = null,
        subject_id = null,
        active = true,
        updated_at = now()
    where event_record.id = event_row.id
    returning * into event_row;
  end if;

  if campaign_row.id is null then
    insert into public.reenrollment_campaigns (
      institution_id, academic_calendar_event_id,
      source_academic_year_id, destination_academic_year_id,
      title, description, status, opens_at, closes_at, target_audience,
      eligible_grade_levels, contract_version, contract_hash, contract_body,
      require_academic_result, require_financial_clearance, allow_class_choice,
      finance_mode, finance_monthly_amount_cents, finance_enrollment_fee_cents,
      finance_installment_count, finance_first_due_date, finance_due_day,
      finance_scholarship_per_installment_cents,
      finance_discount_per_installment_cents,
      finance_punctuality_discount_cents, finance_fine_rate_bps,
      finance_monthly_interest_rate_bps, finance_grace_days,
      finance_allow_manual_clearance, show_future_notice, created_by
    ) values (
      p_institution_id, event_row.id,
      source_year_id, destination_year_id,
      title_value, description_value,
      case when closes_value > now() then 'OPEN' else 'CLOSED' end,
      starts_value, closes_value, 'ACTIVE_STUDENTS',
      eligible_grades, contract_version_value, contract_hash_value, contract_body_value,
      true, finance_mode_value <> 'NOT_REQUIRED', false,
      finance_mode_value, finance_monthly_amount_value, finance_enrollment_fee_value,
      finance_installment_count_value, finance_first_due_date_value, finance_due_day_value,
      finance_scholarship_value, finance_discount_value,
      finance_punctuality_discount_value, finance_fine_rate_value,
      finance_interest_rate_value, finance_grace_days_value,
      finance_manual_clearance_value,
      coalesce((p_campaign ->> 'show_future_notice')::boolean, false), auth.uid()
    ) returning * into campaign_row;
  else
    update public.reenrollment_campaigns campaign
    set academic_calendar_event_id = event_row.id,
        source_academic_year_id = source_year_id,
        destination_academic_year_id = destination_year_id,
        title = title_value,
        description = description_value,
        status = case when closes_value > now() then 'OPEN' else 'CLOSED' end,
        opens_at = starts_value,
        closes_at = closes_value,
        eligible_grade_levels = eligible_grades,
        contract_version = contract_version_value,
        contract_hash = contract_hash_value,
        contract_body = contract_body_value,
        require_financial_clearance = finance_mode_value <> 'NOT_REQUIRED',
        finance_mode = finance_mode_value,
        finance_monthly_amount_cents = finance_monthly_amount_value,
        finance_enrollment_fee_cents = finance_enrollment_fee_value,
        finance_installment_count = finance_installment_count_value,
        finance_first_due_date = finance_first_due_date_value,
        finance_due_day = finance_due_day_value,
        finance_scholarship_per_installment_cents = finance_scholarship_value,
        finance_discount_per_installment_cents = finance_discount_value,
        finance_punctuality_discount_cents = finance_punctuality_discount_value,
        finance_fine_rate_bps = finance_fine_rate_value,
        finance_monthly_interest_rate_bps = finance_interest_rate_value,
        finance_grace_days = finance_grace_days_value,
        finance_allow_manual_clearance = finance_manual_clearance_value,
        show_future_notice = coalesce((p_campaign ->> 'show_future_notice')::boolean, false),
        updated_at = now()
    where campaign.id = campaign_row.id
    returning * into campaign_row;
  end if;

  return jsonb_build_object(
    'event', to_jsonb(event_row),
    'campaign', to_jsonb(campaign_row),
    'replayed', false
  );
end;
$$;

create or replace function public.set_academic_calendar_event_active_v21(
  p_event_id uuid,
  p_institution_id uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'CALENDAR_AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.can_manage_institution_operations(p_institution_id) then
    raise exception 'CALENDAR_MANAGE_FORBIDDEN' using errcode = '42501';
  end if;
  update public.academic_calendar_events event_record
  set active = p_active and (
        event_record.event_type <> 'RE_ENROLLMENT'::public.academic_calendar_event_type
        or coalesce(event_record.ends_at > now(), false)
      ),
      updated_at = now()
  where event_record.id = p_event_id and event_record.institution_id = p_institution_id;
  if not found then
    raise exception 'CALENDAR_EVENT_NOT_FOUND' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.get_my_reenrollment_status_v21(
  p_institution_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  authorized_students_count integer;
  source_enrollments_count integer;
  has_linked_campaign boolean;
  has_source_campaign_enrollment boolean;
  has_ended_campaign boolean;
  has_ineligible_campaign boolean;
  campaigns_json jsonb;
  state_value text;
begin
  if auth.uid() is null then
    raise exception 'REENROLLMENT_AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.can_access_institution(p_institution_id) then
    raise exception 'REENROLLMENT_INSTITUTION_FORBIDDEN' using errcode = '42501';
  end if;

  select count(*) into authorized_students_count
  from public.students student
  where student.institution_id = p_institution_id
    and student.active is true
    and (
      student.profile_id = auth.uid()
      or exists (
        select 1 from public.guardianships guardianship
        where guardianship.student_id = student.id
          and guardianship.guardian_profile_id = auth.uid()
          and guardianship.active is true
      )
    );

  if authorized_students_count = 0 then
    if exists (
      select 1 from public.memberships membership
      where membership.profile_id = auth.uid()
        and membership.institution_id = p_institution_id
        and membership.active is true
        and membership.role = 'GUARDIAN'::public.user_role
    ) then
      return jsonb_build_object('state', 'GUARDIANSHIP_INVALID', 'campaigns', '[]'::jsonb);
    end if;
    return jsonb_build_object('state', 'NO_AUTHORIZED_STUDENTS', 'campaigns', '[]'::jsonb);
  end if;

  select count(*) into source_enrollments_count
  from public.students student
  join public.enrollments enrollment
    on enrollment.student_id = student.id
   and enrollment.active is true
  join public.classes class_record
    on class_record.id = enrollment.class_id
   and class_record.institution_id = student.institution_id
   and class_record.active is true
  where student.institution_id = p_institution_id
    and student.active is true
    and (
      student.profile_id = auth.uid()
      or exists (
        select 1 from public.guardianships guardianship
        where guardianship.student_id = student.id
          and guardianship.guardian_profile_id = auth.uid()
          and guardianship.active is true
      )
    );

  if source_enrollments_count = 0 then
    return jsonb_build_object('state', 'SOURCE_ENROLLMENT_MISSING', 'campaigns', '[]'::jsonb);
  end if;

  select exists (
    select 1 from public.reenrollment_campaigns campaign
    where campaign.institution_id = p_institution_id
      and campaign.academic_calendar_event_id is not null
  ) into has_linked_campaign;

  select exists (
    select 1
    from public.reenrollment_campaigns campaign
    join public.students student on student.institution_id = campaign.institution_id
      and student.active is true
      and (student.profile_id = auth.uid() or exists (
        select 1 from public.guardianships guardianship
        where guardianship.student_id = student.id
          and guardianship.guardian_profile_id = auth.uid()
          and guardianship.active is true
      ))
    join public.enrollments enrollment on enrollment.student_id = student.id
      and enrollment.academic_year_id = campaign.source_academic_year_id
      and enrollment.active is true
    where campaign.institution_id = p_institution_id
      and campaign.academic_calendar_event_id is not null
  ) into has_source_campaign_enrollment;

  select exists (
    select 1 from public.reenrollment_campaigns campaign
    join public.students student on student.institution_id = campaign.institution_id
      and student.active is true
      and (student.profile_id = auth.uid() or exists (
        select 1 from public.guardianships guardianship
        where guardianship.student_id = student.id
          and guardianship.guardian_profile_id = auth.uid()
          and guardianship.active is true
      ))
    join public.enrollments enrollment on enrollment.student_id = student.id
      and enrollment.academic_year_id = campaign.source_academic_year_id
      and enrollment.active is true
    join public.classes class_record on class_record.id = enrollment.class_id
      and class_record.active is true
    where campaign.institution_id = p_institution_id
      and coalesce(array_length(campaign.eligible_grade_levels, 1), 0) > 0
      and not (coalesce(class_record.grade_level, '') = any (campaign.eligible_grade_levels))
  ) into has_ineligible_campaign;

  select exists (
    select 1 from public.reenrollment_campaigns campaign
    join public.students student on student.institution_id = campaign.institution_id
      and student.active is true
      and (student.profile_id = auth.uid() or exists (
        select 1 from public.guardianships guardianship
        where guardianship.student_id = student.id
          and guardianship.guardian_profile_id = auth.uid()
          and guardianship.active is true
      ))
    join public.enrollments enrollment on enrollment.student_id = student.id
      and enrollment.academic_year_id = campaign.source_academic_year_id
      and enrollment.active is true
    join public.classes class_record on class_record.id = enrollment.class_id
      and class_record.active is true
    where campaign.institution_id = p_institution_id
      and (coalesce(array_length(campaign.eligible_grade_levels, 1), 0) = 0
        or coalesce(class_record.grade_level, '') = any (campaign.eligible_grade_levels))
      and (campaign.status in ('CLOSED', 'CANCELLED', 'ARCHIVED')
        or (campaign.status = 'OPEN' and campaign.closes_at <= now()))
  ) into has_ended_campaign;

  select coalesce(jsonb_agg(jsonb_build_object(
    'campaign', to_jsonb(campaign),
    'state', case
      when campaign.status <> 'OPEN' or campaign.closes_at <= now() then 'CLOSED'
      when campaign.opens_at > now() then 'UPCOMING'
      else 'OPEN'
    end,
    'eligible_students', eligible_students.rows
  ) order by campaign.opens_at), '[]'::jsonb)
  into campaigns_json
  from public.reenrollment_campaigns campaign
  cross join lateral (
    select coalesce(jsonb_agg(jsonb_build_object(
      'student_id', student.id,
      'can_confirm', (
        exists (
          select 1 from public.guardianships guardianship
          where guardianship.student_id = student.id
            and guardianship.guardian_profile_id = auth.uid()
            and guardianship.active is true
        ) or (
          student.profile_id = auth.uid()
          and student.birth_date is not null
          and student.birth_date <= (current_date - interval '18 years')::date
        )
      )
    )), '[]'::jsonb) as rows
    from public.students student
    left join public.enrollments enrollment on enrollment.student_id = student.id
      and enrollment.academic_year_id = campaign.source_academic_year_id
      and enrollment.active is true
    left join public.classes class_record on class_record.id = enrollment.class_id
      and class_record.active is true
    where student.institution_id = p_institution_id
      and student.active is true
      and (student.profile_id = auth.uid() or exists (
        select 1 from public.guardianships guardianship
        where guardianship.student_id = student.id
          and guardianship.guardian_profile_id = auth.uid()
          and guardianship.active is true
      ))
      and (
        exists (
          select 1 from public.reenrollment_requests request
          where request.campaign_id = campaign.id and request.student_id = student.id
        )
        or (
          enrollment.id is not null
          and (coalesce(array_length(campaign.eligible_grade_levels, 1), 0) = 0
            or coalesce(class_record.grade_level, '') = any (campaign.eligible_grade_levels))
        )
      )
      and (
        (campaign.status = 'OPEN' and now() between campaign.opens_at and campaign.closes_at)
        or (campaign.status = 'OPEN' and campaign.show_future_notice is true and campaign.opens_at > now())
        or exists (
          select 1 from public.reenrollment_requests request
          where request.campaign_id = campaign.id and request.student_id = student.id
        )
      )
  ) eligible_students
  where campaign.institution_id = p_institution_id
    and jsonb_array_length(eligible_students.rows) > 0;

  if jsonb_array_length(campaigns_json) > 0 then
    state_value := 'AVAILABLE';
  elsif has_ended_campaign then
    state_value := 'CAMPAIGN_ENDED';
  elsif has_ineligible_campaign then
    state_value := 'STUDENT_INELIGIBLE';
  elsif has_linked_campaign and not has_source_campaign_enrollment then
    state_value := 'SOURCE_ENROLLMENT_MISSING';
  else
    state_value := 'NO_CAMPAIGN';
  end if;

  return jsonb_build_object('state', state_value, 'campaigns', campaigns_json);
end;
$$;

create or replace function private.validate_reenrollment_campaign_calendar_v21()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_hash text;
  validate_hash boolean := false;
begin
  if new.academic_calendar_event_id is not null then
    if tg_op = 'INSERT' then
      validate_hash := true;
    else
      validate_hash := old.contract_body is distinct from new.contract_body
        or old.contract_version is distinct from new.contract_version
        or old.contract_hash is distinct from new.contract_hash;
    end if;
    if validate_hash then
      expected_hash := 'sha256:' || encode(
        extensions.digest(convert_to(btrim(new.contract_body), 'UTF8'), 'sha256'),
        'hex'
      );
      if new.contract_hash is distinct from expected_hash then
        raise exception 'REENROLLMENT_CONTRACT_HASH_INVALID' using errcode = '23514';
      end if;
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if old.academic_calendar_event_id is not null
      and new.academic_calendar_event_id is null
      and exists (
        select 1 from public.academic_calendar_events event_record
        where event_record.id = old.academic_calendar_event_id
      ) then
      raise exception 'REENROLLMENT_CALENDAR_LINK_LOCKED' using errcode = '23514';
    end if;

    if exists (
      select 1 from public.reenrollment_requests request
      where request.campaign_id = old.id
    ) and (
      old.source_academic_year_id is distinct from new.source_academic_year_id
      or old.destination_academic_year_id is distinct from new.destination_academic_year_id
      or old.eligible_grade_levels is distinct from new.eligible_grade_levels
      or old.contract_version is distinct from new.contract_version
      or old.contract_body is distinct from new.contract_body
      or old.finance_mode is distinct from new.finance_mode
      or old.finance_monthly_amount_cents is distinct from new.finance_monthly_amount_cents
      or old.finance_enrollment_fee_cents is distinct from new.finance_enrollment_fee_cents
      or old.finance_installment_count is distinct from new.finance_installment_count
      or old.finance_first_due_date is distinct from new.finance_first_due_date
      or old.finance_due_day is distinct from new.finance_due_day
      or old.finance_scholarship_per_installment_cents is distinct from new.finance_scholarship_per_installment_cents
      or old.finance_discount_per_installment_cents is distinct from new.finance_discount_per_installment_cents
      or old.finance_punctuality_discount_cents is distinct from new.finance_punctuality_discount_cents
      or old.finance_fine_rate_bps is distinct from new.finance_fine_rate_bps
      or old.finance_monthly_interest_rate_bps is distinct from new.finance_monthly_interest_rate_bps
      or old.finance_grace_days is distinct from new.finance_grace_days
      or old.finance_allow_manual_clearance is distinct from new.finance_allow_manual_clearance
    ) then
      raise exception 'REENROLLMENT_CONFIGURATION_LOCKED_AFTER_REQUESTS'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reenrollment_campaign_calendar_validate_v21
  on public.reenrollment_campaigns;
create trigger reenrollment_campaign_calendar_validate_v21
before insert or update on public.reenrollment_campaigns
for each row execute function private.validate_reenrollment_campaign_calendar_v21();

-- Direct table writes cannot bypass the atomic calendar publication flow.
drop policy if exists academic_calendar_events_staff_insert
  on public.academic_calendar_events;
create policy academic_calendar_events_staff_insert
on public.academic_calendar_events
for insert to authenticated
with check (
  public.can_manage_institution_operations(institution_id)
  and created_by = auth.uid()
  and event_type <> 'RE_ENROLLMENT'::public.academic_calendar_event_type
);

drop policy if exists academic_calendar_events_staff_update
  on public.academic_calendar_events;
create policy academic_calendar_events_staff_update
on public.academic_calendar_events
for update to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (
  public.can_manage_institution_operations(institution_id)
  and event_type <> 'RE_ENROLLMENT'::public.academic_calendar_event_type
);

drop policy if exists reenrollment_campaign_manage
  on public.reenrollment_campaigns;
drop policy if exists reenrollment_campaign_update
  on public.reenrollment_campaigns;

revoke insert, update, delete on table public.reenrollment_campaigns from authenticated;
grant select on table public.reenrollment_campaigns to authenticated;

revoke all on function public.publish_reenrollment_calendar_event_v21(uuid, uuid, jsonb, jsonb) from public, anon;
revoke all on function public.set_academic_calendar_event_active_v21(uuid, uuid, boolean) from public, anon;
revoke all on function public.get_my_reenrollment_status_v21(uuid) from public, anon;
grant execute on function public.publish_reenrollment_calendar_event_v21(uuid, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.set_academic_calendar_event_active_v21(uuid, uuid, boolean) to authenticated;
grant execute on function public.get_my_reenrollment_status_v21(uuid) to authenticated;

-- The V1 public wrappers are SECURITY INVOKER and delegate to these guarded
-- helpers. Restore only authenticated EXECUTE; the helpers enforce actor scope.
grant execute on function private.create_reenrollment_request_v1(uuid, uuid) to authenticated;
grant execute on function private.accept_reenrollment_contract_v1(uuid, text, text) to authenticated;
grant execute on function private.confirm_reenrollment_request_v1(uuid) to authenticated;
grant execute on function private.review_reenrollment_request_v1(uuid, text, text, uuid, text) to authenticated;

revoke all on function private.sync_reenrollment_campaign_from_calendar_event_v21() from public, anon, authenticated;
revoke all on function private.sync_calendar_event_from_reenrollment_campaign_v21() from public, anon, authenticated;
revoke all on function private.validate_reenrollment_campaign_calendar_v21() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
