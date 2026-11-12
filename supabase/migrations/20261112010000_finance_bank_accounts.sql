-- Stores more than one bank account per school without exposing provider secrets.
-- The existing configuration row remains the compatibility source for the current
-- Santander CNAB and Nubank simulation flows; the principal account is mirrored
-- there only after its required fields are complete.
begin;

create table if not exists public.finance_bank_accounts (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 80),
  bank_code text not null check (bank_code in ('033', '001', '104', '237', '260')),
  provider_mode text not null default 'API_PENDING'
    check (provider_mode in ('CNAB240', 'API_PENDING', 'SIMULATION')),
  status text not null default 'CONFIGURATION_PENDING'
    check (status in ('CONFIGURATION_PENDING', 'READY_FOR_FILE', 'SIMULATION_ONLY', 'INTEGRATION_PENDING')),
  agency text check (agency is null or agency ~ '^[0-9]{1,8}$'),
  agency_digit text check (agency_digit is null or agency_digit ~ '^[0-9Xx]{1,2}$'),
  account_number text check (account_number is null or account_number ~ '^[0-9]{1,20}$'),
  account_digit text check (account_digit is null or account_digit ~ '^[0-9Xx]{1,2}$'),
  transmission_code text check (transmission_code is null or transmission_code ~ '^[0-9]{1,40}$'),
  wallet text check (wallet is null or length(btrim(wallet)) between 1 and 20),
  is_default boolean not null default false,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, display_name)
);

create unique index if not exists finance_bank_accounts_one_default_idx
  on public.finance_bank_accounts(institution_id) where is_default;
create index if not exists finance_bank_accounts_institution_idx
  on public.finance_bank_accounts(institution_id, updated_at desc);

alter table public.finance_bank_accounts enable row level security;
revoke all on public.finance_bank_accounts from public, anon, authenticated;

insert into public.finance_bank_accounts(
  institution_id, display_name, bank_code, provider_mode, status, agency, agency_digit,
  account_number, account_digit, transmission_code, wallet, is_default, updated_by, updated_at
)
select
  legacy.institution_id,
  'Conta principal',
  legacy.bank_code,
  case when legacy.bank_code = '033' then 'CNAB240' when legacy.bank_code = '260' then 'SIMULATION' else 'API_PENDING' end,
  case when legacy.bank_code = '260' then 'SIMULATION_ONLY'
       when legacy.bank_code = '033' then 'READY_FOR_FILE'
       else 'INTEGRATION_PENDING' end,
  legacy.agency, legacy.agency_digit, legacy.account_number, legacy.account_digit,
  legacy.transmission_code, legacy.wallet, true, legacy.updated_by, legacy.updated_at
from public.finance_bank_configurations legacy
where not exists (
  select 1 from public.finance_bank_accounts account
  where account.institution_id = legacy.institution_id
);

create or replace function public.finance_list_bank_accounts(p_institution_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_BANK_CONFIGURATION_FORBIDDEN';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', account.id,
      'display_name', account.display_name,
      'bank_code', account.bank_code,
      'provider_mode', account.provider_mode,
      'status', account.status,
      'agency', account.agency,
      'agency_digit', account.agency_digit,
      'account_number', account.account_number,
      'account_digit', account.account_digit,
      'transmission_code', account.transmission_code,
      'wallet', account.wallet,
      'is_default', account.is_default,
      'updated_at', account.updated_at
    ) order by account.is_default desc, account.updated_at desc)
    from public.finance_bank_accounts account
    where account.institution_id = p_institution_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.finance_save_bank_account(
  p_institution_id uuid,
  p_account_id uuid,
  p_display_name text,
  p_bank_code text,
  p_agency text,
  p_agency_digit text,
  p_account_number text,
  p_account_digit text,
  p_transmission_code text,
  p_wallet text,
  p_set_default boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_account public.finance_bank_accounts%rowtype;
  v_complete boolean;
  v_provider_mode text;
  v_status text;
begin
  if v_actor is null or not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_BANK_CONFIGURATION_FORBIDDEN';
  end if;
  if p_bank_code not in ('033', '001', '104', '237', '260') then
    raise exception using errcode = '22023', message = 'FINANCE_BANK_CODE_INVALID';
  end if;
  if p_set_default and p_bank_code in ('001', '104', '237') then
    raise exception using errcode = '22023', message = 'FINANCE_BANK_PROVIDER_NOT_READY';
  end if;

  v_complete := p_bank_code = '260' or (
    coalesce(p_agency, '') ~ '^[0-9]{1,8}$'
    and coalesce(p_agency_digit, '') ~ '^[0-9Xx]{1,2}$'
    and coalesce(p_account_number, '') ~ '^[0-9]{1,20}$'
    and coalesce(p_account_digit, '') ~ '^[0-9Xx]{1,2}$'
    and coalesce(p_transmission_code, '') ~ '^[0-9]{1,40}$'
    and length(btrim(coalesce(p_wallet, ''))) between 1 and 20
  );
  if p_set_default and not v_complete then
    raise exception using errcode = '22023', message = 'FINANCE_BANK_ACCOUNT_INCOMPLETE';
  end if;

  v_provider_mode := case when p_bank_code = '033' then 'CNAB240' when p_bank_code = '260' then 'SIMULATION' else 'API_PENDING' end;
  v_status := case
    when p_bank_code = '260' then 'SIMULATION_ONLY'
    when p_bank_code in ('001', '104', '237') then 'INTEGRATION_PENDING'
    when v_complete then 'READY_FOR_FILE'
    else 'CONFIGURATION_PENDING'
  end;

  if p_account_id is null then
    insert into public.finance_bank_accounts(
      institution_id, display_name, bank_code, provider_mode, status, agency, agency_digit,
      account_number, account_digit, transmission_code, wallet, is_default, updated_by
    ) values (
      p_institution_id, btrim(p_display_name), p_bank_code, v_provider_mode, v_status,
      nullif(btrim(p_agency), ''), nullif(btrim(p_agency_digit), ''), nullif(btrim(p_account_number), ''),
      nullif(btrim(p_account_digit), ''), nullif(btrim(p_transmission_code), ''), nullif(btrim(p_wallet), ''),
      false, v_actor
    ) returning * into v_account;
  else
    select * into v_account from public.finance_bank_accounts
      where id = p_account_id and institution_id = p_institution_id for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'FINANCE_BANK_ACCOUNT_NOT_FOUND';
    end if;
    if v_account.is_default and not p_set_default then
      raise exception using errcode = '22023', message = 'FINANCE_DEFAULT_BANK_ACCOUNT_REQUIRED';
    end if;
    update public.finance_bank_accounts set
      display_name = btrim(p_display_name), bank_code = p_bank_code, provider_mode = v_provider_mode,
      status = v_status, agency = nullif(btrim(p_agency), ''), agency_digit = nullif(btrim(p_agency_digit), ''),
      account_number = nullif(btrim(p_account_number), ''), account_digit = nullif(btrim(p_account_digit), ''),
      transmission_code = nullif(btrim(p_transmission_code), ''), wallet = nullif(btrim(p_wallet), ''),
      is_default = p_set_default,
      updated_by = v_actor, updated_at = now()
      where id = v_account.id
      returning * into v_account;
  end if;

  if p_set_default then
    update public.finance_bank_accounts set is_default = false, updated_at = now()
      where institution_id = p_institution_id and id <> v_account.id;
    update public.finance_bank_accounts set is_default = true, updated_at = now()
      where id = v_account.id;
    v_account.is_default := true;

    if v_account.bank_code in ('033', '260') then
      insert into public.finance_bank_configurations(
        institution_id, bank_code, agency, agency_digit, account_number, account_digit,
        agreement, transmission_code, wallet, updated_by
      ) values (
        p_institution_id, v_account.bank_code,
        coalesce(v_account.agency, '0'), coalesce(v_account.agency_digit, '0'),
        coalesce(v_account.account_number, '0'), coalesce(v_account.account_digit, '0'),
        coalesce(v_account.transmission_code, '0'), coalesce(v_account.transmission_code, '0'),
        coalesce(v_account.wallet, '0'), v_actor
      ) on conflict (institution_id) do update set
        bank_code = excluded.bank_code, agency = excluded.agency, agency_digit = excluded.agency_digit,
        account_number = excluded.account_number, account_digit = excluded.account_digit,
        agreement = excluded.agreement, transmission_code = excluded.transmission_code,
        wallet = excluded.wallet, updated_by = excluded.updated_by, updated_at = now();
    end if;
  end if;

  insert into public.finance_audit_events(institution_id, actor_id, action, entity_type, entity_id, details)
  values (p_institution_id, v_actor, 'FINANCE_BANK_ACCOUNT_UPDATED', 'BANK_ACCOUNT', v_account.id,
    jsonb_build_object('bank_code', v_account.bank_code, 'status', v_account.status, 'is_default', v_account.is_default));

  return jsonb_build_object(
    'id', v_account.id, 'display_name', v_account.display_name, 'bank_code', v_account.bank_code,
    'provider_mode', v_account.provider_mode, 'status', v_account.status, 'is_default', v_account.is_default
  );
end;
$$;

revoke all on function public.finance_list_bank_accounts(uuid) from public, anon;
revoke all on function public.finance_save_bank_account(uuid, uuid, text, text, text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.finance_list_bank_accounts(uuid) to authenticated;
grant execute on function public.finance_save_bank_account(uuid, uuid, text, text, text, text, text, text, text, text, boolean) to authenticated;

commit;
