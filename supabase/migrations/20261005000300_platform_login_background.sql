begin;

-- Keep the global login background as a Storage path, like logo and favicon.
alter table public.branding_settings
  add column if not exists login_background_path text;

create or replace function public.is_valid_branding_asset_path(
  asset_path text,
  expected_scope text default null,
  expected_account_id uuid default null,
  expected_kind text default null
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  parts text[];
  current_scope text;
  current_kind text;
  current_account_id uuid;
  filename text;
begin
  if asset_path is null
      or asset_path <> btrim(asset_path)
      or asset_path = ''
      or asset_path like '/%'
      or asset_path like '%/' then
    return false;
  end if;

  parts := string_to_array(asset_path, '/');

  if array_position(parts, '') is not null
      or coalesce(parts[1], '') <> 'branding' then
    return false;
  end if;

  if expected_scope is not null
      and expected_scope not in ('GLOBAL', 'ACCOUNT') then
    return false;
  end if;

  if expected_kind is not null
      and expected_kind not in ('logo', 'favicon', 'background') then
    return false;
  end if;

  if parts[2] = 'global' then
    if coalesce(array_length(parts, 1), 0) <> 4 then
      return false;
    end if;

    current_scope := 'GLOBAL';
    current_kind := parts[3];
    filename := parts[4];

    if expected_account_id is not null then
      return false;
    end if;
  elsif parts[2] = 'accounts' then
    if coalesce(array_length(parts, 1), 0) <> 5
        or coalesce(parts[3], '') !~
          '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return false;
    end if;

    current_scope := 'ACCOUNT';
    current_account_id := parts[3]::uuid;
    current_kind := parts[4];
    filename := parts[5];

    if expected_account_id is not null
        and current_account_id <> expected_account_id then
      return false;
    end if;
  else
    return false;
  end if;

  return
    (expected_scope is null or current_scope = expected_scope)
    and (expected_kind is null or current_kind = expected_kind)
    and current_kind in ('logo', 'favicon', 'background')
    and filename ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$';
end;
$$;

create or replace function public.is_valid_branding_storage_metadata(
  asset_path text,
  object_metadata jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  asset_kind text;
  asset_extension text;
  metadata_mimetype text;
  metadata_size_text text;
  metadata_size bigint;
begin
  if not public.is_valid_branding_asset_path(asset_path)
      or object_metadata is null
      or jsonb_typeof(object_metadata) <> 'object' then
    return false;
  end if;

  asset_kind := public.branding_asset_kind(asset_path);
  asset_extension := public.branding_asset_extension(asset_path);
  metadata_mimetype := object_metadata ->> 'mimetype';
  metadata_size_text := coalesce(
    object_metadata ->> 'size',
    object_metadata ->> 'contentLength'
  );

  if metadata_size_text is null
      or metadata_size_text !~ '^[0-9]+$'
      or length(metadata_size_text) > 18 then
    return false;
  end if;

  metadata_size := metadata_size_text::bigint;

  if metadata_size <= 0 then
    return false;
  end if;

  if asset_extension = 'png'
      and metadata_mimetype <> 'image/png' then
    return false;
  end if;

  if asset_extension = 'jpg'
      and metadata_mimetype <> 'image/jpeg' then
    return false;
  end if;

  if asset_extension = 'webp'
      and metadata_mimetype <> 'image/webp' then
    return false;
  end if;

  if metadata_mimetype not in ('image/png', 'image/jpeg', 'image/webp') then
    return false;
  end if;

  return metadata_size <= case
    when asset_kind = 'logo' then 2 * 1024 * 1024
    when asset_kind = 'favicon' then 512 * 1024
    when asset_kind = 'background' then 5 * 1024 * 1024
    else 0
  end;
end;
$$;

alter table public.branding_settings
  drop constraint if exists branding_settings_login_background_path_scope_check;

alter table public.branding_settings
  add constraint branding_settings_login_background_path_scope_check
    check (
      login_background_path is null
      or public.is_valid_branding_asset_path(
        login_background_path,
        scope_type,
        account_id,
        'background'
      )
    );

drop function if exists public.resolve_public_branding(text);

create or replace function public.resolve_public_branding(hostname text)
returns table (
  scope text,
  display_name text,
  logo_path text,
  favicon_path text,
  login_background_path text,
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
        coalesce(
          account_branding.login_background_path,
          global_branding.login_background_path
        ),
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
      global_branding.login_background_path,
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
    null::text,
    '#005bbf'::text,
    '#6ffbbe'::text;
end;
$$;

revoke all on function public.resolve_public_branding(text)
  from public, anon, authenticated;

grant execute on function public.resolve_public_branding(text)
  to anon, authenticated, service_role;

revoke all on function public.is_valid_branding_asset_path(text, text, uuid, text)
  from public, anon, authenticated;

grant execute on function public.is_valid_branding_asset_path(text, text, uuid, text)
  to authenticated, service_role;

revoke all on function public.is_valid_branding_storage_metadata(text, jsonb)
  from public, anon, authenticated;

grant execute on function public.is_valid_branding_storage_metadata(text, jsonb)
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
