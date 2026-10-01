-- Remove the application-level avatar upload limit while keeping the bucket private.
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
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = null,
    allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
