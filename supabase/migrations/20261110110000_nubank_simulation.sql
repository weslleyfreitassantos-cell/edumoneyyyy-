-- Nubank test adapter for the school-scoped remittance workflow.
--
-- Nubank's public Nu Empresas flow is app/web based. This migration deliberately
-- calls the provider NUBANK_SIMULATION and emits/imports a local JSON fixture; it
-- does not claim to be a Nubank production API or a CNAB file.
begin;

alter table public.finance_bank_configurations
  drop constraint if exists finance_bank_configurations_bank_code_check;
alter table public.finance_bank_configurations
  add constraint finance_bank_configurations_bank_code_check
  check (bank_code in ('033', '001', '104', '237', '260'));

alter table public.finance_remittance_batches
  drop constraint if exists finance_remittance_batches_bank_code_check;
alter table public.finance_remittance_batches
  add constraint finance_remittance_batches_bank_code_check
  check (bank_code in ('033', '260'));
alter table public.finance_remittance_batches
  drop constraint if exists finance_remittance_batches_format_check;
alter table public.finance_remittance_batches
  add constraint finance_remittance_batches_format_check
  check (format in ('CNAB240', 'NUBANK_SIMULATION'));

alter table public.finance_santander_return_files
  drop constraint if exists finance_santander_return_files_bank_code_check;
alter table public.finance_santander_return_files
  add constraint finance_santander_return_files_bank_code_check
  check (bank_code in ('033', '260'));

alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check
  check (provider in ('MOCK', 'MANUAL', 'SANTANDER', 'NUBANK_SIMULATION'));

-- Keep the same immutable balance rules for the simulated Nubank provider.
create or replace function private.finance_sync_payment_balance_v2()
returns trigger language plpgsql security definer set search_path = '' as $$
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
    if new.provider not in ('MANUAL', 'SANTANDER', 'NUBANK_SIMULATION') or new.status <> 'PAID' or new.paid_at is null
      or new.amount <= 0 or new.idempotency_key is null then
      raise exception using errcode = '22023', message = 'FINANCE_INVALID_PAYMENT';
    end if;
    v_delta := new.amount;
  end if;
  select * into v_invoice from public.invoices invoice
    where invoice.id = v_expected_invoice_id for update;
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

-- The original RPC is retained for Santander callers, but now selects the
-- configured provider and can reserve a Nubank simulation batch as well.
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
  v_total bigint := 0;
  v_file_name text;
  v_format text;
  v_action text;
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
  if not found then
    raise exception using errcode = '22023', message = 'FINANCE_INSTITUTION_NOT_FOUND';
  end if;
  select * into v_config from public.finance_bank_configurations where institution_id = p_institution_id for update;
  if not found or v_config.bank_code not in ('033', '260') then
    raise exception using errcode = '22023', message = 'FINANCE_BANK_CONFIGURATION_REQUIRED';
  end if;
  if v_institution.cnpj is null or length(regexp_replace(v_institution.cnpj, '\D', '', 'g')) not in (11, 14) then
    raise exception using errcode = '22023', message = 'FINANCE_INSTITUTION_CNPJ_REQUIRED';
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
      raise exception using errcode = '22023', message = 'FINANCE_INVOICE_NOT_ELIGIBLE';
    end if;
    if exists (select 1 from public.finance_remittance_batch_items where institution_id = p_institution_id and invoice_id = v_invoice.id) then
      raise exception using errcode = '23505', message = 'FINANCE_INVOICE_ALREADY_BATCHED';
    end if;
    select * into v_student from public.students where id = v_invoice.student_id and institution_id = p_institution_id;
    select * into v_responsible from public.profiles where id = v_invoice.financial_responsible_profile_id;
    select * into v_address from public.student_addresses where student_id = v_invoice.student_id and institution_id = p_institution_id order by updated_at desc limit 1;
    v_payer_document := regexp_replace(coalesce(v_student.cpf, ''), '\D', '', 'g');
    if length(v_payer_document) not in (11, 14) or v_address.postal_code is null or v_address.street is null or v_address.city is null or v_address.state is null then
      raise exception using errcode = '22023', message = 'FINANCE_PAYER_DATA_REQUIRED';
    end if;
    v_payer_name := left(btrim(v_responsible.full_name), 40);
    v_payer_address := left(btrim(concat_ws(' ', v_address.street, v_address.number, v_address.complement)), 40);
    v_payer_district := left(coalesce(btrim(v_address.neighborhood), 'CENTRO'), 15);
    v_payer_zip := regexp_replace(v_address.postal_code, '\D', '', 'g');
    v_payer_city := left(btrim(v_address.city), 15);
    v_payer_state := upper(left(btrim(v_address.state), 2));
    if length(v_payer_zip) <> 8 or v_payer_state !~ '^[A-Z]{2}$' then
      raise exception using errcode = '22023', message = 'FINANCE_PAYER_ADDRESS_INVALID';
    end if;
    v_total := v_total + v_balance;
    v_index := v_index + 1;
  end loop;
  if v_index <> v_count then
    raise exception using errcode = '22023', message = 'FINANCE_INVOICE_SELECTION_INVALID';
  end if;

  v_format := case when v_config.bank_code = '260' then 'NUBANK_SIMULATION' else 'CNAB240' end;
  v_action := case when v_config.bank_code = '260' then 'FINANCE_NUBANK_SIMULATION_BATCH_GENERATED' else 'FINANCE_SANTANDER_BATCH_GENERATED' end;
  v_file_name := case
    when v_config.bank_code = '260' then format('nubank-simulation-%s-%s.json', to_char(current_date, 'YYYYMMDD'), lpad(v_seq::text, 6, '0'))
    else format('santander-%s-%s.rem', to_char(current_date, 'YYYYMMDD'), lpad(v_seq::text, 6, '0'))
  end;
  insert into public.finance_remittance_batches(institution_id, bank_code, format, sequence_number, invoice_count, total_amount_cents, file_name, generated_by, metadata)
  values (p_institution_id, v_config.bank_code, v_format, v_seq, v_count, v_total, v_file_name, v_actor,
    jsonb_build_object('idempotency_key', btrim(p_idempotency_key), 'bank_code', v_config.bank_code, 'format', v_format, 'simulation', v_config.bank_code = '260'))
  returning id into v_batch_id;

  v_index := v_count + 1;
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
    v_index := v_index - 1;
    insert into public.finance_remittance_batch_items(institution_id, batch_id, invoice_id, our_number, amount_cents, due_date, document_number, payer_name, payer_document, payer_address, payer_district, payer_zip, payer_city, payer_state)
    values (p_institution_id, v_batch_id, v_invoice.id, lpad((v_seq * 10000 + v_index)::text, 13, '0'), v_balance, v_invoice.due_date, left(v_invoice.reference, 15), v_payer_name, v_payer_document, v_payer_address, v_payer_district, v_payer_zip, v_payer_city, v_payer_state);
    v_item := jsonb_build_object('invoice_id', v_invoice.id, 'our_number', lpad((v_seq * 10000 + v_index)::text, 13, '0'), 'amount_cents', v_balance, 'due_date', v_invoice.due_date, 'document_number', left(v_invoice.reference, 15), 'payer_name', v_payer_name, 'payer_document', v_payer_document, 'payer_address', v_payer_address, 'payer_district', v_payer_district, 'payer_zip', v_payer_zip, 'payer_city', v_payer_city, 'payer_state', v_payer_state);
    v_items := v_items || jsonb_build_array(v_item);
  end loop;
  insert into public.finance_audit_events(institution_id, actor_id, action, entity_type, entity_id, idempotency_key, details)
  values (p_institution_id, v_actor, v_action, 'REMITTANCE_BATCH', v_batch_id, btrim(p_idempotency_key), jsonb_build_object('invoice_count', v_count, 'total_amount_cents', v_total, 'bank_code', v_config.bank_code, 'simulation', v_config.bank_code = '260'));
  return jsonb_build_object('replayed', false, 'batch_id', v_batch_id, 'file_name', v_file_name, 'sequence_number', v_seq, 'invoice_count', v_count, 'total_amount_cents', v_total, 'bank_code', v_config.bank_code, 'format', v_format, 'simulation', v_config.bank_code = '260', 'bank_configuration', jsonb_build_object('agency', v_config.agency, 'agency_digit', v_config.agency_digit, 'account_number', v_config.account_number, 'account_digit', v_config.account_digit, 'agreement', v_config.agreement, 'transmission_code', coalesce(nullif(v_config.transmission_code, ''), v_config.agreement), 'wallet', v_config.wallet, 'document', regexp_replace(v_institution.cnpj, '\D', '', 'g'), 'company', v_institution.name), 'items', v_items);
end;
$$;

revoke all on function public.finance_create_santander_remittance_batch(uuid, uuid[], text) from public, anon;
grant execute on function public.finance_create_santander_remittance_batch(uuid, uuid[], text) to authenticated;

create or replace function public.finance_create_nubank_simulation_batch(
  p_institution_id uuid,
  p_invoice_ids uuid[],
  p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.finance_bank_configurations
    where institution_id = p_institution_id and bank_code = '260'
  ) then
    raise exception using errcode = '22023', message = 'NUBANK_BANK_CONFIGURATION_REQUIRED';
  end if;
  return public.finance_create_santander_remittance_batch(p_institution_id, p_invoice_ids, p_idempotency_key);
end;
$$;

revoke all on function public.finance_create_nubank_simulation_batch(uuid, uuid[], text) from public, anon;
grant execute on function public.finance_create_nubank_simulation_batch(uuid, uuid[], text) to authenticated;

create or replace function public.finance_mark_nubank_simulation_exported(
  p_institution_id uuid,
  p_batch_id uuid,
  p_file_hash text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.finance_remittance_batches
    where id = p_batch_id and institution_id = p_institution_id and bank_code = '260'
  ) then
    raise exception using errcode = '22023', message = 'NUBANK_BATCH_REQUIRED';
  end if;
  perform public.finance_mark_santander_remittance_exported(p_institution_id, p_batch_id, p_file_hash);
end;
$$;

revoke all on function public.finance_mark_nubank_simulation_exported(uuid, uuid, text) from public, anon;
grant execute on function public.finance_mark_nubank_simulation_exported(uuid, uuid, text) to authenticated;

-- Keep the legacy Santander RPC compatible while recording the correct audit
-- action when it is reached through the Nubank wrapper.
create or replace function public.finance_mark_santander_remittance_exported(
  p_institution_id uuid,
  p_batch_id uuid,
  p_file_hash text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_batch public.finance_remittance_batches%rowtype;
  v_action text;
begin
  if v_actor is null or not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  if p_file_hash is null or p_file_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'FINANCE_INVALID_FILE_HASH';
  end if;
  select * into v_batch from public.finance_remittance_batches
    where id = p_batch_id and institution_id = p_institution_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'FINANCE_BATCH_NOT_FOUND';
  end if;
  if v_batch.status = 'CANCELLED' then
    raise exception using errcode = '22023', message = 'FINANCE_BATCH_CANCELLED';
  end if;
  if v_batch.file_hash is not null and v_batch.file_hash <> lower(p_file_hash) then
    raise exception using errcode = '22023', message = 'FINANCE_BATCH_EXPORT_HASH_MISMATCH';
  end if;
  update public.finance_remittance_batches set
    status = case when status = 'GENERATED' then 'EXPORTED' else status end,
    file_hash = lower(p_file_hash), exported_at = coalesce(exported_at, now()),
    metadata = metadata || jsonb_build_object('exported_file_hash', lower(p_file_hash))
    where id = p_batch_id;
  v_action := case when v_batch.bank_code = '260' then 'FINANCE_NUBANK_SIMULATION_BATCH_EXPORTED' else 'FINANCE_SANTANDER_BATCH_EXPORTED' end;
  insert into public.finance_audit_events(institution_id, actor_id, action, entity_type, entity_id, idempotency_key, details)
    values (p_institution_id, v_actor, v_action, 'REMITTANCE_BATCH', p_batch_id,
      'export:' || p_batch_id::text, jsonb_build_object('file_hash', lower(p_file_hash), 'bank_code', v_batch.bank_code, 'simulation', v_batch.bank_code = '260'))
    on conflict (institution_id, idempotency_key) do nothing;
end;
$$;

revoke all on function public.finance_mark_santander_remittance_exported(uuid, uuid, text) from public, anon;
grant execute on function public.finance_mark_santander_remittance_exported(uuid, uuid, text) to authenticated;

-- Generic private importer used by both the real Santander parser and the
-- local Nubank fixture parser. The table name is kept for backwards schema
-- compatibility with the first Santander migration.
create or replace function private.finance_import_bank_return(
  p_institution_id uuid,
  p_file_hash text,
  p_occurrences jsonb,
  p_bank_code text,
  p_provider text,
  p_invalid_file_message text,
  p_audit_action text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_file public.finance_santander_return_files%rowtype;
  v_occurrence jsonb;
  v_occurrence_id uuid;
  v_batch_item public.finance_remittance_batch_items%rowtype;
  v_invoice public.invoices%rowtype;
  v_payment_id uuid;
  v_event_id text;
  v_our_number text;
  v_status text;
  v_event_type text;
  v_amount bigint;
  v_paid_at timestamptz;
  v_applied integer := 0;
  v_review integer := 0;
  v_duplicate integer := 0;
  v_total integer := 0;
  v_reason text;
begin
  if v_actor is null or not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  if p_bank_code not in ('033', '260') or p_provider not in ('SANTANDER', 'NUBANK_SIMULATION')
    or p_file_hash is null or p_file_hash !~ '^[0-9a-f]{64}$' or jsonb_typeof(p_occurrences) <> 'array'
    or jsonb_array_length(p_occurrences) > 9999 then
    raise exception using errcode = '22023', message = p_invalid_file_message;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_institution_id::text || ':' || p_bank_code || ':' || p_file_hash, 0));
  select * into v_file from public.finance_santander_return_files
    where institution_id = p_institution_id and file_hash = lower(p_file_hash) and bank_code = p_bank_code for update;
  if found then
    return jsonb_build_object('replayed', true, 'return_file_id', v_file.id, 'occurrence_count', v_file.occurrence_count, 'applied_count', v_file.applied_count, 'review_count', v_file.review_count);
  end if;
  insert into public.finance_santander_return_files(institution_id, file_hash, bank_code, occurrence_count, imported_by)
    values (p_institution_id, lower(p_file_hash), p_bank_code, jsonb_array_length(p_occurrences), v_actor)
    returning * into v_file;

  for v_occurrence in select value from jsonb_array_elements(p_occurrences) loop
    v_total := v_total + 1;
    v_event_id := nullif(btrim(v_occurrence->>'provider_event_id'), '');
    v_our_number := nullif(btrim(v_occurrence->>'our_number'), '');
    v_status := upper(coalesce(nullif(btrim(v_occurrence->>'status'), ''), 'PENDING_REVIEW'));
    v_event_type := upper(coalesce(nullif(btrim(v_occurrence->>'event_type'), ''), 'UNKNOWN'));
    begin
      v_amount := nullif(v_occurrence->>'amount_cents', '')::bigint;
    exception when invalid_text_representation or numeric_value_out_of_range then
      v_amount := null;
    end;
    begin
      v_paid_at := nullif(v_occurrence->>'paid_at', '')::timestamptz;
    exception when invalid_datetime_format or datetime_field_overflow then
      v_paid_at := null;
    end;
    v_reason := null;
    v_batch_item := null;
    v_invoice := null;
    v_payment_id := null;
    if v_event_id is null or length(v_event_id) > 180 then
      v_event_id := left(p_file_hash || ':' || v_total, 180);
      v_reason := 'Identificador bancário ausente.';
    end if;
    if v_our_number is not null then
      select item.* into v_batch_item from public.finance_remittance_batch_items item
        join public.finance_remittance_batches batch on batch.id = item.batch_id
          and batch.institution_id = item.institution_id and batch.bank_code = p_bank_code
        where item.institution_id = p_institution_id and item.our_number = v_our_number
        order by item.created_at desc limit 1;
      if found then
        select * into v_invoice from public.invoices invoice where invoice.id = v_batch_item.invoice_id for update;
      else
        v_reason := coalesce(v_reason || ' ', '') || 'Nosso número não encontrado em lote desta instituição.';
      end if;
    else
      v_reason := coalesce(v_reason || ' ', '') || 'Nosso número ausente.';
    end if;
    if v_reason is null and (v_status not in ('SETTLED', 'PAID', 'LIQUIDATED', '06') or v_amount is null or v_amount <= 0 or v_paid_at is null) then
      v_reason := 'Ocorrência não é uma liquidação válida para baixa automática.';
    end if;
    if v_reason is null and v_amount > greatest(0, private.finance_invoice_amount_due_now(v_invoice.id) - v_invoice.amount_paid) then
      v_reason := 'Valor recebido acima do saldo aberto; revisão necessária.';
    end if;
    if exists (select 1 from public.finance_santander_return_occurrences occurrence where institution_id = p_institution_id and provider_event_id = v_event_id)
      or exists (select 1 from public.payment_events where provider = p_provider and provider_event_id = v_event_id) then
      insert into public.finance_santander_return_occurrences(institution_id, return_file_id, batch_item_id, invoice_id, provider_event_id, our_number, occurrence_code, event_type, amount_cents, paid_at, status, review_reason)
      values (p_institution_id, v_file.id, nullif(v_batch_item.id, null), nullif(v_invoice.id, null), v_event_id, v_our_number, v_occurrence->>'occurrence_code', v_event_type, v_amount, v_paid_at, 'DUPLICATE', 'Ocorrência já processada anteriormente.')
      on conflict (institution_id, provider_event_id) do nothing;
      v_duplicate := v_duplicate + 1;
      continue;
    end if;
    if v_reason is null then
      insert into public.payments(institution_id, invoice_id, provider, provider_payment_id, method, amount, status, paid_at, registered_by, notes, idempotency_key)
      values (p_institution_id, v_invoice.id, p_provider, v_event_id, 'BOLETO', v_amount, 'PAID', v_paid_at, v_actor, 'Baixa conciliada por retorno bancário.', lower(p_provider) || ':' || v_event_id)
      returning id into v_payment_id;
      v_status := 'APPLIED';
      v_applied := v_applied + 1;
    else
      v_status := case when v_event_type = 'REJECTED' then 'REJECTED' else 'PENDING_REVIEW' end;
      v_review := v_review + 1;
    end if;
    insert into public.finance_santander_return_occurrences(institution_id, return_file_id, batch_item_id, invoice_id, provider_event_id, our_number, occurrence_code, event_type, amount_cents, paid_at, raw_segment_t, raw_segment_u, status, review_reason, payment_id)
    values (p_institution_id, v_file.id, nullif(v_batch_item.id, null), nullif(v_invoice.id, null), v_event_id, v_our_number, v_occurrence->>'occurrence_code', v_event_type, v_amount, v_paid_at, v_occurrence->>'raw_segment_t', v_occurrence->>'raw_segment_u', v_status, v_reason, v_payment_id)
    returning id into v_occurrence_id;
    if v_payment_id is not null then
      insert into public.payment_events(institution_id, payment_id, provider, provider_event_id, event_type, payload_hash, processed_at)
      values (p_institution_id, v_payment_id, p_provider, v_event_id, v_event_type, p_file_hash, now());
    end if;
  end loop;
  update public.finance_santander_return_files set
    applied_count = v_applied, review_count = v_review,
    status = case when v_review > 0 then case when v_applied > 0 then 'PARTIALLY_APPLIED' else 'REVIEW_REQUIRED' end when v_applied = v_total then 'APPLIED' else 'IMPORTED' end
    where id = v_file.id;
  insert into public.finance_audit_events(institution_id, actor_id, action, entity_type, entity_id, idempotency_key, details)
    values (p_institution_id, v_actor, p_audit_action, 'BANK_RETURN_FILE', v_file.id, 'return:' || p_provider || ':' || p_file_hash, jsonb_build_object('occurrence_count', v_total, 'applied_count', v_applied, 'review_count', v_review, 'duplicate_count', v_duplicate, 'bank_code', p_bank_code));
  return jsonb_build_object('replayed', false, 'return_file_id', v_file.id, 'occurrence_count', v_total, 'applied_count', v_applied, 'review_count', v_review, 'duplicate_count', v_duplicate);
end;
$$;

create or replace function public.finance_import_santander_return(
  p_institution_id uuid, p_file_hash text, p_occurrences jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  return private.finance_import_bank_return(p_institution_id, p_file_hash, p_occurrences, '033', 'SANTANDER', 'SANTANDER_RETURN_INVALID_FILE', 'FINANCE_SANTANDER_RETURN_IMPORTED');
end;
$$;

create or replace function public.finance_import_nubank_simulation_return(
  p_institution_id uuid, p_file_hash text, p_occurrences jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  return private.finance_import_bank_return(p_institution_id, p_file_hash, p_occurrences, '260', 'NUBANK_SIMULATION', 'NUBANK_SIMULATION_INVALID_FILE', 'FINANCE_NUBANK_SIMULATION_RETURN_IMPORTED');
end;
$$;

revoke all on function public.finance_import_santander_return(uuid, text, jsonb) from public, anon;
revoke all on function public.finance_import_nubank_simulation_return(uuid, text, jsonb) from public, anon;
grant execute on function public.finance_import_santander_return(uuid, text, jsonb) to authenticated;
grant execute on function public.finance_import_nubank_simulation_return(uuid, text, jsonb) to authenticated;

create or replace function private.finance_list_bank_return_occurrences(
  p_institution_id uuid, p_bank_code text, p_status text, p_page integer, p_page_size integer
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_page integer := greatest(1, coalesce(p_page, 1));
  v_size integer := least(100, greatest(1, coalesce(p_page_size, 20)));
  v_total bigint;
  v_rows jsonb;
begin
  if v_actor is null or not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  if p_bank_code not in ('033', '260') or coalesce(p_status, '') <> '' and p_status not in ('APPLIED', 'PENDING_REVIEW', 'REJECTED', 'DUPLICATE') then
    raise exception using errcode = '22023', message = 'FINANCE_INVALID_RETURN_FILTER';
  end if;
  select count(*) into v_total
    from public.finance_santander_return_occurrences occurrence
    join public.finance_santander_return_files return_file on return_file.id = occurrence.return_file_id
    where occurrence.institution_id = p_institution_id and return_file.bank_code = p_bank_code
      and (coalesce(p_status, '') = '' or occurrence.status = p_status);
  select coalesce(jsonb_agg(to_jsonb(page_rows) order by page_rows.created_at desc), '[]'::jsonb)
    into v_rows
    from (
      select occurrence.id, occurrence.return_file_id, occurrence.invoice_id,
        invoice.reference, occurrence.provider_event_id, occurrence.our_number,
        occurrence.occurrence_code, occurrence.event_type, occurrence.amount_cents,
        occurrence.paid_at, occurrence.status, occurrence.review_reason, occurrence.created_at
      from public.finance_santander_return_occurrences occurrence
      join public.finance_santander_return_files return_file on return_file.id = occurrence.return_file_id
      left join public.invoices invoice on invoice.id = occurrence.invoice_id and invoice.institution_id = occurrence.institution_id
      where occurrence.institution_id = p_institution_id and return_file.bank_code = p_bank_code
        and (coalesce(p_status, '') = '' or occurrence.status = p_status)
      order by occurrence.created_at desc
      limit v_size offset (v_page - 1) * v_size
    ) page_rows;
  return jsonb_build_object('rows', v_rows, 'total_count', v_total, 'page', v_page, 'page_size', v_size);
end;
$$;

create or replace function public.finance_list_santander_return_occurrences(
  p_institution_id uuid, p_status text, p_page integer, p_page_size integer
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  return private.finance_list_bank_return_occurrences(p_institution_id, '033', p_status, p_page, p_page_size);
end;
$$;

create or replace function public.finance_list_nubank_simulation_occurrences(
  p_institution_id uuid, p_status text, p_page integer, p_page_size integer
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  return private.finance_list_bank_return_occurrences(p_institution_id, '260', p_status, p_page, p_page_size);
end;
$$;

revoke all on function public.finance_list_santander_return_occurrences(uuid, text, integer, integer) from public, anon;
revoke all on function public.finance_list_nubank_simulation_occurrences(uuid, text, integer, integer) from public, anon;
grant execute on function public.finance_list_santander_return_occurrences(uuid, text, integer, integer) to authenticated;
grant execute on function public.finance_list_nubank_simulation_occurrences(uuid, text, integer, integer) to authenticated;

commit;
