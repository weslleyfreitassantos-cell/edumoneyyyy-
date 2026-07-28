# Global and account branding rollback

Do not run these rollbacks in production without a fresh backup and a
maintenance window.

## Roll back paths as the source of truth

Use this only to revert the corrective migration
`20260722000500_branding_paths_as_source_of_truth.sql`. The current application
derives public URLs from `logo_path` and `favicon_path`; this rollback restores
the previous URL columns for emergency compatibility.

Replace the storage origin placeholder with the public Storage origin of the
same Supabase project before running the block.

```sql
begin;

set local app.rollback_storage_origin = 'https://<project-ref>.supabase.co';

alter table public.branding_settings
  add column if not exists logo_url text,
  add column if not exists favicon_url text;

do $rollback$
declare
  storage_origin text;
begin
  storage_origin := trim(
    trailing '/'
    from nullif(current_setting('app.rollback_storage_origin', true), '')
  );

  if storage_origin is null
      or storage_origin !~ '^https://[^/]+$' then
    raise exception
      'Set app.rollback_storage_origin to the trusted Supabase Storage origin before rolling back migration 005.';
  end if;

  update public.branding_settings
  set
    logo_url = case
      when logo_path is null then null
      else storage_origin ||
        '/storage/v1/object/public/institution-branding/' ||
        logo_path ||
        '?v=' ||
        floor(extract(epoch from clock_timestamp()))::bigint::text
      end,
    favicon_url = case
      when favicon_path is null then null
      else storage_origin ||
        '/storage/v1/object/public/institution-branding/' ||
        favicon_path ||
        '?v=' ||
        floor(extract(epoch from clock_timestamp()))::bigint::text
      end;
end;
$rollback$;

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

drop function if exists public.resolve_public_branding(text);

create or replace function public.resolve_public_branding(hostname text)
returns table (
  scope text,
  display_name text,
  logo_url text,
  favicon_url text,
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
        coalesce(account_branding.logo_url, global_branding.logo_url),
        coalesce(account_branding.favicon_url, global_branding.favicon_url),
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
      global_branding.logo_url,
      global_branding.favicon_url,
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

revoke all on function public.is_valid_branding_asset_url(text, text)
  from public, anon, authenticated;

grant execute on function public.is_valid_branding_asset_url(text, text)
  to authenticated, service_role;

revoke all on function public.resolve_public_branding(text)
  from public, anon, authenticated;

grant execute on function public.resolve_public_branding(text)
  to anon, authenticated, service_role;

commit;
```

## Roll back the asset enforcement correction

Use this only to revert the corrective migration
`20260722000400_branding_asset_enforcement.sql`. It removes the stricter
constraints and restores the previous Storage write policies.

```sql
begin;

alter table public.branding_settings
  drop constraint if exists branding_settings_logo_pair_check,
  drop constraint if exists branding_settings_favicon_pair_check,
  drop constraint if exists branding_settings_logo_path_scope_check,
  drop constraint if exists branding_settings_favicon_path_scope_check,
  drop constraint if exists branding_settings_logo_url_matches_path_check,
  drop constraint if exists branding_settings_favicon_url_matches_path_check;

drop policy if exists branding_storage_insert_policy on storage.objects;
drop policy if exists branding_storage_update_policy on storage.objects;
drop policy if exists branding_storage_delete_policy on storage.objects;

drop policy if exists institution_branding_super_admin_write on storage.objects;

create policy institution_branding_super_admin_write
on storage.objects
for all
to authenticated
using (
  bucket_id = 'institution-branding'
  and public.is_platform_super_admin()
)
with check (
  bucket_id = 'institution-branding'
  and public.is_platform_super_admin()
);

drop function if exists public.can_write_branding_storage_object(text, jsonb);
drop function if exists public.can_delete_branding_storage_object(text);
drop function if exists public.is_valid_branding_storage_metadata(text, jsonb);
drop function if exists public.is_valid_branding_asset_url(text, text);
drop function if exists public.branding_asset_account_id(text);
drop function if exists public.branding_asset_extension(text);
drop function if exists public.branding_asset_kind(text);
drop function if exists public.is_valid_branding_asset_path(text, text, uuid, text);

create or replace function public.can_write_branding_storage_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folders text[];
  target_account_id uuid;
begin
  folders := storage.foldername(object_name);

  if coalesce(folders[1], '') <> 'branding' then
    return false;
  end if;

  if folders[2] = 'global' then
    return
      public.is_platform_super_admin()
      and folders[3] in ('logo', 'favicon');
  end if;

  if folders[2] = 'accounts' then
    if coalesce(folders[3], '') !~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      return false;
    end if;

    target_account_id := folders[3]::uuid;

    return
      folders[4] in ('logo', 'favicon')
      and (
        public.is_platform_super_admin()
        or public.owns_account(target_account_id)
      );
  end if;

  return false;
end;
$$;

create policy branding_storage_write_policy
on storage.objects
for all
to authenticated
using (
  bucket_id = 'institution-branding'
  and public.can_write_branding_storage_object(name)
)
with check (
  bucket_id = 'institution-branding'
  and public.can_write_branding_storage_object(name)
);

revoke all on function public.can_write_branding_storage_object(text)
  from public, anon, authenticated;

grant execute on function public.can_write_branding_storage_object(text)
  to authenticated, service_role;

commit;
```

## Roll back the original feature migration

```sql
begin;

drop policy if exists branding_storage_write_policy on storage.objects;
drop policy if exists branding_storage_insert_policy on storage.objects;
drop policy if exists branding_storage_update_policy on storage.objects;
drop policy if exists branding_storage_delete_policy on storage.objects;

drop policy if exists account_domains_delete_policy on public.account_domains;
drop policy if exists account_domains_update_policy on public.account_domains;
drop policy if exists account_domains_insert_policy on public.account_domains;
drop policy if exists account_domains_select_policy on public.account_domains;

drop policy if exists branding_settings_delete_policy on public.branding_settings;
drop policy if exists branding_settings_update_policy on public.branding_settings;
drop policy if exists branding_settings_insert_policy on public.branding_settings;
drop policy if exists branding_settings_select_policy on public.branding_settings;

drop trigger if exists account_domains_touch_audit on public.account_domains;
drop trigger if exists branding_settings_touch_audit on public.branding_settings;

drop function if exists public.resolve_public_branding(text);
drop function if exists public.can_write_branding_storage_object(text);
drop function if exists private.touch_account_domains_audit();
drop function if exists private.touch_branding_settings_audit();

drop table if exists public.account_domains;
drop table if exists public.branding_settings;

drop function if exists public.can_write_branding_storage_object(text, jsonb);
drop function if exists public.can_delete_branding_storage_object(text);
drop function if exists public.is_valid_branding_storage_metadata(text, jsonb);
drop function if exists public.is_valid_branding_asset_url(text, text);
drop function if exists public.branding_asset_account_id(text);
drop function if exists public.branding_asset_extension(text);
drop function if exists public.branding_asset_kind(text);
drop function if exists public.is_valid_branding_asset_path(text, text, uuid, text);

drop function if exists public.is_reserved_branding_hostname(text);
drop function if exists public.normalize_branding_hostname(text);

commit;
```
