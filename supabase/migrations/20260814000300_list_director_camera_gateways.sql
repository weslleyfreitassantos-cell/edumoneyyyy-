create or replace function public.list_director_camera_gateways(target_institution_id uuid)
returns table (
  gateway_id uuid,
  gateway_name text,
  gateway_status public.camera_gateway_status,
  gateway_last_seen_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_active_camera_director(target_institution_id) then
    raise exception 'Camera access denied.' using errcode = '42501';
  end if;

  return query
  select
    gateway.id,
    gateway.name,
    case
      when gateway.status = 'ONLINE'
        and (gateway.last_seen_at is null
          or gateway.last_seen_at < now() - interval '2 minutes')
        then 'OFFLINE'::public.camera_gateway_status
      else gateway.status
    end,
    gateway.last_seen_at
  from public.camera_gateways as gateway
  where gateway.institution_id = target_institution_id
  order by gateway.name;
end;
$$;

revoke all on function public.list_director_camera_gateways(uuid) from public, anon;
grant execute on function public.list_director_camera_gateways(uuid) to authenticated;

notify pgrst, 'reload schema';
