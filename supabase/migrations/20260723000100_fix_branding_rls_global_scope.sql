begin;

drop policy if exists branding_settings_select_policy
  on public.branding_settings;

create policy branding_settings_select_policy
on public.branding_settings
for select
to authenticated
using (
  public.is_platform_super_admin()
  or scope_type = 'GLOBAL'
  or (
    scope_type = 'ACCOUNT'
    and public.owns_account(account_id)
  )
);

drop policy if exists branding_settings_update_policy
  on public.branding_settings;

create policy branding_settings_update_policy
on public.branding_settings
for update
to authenticated
using (
  public.is_platform_super_admin()
  or scope_type = 'GLOBAL'
  or (
    scope_type = 'ACCOUNT'
    and public.owns_account(account_id)
  )
)
with check (
  updated_by = auth.uid()
  and (
    (scope_type = 'GLOBAL' and public.is_platform_super_admin())
    or (
      scope_type = 'ACCOUNT'
      and public.owns_account(account_id)
    )
  )
);

drop policy if exists branding_settings_delete_policy
  on public.branding_settings;

create policy branding_settings_delete_policy
on public.branding_settings
for delete
to authenticated
using (
  public.is_platform_super_admin()
  or scope_type = 'GLOBAL'
  or (
    scope_type = 'ACCOUNT'
    and public.owns_account(account_id)
  )
);

commit;