-- Migration: Public Institution Subdomain Resolver RPC
-- Safely resolves public institution identity by subdomain for both anon and authenticated roles.

create or replace function public.resolve_public_institution_by_subdomain(target_subdomain text)
returns table (
  id uuid,
  name text,
  subdomain text,
  logo_url text,
  primary_color text,
  secondary_color text,
  active boolean,
  account_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  clean_subdomain text;
begin
  clean_subdomain := lower(trim(target_subdomain));
  if clean_subdomain = '' then
    return;
  end if;

  return query
  select
    inst.id,
    inst.name,
    inst.subdomain,
    inst.logo_url,
    inst.primary_color,
    inst.secondary_color,
    inst.active,
    inst.account_id
  from public.institutions as inst
  left join public.accounts as acc
    on acc.id = inst.account_id
  where inst.subdomain = clean_subdomain
    and inst.active is true
    and (inst.account_id is null or acc.status = 'ACTIVE')
  limit 1;
end;
$$;

revoke all on function public.resolve_public_institution_by_subdomain(text)
  from public, anon, authenticated;

grant execute on function public.resolve_public_institution_by_subdomain(text)
  to anon, authenticated, service_role;
