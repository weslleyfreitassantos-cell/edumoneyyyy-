create table if not exists public.client_admin_invitations (
  id uuid primary key default extensions.uuid_generate_v4(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  status text not null default 'PENDING',
  attempt_count integer not null default 0,
  last_attempt_at timestamptz null,
  sent_at timestamptz null,
  accepted_at timestamptz null,
  last_error_code text null,
  last_error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint client_admin_invitations_account_id_key unique (account_id),
  constraint client_admin_invitations_profile_id_key unique (profile_id),
  constraint client_admin_invitations_status_check
    check (status in ('PENDING', 'SENT', 'ACCEPTED')),
  constraint client_admin_invitations_attempt_count_check
    check (attempt_count >= 0),
  constraint client_admin_invitations_email_not_blank
    check (length(btrim(email)) > 0)
);

create index if not exists client_admin_invitations_profile_id_idx
  on public.client_admin_invitations(profile_id);

create index if not exists client_admin_invitations_status_idx
  on public.client_admin_invitations(status);

create or replace function public.touch_client_admin_invitation_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists client_admin_invitations_touch_updated_at
  on public.client_admin_invitations;

create trigger client_admin_invitations_touch_updated_at
before update on public.client_admin_invitations
for each row
execute function public.touch_client_admin_invitation_updated_at();

alter table public.client_admin_invitations enable row level security;

revoke all on table public.client_admin_invitations from anon, authenticated;
grant all on table public.client_admin_invitations to service_role;
grant select on table public.client_admin_invitations to authenticated;

create policy client_admin_invitations_super_admin_select
  on public.client_admin_invitations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.platform_role = 'SUPER_ADMIN'::public.platform_role
        and profiles.active is true
    )
  );

create or replace function public.mark_client_admin_invitation_accepted()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.client_admin_invitations
  set
    status = 'ACCEPTED',
    accepted_at = coalesce(accepted_at, now()),
    updated_at = now()
  where profile_id = auth.uid()
    and status <> 'ACCEPTED';

  return found;
end;
$$;

revoke all on function public.mark_client_admin_invitation_accepted()
  from public, anon;
grant execute on function public.mark_client_admin_invitation_accepted()
  to authenticated;

revoke all on function public.touch_client_admin_invitation_updated_at()
  from public, anon, authenticated;
grant execute on function public.touch_client_admin_invitation_updated_at()
  to service_role;
