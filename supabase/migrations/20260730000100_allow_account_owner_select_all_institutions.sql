drop policy if exists institutions_select_policy
  on public.institutions;

create policy institutions_select_policy
on public.institutions
for select
to authenticated
using (
  public.can_access_institution(id)
  or public.is_platform_super_admin()
  or (
    account_id is not null
    and public.owns_account(account_id)
  )
);
