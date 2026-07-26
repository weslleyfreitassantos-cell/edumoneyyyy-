create or replace function public.enforce_account_limit_not_below_active_institutions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_institution_count integer;
begin
  if new.institution_limit = old.institution_limit then
    return new;
  end if;

  select count(*)
  into active_institution_count
  from public.institutions as institution
  where institution.account_id = new.id
    and institution.active is true;

  if new.institution_limit < active_institution_count then
    raise exception 'Account institution limit cannot be below active institutions.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists accounts_enforce_limit_not_below_active_institutions
  on public.accounts;

create trigger accounts_enforce_limit_not_below_active_institutions
before update of institution_limit on public.accounts
for each row
execute function public.enforce_account_limit_not_below_active_institutions();

revoke all on function public.enforce_account_limit_not_below_active_institutions()
  from public, anon, authenticated;

grant execute on function public.enforce_account_limit_not_below_active_institutions()
  to service_role;
