-- Persistent Santander CNAB 240 batches.
-- This migration only prepares and reserves invoices. It does not submit files
-- to Santander; transmission and return processing are separate stages.
begin;

create table public.finance_remittance_batches (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  bank_code text not null check (bank_code = '033'),
  format text not null default 'CNAB240' check (format = 'CNAB240'),
  status text not null default 'GENERATED'
    check (status in ('GENERATED', 'EXPORTED', 'SENT', 'RETURNED', 'CANCELLED')),
  sequence_number bigint not null,
  invoice_count integer not null check (invoice_count > 0),
  total_amount_cents bigint not null check (total_amount_cents > 0),
  file_name text not null,
  generated_by uuid not null references public.profiles(id),
  generated_at timestamptz not null default now(),
  exported_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (institution_id, sequence_number),
  unique (institution_id, file_name)
);

create table public.finance_remittance_batch_items (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  batch_id uuid not null references public.finance_remittance_batches(id) on delete cascade,
  invoice_id uuid not null,
  our_number text not null,
  amount_cents bigint not null check (amount_cents > 0),
  due_date date not null,
  document_number text not null,
  payer_name text not null,
  payer_document text not null,
  payer_address text not null,
  payer_district text not null,
  payer_zip text not null,
  payer_city text not null,
  payer_state text not null check (payer_state ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(),
  unique (institution_id, invoice_id),
  foreign key (institution_id, invoice_id)
    references public.invoices(institution_id, id) on delete restrict
);

create index finance_remittance_batches_institution_created_idx
  on public.finance_remittance_batches(institution_id, generated_at desc);
create index finance_remittance_batch_items_batch_idx
  on public.finance_remittance_batch_items(batch_id, invoice_id);

alter table public.finance_remittance_batches enable row level security;
alter table public.finance_remittance_batch_items enable row level security;
revoke all on public.finance_remittance_batches, public.finance_remittance_batch_items
  from public, anon, authenticated;

create or replace function public.finance_create_santander_remittance_batch(
  p_institution_id uuid,
  p_invoice_ids uuid[],
  p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_batch_id uuid;
  v_seq bigint;
  v_count integer;
  v_total bigint;
  v_file_name text;
  v_institution public.institutions%rowtype;
  v_config public.finance_bank_configurations%rowtype;
  v_invoice public.invoices%rowtype;
  v_balance bigint;
  v_index integer := 0;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_existing uuid;
  v_address public.student_addresses%rowtype;
  v_student public.students%rowtype;
  v_responsible public.profiles%rowtype;
  v_payer_document text;
  v_payer_name text;
  v_payer_address text;
  v_payer_district text;
  v_payer_zip text;
  v_payer_city text;
  v_payer_state text;
begin
  if v_actor is null or not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  if p_invoice_ids is null or cardinality(p_invoice_ids) = 0
    or cardinality(p_invoice_ids) > 9999 then
    raise exception using errcode = '22023', message = 'FINANCE_INVALID_BATCH_SIZE';
  end if;
  if length(btrim(coalesce(p_idempotency_key, ''))) not between 8 and 160 then
    raise exception using errcode = '22023', message = 'FINANCE_INVALID_IDEMPOTENCY_KEY';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_institution_id::text || ':' || btrim(p_idempotency_key), 0));
  select id into v_existing from public.finance_audit_events
    where institution_id = p_institution_id and idempotency_key = btrim(p_idempotency_key);
  if v_existing is not null then
    return jsonb_build_object('replayed', true, 'batch_id', (select entity_id from public.finance_audit_events where id = v_existing));
  end if;

  select * into v_institution from public.institutions where id = p_institution_id and active;
  if not found then raise exception using errcode = '22023', message = 'FINANCE_INSTITUTION_NOT_FOUND'; end if;
  select * into v_config from public.finance_bank_configurations where institution_id = p_institution_id for update;
  if not found or v_config.bank_code <> '033' then
    raise exception using errcode = '22023', message = 'SANTANDER_BANK_CONFIGURATION_REQUIRED';
  end if;
  if v_institution.cnpj is null or length(regexp_replace(v_institution.cnpj, '\D', '', 'g')) not in (11, 14) then
    raise exception using errcode = '22023', message = 'SANTANDER_INSTITUTION_CNPJ_REQUIRED';
  end if;

  select coalesce(max(sequence_number), 0) + 1 into v_seq
    from public.finance_remittance_batches where institution_id = p_institution_id;
  v_count := cardinality(p_invoice_ids);

  for v_invoice in
    select * from public.invoices
    where institution_id = p_institution_id and id = any(p_invoice_ids)
    order by id for update
  loop
    v_balance := greatest(v_invoice.amount_due - v_invoice.amount_paid, 0);
    if v_invoice.status in ('DRAFT', 'CANCELLED', 'PAID') or v_balance <= 0 then
      raise exception using errcode = '22023', message = 'SANTANDER_INVOICE_NOT_ELIGIBLE';
    end if;
    if exists (select 1 from public.finance_remittance_batch_items where institution_id = p_institution_id and invoice_id = v_invoice.id) then
      raise exception using errcode = '23505', message = 'SANTANDER_INVOICE_ALREADY_BATCHED';
    end if;
    select * into v_student from public.students where id = v_invoice.student_id and institution_id = p_institution_id;
    select * into v_responsible from public.profiles where id = v_invoice.financial_responsible_profile_id;
    select * into v_address from public.student_addresses where student_id = v_invoice.student_id and institution_id = p_institution_id order by updated_at desc limit 1;
    v_payer_document := regexp_replace(coalesce(v_student.cpf, ''), '\D', '', 'g');
    if length(v_payer_document) not in (11, 14) or v_address.postal_code is null or v_address.street is null or v_address.city is null or v_address.state is null then
      raise exception using errcode = '22023', message = 'SANTANDER_PAYER_DATA_REQUIRED';
    end if;
    v_payer_name := left(btrim(v_responsible.full_name), 40);
    v_payer_address := left(btrim(concat_ws(' ', v_address.street, v_address.number, v_address.complement)), 40);
    v_payer_district := left(coalesce(btrim(v_address.neighborhood), 'CENTRO'), 15);
    v_payer_zip := regexp_replace(v_address.postal_code, '\D', '', 'g');
    v_payer_city := left(btrim(v_address.city), 15);
    v_payer_state := upper(left(btrim(v_address.state), 2));
    if length(v_payer_zip) <> 8 or v_payer_state !~ '^[A-Z]{2}$' then
      raise exception using errcode = '22023', message = 'SANTANDER_PAYER_ADDRESS_INVALID';
    end if;
    v_total := coalesce(v_total, 0) + v_balance;
    v_index := v_index + 1;
  end loop;
  if v_index <> v_count then raise exception using errcode = '22023', message = 'SANTANDER_INVOICE_SELECTION_INVALID'; end if;

  v_file_name := format('santander-%s-%s.rem', to_char(current_date, 'YYYYMMDD'), lpad(v_seq::text, 6, '0'));
  insert into public.finance_remittance_batches(institution_id, bank_code, format, sequence_number, invoice_count, total_amount_cents, file_name, generated_by, metadata)
  values (p_institution_id, '033', 'CNAB240', v_seq, v_count, v_total, v_file_name, v_actor,
    jsonb_build_object('idempotency_key', btrim(p_idempotency_key), 'bank_code', '033', 'format', 'CNAB240'))
  returning id into v_batch_id;

  for v_invoice in select * from public.invoices where institution_id = p_institution_id and id = any(p_invoice_ids) order by id loop
    v_balance := greatest(v_invoice.amount_due - v_invoice.amount_paid, 0);
    select * into v_student from public.students where id = v_invoice.student_id;
    select * into v_responsible from public.profiles where id = v_invoice.financial_responsible_profile_id;
    select * into v_address from public.student_addresses where student_id = v_invoice.student_id and institution_id = p_institution_id order by updated_at desc limit 1;
    v_payer_document := regexp_replace(v_student.cpf, '\D', '', 'g');
    v_payer_name := left(btrim(v_responsible.full_name), 40);
    v_payer_address := left(btrim(concat_ws(' ', v_address.street, v_address.number, v_address.complement)), 40);
    v_payer_district := left(coalesce(btrim(v_address.neighborhood), 'CENTRO'), 15);
    v_payer_zip := regexp_replace(v_address.postal_code, '\D', '', 'g');
    v_payer_city := left(btrim(v_address.city), 15);
    v_payer_state := upper(left(btrim(v_address.state), 2));
    insert into public.finance_remittance_batch_items(institution_id, batch_id, invoice_id, our_number, amount_cents, due_date, document_number, payer_name, payer_document, payer_address, payer_district, payer_zip, payer_city, payer_state)
    values (p_institution_id, v_batch_id, v_invoice.id, lpad((v_seq * 10000 + v_index)::text, 13, '0'), v_balance, v_invoice.due_date, left(v_invoice.reference, 15), v_payer_name, v_payer_document, v_payer_address, v_payer_district, v_payer_zip, v_payer_city, v_payer_state);
    v_item := jsonb_build_object('invoice_id', v_invoice.id, 'our_number', lpad((v_seq * 10000 + v_index)::text, 13, '0'), 'amount_cents', v_balance, 'due_date', v_invoice.due_date, 'document_number', left(v_invoice.reference, 15), 'payer_name', v_payer_name, 'payer_document', v_payer_document, 'payer_address', v_payer_address, 'payer_district', v_payer_district, 'payer_zip', v_payer_zip, 'payer_city', v_payer_city, 'payer_state', v_payer_state);
    v_items := v_items || jsonb_build_array(v_item);
    v_index := v_index - 1;
  end loop;
  insert into public.finance_audit_events(institution_id, actor_id, action, entity_type, entity_id, idempotency_key, details)
  values (p_institution_id, v_actor, 'FINANCE_SANTANDER_BATCH_GENERATED', 'REMITTANCE_BATCH', v_batch_id, btrim(p_idempotency_key), jsonb_build_object('invoice_count', v_count, 'total_amount_cents', v_total));
  return jsonb_build_object('replayed', false, 'batch_id', v_batch_id, 'file_name', v_file_name, 'sequence_number', v_seq, 'invoice_count', v_count, 'total_amount_cents', v_total, 'bank_configuration', jsonb_build_object('agency', v_config.agency, 'agency_digit', v_config.agency_digit, 'account_number', v_config.account_number, 'account_digit', v_config.account_digit, 'agreement', v_config.agreement, 'transmission_code', coalesce(nullif(v_config.transmission_code, ''), v_config.agreement), 'wallet', v_config.wallet, 'document', regexp_replace(v_institution.cnpj, '\D', '', 'g'), 'company', v_institution.name), 'items', v_items);
end;
$$;

revoke all on function public.finance_create_santander_remittance_batch(uuid, uuid[], text) from public, anon;
grant execute on function public.finance_create_santander_remittance_batch(uuid, uuid[], text) to authenticated;

commit;
