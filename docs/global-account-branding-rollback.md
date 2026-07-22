# Global and account branding rollback

This migration is additive. Do not run this rollback in production without a
fresh backup and a maintenance window.

```sql
begin;

drop policy if exists branding_storage_write_policy on storage.objects;

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

drop function if exists public.is_reserved_branding_hostname(text);
drop function if exists public.normalize_branding_hostname(text);

commit;
```
