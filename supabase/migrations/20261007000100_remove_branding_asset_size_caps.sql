begin;

-- Keep Storage validation strict about ownership, format and non-empty files,
-- but do not impose an application-level size cap on favicon/background assets.
create or replace function public.is_valid_branding_storage_metadata(
  asset_path text,
  object_metadata jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  asset_extension text;
  metadata_mimetype text;
  metadata_size_text text;
  metadata_size numeric;
begin
  if not public.is_valid_branding_asset_path(asset_path)
      or object_metadata is null
      or jsonb_typeof(object_metadata) <> 'object' then
    return false;
  end if;

  asset_extension := public.branding_asset_extension(asset_path);
  metadata_mimetype := object_metadata ->> 'mimetype';
  metadata_size_text := coalesce(
    object_metadata ->> 'size',
    object_metadata ->> 'contentLength'
  );

  if metadata_size_text is null
      or metadata_size_text !~ '^[0-9]+$' then
    return false;
  end if;

  metadata_size := metadata_size_text::numeric;

  if metadata_size <= 0 then
    return false;
  end if;

  if asset_extension = 'png'
      and metadata_mimetype <> 'image/png' then
    return false;
  end if;

  if asset_extension = 'jpg'
      and metadata_mimetype <> 'image/jpeg' then
    return false;
  end if;

  if asset_extension = 'webp'
      and metadata_mimetype <> 'image/webp' then
    return false;
  end if;

  return metadata_mimetype in ('image/png', 'image/jpeg', 'image/webp');
end;
$$;

-- The institution editor uses a separate Director policy for the same bucket.
-- Keep its institution scoping unchanged while removing only per-asset caps.
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
  asset_extension text;
  metadata_mimetype text;
  metadata_size_text text;
  metadata_size numeric;
begin
  path_match := regexp_match(
    object_name,
    '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/(logo|favicon|background)\.(png|jpg|jpeg|webp)$'
  );

  if path_match is null then
    return false;
  end if;

  target_institution_id := path_match[1]::uuid;
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
        or metadata_size_text !~ '^[0-9]+$' then
      return false;
    end if;

    metadata_size := metadata_size_text::numeric;

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

revoke all on function public.is_valid_branding_storage_metadata(text, jsonb)
  from public, anon, authenticated;

grant execute on function public.is_valid_branding_storage_metadata(text, jsonb)
  to authenticated, service_role;

revoke all on function public.can_director_write_institution_branding_object(text, jsonb)
  from public, anon, authenticated;

grant execute on function public.can_director_write_institution_branding_object(text, jsonb)
  to authenticated, service_role;

commit;
