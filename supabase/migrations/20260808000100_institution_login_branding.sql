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

drop policy if exists institutions_update_branding_policy
  on public.institutions;

create policy institutions_update_branding_policy
on public.institutions
for update
to authenticated
using (
  public.is_platform_super_admin()
  or public.owns_account(account_id)
  or exists (
    select 1
    from public.memberships as membership
    where membership.profile_id = auth.uid()
      and membership.institution_id = institutions.id
      and membership.role = 'DIRECTOR'
      and membership.active is true
  )
)
with check (
  public.is_platform_super_admin()
  or public.owns_account(account_id)
  or exists (
    select 1
    from public.memberships as membership
    where membership.profile_id = auth.uid()
      and membership.institution_id = institutions.id
      and membership.role = 'DIRECTOR'
      and membership.active is true
  )
);

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

    if metadata_size > case
      when asset_kind = 'logo' then 2 * 1024 * 1024
      when asset_kind = 'favicon' then 512 * 1024
      else 0
    end then
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
