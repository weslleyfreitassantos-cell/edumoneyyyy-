begin;

-- Finance V2 extends the existing contract, invoice and payment records.
-- All monetary values remain integer BRL cents. Rates are contract terms in
-- basis points and default to zero; schools must configure them per contract.

alter table public.financial_contracts
  add column if not exists idempotency_key text,
  add column if not exists monthly_amount_cents bigint,
  add column if not exists scholarship_per_installment_cents bigint not null default 0,
  add column if not exists discount_per_installment_cents bigint not null default 0,
  add column if not exists punctuality_discount_cents bigint not null default 0,
  add column if not exists fine_rate_bps integer not null default 0,
  add column if not exists monthly_interest_rate_bps integer not null default 0,
  add column if not exists grace_days integer not null default 0;

update public.financial_contracts
set monthly_amount_cents = greatest(0, base_amount / greatest(installment_count, 1))
where monthly_amount_cents is null;

alter table public.financial_contracts
  alter column monthly_amount_cents set not null,
  add constraint financial_contracts_monthly_amount_nonnegative
    check (monthly_amount_cents >= 0),
  add constraint financial_contracts_scholarship_nonnegative
    check (scholarship_per_installment_cents >= 0),
  add constraint financial_contracts_discount_nonnegative
    check (discount_per_installment_cents >= 0),
  add constraint financial_contracts_punctuality_nonnegative
    check (punctuality_discount_cents >= 0),
  add constraint financial_contracts_fine_rate_valid
    check (fine_rate_bps between 0 and 10000),
  add constraint financial_contracts_monthly_interest_rate_valid
    check (monthly_interest_rate_bps between 0 and 10000),
  add constraint financial_contracts_grace_days_valid
    check (grace_days between 0 and 365),
  add constraint financial_contracts_idempotency_key_valid
    check (idempotency_key is null or length(btrim(idempotency_key)) between 8 and 160);

create unique index if not exists financial_contracts_idempotency_idx
  on public.financial_contracts(institution_id, idempotency_key)
  where idempotency_key is not null;

alter table public.invoices
  add column if not exists punctuality_discount_amount bigint not null default 0,
  add constraint invoices_punctuality_discount_nonnegative
    check (punctuality_discount_amount >= 0);

-- The reminder table uses a composite tenant-aware foreign key. Create its
-- referenced unique key before declaring that foreign key.
create unique index if not exists invoices_institution_id_id_idx
  on public.invoices(institution_id, id);

alter table public.payments
  add column if not exists idempotency_key text,
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by uuid references public.profiles(id),
  add column if not exists reversal_reason text,
  drop constraint if exists payments_method_check,
  add constraint payments_method_check check (method in (
    'MANUAL', 'PIX', 'PIX_AUTOMATIC', 'BOLETO', 'CREDIT_CARD',
    'CASH', 'BANK_TRANSFER', 'CARD_TERMINAL', 'OTHER'
  )),
  add constraint payments_idempotency_key_valid
    check (idempotency_key is null or length(btrim(idempotency_key)) between 8 and 160),
  add constraint payments_reversal_details_consistent
    check (status = 'REVERSED' or (reversed_at is null and reversed_by is null and reversal_reason is null));

create unique index if not exists payments_institution_idempotency_idx
  on public.payments(institution_id, idempotency_key)
  where idempotency_key is not null;

create table public.finance_expense_categories (
  id uuid primary key default extensions.uuid_generate_v4(),
  name text not null unique,
  active boolean not null default true,
  sort_order integer not null default 0
);

insert into public.finance_expense_categories(name, sort_order) values
  ('Energia', 10), ('Água', 20), ('Internet', 30), ('Aluguel', 40),
  ('Manutenção', 50), ('Materiais', 60), ('Serviços', 70),
  ('Fornecedores', 80), ('Pessoal', 90), ('Outras despesas', 100)
on conflict (name) do nothing;

create table public.finance_suppliers (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 180),
  tax_id text,
  contact text,
  active boolean not null default true,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, id),
  check (length(btrim(coalesce(tax_id, ''))) <= 32),
  check (length(btrim(coalesce(contact, ''))) <= 240)
);
create unique index finance_suppliers_institution_name_idx
  on public.finance_suppliers(institution_id, lower(name));

create table public.finance_expenses (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  category_id uuid not null references public.finance_expense_categories(id),
  supplier_id uuid,
  supplier_name_snapshot text,
  description text not null check (length(btrim(description)) between 3 and 240),
  amount_cents bigint not null check (amount_cents > 0),
  competence_date date not null check (extract(day from competence_date) = 1),
  due_date date not null,
  status text not null default 'OPEN'
    check (status in ('OPEN', 'OVERDUE', 'PAID', 'CANCELLED', 'REVERSED')),
  paid_at timestamptz,
  payment_method text check (payment_method is null or payment_method in (
    'MANUAL', 'PIX', 'BOLETO', 'CREDIT_CARD', 'CASH', 'BANK_TRANSFER', 'CARD_TERMINAL', 'OTHER'
  )),
  payment_idempotency_key text,
  recurrence_group_id uuid,
  recurrence_index integer not null default 1 check (recurrence_index between 1 and 24),
  document_path text,
  notes text,
  idempotency_key text not null check (length(btrim(idempotency_key)) between 8 and 160),
  reversed_at timestamptz,
  reversed_by uuid references public.profiles(id),
  reversal_reason text,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (institution_id, supplier_id)
    references public.finance_suppliers(institution_id, id),
  unique (institution_id, idempotency_key),
  unique (institution_id, payment_idempotency_key),
  constraint finance_expense_payment_state_consistent check (
    (status in ('PAID', 'REVERSED') and paid_at is not null and payment_method is not null)
    or (status not in ('PAID', 'REVERSED') and paid_at is null and payment_method is null)
  ),
  constraint finance_expense_reversal_state_consistent check (
    (status = 'REVERSED' and reversed_at is not null and reversed_by is not null and reversal_reason is not null)
    or (status <> 'REVERSED' and reversed_at is null and reversed_by is null and reversal_reason is null)
  )
);

create table public.finance_settings (
  institution_id uuid primary key references public.institutions(id) on delete cascade,
  default_due_day integer not null default 10 check (default_due_day between 1 and 31),
  opening_balance_cents bigint not null default 0,
  opening_balance_date date not null default current_date,
  reminder_days_before integer not null default 3 check (reminder_days_before between 0 and 60),
  reminder_days_after integer not null default 1 check (reminder_days_after between 0 and 90),
  in_app_reminders_enabled boolean not null default false,
  external_reminders_enabled boolean not null default false,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  check (opening_balance_cents between -9000000000000000 and 9000000000000000)
);

create table public.finance_audit_events (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  idempotency_key text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (institution_id, idempotency_key)
);

create table public.finance_reminder_drafts (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  invoice_id uuid not null,
  recipient_profile_id uuid not null references public.profiles(id),
  reminder_type text not null check (reminder_type in ('UPCOMING', 'OVERDUE')),
  cycle_date date not null default current_date,
  due_date_snapshot date not null,
  balance_cents_snapshot bigint not null check (balance_cents_snapshot > 0),
  message text not null check (length(btrim(message)) between 10 and 1000),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'CANCELLED')),
  idempotency_key text not null check (length(btrim(idempotency_key)) between 8 and 160),
  prepared_by uuid not null references public.profiles(id),
  prepared_at timestamptz not null default now(),
  unique (institution_id, idempotency_key),
  unique (institution_id, invoice_id, reminder_type, cycle_date),
  foreign key (institution_id, invoice_id) references public.invoices(institution_id, id) on delete restrict
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('finance-documents', 'finance-documents', false, 10485760,
  array['application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create index finance_suppliers_institution_active_idx
  on public.finance_suppliers(institution_id, active, name);
create index finance_expenses_institution_due_status_idx
  on public.finance_expenses(institution_id, due_date, status);
create index finance_expenses_institution_competence_idx
  on public.finance_expenses(institution_id, competence_date);
create index finance_payments_institution_paid_at_idx
  on public.payments(institution_id, paid_at desc) where status = 'PAID';
create index finance_audit_events_entity_idx
  on public.finance_audit_events(institution_id, entity_type, entity_id, created_at desc);
create index finance_reminder_drafts_institution_idx
  on public.finance_reminder_drafts(institution_id, prepared_at desc);

create or replace function private.finance_can_manage(target_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_super_admin()
    or (
      exists (
        select 1 from public.institutions institution
        where institution.id = target_institution_id
          and institution.plan = 'PROFESSIONAL'::public.institution_plan
      )
      and private.has_exact_institution_role(
        target_institution_id,
        array['ADMIN', 'DIRECTOR', 'SECRETARY']::public.user_role[]
      )
    );
$$;

revoke all on function private.finance_can_manage(uuid) from public, anon;
grant execute on function private.finance_can_manage(uuid) to authenticated, service_role;

alter table public.finance_expense_categories enable row level security;
alter table public.finance_suppliers enable row level security;
alter table public.finance_expenses enable row level security;
alter table public.finance_settings enable row level security;
alter table public.finance_audit_events enable row level security;
alter table public.finance_reminder_drafts enable row level security;

drop policy if exists finance_contract_staff on public.financial_contracts;
create policy finance_contract_staff_read on public.financial_contracts
  for select to authenticated using (private.finance_can_manage(institution_id));
drop policy if exists finance_invoice_staff on public.invoices;
create policy finance_invoice_staff_read on public.invoices
  for select to authenticated using (private.finance_can_manage(institution_id));
drop policy if exists finance_payment_staff on public.payments;
create policy finance_payment_staff_read on public.payments
  for select to authenticated using (private.finance_can_manage(institution_id));

drop policy if exists finance_adjustment_staff_read on public.financial_contract_adjustments;
create policy finance_adjustment_staff_read on public.financial_contract_adjustments
  for select to authenticated using (private.finance_can_manage(institution_id));
drop policy if exists finance_adjustment_guardian_read on public.financial_contract_adjustments;
create policy finance_adjustment_guardian_read on public.financial_contract_adjustments
  for select to authenticated using (
    exists (
      select 1 from public.financial_contracts contract
      where contract.id = financial_contract_adjustments.contract_id
        and contract.institution_id = financial_contract_adjustments.institution_id
        and contract.financial_responsible_profile_id = auth.uid()
    )
  );
create policy finance_expense_category_read on public.finance_expense_categories
  for select to authenticated using (active);
create policy finance_supplier_staff_read on public.finance_suppliers
  for select to authenticated using (private.finance_can_manage(institution_id));
create policy finance_expense_staff_read on public.finance_expenses
  for select to authenticated using (private.finance_can_manage(institution_id));
create policy finance_settings_staff_read on public.finance_settings
  for select to authenticated using (private.finance_can_manage(institution_id));
create policy finance_audit_staff_read on public.finance_audit_events
  for select to authenticated using (private.finance_can_manage(institution_id));
create policy finance_reminder_draft_staff_read on public.finance_reminder_drafts
  for select to authenticated using (private.finance_can_manage(institution_id));

drop policy if exists finance_documents_staff_insert on storage.objects;
create policy finance_documents_staff_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'finance-documents'
    and split_part(name, '/', 2) <> ''
    and split_part(name, '/', 3) = ''
    and exists (select 1 from public.institutions institution
      where institution.id::text = split_part(name, '/', 1)
        and private.finance_can_manage(institution.id))
  );
drop policy if exists finance_documents_staff_read on storage.objects;
create policy finance_documents_staff_read on storage.objects
  for select to authenticated using (
    bucket_id = 'finance-documents'
    and split_part(name, '/', 2) <> ''
    and split_part(name, '/', 3) = ''
    and exists (select 1 from public.institutions institution
      where institution.id::text = split_part(name, '/', 1)
        and private.finance_can_manage(institution.id))
  );
drop policy if exists finance_documents_staff_delete on storage.objects;
create policy finance_documents_staff_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'finance-documents'
    and split_part(name, '/', 2) <> ''
    and split_part(name, '/', 3) = ''
    and exists (select 1 from public.institutions institution
      where institution.id::text = split_part(name, '/', 1)
        and private.finance_can_manage(institution.id))
  );

revoke insert, update, delete on public.financial_contracts, public.financial_contract_adjustments,
  public.invoices, public.payments from authenticated, anon;
grant select on public.financial_contracts, public.financial_contract_adjustments,
  public.invoices, public.payments to authenticated;
revoke all on public.finance_expense_categories, public.finance_suppliers,
  public.finance_expenses, public.finance_settings, public.finance_audit_events from anon;
revoke all on public.finance_reminder_drafts from anon;
grant select on public.finance_expense_categories, public.finance_suppliers,
  public.finance_expenses, public.finance_settings, public.finance_audit_events,
  public.finance_reminder_drafts to authenticated;

create or replace function private.finance_invoice_amount_due_now(target_invoice_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    0,
    invoice.base_amount - invoice.discount_amount - invoice.scholarship_amount
      + greatest(
          invoice.fine_amount,
          case when current_date > invoice.due_date + contract.grace_days
            then round(
              greatest(0, invoice.base_amount - invoice.discount_amount - invoice.scholarship_amount)
              * contract.fine_rate_bps::numeric / 10000
            )::bigint else 0 end
        )
      + greatest(
          invoice.interest_amount,
          case when current_date > invoice.due_date + contract.grace_days
            then round(
              greatest(0, invoice.base_amount - invoice.discount_amount - invoice.scholarship_amount)
              * contract.monthly_interest_rate_bps::numeric
              * (current_date - invoice.due_date - contract.grace_days)::numeric / 300000
            )::bigint else 0 end
        )
  )::bigint
  from public.invoices invoice
  join public.financial_contracts contract
    on contract.id = invoice.contract_id
   and contract.institution_id = invoice.institution_id
  where invoice.id = target_invoice_id;
$$;
revoke all on function private.finance_invoice_amount_due_now(uuid) from public, anon;
grant execute on function private.finance_invoice_amount_due_now(uuid) to authenticated, service_role;

create or replace function public.finance_create_contract_v2(
  p_institution_id uuid,
  p_student_id uuid,
  p_enrollment_id uuid,
  p_academic_year_id uuid,
  p_responsible_profile_id uuid,
  p_monthly_amount_cents bigint,
  p_enrollment_fee_cents bigint,
  p_installment_count integer,
  p_first_due_date date,
  p_due_day integer,
  p_scholarship_per_installment_cents bigint,
  p_discount_per_installment_cents bigint,
  p_punctuality_discount_cents bigint,
  p_fine_rate_bps integer,
  p_monthly_interest_rate_bps integer,
  p_grace_days integer,
  p_notes text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_contract_id uuid;
  v_invoice_ids uuid[] := array[]::uuid[];
  v_due date;
  v_month date;
  v_invoice_id uuid;
  v_index integer;
  v_existing public.financial_contracts%rowtype;
begin
  if v_actor is null or not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  if length(btrim(coalesce(p_idempotency_key, ''))) not between 8 and 160 then
    raise exception using errcode = '22023', message = 'FINANCE_INVALID_IDEMPOTENCY_KEY';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_institution_id::text || ':' || btrim(p_idempotency_key), 0));
  if coalesce(p_monthly_amount_cents, 0) <= 0
    or coalesce(p_enrollment_fee_cents, -1) < 0
    or coalesce(p_installment_count, 0) not between 1 and 60
    or coalesce(p_due_day, 0) not between 1 and 31
    or coalesce(p_scholarship_per_installment_cents, -1) < 0
    or coalesce(p_discount_per_installment_cents, -1) < 0
    or coalesce(p_punctuality_discount_cents, -1) < 0
    or p_scholarship_per_installment_cents + p_discount_per_installment_cents > p_monthly_amount_cents
    or p_punctuality_discount_cents > p_monthly_amount_cents - p_scholarship_per_installment_cents - p_discount_per_installment_cents
    or coalesce(p_fine_rate_bps, -1) not between 0 and 10000
    or coalesce(p_monthly_interest_rate_bps, -1) not between 0 and 10000
    or coalesce(p_grace_days, -1) not between 0 and 365
    or p_first_due_date is null
  then raise exception using errcode = '22023', message = 'FINANCE_INVALID_CONTRACT_TERMS'; end if;
  if p_monthly_amount_cents::numeric * p_installment_count + p_enrollment_fee_cents > 9000000000000000 then
    raise exception using errcode = '22003', message = 'FINANCE_CONTRACT_AMOUNT_TOO_LARGE';
  end if;

  select * into v_existing from public.financial_contracts contract
   where contract.institution_id = p_institution_id
     and contract.idempotency_key = btrim(p_idempotency_key);
  if found then
    if v_existing.student_id <> p_student_id
      or v_existing.enrollment_id is distinct from p_enrollment_id
      or v_existing.academic_year_id <> p_academic_year_id
      or v_existing.financial_responsible_profile_id <> p_responsible_profile_id
      or v_existing.monthly_amount_cents <> p_monthly_amount_cents
      or v_existing.enrollment_fee_amount <> p_enrollment_fee_cents
      or v_existing.installment_count <> p_installment_count
      or v_existing.first_due_date <> p_first_due_date
      or v_existing.default_due_day <> p_due_day
      or v_existing.scholarship_per_installment_cents <> p_scholarship_per_installment_cents
      or v_existing.discount_per_installment_cents <> p_discount_per_installment_cents
      or v_existing.punctuality_discount_cents <> p_punctuality_discount_cents
      or v_existing.fine_rate_bps <> p_fine_rate_bps
      or v_existing.monthly_interest_rate_bps <> p_monthly_interest_rate_bps
      or v_existing.grace_days <> p_grace_days
      or v_existing.notes is distinct from nullif(btrim(coalesce(p_notes, '')), '') then
      raise exception using errcode = '22023', message = 'FINANCE_IDEMPOTENCY_MISMATCH';
    end if;
    select coalesce(array_agg(invoice.id order by invoice.sequence_number), array[]::uuid[])
      into v_invoice_ids from public.invoices invoice where invoice.contract_id = v_existing.id;
    return jsonb_build_object('contract_id', v_existing.id, 'invoice_ids', v_invoice_ids, 'replayed', true);
  end if;

  if not exists (select 1 from public.students student
    where student.id = p_student_id and student.institution_id = p_institution_id and student.active) then
    raise exception using errcode = '23503', message = 'FINANCE_STUDENT_NOT_IN_INSTITUTION';
  end if;
  if not exists (select 1 from public.academic_years year
    where year.id = p_academic_year_id and year.institution_id = p_institution_id) then
    raise exception using errcode = '23503', message = 'FINANCE_YEAR_NOT_IN_INSTITUTION';
  end if;
  if p_enrollment_id is not null and not exists (
    select 1 from public.enrollments enrollment
    join public.classes class on class.id = enrollment.class_id
    where enrollment.id = p_enrollment_id and enrollment.student_id = p_student_id
      and enrollment.academic_year_id = p_academic_year_id and enrollment.active
      and class.institution_id = p_institution_id
  ) then raise exception using errcode = '23503', message = 'FINANCE_ENROLLMENT_MISMATCH'; end if;
  if not exists (
    select 1 from public.guardianships guardianship
    join public.profiles guardian on guardian.id = guardianship.guardian_profile_id
      and guardian.active and guardian.role = 'GUARDIAN'::public.user_role
    join public.memberships membership on membership.profile_id = guardian.id
      and membership.institution_id = p_institution_id and membership.active
      and membership.role = 'GUARDIAN'::public.user_role
    where guardianship.student_id = p_student_id
      and guardianship.guardian_profile_id = p_responsible_profile_id and guardianship.active
  ) then
    raise exception using errcode = '23503', message = 'FINANCE_RESPONSIBLE_NOT_LINKED_TO_STUDENT';
  end if;

  insert into public.financial_contracts(
    institution_id, student_id, enrollment_id, academic_year_id,
    financial_responsible_profile_id, status, base_amount, enrollment_fee_amount,
    installment_count, first_due_date, default_due_day, notes, idempotency_key,
    monthly_amount_cents, scholarship_per_installment_cents,
    discount_per_installment_cents, punctuality_discount_cents,
    fine_rate_bps, monthly_interest_rate_bps, grace_days, created_by
  ) values (
    p_institution_id, p_student_id, p_enrollment_id, p_academic_year_id,
    p_responsible_profile_id, 'ACTIVE',
    p_monthly_amount_cents * p_installment_count + p_enrollment_fee_cents,
    p_enrollment_fee_cents, p_installment_count, p_first_due_date,
    p_due_day, nullif(btrim(coalesce(p_notes, '')), ''), btrim(p_idempotency_key),
    p_monthly_amount_cents, p_scholarship_per_installment_cents,
    p_discount_per_installment_cents, p_punctuality_discount_cents,
    p_fine_rate_bps, p_monthly_interest_rate_bps, p_grace_days, v_actor
  ) returning id into v_contract_id;

  for v_index in 1..p_installment_count loop
    if v_index = 1 then
      v_due := p_first_due_date;
    else
      v_month := (date_trunc('month', p_first_due_date) + make_interval(months => v_index - 1))::date;
      v_due := make_date(
        extract(year from v_month)::integer,
        extract(month from v_month)::integer,
        least(p_due_day, extract(day from (v_month + interval '1 month' - interval '1 day'))::integer)
      );
    end if;
    insert into public.invoices(
      institution_id, contract_id, student_id, financial_responsible_profile_id,
      reference, due_date, base_amount, discount_amount, scholarship_amount,
      punctuality_discount_amount, sequence_number
    ) values (
      p_institution_id, v_contract_id, p_student_id, p_responsible_profile_id,
      'Parcela ' || v_index || '/' || p_installment_count,
      v_due,
      p_monthly_amount_cents + case when v_index = 1 then p_enrollment_fee_cents else 0 end,
      p_discount_per_installment_cents,
      p_scholarship_per_installment_cents,
      p_punctuality_discount_cents,
      v_index
    ) returning id into v_invoice_id;
    v_invoice_ids := array_append(v_invoice_ids, v_invoice_id);
  end loop;

  if p_scholarship_per_installment_cents > 0 then
    insert into public.financial_contract_adjustments(institution_id, contract_id, type, mode, value, description, starts_at)
    values (p_institution_id, v_contract_id, 'SCHOLARSHIP', 'FIXED', p_scholarship_per_installment_cents,
      'Bolsa mensal por parcela (centavos)', p_first_due_date);
  end if;
  if p_discount_per_installment_cents > 0 then
    insert into public.financial_contract_adjustments(institution_id, contract_id, type, mode, value, description, starts_at)
    values (p_institution_id, v_contract_id, 'DISCOUNT', 'FIXED', p_discount_per_installment_cents,
      'Desconto mensal por parcela (centavos)', p_first_due_date);
  end if;
  if p_punctuality_discount_cents > 0 then
    insert into public.financial_contract_adjustments(institution_id, contract_id, type, mode, value, description, starts_at)
    values (p_institution_id, v_contract_id, 'PUNCTUALITY_DISCOUNT', 'FIXED', p_punctuality_discount_cents,
      'Desconto de pontualidade, aplicado na quitação até o vencimento (centavos)', p_first_due_date);
  end if;
  insert into public.finance_audit_events(institution_id, actor_id, action, entity_type, entity_id, idempotency_key, details)
  values (p_institution_id, v_actor, 'CONTRACT_CREATED', 'CONTRACT', v_contract_id,
    'contract:' || btrim(p_idempotency_key), jsonb_build_object(
      'student_id', p_student_id, 'invoice_count', p_installment_count,
      'monthly_amount_cents', p_monthly_amount_cents,
      'installment_total_cents', p_monthly_amount_cents * p_installment_count + p_enrollment_fee_cents
    ));
  return jsonb_build_object('contract_id', v_contract_id, 'invoice_ids', v_invoice_ids, 'replayed', false);
end;
$$;

create or replace function public.finance_set_contract_status_v2(
  p_institution_id uuid, p_contract_id uuid, p_status text, p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_current text;
begin
  if v_actor is null or not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  if p_status not in ('ACTIVE', 'SUSPENDED', 'CANCELLED', 'COMPLETED') then
    raise exception using errcode = '22023', message = 'FINANCE_INVALID_CONTRACT_STATUS';
  end if;
  select status::text into v_current from public.financial_contracts
   where id = p_contract_id and institution_id = p_institution_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'FINANCE_CONTRACT_NOT_FOUND'; end if;
  if v_current = 'CANCELLED' and p_status <> 'CANCELLED' then
    raise exception using errcode = '22023', message = 'FINANCE_CANCELLED_CONTRACT_IS_FINAL';
  end if;
  if v_current <> p_status then
    update public.financial_contracts set status = p_status::public.financial_contract_status, updated_at = now()
     where id = p_contract_id and institution_id = p_institution_id;
    insert into public.finance_audit_events(institution_id, actor_id, action, entity_type, entity_id, details)
    values (p_institution_id, v_actor, 'CONTRACT_STATUS_CHANGED', 'CONTRACT', p_contract_id,
      jsonb_build_object('from', v_current, 'to', p_status, 'reason', nullif(btrim(coalesce(p_reason, '')), '')));
  end if;
  return p_contract_id;
end;
$$;

create or replace function public.finance_update_contract_terms_v2(
  p_institution_id uuid, p_contract_id uuid, p_monthly_amount_cents bigint,
  p_scholarship_per_installment_cents bigint, p_discount_per_installment_cents bigint,
  p_punctuality_discount_cents bigint, p_fine_rate_bps integer,
  p_monthly_interest_rate_bps integer, p_grace_days integer, p_notes text, p_reason text
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_contract public.financial_contracts%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_adjusted integer;
begin
  if v_actor is null or not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  if p_monthly_amount_cents <= 0
    or p_scholarship_per_installment_cents < 0
    or p_discount_per_installment_cents < 0
    or p_punctuality_discount_cents < 0
    or p_scholarship_per_installment_cents + p_discount_per_installment_cents > p_monthly_amount_cents
    or p_punctuality_discount_cents > p_monthly_amount_cents - p_scholarship_per_installment_cents - p_discount_per_installment_cents
    or p_fine_rate_bps not between 0 and 10000
    or p_monthly_interest_rate_bps not between 0 and 10000
    or p_grace_days not between 0 and 365
    or length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception using errcode = '22023', message = 'FINANCE_INVALID_CONTRACT_TERMS';
  end if;
  select * into v_contract from public.financial_contracts contract
   where contract.id = p_contract_id and contract.institution_id = p_institution_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'FINANCE_CONTRACT_NOT_FOUND'; end if;
  if v_contract.status in ('CANCELLED', 'COMPLETED') then
    raise exception using errcode = '22023', message = 'FINANCE_CONTRACT_NOT_EDITABLE';
  end if;

  v_before := jsonb_build_object(
    'monthly_amount_cents', v_contract.monthly_amount_cents,
    'scholarship_per_installment_cents', v_contract.scholarship_per_installment_cents,
    'discount_per_installment_cents', v_contract.discount_per_installment_cents,
    'punctuality_discount_cents', v_contract.punctuality_discount_cents,
    'fine_rate_bps', v_contract.fine_rate_bps,
    'monthly_interest_rate_bps', v_contract.monthly_interest_rate_bps,
    'grace_days', v_contract.grace_days, 'notes', v_contract.notes
  );
  update public.financial_contracts set
    monthly_amount_cents = p_monthly_amount_cents,
    base_amount = p_monthly_amount_cents * installment_count + enrollment_fee_amount,
    scholarship_per_installment_cents = p_scholarship_per_installment_cents,
    discount_per_installment_cents = p_discount_per_installment_cents,
    punctuality_discount_cents = p_punctuality_discount_cents,
    fine_rate_bps = p_fine_rate_bps,
    monthly_interest_rate_bps = p_monthly_interest_rate_bps,
    grace_days = p_grace_days,
    notes = nullif(btrim(coalesce(p_notes, '')), ''), updated_at = now()
   where id = p_contract_id and institution_id = p_institution_id;

  update public.invoices set
    base_amount = p_monthly_amount_cents + case when sequence_number = 1 then v_contract.enrollment_fee_amount else 0 end,
    scholarship_amount = p_scholarship_per_installment_cents,
    discount_amount = p_discount_per_installment_cents,
    punctuality_discount_amount = p_punctuality_discount_cents,
    fine_amount = 0, interest_amount = 0, updated_at = now()
   where contract_id = p_contract_id and institution_id = p_institution_id
     and amount_paid = 0 and status in ('OPEN', 'OVERDUE');
  get diagnostics v_adjusted = row_count;

  v_after := jsonb_build_object(
    'monthly_amount_cents', p_monthly_amount_cents,
    'scholarship_per_installment_cents', p_scholarship_per_installment_cents,
    'discount_per_installment_cents', p_discount_per_installment_cents,
    'punctuality_discount_cents', p_punctuality_discount_cents,
    'fine_rate_bps', p_fine_rate_bps,
    'monthly_interest_rate_bps', p_monthly_interest_rate_bps,
    'grace_days', p_grace_days, 'notes', nullif(btrim(coalesce(p_notes, '')), ''),
    'unpaid_invoices_updated', v_adjusted, 'reason', btrim(p_reason)
  );
  insert into public.finance_audit_events(institution_id, actor_id, action, entity_type, entity_id, details)
  values (p_institution_id, v_actor, 'CONTRACT_TERMS_CHANGED', 'CONTRACT', p_contract_id,
    jsonb_build_object('before', v_before, 'after', v_after));
  return jsonb_build_object('contract_id', p_contract_id, 'unpaid_invoices_updated', v_adjusted);
end;
$$;

create or replace function private.finance_sync_payment_balance_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_delta bigint;
  v_expected_invoice_id uuid;
  v_expected_institution_id uuid;
begin
  if tg_op = 'UPDATE' then
    v_expected_invoice_id := old.invoice_id;
    v_expected_institution_id := old.institution_id;
    if new.institution_id <> old.institution_id or new.invoice_id <> old.invoice_id
      or new.provider <> old.provider or new.method <> old.method or new.amount <> old.amount
      or new.paid_at is distinct from old.paid_at or new.idempotency_key is distinct from old.idempotency_key then
      raise exception using errcode = '22023', message = 'FINANCE_PAYMENT_HISTORY_IS_IMMUTABLE';
    end if;
    if old.status <> 'PAID' or new.status <> 'REVERSED' then
      raise exception using errcode = '22023', message = 'FINANCE_INVALID_PAYMENT_TRANSITION';
    end if;
    v_delta := -old.amount;
  else
    v_expected_invoice_id := new.invoice_id;
    v_expected_institution_id := new.institution_id;
    if new.provider <> 'MANUAL' or new.status <> 'PAID' or new.paid_at is null
      or new.amount <= 0 or new.idempotency_key is null then
      raise exception using errcode = '22023', message = 'FINANCE_INVALID_MANUAL_PAYMENT';
    end if;
    v_delta := new.amount;
  end if;

  select * into v_invoice from public.invoices invoice
   where invoice.id = v_expected_invoice_id
   for update;
  if not found or v_invoice.institution_id <> v_expected_institution_id then
    raise exception using errcode = '23503', message = 'FINANCE_PAYMENT_INVOICE_MISMATCH';
  end if;
  if tg_op = 'INSERT' and (v_invoice.status = 'CANCELLED' or v_invoice.status = 'DRAFT') then
    raise exception using errcode = '22023', message = 'FINANCE_INVOICE_NOT_PAYABLE';
  end if;
  if tg_op = 'INSERT' and new.amount > greatest(0, private.finance_invoice_amount_due_now(v_invoice.id) - v_invoice.amount_paid) then
    raise exception using errcode = '22023', message = 'FINANCE_PAYMENT_EXCEEDS_OPEN_BALANCE';
  end if;
  if tg_op = 'UPDATE' and v_invoice.amount_paid < old.amount then
    raise exception using errcode = '22023', message = 'FINANCE_PAYMENT_BALANCE_INCONSISTENT';
  end if;

  update public.invoices invoice set
    amount_paid = greatest(0, invoice.amount_paid + v_delta),
    status = case
      when greatest(0, invoice.amount_paid + v_delta) >= private.finance_invoice_amount_due_now(invoice.id) then 'PAID'::public.invoice_status
      when greatest(0, invoice.amount_paid + v_delta) > 0 then 'PARTIALLY_PAID'::public.invoice_status
      when invoice.due_date < current_date then 'OVERDUE'::public.invoice_status
      else 'OPEN'::public.invoice_status
    end,
    updated_at = now()
  where invoice.id = v_invoice.id;
  if tg_op = 'UPDATE' then new.reversed_at := now(); end if;
  return new;
end;
$$;

drop trigger if exists finance_sync_payment_balance_v2 on public.payments;
create trigger finance_sync_payment_balance_v2
before insert or update of status, amount, invoice_id, institution_id, provider, method, paid_at, idempotency_key
on public.payments for each row execute function private.finance_sync_payment_balance_v2();

create or replace function public.finance_register_manual_receipt_v2(
  p_institution_id uuid, p_invoice_id uuid, p_amount_cents bigint,
  p_method text, p_paid_at timestamptz, p_notes text, p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_invoice public.invoices%rowtype;
  v_contract public.financial_contracts%rowtype;
  v_payment public.payments%rowtype;
  v_payment_id uuid;
  v_principal bigint;
  v_days_late integer;
  v_fine bigint;
  v_interest bigint;
  v_due_now bigint;
  v_open_balance bigint;
begin
  if v_actor is null or not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  if coalesce(p_amount_cents, 0) <= 0 or length(btrim(coalesce(p_idempotency_key, ''))) not between 8 and 160
    or p_method not in ('MANUAL', 'PIX', 'BOLETO', 'CREDIT_CARD', 'CASH', 'BANK_TRANSFER', 'CARD_TERMINAL', 'OTHER')
    or p_paid_at is null or p_paid_at > now() + interval '1 minute' then
    raise exception using errcode = '22023', message = 'FINANCE_INVALID_RECEIPT';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_institution_id::text || ':' || btrim(p_idempotency_key), 0));

  select * into v_invoice from public.invoices invoice
   where invoice.id = p_invoice_id and invoice.institution_id = p_institution_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'FINANCE_INVOICE_NOT_FOUND'; end if;
  select * into v_payment from public.payments payment
   where payment.institution_id = p_institution_id and payment.idempotency_key = btrim(p_idempotency_key);
  if found then
    if v_payment.invoice_id <> p_invoice_id or v_payment.amount <> p_amount_cents
      or v_payment.method <> p_method or v_payment.paid_at is distinct from p_paid_at
      or v_payment.notes is distinct from nullif(btrim(coalesce(p_notes, '')), '') then
      raise exception using errcode = '22023', message = 'FINANCE_IDEMPOTENCY_MISMATCH';
    end if;
    return jsonb_build_object('payment_id', v_payment.id, 'invoice_id', p_invoice_id, 'replayed', true);
  end if;
  if v_invoice.status in ('DRAFT', 'CANCELLED', 'PAID') then
    raise exception using errcode = '22023', message = 'FINANCE_INVOICE_NOT_PAYABLE';
  end if;
  select * into v_contract from public.financial_contracts contract
   where contract.id = v_invoice.contract_id and contract.institution_id = p_institution_id;
  v_principal := greatest(0, v_invoice.base_amount - v_invoice.discount_amount - v_invoice.scholarship_amount);
  v_days_late := greatest(0, p_paid_at::date - v_invoice.due_date - v_contract.grace_days);
  v_fine := case when v_days_late > 0 then greatest(v_invoice.fine_amount,
    round(v_principal::numeric * v_contract.fine_rate_bps / 10000)::bigint) else v_invoice.fine_amount end;
  v_interest := case when v_days_late > 0 then greatest(v_invoice.interest_amount,
    round(v_principal::numeric * v_contract.monthly_interest_rate_bps * v_days_late / 300000)::bigint) else v_invoice.interest_amount end;
  update public.invoices set fine_amount = v_fine, interest_amount = v_interest, updated_at = now()
   where id = p_invoice_id;
  v_due_now := greatest(0, v_principal + v_fine + v_interest);
  v_open_balance := greatest(0, v_due_now - v_invoice.amount_paid);

  if p_paid_at::date <= v_invoice.due_date and v_invoice.punctuality_discount_amount > 0
    and p_amount_cents = greatest(0, v_open_balance - v_invoice.punctuality_discount_amount) then
    update public.invoices set discount_amount = discount_amount + punctuality_discount_amount
     where id = p_invoice_id;
    insert into public.finance_audit_events(institution_id, actor_id, action, entity_type, entity_id, details)
    values (p_institution_id, v_actor, 'PUNCTUALITY_DISCOUNT_APPLIED', 'INVOICE', p_invoice_id,
      jsonb_build_object('discount_cents', v_invoice.punctuality_discount_amount));
    v_due_now := greatest(0, v_due_now - v_invoice.punctuality_discount_amount);
    v_open_balance := greatest(0, v_due_now - v_invoice.amount_paid);
  end if;
  if p_amount_cents > v_open_balance then
    raise exception using errcode = '22023', message = 'FINANCE_PAYMENT_EXCEEDS_OPEN_BALANCE';
  end if;

  insert into public.payments(
    institution_id, invoice_id, provider, method, amount, status, paid_at,
    registered_by, notes, idempotency_key
  ) values (
    p_institution_id, p_invoice_id, 'MANUAL', p_method, p_amount_cents, 'PAID', p_paid_at,
    v_actor, nullif(btrim(coalesce(p_notes, '')), ''), btrim(p_idempotency_key)
  ) on conflict (institution_id, idempotency_key) where idempotency_key is not null do nothing
    returning id into v_payment_id;
  if v_payment_id is null then
    select id into v_payment_id from public.payments
     where institution_id = p_institution_id and idempotency_key = btrim(p_idempotency_key);
    if not found then raise exception using errcode = '40001', message = 'FINANCE_RECEIPT_RETRY_REQUIRED'; end if;
  end if;
  insert into public.finance_audit_events(institution_id, actor_id, action, entity_type, entity_id, idempotency_key, details)
  values (p_institution_id, v_actor, 'PAYMENT_RECEIVED', 'PAYMENT', v_payment_id,
    'receipt:' || btrim(p_idempotency_key), jsonb_build_object(
      'invoice_id', p_invoice_id, 'amount_cents', p_amount_cents, 'method', p_method,
      'administrative_receipt_only', true
    ));
  return jsonb_build_object('payment_id', v_payment_id, 'invoice_id', p_invoice_id, 'replayed', false);
end;
$$;

create or replace function public.finance_reverse_payment_v2(
  p_institution_id uuid, p_payment_id uuid, p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_payment public.payments%rowtype;
begin
  if v_actor is null or not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception using errcode = '22023', message = 'FINANCE_REVERSAL_REASON_REQUIRED';
  end if;
  select * into v_payment from public.payments payment
   where payment.id = p_payment_id and payment.institution_id = p_institution_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'FINANCE_PAYMENT_NOT_FOUND'; end if;
  if v_payment.status = 'REVERSED' then return p_payment_id; end if;
  update public.payments set status = 'REVERSED', reversed_at = now(), reversed_by = v_actor,
    reversal_reason = btrim(p_reason) where id = p_payment_id;
  insert into public.finance_audit_events(institution_id, actor_id, action, entity_type, entity_id, idempotency_key, details)
  values (p_institution_id, v_actor, 'PAYMENT_REVERSED', 'PAYMENT', p_payment_id,
    'reversal:' || p_payment_id::text, jsonb_build_object('amount_cents', v_payment.amount, 'reason', btrim(p_reason)));
  return p_payment_id;
end;
$$;

create or replace function public.finance_create_supplier_v2(
  p_institution_id uuid, p_name text, p_tax_id text, p_contact text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_id uuid;
begin
  if v_actor is null or not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  if length(btrim(coalesce(p_name, ''))) not between 2 and 180 then
    raise exception using errcode = '22023', message = 'FINANCE_INVALID_SUPPLIER';
  end if;
  insert into public.finance_suppliers(institution_id, name, tax_id, contact, created_by)
  values (p_institution_id, btrim(p_name), nullif(btrim(coalesce(p_tax_id, '')), ''),
    nullif(btrim(coalesce(p_contact, '')), ''), v_actor)
  on conflict (institution_id, lower(name)) do update set active = true,
    tax_id = coalesce(excluded.tax_id, finance_suppliers.tax_id),
    contact = coalesce(excluded.contact, finance_suppliers.contact), updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.finance_create_expenses_v2(
  p_institution_id uuid, p_category_id uuid, p_supplier_id uuid,
  p_description text, p_amount_cents bigint, p_competence_date date,
  p_first_due_date date, p_recurrence_count integer, p_notes text,
  p_document_path text, p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid(); v_existing public.finance_expenses%rowtype;
  v_group_id uuid := extensions.uuid_generate_v4(); v_id uuid; v_ids uuid[] := array[]::uuid[];
  v_index integer; v_due date; v_month date; v_supplier_name text;
begin
  if v_actor is null or not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  if p_amount_cents <= 0 or p_recurrence_count not between 1 and 24
    or p_competence_date is null or extract(day from p_competence_date) <> 1
    or p_first_due_date is null or length(btrim(coalesce(p_description, ''))) not between 3 and 240
    or length(btrim(coalesce(p_idempotency_key, ''))) not between 8 and 160 then
    raise exception using errcode = '22023', message = 'FINANCE_INVALID_EXPENSE';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_institution_id::text || ':' || btrim(p_idempotency_key), 0));
  select * into v_existing from public.finance_expenses expense
   where expense.institution_id = p_institution_id and expense.idempotency_key = btrim(p_idempotency_key);
  if found then
    select coalesce(array_agg(id order by recurrence_index), array[]::uuid[]) into v_ids
      from public.finance_expenses where recurrence_group_id = v_existing.recurrence_group_id;
    if cardinality(v_ids) <> p_recurrence_count
      or v_existing.category_id <> p_category_id
      or v_existing.supplier_id is distinct from p_supplier_id
      or v_existing.description <> btrim(p_description)
      or v_existing.amount_cents <> p_amount_cents
      or v_existing.competence_date <> p_competence_date
      or v_existing.due_date <> p_first_due_date
      or v_existing.notes is distinct from nullif(btrim(coalesce(p_notes, '')), '')
      or v_existing.document_path is distinct from nullif(btrim(coalesce(p_document_path, '')), '') then
      raise exception using errcode = '22023', message = 'FINANCE_IDEMPOTENCY_MISMATCH';
    end if;
    return jsonb_build_object('expense_ids', v_ids, 'replayed', true);
  end if;
  if not exists (select 1 from public.finance_expense_categories category
    where category.id = p_category_id and category.active) then
    raise exception using errcode = '23503', message = 'FINANCE_INVALID_EXPENSE_CATEGORY';
  end if;
  if p_supplier_id is not null then
    select name into v_supplier_name from public.finance_suppliers supplier
     where supplier.id = p_supplier_id and supplier.institution_id = p_institution_id and supplier.active;
    if not found then raise exception using errcode = '23503', message = 'FINANCE_SUPPLIER_NOT_IN_INSTITUTION'; end if;
  end if;
  if length(coalesce(p_document_path, '')) > 500 then
    raise exception using errcode = '22023', message = 'FINANCE_INVALID_DOCUMENT_PATH';
  end if;
  if nullif(btrim(coalesce(p_document_path, '')), '') is not null
    and btrim(p_document_path) !~* ('^' || p_institution_id::text || '/[0-9a-f-]{36}\.(pdf|docx?|jpe?g|png|webp)$') then
    raise exception using errcode = '22023', message = 'FINANCE_INVALID_DOCUMENT_PATH';
  end if;
  for v_index in 1..p_recurrence_count loop
    if v_index = 1 then v_due := p_first_due_date;
    else
      v_month := (date_trunc('month', p_first_due_date) + make_interval(months => v_index - 1))::date;
      v_due := make_date(extract(year from v_month)::integer, extract(month from v_month)::integer,
        least(extract(day from p_first_due_date)::integer, extract(day from (v_month + interval '1 month' - interval '1 day'))::integer));
    end if;
    insert into public.finance_expenses(
      institution_id, category_id, supplier_id, supplier_name_snapshot,
      description, amount_cents, competence_date, due_date, recurrence_group_id,
      recurrence_index, document_path, notes, idempotency_key, created_by
    ) values (
      p_institution_id, p_category_id, p_supplier_id, v_supplier_name,
      btrim(p_description), p_amount_cents,
      (date_trunc('month', p_competence_date) + make_interval(months => v_index - 1))::date,
      v_due, v_group_id, v_index, nullif(btrim(coalesce(p_document_path, '')), ''),
      nullif(btrim(coalesce(p_notes, '')), ''),
      case when v_index = 1 then btrim(p_idempotency_key) else btrim(p_idempotency_key) || ':' || v_index end,
      v_actor
    ) returning id into v_id;
    v_ids := array_append(v_ids, v_id);
  end loop;
  insert into public.finance_audit_events(institution_id, actor_id, action, entity_type, entity_id,
    idempotency_key, details)
  values (p_institution_id, v_actor, 'EXPENSES_CREATED', 'EXPENSE', v_ids[1],
    'expenses:' || btrim(p_idempotency_key), jsonb_build_object('count', p_recurrence_count,
      'amount_cents', p_amount_cents, 'recurring', p_recurrence_count > 1));
  return jsonb_build_object('expense_ids', v_ids, 'replayed', false);
end;
$$;

create or replace function public.finance_mark_expense_paid_v2(
  p_institution_id uuid, p_expense_id uuid, p_method text, p_paid_at timestamptz,
  p_idempotency_key text, p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_expense public.finance_expenses%rowtype;
begin
  if v_actor is null or not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  if p_method not in ('MANUAL', 'PIX', 'BOLETO', 'CREDIT_CARD', 'CASH', 'BANK_TRANSFER', 'CARD_TERMINAL', 'OTHER')
    or p_paid_at is null or p_paid_at > now() + interval '1 minute'
    or length(btrim(coalesce(p_idempotency_key, ''))) not between 8 and 160 then
    raise exception using errcode = '22023', message = 'FINANCE_INVALID_EXPENSE_PAYMENT';
  end if;
  select * into v_expense from public.finance_expenses expense
   where expense.id = p_expense_id and expense.institution_id = p_institution_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'FINANCE_EXPENSE_NOT_FOUND'; end if;
  if v_expense.status = 'PAID' then
    if v_expense.payment_idempotency_key = btrim(p_idempotency_key) then return p_expense_id; end if;
    raise exception using errcode = '22023', message = 'FINANCE_EXPENSE_ALREADY_PAID';
  end if;
  if v_expense.status not in ('OPEN', 'OVERDUE') then
    raise exception using errcode = '22023', message = 'FINANCE_EXPENSE_NOT_PAYABLE';
  end if;
  update public.finance_expenses set status = 'PAID', paid_at = p_paid_at, payment_method = p_method,
    payment_idempotency_key = btrim(p_idempotency_key), notes = coalesce(nullif(btrim(coalesce(p_notes, '')), ''), notes), updated_at = now()
   where id = p_expense_id;
  insert into public.finance_audit_events(institution_id, actor_id, action, entity_type, entity_id,
    idempotency_key, details)
  values (p_institution_id, v_actor, 'EXPENSE_PAID', 'EXPENSE', p_expense_id,
    'expense-payment:' || btrim(p_idempotency_key), jsonb_build_object('amount_cents', v_expense.amount_cents, 'method', p_method));
  return p_expense_id;
end;
$$;

create or replace function public.finance_reverse_expense_payment_v2(
  p_institution_id uuid, p_expense_id uuid, p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_expense public.finance_expenses%rowtype;
begin
  if v_actor is null or not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception using errcode = '22023', message = 'FINANCE_REVERSAL_REASON_REQUIRED';
  end if;
  select * into v_expense from public.finance_expenses expense
   where expense.id = p_expense_id and expense.institution_id = p_institution_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'FINANCE_EXPENSE_NOT_FOUND'; end if;
  if v_expense.status = 'REVERSED' then return p_expense_id; end if;
  if v_expense.status <> 'PAID' then raise exception using errcode = '22023', message = 'FINANCE_EXPENSE_NOT_PAID'; end if;
  update public.finance_expenses set status = 'REVERSED',
    reversed_at = now(), reversed_by = v_actor,
    reversal_reason = btrim(p_reason), updated_at = now() where id = p_expense_id;
  insert into public.finance_audit_events(institution_id, actor_id, action, entity_type, entity_id,
    idempotency_key, details)
  values (p_institution_id, v_actor, 'EXPENSE_PAYMENT_REVERSED', 'EXPENSE', p_expense_id,
    'expense-reversal:' || p_expense_id::text, jsonb_build_object('amount_cents', v_expense.amount_cents, 'reason', btrim(p_reason)));
  return p_expense_id;
end;
$$;

create or replace function public.finance_cancel_expense_v2(
  p_institution_id uuid, p_expense_id uuid, p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_expense public.finance_expenses%rowtype;
begin
  if v_actor is null or not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception using errcode = '22023', message = 'FINANCE_CANCELLATION_REASON_REQUIRED';
  end if;
  select * into v_expense from public.finance_expenses expense
   where expense.id = p_expense_id and expense.institution_id = p_institution_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'FINANCE_EXPENSE_NOT_FOUND'; end if;
  if v_expense.status = 'CANCELLED' then return p_expense_id; end if;
  if v_expense.status not in ('OPEN', 'OVERDUE') then
    raise exception using errcode = '22023', message = 'FINANCE_ONLY_UNPAID_EXPENSES_CAN_BE_CANCELLED';
  end if;
  update public.finance_expenses set status = 'CANCELLED', updated_at = now()
   where id = p_expense_id and institution_id = p_institution_id;
  insert into public.finance_audit_events(institution_id, actor_id, action, entity_type, entity_id,
    idempotency_key, details)
  values (p_institution_id, v_actor, 'EXPENSE_CANCELLED', 'EXPENSE', p_expense_id,
    'expense-cancel:' || p_expense_id::text,
    jsonb_build_object('amount_cents', v_expense.amount_cents, 'reason', btrim(p_reason)));
  return p_expense_id;
end;
$$;

create or replace function public.finance_prepare_reminder_v2(
  p_institution_id uuid, p_invoice_id uuid, p_reminder_type text, p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid(); v_invoice public.invoices%rowtype; v_settings public.finance_settings%rowtype;
  v_existing public.finance_reminder_drafts%rowtype; v_id uuid; v_balance bigint;
  v_student_name text; v_responsible_name text; v_message text;
begin
  if v_actor is null or not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  if coalesce(p_reminder_type, '') not in ('UPCOMING', 'OVERDUE')
    or length(btrim(coalesce(p_idempotency_key, ''))) not between 8 and 160 then
    raise exception using errcode = '22023', message = 'FINANCE_INVALID_REMINDER';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_institution_id::text || ':' || btrim(p_idempotency_key), 0));
  select * into v_invoice from public.invoices invoice
   where invoice.id = p_invoice_id and invoice.institution_id = p_institution_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'FINANCE_INVOICE_NOT_FOUND'; end if;
  select * into v_existing from public.finance_reminder_drafts draft
   where draft.institution_id = p_institution_id and draft.idempotency_key = btrim(p_idempotency_key);
  if found then
    if v_existing.invoice_id <> p_invoice_id or v_existing.reminder_type <> p_reminder_type then
      raise exception using errcode = '22023', message = 'FINANCE_IDEMPOTENCY_MISMATCH';
    end if;
    return jsonb_build_object('reminder_id', v_existing.id, 'replayed', true, 'status', v_existing.status);
  end if;
  select * into v_settings from public.finance_settings settings where settings.institution_id = p_institution_id;
  v_balance := greatest(0, private.finance_invoice_amount_due_now(p_invoice_id) - v_invoice.amount_paid);
  if v_invoice.status in ('DRAFT', 'CANCELLED') or v_balance <= 0
    or v_invoice.financial_responsible_profile_id is null then
    raise exception using errcode = '22023', message = 'FINANCE_REMINDER_INVOICE_NOT_ELIGIBLE';
  end if;
  if p_reminder_type = 'UPCOMING' and not (
    v_invoice.due_date between current_date and current_date + coalesce(v_settings.reminder_days_before, 3)
  ) then raise exception using errcode = '22023', message = 'FINANCE_REMINDER_OUTSIDE_WINDOW'; end if;
  if p_reminder_type = 'OVERDUE' and not (
    v_invoice.due_date <= current_date - coalesce(v_settings.reminder_days_after, 1)
  ) then raise exception using errcode = '22023', message = 'FINANCE_REMINDER_OUTSIDE_WINDOW'; end if;
  select student_profile.full_name, responsible.full_name into v_student_name, v_responsible_name
    from public.students student
    join public.profiles student_profile on student_profile.id = student.profile_id
    join public.profiles responsible on responsible.id = v_invoice.financial_responsible_profile_id
   where student.id = v_invoice.student_id and student.institution_id = p_institution_id
     and student.active and responsible.active;
  if not found then raise exception using errcode = '23503', message = 'FINANCE_REMINDER_RECIPIENT_INVALID'; end if;
  v_message := format('Olá, %s. A parcela %s de %s %s em %s. Saldo informado: R$ %s. Esta é uma mensagem administrativa preparada pela escola e ainda não foi enviada.',
    v_responsible_name, v_invoice.reference, v_student_name,
    case when p_reminder_type = 'UPCOMING' then 'vence' else 'venceu' end,
    to_char(v_invoice.due_date, 'DD/MM/YYYY'),
    to_char(v_balance::numeric / 100, 'FM999999999990D00'));
  select draft.id into v_id from public.finance_reminder_drafts draft
   where draft.institution_id = p_institution_id and draft.invoice_id = p_invoice_id
     and draft.reminder_type = p_reminder_type and draft.cycle_date = current_date;
  if found then return jsonb_build_object('reminder_id', v_id, 'replayed', true, 'status', 'DRAFT'); end if;
  insert into public.finance_reminder_drafts(institution_id, invoice_id, recipient_profile_id,
    reminder_type, cycle_date, due_date_snapshot, balance_cents_snapshot, message,
    idempotency_key, prepared_by)
  values (p_institution_id, p_invoice_id, v_invoice.financial_responsible_profile_id,
    p_reminder_type, current_date, v_invoice.due_date, v_balance, v_message,
    btrim(p_idempotency_key), v_actor)
  on conflict (institution_id, invoice_id, reminder_type, cycle_date) do nothing
  returning id into v_id;
  if v_id is null then
    select draft.id into v_id from public.finance_reminder_drafts draft
     where draft.institution_id = p_institution_id and draft.invoice_id = p_invoice_id
       and draft.reminder_type = p_reminder_type and draft.cycle_date = current_date;
    return jsonb_build_object('reminder_id', v_id, 'replayed', true, 'status', 'DRAFT');
  end if;
  insert into public.finance_audit_events(institution_id, actor_id, action, entity_type, entity_id,
    idempotency_key, details)
  values (p_institution_id, v_actor, 'REMINDER_DRAFT_PREPARED', 'REMINDER', v_id,
    'reminder:' || btrim(p_idempotency_key), jsonb_build_object('invoice_id', p_invoice_id,
      'recipient_profile_id', v_invoice.financial_responsible_profile_id,
      'reminder_type', p_reminder_type, 'balance_cents', v_balance, 'delivery', 'NOT_SENT'));
  return jsonb_build_object('reminder_id', v_id, 'replayed', false, 'status', 'DRAFT');
end;
$$;

create or replace function public.finance_list_reminder_drafts_v2(
  p_institution_id uuid, p_page integer, p_page_size integer
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_page integer := greatest(1, coalesce(p_page, 1));
  v_size integer := least(100, greatest(1, coalesce(p_page_size, 20)));
  v_total bigint; v_rows jsonb;
begin
  if not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  select count(*) into v_total from public.finance_reminder_drafts draft
   where draft.institution_id = p_institution_id;
  select coalesce(jsonb_agg(to_jsonb(page_rows) order by prepared_at desc), '[]'::jsonb)
    into v_rows from (
      select draft.id, draft.invoice_id, draft.recipient_profile_id, draft.reminder_type,
        draft.cycle_date, draft.due_date_snapshot, draft.balance_cents_snapshot,
        draft.message, draft.status, draft.prepared_at, draft.prepared_by,
        invoice.reference, recipient.full_name as recipient_name,
        student_profile.full_name as student_name
      from public.finance_reminder_drafts draft
      join public.invoices invoice on invoice.id = draft.invoice_id and invoice.institution_id = draft.institution_id
      join public.students student on student.id = invoice.student_id and student.institution_id = invoice.institution_id
      join public.profiles student_profile on student_profile.id = student.profile_id
      join public.profiles recipient on recipient.id = draft.recipient_profile_id
      where draft.institution_id = p_institution_id
      order by draft.prepared_at desc limit v_size offset (v_page - 1) * v_size
    ) page_rows;
  return jsonb_build_object('rows', v_rows, 'total_count', v_total, 'page', v_page, 'page_size', v_size);
end;
$$;

create or replace function public.finance_update_settings_v2(
  p_institution_id uuid, p_default_due_day integer, p_opening_balance_cents bigint,
  p_opening_balance_date date, p_reminder_days_before integer,
  p_reminder_days_after integer, p_in_app_reminders_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_old public.finance_settings%rowtype;
begin
  if v_actor is null or not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  if p_default_due_day not between 1 and 31 or p_opening_balance_cents not between -9000000000000000 and 9000000000000000
    or p_opening_balance_date is null or p_reminder_days_before not between 0 and 60
    or p_reminder_days_after not between 0 and 90 then
    raise exception using errcode = '22023', message = 'FINANCE_INVALID_SETTINGS';
  end if;
  select * into v_old from public.finance_settings where institution_id = p_institution_id for update;
  insert into public.finance_settings(institution_id, default_due_day, opening_balance_cents,
    opening_balance_date, reminder_days_before, reminder_days_after,
    in_app_reminders_enabled, external_reminders_enabled, updated_by, updated_at)
  values (p_institution_id, p_default_due_day, p_opening_balance_cents, p_opening_balance_date,
    p_reminder_days_before, p_reminder_days_after, p_in_app_reminders_enabled, false, v_actor, now())
  on conflict (institution_id) do update set default_due_day = excluded.default_due_day,
    opening_balance_cents = excluded.opening_balance_cents,
    opening_balance_date = excluded.opening_balance_date,
    reminder_days_before = excluded.reminder_days_before,
    reminder_days_after = excluded.reminder_days_after,
    in_app_reminders_enabled = excluded.in_app_reminders_enabled,
    updated_by = excluded.updated_by, updated_at = now();
  insert into public.finance_audit_events(institution_id, actor_id, action, entity_type,
    idempotency_key, details)
  values (p_institution_id, v_actor, 'FINANCE_SETTINGS_UPDATED', 'SETTINGS',
    'settings:' || extensions.uuid_generate_v4()::text,
    jsonb_build_object('previous_default_due_day', v_old.default_due_day,
      'default_due_day', p_default_due_day,
      'previous_opening_balance_cents', v_old.opening_balance_cents,
      'opening_balance_cents', p_opening_balance_cents,
      'opening_balance_date', p_opening_balance_date,
      'external_reminders_enabled', false));
  return jsonb_build_object('institution_id', p_institution_id, 'default_due_day', p_default_due_day,
    'opening_balance_cents', p_opening_balance_cents, 'opening_balance_date', p_opening_balance_date,
    'reminder_days_before', p_reminder_days_before, 'reminder_days_after', p_reminder_days_after,
    'in_app_reminders_enabled', p_in_app_reminders_enabled, 'external_reminders_enabled', false);
end;
$$;

create or replace function public.finance_get_settings_v2(p_institution_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_settings public.finance_settings%rowtype;
begin
  if not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  select * into v_settings from public.finance_settings where institution_id = p_institution_id;
  if found then return to_jsonb(v_settings); end if;
  return jsonb_build_object('institution_id', p_institution_id, 'default_due_day', 10,
    'opening_balance_cents', 0, 'opening_balance_date', current_date,
    'reminder_days_before', 3, 'reminder_days_after', 1,
    'in_app_reminders_enabled', false, 'external_reminders_enabled', false);
end;
$$;

create or replace function public.finance_list_invoices_v2(
  p_institution_id uuid, p_page integer, p_page_size integer,
  p_search text, p_status text, p_due_from date, p_due_to date,
  p_sort_by text, p_sort_direction text
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_rows jsonb; v_total bigint; v_page integer := greatest(1, p_page); v_size integer := least(100, greatest(1, p_page_size));
  v_sort_by text := case when p_sort_by in ('due_date', 'student_name', 'balance', 'status') then p_sort_by else 'due_date' end;
  v_sort_direction text := case when upper(p_sort_direction) in ('ASC', 'DESC') then upper(p_sort_direction) else 'ASC' end;
begin
  if not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  with filtered as (
    select invoice.id, invoice.institution_id, invoice.contract_id, invoice.student_id,
      invoice.financial_responsible_profile_id, invoice.reference, invoice.due_date,
      invoice.base_amount, invoice.discount_amount, invoice.scholarship_amount,
      invoice.punctuality_discount_amount, invoice.fine_amount, invoice.interest_amount,
      invoice.amount_paid, invoice.status::text as stored_status, invoice.sequence_number,
      private.finance_invoice_amount_due_now(invoice.id) as amount_due_now,
      student_profile.full_name as student_name, responsible.full_name as responsible_name
    from public.invoices invoice
    join public.students student on student.id = invoice.student_id and student.institution_id = invoice.institution_id
    join public.profiles student_profile on student_profile.id = student.profile_id
    left join public.profiles responsible on responsible.id = invoice.financial_responsible_profile_id
    where invoice.institution_id = p_institution_id
      and (p_due_from is null or invoice.due_date >= p_due_from)
      and (p_due_to is null or invoice.due_date <= p_due_to)
      and (coalesce(p_search, '') = '' or invoice.reference ilike '%' || p_search || '%'
        or student_profile.full_name ilike '%' || p_search || '%'
        or coalesce(responsible.full_name, '') ilike '%' || p_search || '%')
  ), shaped as (
    select filtered.*,
      case when stored_status = 'CANCELLED' then 'CANCELLED'
        when amount_paid >= amount_due_now then 'PAID'
        when amount_paid > 0 then 'PARTIALLY_PAID'
        when due_date < current_date then 'OVERDUE'
        else stored_status end as status,
      greatest(0, amount_due_now - amount_paid) as balance_cents
    from filtered
  ), status_filtered as (
    select * from shaped where p_status is null or p_status = '' or status = p_status
  )
  select count(*) into v_total from status_filtered;
  with filtered as (
    select invoice.id, invoice.institution_id, invoice.contract_id, invoice.student_id,
      invoice.financial_responsible_profile_id, invoice.reference, invoice.due_date,
      invoice.base_amount, invoice.discount_amount, invoice.scholarship_amount,
      invoice.punctuality_discount_amount, invoice.fine_amount, invoice.interest_amount,
      invoice.amount_paid, invoice.status::text as stored_status, invoice.sequence_number,
      private.finance_invoice_amount_due_now(invoice.id) as amount_due_now,
      student_profile.full_name as student_name, responsible.full_name as responsible_name
    from public.invoices invoice
    join public.students student on student.id = invoice.student_id and student.institution_id = invoice.institution_id
    join public.profiles student_profile on student_profile.id = student.profile_id
    left join public.profiles responsible on responsible.id = invoice.financial_responsible_profile_id
    where invoice.institution_id = p_institution_id
      and (p_due_from is null or invoice.due_date >= p_due_from)
      and (p_due_to is null or invoice.due_date <= p_due_to)
      and (coalesce(p_search, '') = '' or invoice.reference ilike '%' || p_search || '%'
        or student_profile.full_name ilike '%' || p_search || '%'
        or coalesce(responsible.full_name, '') ilike '%' || p_search || '%')
  ), shaped as (
    select filtered.*,
      case when stored_status = 'CANCELLED' then 'CANCELLED'
        when amount_paid >= amount_due_now then 'PAID'
        when amount_paid > 0 then 'PARTIALLY_PAID'
        when due_date < current_date then 'OVERDUE'
        else stored_status end as status,
      greatest(0, amount_due_now - amount_paid) as balance_cents
    from filtered
  )
  select coalesce(jsonb_agg(to_jsonb(page_rows)
    order by case when v_sort_by = 'due_date' and v_sort_direction = 'ASC' then due_date end asc,
      case when v_sort_by = 'due_date' and v_sort_direction = 'DESC' then due_date end desc,
      case when v_sort_by = 'student_name' and v_sort_direction = 'ASC' then student_name end asc,
      case when v_sort_by = 'student_name' and v_sort_direction = 'DESC' then student_name end desc,
      case when v_sort_by = 'balance' and v_sort_direction = 'ASC' then balance_cents end asc,
      case when v_sort_by = 'balance' and v_sort_direction = 'DESC' then balance_cents end desc,
      case when v_sort_by = 'status' and v_sort_direction = 'ASC' then status end asc,
      case when v_sort_by = 'status' and v_sort_direction = 'DESC' then status end desc,
      sequence_number asc, id asc), '[]'::jsonb)
    into v_rows from (
      select * from shaped where p_status is null or p_status = '' or status = p_status
      order by case when v_sort_by = 'due_date' and v_sort_direction = 'ASC' then due_date end asc,
        case when v_sort_by = 'due_date' and v_sort_direction = 'DESC' then due_date end desc,
        case when v_sort_by = 'student_name' and v_sort_direction = 'ASC' then student_name end asc,
        case when v_sort_by = 'student_name' and v_sort_direction = 'DESC' then student_name end desc,
        case when v_sort_by = 'balance' and v_sort_direction = 'ASC' then balance_cents end asc,
        case when v_sort_by = 'balance' and v_sort_direction = 'DESC' then balance_cents end desc,
        case when v_sort_by = 'status' and v_sort_direction = 'ASC' then status end asc,
        case when v_sort_by = 'status' and v_sort_direction = 'DESC' then status end desc,
        sequence_number asc, id asc limit v_size offset (v_page - 1) * v_size
    ) page_rows;
  return jsonb_build_object('rows', v_rows, 'total_count', v_total, 'page', v_page, 'page_size', v_size);
end;
$$;

create or replace function public.finance_list_contracts_v2(
  p_institution_id uuid, p_page integer, p_page_size integer, p_search text, p_status text,
  p_sort_by text, p_sort_direction text
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_rows jsonb; v_total bigint; v_page integer := greatest(1, p_page); v_size integer := least(100, greatest(1, p_page_size));
  v_sort_by text := case when p_sort_by in ('created_at', 'student_name', 'monthly_amount', 'status') then p_sort_by else 'created_at' end;
  v_sort_direction text := case when upper(p_sort_direction) in ('ASC', 'DESC') then upper(p_sort_direction) else 'DESC' end;
begin
  if not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  with filtered as (
    select contract.*, contract.status::text as status_label,
      student_profile.full_name as student_name,
      responsible.full_name as responsible_name,
      year.name as academic_year_name,
      (select count(*) from public.invoices invoice where invoice.contract_id = contract.id) as invoice_count
    from public.financial_contracts contract
    join public.students student on student.id = contract.student_id and student.institution_id = contract.institution_id
    join public.profiles student_profile on student_profile.id = student.profile_id
    join public.profiles responsible on responsible.id = contract.financial_responsible_profile_id
    join public.academic_years year on year.id = contract.academic_year_id and year.institution_id = contract.institution_id
    where contract.institution_id = p_institution_id
      and (coalesce(p_search, '') = '' or student_profile.full_name ilike '%' || p_search || '%'
        or responsible.full_name ilike '%' || p_search || '%')
      and (coalesce(p_status, '') = '' or contract.status::text = p_status)
  )
  select count(*) into v_total from filtered;
  with filtered as (
    select contract.id, contract.institution_id, contract.student_id, contract.academic_year_id,
      contract.financial_responsible_profile_id, contract.status::text as status,
      contract.base_amount, contract.enrollment_fee_amount, contract.installment_count,
      contract.first_due_date, contract.default_due_day, contract.notes, contract.monthly_amount_cents,
      contract.scholarship_per_installment_cents, contract.discount_per_installment_cents,
      contract.punctuality_discount_cents, contract.fine_rate_bps,
      contract.monthly_interest_rate_bps, contract.grace_days, contract.created_at,
      student_profile.full_name as student_name, responsible.full_name as responsible_name,
      year.name as academic_year_name,
      (select count(*) from public.invoices invoice where invoice.contract_id = contract.id) as invoice_count
    from public.financial_contracts contract
    join public.students student on student.id = contract.student_id and student.institution_id = contract.institution_id
    join public.profiles student_profile on student_profile.id = student.profile_id
    join public.profiles responsible on responsible.id = contract.financial_responsible_profile_id
    join public.academic_years year on year.id = contract.academic_year_id and year.institution_id = contract.institution_id
    where contract.institution_id = p_institution_id
      and (coalesce(p_search, '') = '' or student_profile.full_name ilike '%' || p_search || '%'
        or responsible.full_name ilike '%' || p_search || '%')
      and (coalesce(p_status, '') = '' or contract.status::text = p_status)
  )
  select coalesce(jsonb_agg(to_jsonb(page_rows)
    order by case when v_sort_by = 'created_at' and v_sort_direction = 'ASC' then created_at end asc,
      case when v_sort_by = 'created_at' and v_sort_direction = 'DESC' then created_at end desc,
      case when v_sort_by = 'student_name' and v_sort_direction = 'ASC' then student_name end asc,
      case when v_sort_by = 'student_name' and v_sort_direction = 'DESC' then student_name end desc,
      case when v_sort_by = 'monthly_amount' and v_sort_direction = 'ASC' then monthly_amount_cents end asc,
      case when v_sort_by = 'monthly_amount' and v_sort_direction = 'DESC' then monthly_amount_cents end desc,
      case when v_sort_by = 'status' and v_sort_direction = 'ASC' then status end asc,
      case when v_sort_by = 'status' and v_sort_direction = 'DESC' then status end desc,
      created_at desc, id asc), '[]'::jsonb)
   into v_rows from (select * from filtered order by
      case when v_sort_by = 'created_at' and v_sort_direction = 'ASC' then created_at end asc,
      case when v_sort_by = 'created_at' and v_sort_direction = 'DESC' then created_at end desc,
      case when v_sort_by = 'student_name' and v_sort_direction = 'ASC' then student_name end asc,
      case when v_sort_by = 'student_name' and v_sort_direction = 'DESC' then student_name end desc,
      case when v_sort_by = 'monthly_amount' and v_sort_direction = 'ASC' then monthly_amount_cents end asc,
      case when v_sort_by = 'monthly_amount' and v_sort_direction = 'DESC' then monthly_amount_cents end desc,
      case when v_sort_by = 'status' and v_sort_direction = 'ASC' then status end asc,
      case when v_sort_by = 'status' and v_sort_direction = 'DESC' then status end desc,
      created_at desc, id asc limit v_size offset (v_page - 1) * v_size) page_rows;
  return jsonb_build_object('rows', v_rows, 'total_count', v_total, 'page', v_page, 'page_size', v_size);
end;
$$;

create or replace function public.finance_list_payments_v2(
  p_institution_id uuid, p_page integer, p_page_size integer, p_search text, p_status text,
  p_paid_from date, p_paid_to date, p_sort_by text, p_sort_direction text
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_rows jsonb; v_total bigint; v_page integer := greatest(1, p_page); v_size integer := least(100, greatest(1, p_page_size));
  v_sort_by text := case when p_sort_by in ('paid_at', 'student_name', 'amount', 'status') then p_sort_by else 'paid_at' end;
  v_sort_direction text := case when upper(p_sort_direction) in ('ASC', 'DESC') then upper(p_sort_direction) else 'DESC' end;
begin
  if not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  with filtered as (
    select payment.id, payment.institution_id, payment.invoice_id, payment.provider,
      payment.method, payment.amount, payment.status::text as status, payment.paid_at,
      payment.registered_by, payment.notes, payment.reversed_at, payment.reversed_by,
      payment.reversal_reason, payment.created_at, invoice.reference, invoice.student_id,
      student_profile.full_name as student_name, responsible.full_name as responsible_name
    from public.payments payment
    join public.invoices invoice on invoice.id = payment.invoice_id and invoice.institution_id = payment.institution_id
    join public.students student on student.id = invoice.student_id and student.institution_id = invoice.institution_id
    join public.profiles student_profile on student_profile.id = student.profile_id
    left join public.profiles responsible on responsible.id = invoice.financial_responsible_profile_id
    where payment.institution_id = p_institution_id
      and (coalesce(p_search, '') = '' or invoice.reference ilike '%' || p_search || '%'
        or student_profile.full_name ilike '%' || p_search || '%'
        or coalesce(responsible.full_name, '') ilike '%' || p_search || '%')
      and (coalesce(p_status, '') = '' or payment.status::text = p_status)
      and (p_paid_from is null or payment.paid_at::date >= p_paid_from)
      and (p_paid_to is null or payment.paid_at::date <= p_paid_to)
  )
  select count(*) into v_total from filtered;
  with filtered as (
    select payment.id, payment.institution_id, payment.invoice_id, payment.provider,
      payment.method, payment.amount, payment.status::text as status, payment.paid_at,
      payment.registered_by, payment.notes, payment.reversed_at, payment.reversed_by,
      payment.reversal_reason, payment.created_at, invoice.reference,
      student_profile.full_name as student_name, responsible.full_name as responsible_name
    from public.payments payment
    join public.invoices invoice on invoice.id = payment.invoice_id and invoice.institution_id = payment.institution_id
    join public.students student on student.id = invoice.student_id and student.institution_id = invoice.institution_id
    join public.profiles student_profile on student_profile.id = student.profile_id
    left join public.profiles responsible on responsible.id = invoice.financial_responsible_profile_id
    where payment.institution_id = p_institution_id
      and (coalesce(p_search, '') = '' or invoice.reference ilike '%' || p_search || '%'
        or student_profile.full_name ilike '%' || p_search || '%'
        or coalesce(responsible.full_name, '') ilike '%' || p_search || '%')
      and (coalesce(p_status, '') = '' or payment.status::text = p_status)
      and (p_paid_from is null or payment.paid_at::date >= p_paid_from)
      and (p_paid_to is null or payment.paid_at::date <= p_paid_to)
  )
  select coalesce(jsonb_agg(to_jsonb(page_rows)
    order by case when v_sort_by = 'paid_at' and v_sort_direction = 'ASC' then paid_at end asc nulls last,
      case when v_sort_by = 'paid_at' and v_sort_direction = 'DESC' then paid_at end desc nulls last,
      case when v_sort_by = 'student_name' and v_sort_direction = 'ASC' then student_name end asc,
      case when v_sort_by = 'student_name' and v_sort_direction = 'DESC' then student_name end desc,
      case when v_sort_by = 'amount' and v_sort_direction = 'ASC' then amount end asc,
      case when v_sort_by = 'amount' and v_sort_direction = 'DESC' then amount end desc,
      case when v_sort_by = 'status' and v_sort_direction = 'ASC' then status end asc,
      case when v_sort_by = 'status' and v_sort_direction = 'DESC' then status end desc,
      paid_at desc nulls last, created_at desc, id asc), '[]'::jsonb)
    into v_rows from (select * from filtered order by
      case when v_sort_by = 'paid_at' and v_sort_direction = 'ASC' then paid_at end asc nulls last,
      case when v_sort_by = 'paid_at' and v_sort_direction = 'DESC' then paid_at end desc nulls last,
      case when v_sort_by = 'student_name' and v_sort_direction = 'ASC' then student_name end asc,
      case when v_sort_by = 'student_name' and v_sort_direction = 'DESC' then student_name end desc,
      case when v_sort_by = 'amount' and v_sort_direction = 'ASC' then amount end asc,
      case when v_sort_by = 'amount' and v_sort_direction = 'DESC' then amount end desc,
      case when v_sort_by = 'status' and v_sort_direction = 'ASC' then status end asc,
      case when v_sort_by = 'status' and v_sort_direction = 'DESC' then status end desc,
      paid_at desc nulls last, created_at desc, id asc limit v_size offset (v_page - 1) * v_size) page_rows;
  return jsonb_build_object('rows', v_rows, 'total_count', v_total, 'page', v_page, 'page_size', v_size);
end;
$$;

create or replace function public.finance_list_expenses_v2(
  p_institution_id uuid, p_page integer, p_page_size integer,
  p_search text, p_status text, p_due_from date, p_due_to date,
  p_sort_by text, p_sort_direction text
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_rows jsonb; v_total bigint; v_page integer := greatest(1, p_page); v_size integer := least(100, greatest(1, p_page_size));
  v_sort_by text := case when p_sort_by in ('due_date', 'description', 'amount', 'status') then p_sort_by else 'due_date' end;
  v_sort_direction text := case when upper(p_sort_direction) in ('ASC', 'DESC') then upper(p_sort_direction) else 'ASC' end;
begin
  if not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  with filtered as (
    select expense.id, expense.institution_id, expense.category_id, category.name as category_name,
      expense.supplier_id, coalesce(expense.supplier_name_snapshot, supplier.name) as supplier_name,
      expense.description, expense.amount_cents, expense.competence_date, expense.due_date,
      case when expense.status = 'OPEN' and expense.due_date < current_date then 'OVERDUE'
        else expense.status end as status,
      expense.paid_at, expense.payment_method, expense.recurrence_group_id,
      expense.recurrence_index, expense.document_path, expense.notes,
      expense.reversed_at, expense.reversed_by, expense.reversal_reason, expense.created_at
    from public.finance_expenses expense
    join public.finance_expense_categories category on category.id = expense.category_id
    left join public.finance_suppliers supplier on supplier.id = expense.supplier_id
    where expense.institution_id = p_institution_id
      and (p_due_from is null or expense.due_date >= p_due_from)
      and (p_due_to is null or expense.due_date <= p_due_to)
      and (coalesce(p_search, '') = '' or expense.description ilike '%' || p_search || '%'
        or category.name ilike '%' || p_search || '%'
        or coalesce(expense.supplier_name_snapshot, supplier.name, '') ilike '%' || p_search || '%')
       and (coalesce(p_status, '') = '' or
         (p_status = 'OPEN_OR_OVERDUE' and expense.status in ('OPEN', 'OVERDUE')) or
         (case when expense.status = 'OPEN' and expense.due_date < current_date then 'OVERDUE' else expense.status end) = p_status)
  )
  select count(*) into v_total from filtered;
  with filtered as (
    select expense.id, expense.institution_id, expense.category_id, category.name as category_name,
      expense.supplier_id, coalesce(expense.supplier_name_snapshot, supplier.name) as supplier_name,
      expense.description, expense.amount_cents, expense.competence_date, expense.due_date,
      case when expense.status = 'OPEN' and expense.due_date < current_date then 'OVERDUE'
        else expense.status end as status,
      expense.paid_at, expense.payment_method, expense.recurrence_group_id,
      expense.recurrence_index, expense.document_path, expense.notes,
      expense.reversed_at, expense.reversed_by, expense.reversal_reason, expense.created_at
    from public.finance_expenses expense
    join public.finance_expense_categories category on category.id = expense.category_id
    left join public.finance_suppliers supplier on supplier.id = expense.supplier_id
    where expense.institution_id = p_institution_id
      and (p_due_from is null or expense.due_date >= p_due_from)
      and (p_due_to is null or expense.due_date <= p_due_to)
      and (coalesce(p_search, '') = '' or expense.description ilike '%' || p_search || '%'
        or category.name ilike '%' || p_search || '%'
        or coalesce(expense.supplier_name_snapshot, supplier.name, '') ilike '%' || p_search || '%')
       and (coalesce(p_status, '') = '' or
         (p_status = 'OPEN_OR_OVERDUE' and expense.status in ('OPEN', 'OVERDUE')) or
         (case when expense.status = 'OPEN' and expense.due_date < current_date then 'OVERDUE' else expense.status end) = p_status)
  )
  select coalesce(jsonb_agg(to_jsonb(page_rows)
    order by case when v_sort_by = 'due_date' and v_sort_direction = 'ASC' then due_date end asc,
      case when v_sort_by = 'due_date' and v_sort_direction = 'DESC' then due_date end desc,
      case when v_sort_by = 'description' and v_sort_direction = 'ASC' then description end asc,
      case when v_sort_by = 'description' and v_sort_direction = 'DESC' then description end desc,
      case when v_sort_by = 'amount' and v_sort_direction = 'ASC' then amount_cents end asc,
      case when v_sort_by = 'amount' and v_sort_direction = 'DESC' then amount_cents end desc,
      case when v_sort_by = 'status' and v_sort_direction = 'ASC' then status end asc,
      case when v_sort_by = 'status' and v_sort_direction = 'DESC' then status end desc,
      due_date asc, created_at desc, id asc), '[]'::jsonb)
    into v_rows from (select * from filtered order by
      case when v_sort_by = 'due_date' and v_sort_direction = 'ASC' then due_date end asc,
      case when v_sort_by = 'due_date' and v_sort_direction = 'DESC' then due_date end desc,
      case when v_sort_by = 'description' and v_sort_direction = 'ASC' then description end asc,
      case when v_sort_by = 'description' and v_sort_direction = 'DESC' then description end desc,
      case when v_sort_by = 'amount' and v_sort_direction = 'ASC' then amount_cents end asc,
      case when v_sort_by = 'amount' and v_sort_direction = 'DESC' then amount_cents end desc,
      case when v_sort_by = 'status' and v_sort_direction = 'ASC' then status end asc,
      case when v_sort_by = 'status' and v_sort_direction = 'DESC' then status end desc,
      due_date asc, created_at desc, id asc limit v_size offset (v_page - 1) * v_size) page_rows;
  return jsonb_build_object('rows', v_rows, 'total_count', v_total, 'page', v_page, 'page_size', v_size);
end;
$$;

create or replace function public.finance_list_suppliers_v2(p_institution_id uuid, p_search text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', supplier.id, 'name', supplier.name,
    'contact', supplier.contact, 'active', supplier.active) order by supplier.name)
    from public.finance_suppliers supplier where supplier.institution_id = p_institution_id
      and supplier.active and (coalesce(p_search, '') = '' or supplier.name ilike '%' || p_search || '%')),
    '[]'::jsonb);
end;
$$;

create or replace function public.finance_dashboard_v2(p_institution_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_received bigint := 0; v_expenses_paid bigint := 0; v_receivable bigint := 0;
  v_overdue bigint := 0; v_receivable_period bigint := 0; v_expenses_due bigint := 0;
  v_forecast_in bigint := 0; v_forecast_out bigint := 0; v_opening bigint := 0;
  v_opening_date date := current_date; v_period_opening bigint := 0;
  v_rows jsonb; v_settings_configured boolean := false;
begin
  if not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 3660 then
    raise exception using errcode = '22023', message = 'FINANCE_INVALID_REPORT_PERIOD';
  end if;
  select opening_balance_cents, opening_balance_date into v_opening, v_opening_date
    from public.finance_settings where institution_id = p_institution_id;
  v_settings_configured := found;
  v_opening := coalesce(v_opening, 0); v_opening_date := coalesce(v_opening_date, current_date);
  select v_opening
    + coalesce((select sum(payment.amount) from public.payments payment
      where payment.institution_id = p_institution_id and payment.status = 'PAID'
        and payment.paid_at >= v_opening_date and payment.paid_at::date < p_from), 0)
    - coalesce((select sum(expense.amount_cents) from public.finance_expenses expense
      where expense.institution_id = p_institution_id and expense.status = 'PAID'
        and expense.paid_at >= v_opening_date and expense.paid_at::date < p_from), 0)
    into v_period_opening;
  select coalesce(sum(payment.amount), 0) into v_received from public.payments payment
    where payment.institution_id = p_institution_id and payment.status = 'PAID'
      and payment.paid_at::date between p_from and p_to;
  select coalesce(sum(expense.amount_cents), 0) into v_expenses_paid from public.finance_expenses expense
    where expense.institution_id = p_institution_id and expense.status = 'PAID'
      and expense.paid_at::date between p_from and p_to;
  select coalesce(sum(greatest(0, private.finance_invoice_amount_due_now(invoice.id) - invoice.amount_paid)), 0)
    into v_receivable from public.invoices invoice
    where invoice.institution_id = p_institution_id and invoice.status not in ('CANCELLED', 'DRAFT')
      and invoice.amount_paid < private.finance_invoice_amount_due_now(invoice.id);
  select coalesce(sum(greatest(0, private.finance_invoice_amount_due_now(invoice.id) - invoice.amount_paid)), 0)
    into v_overdue from public.invoices invoice
    where invoice.institution_id = p_institution_id and invoice.status not in ('CANCELLED', 'DRAFT')
      and invoice.due_date < current_date
      and invoice.amount_paid < private.finance_invoice_amount_due_now(invoice.id);
  select coalesce(sum(greatest(0, private.finance_invoice_amount_due_now(invoice.id) - invoice.amount_paid)), 0)
    into v_receivable_period from public.invoices invoice
    where invoice.institution_id = p_institution_id and invoice.status not in ('CANCELLED', 'DRAFT')
      and invoice.due_date between p_from and p_to
      and invoice.amount_paid < private.finance_invoice_amount_due_now(invoice.id);
  select coalesce(sum(expense.amount_cents), 0) into v_expenses_due from public.finance_expenses expense
    where expense.institution_id = p_institution_id and expense.status in ('OPEN', 'OVERDUE')
      and expense.due_date between p_from and p_to;
  select coalesce(sum(greatest(0, private.finance_invoice_amount_due_now(invoice.id) - invoice.amount_paid)), 0)
    into v_forecast_in from public.invoices invoice
    where invoice.institution_id = p_institution_id and invoice.status not in ('CANCELLED', 'DRAFT')
      and invoice.due_date > current_date and invoice.due_date <= p_to
      and invoice.amount_paid < private.finance_invoice_amount_due_now(invoice.id);
  select coalesce(sum(expense.amount_cents), 0) into v_forecast_out from public.finance_expenses expense
    where expense.institution_id = p_institution_id and expense.status in ('OPEN', 'OVERDUE')
      and expense.due_date > current_date and expense.due_date <= p_to;

  select coalesce(jsonb_agg(jsonb_build_object('month', months.month_start::date,
      'received_cents', coalesce(received.amount_cents, 0),
      'expenses_cents', coalesce(spent.amount_cents, 0),
      'net_cents', coalesce(received.amount_cents, 0) - coalesce(spent.amount_cents, 0)) order by months.month_start), '[]'::jsonb)
    into v_rows
    from generate_series(date_trunc('month', current_date) - interval '5 months',
      date_trunc('month', current_date), interval '1 month') as months(month_start)
    left join lateral (select sum(payment.amount) amount_cents from public.payments payment
      where payment.institution_id = p_institution_id and payment.status = 'PAID'
        and payment.paid_at >= months.month_start and payment.paid_at < months.month_start + interval '1 month') received on true
    left join lateral (select sum(expense.amount_cents) amount_cents from public.finance_expenses expense
      where expense.institution_id = p_institution_id and expense.status = 'PAID'
        and expense.paid_at >= months.month_start and expense.paid_at < months.month_start + interval '1 month') spent on true;

  return jsonb_build_object(
    'period_from', p_from, 'period_to', p_to,
    'received_cents', v_received,
    'receivable_cents', v_receivable,
    'receivable_period_cents', v_receivable_period,
    'overdue_cents', v_overdue,
    'delinquency_ratio', case when v_receivable > 0 then v_overdue::numeric / v_receivable else 0 end,
    'expenses_paid_cents', v_expenses_paid,
    'expenses_due_cents', v_expenses_due,
    'opening_balance_cents', v_period_opening,
    'closing_balance_cents', v_period_opening + v_received - v_expenses_paid,
    'forecast_in_cents', v_forecast_in,
    'forecast_out_cents', v_forecast_out,
    'projected_balance_cents', v_period_opening + v_received - v_expenses_paid + v_forecast_in - v_forecast_out,
    'opening_balance_configured', v_settings_configured,
    'cash_is_bank_reconciled', false,
    'monthly_series', v_rows
  );
end;
$$;

create or replace function public.finance_report_breakdown_v2(
  p_institution_id uuid, p_from date, p_to date
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_classes jsonb; v_discounts jsonb;
begin
  if not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 3660 then
    raise exception using errcode = '22023', message = 'FINANCE_INVALID_REPORT_PERIOD';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'class_id', grouped.class_id, 'class_name', grouped.class_name,
    'received_cents', grouped.received_cents, 'invoice_count', grouped.invoice_count
  ) order by grouped.class_name), '[]'::jsonb) into v_classes
  from (
    select class.id as class_id, coalesce(class.name, 'Sem turma') as class_name,
      coalesce(sum(payment.amount) filter (where payment.status = 'PAID'
        and payment.paid_at::date between p_from and p_to), 0)::bigint as received_cents,
      count(distinct invoice.id)::integer as invoice_count
    from public.invoices invoice
    join public.financial_contracts contract on contract.id = invoice.contract_id
      and contract.institution_id = invoice.institution_id
    left join public.enrollments enrollment on enrollment.id = contract.enrollment_id
      and enrollment.student_id = contract.student_id and enrollment.academic_year_id = contract.academic_year_id
    left join public.classes class on class.id = enrollment.class_id and class.institution_id = p_institution_id
    left join public.payments payment on payment.invoice_id = invoice.id and payment.institution_id = p_institution_id
    where invoice.institution_id = p_institution_id and invoice.due_date between p_from and p_to
    group by class.id, class.name
  ) grouped;
  select jsonb_build_object(
    'discount_cents', coalesce(sum(invoice.discount_amount), 0),
    'scholarship_cents', coalesce(sum(invoice.scholarship_amount), 0),
    'punctuality_discount_cents', coalesce(sum(invoice.punctuality_discount_amount), 0)
  ) into v_discounts
    from public.invoices invoice where invoice.institution_id = p_institution_id
      and invoice.due_date between p_from and p_to;
  return jsonb_build_object('revenue_by_class', v_classes, 'discounts', v_discounts,
    'period_from', p_from, 'period_to', p_to);
end;
$$;

create or replace function public.finance_guardian_portal_v2()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_result jsonb; v_actor uuid := auth.uid();
begin
  if v_actor is null or not exists (
    select 1 from public.profiles profile where profile.id = v_actor
      and profile.active and profile.role = 'GUARDIAN'::public.user_role
  ) then raise exception using errcode = '42501', message = 'FINANCE_GUARDIAN_FORBIDDEN'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'contract_id', contract.id,
    'institution_id', contract.institution_id,
    'institution_name', institution.name,
    'student_name', student_profile.full_name,
    'status', contract.status,
    'monthly_amount_cents', contract.monthly_amount_cents,
    'installment_count', contract.installment_count,
    'invoices', coalesce((select jsonb_agg(jsonb_build_object(
      'id', invoice.id, 'reference', invoice.reference, 'due_date', invoice.due_date,
      'amount_due_cents', private.finance_invoice_amount_due_now(invoice.id),
      'amount_paid_cents', invoice.amount_paid,
      'balance_cents', greatest(0, private.finance_invoice_amount_due_now(invoice.id) - invoice.amount_paid),
      'status', case when invoice.status = 'CANCELLED' then 'CANCELLED'
        when invoice.amount_paid >= private.finance_invoice_amount_due_now(invoice.id) then 'PAID'
        when invoice.amount_paid > 0 then 'PARTIALLY_PAID'
        when invoice.due_date < current_date then 'OVERDUE' else invoice.status::text end,
      'receipts', coalesce((select jsonb_agg(jsonb_build_object('id', payment.id,
        'amount_cents', payment.amount, 'method', payment.method, 'paid_at', payment.paid_at,
        'status', payment.status) order by payment.paid_at desc)
        from public.payments payment where payment.invoice_id = invoice.id and payment.status in ('PAID', 'REVERSED')),
        '[]'::jsonb)) order by invoice.due_date, invoice.sequence_number)
      from public.invoices invoice where invoice.contract_id = contract.id and invoice.institution_id = contract.institution_id), '[]'::jsonb)
  ) order by contract.created_at desc), '[]'::jsonb)
    into v_result
    from public.financial_contracts contract
    join public.institutions institution on institution.id = contract.institution_id
    join public.students student on student.id = contract.student_id and student.institution_id = contract.institution_id
    join public.profiles student_profile on student_profile.id = student.profile_id
    where contract.financial_responsible_profile_id = v_actor;
  return v_result;
end;
$$;

-- Keep legacy callers functional while moving all new writes through the
-- idempotent V2 RPC. Direct table writes are no longer granted to clients.
create or replace function public.create_financial_contract_with_invoices(
  p_institution_id uuid, p_student_id uuid, p_enrollment_id uuid, p_academic_year_id uuid,
  p_financial_responsible_profile_id uuid, p_base_amount bigint, p_enrollment_fee_amount bigint,
  p_installment_count integer, p_first_due_date date, p_default_due_day integer, p_notes text default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid(); v_key text; v_existing public.financial_contracts%rowtype;
  v_contract_id uuid; v_invoice_ids uuid[] := array[]::uuid[]; v_due date; v_month date; v_invoice_id uuid;
  v_index integer; v_monthly bigint;
begin
  if v_actor is null or not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  if p_base_amount <= 0 or p_enrollment_fee_amount < 0 or p_installment_count not between 1 and 60
    or p_default_due_day not between 1 and 31 or p_first_due_date is null then
    raise exception using errcode = '22023', message = 'FINANCE_INVALID_LEGACY_CONTRACT';
  end if;
  if not exists (select 1 from public.students student where student.id = p_student_id
    and student.institution_id = p_institution_id and student.active)
    or not exists (select 1 from public.academic_years year where year.id = p_academic_year_id
      and year.institution_id = p_institution_id)
    or not exists (select 1 from public.guardianships guardianship where guardianship.student_id = p_student_id
      and guardianship.guardian_profile_id = p_financial_responsible_profile_id and guardianship.active) then
    raise exception using errcode = '23503', message = 'FINANCE_LEGACY_LINK_INVALID';
  end if;
  if p_enrollment_id is not null and not exists (select 1 from public.enrollments enrollment
    join public.classes class on class.id = enrollment.class_id
    where enrollment.id = p_enrollment_id and enrollment.student_id = p_student_id
      and enrollment.academic_year_id = p_academic_year_id and class.institution_id = p_institution_id) then
    raise exception using errcode = '23503', message = 'FINANCE_ENROLLMENT_MISMATCH';
  end if;
  v_key := 'legacy-' || md5(concat_ws(':', p_institution_id::text, p_student_id::text,
    p_academic_year_id::text, p_financial_responsible_profile_id::text, p_base_amount::text,
    p_enrollment_fee_amount::text, p_installment_count::text, p_first_due_date::text, p_default_due_day::text));
  select * into v_existing from public.financial_contracts contract
   where contract.institution_id = p_institution_id and contract.idempotency_key = v_key;
  if found then
    select coalesce(array_agg(invoice.id order by invoice.sequence_number), array[]::uuid[])
      into v_invoice_ids from public.invoices invoice where invoice.contract_id = v_existing.id;
    return jsonb_build_object('contract_id', v_existing.id, 'invoice_ids', v_invoice_ids, 'replayed', true);
  end if;
  v_monthly := p_base_amount / p_installment_count;
  insert into public.financial_contracts(institution_id, student_id, enrollment_id, academic_year_id,
    financial_responsible_profile_id, status, base_amount, enrollment_fee_amount, installment_count,
    first_due_date, default_due_day, notes, idempotency_key, monthly_amount_cents, created_by)
  values (p_institution_id, p_student_id, p_enrollment_id, p_academic_year_id,
    p_financial_responsible_profile_id, 'ACTIVE', p_base_amount + p_enrollment_fee_amount,
    p_enrollment_fee_amount, p_installment_count, p_first_due_date, p_default_due_day,
    nullif(btrim(coalesce(p_notes, '')), ''), v_key, v_monthly, v_actor) returning id into v_contract_id;
  for v_index in 1..p_installment_count loop
    if v_index = 1 then v_due := p_first_due_date;
    else
      v_month := (date_trunc('month', p_first_due_date) + make_interval(months => v_index - 1))::date;
      v_due := make_date(extract(year from v_month)::integer, extract(month from v_month)::integer,
        least(p_default_due_day, extract(day from (v_month + interval '1 month' - interval '1 day'))::integer));
    end if;
    insert into public.invoices(institution_id, contract_id, student_id, financial_responsible_profile_id,
      reference, due_date, base_amount, sequence_number)
    values (p_institution_id, v_contract_id, p_student_id, p_financial_responsible_profile_id,
      'Parcela ' || v_index || '/' || p_installment_count, v_due,
      p_base_amount / p_installment_count + case when v_index <= p_base_amount % p_installment_count then 1 else 0 end,
      v_index) returning id into v_invoice_id;
    v_invoice_ids := array_append(v_invoice_ids, v_invoice_id);
  end loop;
  return jsonb_build_object('contract_id', v_contract_id, 'invoice_ids', v_invoice_ids, 'replayed', false);
end;
$$;

create or replace function public.finance_list_contract_candidates_v2(
  p_institution_id uuid, p_page integer, p_page_size integer, p_search text
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_page integer := greatest(1, coalesce(p_page, 1));
  v_size integer := least(100, greatest(1, coalesce(p_page_size, 20)));
  v_search text := btrim(coalesce(p_search, ''));
  v_total bigint;
  v_rows jsonb;
  v_years jsonb;
begin
  if not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  if length(v_search) > 120 then
    raise exception using errcode = '22023', message = 'FINANCE_INVALID_SEARCH';
  end if;
  select count(*) into v_total
    from public.students student
    join public.profiles student_profile on student_profile.id = student.profile_id and student_profile.active
   where student.institution_id = p_institution_id and student.active
     and (v_search = '' or student_profile.full_name ilike '%' || v_search || '%'
       or student.registration_number ilike '%' || v_search || '%')
     and exists (
       select 1 from public.guardianships link
       join public.profiles guardian on guardian.id = link.guardian_profile_id
       join public.memberships membership on membership.profile_id = guardian.id
        and membership.institution_id = p_institution_id and membership.active
        and membership.role = 'GUARDIAN'::public.user_role
       where link.student_id = student.id and link.active
         and guardian.active and guardian.role = 'GUARDIAN'::public.user_role
     );
  select coalesce(jsonb_agg(to_jsonb(page_rows) order by page_rows.full_name, page_rows.id), '[]'::jsonb)
    into v_rows
    from (
      select student.id, student.registration_number, student_profile.full_name,
        coalesce((select jsonb_agg(jsonb_build_object(
          'profile_id', guardian.id, 'full_name', guardian.full_name
        ) order by guardian.full_name)
          from public.guardianships link
          join public.profiles guardian on guardian.id = link.guardian_profile_id
          join public.memberships membership on membership.profile_id = guardian.id
            and membership.institution_id = p_institution_id and membership.active
            and membership.role = 'GUARDIAN'::public.user_role
         where link.student_id = student.id and link.active and guardian.active
           and guardian.role = 'GUARDIAN'::public.user_role), '[]'::jsonb) as responsibles,
        coalesce((select jsonb_agg(jsonb_build_object(
          'id', enrollment.id, 'class_name', class.name,
          'academic_year_id', year.id, 'academic_year_name', year.name
        ) order by year.start_date desc, class.name)
          from public.enrollments enrollment
          join public.classes class on class.id = enrollment.class_id
            and class.institution_id = p_institution_id and class.active
          join public.academic_years year on year.id = enrollment.academic_year_id
            and year.institution_id = p_institution_id and year.active
         where enrollment.student_id = student.id and enrollment.active
           and enrollment.academic_year_id = class.academic_year_id), '[]'::jsonb) as enrollments
        from public.students student
        join public.profiles student_profile on student_profile.id = student.profile_id and student_profile.active
       where student.institution_id = p_institution_id and student.active
         and (v_search = '' or student_profile.full_name ilike '%' || v_search || '%'
           or student.registration_number ilike '%' || v_search || '%')
         and exists (
           select 1 from public.guardianships link
           join public.profiles guardian on guardian.id = link.guardian_profile_id
           join public.memberships membership on membership.profile_id = guardian.id
             and membership.institution_id = p_institution_id and membership.active
             and membership.role = 'GUARDIAN'::public.user_role
           where link.student_id = student.id and link.active
             and guardian.active and guardian.role = 'GUARDIAN'::public.user_role
         )
       order by student_profile.full_name, student.id
       limit v_size offset (v_page - 1) * v_size
    ) page_rows;
  select coalesce(jsonb_agg(jsonb_build_object('id', year.id, 'name', year.name)
    order by year.start_date desc), '[]'::jsonb)
    into v_years from public.academic_years year
   where year.institution_id = p_institution_id and year.active;
  return jsonb_build_object('rows', v_rows, 'total_count', v_total, 'page', v_page,
    'page_size', v_size, 'academic_years', v_years);
end;
$$;

create or replace function public.finance_list_audit_events_v2(
  p_institution_id uuid, p_entity_type text, p_entity_id uuid, p_page integer, p_page_size integer
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_rows jsonb; v_total bigint; v_page integer := greatest(1, p_page); v_size integer := least(100, greatest(1, p_page_size));
begin
  if not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  select count(*) into v_total from public.finance_audit_events event
   where event.institution_id = p_institution_id
     and (p_entity_type is null or event.entity_type = p_entity_type)
     and (p_entity_id is null or event.entity_id = p_entity_id);
  select coalesce(jsonb_agg(to_jsonb(page_rows) order by created_at desc), '[]'::jsonb)
    into v_rows from (select event.id, event.actor_id, event.action, event.entity_type,
      event.entity_id, event.details, event.created_at
      from public.finance_audit_events event where event.institution_id = p_institution_id
        and (p_entity_type is null or event.entity_type = p_entity_type)
        and (p_entity_id is null or event.entity_id = p_entity_id)
      order by event.created_at desc limit v_size offset (v_page - 1) * v_size) page_rows;
  return jsonb_build_object('rows', v_rows, 'total_count', v_total, 'page', v_page, 'page_size', v_size);
end;
$$;

revoke all on function public.finance_create_contract_v2(uuid,uuid,uuid,uuid,uuid,bigint,bigint,integer,date,integer,bigint,bigint,bigint,integer,integer,integer,text,text) from public, anon;
revoke all on function public.finance_set_contract_status_v2(uuid,uuid,text,text) from public, anon;
revoke all on function public.finance_update_contract_terms_v2(uuid,uuid,bigint,bigint,bigint,bigint,integer,integer,integer,text,text) from public, anon;
revoke all on function public.finance_register_manual_receipt_v2(uuid,uuid,bigint,text,timestamptz,text,text) from public, anon;
revoke all on function public.finance_reverse_payment_v2(uuid,uuid,text) from public, anon;
revoke all on function public.finance_create_supplier_v2(uuid,text,text,text) from public, anon;
revoke all on function public.finance_create_expenses_v2(uuid,uuid,uuid,text,bigint,date,date,integer,text,text,text) from public, anon;
revoke all on function public.finance_mark_expense_paid_v2(uuid,uuid,text,timestamptz,text,text) from public, anon;
revoke all on function public.finance_reverse_expense_payment_v2(uuid,uuid,text) from public, anon;
revoke all on function public.finance_cancel_expense_v2(uuid,uuid,text) from public, anon;
revoke all on function public.finance_prepare_reminder_v2(uuid,uuid,text,text) from public, anon;
revoke all on function public.finance_list_reminder_drafts_v2(uuid,integer,integer) from public, anon;
revoke all on function public.finance_update_settings_v2(uuid,integer,bigint,date,integer,integer,boolean) from public, anon;
revoke all on function public.finance_get_settings_v2(uuid) from public, anon;
revoke all on function public.finance_list_invoices_v2(uuid,integer,integer,text,text,date,date,text,text) from public, anon;
revoke all on function public.finance_list_contracts_v2(uuid,integer,integer,text,text,text,text) from public, anon;
revoke all on function public.finance_list_payments_v2(uuid,integer,integer,text,text,date,date,text,text) from public, anon;
revoke all on function public.finance_list_expenses_v2(uuid,integer,integer,text,text,date,date,text,text) from public, anon;
revoke all on function public.finance_list_suppliers_v2(uuid,text) from public, anon;
revoke all on function public.finance_list_contract_candidates_v2(uuid,integer,integer,text) from public, anon;
revoke all on function public.finance_dashboard_v2(uuid,date,date) from public, anon;
revoke all on function public.finance_report_breakdown_v2(uuid,date,date) from public, anon;
revoke all on function public.finance_guardian_portal_v2() from public, anon;
revoke all on function public.create_financial_contract_with_invoices(uuid,uuid,uuid,uuid,uuid,bigint,bigint,integer,date,integer,text) from public, anon;
revoke all on function public.finance_list_audit_events_v2(uuid,text,uuid,integer,integer) from public, anon;

grant execute on function public.finance_create_contract_v2(uuid,uuid,uuid,uuid,uuid,bigint,bigint,integer,date,integer,bigint,bigint,bigint,integer,integer,integer,text,text) to authenticated;
grant execute on function public.finance_set_contract_status_v2(uuid,uuid,text,text) to authenticated;
grant execute on function public.finance_update_contract_terms_v2(uuid,uuid,bigint,bigint,bigint,bigint,integer,integer,integer,text,text) to authenticated;
grant execute on function public.finance_register_manual_receipt_v2(uuid,uuid,bigint,text,timestamptz,text,text) to authenticated;
grant execute on function public.finance_reverse_payment_v2(uuid,uuid,text) to authenticated;
grant execute on function public.finance_create_supplier_v2(uuid,text,text,text) to authenticated;
grant execute on function public.finance_create_expenses_v2(uuid,uuid,uuid,text,bigint,date,date,integer,text,text,text) to authenticated;
grant execute on function public.finance_mark_expense_paid_v2(uuid,uuid,text,timestamptz,text,text) to authenticated;
grant execute on function public.finance_reverse_expense_payment_v2(uuid,uuid,text) to authenticated;
grant execute on function public.finance_cancel_expense_v2(uuid,uuid,text) to authenticated;
grant execute on function public.finance_prepare_reminder_v2(uuid,uuid,text,text) to authenticated;
grant execute on function public.finance_list_reminder_drafts_v2(uuid,integer,integer) to authenticated;
grant execute on function public.finance_update_settings_v2(uuid,integer,bigint,date,integer,integer,boolean) to authenticated;
grant execute on function public.finance_get_settings_v2(uuid) to authenticated;
grant execute on function public.finance_list_invoices_v2(uuid,integer,integer,text,text,date,date,text,text) to authenticated;
grant execute on function public.finance_list_contracts_v2(uuid,integer,integer,text,text,text,text) to authenticated;
grant execute on function public.finance_list_payments_v2(uuid,integer,integer,text,text,date,date,text,text) to authenticated;
grant execute on function public.finance_list_expenses_v2(uuid,integer,integer,text,text,date,date,text,text) to authenticated;
grant execute on function public.finance_list_suppliers_v2(uuid,text) to authenticated;
grant execute on function public.finance_list_contract_candidates_v2(uuid,integer,integer,text) to authenticated;
grant execute on function public.finance_dashboard_v2(uuid,date,date) to authenticated;
grant execute on function public.finance_report_breakdown_v2(uuid,date,date) to authenticated;
grant execute on function public.finance_guardian_portal_v2() to authenticated;
grant execute on function public.create_financial_contract_with_invoices(uuid,uuid,uuid,uuid,uuid,bigint,bigint,integer,date,integer,text) to authenticated;
grant execute on function public.finance_list_audit_events_v2(uuid,text,uuid,integer,integer) to authenticated;

notify pgrst, 'reload schema';
commit;
