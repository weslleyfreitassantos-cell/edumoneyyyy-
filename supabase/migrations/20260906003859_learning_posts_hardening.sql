-- Harden the learning feed policies after production validation.

begin;

create index if not exists learning_posts_subject_idx
  on public.learning_posts (subject_id, active, published_at desc);

drop policy if exists learning_posts_select_policy on public.learning_posts;
create policy learning_posts_select_policy
on public.learning_posts for select to authenticated
using (
  (
    created_by = (select auth.uid())
    and exists (
      select 1
        from public.memberships as membership
        join public.profiles as profile on profile.id = membership.profile_id
       where membership.profile_id = (select auth.uid())
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
     where student.profile_id = (select auth.uid())
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
  created_by = (select auth.uid())
  and exists (
    select 1
      from public.memberships as membership
      join public.profiles as profile on profile.id = membership.profile_id
     where membership.profile_id = (select auth.uid())
       and membership.institution_id = learning_posts.institution_id
       and membership.role = 'TEACHER'::public.user_role
       and membership.active is true
       and profile.active is true
  )
  and exists (
    select 1
      from public.teacher_subjects as teacher_subject
     where teacher_subject.institution_id = learning_posts.institution_id
       and teacher_subject.teacher_profile_id = (select auth.uid())
       and teacher_subject.subject_id = learning_posts.subject_id
       and teacher_subject.active is true
  )
);

drop policy if exists learning_posts_update_policy on public.learning_posts;
create policy learning_posts_update_policy
on public.learning_posts for update to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1
      from public.memberships as membership
      join public.profiles as profile on profile.id = membership.profile_id
     where membership.profile_id = (select auth.uid())
       and membership.institution_id = learning_posts.institution_id
       and membership.role = 'TEACHER'::public.user_role
       and membership.active is true
       and profile.active is true
  )
)
with check (created_by = (select auth.uid()));

drop policy if exists learning_posts_delete_policy on public.learning_posts;
create policy learning_posts_delete_policy
on public.learning_posts for delete to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1
      from public.memberships as membership
      join public.profiles as profile on profile.id = membership.profile_id
     where membership.profile_id = (select auth.uid())
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
       and post.created_by = (select auth.uid())
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
       and post.created_by = (select auth.uid())
  )
);

drop policy if exists learning_post_reads_select_policy on public.learning_post_reads;
create policy learning_post_reads_select_policy
on public.learning_post_reads for select to authenticated
using (profile_id = (select auth.uid()));

drop policy if exists learning_post_reads_insert_policy on public.learning_post_reads;
create policy learning_post_reads_insert_policy
on public.learning_post_reads for insert to authenticated
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1
      from public.students as student
      join public.profiles as profile on profile.id = student.profile_id
     where student.profile_id = (select auth.uid())
       and student.active is true
       and profile.active is true
  )
  and exists (
    select 1
      from public.learning_posts as post
      join public.enrollments as enrollment on enrollment.class_id = post.class_id
      join public.students as student on student.id = enrollment.student_id
      join public.profiles as profile on profile.id = student.profile_id
      join public.classes as class_row on class_row.id = enrollment.class_id
     where post.id = learning_post_reads.post_id
       and student.profile_id = (select auth.uid())
       and student.institution_id = post.institution_id
       and student.active is true
       and profile.active is true
       and enrollment.active is true
       and lower(btrim(enrollment.status)) = 'active'
       and class_row.active is true
       and post.active is true
       and post.published_at <= now()
       and (post.expires_at is null or post.expires_at > now())
       and exists (
         select 1
           from public.class_curriculum_items as curriculum
          where curriculum.class_id = post.class_id
            and curriculum.subject_id = post.subject_id
            and curriculum.institution_id = post.institution_id
            and curriculum.active is true
       )
  )
);

drop policy if exists learning_post_reads_update_policy on public.learning_post_reads;
create policy learning_post_reads_update_policy
on public.learning_post_reads for update to authenticated
using (
  profile_id = (select auth.uid())
  and exists (
    select 1
      from public.learning_posts as post
      join public.enrollments as enrollment on enrollment.class_id = post.class_id
      join public.students as student on student.id = enrollment.student_id
      join public.profiles as profile on profile.id = student.profile_id
      join public.classes as class_row on class_row.id = enrollment.class_id
     where post.id = learning_post_reads.post_id
       and student.profile_id = (select auth.uid())
       and student.institution_id = post.institution_id
       and student.active is true
       and profile.active is true
       and enrollment.active is true
       and lower(btrim(enrollment.status)) = 'active'
       and class_row.active is true
       and post.active is true
       and post.published_at <= now()
       and (post.expires_at is null or post.expires_at > now())
       and exists (
         select 1
           from public.class_curriculum_items as curriculum
          where curriculum.class_id = post.class_id
            and curriculum.subject_id = post.subject_id
            and curriculum.institution_id = post.institution_id
            and curriculum.active is true
       )
  )
)
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1
      from public.learning_posts as post
      join public.enrollments as enrollment on enrollment.class_id = post.class_id
      join public.students as student on student.id = enrollment.student_id
      join public.profiles as profile on profile.id = student.profile_id
      join public.classes as class_row on class_row.id = enrollment.class_id
     where post.id = learning_post_reads.post_id
       and student.profile_id = (select auth.uid())
       and student.institution_id = post.institution_id
       and student.active is true
       and profile.active is true
       and enrollment.active is true
       and lower(btrim(enrollment.status)) = 'active'
       and class_row.active is true
       and post.active is true
       and post.published_at <= now()
       and (post.expires_at is null or post.expires_at > now())
       and exists (
         select 1
           from public.class_curriculum_items as curriculum
          where curriculum.class_id = post.class_id
            and curriculum.subject_id = post.subject_id
            and curriculum.institution_id = post.institution_id
            and curriculum.active is true
       )
  )
);

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
       and post.created_by = (select auth.uid())
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
       and post.created_by = (select auth.uid())
  )
);

notify pgrst, 'reload schema';

commit;
