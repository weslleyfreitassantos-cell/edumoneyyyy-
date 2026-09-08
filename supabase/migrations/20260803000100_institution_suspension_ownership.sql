alter table public.institutions
  add column if not exists suspended_by_profile_id uuid
    references public.profiles(id)
    on delete set null,
  add column if not exists suspended_by_scope text,
  add column if not exists suspended_at timestamptz;

alter table public.institutions
  drop constraint if exists institutions_suspended_by_scope_check;

alter table public.institutions
  add constraint institutions_suspended_by_scope_check
    check (
      suspended_by_scope is null
      or suspended_by_scope in ('PLATFORM', 'ACCOUNT')
    );

create index if not exists institutions_suspension_metadata_idx
  on public.institutions(
    account_id,
    active,
    suspended_by_scope,
    suspended_by_profile_id
  );

create or replace function public.enforce_account_institution_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  used_institution_count integer;
  allowed_institution_count integer;
begin
  if new.account_id is null then
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
  into used_institution_count
  from public.institutions as institution
  where institution.account_id = new.account_id
    and institution.id is distinct from new.id;

  if used_institution_count + 1 > allowed_institution_count then
    raise exception 'Institution limit reached for account.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists institutions_enforce_account_limit
  on public.institutions;

create trigger institutions_enforce_account_limit
before insert or update of account_id on public.institutions
for each row
execute function public.enforce_account_institution_limit();

create or replace function public.enforce_account_limit_not_below_active_institutions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  used_institution_count integer;
begin
  if new.institution_limit = old.institution_limit then
    return new;
  end if;

  select count(*)
  into used_institution_count
  from public.institutions as institution
  where institution.account_id = new.id;

  if new.institution_limit < used_institution_count then
    raise exception 'Account institution limit cannot be below used institutions.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_account_institution_limit()
  from public, anon, authenticated;

grant execute on function public.enforce_account_institution_limit()
  to service_role;

revoke all on function public.enforce_account_limit_not_below_active_institutions()
  from public, anon, authenticated;

grant execute on function public.enforce_account_limit_not_below_active_institutions()
  to service_role;
