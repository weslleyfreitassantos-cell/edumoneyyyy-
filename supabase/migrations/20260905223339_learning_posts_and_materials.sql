-- Materiais e avisos publicados por professores para suas turmas.
-- O acesso efetivo e a disponibilidade dos anexos permanecem sob RLS.

begin;

create table public.learning_posts (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete restrict,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  post_type text not null check (post_type in ('MATERIAL', 'NOTICE')),
  title text not null check (char_length(trim(title)) between 1 and 160),
  body text not null default '' check (char_length(body) <= 30000),
  external_url text check (
    external_url is null
    or (
      char_length(external_url) <= 2048
      and external_url ~* '^https?://'
    )
  ),
  pinned boolean not null default false,
  active boolean not null default true,
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_posts_expiration_after_publication
    check (expires_at is null or expires_at > published_at)
);

create index learning_posts_institution_feed_idx
  on public.learning_posts (institution_id, active, pinned desc, published_at desc);
create index learning_posts_class_subject_idx
  on public.learning_posts (class_id, subject_id, active, published_at desc);
create index learning_posts_created_by_idx
  on public.learning_posts (created_by, created_at desc);

create table public.learning_post_attachments (
  id uuid primary key default extensions.uuid_generate_v4(),
  post_id uuid not null references public.learning_posts(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (char_length(trim(file_name)) between 1 and 255),
  mime_type text not null check (char_length(trim(mime_type)) between 1 and 255),
  size_bytes bigint not null check (size_bytes between 1 and 26214400),
  created_at timestamptz not null default now()
);

create index learning_post_attachments_post_idx
  on public.learning_post_attachments (post_id);

create table public.learning_post_reads (
  post_id uuid not null references public.learning_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

create index learning_post_reads_profile_idx
  on public.learning_post_reads (profile_id, read_at desc);

create or replace function private.set_learning_posts_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists learning_posts_set_updated_at
  on public.learning_posts;

create trigger learning_posts_set_updated_at
before update on public.learning_posts
for each row
execute function private.set_learning_posts_updated_at();

create or replace function private.validate_learning_post_integrity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  class_institution_id uuid;
  subject_institution_id uuid;
begin
  if tg_op = 'UPDATE' and (
    new.institution_id is distinct from old.institution_id
    or new.class_id is distinct from old.class_id
    or new.subject_id is distinct from old.subject_id
    or new.created_by is distinct from old.created_by
  ) then
    raise exception 'Learning post scope is immutable.'
      using errcode = '23514';
  end if;

  select class_row.institution_id
    into class_institution_id
    from public.classes as class_row
   where class_row.id = new.class_id
     and class_row.active is true;

  if class_institution_id is null then
    raise exception 'Learning post class is not active.'
      using errcode = '23514';
  end if;

  select subject_row.institution_id
    into subject_institution_id
    from public.subjects as subject_row
   where subject_row.id = new.subject_id
     and subject_row.active is true;

  if subject_institution_id is null then
    raise exception 'Learning post subject is not active.'
      using errcode = '23514';
  end if;

  if class_institution_id is distinct from new.institution_id
     or subject_institution_id is distinct from new.institution_id then
    raise exception 'Learning post tenant does not match class and subject.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
      from public.class_curriculum_items as curriculum
     where curriculum.class_id = new.class_id
       and curriculum.subject_id = new.subject_id
       and curriculum.institution_id = new.institution_id
       and curriculum.active is true
  ) then
    raise exception 'Learning post subject is not available for the class.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
      from public.memberships as membership
      join public.profiles as profile
        on profile.id = membership.profile_id
     where membership.profile_id = new.created_by
       and membership.institution_id = new.institution_id
       and membership.role = 'TEACHER'::public.user_role
       and membership.active is true
       and profile.active is true
  ) then
    raise exception 'Learning post author is not an active teacher in the institution.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
      from public.teacher_subjects as teacher_subject
     where teacher_subject.institution_id = new.institution_id
       and teacher_subject.teacher_profile_id = new.created_by
       and teacher_subject.subject_id = new.subject_id
       and teacher_subject.active is true
  ) then
    raise exception 'Learning post author is not assigned to the subject.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists learning_posts_validate_integrity
  on public.learning_posts;

create trigger learning_posts_validate_integrity
before insert or update of institution_id, class_id, subject_id, created_by
on public.learning_posts
for each row
execute function private.validate_learning_post_integrity();

alter table public.learning_posts enable row level security;
alter table public.learning_post_attachments enable row level security;
alter table public.learning_post_reads enable row level security;

drop policy if exists learning_posts_select_policy on public.learning_posts;
create policy learning_posts_select_policy
on public.learning_posts for select to authenticated
using (
  (
    created_by = auth.uid()
    and exists (
      select 1
        from public.memberships as membership
        join public.profiles as profile on profile.id = membership.profile_id
       where membership.profile_id = auth.uid()
         and membership.institution_id = learning_posts.institution_id
         and membership.role = 'TEACHER'::public.user_role
         and membership.active is true
         and profile.active is true
    )
  )
  or exists (
    select 1
      from public.enrollments as enrollment
      join public.students as student on student.id = enrollment.student_id
      join public.profiles as profile on profile.id = student.profile_id
      join public.classes as class_row on class_row.id = enrollment.class_id
     where student.profile_id = auth.uid()
       and student.institution_id = learning_posts.institution_id
       and student.active is true
       and profile.active is true
       and enrollment.class_id = learning_posts.class_id
       and enrollment.active is true
       and lower(btrim(enrollment.status)) = 'active'
       and class_row.active is true
       and learning_posts.active is true
       and learning_posts.published_at <= now()
       and (learning_posts.expires_at is null or learning_posts.expires_at > now())
       and exists (
         select 1
           from public.class_curriculum_items as curriculum
          where curriculum.class_id = learning_posts.class_id
            and curriculum.subject_id = learning_posts.subject_id
            and curriculum.institution_id = learning_posts.institution_id
            and curriculum.active is true
       )
  )
);

drop policy if exists learning_posts_insert_policy on public.learning_posts;
create policy learning_posts_insert_policy
on public.learning_posts for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
      from public.memberships as membership
      join public.profiles as profile on profile.id = membership.profile_id
     where membership.profile_id = auth.uid()
       and membership.institution_id = learning_posts.institution_id
       and membership.role = 'TEACHER'::public.user_role
       and membership.active is true
       and profile.active is true
  )
  and exists (
    select 1
      from public.teacher_subjects as teacher_subject
     where teacher_subject.institution_id = learning_posts.institution_id
       and teacher_subject.teacher_profile_id = auth.uid()
       and teacher_subject.subject_id = learning_posts.subject_id
       and teacher_subject.active is true
  )
);

drop policy if exists learning_posts_update_policy on public.learning_posts;
create policy learning_posts_update_policy
on public.learning_posts for update to authenticated
using (
  created_by = auth.uid()
  and exists (
    select 1
      from public.memberships as membership
      join public.profiles as profile on profile.id = membership.profile_id
     where membership.profile_id = auth.uid()
       and membership.institution_id = learning_posts.institution_id
       and membership.role = 'TEACHER'::public.user_role
       and membership.active is true
       and profile.active is true
  )
)
with check (created_by = auth.uid());

drop policy if exists learning_posts_delete_policy on public.learning_posts;
create policy learning_posts_delete_policy
on public.learning_posts for delete to authenticated
using (
  created_by = auth.uid()
  and exists (
    select 1
      from public.memberships as membership
      join public.profiles as profile on profile.id = membership.profile_id
     where membership.profile_id = auth.uid()
       and membership.institution_id = learning_posts.institution_id
       and membership.role = 'TEACHER'::public.user_role
       and membership.active is true
       and profile.active is true
  )
);

drop policy if exists learning_post_attachments_select_policy on public.learning_post_attachments;
create policy learning_post_attachments_select_policy
on public.learning_post_attachments for select to authenticated
using (
  exists (
    select 1
      from public.learning_posts as post
     where post.id = learning_post_attachments.post_id
  )
);

drop policy if exists learning_post_attachments_insert_policy on public.learning_post_attachments;
create policy learning_post_attachments_insert_policy
on public.learning_post_attachments for insert to authenticated
with check (
  exists (
    select 1
      from public.learning_posts as post
     where post.id = learning_post_attachments.post_id
       and post.created_by = auth.uid()
  )
);

drop policy if exists learning_post_attachments_delete_policy on public.learning_post_attachments;
create policy learning_post_attachments_delete_policy
on public.learning_post_attachments for delete to authenticated
using (
  exists (
    select 1
      from public.learning_posts as post
     where post.id = learning_post_attachments.post_id
       and post.created_by = auth.uid()
  )
);

drop policy if exists learning_post_reads_select_policy on public.learning_post_reads;
create policy learning_post_reads_select_policy
on public.learning_post_reads for select to authenticated
using (profile_id = auth.uid());

drop policy if exists learning_post_reads_insert_policy on public.learning_post_reads;
create policy learning_post_reads_insert_policy
on public.learning_post_reads for insert to authenticated
with check (
  profile_id = auth.uid()
  and exists (
    select 1
      from public.students as student
      join public.profiles as profile on profile.id = student.profile_id
     where student.profile_id = auth.uid()
       and student.active is true
       and profile.active is true
  )
  and exists (
    select 1
      from public.learning_posts as post
     where post.id = learning_post_reads.post_id
  )
);

drop policy if exists learning_post_reads_update_policy on public.learning_post_reads;
create policy learning_post_reads_update_policy
on public.learning_post_reads for update to authenticated
using (
  profile_id = auth.uid()
  and exists (
    select 1
      from public.students as student
     where student.profile_id = auth.uid()
       and student.active is true
  )
)
with check (profile_id = auth.uid());

revoke all on table public.learning_posts from anon;
revoke all on table public.learning_post_attachments from anon;
revoke all on table public.learning_post_reads from anon;
grant select, insert, update, delete on table public.learning_posts to authenticated;
grant select, insert, delete on table public.learning_post_attachments to authenticated;
grant select, insert, update on table public.learning_post_reads to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'learning-materials',
  'learning-materials',
  false,
  26214400,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists learning_materials_insert_policy on storage.objects;
create policy learning_materials_insert_policy
on storage.objects for insert to authenticated
with check (
  bucket_id = 'learning-materials'
  and split_part(name, '/', 1) = 'institution'
  and split_part(name, '/', 3) = 'class'
  and split_part(name, '/', 5) = 'subject'
  and split_part(name, '/', 7) = 'post'
  and exists (
    select 1
      from public.learning_posts as post
     where post.id::text = split_part(name, '/', 8)
       and post.institution_id::text = split_part(name, '/', 2)
       and post.class_id::text = split_part(name, '/', 4)
       and post.subject_id::text = split_part(name, '/', 6)
       and post.created_by = auth.uid()
  )
);

drop policy if exists learning_materials_select_policy on storage.objects;
create policy learning_materials_select_policy
on storage.objects for select to authenticated
using (
  bucket_id = 'learning-materials'
  and exists (
    select 1
      from public.learning_post_attachments as attachment
      join public.learning_posts as post on post.id = attachment.post_id
     where attachment.storage_path = storage.objects.name
  )
);

drop policy if exists learning_materials_delete_policy on storage.objects;
create policy learning_materials_delete_policy
on storage.objects for delete to authenticated
using (
  bucket_id = 'learning-materials'
  and exists (
    select 1
      from public.learning_post_attachments as attachment
      join public.learning_posts as post on post.id = attachment.post_id
     where attachment.storage_path = storage.objects.name
       and post.created_by = auth.uid()
  )
);

revoke all on function private.set_learning_posts_updated_at() from public, anon, authenticated;
revoke all on function private.validate_learning_post_integrity() from public, anon, authenticated;
grant execute on function private.set_learning_posts_updated_at() to service_role;
grant execute on function private.validate_learning_post_integrity() to service_role;

notify pgrst, 'reload schema';

commit;
