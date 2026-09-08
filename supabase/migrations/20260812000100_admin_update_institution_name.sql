begin;

create or replace function public.update_admin_institution_name(
  target_institution_id uuid,
  new_name text
)
returns table (
  id uuid,
  name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid := auth.uid();
  normalized_name text;
  target_account_id uuid;
begin
  if actor_profile_id is null then
    raise exception 'Usuario nao autenticado.'
      using errcode = '42501';
  end if;

  if target_institution_id is null then
    raise exception 'Instituicao nao encontrada.'
      using errcode = '22023';
  end if;

  normalized_name := btrim(coalesce(new_name, ''));

  if normalized_name = '' then
    raise exception 'Informe o nome da instituicao.'
      using errcode = '23514';
  end if;

  select institution.account_id
    into target_account_id
  from public.institutions as institution
  where institution.id = target_institution_id;

  if not found then
    raise exception 'Instituicao nao encontrada.'
      using errcode = 'P0002';
  end if;

  if not (
    public.is_platform_super_admin()
    or (
      target_account_id is not null
      and public.owns_account(target_account_id)
    )
  ) then
    raise exception 'Voce nao tem permissao para alterar esta instituicao.'
      using errcode = '42501';
  end if;

  return query
  update public.institutions as institution
  set name = normalized_name
  where institution.id = target_institution_id
  returning institution.id, institution.name;
end;
$$;

revoke all on function public.update_admin_institution_name(uuid, text)
  from public, anon, authenticated;

grant execute on function public.update_admin_institution_name(uuid, text)
  to authenticated;

notify pgrst, 'reload schema';

commit;
