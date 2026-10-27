begin;

create table public.inventory_count_sessions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  location_id uuid not null,
  status text not null default 'OPEN'
    check (status in ('OPEN', 'FINALIZING', 'FINALIZED', 'CANCELLED')),
  note text,
  idempotency_key text not null,
  finalization_key text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  finalized_by uuid references auth.users(id),
  finalized_at timestamptz,
  cancellation_key text,
  cancelled_by uuid references auth.users(id),
  cancelled_at timestamptz,
  unique (institution_id, id),
  unique (institution_id, idempotency_key),
  unique (institution_id, finalization_key),
  unique (institution_id, cancellation_key),
  foreign key (institution_id, location_id)
    references public.inventory_locations(institution_id, id)
);

create table public.inventory_count_lines (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  session_id uuid not null,
  item_id uuid not null,
  expected_quantity numeric(14,3) not null check (expected_quantity >= 0),
  counted_quantity numeric(14,3) check (counted_quantity >= 0),
  counted_by uuid references auth.users(id),
  counted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (institution_id, id),
  unique (institution_id, session_id, item_id),
  foreign key (institution_id, session_id)
    references public.inventory_count_sessions(institution_id, id),
  foreign key (institution_id, item_id)
    references public.inventory_items(institution_id, id)
);

alter table public.inventory_movements
  add column inventory_count_session_id uuid;
alter table public.inventory_movements
  add constraint inventory_movements_count_session_fk
  foreign key (institution_id, inventory_count_session_id)
  references public.inventory_count_sessions(institution_id, id);

create index inventory_count_sessions_history_idx
  on public.inventory_count_sessions(institution_id, created_at desc);
create unique index inventory_count_one_open_per_location_idx
  on public.inventory_count_sessions(institution_id, location_id)
  where status = 'OPEN';
create index inventory_count_lines_session_idx
  on public.inventory_count_lines(institution_id, session_id, item_id);
create index inventory_movements_count_session_idx
  on public.inventory_movements(institution_id, inventory_count_session_id)
  where inventory_count_session_id is not null;

alter table public.inventory_count_sessions enable row level security;
alter table public.inventory_count_lines enable row level security;

create policy inventory_count_sessions_manager_read
  on public.inventory_count_sessions for select to authenticated using (
    private.has_exact_institution_role(
      institution_id, array['DIRECTOR', 'SECRETARY']::public.user_role[]
    )
  );
create policy inventory_count_lines_manager_read
  on public.inventory_count_lines for select to authenticated using (
    private.has_exact_institution_role(
      institution_id, array['DIRECTOR', 'SECRETARY']::public.user_role[]
    )
  );

revoke all on public.inventory_count_sessions, public.inventory_count_lines
  from anon, authenticated;
grant select on public.inventory_count_sessions, public.inventory_count_lines
  to authenticated;

create or replace function public.inventory_guard_open_count_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'inventory_balances' then
    if tg_op = 'DELETE' then
      perform 1 from public.inventory_locations location
       where location.institution_id = old.institution_id and location.id = old.location_id
       for update;
      if exists (select 1 from public.inventory_count_sessions session
        where session.institution_id = old.institution_id
          and session.location_id = old.location_id and session.status = 'OPEN') then
        raise exception using errcode = '55000', message = 'INVENTORY_COUNT_IN_PROGRESS';
      end if;
      return old;
    end if;
    if tg_op = 'UPDATE' and old.location_id is distinct from new.location_id then
      perform location.id from public.inventory_locations location
       where location.institution_id = new.institution_id
         and location.id in (old.location_id, new.location_id)
       order by location.id for update;
      if exists (select 1 from public.inventory_count_sessions session
        where session.institution_id = new.institution_id
          and session.location_id in (old.location_id, new.location_id)
          and session.status = 'OPEN') then
        raise exception using errcode = '55000', message = 'INVENTORY_COUNT_IN_PROGRESS';
      end if;
    else
      perform 1 from public.inventory_locations location
       where location.institution_id = new.institution_id and location.id = new.location_id
       for update;
      if exists (select 1 from public.inventory_count_sessions session
        where session.institution_id = new.institution_id
          and session.location_id = new.location_id and session.status = 'OPEN') then
        raise exception using errcode = '55000', message = 'INVENTORY_COUNT_IN_PROGRESS';
      end if;
    end if;
    return new;
  elsif tg_table_name = 'inventory_items' then
    if tg_op = 'UPDATE' and old.default_location_id is distinct from new.default_location_id then
      perform location.id from public.inventory_locations location
       where location.institution_id = new.institution_id
         and location.id in (old.default_location_id, new.default_location_id)
       order by location.id for update;
      if exists (select 1 from public.inventory_count_sessions session
        where session.institution_id = new.institution_id
          and session.location_id in (old.default_location_id, new.default_location_id)
          and session.status = 'OPEN') then
        raise exception using errcode = '55000', message = 'INVENTORY_COUNT_IN_PROGRESS';
      end if;
    else
      perform 1 from public.inventory_locations location
       where location.institution_id = new.institution_id and location.id = new.default_location_id
       for update;
      if exists (select 1 from public.inventory_count_sessions session
        where session.institution_id = new.institution_id
          and session.location_id = new.default_location_id and session.status = 'OPEN') then
        raise exception using errcode = '55000', message = 'INVENTORY_COUNT_IN_PROGRESS';
      end if;
    end if;
    return new;
  end if;
  return new;
end;
$$;

create trigger inventory_balance_open_count_guard
  before insert or update or delete on public.inventory_balances
  for each row execute function public.inventory_guard_open_count_mutation();
create trigger inventory_item_open_count_guard
  before insert or update of active, default_location_id on public.inventory_items
  for each row execute function public.inventory_guard_open_count_mutation();
revoke all on function public.inventory_guard_open_count_mutation() from public, anon, authenticated;

create or replace function public.inventory_start_count(
  p_institution_id uuid,
  p_location_id uuid,
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
  v_session_id uuid;
begin
  if v_actor is null or not private.has_exact_institution_role(
    p_institution_id, array['DIRECTOR', 'SECRETARY']::public.user_role[]
  ) then raise exception using errcode = '42501', message = 'INVENTORY_FORBIDDEN'; end if;
  if length(btrim(coalesce(p_idempotency_key, ''))) < 8
    or not exists (select 1 from public.inventory_locations location
      where location.institution_id = p_institution_id
        and location.id = p_location_id and location.active)
  then raise exception using errcode = '22023', message = 'INVENTORY_INVALID_COUNT'; end if;

  select id into v_session_id from public.inventory_count_sessions
   where institution_id = p_institution_id
     and idempotency_key = btrim(p_idempotency_key);
  if v_session_id is not null then return v_session_id; end if;

  perform 1 from public.inventory_locations location
   where location.institution_id = p_institution_id and location.id = p_location_id
     and location.active
   for update;
  if not found then
    raise exception using errcode = '22023', message = 'INVENTORY_INVALID_COUNT';
  end if;
  select id into v_session_id from public.inventory_count_sessions
   where institution_id = p_institution_id
     and idempotency_key = btrim(p_idempotency_key);
  if v_session_id is not null then return v_session_id; end if;
  if exists (select 1 from public.inventory_count_sessions session
    where session.institution_id = p_institution_id
      and session.location_id = p_location_id and session.status = 'OPEN')
  then raise exception using errcode = '55000', message = 'INVENTORY_COUNT_ALREADY_OPEN'; end if;
  perform balance.item_id from public.inventory_balances balance
   where balance.institution_id = p_institution_id and balance.location_id = p_location_id
   order by balance.item_id for update;

  insert into public.inventory_count_sessions(
    institution_id, location_id, note, idempotency_key, created_by
  ) values (
    p_institution_id, p_location_id,
    nullif(btrim(coalesce(p_note, '')), ''), btrim(p_idempotency_key), v_actor
  ) on conflict (institution_id, idempotency_key) do nothing
  returning id into v_session_id;

  if v_session_id is null then
    select id into v_session_id from public.inventory_count_sessions
     where institution_id = p_institution_id
       and idempotency_key = btrim(p_idempotency_key);
    return v_session_id;
  end if;

  insert into public.inventory_count_lines(
    institution_id, session_id, item_id, expected_quantity
  )
  select p_institution_id, v_session_id, item.id, coalesce(balance.quantity, 0)
    from public.inventory_items item
    left join public.inventory_balances balance
      on balance.institution_id = item.institution_id
     and balance.item_id = item.id
     and balance.location_id = p_location_id
   where item.institution_id = p_institution_id and item.active
   order by item.id;

  insert into public.inventory_audit_events(
    institution_id, actor_id, action, entity_type, entity_id,
    idempotency_key, details
  ) values (
    p_institution_id, v_actor, 'COUNT_STARTED', 'COUNT_SESSION', v_session_id,
    btrim(p_idempotency_key) || ':audit',
    jsonb_build_object('location_id', p_location_id)
  ) on conflict (institution_id, idempotency_key) do nothing;
  return v_session_id;
end;
$$;

create or replace function public.inventory_save_count(
  p_session_id uuid,
  p_lines jsonb,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_session public.inventory_count_sessions%rowtype;
  v_expected_count integer;
  v_input_count integer;
  v_updated_count integer;
  v_existing_event uuid;
begin
  select * into v_session from public.inventory_count_sessions
   where id = p_session_id for update;
  if not found or v_actor is null or not private.has_exact_institution_role(
    v_session.institution_id, array['DIRECTOR', 'SECRETARY']::public.user_role[]
  ) then raise exception using errcode = '42501', message = 'INVENTORY_FORBIDDEN'; end if;
  if length(btrim(coalesce(p_idempotency_key, ''))) < 8
    or coalesce(jsonb_typeof(p_lines), '') <> 'array'
  then raise exception using errcode = '22023', message = 'INVENTORY_INVALID_COUNT_LINES'; end if;
  select id into v_existing_event from public.inventory_audit_events
   where institution_id = v_session.institution_id
     and idempotency_key = btrim(p_idempotency_key) || ':audit';
  if v_existing_event is not null then return v_session.id; end if;
  if v_session.status <> 'OPEN' then
    raise exception using errcode = '22023', message = 'INVENTORY_COUNT_NOT_OPEN';
  end if;

  select count(*) into v_expected_count from public.inventory_count_lines
   where institution_id = v_session.institution_id and session_id = v_session.id;
  select count(*), count(distinct supplied.line_id) into v_input_count, v_updated_count
    from jsonb_to_recordset(p_lines) as supplied(line_id uuid, counted_quantity numeric);
  if v_input_count <> v_expected_count or v_updated_count <> v_input_count
    or exists (select 1 from jsonb_to_recordset(p_lines)
      as supplied(line_id uuid, counted_quantity numeric)
      where supplied.counted_quantity is null or supplied.counted_quantity < 0)
    or exists (select 1 from jsonb_to_recordset(p_lines)
      as supplied(line_id uuid, counted_quantity numeric)
      left join public.inventory_count_lines line
        on line.institution_id = v_session.institution_id
       and line.session_id = v_session.id and line.id = supplied.line_id
      where line.id is null)
  then raise exception using errcode = '22023', message = 'INVENTORY_COUNT_INCOMPLETE'; end if;

  update public.inventory_count_lines line
     set counted_quantity = supplied.counted_quantity,
         counted_by = v_actor,
         counted_at = now()
    from jsonb_to_recordset(p_lines) as supplied(line_id uuid, counted_quantity numeric)
   where line.institution_id = v_session.institution_id
     and line.session_id = v_session.id and line.id = supplied.line_id;

  insert into public.inventory_audit_events(
    institution_id, actor_id, action, entity_type, entity_id,
    idempotency_key, details
  ) values (
    v_session.institution_id, v_actor, 'COUNT_SAVED', 'COUNT_SESSION', v_session.id,
    btrim(p_idempotency_key) || ':audit', jsonb_build_object('line_count', v_input_count)
  );
  return v_session.id;
end;
$$;

create or replace function public.inventory_finalize_count(
  p_session_id uuid,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_session public.inventory_count_sessions%rowtype;
  v_line record;
  v_balance numeric(14,3);
  v_delta numeric(14,3);
  v_adjusted_count integer := 0;
begin
  select * into v_session from public.inventory_count_sessions
   where id = p_session_id for update;
  if not found or v_actor is null or not private.has_exact_institution_role(
    v_session.institution_id, array['DIRECTOR', 'SECRETARY']::public.user_role[]
  ) then raise exception using errcode = '42501', message = 'INVENTORY_FORBIDDEN'; end if;
  if length(btrim(coalesce(p_idempotency_key, ''))) < 8 then
    raise exception using errcode = '22023', message = 'INVENTORY_INVALID_COUNT';
  end if;
  if v_session.status = 'FINALIZED' then
    if v_session.finalization_key = btrim(p_idempotency_key) then return v_session.id; end if;
    raise exception using errcode = '22023', message = 'INVENTORY_COUNT_ALREADY_FINALIZED';
  end if;
  if v_session.status <> 'OPEN' then
    raise exception using errcode = '22023', message = 'INVENTORY_COUNT_NOT_OPEN';
  end if;
  perform 1 from public.inventory_locations location
   where location.institution_id = v_session.institution_id
     and location.id = v_session.location_id for update;
  if exists (select 1 from public.inventory_count_lines line
    where line.institution_id = v_session.institution_id
      and line.session_id = v_session.id and line.counted_quantity is null)
  then raise exception using errcode = '22023', message = 'INVENTORY_COUNT_INCOMPLETE'; end if;

  update public.inventory_count_sessions set status = 'FINALIZING'
   where institution_id = v_session.institution_id and id = v_session.id;

  for v_line in
    select line.item_id, line.counted_quantity
      from public.inventory_count_lines line
     where line.institution_id = v_session.institution_id and line.session_id = v_session.id
     order by line.item_id
  loop
    insert into public.inventory_balances(institution_id, item_id, location_id, quantity)
    values (v_session.institution_id, v_line.item_id, v_session.location_id, 0)
    on conflict (institution_id, item_id, location_id) do nothing;
    select quantity into v_balance from public.inventory_balances
     where institution_id = v_session.institution_id
       and item_id = v_line.item_id and location_id = v_session.location_id
     for update;
    v_delta := v_line.counted_quantity - v_balance;
    if v_delta <> 0 then
      v_balance := v_line.counted_quantity;
      update public.inventory_balances set quantity = v_balance, updated_at = now()
       where institution_id = v_session.institution_id
         and item_id = v_line.item_id and location_id = v_session.location_id;
      insert into public.inventory_movements(
        institution_id, item_id, location_id, movement_type, quantity_delta,
        balance_after, idempotency_key, note, performed_by, inventory_count_session_id
      ) values (
        v_session.institution_id, v_line.item_id, v_session.location_id, 'ADJUSTMENT',
        v_delta, v_balance,
        btrim(p_idempotency_key) || ':' || v_line.item_id::text,
        concat_ws(' — ', 'Contagem física ' || left(v_session.id::text, 8),
          nullif(btrim(coalesce(v_session.note, '')), '')),
        v_actor, v_session.id
      );
      v_adjusted_count := v_adjusted_count + 1;
    end if;
  end loop;

  update public.inventory_count_sessions set
    status = 'FINALIZED', finalization_key = btrim(p_idempotency_key),
    finalized_by = v_actor, finalized_at = now()
   where institution_id = v_session.institution_id and id = v_session.id;
  insert into public.inventory_audit_events(
    institution_id, actor_id, action, entity_type, entity_id,
    idempotency_key, details
  ) values (
    v_session.institution_id, v_actor, 'COUNT_FINALIZED', 'COUNT_SESSION', v_session.id,
    btrim(p_idempotency_key) || ':audit',
    jsonb_build_object('adjusted_item_count', v_adjusted_count)
  );
  return v_session.id;
end;
$$;

create or replace function public.inventory_cancel_count(
  p_session_id uuid,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_session public.inventory_count_sessions%rowtype;
  v_existing_event uuid;
begin
  select * into v_session from public.inventory_count_sessions
   where id = p_session_id for update;
  if not found or v_actor is null or not private.has_exact_institution_role(
    v_session.institution_id, array['DIRECTOR', 'SECRETARY']::public.user_role[]
  ) then raise exception using errcode = '42501', message = 'INVENTORY_FORBIDDEN'; end if;
  if length(btrim(coalesce(p_idempotency_key, ''))) < 8 then
    raise exception using errcode = '22023', message = 'INVENTORY_INVALID_COUNT';
  end if;
  select id into v_existing_event from public.inventory_audit_events
   where institution_id = v_session.institution_id
     and idempotency_key = btrim(p_idempotency_key) || ':audit';
  if v_existing_event is not null then return v_session.id; end if;
  if v_session.status <> 'OPEN' then
    raise exception using errcode = '22023', message = 'INVENTORY_COUNT_NOT_OPEN';
  end if;
  update public.inventory_count_sessions set
    status = 'CANCELLED', cancellation_key = btrim(p_idempotency_key),
    cancelled_by = v_actor, cancelled_at = now()
   where institution_id = v_session.institution_id and id = v_session.id;
  insert into public.inventory_audit_events(
    institution_id, actor_id, action, entity_type, entity_id,
    idempotency_key, details
  ) values (
    v_session.institution_id, v_actor, 'COUNT_CANCELLED', 'COUNT_SESSION', v_session.id,
    btrim(p_idempotency_key) || ':audit', '{}'::jsonb
  );
  return v_session.id;
end;
$$;

revoke all on function public.inventory_start_count(uuid, uuid, text, text)
  from public, anon;
revoke all on function public.inventory_save_count(uuid, jsonb, text)
  from public, anon;
revoke all on function public.inventory_finalize_count(uuid, text)
  from public, anon;
revoke all on function public.inventory_cancel_count(uuid, text)
  from public, anon;
grant execute on function public.inventory_start_count(uuid, uuid, text, text)
  to authenticated;
grant execute on function public.inventory_save_count(uuid, jsonb, text)
  to authenticated;
grant execute on function public.inventory_finalize_count(uuid, text)
  to authenticated;
grant execute on function public.inventory_cancel_count(uuid, text)
  to authenticated;

commit;
