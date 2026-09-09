begin;

create or replace function private.book_offering_belongs_to_institution(
  target_offering_id uuid,
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.subject_offerings as offering
    join public.classes as class
      on class.id = offering.class_id
    join public.subjects as subject
      on subject.id = offering.subject_id
    where offering.id = target_offering_id
      and class.institution_id = target_institution_id
      and subject.institution_id = target_institution_id
  );
$$;

create or replace function private.book_is_teacher_for_offering(
  target_offering_id uuid,
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_institution_operational(target_institution_id)
    and exists (
      select 1
      from public.subject_offerings as offering
      join public.classes as class
        on class.id = offering.class_id
      join public.subjects as subject
        on subject.id = offering.subject_id
      join public.memberships as membership
        on membership.profile_id = auth.uid()
       and membership.institution_id = class.institution_id
      where offering.id = target_offering_id
        and offering.teacher_profile_id = auth.uid()
        and offering.active is true
        and class.active is true
        and subject.active is true
        and class.institution_id = target_institution_id
        and subject.institution_id = target_institution_id
        and membership.active is true
        and membership.role = 'TEACHER'::public.user_role
    );
$$;

create or replace function private.book_is_student_enrolled_in_offering(
  target_offering_id uuid,
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_institution_operational(target_institution_id)
    and exists (
      select 1
      from public.subject_offerings as offering
      join public.classes as class
        on class.id = offering.class_id
      join public.subjects as subject
        on subject.id = offering.subject_id
      join public.enrollments as enrollment
        on enrollment.class_id = class.id
      join public.students as student
        on student.id = enrollment.student_id
      join public.memberships as membership
        on membership.profile_id = student.profile_id
       and membership.institution_id = student.institution_id
      where offering.id = target_offering_id
        and offering.active is true
        and class.active is true
        and class.institution_id = target_institution_id
        and subject.institution_id = target_institution_id
        and student.profile_id = auth.uid()
        and student.institution_id = target_institution_id
        and student.active is true
        and enrollment.active is true
        and membership.active is true
        and membership.role = 'STUDENT'::public.user_role
    );
$$;

revoke all on function private.book_offering_belongs_to_institution(uuid, uuid)
  from public, anon, authenticated;

revoke all on function private.book_is_teacher_for_offering(uuid, uuid)
  from public, anon, authenticated;

revoke all on function private.book_is_student_enrolled_in_offering(uuid, uuid)
  from public, anon, authenticated;

grant execute on function private.book_offering_belongs_to_institution(uuid, uuid)
  to authenticated, service_role;

grant execute on function private.book_is_teacher_for_offering(uuid, uuid)
  to authenticated, service_role;

grant execute on function private.book_is_student_enrolled_in_offering(uuid, uuid)
  to authenticated, service_role;

create table public.book_recommendations (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  subject_offering_id uuid not null references public.subject_offerings(id) on delete restrict,
  title text not null,
  author text not null,
  isbn text,
  note text,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint book_recommendations_title_length_check
    check (char_length(trim(title)) between 1 and 200),
  constraint book_recommendations_author_length_check
    check (char_length(trim(author)) between 1 and 200),
  constraint book_recommendations_isbn_length_check
    check (isbn is null or char_length(trim(isbn)) between 1 and 32),
  constraint book_recommendations_note_length_check
    check (note is null or char_length(note) <= 2000)
);

create index book_recommendations_institution_active_idx
  on public.book_recommendations (institution_id, active, created_at desc);

create index book_recommendations_subject_offering_idx
  on public.book_recommendations (subject_offering_id, active, created_at desc);

create index book_recommendations_created_by_idx
  on public.book_recommendations (created_by, created_at desc);

create or replace function private.validate_book_recommendation_tenant_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  class_institution_id uuid;
  subject_institution_id uuid;
begin
  select
    class.institution_id,
    subject.institution_id
  into
    class_institution_id,
    subject_institution_id
  from public.subject_offerings as offering
  join public.classes as class
    on class.id = offering.class_id
  join public.subjects as subject
    on subject.id = offering.subject_id
  where offering.id = new.subject_offering_id;

  if not found then
    raise exception
      'Book recommendation subject offering was not found.'
      using errcode = '23503';
  end if;

  if class_institution_id is distinct from subject_institution_id
      or new.institution_id is distinct from class_institution_id then
    raise exception
      'Book recommendation institution must match its subject offering.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists book_recommendations_validate_tenant_integrity
  on public.book_recommendations;

create trigger book_recommendations_validate_tenant_integrity
before insert or update of institution_id, subject_offering_id
on public.book_recommendations
for each row
execute function private.validate_book_recommendation_tenant_integrity();

drop trigger if exists book_recommendations_touch_updated_at
  on public.book_recommendations;

create trigger book_recommendations_touch_updated_at
before update on public.book_recommendations
for each row
execute function public.touch_academic_record_updated_at();

alter table public.book_recommendations enable row level security;

create policy book_recommendations_teacher_select
on public.book_recommendations
for select
to authenticated
using (
  created_by = (select auth.uid())
  and private.book_is_teacher_for_offering(subject_offering_id, institution_id)
);

create policy book_recommendations_teacher_insert
on public.book_recommendations
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.book_offering_belongs_to_institution(subject_offering_id, institution_id)
  and private.book_is_teacher_for_offering(subject_offering_id, institution_id)
);

create policy book_recommendations_teacher_update
on public.book_recommendations
for update
to authenticated
using (
  created_by = (select auth.uid())
  and private.book_is_teacher_for_offering(subject_offering_id, institution_id)
)
with check (
  created_by = (select auth.uid())
  and private.book_offering_belongs_to_institution(subject_offering_id, institution_id)
  and private.book_is_teacher_for_offering(subject_offering_id, institution_id)
);

create policy book_recommendations_student_select
on public.book_recommendations
for select
to authenticated
using (
  active is true
  and private.book_is_student_enrolled_in_offering(subject_offering_id, institution_id)
);

revoke all on function private.validate_book_recommendation_tenant_integrity()
  from public, anon, authenticated;

grant select, insert, update
on public.book_recommendations
to authenticated;

commit;
