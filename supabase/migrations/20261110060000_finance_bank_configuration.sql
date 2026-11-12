-- Configuracao bancária por instituição; não habilita geração ou conciliação reais.
create table public.finance_bank_configurations (
  institution_id uuid primary key references public.institutions(id) on delete cascade,
  bank_code text not null check (bank_code in ('033', '001', '104', '237')),
  agency text not null check (agency ~ '^[0-9]{1,8}$'),
  agency_digit text not null default '0' check (agency_digit ~ '^[0-9Xx]{1,2}$'),
  account_number text not null check (account_number ~ '^[0-9]{1,20}$'),
  account_digit text not null check (account_digit ~ '^[0-9Xx]{1,2}$'),
  agreement text not null check (length(btrim(agreement)) between 1 and 40),
  transmission_code text not null default '0' check (transmission_code ~ '^[0-9]{1,40}$'),
  wallet text not null check (length(btrim(wallet)) between 1 and 20),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.finance_bank_configurations enable row level security;
revoke all on public.finance_bank_configurations from public, anon, authenticated;

create or replace function public.finance_get_bank_configuration(p_institution_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_FORBIDDEN';
  end if;
  select jsonb_build_object('bank_code', bank_code, 'agency', agency,
    'agency_digit', agency_digit, 'account_number', account_number, 'account_digit', account_digit,
    'agreement', agreement, 'transmission_code', transmission_code, 'wallet', wallet, 'updated_at', updated_at)
    into v_result from public.finance_bank_configurations where institution_id = p_institution_id;
  return v_result;
end;
$$;

create or replace function public.finance_set_bank_configuration(
  p_institution_id uuid, p_bank_code text, p_agency text, p_account_number text,
  p_account_digit text, p_agreement text, p_wallet text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_BANK_CONFIGURATION_FORBIDDEN';
  end if;
  insert into public.finance_bank_configurations(institution_id, bank_code, agency,
    agency_digit, account_number, account_digit, agreement, transmission_code, wallet, updated_by)
  values (p_institution_id, p_bank_code, p_agency, '0', p_account_number,
    p_account_digit, btrim(p_agreement), btrim(p_agreement), btrim(p_wallet), auth.uid())
  on conflict (institution_id) do update set bank_code = excluded.bank_code,
    agency = excluded.agency, agency_digit = excluded.agency_digit, account_number = excluded.account_number,
    account_digit = excluded.account_digit, agreement = excluded.agreement,
    transmission_code = excluded.transmission_code, wallet = excluded.wallet,
    updated_by = excluded.updated_by, updated_at = now();
  insert into public.finance_audit_events(institution_id, actor_id, action, entity_type, details)
  values (p_institution_id, auth.uid(), 'FINANCE_BANK_CONFIGURATION_UPDATED', 'BANK_CONFIGURATION',
    jsonb_build_object('bank_code', p_bank_code));
end;
$$;

create or replace function public.finance_set_bank_configuration_v2(
  p_institution_id uuid, p_bank_code text, p_agency text, p_agency_digit text,
  p_account_number text, p_account_digit text, p_transmission_code text, p_wallet text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.finance_can_manage(p_institution_id) then
    raise exception using errcode = '42501', message = 'FINANCE_BANK_CONFIGURATION_FORBIDDEN';
  end if;
  insert into public.finance_bank_configurations(
    institution_id, bank_code, agency, agency_digit, account_number, account_digit,
    agreement, transmission_code, wallet, updated_by
  ) values (
    p_institution_id, p_bank_code, p_agency, p_agency_digit, p_account_number,
    p_account_digit, btrim(p_transmission_code), btrim(p_transmission_code), btrim(p_wallet), auth.uid()
  ) on conflict (institution_id) do update set
    bank_code = excluded.bank_code, agency = excluded.agency, agency_digit = excluded.agency_digit,
    account_number = excluded.account_number, account_digit = excluded.account_digit,
    agreement = excluded.agreement, transmission_code = excluded.transmission_code,
    wallet = excluded.wallet, updated_by = excluded.updated_by, updated_at = now();
  insert into public.finance_audit_events(institution_id, actor_id, action, entity_type, details)
  values (p_institution_id, auth.uid(), 'FINANCE_BANK_CONFIGURATION_UPDATED', 'BANK_CONFIGURATION',
    jsonb_build_object('bank_code', p_bank_code));
end;
$$;

revoke all on function public.finance_get_bank_configuration(uuid) from public, anon;
revoke all on function public.finance_set_bank_configuration(uuid, text, text, text, text, text, text) from public, anon;
revoke all on function public.finance_set_bank_configuration_v2(uuid, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.finance_get_bank_configuration(uuid) to authenticated;
grant execute on function public.finance_set_bank_configuration(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.finance_set_bank_configuration_v2(uuid, text, text, text, text, text, text, text) to authenticated;
