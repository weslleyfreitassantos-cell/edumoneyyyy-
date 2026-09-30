begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-avatars',
  'profile-avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.set_current_profile_avatar(
  p_avatar_path text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  if p_avatar_path is not null
     and p_avatar_path <> current_user_id::text || '/avatar.webp' then
    raise exception 'invalid avatar path';
  end if;

  update public.profiles
     set avatar_url = p_avatar_path
   where id = current_user_id;

  if not found then
    raise exception 'profile not found';
  end if;

  return p_avatar_path;
end;
$$;

alter function public.set_current_profile_avatar(text)
  owner to postgres;

revoke all on function public.set_current_profile_avatar(text)
  from public, anon, authenticated;

grant execute on function public.set_current_profile_avatar(text)
  to authenticated;

revoke update (avatar_url) on table public.profiles
  from anon, authenticated;

drop policy if exists profile_avatars_select on storage.objects;
create policy profile_avatars_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'profile-avatars'
  and name = (select auth.uid())::text || '/avatar.webp'
);

drop policy if exists profile_avatars_insert on storage.objects;
create policy profile_avatars_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and name = (select auth.uid())::text || '/avatar.webp'
);

drop policy if exists profile_avatars_update on storage.objects;
create policy profile_avatars_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-avatars'
  and name = (select auth.uid())::text || '/avatar.webp'
)
with check (
  bucket_id = 'profile-avatars'
  and name = (select auth.uid())::text || '/avatar.webp'
);

drop policy if exists profile_avatars_delete on storage.objects;
create policy profile_avatars_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and name = (select auth.uid())::text || '/avatar.webp'
);

notify pgrst, 'reload schema';

commit;
