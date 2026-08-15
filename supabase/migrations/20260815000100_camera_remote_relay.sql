alter table public.camera_gateways
  add column if not exists public_id text,
  add column if not exists relay_base_url text,
  add column if not exists relay_status public.camera_gateway_status not null default 'UNKNOWN',
  add column if not exists relay_last_seen_at timestamptz,
  add column if not exists tunnel_id text;

update public.camera_gateways
set public_id = 'gw-' || substr(replace(id::text, '-', ''), 1, 16)
where public_id is null;

alter table public.camera_gateways
  alter column public_id set default ('gw-' || substr(replace(extensions.uuid_generate_v4()::text, '-', ''), 1, 16)),
  alter column public_id set not null;

create unique index if not exists camera_gateways_public_id_idx
  on public.camera_gateways(public_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'camera_gateways_public_id_format_check'
      and conrelid = 'public.camera_gateways'::regclass
  ) then
    alter table public.camera_gateways
      add constraint camera_gateways_public_id_format_check
      check (public_id ~ '^gw-[0-9a-f]{16}$');
  end if;
end;
$$;

create or replace function private.valid_camera_relay_url(
  target_relay_url text,
  expected_hostname text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select target_relay_url is not null
    and expected_hostname is not null
    and lower(target_relay_url) = 'https://' || lower(expected_hostname);
$$;

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
    target_public_id || '.cameras.grupotec.dev.br'
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
    gateway.public_id || '.cameras.grupotec.dev.br',
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
    or not private.valid_camera_relay_url(target_relay_base_url, target_public_id || '.cameras.grupotec.dev.br') then
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

create or replace function public.create_camera_stream_session(
  target_camera_id uuid
)
returns table (
  session_id uuid,
  protocol text,
  playback_url text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_institution_id uuid;
  target_gateway_id uuid;
  target_local_base_url text;
  target_relay_base_url text;
  target_relay_status public.camera_gateway_status;
  target_relay_last_seen_at timestamptz;
  target_playback_base_url text;
  request_origin text;
  generated_token text;
  generated_session_id uuid;
  generated_expiry timestamptz;
begin
  select camera.institution_id,
    camera.gateway_id,
    gateway.local_base_url,
    gateway.relay_base_url,
    gateway.relay_status,
    gateway.relay_last_seen_at
    into target_institution_id,
      target_gateway_id,
      target_local_base_url,
      target_relay_base_url,
      target_relay_status,
      target_relay_last_seen_at
  from public.institution_cameras as camera
  left join public.camera_gateways as gateway on gateway.id = camera.gateway_id
  where camera.id = target_camera_id
    and camera.active is true
    and camera.director_access is true;

  if target_institution_id is null
    or not private.is_active_camera_director(target_institution_id) then
    raise exception 'Camera access denied.' using errcode = '42501';
  end if;
  if target_gateway_id is null then
    raise exception 'Camera gateway is not configured.' using errcode = '55000';
  end if;
  if not exists (
    select 1 from public.camera_gateways as gateway
    where gateway.id = target_gateway_id
      and gateway.status = 'ONLINE'
      and gateway.last_seen_at > now() - interval '2 minutes'
  ) then
    raise exception 'Camera gateway is offline.' using errcode = '55000';
  end if;

  begin
    request_origin := current_setting('request.headers', true)::jsonb ->> 'origin';
  exception when others then
    request_origin := null;
  end;

  if target_relay_base_url is not null then
    target_playback_base_url := case
      when target_relay_status = 'ONLINE'
        and target_relay_last_seen_at > now() - interval '2 minutes'
        then target_relay_base_url
      else null
    end;
  else
    target_playback_base_url := case
      when request_origin ~* '^http://(localhost|127[.]0[.]0[.]1|10[.][0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}|192[.]168[.][0-9]{1,3}[.][0-9]{1,3}|172[.](1[6-9]|2[0-9]|3[0-1])[.][0-9]{1,3}[.][0-9]{1,3})(:[0-9]+)?$'
        then target_local_base_url
      else null
    end;
  end if;

  generated_token := md5(random()::text || clock_timestamp()::text || target_camera_id::text);
  generated_session_id := extensions.uuid_generate_v4();
  generated_expiry := now() + interval '180 seconds';

  insert into public.camera_stream_sessions (
    id, institution_id, camera_id, gateway_id, profile_id,
    session_token_hash, expires_at
  ) values (
    generated_session_id, target_institution_id, target_camera_id,
    target_gateway_id, (select auth.uid()), md5(generated_token),
    generated_expiry
  );

  return query select
    generated_session_id,
    'HLS',
    case when target_playback_base_url is null then null
      else target_playback_base_url || '/stream/' || generated_session_id::text
        || '/index.m3u8?token=' || generated_token
    end,
    generated_expiry;
end;
$$;

create or replace function public.list_director_camera_gateways_v2(target_institution_id uuid)
returns table (
  gateway_id uuid,
  gateway_name text,
  gateway_status public.camera_gateway_status,
  gateway_last_seen_at timestamptz,
  relay_status public.camera_gateway_status,
  relay_last_seen_at timestamptz,
  relay_configured boolean
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
  select gateway.id,
    gateway.name,
    case
      when gateway.status = 'ONLINE'
        and (gateway.last_seen_at is null or gateway.last_seen_at < now() - interval '2 minutes')
        then 'OFFLINE'::public.camera_gateway_status
      else gateway.status
    end,
    gateway.last_seen_at,
    case
      when gateway.relay_status = 'ONLINE'
        and (gateway.relay_last_seen_at is null or gateway.relay_last_seen_at < now() - interval '2 minutes')
        then 'OFFLINE'::public.camera_gateway_status
      else gateway.relay_status
    end,
    gateway.relay_last_seen_at,
    gateway.relay_base_url is not null
  from public.camera_gateways as gateway
  where gateway.institution_id = target_institution_id
  order by gateway.name;
end;
$$;

revoke all on function public.register_camera_gateway_relay(uuid, text, text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.register_camera_gateway_relay(uuid, text, text, uuid, timestamptz) to service_role;
revoke all on function public.get_camera_gateway_relay_identity(uuid, text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.get_camera_gateway_relay_identity(uuid, text, uuid, timestamptz) to service_role;
revoke all on function public.save_camera_gateway_relay(uuid, text, text, text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.save_camera_gateway_relay(uuid, text, text, text, uuid, timestamptz) to service_role;
revoke all on function public.list_director_camera_gateways_v2(uuid) from public, anon;
grant execute on function public.list_director_camera_gateways_v2(uuid) to authenticated;
revoke all on function public.create_camera_stream_session(uuid) from public, anon;
grant execute on function public.create_camera_stream_session(uuid) to authenticated;

notify pgrst, 'reload schema';
