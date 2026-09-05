create table if not exists public.platform_security_events (
  id uuid primary key default extensions.uuid_generate_v4(),
  event_type text not null,
  requester_profile_id uuid not null
    references public.profiles(id) on delete restrict,
  account_id uuid not null
    references public.accounts(id) on delete restrict,
  target_profile_id uuid not null
    references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint platform_security_events_event_type_check
    check (event_type in ('CLIENT_ADMIN_PASSWORD_CHANGED'))
);

create index if not exists platform_security_events_account_id_idx
  on public.platform_security_events(account_id);

create index if not exists platform_security_events_created_at_idx
  on public.platform_security_events(created_at desc);

alter table public.platform_security_events enable row level security;

drop policy if exists platform_security_events_super_admin_select
  on public.platform_security_events;

create policy platform_security_events_super_admin_select
on public.platform_security_events
for select
to authenticated
using (public.is_platform_super_admin());

revoke all on table public.platform_security_events
  from public, anon, authenticated;

grant select on table public.platform_security_events to authenticated;
grant all on table public.platform_security_events to service_role;
