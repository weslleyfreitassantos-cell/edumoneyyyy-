-- Migration: Institution Login Branding Fields
-- Adds login_display_name and favicon_url columns to public.institutions.
-- Updates resolve_public_institution_by_subdomain RPC to expose the new public fields.
-- The institution.id remains the single source of truth for branding persistence.

alter table public.institutions
  add column if not exists login_display_name text,
  add column if not exists favicon_url text;

-- Grant column update privileges for the new branding columns to authenticated role
grant update (login_display_name, favicon_url, updated_at)
  on table public.institutions
  to authenticated;

create or replace function public.update_institution_login_branding(
  target_institution_id uuid,
  new_login_display_name text default null,
  set_login_display_name boolean default false,
  new_logo_url text default null,
  set_logo_url boolean default false,
  new_favicon_url text default null,
  set_favicon_url boolean default false,
  new_primary_color text default null,
  set_primary_color boolean default false,
  new_secondary_color text default null,
  set_secondary_color boolean default false
)
returns table (
  id uuid,
  name text,
  subdomain text,
  login_display_name text,
  logo_url text,
  favicon_url text,
  primary_color text,
  secondary_color text,
  active boolean,
  account_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_institution_id is null then
    raise exception 'Instituicao nao encontrada.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.memberships as membership
    where membership.profile_id = auth.uid()
      and membership.institution_id = target_institution_id
      and membership.role = 'DIRECTOR'
      and membership.active is true
  ) then
    raise exception 'Apenas um Diretor com membership ativa pode alterar a identidade visual da instituicao.'
      using errcode = '42501';
  end if;

  if set_primary_color
      and new_primary_color is not null
      and new_primary_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Cor principal invalida.'
      using errcode = '22023';
  end if;

  if set_secondary_color
      and new_secondary_color is not null
      and new_secondary_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Cor secundaria invalida.'
      using errcode = '22023';
  end if;

  return query
  update public.institutions as inst
  set
    login_display_name = case
      when set_login_display_name then nullif(trim(new_login_display_name), '')
      else inst.login_display_name
    end,
    logo_url = case
      when set_logo_url then new_logo_url
      else inst.logo_url
    end,
    favicon_url = case
      when set_favicon_url then new_favicon_url
      else inst.favicon_url
    end,
    primary_color = case
      when set_primary_color then new_primary_color
      else inst.primary_color
    end,
    secondary_color = case
      when set_secondary_color then new_secondary_color
      else inst.secondary_color
    end,
    updated_at = now()
  where inst.id = target_institution_id
    and inst.active is true
  returning
    inst.id,
    inst.name,
    inst.subdomain,
    inst.login_display_name,
    inst.logo_url,
    inst.favicon_url,
    inst.primary_color,
    inst.secondary_color,
    inst.active,
    inst.account_id;
end;
$$;

revoke all on function public.update_institution_login_branding(
  uuid,
  text,
  boolean,
  text,
  boolean,
  text,
  boolean,
  text,
  boolean,
  text,
  boolean
)
from public, anon, authenticated;

grant execute on function public.update_institution_login_branding(
  uuid,
  text,
  boolean,
  text,
  boolean,
  text,
  boolean,
  text,
  boolean,
  text,
  boolean
)
to authenticated, service_role;

create or replace function public.can_director_write_institution_branding_object(
  object_name text,
  object_metadata jsonb default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  path_match text[];
  target_institution_id uuid;
  asset_kind text;
  asset_extension text;
  metadata_mimetype text;
  metadata_size_text text;
  metadata_size bigint;
begin
  path_match := regexp_match(
    object_name,
    '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/(logo|favicon)\.(png|jpg|jpeg|webp)$'
  );

  if path_match is null then
    return false;
  end if;

  target_institution_id := path_match[1]::uuid;
  asset_kind := path_match[2];
  asset_extension := path_match[3];

  if object_metadata is not null then
    if jsonb_typeof(object_metadata) <> 'object' then
      return false;
    end if;

    metadata_mimetype := object_metadata ->> 'mimetype';
    metadata_size_text := coalesce(
      object_metadata ->> 'size',
      object_metadata ->> 'contentLength'
    );

    if metadata_size_text is null
        or metadata_size_text !~ '^[0-9]+$'
        or length(metadata_size_text) > 18 then
      return false;
    end if;

    metadata_size := metadata_size_text::bigint;

    if metadata_size <= 0 then
      return false;
    end if;

    if asset_extension = 'png'
        and metadata_mimetype <> 'image/png' then
      return false;
    end if;

    if asset_extension in ('jpg', 'jpeg')
        and metadata_mimetype <> 'image/jpeg' then
      return false;
    end if;

    if asset_extension = 'webp'
        and metadata_mimetype <> 'image/webp' then
      return false;
    end if;

    if metadata_size > (
      case
      when asset_kind = 'logo' then 2 * 1024 * 1024
      when asset_kind = 'favicon' then 512 * 1024
      else 0
      end
    ) then
      return false;
    end if;
  end if;

  return exists (
    select 1
    from public.memberships as membership
    where membership.profile_id = auth.uid()
      and membership.institution_id = target_institution_id
      and membership.role = 'DIRECTOR'
      and membership.active is true
  );
end;
$$;

drop policy if exists institution_branding_director_insert
  on storage.objects;

create policy institution_branding_director_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'institution-branding'
  and public.can_director_write_institution_branding_object(name, metadata)
);

drop policy if exists institution_branding_director_update
  on storage.objects;

create policy institution_branding_director_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'institution-branding'
  and public.can_director_write_institution_branding_object(name)
)
with check (
  bucket_id = 'institution-branding'
  and public.can_director_write_institution_branding_object(name, metadata)
);

drop policy if exists institution_branding_director_delete
  on storage.objects;

create policy institution_branding_director_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'institution-branding'
  and public.can_director_write_institution_branding_object(name)
);

revoke all on function public.can_director_write_institution_branding_object(text, jsonb)
  from public, anon, authenticated;

grant execute on function public.can_director_write_institution_branding_object(text, jsonb)
  to authenticated, service_role;

-- Recreate the RPC to include login_display_name and favicon_url in the public return set.
-- Preserves SECURITY DEFINER, search_path = '', schema-qualified tables, and all existing filters.
drop function if exists public.resolve_public_institution_by_subdomain(text);

create or replace function public.resolve_public_institution_by_subdomain(target_subdomain text)
returns table (
  id uuid,
  name text,
  subdomain text,
  login_display_name text,
  logo_url text,
  favicon_url text,
  primary_color text,
  secondary_color text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  clean_subdomain text;
begin
  clean_subdomain := lower(trim(target_subdomain));
  if clean_subdomain = '' or clean_subdomain in (
    'admin', 'api', 'app', 'assets', 'auth', 'blog', 'cdn', 'dashboard',
    'dev', 'docs', 'grupotec', 'help', 'login', 'mail', 'media', 'platform',
    'portal', 'privacy', 'resend', 'root', 'send', 'smtp', 'staging',
    'static', 'status', 'suporte', 'support', 'tecescola', 'terms', 'test', 'www'
  ) then
    return;
  end if;

  return query
  select
    inst.id,
    inst.name,
    inst.subdomain,
    inst.login_display_name,
    inst.logo_url,
    inst.favicon_url,
    inst.primary_color,
    inst.secondary_color
  from public.institutions as inst
  left join public.accounts as acc
    on acc.id = inst.account_id
  where inst.subdomain = clean_subdomain
    and inst.active is true
    and (inst.account_id is null or acc.status = 'ACTIVE')
  limit 1;
end;
$$;

revoke all on function public.resolve_public_institution_by_subdomain(text)
  from public, anon, authenticated;

grant execute on function public.resolve_public_institution_by_subdomain(text)
  to anon, authenticated;
