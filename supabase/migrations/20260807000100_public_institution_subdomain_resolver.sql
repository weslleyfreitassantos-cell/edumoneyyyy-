-- Migration: Public Institution Subdomain Resolver RPC & Server-side Reserved Constraint
-- Safely resolves public institution identity by subdomain for both anon and authenticated roles.
-- Enforces server-side constraint on reserved subdomains including 'tecescola'.

alter table public.institutions
  drop constraint if exists institutions_subdomain_not_reserved_check;

alter table public.institutions
  add constraint institutions_subdomain_not_reserved_check
  check (
    subdomain is null
    or lower(trim(subdomain)) not in (
      'admin', 'api', 'app', 'assets', 'auth', 'blog', 'cdn', 'dashboard',
      'dev', 'docs', 'grupotec', 'help', 'login', 'mail', 'media', 'platform',
      'portal', 'privacy', 'resend', 'root', 'send', 'smtp', 'staging',
      'static', 'status', 'suporte', 'support', 'tecescola', 'terms', 'test', 'www'
    )
  );

create or replace function public.resolve_public_institution_by_subdomain(target_subdomain text)
returns table (
  id uuid,
  name text,
  subdomain text,
  logo_url text,
  primary_color text,
  secondary_color text
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
  if clean_subdomain = '' or clean_subdomain in (
    'admin', 'api', 'app', 'assets', 'auth', 'blog', 'cdn', 'dashboard',
    'dev', 'docs', 'grupotec', 'help', 'login', 'mail', 'media', 'platform',
    'portal', 'privacy', 'resend', 'root', 'send', 'smtp', 'staging',
    'static', 'status', 'suporte', 'support', 'tecescola', 'terms', 'test', 'www'
  ) then
    return;
  end if;

  return query
  select
    inst.id,
    inst.name,
    inst.subdomain,
    inst.logo_url,
    inst.primary_color,
    inst.secondary_color
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
  to anon, authenticated;
