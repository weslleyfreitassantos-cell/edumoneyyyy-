do $$
begin
  create type public.platform_role as enum (
    'USER',
    'SUPER_ADMIN'
  );
exception
  when duplicate_object then
    null;
end;
$$;

alter table public.profiles
  add column if not exists platform_role public.platform_role
    not null
    default 'USER';

create table if not exists public.accounts (
  id uuid primary key
    default extensions.uuid_generate_v4(),

  name text not null,
  owner_profile_id uuid not null
    references public.profiles(id),

  institution_limit integer not null default 1,
  status text not null default 'ACTIVE',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint accounts_name_not_blank
    check (length(btrim(name)) > 0),

  constraint accounts_institution_limit_positive
    check (institution_limit > 0),

  constraint accounts_status_check
    check (status in ('ACTIVE', 'SUSPENDED', 'CANCELED'))
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accounts_owner_profile_id_key'
      and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts
      add constraint accounts_owner_profile_id_key
      unique (owner_profile_id);
  end if;
end;
$$;

create index if not exists accounts_owner_profile_id_idx
  on public.accounts(owner_profile_id);

create index if not exists accounts_status_idx
  on public.accounts(status);

alter table public.institutions
  add column if not exists account_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'institutions_account_id_fkey'
      and conrelid = 'public.institutions'::regclass
  ) then
    alter table public.institutions
      add constraint institutions_account_id_fkey
      foreign key (account_id)
      references public.accounts(id);
  end if;
end;
$$;

create index if not exists institutions_account_id_idx
  on public.institutions(account_id);

create or replace function public.touch_account_updated_at()
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

drop trigger if exists accounts_touch_updated_at
  on public.accounts;

create trigger accounts_touch_updated_at
before update on public.accounts
for each row
execute function public.touch_account_updated_at();

create or replace function public.enforce_account_institution_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_institution_count integer;
  allowed_institution_count integer;
begin
  if new.account_id is null or new.active is not true then
    return new;
  end if;

  select account.institution_limit
  into allowed_institution_count
  from public.accounts as account
  where account.id = new.account_id
    and account.status = 'ACTIVE'
  for update;

  if allowed_institution_count is null then
    raise exception 'Active account not found for institution creation.'
      using errcode = '23514';
  end if;

  select count(*)
  into active_institution_count
  from public.institutions as institution
  where institution.account_id = new.account_id
    and institution.active is true
    and institution.id is distinct from new.id;

  if active_institution_count + 1 > allowed_institution_count then
    raise exception 'Institution limit reached for account.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists institutions_enforce_account_limit
  on public.institutions;

create trigger institutions_enforce_account_limit
before insert or update of account_id, active on public.institutions
for each row
execute function public.enforce_account_institution_limit();

revoke all on function public.touch_account_updated_at()
  from public, anon, authenticated;

revoke all on function public.enforce_account_institution_limit()
  from public, anon, authenticated;

grant execute on function public.touch_account_updated_at()
  to service_role;

grant execute on function public.enforce_account_institution_limit()
  to service_role;
