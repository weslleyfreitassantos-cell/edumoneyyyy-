begin;

-- Institution-scoped stock control. All stock changes are performed by the
-- transactional RPCs below; the movement ledger is append-only.

create table public.inventory_categories (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  name text not null check (length(btrim(name)) between 2 and 100),
  normalized_name text not null,
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (institution_id, normalized_name),
  unique (institution_id, id)
);

create table public.inventory_units (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  name text not null check (length(btrim(name)) between 1 and 40),
  normalized_name text not null,
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (institution_id, normalized_name),
  unique (institution_id, id)
);

create table public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  name text not null check (length(btrim(name)) between 2 and 100),
  normalized_name text not null,
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (institution_id, normalized_name),
  unique (institution_id, id)
);

create table public.inventory_suppliers (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  name text not null check (length(btrim(name)) between 2 and 160),
  normalized_name text not null,
  contact text,
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (institution_id, normalized_name),
  unique (institution_id, id)
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  category_id uuid not null,
  unit_id uuid not null,
  default_location_id uuid not null,
  supplier_id uuid,
  name text not null check (length(btrim(name)) between 2 and 180),
  sku text,
  description text,
  minimum_quantity numeric(14,3) not null default 0 check (minimum_quantity >= 0),
  active boolean not null default true,
  idempotency_key text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, id),
  unique (institution_id, idempotency_key),
  foreign key (institution_id, category_id)
    references public.inventory_categories(institution_id, id),
  foreign key (institution_id, unit_id)
    references public.inventory_units(institution_id, id),
  foreign key (institution_id, default_location_id)
    references public.inventory_locations(institution_id, id),
  foreign key (institution_id, supplier_id)
    references public.inventory_suppliers(institution_id, id)
);

create unique index inventory_items_institution_sku_unique
  on public.inventory_items(institution_id, lower(btrim(sku)))
  where sku is not null and btrim(sku) <> '';

create table public.inventory_balances (
  institution_id uuid not null references public.institutions(id),
  item_id uuid not null,
  location_id uuid not null,
  quantity numeric(14,3) not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (institution_id, item_id, location_id),
  foreign key (institution_id, item_id)
    references public.inventory_items(institution_id, id),
  foreign key (institution_id, location_id)
    references public.inventory_locations(institution_id, id)
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  item_id uuid not null,
  location_id uuid not null,
  movement_type text not null check (movement_type in (
    'RECEIPT', 'ISSUE', 'RETURN', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT'
  )),
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  balance_after numeric(14,3) not null check (balance_after >= 0),
  idempotency_key text not null,
  note text,
  performed_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (institution_id, idempotency_key),
  foreign key (institution_id, item_id)
    references public.inventory_items(institution_id, id),
  foreign key (institution_id, location_id)
    references public.inventory_locations(institution_id, id)
);

create table public.inventory_requests (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  requester_id uuid not null references auth.users(id),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'APPROVED', 'REJECTED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED')),
  note text,
  idempotency_key text not null,
  decision_key text,
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, id),
  unique (institution_id, idempotency_key),
  unique (institution_id, decision_key)
);

create table public.inventory_request_items (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  request_id uuid not null,
  item_id uuid not null,
  requested_quantity numeric(14,3) not null check (requested_quantity > 0),
  fulfilled_quantity numeric(14,3) not null default 0
    check (fulfilled_quantity >= 0 and fulfilled_quantity <= requested_quantity),
  created_at timestamptz not null default now(),
  unique (institution_id, id),
  unique (institution_id, request_id, item_id),
  foreign key (institution_id, request_id)
    references public.inventory_requests(institution_id, id),
  foreign key (institution_id, item_id)
    references public.inventory_items(institution_id, id)
);

create table public.inventory_audit_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  actor_id uuid not null references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  idempotency_key text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (institution_id, idempotency_key)
);

create index inventory_items_catalogue_idx
  on public.inventory_items(institution_id, active, name);
create index inventory_requests_queue_idx
  on public.inventory_requests(institution_id, status, created_at desc);
create index inventory_movements_history_idx
  on public.inventory_movements(institution_id, item_id, created_at desc);

alter table public.inventory_categories enable row level security;
alter table public.inventory_units enable row level security;
alter table public.inventory_locations enable row level security;
alter table public.inventory_suppliers enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_balances enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.inventory_requests enable row level security;
alter table public.inventory_request_items enable row level security;
alter table public.inventory_audit_events enable row level security;

create policy inventory_categories_staff_read on public.inventory_categories
  for select to authenticated using (
    private.has_exact_institution_role(institution_id,
      array['DIRECTOR', 'SECRETARY', 'TEACHER']::public.user_role[])
  );
create policy inventory_units_staff_read on public.inventory_units
  for select to authenticated using (
    private.has_exact_institution_role(institution_id,
      array['DIRECTOR', 'SECRETARY', 'TEACHER']::public.user_role[])
  );
create policy inventory_locations_staff_read on public.inventory_locations
  for select to authenticated using (
    private.has_exact_institution_role(institution_id,
      array['DIRECTOR', 'SECRETARY', 'TEACHER']::public.user_role[])
  );
create policy inventory_suppliers_manager_read on public.inventory_suppliers
  for select to authenticated using (
    private.has_exact_institution_role(institution_id,
      array['DIRECTOR', 'SECRETARY']::public.user_role[])
  );
create policy inventory_items_staff_read on public.inventory_items
  for select to authenticated using (
    (active and private.has_exact_institution_role(institution_id,
      array['DIRECTOR', 'SECRETARY', 'TEACHER']::public.user_role[]))
    or (not active and private.has_exact_institution_role(institution_id,
      array['DIRECTOR', 'SECRETARY']::public.user_role[]))
  );
create policy inventory_balances_staff_read on public.inventory_balances
  for select to authenticated using (
    private.has_exact_institution_role(institution_id,
      array['DIRECTOR', 'SECRETARY', 'TEACHER']::public.user_role[])
    and exists (select 1 from public.inventory_items item
      where item.institution_id = inventory_balances.institution_id
        and item.id = inventory_balances.item_id
        and (item.active or private.has_exact_institution_role(
          inventory_balances.institution_id,
          array['DIRECTOR', 'SECRETARY']::public.user_role[]
        )))
  );
create policy inventory_movements_manager_read on public.inventory_movements
  for select to authenticated using (
    private.has_exact_institution_role(institution_id,
      array['DIRECTOR', 'SECRETARY']::public.user_role[])
  );
create policy inventory_requests_staff_read on public.inventory_requests
  for select to authenticated using (
    (requester_id = auth.uid() and private.has_exact_institution_role(
      institution_id, array['TEACHER']::public.user_role[]))
    or private.has_exact_institution_role(institution_id,
      array['DIRECTOR', 'SECRETARY']::public.user_role[])
  );
create policy inventory_request_items_staff_read on public.inventory_request_items
  for select to authenticated using (
    exists (
      select 1 from public.inventory_requests request
       where request.institution_id = inventory_request_items.institution_id
         and request.id = inventory_request_items.request_id
         and ((request.requester_id = auth.uid()
               and private.has_exact_institution_role(request.institution_id,
                 array['TEACHER']::public.user_role[]))
           or private.has_exact_institution_role(request.institution_id,
                 array['DIRECTOR', 'SECRETARY']::public.user_role[]))
    )
  );
create policy inventory_audit_events_manager_read on public.inventory_audit_events
  for select to authenticated using (
    private.has_exact_institution_role(institution_id,
      array['DIRECTOR', 'SECRETARY']::public.user_role[])
  );

revoke all on public.inventory_categories, public.inventory_units,
  public.inventory_locations, public.inventory_suppliers,
  public.inventory_items, public.inventory_balances,
  public.inventory_movements, public.inventory_requests,
  public.inventory_request_items, public.inventory_audit_events
  from anon, authenticated;
grant select on public.inventory_categories, public.inventory_units,
  public.inventory_locations, public.inventory_suppliers,
  public.inventory_items, public.inventory_balances,
  public.inventory_movements, public.inventory_requests,
  public.inventory_request_items, public.inventory_audit_events
  to authenticated;

create or replace function public.inventory_create_item(
  p_institution_id uuid,
  p_name text,
  p_category text,
  p_unit text,
  p_location text,
  p_supplier text,
  p_supplier_contact text,
  p_sku text,
  p_description text,
  p_minimum_quantity numeric,
  p_initial_quantity numeric,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_category_id uuid;
  v_unit_id uuid;
  v_location_id uuid;
  v_supplier_id uuid;
  v_item_id uuid;
  v_balance numeric(14,3);
begin
  if v_actor is null or not private.has_exact_institution_role(
    p_institution_id, array['DIRECTOR', 'SECRETARY']::public.user_role[]
  ) then raise exception using errcode = '42501', message = 'INVENTORY_FORBIDDEN'; end if;
  if length(btrim(coalesce(p_name, ''))) < 2
    or length(btrim(coalesce(p_category, ''))) < 2
    or length(btrim(coalesce(p_unit, ''))) < 1
    or length(btrim(coalesce(p_location, ''))) < 2
    or coalesce(p_minimum_quantity, -1) < 0
    or coalesce(p_initial_quantity, -1) < 0
    or length(btrim(coalesce(p_idempotency_key, ''))) < 8
  then raise exception using errcode = '22023', message = 'INVENTORY_INVALID_ITEM'; end if;

  insert into public.inventory_categories(institution_id, name, normalized_name, created_by)
  values (p_institution_id, btrim(p_category), lower(btrim(p_category)), v_actor)
  on conflict (institution_id, normalized_name) do update set active = true
  returning id into v_category_id;
  insert into public.inventory_units(institution_id, name, normalized_name, created_by)
  values (p_institution_id, btrim(p_unit), lower(btrim(p_unit)), v_actor)
  on conflict (institution_id, normalized_name) do update set active = true
  returning id into v_unit_id;
  insert into public.inventory_locations(institution_id, name, normalized_name, created_by)
  values (p_institution_id, btrim(p_location), lower(btrim(p_location)), v_actor)
  on conflict (institution_id, normalized_name) do update set active = true
  returning id into v_location_id;
  if nullif(btrim(coalesce(p_supplier, '')), '') is not null then
    insert into public.inventory_suppliers(institution_id, name, normalized_name, contact, created_by)
    values (
      p_institution_id, btrim(p_supplier), lower(btrim(p_supplier)),
      nullif(btrim(coalesce(p_supplier_contact, '')), ''), v_actor
    )
    on conflict (institution_id, normalized_name) do update set
      active = true,
      contact = coalesce(excluded.contact, inventory_suppliers.contact)
    returning id into v_supplier_id;
  end if;

  insert into public.inventory_items(
    institution_id, category_id, unit_id, default_location_id, supplier_id,
    name, sku, description, minimum_quantity, idempotency_key, created_by
  ) values (
    p_institution_id, v_category_id, v_unit_id, v_location_id, v_supplier_id,
    btrim(p_name), nullif(btrim(coalesce(p_sku, '')), ''),
    nullif(btrim(coalesce(p_description, '')), ''), p_minimum_quantity,
    btrim(p_idempotency_key), v_actor
  ) on conflict (institution_id, idempotency_key) do nothing
  returning id into v_item_id;

  if v_item_id is null then
    select id into v_item_id from public.inventory_items
     where institution_id = p_institution_id and idempotency_key = btrim(p_idempotency_key);
  else
    insert into public.inventory_balances(institution_id, item_id, location_id, quantity)
    values (p_institution_id, v_item_id, v_location_id, p_initial_quantity)
    on conflict (institution_id, item_id, location_id) do nothing;
    if p_initial_quantity > 0 then
      insert into public.inventory_movements(
        institution_id, item_id, location_id, movement_type,
        quantity_delta, balance_after, idempotency_key, note, performed_by
      ) values (
        p_institution_id, v_item_id, v_location_id, 'RECEIPT',
        p_initial_quantity, p_initial_quantity, btrim(p_idempotency_key) || ':opening',
        'Saldo inicial do cadastro', v_actor
      ) on conflict (institution_id, idempotency_key) do nothing;
    end if;
    insert into public.inventory_audit_events(
      institution_id, actor_id, action, entity_type, entity_id,
      idempotency_key, details
    ) values (
      p_institution_id, v_actor, 'ITEM_CREATED', 'ITEM', v_item_id,
      btrim(p_idempotency_key) || ':audit', jsonb_build_object('initial_quantity', p_initial_quantity)
    ) on conflict (institution_id, idempotency_key) do nothing;
  end if;
  return v_item_id;
end;
$$;

create or replace function public.inventory_record_movement(
  p_institution_id uuid,
  p_item_id uuid,
  p_location_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_note text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_delta numeric(14,3);
  v_quantity numeric(14,3);
  v_movement_id uuid;
begin
  if v_actor is null or not private.has_exact_institution_role(
    p_institution_id, array['DIRECTOR', 'SECRETARY']::public.user_role[]
  ) then raise exception using errcode = '42501', message = 'INVENTORY_FORBIDDEN'; end if;
  if p_movement_type not in ('RECEIPT', 'ISSUE', 'RETURN', 'ADJUSTMENT')
    or coalesce(p_quantity, 0) = 0
    or length(btrim(coalesce(p_idempotency_key, ''))) < 8
  then raise exception using errcode = '22023', message = 'INVENTORY_INVALID_MOVEMENT'; end if;
  if p_movement_type = 'ADJUSTMENT'
    and length(btrim(coalesce(p_note, ''))) < 3
  then raise exception using errcode = '22023', message = 'INVENTORY_ADJUSTMENT_REASON_REQUIRED'; end if;
  select id into v_movement_id from public.inventory_movements
   where institution_id = p_institution_id and idempotency_key = btrim(p_idempotency_key);
  if v_movement_id is not null then return v_movement_id; end if;
  if p_movement_type in ('RECEIPT', 'ISSUE', 'RETURN') and p_quantity < 0 then
    raise exception using errcode = '22023', message = 'INVENTORY_INVALID_MOVEMENT';
  end if;
  v_delta := case p_movement_type
    when 'RECEIPT' then p_quantity
    when 'RETURN' then p_quantity
    when 'ISSUE' then -p_quantity
    else p_quantity
  end;
  if not exists (select 1 from public.inventory_items item
    where item.id = p_item_id and item.institution_id = p_institution_id and item.active)
    or not exists (select 1 from public.inventory_locations location
    where location.id = p_location_id and location.institution_id = p_institution_id and location.active)
  then raise exception using errcode = '22023', message = 'INVENTORY_ITEM_OR_LOCATION_NOT_FOUND'; end if;

  insert into public.inventory_balances(institution_id, item_id, location_id, quantity)
  values (p_institution_id, p_item_id, p_location_id, 0)
  on conflict (institution_id, item_id, location_id) do nothing;
  select quantity into v_quantity from public.inventory_balances
   where institution_id = p_institution_id and item_id = p_item_id and location_id = p_location_id
   for update;
  select id into v_movement_id from public.inventory_movements
   where institution_id = p_institution_id and idempotency_key = btrim(p_idempotency_key);
  if v_movement_id is not null then return v_movement_id; end if;
  v_quantity := v_quantity + v_delta;
  if v_quantity < 0 then
    raise exception using errcode = '23514', message = 'INVENTORY_INSUFFICIENT_STOCK';
  end if;
  update public.inventory_balances set quantity = v_quantity, updated_at = now()
   where institution_id = p_institution_id and item_id = p_item_id and location_id = p_location_id;
  insert into public.inventory_movements(
    institution_id, item_id, location_id, movement_type, quantity_delta,
    balance_after, idempotency_key, note, performed_by
  ) values (
    p_institution_id, p_item_id, p_location_id, p_movement_type, v_delta,
    v_quantity, btrim(p_idempotency_key), nullif(btrim(coalesce(p_note, '')), ''), v_actor
  ) returning id into v_movement_id;
  insert into public.inventory_audit_events(
    institution_id, actor_id, action, entity_type, entity_id, idempotency_key, details
  ) values (
    p_institution_id, v_actor, 'STOCK_MOVEMENT', 'ITEM', p_item_id,
    btrim(p_idempotency_key) || ':audit',
    jsonb_build_object('type', p_movement_type, 'delta', v_delta, 'location_id', p_location_id)
  ) on conflict (institution_id, idempotency_key) do nothing;
  return v_movement_id;
end;
$$;

create or replace function public.inventory_transfer_stock(
  p_institution_id uuid,
  p_item_id uuid,
  p_source_location_id uuid,
  p_destination_location_id uuid,
  p_quantity numeric,
  p_note text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_source_quantity numeric(14,3);
  v_destination_quantity numeric(14,3);
  v_transfer_out_id uuid;
begin
  if v_actor is null or not private.has_exact_institution_role(
    p_institution_id, array['DIRECTOR', 'SECRETARY']::public.user_role[]
  ) then raise exception using errcode = '42501', message = 'INVENTORY_FORBIDDEN'; end if;
  if p_quantity is null or p_quantity <= 0
    or p_source_location_id = p_destination_location_id
    or length(btrim(coalesce(p_idempotency_key, ''))) < 8
    or length(btrim(coalesce(p_note, ''))) < 3
  then raise exception using errcode = '22023', message = 'INVENTORY_INVALID_TRANSFER'; end if;
  select id into v_transfer_out_id from public.inventory_movements
   where institution_id = p_institution_id
     and idempotency_key = btrim(p_idempotency_key) || ':transfer-out';
  if v_transfer_out_id is not null then return v_transfer_out_id; end if;
  if not exists (select 1 from public.inventory_items item
    where item.id = p_item_id and item.institution_id = p_institution_id and item.active)
    or not exists (select 1 from public.inventory_locations location
    where location.id = p_source_location_id and location.institution_id = p_institution_id and location.active)
    or not exists (select 1 from public.inventory_locations location
    where location.id = p_destination_location_id and location.institution_id = p_institution_id and location.active)
  then raise exception using errcode = '22023', message = 'INVENTORY_ITEM_OR_LOCATION_NOT_FOUND'; end if;

  -- Insert and lock both balance rows in a stable order to avoid deadlocks
  -- when transfers are initiated in opposite directions concurrently.
  if p_source_location_id::text < p_destination_location_id::text then
    insert into public.inventory_balances(institution_id, item_id, location_id, quantity)
      values (p_institution_id, p_item_id, p_source_location_id, 0)
      on conflict (institution_id, item_id, location_id) do nothing;
    insert into public.inventory_balances(institution_id, item_id, location_id, quantity)
      values (p_institution_id, p_item_id, p_destination_location_id, 0)
      on conflict (institution_id, item_id, location_id) do nothing;
  else
    insert into public.inventory_balances(institution_id, item_id, location_id, quantity)
      values (p_institution_id, p_item_id, p_destination_location_id, 0)
      on conflict (institution_id, item_id, location_id) do nothing;
    insert into public.inventory_balances(institution_id, item_id, location_id, quantity)
      values (p_institution_id, p_item_id, p_source_location_id, 0)
      on conflict (institution_id, item_id, location_id) do nothing;
  end if;
  perform 1 from public.inventory_balances balance
   where balance.institution_id = p_institution_id and balance.item_id = p_item_id
     and balance.location_id in (p_source_location_id, p_destination_location_id)
   order by balance.location_id for update;
  select id into v_transfer_out_id from public.inventory_movements
   where institution_id = p_institution_id
     and idempotency_key = btrim(p_idempotency_key) || ':transfer-out';
  if v_transfer_out_id is not null then return v_transfer_out_id; end if;
  select quantity into v_source_quantity from public.inventory_balances
   where institution_id = p_institution_id and item_id = p_item_id and location_id = p_source_location_id;
  select quantity into v_destination_quantity from public.inventory_balances
   where institution_id = p_institution_id and item_id = p_item_id and location_id = p_destination_location_id;
  if v_source_quantity < p_quantity then
    raise exception using errcode = '23514', message = 'INVENTORY_INSUFFICIENT_STOCK';
  end if;
  update public.inventory_balances set quantity = v_source_quantity - p_quantity, updated_at = now()
   where institution_id = p_institution_id and item_id = p_item_id and location_id = p_source_location_id;
  update public.inventory_balances set quantity = v_destination_quantity + p_quantity, updated_at = now()
   where institution_id = p_institution_id and item_id = p_item_id and location_id = p_destination_location_id;
  insert into public.inventory_movements(
    institution_id, item_id, location_id, movement_type, quantity_delta,
    balance_after, idempotency_key, note, performed_by
  ) values (
    p_institution_id, p_item_id, p_source_location_id, 'TRANSFER_OUT', -p_quantity,
    v_source_quantity - p_quantity, btrim(p_idempotency_key) || ':transfer-out', btrim(p_note), v_actor
  ) returning id into v_transfer_out_id;
  insert into public.inventory_movements(
    institution_id, item_id, location_id, movement_type, quantity_delta,
    balance_after, idempotency_key, note, performed_by
  ) values (
    p_institution_id, p_item_id, p_destination_location_id, 'TRANSFER_IN', p_quantity,
    v_destination_quantity + p_quantity, btrim(p_idempotency_key) || ':transfer-in', btrim(p_note), v_actor
  );
  insert into public.inventory_audit_events(
    institution_id, actor_id, action, entity_type, entity_id, idempotency_key, details
  ) values (
    p_institution_id, v_actor, 'STOCK_TRANSFER', 'ITEM', p_item_id,
    btrim(p_idempotency_key) || ':audit', jsonb_build_object(
      'source_location_id', p_source_location_id,
      'destination_location_id', p_destination_location_id,
      'quantity', p_quantity
    )
  ) on conflict (institution_id, idempotency_key) do nothing;
  return v_transfer_out_id;
end;
$$;

create or replace function public.inventory_create_request(
  p_institution_id uuid,
  p_item_id uuid,
  p_quantity numeric,
  p_note text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_request_id uuid;
begin
  if v_actor is null or not private.has_exact_institution_role(
    p_institution_id, array['TEACHER']::public.user_role[]
  ) then raise exception using errcode = '42501', message = 'INVENTORY_FORBIDDEN'; end if;
  if coalesce(p_quantity, 0) <= 0 or length(btrim(coalesce(p_idempotency_key, ''))) < 8
  then raise exception using errcode = '22023', message = 'INVENTORY_INVALID_REQUEST'; end if;
  if not exists (select 1 from public.inventory_items item
    where item.id = p_item_id and item.institution_id = p_institution_id and item.active)
  then raise exception using errcode = '22023', message = 'INVENTORY_ITEM_NOT_FOUND'; end if;

  insert into public.inventory_requests(institution_id, requester_id, note, idempotency_key)
  values (p_institution_id, v_actor, nullif(btrim(coalesce(p_note, '')), ''), btrim(p_idempotency_key))
  on conflict (institution_id, idempotency_key) do nothing
  returning id into v_request_id;
  if v_request_id is not null then
    insert into public.inventory_request_items(
      institution_id, request_id, item_id, requested_quantity
    ) values (p_institution_id, v_request_id, p_item_id, p_quantity);
    insert into public.inventory_audit_events(
      institution_id, actor_id, action, entity_type, entity_id, idempotency_key, details
    ) values (
      p_institution_id, v_actor, 'REQUEST_CREATED', 'REQUEST', v_request_id,
      btrim(p_idempotency_key) || ':audit', jsonb_build_object('item_id', p_item_id, 'quantity', p_quantity)
    ) on conflict (institution_id, idempotency_key) do nothing;
  else
    select id into v_request_id from public.inventory_requests
     where institution_id = p_institution_id and idempotency_key = btrim(p_idempotency_key);
  end if;
  return v_request_id;
end;
$$;

create or replace function public.inventory_decide_request(
  p_institution_id uuid,
  p_request_id uuid,
  p_decision text,
  p_idempotency_key text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_status text;
begin
  if v_actor is null or not private.has_exact_institution_role(
    p_institution_id, array['DIRECTOR', 'SECRETARY']::public.user_role[]
  ) then raise exception using errcode = '42501', message = 'INVENTORY_FORBIDDEN'; end if;
  if p_decision not in ('APPROVED', 'REJECTED')
    or length(btrim(coalesce(p_idempotency_key, ''))) < 8
  then raise exception using errcode = '22023', message = 'INVENTORY_INVALID_DECISION'; end if;
  select status into v_status from public.inventory_requests
   where institution_id = p_institution_id and id = p_request_id for update;
  if v_status is null then raise exception using errcode = 'P0002', message = 'INVENTORY_REQUEST_NOT_FOUND'; end if;
  if v_status = p_decision then return v_status; end if;
  if v_status <> 'PENDING' then
    raise exception using errcode = '22023', message = 'INVENTORY_REQUEST_ALREADY_DECIDED';
  end if;
  update public.inventory_requests set status = p_decision, decision_key = btrim(p_idempotency_key),
    decided_by = v_actor, decided_at = now(), updated_at = now()
   where institution_id = p_institution_id and id = p_request_id;
  insert into public.inventory_audit_events(
    institution_id, actor_id, action, entity_type, entity_id, idempotency_key, details
  ) values (
    p_institution_id, v_actor, 'REQUEST_DECIDED', 'REQUEST', p_request_id,
    btrim(p_idempotency_key) || ':audit', jsonb_build_object('decision', p_decision)
  ) on conflict (institution_id, idempotency_key) do nothing;
  return p_decision;
end;
$$;

create or replace function public.inventory_cancel_request(
  p_institution_id uuid,
  p_request_id uuid,
  p_idempotency_key text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_requester_id uuid;
  v_status text;
  v_audit_entity_id uuid;
begin
  if v_actor is null or not private.has_exact_institution_role(
    p_institution_id, array['TEACHER']::public.user_role[]
  ) then raise exception using errcode = '42501', message = 'INVENTORY_FORBIDDEN'; end if;
  if length(btrim(coalesce(p_idempotency_key, ''))) < 8
  then raise exception using errcode = '22023', message = 'INVENTORY_INVALID_CANCELLATION'; end if;
  select requester_id, status into v_requester_id, v_status
    from public.inventory_requests
   where institution_id = p_institution_id and id = p_request_id for update;
  if v_requester_id is null or v_requester_id <> v_actor then
    raise exception using errcode = '42501', message = 'INVENTORY_REQUEST_NOT_OWNED';
  end if;
  select entity_id into v_audit_entity_id from public.inventory_audit_events
   where institution_id = p_institution_id
     and idempotency_key = btrim(p_idempotency_key) || ':audit';
  if v_audit_entity_id is not null then
    if v_audit_entity_id <> p_request_id then
      raise exception using errcode = '22023', message = 'INVENTORY_IDEMPOTENCY_KEY_REUSED';
    end if;
    return 'CANCELLED';
  end if;
  if v_status = 'CANCELLED' then return v_status; end if;
  if v_status <> 'PENDING' then
    raise exception using errcode = '22023', message = 'INVENTORY_REQUEST_CANNOT_BE_CANCELLED';
  end if;
  update public.inventory_requests set status = 'CANCELLED', updated_at = now()
   where institution_id = p_institution_id and id = p_request_id;
  insert into public.inventory_audit_events(
    institution_id, actor_id, action, entity_type, entity_id, idempotency_key
  ) values (
    p_institution_id, v_actor, 'REQUEST_CANCELLED', 'REQUEST', p_request_id,
    btrim(p_idempotency_key) || ':audit'
  ) on conflict (institution_id, idempotency_key) do nothing;
  return 'CANCELLED';
end;
$$;

create or replace function public.inventory_set_item_active(
  p_institution_id uuid,
  p_item_id uuid,
  p_active boolean,
  p_idempotency_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_audit_entity_id uuid;
  v_current_active boolean;
begin
  if v_actor is null or not private.has_exact_institution_role(
    p_institution_id, array['DIRECTOR', 'SECRETARY']::public.user_role[]
  ) then raise exception using errcode = '42501', message = 'INVENTORY_FORBIDDEN'; end if;
  if p_active is null or length(btrim(coalesce(p_idempotency_key, ''))) < 8
  then raise exception using errcode = '22023', message = 'INVENTORY_INVALID_ITEM_STATUS'; end if;
  select active into v_current_active from public.inventory_items item
   where item.id = p_item_id and item.institution_id = p_institution_id for update;
  if v_current_active is null then
    raise exception using errcode = 'P0002', message = 'INVENTORY_ITEM_NOT_FOUND';
  end if;
  select entity_id into v_audit_entity_id from public.inventory_audit_events
   where institution_id = p_institution_id
     and idempotency_key = btrim(p_idempotency_key) || ':audit';
  if v_audit_entity_id is not null then
    if v_audit_entity_id <> p_item_id then
      raise exception using errcode = '22023', message = 'INVENTORY_IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_current_active;
  end if;
  update public.inventory_items set active = p_active, updated_at = now()
   where institution_id = p_institution_id and id = p_item_id;
  insert into public.inventory_audit_events(
    institution_id, actor_id, action, entity_type, entity_id, idempotency_key, details
  ) values (
    p_institution_id, v_actor,
    case when p_active then 'ITEM_ACTIVATED' else 'ITEM_DEACTIVATED' end,
    'ITEM', p_item_id, btrim(p_idempotency_key) || ':audit',
    jsonb_build_object('active', p_active)
  );
  return p_active;
end;
$$;

create or replace function public.inventory_fulfill_request(
  p_institution_id uuid,
  p_request_id uuid,
  p_request_item_id uuid,
  p_location_id uuid,
  p_quantity numeric,
  p_idempotency_key text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_status text;
  v_item_id uuid;
  v_requested numeric(14,3);
  v_fulfilled numeric(14,3);
  v_audit_entity_id uuid;
  v_balance numeric(14,3);
  v_new_balance numeric(14,3);
  v_remaining numeric(14,3);
begin
  if v_actor is null or not private.has_exact_institution_role(
    p_institution_id, array['DIRECTOR', 'SECRETARY']::public.user_role[]
  ) then raise exception using errcode = '42501', message = 'INVENTORY_FORBIDDEN'; end if;
  if coalesce(p_quantity, 0) <= 0 or length(btrim(coalesce(p_idempotency_key, ''))) < 8
  then raise exception using errcode = '22023', message = 'INVENTORY_INVALID_FULFILLMENT'; end if;
  select entity_id into v_audit_entity_id from public.inventory_audit_events
   where institution_id = p_institution_id
     and idempotency_key = btrim(p_idempotency_key) || ':audit';
  if v_audit_entity_id is not null then
    if v_audit_entity_id <> p_request_id then
      raise exception using errcode = '22023', message = 'INVENTORY_IDEMPOTENCY_KEY_REUSED';
    end if;
    select status into v_status from public.inventory_requests
     where institution_id = p_institution_id and id = p_request_id;
    return v_status;
  end if;
  select status into v_status from public.inventory_requests
   where institution_id = p_institution_id and id = p_request_id for update;
  select entity_id into v_audit_entity_id from public.inventory_audit_events
   where institution_id = p_institution_id
     and idempotency_key = btrim(p_idempotency_key) || ':audit';
  if v_audit_entity_id is not null then
    if v_audit_entity_id <> p_request_id then
      raise exception using errcode = '22023', message = 'INVENTORY_IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_status;
  end if;
  if exists (select 1 from public.inventory_movements movement
    where movement.institution_id = p_institution_id
      and movement.idempotency_key = btrim(p_idempotency_key)) then
    raise exception using errcode = '22023', message = 'INVENTORY_IDEMPOTENCY_KEY_REUSED';
  end if;
  if v_status not in ('APPROVED', 'PARTIALLY_FULFILLED') then
    raise exception using errcode = '22023', message = 'INVENTORY_REQUEST_NOT_APPROVED';
  end if;
  select request_item.item_id, request_item.requested_quantity, request_item.fulfilled_quantity
    into v_item_id, v_requested, v_fulfilled
    from public.inventory_request_items request_item
   where request_item.institution_id = p_institution_id
     and request_item.request_id = p_request_id and request_item.id = p_request_item_id
   for update;
  if v_item_id is null or not exists (select 1 from public.inventory_locations location
    where location.id = p_location_id and location.institution_id = p_institution_id and location.active)
  then raise exception using errcode = '22023', message = 'INVENTORY_REQUEST_ITEM_NOT_FOUND'; end if;
  v_remaining := v_requested - v_fulfilled;
  if p_quantity > v_remaining then
    raise exception using errcode = '22023', message = 'INVENTORY_FULFILLMENT_EXCEEDS_REMAINING';
  end if;
  insert into public.inventory_balances(institution_id, item_id, location_id, quantity)
  values (p_institution_id, v_item_id, p_location_id, 0)
  on conflict (institution_id, item_id, location_id) do nothing;
  select quantity into v_balance from public.inventory_balances
   where institution_id = p_institution_id and item_id = v_item_id and location_id = p_location_id
   for update;
  if v_balance < p_quantity then
    raise exception using errcode = '23514', message = 'INVENTORY_INSUFFICIENT_STOCK';
  end if;
  v_new_balance := v_balance - p_quantity;
  update public.inventory_balances set quantity = v_new_balance, updated_at = now()
   where institution_id = p_institution_id and item_id = v_item_id and location_id = p_location_id;
  insert into public.inventory_movements(
    institution_id, item_id, location_id, movement_type, quantity_delta,
    balance_after, idempotency_key, note, performed_by
  ) values (
    p_institution_id, v_item_id, p_location_id, 'ISSUE', -p_quantity,
    v_new_balance, btrim(p_idempotency_key), 'Atendimento de solicitação', v_actor
  );
  update public.inventory_request_items set fulfilled_quantity = fulfilled_quantity + p_quantity
   where institution_id = p_institution_id and id = p_request_item_id;
  if v_fulfilled + p_quantity >= v_requested then
    update public.inventory_requests set status = 'FULFILLED', updated_at = now()
     where institution_id = p_institution_id and id = p_request_id;
    v_status := 'FULFILLED';
  else
    update public.inventory_requests set status = 'PARTIALLY_FULFILLED', updated_at = now()
     where institution_id = p_institution_id and id = p_request_id;
    v_status := 'PARTIALLY_FULFILLED';
  end if;
  insert into public.inventory_audit_events(
    institution_id, actor_id, action, entity_type, entity_id, idempotency_key, details
  ) values (
    p_institution_id, v_actor, 'REQUEST_FULFILLED', 'REQUEST', p_request_id,
    btrim(p_idempotency_key) || ':audit', jsonb_build_object('quantity', p_quantity, 'status', v_status)
  ) on conflict (institution_id, idempotency_key) do nothing;
  return v_status;
end;
$$;

revoke all on function public.inventory_create_item(uuid, text, text, text, text, text, text, text, text, numeric, numeric, text)
  from public, anon;
revoke all on function public.inventory_record_movement(uuid, uuid, uuid, text, numeric, text, text)
  from public, anon;
revoke all on function public.inventory_transfer_stock(uuid, uuid, uuid, uuid, numeric, text, text)
  from public, anon;
revoke all on function public.inventory_create_request(uuid, uuid, numeric, text, text)
  from public, anon;
revoke all on function public.inventory_decide_request(uuid, uuid, text, text)
  from public, anon;
revoke all on function public.inventory_cancel_request(uuid, uuid, text)
  from public, anon;
revoke all on function public.inventory_set_item_active(uuid, uuid, boolean, text)
  from public, anon;
revoke all on function public.inventory_fulfill_request(uuid, uuid, uuid, uuid, numeric, text)
  from public, anon;
grant execute on function public.inventory_create_item(uuid, text, text, text, text, text, text, text, text, numeric, numeric, text)
  to authenticated;
grant execute on function public.inventory_record_movement(uuid, uuid, uuid, text, numeric, text, text)
  to authenticated;
grant execute on function public.inventory_transfer_stock(uuid, uuid, uuid, uuid, numeric, text, text)
  to authenticated;
grant execute on function public.inventory_create_request(uuid, uuid, numeric, text, text)
  to authenticated;
grant execute on function public.inventory_decide_request(uuid, uuid, text, text)
  to authenticated;
grant execute on function public.inventory_cancel_request(uuid, uuid, text)
  to authenticated;
grant execute on function public.inventory_set_item_active(uuid, uuid, boolean, text)
  to authenticated;
grant execute on function public.inventory_fulfill_request(uuid, uuid, uuid, uuid, numeric, text)
  to authenticated;

commit;
