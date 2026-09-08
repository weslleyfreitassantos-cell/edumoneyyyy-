create type public.financial_contract_status as enum ('DRAFT', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'COMPLETED');
create type public.invoice_status as enum ('DRAFT', 'OPEN', 'PAID', 'OVERDUE', 'CANCELLED', 'PARTIALLY_PAID', 'NEGOTIATED');
create type public.payment_status as enum ('PENDING', 'PAID', 'FAILED', 'REVERSED');

create table public.financial_contracts (
  id uuid primary key default extensions.uuid_generate_v4(), institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id), enrollment_id uuid references public.enrollments(id), academic_year_id uuid not null references public.academic_years(id),
  financial_responsible_profile_id uuid not null references public.profiles(id), status public.financial_contract_status not null default 'DRAFT', base_amount bigint not null check (base_amount >= 0),
  enrollment_fee_amount bigint not null default 0 check (enrollment_fee_amount >= 0), installment_count integer not null check (installment_count between 1 and 60), first_due_date date not null,
  default_due_day integer not null check (default_due_day between 1 and 31), notes text, created_by uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.financial_contract_adjustments (
  id uuid primary key default extensions.uuid_generate_v4(), institution_id uuid not null references public.institutions(id) on delete cascade, contract_id uuid not null references public.financial_contracts(id) on delete cascade,
  type text not null check (type in ('SCHOLARSHIP','DISCOUNT','PUNCTUALITY_DISCOUNT','SIBLING','COMMERCIAL')), mode text not null check (mode in ('PERCENTAGE','FIXED')), value bigint not null check (value >= 0), description text, starts_at date, ends_at date, active boolean not null default true, created_at timestamptz not null default now()
);
create table public.invoices (
  id uuid primary key default extensions.uuid_generate_v4(), institution_id uuid not null references public.institutions(id) on delete cascade, contract_id uuid not null references public.financial_contracts(id), student_id uuid not null references public.students(id), financial_responsible_profile_id uuid not null references public.profiles(id), reference text not null, due_date date not null, base_amount bigint not null check (base_amount >= 0), discount_amount bigint not null default 0 check (discount_amount >= 0), scholarship_amount bigint not null default 0 check (scholarship_amount >= 0), fine_amount bigint not null default 0 check (fine_amount >= 0), interest_amount bigint not null default 0 check (interest_amount >= 0), amount_due bigint generated always as (greatest(0, base_amount - discount_amount - scholarship_amount + fine_amount + interest_amount)) stored, amount_paid bigint not null default 0 check (amount_paid >= 0), status public.invoice_status not null default 'OPEN', sequence_number integer not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(contract_id, sequence_number)
);
create table public.payments (
  id uuid primary key default extensions.uuid_generate_v4(), institution_id uuid not null references public.institutions(id) on delete cascade, invoice_id uuid not null references public.invoices(id), provider text not null check (provider in ('MOCK','MANUAL')), provider_payment_id text, method text not null check (method in ('MANUAL','PIX','PIX_AUTOMATIC','BOLETO','CREDIT_CARD')), amount bigint not null check (amount > 0), status public.payment_status not null default 'PENDING', paid_at timestamptz, registered_by uuid default auth.uid() references public.profiles(id), notes text, created_at timestamptz not null default now(), unique(provider, provider_payment_id)
);
create table public.payment_events (
  id uuid primary key default extensions.uuid_generate_v4(), institution_id uuid not null references public.institutions(id) on delete cascade, payment_id uuid not null references public.payments(id) on delete cascade, provider text not null, provider_event_id text not null, event_type text not null, payload_hash text, processed_at timestamptz, created_at timestamptz not null default now(), unique(provider, provider_event_id)
);
create table public.payment_provider_accounts (
  id uuid primary key default extensions.uuid_generate_v4(), institution_id uuid not null references public.institutions(id) on delete cascade, provider text not null default 'MOCK', status text not null default 'ACTIVE', external_account_id text, capabilities jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(institution_id, provider)
);
create table public.financial_reminder_settings (
  institution_id uuid primary key references public.institutions(id) on delete cascade, days_before_due integer not null default 3, days_after_due integer not null default 1, email_enabled boolean not null default false, in_app_enabled boolean not null default true
);
create index financial_contracts_institution_idx on public.financial_contracts(institution_id);
create index financial_contracts_student_idx on public.financial_contracts(student_id);
create index financial_contracts_responsible_idx on public.financial_contracts(financial_responsible_profile_id);
create index invoices_institution_status_due_idx on public.invoices(institution_id, status, due_date);
create index invoices_student_idx on public.invoices(student_id);
create index invoices_responsible_idx on public.invoices(financial_responsible_profile_id);
create index payments_invoice_idx on public.payments(invoice_id);

create or replace function public.create_financial_contract_with_invoices(
  p_institution_id uuid, p_student_id uuid, p_enrollment_id uuid, p_academic_year_id uuid, p_financial_responsible_profile_id uuid,
  p_base_amount bigint, p_enrollment_fee_amount bigint, p_installment_count integer, p_first_due_date date, p_default_due_day integer, p_notes text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_contract_id uuid; v_invoice_ids uuid[] := '{}'; v_due date; v_invoice_id uuid; v_amount bigint; v_index integer;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Autenticacao necessaria'; end if;
  if not exists (select 1 from public.memberships m where m.profile_id = auth.uid() and m.institution_id = p_institution_id and m.active and m.role in ('ADMIN','DIRECTOR','SECRETARY')) then raise exception using errcode = '42501', message = 'Sem permissao financeira'; end if;
  if not exists (select 1 from public.students s where s.id = p_student_id and s.institution_id = p_institution_id) then raise exception using errcode = '23503', message = 'Aluno nao pertence a instituicao'; end if;
  if not exists (select 1 from public.memberships m where m.profile_id = p_financial_responsible_profile_id and m.institution_id = p_institution_id and m.active) then raise exception using errcode = '23503', message = 'Responsavel financeiro invalido'; end if;
  insert into public.financial_contracts(institution_id, student_id, enrollment_id, academic_year_id, financial_responsible_profile_id, status, base_amount, enrollment_fee_amount, installment_count, first_due_date, default_due_day, notes)
    values (p_institution_id,p_student_id,p_enrollment_id,p_academic_year_id,p_financial_responsible_profile_id,'ACTIVE',p_base_amount,p_enrollment_fee_amount,p_installment_count,p_first_due_date,p_default_due_day,p_notes) returning id into v_contract_id;
  for v_index in 1..p_installment_count loop
    v_due := (date_trunc('month', p_first_due_date) + make_interval(months => v_index - 1) + ((least(p_default_due_day, extract(day from (date_trunc('month', p_first_due_date) + make_interval(months => v_index) - interval '1 day'))::integer) - 1) * interval '1 day'))::date;
    v_amount := p_base_amount / p_installment_count + case when v_index <= (p_base_amount % p_installment_count) then 1 else 0 end;
    insert into public.invoices(institution_id,contract_id,student_id,financial_responsible_profile_id,reference,due_date,base_amount,sequence_number) values (p_institution_id,v_contract_id,p_student_id,p_financial_responsible_profile_id,'Parcela ' || v_index,v_due,v_amount,v_index) returning id into v_invoice_id; v_invoice_ids := array_append(v_invoice_ids, v_invoice_id);
  end loop;
  return jsonb_build_object('contract_id', v_contract_id, 'invoice_ids', v_invoice_ids);
end; $$;

alter table public.financial_contracts enable row level security; alter table public.financial_contract_adjustments enable row level security; alter table public.invoices enable row level security; alter table public.payments enable row level security; alter table public.payment_events enable row level security; alter table public.payment_provider_accounts enable row level security; alter table public.financial_reminder_settings enable row level security;
create policy finance_contract_staff on public.financial_contracts for all using (exists (select 1 from public.memberships m where m.profile_id=auth.uid() and m.institution_id=financial_contracts.institution_id and m.active and m.role in ('ADMIN','DIRECTOR','SECRETARY'))) with check (exists (select 1 from public.memberships m where m.profile_id=auth.uid() and m.institution_id=financial_contracts.institution_id and m.active and m.role in ('ADMIN','DIRECTOR','SECRETARY')));
create policy finance_contract_guardian on public.financial_contracts for select using (financial_responsible_profile_id=auth.uid());
create policy finance_invoice_staff on public.invoices for all using (exists (select 1 from public.memberships m where m.profile_id=auth.uid() and m.institution_id=invoices.institution_id and m.active and m.role in ('ADMIN','DIRECTOR','SECRETARY'))) with check (exists (select 1 from public.memberships m where m.profile_id=auth.uid() and m.institution_id=invoices.institution_id and m.active and m.role in ('ADMIN','DIRECTOR','SECRETARY')));
create policy finance_invoice_guardian on public.invoices for select using (financial_responsible_profile_id=auth.uid());
create policy finance_payment_staff on public.payments for all using (exists (select 1 from public.memberships m where m.profile_id=auth.uid() and m.institution_id=payments.institution_id and m.active and m.role in ('ADMIN','DIRECTOR','SECRETARY'))) with check (exists (select 1 from public.memberships m where m.profile_id=auth.uid() and m.institution_id=payments.institution_id and m.active and m.role in ('ADMIN','DIRECTOR','SECRETARY')));
create policy finance_payment_guardian on public.payments for select using (exists (select 1 from public.invoices i where i.id=payments.invoice_id and i.financial_responsible_profile_id=auth.uid()));
create policy finance_provider_staff on public.payment_provider_accounts for select using (exists (select 1 from public.memberships m where m.profile_id=auth.uid() and m.institution_id=payment_provider_accounts.institution_id and m.active and m.role in ('ADMIN','DIRECTOR','SECRETARY')));
grant execute on function public.create_financial_contract_with_invoices(uuid,uuid,uuid,uuid,uuid,bigint,bigint,integer,date,integer,text) to authenticated;
