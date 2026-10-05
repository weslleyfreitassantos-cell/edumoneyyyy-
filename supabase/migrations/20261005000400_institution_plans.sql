do $$
begin
  create type public.institution_plan as enum (
    'BASIC',
    'PROFESSIONAL'
  );
exception
  when duplicate_object then
    null;
end;
$$;

alter table public.institutions
  add column if not exists plan public.institution_plan
    not null
    default 'BASIC'::public.institution_plan;

-- Existing schools already use the complete module set. New schools start on Basic.
update public.institutions
set plan = 'PROFESSIONAL'::public.institution_plan
where plan = 'BASIC'::public.institution_plan;

create or replace function public.update_platform_institution_plan(
  target_institution_id uuid,
  new_plan text
)
returns table (
  id uuid,
  plan public.institution_plan
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_super_admin() then
    raise exception 'Only platform super administrators can change institution plans.'
      using errcode = '42501';
  end if;

  if new_plan not in ('BASIC', 'PROFESSIONAL') then
    raise exception 'Institution plan is invalid.'
      using errcode = '22023';
  end if;

  return query
  update public.institutions as institution
  set plan = new_plan::public.institution_plan,
      updated_at = now()
  where institution.id = target_institution_id
  returning institution.id, institution.plan;

  if not found then
    raise exception 'Institution not found.'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.update_platform_institution_plan(uuid, text)
  from public, anon;
grant execute on function public.update_platform_institution_plan(uuid, text)
  to authenticated;
