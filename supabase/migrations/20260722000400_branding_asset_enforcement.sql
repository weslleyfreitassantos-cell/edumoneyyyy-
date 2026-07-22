begin;

drop policy if exists branding_storage_write_policy
  on storage.objects;

drop policy if exists branding_storage_insert_policy
  on storage.objects;

drop policy if exists branding_storage_update_policy
  on storage.objects;

drop policy if exists branding_storage_delete_policy
  on storage.objects;

drop policy if exists institution_branding_super_admin_write
  on storage.objects;

drop function if exists public.can_write_branding_storage_object(text);
drop function if exists public.can_write_branding_storage_object(text, jsonb);
drop function if exists public.can_delete_branding_storage_object(text);
drop function if exists public.is_valid_branding_storage_metadata(text, jsonb);
drop function if exists public.is_valid_branding_asset_url(text, text);
drop function if exists public.branding_asset_account_id(text);
drop function if exists public.branding_asset_extension(text);
drop function if exists public.branding_asset_kind(text);
drop function if exists public.is_valid_branding_asset_path(text, text, uuid, text);

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
      and expected_kind not in ('logo', 'favicon') then
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
    and current_kind in ('logo', 'favicon')
    and filename ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$';
end;
$$;

create or replace function public.branding_asset_kind(asset_path text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  parts text[];
begin
  if not public.is_valid_branding_asset_path(asset_path) then
    return null;
  end if;

  parts := string_to_array(asset_path, '/');

  if parts[2] = 'global' then
    return parts[3];
  end if;

  return parts[4];
end;
$$;

create or replace function public.branding_asset_extension(asset_path text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  parts text[];
  filename text;
begin
  if not public.is_valid_branding_asset_path(asset_path) then
    return null;
  end if;

  parts := string_to_array(asset_path, '/');
  filename := parts[coalesce(array_length(parts, 1), 0)];

  return regexp_replace(filename, '^.*\.', '');
end;
$$;

create or replace function public.branding_asset_account_id(asset_path text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  parts text[];
begin
  if not public.is_valid_branding_asset_path(asset_path) then
    return null;
  end if;

  parts := string_to_array(asset_path, '/');

  if parts[2] <> 'accounts' then
    return null;
  end if;

  return parts[3]::uuid;
end;
$$;

create or replace function public.is_valid_branding_asset_url(
  asset_url text,
  asset_path text
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  without_scheme text;
  slash_index integer;
  url_host text;
  request_target text;
  expected_target text;
  version_value text;
begin
  if asset_url is null
      or asset_path is null
      or not public.is_valid_branding_asset_path(asset_path)
      or position('https://' in asset_url) <> 1 then
    return false;
  end if;

  without_scheme := substr(asset_url, length('https://') + 1);
  slash_index := strpos(without_scheme, '/');

  if slash_index < 2 then
    return false;
  end if;

  url_host := substr(without_scheme, 1, slash_index - 1);
  request_target := substr(without_scheme, slash_index);
  expected_target :=
    '/storage/v1/object/public/institution-branding/' || asset_path;

  if url_host !~ '^[a-z0-9]{20}\.supabase\.co$' then
    return false;
  end if;

  if request_target = expected_target then
    return true;
  end if;

  if left(request_target, length(expected_target) + 3)
      <> expected_target || '?v=' then
    return false;
  end if;

  version_value := substr(request_target, length(expected_target) + 4);

  return version_value ~ '^[0-9]+$';
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
    else 0
  end;
end;
$$;

create or replace function public.can_delete_branding_storage_object(
  object_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parts text[];
  target_account_id uuid;
begin
  if not public.is_valid_branding_asset_path(object_name) then
    return false;
  end if;

  parts := string_to_array(object_name, '/');

  if parts[2] = 'global' then
    return public.is_platform_super_admin();
  end if;

  target_account_id := public.branding_asset_account_id(object_name);

  return
    target_account_id is not null
    and (
      public.is_platform_super_admin()
      or public.owns_account(target_account_id)
    );
end;
$$;

create or replace function public.can_write_branding_storage_object(
  object_name text,
  object_metadata jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return
    public.can_delete_branding_storage_object(object_name)
    and public.is_valid_branding_storage_metadata(
      object_name,
      object_metadata
    );
end;
$$;

do $$
begin
  if exists (
    select 1
    from public.branding_settings as branding
    where not (
      (
        branding.logo_url is null
        and branding.logo_path is null
      )
      or (
        branding.logo_url is not null
        and branding.logo_path is not null
        and public.is_valid_branding_asset_path(
          branding.logo_path,
          branding.scope_type,
          branding.account_id,
          'logo'
        )
        and public.is_valid_branding_asset_url(
          branding.logo_url,
          branding.logo_path
        )
      )
    )
  ) then
    raise exception 'Existing branding_settings rows contain invalid logo URL/path pairs.';
  end if;

  if exists (
    select 1
    from public.branding_settings as branding
    where not (
      (
        branding.favicon_url is null
        and branding.favicon_path is null
      )
      or (
        branding.favicon_url is not null
        and branding.favicon_path is not null
        and public.is_valid_branding_asset_path(
          branding.favicon_path,
          branding.scope_type,
          branding.account_id,
          'favicon'
        )
        and public.is_valid_branding_asset_url(
          branding.favicon_url,
          branding.favicon_path
        )
      )
    )
  ) then
    raise exception 'Existing branding_settings rows contain invalid favicon URL/path pairs.';
  end if;
end;
$$;

alter table public.branding_settings
  drop constraint if exists branding_settings_logo_pair_check,
  drop constraint if exists branding_settings_favicon_pair_check,
  drop constraint if exists branding_settings_logo_path_scope_check,
  drop constraint if exists branding_settings_favicon_path_scope_check,
  drop constraint if exists branding_settings_logo_url_matches_path_check,
  drop constraint if exists branding_settings_favicon_url_matches_path_check;

alter table public.branding_settings
  add constraint branding_settings_logo_pair_check
    check ((logo_url is null) = (logo_path is null)),
  add constraint branding_settings_favicon_pair_check
    check ((favicon_url is null) = (favicon_path is null)),
  add constraint branding_settings_logo_path_scope_check
    check (
      logo_path is null
      or public.is_valid_branding_asset_path(
        logo_path,
        scope_type,
        account_id,
        'logo'
      )
    ),
  add constraint branding_settings_favicon_path_scope_check
    check (
      favicon_path is null
      or public.is_valid_branding_asset_path(
        favicon_path,
        scope_type,
        account_id,
        'favicon'
      )
    ),
  add constraint branding_settings_logo_url_matches_path_check
    check (
      logo_url is null
      or public.is_valid_branding_asset_url(logo_url, logo_path)
    ),
  add constraint branding_settings_favicon_url_matches_path_check
    check (
      favicon_url is null
      or public.is_valid_branding_asset_url(favicon_url, favicon_path)
    );

create policy institution_branding_super_admin_write
on storage.objects
for all
to authenticated
using (
  bucket_id = 'institution-branding'
  and public.is_platform_super_admin()
  and coalesce((storage.foldername(name))[1], '') <> 'branding'
)
with check (
  bucket_id = 'institution-branding'
  and public.is_platform_super_admin()
  and coalesce((storage.foldername(name))[1], '') <> 'branding'
);

create policy branding_storage_insert_policy
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'institution-branding'
  and public.can_write_branding_storage_object(name, metadata)
);

create policy branding_storage_update_policy
on storage.objects
for update
to authenticated
using (
  bucket_id = 'institution-branding'
  and public.can_delete_branding_storage_object(name)
)
with check (
  bucket_id = 'institution-branding'
  and public.can_write_branding_storage_object(name, metadata)
);

create policy branding_storage_delete_policy
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'institution-branding'
  and public.can_delete_branding_storage_object(name)
);

revoke all on function public.is_valid_branding_asset_path(text, text, uuid, text)
  from public, anon, authenticated;

revoke all on function public.branding_asset_kind(text)
  from public, anon, authenticated;

revoke all on function public.branding_asset_extension(text)
  from public, anon, authenticated;

revoke all on function public.branding_asset_account_id(text)
  from public, anon, authenticated;

revoke all on function public.is_valid_branding_asset_url(text, text)
  from public, anon, authenticated;

revoke all on function public.is_valid_branding_storage_metadata(text, jsonb)
  from public, anon, authenticated;

revoke all on function public.can_delete_branding_storage_object(text)
  from public, anon, authenticated;

revoke all on function public.can_write_branding_storage_object(text, jsonb)
  from public, anon, authenticated;

grant execute on function public.is_valid_branding_asset_path(text, text, uuid, text)
  to authenticated, service_role;

grant execute on function public.branding_asset_kind(text)
  to authenticated, service_role;

grant execute on function public.branding_asset_extension(text)
  to authenticated, service_role;

grant execute on function public.branding_asset_account_id(text)
  to authenticated, service_role;

grant execute on function public.is_valid_branding_asset_url(text, text)
  to authenticated, service_role;

grant execute on function public.is_valid_branding_storage_metadata(text, jsonb)
  to authenticated, service_role;

grant execute on function public.can_delete_branding_storage_object(text)
  to authenticated, service_role;

grant execute on function public.can_write_branding_storage_object(text, jsonb)
  to authenticated, service_role;

commit;
