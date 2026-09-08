-- Migration: Harden director institution branding writes after frontend rollout.
-- Removes generic table UPDATE access for DIRECTOR; branding writes must use
-- public.update_institution_login_branding(...) after the new frontend is live.

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
