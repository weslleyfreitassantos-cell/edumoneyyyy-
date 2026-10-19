begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'student-documents',
  'student-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists student_documents_storage_insert on storage.objects;
create policy student_documents_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'student-documents'
  and exists (
    select 1
      from public.student_documents as document
     where document.institution_id::text = split_part(storage.objects.name, '/', 1)
       and document.student_id::text = split_part(storage.objects.name, '/', 2)
       and public.can_manage_institution_operations(document.institution_id)
  )
);

drop policy if exists student_documents_storage_select on storage.objects;
create policy student_documents_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'student-documents'
  and exists (
    select 1
      from public.student_documents as document
     where document.file_path = storage.objects.name
       and public.can_manage_institution_operations(document.institution_id)
  )
);

drop policy if exists student_documents_storage_delete on storage.objects;
create policy student_documents_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'student-documents'
  and exists (
    select 1
      from public.student_documents as document
     where document.institution_id::text = split_part(storage.objects.name, '/', 1)
       and document.student_id::text = split_part(storage.objects.name, '/', 2)
       and public.can_manage_institution_operations(document.institution_id)
  )
);

commit;
