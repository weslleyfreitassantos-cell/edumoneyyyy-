begin;

-- The Aurora demo uses deterministic md5(... )::uuid identifiers. PostgreSQL
-- accepts those UUID-shaped values, but they do not necessarily carry RFC 4122
-- version/variant bits. Storage paths must therefore validate UUID syntax only.
create or replace function private.book_cover_path_uuid(
  target_path text,
  segment_position integer
)
returns uuid
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  segment text;
begin
  if target_path is null or segment_position not in (1, 2) then
    return null;
  end if;

  segment := split_part(target_path, '/', segment_position);
  if segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;

  return segment::uuid;
exception
  when others then
    return null;
end;
$$;

revoke all on function private.book_cover_path_uuid(text, integer)
  from public, anon, authenticated;

grant execute on function private.book_cover_path_uuid(text, integer)
  to service_role;

notify pgrst, 'reload schema';

commit;
