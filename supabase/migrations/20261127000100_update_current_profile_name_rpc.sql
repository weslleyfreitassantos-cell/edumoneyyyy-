begin;

create or replace function public.update_current_profile_name(
  p_full_name text
)
returns table (
  id uuid,
  full_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_name text := btrim(p_full_name);
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  if char_length(normalized_name) not between 2 and 120 then
    raise exception 'invalid profile name';
  end if;

  return query
  update public.profiles
     set full_name = normalized_name
   where public.profiles.id = current_user_id
  returning public.profiles.id, public.profiles.full_name;

  if not found then
    raise exception 'profile not found';
  end if;
end;
$$;

alter function public.update_current_profile_name(text) owner to postgres;

revoke all on function public.update_current_profile_name(text)
  from public, anon, authenticated;

grant execute on function public.update_current_profile_name(text)
  to authenticated;

commit;
