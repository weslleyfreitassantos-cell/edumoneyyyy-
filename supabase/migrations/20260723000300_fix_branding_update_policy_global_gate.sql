begin;

drop policy if exists branding_settings_update_policy
  on public.branding_settings;

create policy branding_settings_update_policy
on public.branding_settings
for update
to authenticated
using (
  (
    scope_type = 'GLOBAL'
    and account_id is null
    and public.is_platform_super_admin()
  )
  or (
    scope_type = 'ACCOUNT'
    and account_id is not null
    and (
      public.is_platform_super_admin()
      or public.owns_account(account_id)
    )
  )
)
with check (
  (
    scope_type = 'GLOBAL'
    and account_id is null
    and public.is_platform_super_admin()
  )
  or (
    scope_type = 'ACCOUNT'
    and account_id is not null
    and (
      public.is_platform_super_admin()
      or public.owns_account(account_id)
    )
  )
);

notify pgrst, 'reload schema';

commit;