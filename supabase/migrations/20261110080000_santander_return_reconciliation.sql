-- Santander CNAB 240 return import and conservative reconciliation.
begin;

alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check
  check (provider in ('MOCK', 'MANUAL', 'SANTANDER'));

-- The existing balance trigger deliberately accepts only manual payments. This
-- replacement keeps the same immutable-history rules for bank-originated ones.
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
    if new.provider not in ('MANUAL', 'SANTANDER') or new.status <> 'PAID' or new.paid_at is null
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

create table public.finance_santander_return_files (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  file_hash text not null check (file_hash ~ '^[0-9a-f]{64}$'),
  bank_code text not null default '033' check (bank_code = '033'),
  status text not null default 'IMPORTED'
    check (status in ('IMPORTED', 'PARTIALLY_APPLIED', 'APPLIED', 'REVIEW_REQUIRED')),
  occurrence_count integer not null check (occurrence_count >= 0),
  applied_count integer not null default 0 check (applied_count >= 0),
  review_count integer not null default 0 check (review_count >= 0),
  imported_by uuid not null references public.profiles(id),
  imported_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (institution_id, file_hash)
);

-- The batch item id is globally unique, but this composite key keeps every
-- reconciliation join tenant-scoped at the database constraint level.
alter table public.finance_remittance_batch_items
  add constraint finance_remittance_batch_items_institution_id_unique
  unique (institution_id, id);

create table public.finance_santander_return_occurrences (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  return_file_id uuid not null references public.finance_santander_return_files(id) on delete cascade,
  batch_item_id uuid references public.finance_remittance_batch_items(id) on delete restrict,
  invoice_id uuid references public.invoices(id) on delete restrict,
  provider_event_id text not null,
  our_number text,
  occurrence_code text,
  event_type text not null,
  amount_cents bigint check (amount_cents is null or amount_cents > 0),
  paid_at timestamptz,
  raw_segment_t text,
  raw_segment_u text,
  status text not null default 'PENDING_REVIEW'
    check (status in ('APPLIED', 'PENDING_REVIEW', 'REJECTED', 'DUPLICATE')),
  review_reason text,
  payment_id uuid references public.payments(id),
  created_at timestamptz not null default now(),
  unique (institution_id, provider_event_id),
  foreign key (institution_id, batch_item_id)
    references public.finance_remittance_batch_items(institution_id, id),
  foreign key (institution_id, invoice_id)
    references public.invoices(institution_id, id)
);

create index finance_santander_return_occurrences_review_idx
  on public.finance_santander_return_occurrences(institution_id, status, created_at desc);

alter table public.finance_santander_return_files enable row level security;
alter table public.finance_santander_return_occurrences enable row level security;
revoke all on public.finance_santander_return_files, public.finance_santander_return_occurrences
  from public, anon, authenticated;

create or replace function public.finance_import_santander_return(
  p_institution_id uuid,
  p_file_hash text,
  p_occurrences jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_file public.finance_santander_return_files%rowtype;
  v_occurrence jsonb;
  v_occurrence_id uuid;
  v_batch_item public.finance_remittance_batch_items%rowtype;
  v_invoice public.invoices%rowtype;
  v_payment public.payments%rowtype;
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
  if p_file_hash is null or p_file_hash !~ '^[0-9a-f]{64}$' or jsonb_typeof(p_occurrences) <> 'array'
    or jsonb_array_length(p_occurrences) > 9999 then
    raise exception using errcode = '22023', message = 'SANTANDER_RETURN_INVALID_FILE';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_institution_id::text || ':' || p_file_hash, 0));
  select * into v_file from public.finance_santander_return_files
    where institution_id = p_institution_id and file_hash = lower(p_file_hash) for update;
  if found then
    return jsonb_build_object('replayed', true, 'return_file_id', v_file.id, 'occurrence_count', v_file.occurrence_count, 'applied_count', v_file.applied_count, 'review_count', v_file.review_count);
  end if;
  insert into public.finance_santander_return_files(institution_id, file_hash, occurrence_count, imported_by)
    values (p_institution_id, lower(p_file_hash), jsonb_array_length(p_occurrences), v_actor)
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
      select * into v_batch_item from public.finance_remittance_batch_items item
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
    if exists (select 1 from public.finance_santander_return_occurrences where institution_id = p_institution_id and provider_event_id = v_event_id)
      or exists (select 1 from public.payment_events where provider = 'SANTANDER' and provider_event_id = v_event_id) then
      insert into public.finance_santander_return_occurrences(institution_id, return_file_id, batch_item_id, invoice_id, provider_event_id, our_number, occurrence_code, event_type, amount_cents, paid_at, status, review_reason)
      values (p_institution_id, v_file.id, nullif(v_batch_item.id, null), nullif(v_invoice.id, null), v_event_id, v_our_number, v_occurrence->>'occurrence_code', v_event_type, v_amount, v_paid_at, 'DUPLICATE', 'Ocorrência já processada anteriormente.')
      on conflict (institution_id, provider_event_id) do nothing;
      v_duplicate := v_duplicate + 1;
      continue;
    end if;
    if v_reason is null then
      insert into public.payments(institution_id, invoice_id, provider, provider_payment_id, method, amount, status, paid_at, registered_by, notes, idempotency_key)
      values (p_institution_id, v_invoice.id, 'SANTANDER', v_event_id, 'BOLETO', v_amount, 'PAID', v_paid_at, v_actor, 'Baixa conciliada por retorno Santander.', 'santander:' || v_event_id)
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
      values (p_institution_id, v_payment_id, 'SANTANDER', v_event_id, v_event_type, p_file_hash, now());
    end if;
  end loop;
  update public.finance_santander_return_files set
    applied_count = v_applied, review_count = v_review,
    status = case when v_review > 0 then case when v_applied > 0 then 'PARTIALLY_APPLIED' else 'REVIEW_REQUIRED' end when v_applied = v_total then 'APPLIED' else 'IMPORTED' end
    where id = v_file.id;
  insert into public.finance_audit_events(institution_id, actor_id, action, entity_type, entity_id, idempotency_key, details)
    values (p_institution_id, v_actor, 'FINANCE_SANTANDER_RETURN_IMPORTED', 'SANTANDER_RETURN_FILE', v_file.id, 'return:' || p_file_hash, jsonb_build_object('occurrence_count', v_total, 'applied_count', v_applied, 'review_count', v_review, 'duplicate_count', v_duplicate));
  return jsonb_build_object('replayed', false, 'return_file_id', v_file.id, 'occurrence_count', v_total, 'applied_count', v_applied, 'review_count', v_review, 'duplicate_count', v_duplicate);
end;
$$;

revoke all on function public.finance_import_santander_return(uuid, text, jsonb) from public, anon;
grant execute on function public.finance_import_santander_return(uuid, text, jsonb) to authenticated;

commit;
