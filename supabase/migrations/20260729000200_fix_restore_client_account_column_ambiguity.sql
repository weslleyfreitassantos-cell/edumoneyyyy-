-- Corrige referencias ambiguas dentro da RPC de restauracao.
-- Nao altera dados: apenas recompila a funcao com aliases explicitos.

create or replace function public.restore_client_account(
  target_account_id uuid,
  actor_profile_id uuid,
  change_reason text default null
)
returns table (
  account_id uuid,
  previous_status text,
  new_status text,
  institution_limit integer,
  audit_event_id uuid,
  status_changed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_record public.accounts%rowtype;
  normalized_reason text;
  created_event_id uuid;
begin
  select account.*
  into account_record
  from public.accounts as account
  where account.id = target_account_id
  for update;

  if not found then
    raise exception 'ACCOUNT_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  normalized_reason := nullif(
    btrim(
      regexp_replace(
        coalesce(change_reason, ''),
        '\s+',
        ' ',
        'g'
      )
    ),
    ''
  );

  if account_record.status <> 'CANCELED' then
    raise exception 'ACCOUNT_NOT_CANCELED'
      using errcode = 'P0001';
  end if;

  if normalized_reason is null
      or not (length(normalized_reason) between 10 and 500) then
    raise exception 'ACCOUNT_STATUS_REASON_REQUIRED'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.account_domains as domain
    where domain.account_id <> account_record.id
      and lower(domain.hostname) in (
        select lower(own_domain.hostname)
        from public.account_domains as own_domain
        where own_domain.account_id = account_record.id
      )
  ) then
    raise exception 'ACCOUNT_DOMAIN_CONFLICT'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.profiles as owner_profile
    where owner_profile.id = account_record.owner_profile_id
      and owner_profile.active is true
  ) then
    raise exception 'ACCOUNT_OWNER_INACTIVE'
      using errcode = 'P0001';
  end if;

  update public.accounts as account
  set status = 'ACTIVE'
  where account.id = account_record.id;

  insert into public.account_status_events (
    account_id,
    actor_profile_id,
    previous_status,
    new_status,
    reason,
    metadata
  )
  values (
    account_record.id,
    actor_profile_id,
    account_record.status,
    'ACTIVE',
    normalized_reason,
    jsonb_build_object(
      'source', 'restore-client-account',
      'fix', 'qualified-account-domain-columns'
    )
  )
  returning id into created_event_id;

  return query
    select
      account_record.id,
      account_record.status,
      'ACTIVE'::text,
      account_record.institution_limit,
      created_event_id,
      true;
end;
$$;

revoke all on function public.restore_client_account(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.restore_client_account(uuid, uuid, text)
  to service_role;
