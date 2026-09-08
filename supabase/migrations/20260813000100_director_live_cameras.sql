do $$
begin
  create type public.camera_gateway_status as enum (
    'ONLINE',
    'OFFLINE',
    'UNKNOWN'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.camera_device_type as enum (
    'IP_CAMERA',
    'NVR'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.camera_protocol as enum (
    'ONVIF',
    'RTSP'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.camera_stream_profile as enum (
    'MAIN',
    'SUB'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.camera_access_event as enum (
    'VIEW_STARTED',
    'VIEW_ENDED',
    'CONNECTION_TEST'
  );
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.camera_gateways (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  status public.camera_gateway_status not null default 'UNKNOWN',
  last_seen_at timestamptz,
  pairing_code_hash text,
  pairing_expires_at timestamptz,
  gateway_token_hash text,
  paired_at timestamptz,
  created_by_profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint camera_gateways_name_not_blank check (length(btrim(name)) > 0)
);

create table if not exists public.institution_cameras (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  gateway_id uuid references public.camera_gateways(id) on delete set null,
  name text not null,
  location text,
  manufacturer text,
  model text,
  device_type public.camera_device_type not null default 'IP_CAMERA',
  protocol public.camera_protocol not null default 'ONVIF',
  host text not null,
  port integer not null default 554,
  channel integer,
  stream_profile public.camera_stream_profile not null default 'SUB',
  credential_secret_ref text,
  active boolean not null default true,
  director_access boolean not null default true,
  guardian_access boolean not null default false,
  created_by_profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institution_cameras_name_not_blank check (length(btrim(name)) > 0),
  constraint institution_cameras_port_check check (port between 1 and 65535),
  constraint institution_cameras_channel_check check (channel is null or channel between 1 and 9999),
  constraint institution_cameras_guardian_access_check check (guardian_access is false)
);

create table if not exists public.camera_access_logs (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  camera_id uuid references public.institution_cameras(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  event public.camera_access_event not null,
  created_at timestamptz not null default now()
);

create index if not exists camera_gateways_institution_idx
  on public.camera_gateways(institution_id, status, last_seen_at);
create index if not exists institution_cameras_institution_idx
  on public.institution_cameras(institution_id, active, gateway_id);
create index if not exists camera_access_logs_camera_idx
  on public.camera_access_logs(institution_id, camera_id, created_at desc);

alter table public.camera_gateways enable row level security;
alter table public.camera_gateways force row level security;
alter table public.institution_cameras enable row level security;
alter table public.institution_cameras force row level security;
alter table public.camera_access_logs enable row level security;
alter table public.camera_access_logs force row level security;

create or replace function private.is_active_camera_director(target_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    join public.memberships as membership
      on membership.profile_id = profile.id
    join public.institutions as institution
      on institution.id = membership.institution_id
    where profile.id = (select auth.uid())
      and profile.active is true
      and membership.institution_id = target_institution_id
      and membership.role = 'DIRECTOR'
      and membership.active is true
      and institution.active is true
  );
$$;

create or replace function private.valid_camera_host(target_host text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select target_host is not null
    and length(btrim(target_host)) between 1 and 253
    and target_host !~ '[[:space:]/?#@]'
    and lower(target_host) not in ('localhost', '::1', '::', '0.0.0.0')
    and target_host !~* '(^|\.)127\.'
    and target_host !~* '(^|\.)169\.254\.';
$$;

create or replace function public.list_director_cameras(target_institution_id uuid)
returns table (
  id uuid,
  institution_id uuid,
  gateway_id uuid,
  gateway_name text,
  gateway_status public.camera_gateway_status,
  gateway_last_seen_at timestamptz,
  name text,
  location text,
  manufacturer text,
  model text,
  device_type public.camera_device_type,
  protocol public.camera_protocol,
  host text,
  port integer,
  channel integer,
  stream_profile public.camera_stream_profile,
  active boolean,
  director_access boolean,
  guardian_access boolean,
  created_at timestamptz,
  updated_at timestamptz
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
    camera.id,
    camera.institution_id,
    camera.gateway_id,
    gateway.name,
    case
      when gateway.status = 'ONLINE'
        and (gateway.last_seen_at is null or gateway.last_seen_at < now() - interval '2 minutes')
        then 'OFFLINE'::public.camera_gateway_status
      else gateway.status
    end,
    gateway.last_seen_at,
    camera.name,
    camera.location,
    camera.manufacturer,
    camera.model,
    camera.device_type,
    camera.protocol,
    camera.host,
    camera.port,
    camera.channel,
    camera.stream_profile,
    camera.active,
    camera.director_access,
    camera.guardian_access,
    camera.created_at,
    camera.updated_at
  from public.institution_cameras as camera
  left join public.camera_gateways as gateway
    on gateway.id = camera.gateway_id
  where camera.institution_id = target_institution_id
    and camera.director_access is true
  order by camera.name;
end;
$$;

create or replace function public.create_director_camera(
  target_institution_id uuid,
  camera_name text,
  camera_location text,
  camera_manufacturer text,
  camera_model text,
  camera_device_type public.camera_device_type,
  camera_protocol public.camera_protocol,
  camera_host text,
  camera_port integer,
  camera_channel integer,
  camera_stream_profile public.camera_stream_profile,
  camera_gateway_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_camera_id uuid;
begin
  if not private.is_active_camera_director(target_institution_id) then
    raise exception 'Camera access denied.' using errcode = '42501';
  end if;
  if not private.valid_camera_host(camera_host) then
    raise exception 'Camera host is invalid.' using errcode = '22023';
  end if;
  if camera_name is null or length(btrim(camera_name)) = 0 then
    raise exception 'Camera name is required.' using errcode = '22023';
  end if;
  if camera_port is null or camera_port not between 1 and 65535 then
    raise exception 'Camera port is invalid.' using errcode = '22023';
  end if;
  if camera_device_type = 'NVR' and camera_channel is null then
    raise exception 'NVR channel is required.' using errcode = '22023';
  end if;
  if camera_gateway_id is not null and not exists (
    select 1 from public.camera_gateways as gateway
    where gateway.id = camera_gateway_id
      and gateway.institution_id = target_institution_id
  ) then
    raise exception 'Gateway does not belong to institution.' using errcode = '23503';
  end if;

  insert into public.institution_cameras (
    institution_id, gateway_id, name, location, manufacturer, model,
    device_type, protocol, host, port, channel, stream_profile,
    created_by_profile_id
  ) values (
    target_institution_id, camera_gateway_id, btrim(camera_name),
    nullif(btrim(camera_location), ''), nullif(btrim(camera_manufacturer), ''),
    nullif(btrim(camera_model), ''), camera_device_type, camera_protocol,
    btrim(camera_host), camera_port, camera_channel, camera_stream_profile,
    (select auth.uid())
  ) returning id into new_camera_id;

  return new_camera_id;
end;
$$;

create or replace function public.update_director_camera(
  target_camera_id uuid,
  camera_name text,
  camera_location text,
  camera_manufacturer text,
  camera_model text,
  camera_device_type public.camera_device_type,
  camera_protocol public.camera_protocol,
  camera_host text,
  camera_port integer,
  camera_channel integer,
  camera_stream_profile public.camera_stream_profile,
  camera_gateway_id uuid,
  camera_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_institution_id uuid;
begin
  select camera.institution_id into target_institution_id
  from public.institution_cameras as camera
  where camera.id = target_camera_id;

  if target_institution_id is null
    or not private.is_active_camera_director(target_institution_id) then
    raise exception 'Camera access denied.' using errcode = '42501';
  end if;
  if not private.valid_camera_host(camera_host) then
    raise exception 'Camera host is invalid.' using errcode = '22023';
  end if;
  if camera_name is null or length(btrim(camera_name)) = 0 then
    raise exception 'Camera name is required.' using errcode = '22023';
  end if;
  if camera_port is null or camera_port not between 1 and 65535 then
    raise exception 'Camera port is invalid.' using errcode = '22023';
  end if;
  if camera_device_type = 'NVR' and camera_channel is null then
    raise exception 'NVR channel is required.' using errcode = '22023';
  end if;
  if camera_gateway_id is not null and not exists (
    select 1 from public.camera_gateways as gateway
    where gateway.id = camera_gateway_id
      and gateway.institution_id = target_institution_id
  ) then
    raise exception 'Gateway does not belong to institution.' using errcode = '23503';
  end if;

  update public.institution_cameras as camera
  set name = btrim(camera_name),
      location = nullif(btrim(camera_location), ''),
      manufacturer = nullif(btrim(camera_manufacturer), ''),
      model = nullif(btrim(camera_model), ''),
      device_type = camera_device_type,
      protocol = camera_protocol,
      host = btrim(camera_host),
      port = camera_port,
      channel = camera_channel,
      stream_profile = camera_stream_profile,
      gateway_id = camera_gateway_id,
      active = coalesce(camera_active, true),
      updated_at = now()
  where camera.id = target_camera_id;

  return true;
end;
$$;

create or replace function public.set_director_camera_active(
  target_camera_id uuid,
  camera_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_institution_id uuid;
begin
  select camera.institution_id into target_institution_id
  from public.institution_cameras as camera
  where camera.id = target_camera_id;

  if target_institution_id is null
    or not private.is_active_camera_director(target_institution_id) then
    raise exception 'Camera access denied.' using errcode = '42501';
  end if;

  update public.institution_cameras
  set active = camera_active,
      updated_at = now()
  where id = target_camera_id;

  return true;
end;
$$;

create or replace function public.delete_director_camera(target_camera_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_institution_id uuid;
begin
  select camera.institution_id into target_institution_id
  from public.institution_cameras as camera
  where camera.id = target_camera_id;

  if target_institution_id is null
    or not private.is_active_camera_director(target_institution_id) then
    raise exception 'Camera access denied.' using errcode = '42501';
  end if;

  delete from public.institution_cameras
  where id = target_camera_id;
  return true;
end;
$$;

create or replace function public.create_director_camera_gateway(
  target_institution_id uuid,
  gateway_name text
)
returns table (
  gateway_id uuid,
  pairing_code text,
  pairing_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_code text;
  generated_id uuid;
  generated_expiry timestamptz;
begin
  if not private.is_active_camera_director(target_institution_id) then
    raise exception 'Camera access denied.' using errcode = '42501';
  end if;
  if gateway_name is null or length(btrim(gateway_name)) = 0 then
    raise exception 'Gateway name is required.' using errcode = '22023';
  end if;

  generated_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  generated_expiry := now() + interval '15 minutes';

  insert into public.camera_gateways (
    institution_id, name, pairing_code_hash, pairing_expires_at,
    created_by_profile_id
  ) values (
    target_institution_id, btrim(gateway_name), md5(generated_code),
    generated_expiry, (select auth.uid())
  ) returning id into generated_id;

  return query select generated_id, generated_code, generated_expiry;
end;
$$;

create or replace function public.pair_camera_gateway(
  target_gateway_id uuid,
  gateway_pairing_code text
)
returns table (
  gateway_token text,
  institution_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_token text;
  paired_institution_id uuid;
begin
  generated_token := md5(random()::text || clock_timestamp()::text || target_gateway_id::text)
    || md5(random()::text || clock_timestamp()::text);

  update public.camera_gateways as gateway
  set gateway_token_hash = md5(generated_token),
      pairing_code_hash = null,
      pairing_expires_at = null,
      paired_at = now(),
      status = 'OFFLINE',
      updated_at = now()
  where gateway.id = target_gateway_id
    and gateway.pairing_code_hash = md5(gateway_pairing_code)
    and gateway.pairing_expires_at > now()
  returning gateway.institution_id into paired_institution_id;

  if paired_institution_id is null then
    raise exception 'Gateway pairing is invalid or expired.' using errcode = '42501';
  end if;

  return query select generated_token, paired_institution_id;
end;
$$;

create or replace function public.heartbeat_camera_gateway(
  target_gateway_id uuid,
  gateway_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.camera_gateways
  set status = 'ONLINE',
      last_seen_at = now(),
      updated_at = now()
  where id = target_gateway_id
    and gateway_token_hash = md5(gateway_token);

  if not found then
    raise exception 'Gateway pairing is invalid or expired.' using errcode = '42501';
  end if;
  return true;
end;
$$;

create or replace function public.log_director_camera_access(
  target_camera_id uuid,
  access_event public.camera_access_event
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_institution_id uuid;
begin
  select camera.institution_id into target_institution_id
  from public.institution_cameras as camera
  where camera.id = target_camera_id;

  if target_institution_id is null
    or not private.is_active_camera_director(target_institution_id) then
    raise exception 'Camera access denied.' using errcode = '42501';
  end if;

  insert into public.camera_access_logs (
    institution_id, camera_id, profile_id, event
  ) values (
    target_institution_id, target_camera_id, (select auth.uid()), access_event
  );
  return true;
end;
$$;

create or replace function public.test_director_camera(target_camera_id uuid)
returns table (
  gateway_status public.camera_gateway_status,
  message text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_institution_id uuid;
  current_status public.camera_gateway_status;
begin
  select camera.institution_id, gateway.status
  into target_institution_id, current_status
  from public.institution_cameras as camera
  left join public.camera_gateways as gateway
    on gateway.id = camera.gateway_id
  where camera.id = target_camera_id;

  if target_institution_id is null
    or not private.is_active_camera_director(target_institution_id) then
    raise exception 'Camera access denied.' using errcode = '42501';
  end if;

  insert into public.camera_access_logs (
    institution_id, camera_id, profile_id, event
  ) values (
    target_institution_id, target_camera_id, (select auth.uid()), 'CONNECTION_TEST'
  );

  return query select
    coalesce(current_status, 'UNKNOWN'::public.camera_gateway_status),
    case coalesce(current_status, 'UNKNOWN'::public.camera_gateway_status)
      when 'ONLINE' then 'Gateway conectado; o teste de stream depende do adaptador local.'
      when 'OFFLINE' then 'Gateway offline.'
      else 'Gateway não conectado.'
    end;
end;
$$;

drop policy if exists camera_gateways_director_select on public.camera_gateways;
create policy camera_gateways_director_select
  on public.camera_gateways
  for select
  to authenticated
  using (private.is_active_camera_director(institution_id));

drop policy if exists institution_cameras_director_select on public.institution_cameras;
create policy institution_cameras_director_select
  on public.institution_cameras
  for select
  to authenticated
  using (private.is_active_camera_director(institution_id));

drop policy if exists camera_access_logs_director_select on public.camera_access_logs;
create policy camera_access_logs_director_select
  on public.camera_access_logs
  for select
  to authenticated
  using (private.is_active_camera_director(institution_id));

revoke all on table public.camera_gateways from anon, authenticated;
revoke all on table public.institution_cameras from anon, authenticated;
revoke all on table public.camera_access_logs from anon, authenticated;

revoke all on function private.is_active_camera_director(uuid) from public, anon, authenticated;
revoke all on function private.valid_camera_host(text) from public, anon, authenticated;
revoke all on function public.list_director_cameras(uuid) from public, anon;
revoke all on function public.create_director_camera(uuid, text, text, text, text, public.camera_device_type, public.camera_protocol, text, integer, integer, public.camera_stream_profile, uuid) from public, anon;
revoke all on function public.update_director_camera(uuid, text, text, text, text, public.camera_device_type, public.camera_protocol, text, integer, integer, public.camera_stream_profile, uuid, boolean) from public, anon;
revoke all on function public.set_director_camera_active(uuid, boolean) from public, anon;
revoke all on function public.delete_director_camera(uuid) from public, anon;
revoke all on function public.create_director_camera_gateway(uuid, text) from public, anon;
revoke all on function public.pair_camera_gateway(uuid, text) from public, anon;
revoke all on function public.heartbeat_camera_gateway(uuid, text) from public, anon;
revoke all on function public.log_director_camera_access(uuid, public.camera_access_event) from public, anon;
revoke all on function public.test_director_camera(uuid) from public, anon;

grant execute on function public.list_director_cameras(uuid) to authenticated;
grant execute on function public.create_director_camera(uuid, text, text, text, text, public.camera_device_type, public.camera_protocol, text, integer, integer, public.camera_stream_profile, uuid) to authenticated;
grant execute on function public.update_director_camera(uuid, text, text, text, text, public.camera_device_type, public.camera_protocol, text, integer, integer, public.camera_stream_profile, uuid, boolean) to authenticated;
grant execute on function public.set_director_camera_active(uuid, boolean) to authenticated;
grant execute on function public.delete_director_camera(uuid) to authenticated;
grant execute on function public.create_director_camera_gateway(uuid, text) to authenticated;
grant execute on function public.pair_camera_gateway(uuid, text) to authenticated;
grant execute on function public.heartbeat_camera_gateway(uuid, text) to authenticated;
grant execute on function public.log_director_camera_access(uuid, public.camera_access_event) to authenticated;
grant execute on function public.test_director_camera(uuid) to authenticated;

notify pgrst, 'reload schema';
