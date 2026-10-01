-- Avatares de perfil são privados e acessíveis somente pelo próprio usuário.
-- A aplicação normaliza a imagem para WebP antes do upload, sem limitar o
-- tamanho do arquivo original escolhido no dispositivo.
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
  null,
  array['image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = null,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_avatar_select_policy
  on storage.objects;

create policy profile_avatar_select_policy
on storage.objects
for select
to authenticated
using (
  bucket_id = 'profile-avatars'
  and name = (auth.uid()::text || '/avatar.webp')
);

drop policy if exists profile_avatar_insert_policy
  on storage.objects;

create policy profile_avatar_insert_policy
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and name = (auth.uid()::text || '/avatar.webp')
  and coalesce(metadata ->> 'mimetype', '') = 'image/webp'
);

drop policy if exists profile_avatar_update_policy
  on storage.objects;

create policy profile_avatar_update_policy
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-avatars'
  and name = (auth.uid()::text || '/avatar.webp')
)
with check (
  bucket_id = 'profile-avatars'
  and name = (auth.uid()::text || '/avatar.webp')
  and coalesce(metadata ->> 'mimetype', '') = 'image/webp'
);

drop policy if exists profile_avatar_delete_policy
  on storage.objects;

create policy profile_avatar_delete_policy
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and name = (auth.uid()::text || '/avatar.webp')
);

create or replace function public.set_current_profile_avatar(
  p_avatar_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_path text;
begin
  if auth.uid() is null then
    raise exception 'Sessao expirada.' using errcode = 'P0001';
  end if;

  expected_path := auth.uid()::text || '/avatar.webp';

  if p_avatar_path is not null
    and btrim(p_avatar_path) <> expected_path then
    raise exception 'Caminho de avatar invalido.' using errcode = 'P0001';
  end if;

  update public.profiles
  set avatar_url = nullif(btrim(p_avatar_path), ''),
      updated_at = now()
  where id = auth.uid()
    and active is true;

  if not found then
    raise exception 'Perfil academico nao encontrado.' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.set_current_profile_avatar(text)
  from public;

grant execute on function public.set_current_profile_avatar(text)
  to authenticated;
