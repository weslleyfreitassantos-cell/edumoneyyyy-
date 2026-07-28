drop policy if exists institutions_update_branding_policy
  on public.institutions;

create policy institutions_update_branding_policy
on public.institutions
for update
to authenticated
using (
  public.is_platform_super_admin()
  or public.owns_account(account_id)
)
with check (
  public.is_platform_super_admin()
  or public.owns_account(account_id)
);

revoke update on table public.institutions
  from authenticated;

grant update (logo_url, public_slug, updated_at)
  on table public.institutions
  to authenticated;

drop policy if exists institution_branding_super_admin_write
  on storage.objects;

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
