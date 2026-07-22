# Global and account branding rollback

This migration is additive. Do not run this rollback in production without a
fresh backup and a maintenance window.

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
