create or replace function private.camera_relay_hostname(target_public_id text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when target_public_id ~* '^gw-[0-9a-f]{16}$'
      then 'camera-gw-' || substr(lower(target_public_id), 4) || '.grupotec.dev.br'
    else null
  end;
$$;

update public.camera_gateways as gateway
set relay_base_url = 'https://' || private.camera_relay_hostname(gateway.public_id),
    updated_at = now()
where gateway.public_id ~* '^gw-[0-9a-f]{16}$'
  and lower(gateway.relay_base_url) = 'https://' || lower(gateway.public_id) || '.cameras.grupotec.dev.br';

create or replace function public.register_camera_gateway_relay(
  target_gateway_id uuid,
  target_gateway_token text,
  target_relay_base_url text,
  target_request_id uuid,
  target_request_expires_at timestamptz
)
returns table (
  relay_base_url text,
  relay_status public.camera_gateway_status,
  relay_last_seen_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_public_id text;
begin
  perform public.accept_camera_gateway_request(
    target_gateway_id, target_gateway_token,
    target_request_id, target_request_expires_at
  );

  select gateway.public_id
    into target_public_id
  from public.camera_gateways as gateway
  where gateway.id = target_gateway_id
    and gateway.gateway_token_hash = md5(target_gateway_token);

  if target_public_id is null then
    raise exception 'Gateway token is invalid.' using errcode = '42501';
  end if;

  if not private.valid_camera_relay_url(
    target_relay_base_url,
    private.camera_relay_hostname(target_public_id)
  ) then
    raise exception 'Gateway relay URL is invalid.' using errcode = '22023';
  end if;

  return query
  update public.camera_gateways as gateway
  set relay_base_url = target_relay_base_url,
      relay_status = 'ONLINE',
      relay_last_seen_at = now(),
      updated_at = now()
  where gateway.id = target_gateway_id
    and gateway.gateway_token_hash = md5(target_gateway_token)
  returning gateway.relay_base_url, gateway.relay_status, gateway.relay_last_seen_at;

  if not found then
    raise exception 'Gateway token is invalid.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.get_camera_gateway_relay_identity(
  target_gateway_id uuid,
  target_gateway_token text,
  target_request_id uuid,
  target_request_expires_at timestamptz
)
returns table (
  public_id text,
  relay_hostname text,
  tunnel_id text,
  relay_base_url text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.accept_camera_gateway_request(
    target_gateway_id, target_gateway_token,
    target_request_id, target_request_expires_at
  );

  return query
  select gateway.public_id,
    private.camera_relay_hostname(gateway.public_id),
    gateway.tunnel_id,
    gateway.relay_base_url
  from public.camera_gateways as gateway
  where gateway.id = target_gateway_id
    and gateway.gateway_token_hash = md5(target_gateway_token);

  if not found then
    raise exception 'Gateway token is invalid.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.save_camera_gateway_relay(
  target_gateway_id uuid,
  target_gateway_token text,
  target_tunnel_id text,
  target_relay_base_url text,
  target_request_id uuid,
  target_request_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_public_id text;
begin
  perform public.accept_camera_gateway_request(
    target_gateway_id, target_gateway_token,
    target_request_id, target_request_expires_at
  );

  select gateway.public_id
    into target_public_id
  from public.camera_gateways as gateway
  where gateway.id = target_gateway_id
    and gateway.gateway_token_hash = md5(target_gateway_token);

  if target_public_id is null
    or target_tunnel_id is null
    or target_tunnel_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or not private.valid_camera_relay_url(target_relay_base_url, private.camera_relay_hostname(target_public_id)) then
    raise exception 'Gateway relay configuration is invalid.' using errcode = '22023';
  end if;

  update public.camera_gateways
  set tunnel_id = target_tunnel_id,
      relay_base_url = target_relay_base_url,
      relay_status = 'UNKNOWN',
      relay_last_seen_at = null,
      updated_at = now()
  where id = target_gateway_id
    and gateway_token_hash = md5(target_gateway_token);

  if not found then
    raise exception 'Gateway token is invalid.' using errcode = '42501';
  end if;
  return true;
end;
$$;

notify pgrst, 'reload schema';
