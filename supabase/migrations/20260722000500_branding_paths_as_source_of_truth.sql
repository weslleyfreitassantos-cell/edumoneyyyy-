begin;

alter table public.branding_settings
  drop constraint if exists branding_settings_logo_pair_check,
  drop constraint if exists branding_settings_favicon_pair_check,
  drop constraint if exists branding_settings_logo_url_matches_path_check,
  drop constraint if exists branding_settings_favicon_url_matches_path_check;

drop function if exists public.resolve_public_branding(text);
drop function if exists public.is_valid_branding_asset_url(text, text);

alter table public.branding_settings
  drop column if exists logo_url,
  drop column if exists favicon_url;

create or replace function public.resolve_public_branding(hostname text)
returns table (
  scope text,
  display_name text,
  logo_path text,
  favicon_path text,
  primary_color text,
  secondary_color text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_hostname text;
  global_branding public.branding_settings%rowtype;
  account_branding public.branding_settings%rowtype;
begin
  normalized_hostname := public.normalize_branding_hostname(hostname);

  select *
  into global_branding
  from public.branding_settings as branding
  where branding.scope_type = 'GLOBAL'
    and branding.account_id is null
  limit 1;

  if normalized_hostname <> ''
      and normalized_hostname <> 'edumoneyyyy.weslleyfreitassantos.workers.dev' then
    select branding.*
    into account_branding
    from public.account_domains as domain
    join public.branding_settings as branding
      on branding.account_id = domain.account_id
     and branding.scope_type = 'ACCOUNT'
    where lower(domain.hostname) = normalized_hostname
      and domain.status = 'ACTIVE'
    limit 1;

    if account_branding.id is not null then
      return query
      select
        'ACCOUNT'::text,
        coalesce(account_branding.display_name, global_branding.display_name),
        coalesce(account_branding.logo_path, global_branding.logo_path),
        coalesce(account_branding.favicon_path, global_branding.favicon_path),
        coalesce(account_branding.primary_color, global_branding.primary_color, '#005bbf'),
        coalesce(account_branding.secondary_color, global_branding.secondary_color, '#6ffbbe');
      return;
    end if;
  end if;

  if global_branding.id is not null then
    return query
    select
      'GLOBAL'::text,
      global_branding.display_name,
      global_branding.logo_path,
      global_branding.favicon_path,
      coalesce(global_branding.primary_color, '#005bbf'),
      coalesce(global_branding.secondary_color, '#6ffbbe');
    return;
  end if;

  return query
  select
    'FALLBACK'::text,
    null::text,
    null::text,
    null::text,
    '#005bbf'::text,
    '#6ffbbe'::text;
end;
$$;

revoke all on function public.resolve_public_branding(text)
  from public, anon, authenticated;

grant execute on function public.resolve_public_branding(text)
  to anon, authenticated, service_role;

commit;
