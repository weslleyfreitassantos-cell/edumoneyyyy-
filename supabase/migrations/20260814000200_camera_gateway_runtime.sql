alter table public.camera_gateways
  add column if not exists local_base_url text;

create table if not exists public.camera_stream_sessions (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  camera_id uuid not null references public.institution_cameras(id) on delete cascade,
  gateway_id uuid not null references public.camera_gateways(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  session_token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint camera_stream_sessions_expiry_check check (expires_at > created_at),
  constraint camera_stream_sessions_token_check check (length(session_token_hash) = 32)
);

create index if not exists camera_stream_sessions_lookup_idx
  on public.camera_stream_sessions(gateway_id, camera_id, expires_at);

create table if not exists public.camera_gateway_request_nonces (
  gateway_id uuid not null references public.camera_gateways(id) on delete cascade,
  request_id uuid not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (gateway_id, request_id)
);

create index if not exists camera_gateway_request_nonces_expiry_idx
  on public.camera_gateway_request_nonces(expires_at);

alter table public.camera_stream_sessions enable row level security;
alter table public.camera_stream_sessions force row level security;
alter table public.camera_gateway_request_nonces enable row level security;
alter table public.camera_gateway_request_nonces force row level security;

create or replace function public.accept_camera_gateway_request(
  target_gateway_id uuid,
  target_gateway_token text,
  target_request_id uuid,
  target_request_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_request_id is null
    or target_request_expires_at is null
    or target_request_expires_at <= now()
    or target_request_expires_at > now() + interval '2 minutes' then
    raise exception 'Gateway request expired.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.camera_gateways as gateway
    where gateway.id = target_gateway_id
      and gateway.gateway_token_hash = md5(target_gateway_token)
  ) then
    raise exception 'Gateway token is invalid.' using errcode = '42501';
  end if;

  insert into public.camera_gateway_request_nonces (gateway_id, request_id, expires_at)
  values (target_gateway_id, target_request_id, target_request_expires_at)
  on conflict (gateway_id, request_id) do nothing;

  if not found then
    raise exception 'Gateway request replayed.' using errcode = '42501';
  end if;

  delete from public.camera_gateway_request_nonces
  where expires_at < now() - interval '5 minutes';
  return true;
end;
$$;

create or replace function public.pair_camera_gateway_runtime(
  target_pairing_code text,
  gateway_local_url text
)
returns table (
  gateway_id uuid,
  institution_id uuid,
  gateway_token text,
  local_base_url text,
  paired_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_token text;
begin
  if target_pairing_code is null or length(btrim(target_pairing_code)) < 6 then
    raise exception 'Gateway pairing code is invalid.' using errcode = '22023';
  end if;
  if gateway_local_url is not null and (
    length(btrim(gateway_local_url)) > 253
    or btrim(gateway_local_url) !~* '^https?://[a-z0-9.-]+(:[0-9]{1,5})?$'
  ) then
    raise exception 'Gateway local URL is invalid.' using errcode = '22023';
  end if;

  generated_token := md5(random()::text || clock_timestamp()::text || target_pairing_code)
    || md5(random()::text || clock_timestamp()::text || target_pairing_code || 'rotation');

  return query
  update public.camera_gateways as gateway
  set gateway_token_hash = md5(generated_token),
      pairing_code_hash = null,
      pairing_expires_at = null,
      paired_at = now(),
      status = 'OFFLINE',
      local_base_url = nullif(btrim(gateway_local_url), ''),
      updated_at = now()
  where gateway.pairing_code_hash = md5(upper(btrim(target_pairing_code)))
    and gateway.pairing_expires_at > now()
    and gateway.gateway_token_hash is null
  returning gateway.id, gateway.institution_id, generated_token,
    gateway.local_base_url, gateway.paired_at;

  if not found then
    raise exception 'Gateway pairing is invalid or expired.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.heartbeat_camera_gateway_runtime(
  target_gateway_id uuid,
  target_gateway_token text,
  target_request_id uuid,
  target_request_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.accept_camera_gateway_request(
    target_gateway_id, target_gateway_token,
    target_request_id, target_request_expires_at
  );

  update public.camera_gateways
  set status = 'ONLINE',
      last_seen_at = now(),
      updated_at = now()
  where id = target_gateway_id
    and gateway_token_hash = md5(target_gateway_token);

  if not found then
    raise exception 'Gateway token is invalid.' using errcode = '42501';
  end if;
  return true;
end;
$$;

create or replace function public.sync_camera_gateway_runtime(
  target_gateway_id uuid,
  target_gateway_token text,
  target_request_id uuid,
  target_request_expires_at timestamptz
)
returns table (
  id uuid,
  institution_id uuid,
  name text,
  host text,
  port integer,
  protocol public.camera_protocol,
  channel integer,
  stream_profile public.camera_stream_profile,
  active boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_institution_id uuid;
begin
  perform public.accept_camera_gateway_request(
    target_gateway_id, target_gateway_token,
    target_request_id, target_request_expires_at
  );

  select gateway.institution_id
    into target_institution_id
  from public.camera_gateways as gateway
  where gateway.id = target_gateway_id
    and gateway.gateway_token_hash = md5(target_gateway_token);

  if target_institution_id is null then
    raise exception 'Gateway token is invalid.' using errcode = '42501';
  end if;

  return query
  select camera.id, camera.institution_id, camera.name, camera.host,
    camera.port, camera.protocol, camera.channel, camera.stream_profile,
    camera.active
  from public.institution_cameras as camera
  where camera.institution_id = target_institution_id
    and camera.gateway_id = target_gateway_id
    and camera.active is true
  order by camera.name;
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
  generated_token text;
  generated_session_id uuid;
  generated_expiry timestamptz;
begin
  select camera.institution_id, camera.gateway_id, gateway.local_base_url
    into target_institution_id, target_gateway_id, target_local_base_url
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
    case when target_local_base_url is null then null
      else target_local_base_url || '/stream/' || generated_session_id::text
        || '/index.m3u8?token=' || generated_token
    end,
    generated_expiry;
end;
$$;

create or replace function public.redeem_camera_stream_session(
  target_gateway_id uuid,
  target_gateway_token text,
  target_session_id uuid,
  target_session_token text,
  target_request_id uuid,
  target_request_expires_at timestamptz
)
returns table (
  camera_id uuid,
  institution_id uuid,
  stream_path text,
  expires_at timestamptz
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
  select session.camera_id, session.institution_id,
    'camera-' || session.camera_id::text,
    session.expires_at
  from public.camera_stream_sessions as session
  join public.institution_cameras as camera on camera.id = session.camera_id
  where session.id = target_session_id
    and session.gateway_id = target_gateway_id
    and session.session_token_hash = md5(target_session_token)
    and session.revoked_at is null
    and session.expires_at > now()
    and camera.active is true;

  if not found then
    raise exception 'Camera stream session is invalid or expired.' using errcode = '42501';
  end if;
end;
$$;

revoke all on table public.camera_stream_sessions from public, anon, authenticated;
revoke all on table public.camera_gateway_request_nonces from public, anon, authenticated;
revoke all on function public.accept_camera_gateway_request(uuid, text, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.pair_camera_gateway_runtime(text, text) from public, anon, authenticated;
revoke all on function public.heartbeat_camera_gateway_runtime(uuid, text, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.sync_camera_gateway_runtime(uuid, text, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.redeem_camera_stream_session(uuid, text, uuid, text, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.create_camera_stream_session(uuid) from public, anon;

grant execute on function public.accept_camera_gateway_request(uuid, text, uuid, timestamptz) to service_role;
grant execute on function public.pair_camera_gateway_runtime(text, text) to service_role;
grant execute on function public.heartbeat_camera_gateway_runtime(uuid, text, uuid, timestamptz) to service_role;
grant execute on function public.sync_camera_gateway_runtime(uuid, text, uuid, timestamptz) to service_role;
grant execute on function public.redeem_camera_stream_session(uuid, text, uuid, text, uuid, timestamptz) to service_role;
grant execute on function public.create_camera_stream_session(uuid) to authenticated;

notify pgrst, 'reload schema';
