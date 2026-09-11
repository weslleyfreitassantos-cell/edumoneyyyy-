-- Restore the minimum table privileges required by the operational runtime.
-- RLS remains the tenant and role boundary for every grant below.

begin;

revoke all on table public.access_devices,
  public.access_events,
  public.financial_contracts,
  public.invoices,
  public.payments
from anon;

grant select, insert, update on table public.access_devices
  to authenticated;

-- Access events are read by operational staff and written by the system
-- ingestion path, not by arbitrary authenticated clients.
grant select on table public.access_events
  to authenticated;
grant insert on table public.access_events
  to service_role;

grant select, insert on table public.financial_contracts,
  public.invoices,
  public.payments
to authenticated;

drop policy if exists access_devices_staff
  on public.access_devices;

create policy access_devices_staff
on public.access_devices
for all
using (
  public.is_platform_super_admin()
  or private.has_exact_institution_role(
    institution_id,
    array['DIRECTOR', 'SECRETARY']::public.user_role[]
  )
)
with check (
  public.is_platform_super_admin()
  or private.has_exact_institution_role(
    institution_id,
    array['DIRECTOR', 'SECRETARY']::public.user_role[]
  )
);

drop policy if exists access_events_staff
  on public.access_events;

create policy access_events_staff
on public.access_events
for select
using (
  public.is_platform_super_admin()
  or private.has_exact_institution_role(
    institution_id,
    array['DIRECTOR', 'SECRETARY']::public.user_role[]
  )
);

drop policy if exists finance_contract_staff
  on public.financial_contracts;

create policy finance_contract_staff
on public.financial_contracts
for all
using (
  public.is_platform_super_admin()
  or private.has_exact_institution_role(
    institution_id,
    array['DIRECTOR', 'SECRETARY']::public.user_role[]
  )
)
with check (
  public.is_platform_super_admin()
  or private.has_exact_institution_role(
    institution_id,
    array['DIRECTOR', 'SECRETARY']::public.user_role[]
  )
);

drop policy if exists finance_invoice_staff
  on public.invoices;

create policy finance_invoice_staff
on public.invoices
for all
using (
  public.is_platform_super_admin()
  or private.has_exact_institution_role(
    institution_id,
    array['DIRECTOR', 'SECRETARY']::public.user_role[]
  )
)
with check (
  public.is_platform_super_admin()
  or private.has_exact_institution_role(
    institution_id,
    array['DIRECTOR', 'SECRETARY']::public.user_role[]
  )
);

drop policy if exists finance_payment_staff
  on public.payments;

create policy finance_payment_staff
on public.payments
for all
using (
  public.is_platform_super_admin()
  or private.has_exact_institution_role(
    institution_id,
    array['DIRECTOR', 'SECRETARY']::public.user_role[]
  )
)
with check (
  public.is_platform_super_admin()
  or private.has_exact_institution_role(
    institution_id,
    array['DIRECTOR', 'SECRETARY']::public.user_role[]
  )
);

notify pgrst, 'reload schema';
commit;
