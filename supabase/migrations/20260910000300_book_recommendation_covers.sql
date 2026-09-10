begin;

alter table public.book_recommendations
  add column if not exists cover_path text;

alter table public.book_recommendations
  drop constraint if exists book_recommendations_cover_path_check;

alter table public.book_recommendations
  add constraint book_recommendations_cover_path_check
  check (
    cover_path is null
    or cover_path like institution_id::text || '/' || id::text || '/%'
  );

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'book-recommendation-covers',
  'book-recommendation-covers',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

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
  if segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;

  return segment::uuid;
exception
  when others then
    return null;
end;
$$;

create or replace function private.book_cover_teacher_can_manage(target_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.book_recommendations as recommendation
     where recommendation.id = private.book_cover_path_uuid(target_path, 2)
       and recommendation.institution_id = private.book_cover_path_uuid(target_path, 1)
       and recommendation.created_by = (select auth.uid())
       and private.book_is_teacher_for_offering(
         recommendation.subject_offering_id,
         recommendation.institution_id
       )
  );
$$;

create or replace function private.book_cover_student_can_read(target_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.book_recommendations as recommendation
     where recommendation.id = private.book_cover_path_uuid(target_path, 2)
       and recommendation.institution_id = private.book_cover_path_uuid(target_path, 1)
       and recommendation.active is true
       and private.book_is_student_enrolled_in_offering(
         recommendation.subject_offering_id,
         recommendation.institution_id
       )
  );
$$;

revoke all on function private.book_cover_path_uuid(text, integer)
  from public, anon, authenticated;
revoke all on function private.book_cover_teacher_can_manage(text)
  from public, anon, authenticated;
revoke all on function private.book_cover_student_can_read(text)
  from public, anon, authenticated;

grant execute on function private.book_cover_path_uuid(text, integer)
  to service_role;
grant execute on function private.book_cover_teacher_can_manage(text)
  to authenticated, service_role;
grant execute on function private.book_cover_student_can_read(text)
  to authenticated, service_role;

drop policy if exists book_recommendation_covers_insert on storage.objects;
create policy book_recommendation_covers_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'book-recommendation-covers'
  and private.book_cover_teacher_can_manage(name)
);

drop policy if exists book_recommendation_covers_select_teacher on storage.objects;
create policy book_recommendation_covers_select_teacher
on storage.objects
for select
to authenticated
using (
  bucket_id = 'book-recommendation-covers'
  and private.book_cover_teacher_can_manage(name)
);

drop policy if exists book_recommendation_covers_select_student on storage.objects;
create policy book_recommendation_covers_select_student
on storage.objects
for select
to authenticated
using (
  bucket_id = 'book-recommendation-covers'
  and private.book_cover_student_can_read(name)
);

drop policy if exists book_recommendation_covers_update on storage.objects;
create policy book_recommendation_covers_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'book-recommendation-covers'
  and private.book_cover_teacher_can_manage(name)
)
with check (
  bucket_id = 'book-recommendation-covers'
  and private.book_cover_teacher_can_manage(name)
);

drop policy if exists book_recommendation_covers_delete on storage.objects;
create policy book_recommendation_covers_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'book-recommendation-covers'
  and private.book_cover_teacher_can_manage(name)
);

notify pgrst, 'reload schema';

commit;
