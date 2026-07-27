-- Class Curriculum Matrix
--
-- Adds the class_curriculum_items table and related validation to
-- support defining which subjects each class offers, how many
-- weekly lessons, and the standard lesson duration.
--
-- Also backfills items from existing subject_offerings and adds
-- database-level protections to keep the curriculum matrix and
-- assignments (subject_offerings) consistent.

begin;

-- ============================================================
-- 1. Table: class_curriculum_items
-- ============================================================

create table public.class_curriculum_items (
  id uuid primary key
    default extensions.uuid_generate_v4(),

  institution_id uuid not null
    references public.institutions(id)
    on delete restrict,

  class_id uuid not null
    references public.classes(id)
    on delete restrict,

  subject_id uuid not null
    references public.subjects(id)
    on delete restrict,

  weekly_lessons smallint not null
    check (weekly_lessons between 1 and 20),

  lesson_duration_minutes smallint not null
    check (lesson_duration_minutes between 15 and 180),

  needs_review boolean not null default false,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint class_curriculum_items_class_subject_unique
    unique (class_id, subject_id)
);

create index class_curriculum_items_institution_idx
  on public.class_curriculum_items (institution_id);

create index class_curriculum_items_class_idx
  on public.class_curriculum_items (class_id);

-- ============================================================
-- 2. Backfill from existing subject_offerings
-- ============================================================

insert into public.class_curriculum_items (
  institution_id,
  class_id,
  subject_id,
  weekly_lessons,
  lesson_duration_minutes,
  needs_review,
  active
)
select distinct
  classes.institution_id,
  offerings.class_id,
  offerings.subject_id,
  1::smallint,
  50::smallint,
  true,
  (
    offerings.active is true
    and classes.active is true
    and subjects.active is true
  )
from public.subject_offerings as offerings
join public.classes as classes
  on classes.id = offerings.class_id
join public.subjects as subjects
  on subjects.id = offerings.subject_id
on conflict (class_id, subject_id)
  do nothing;

-- ============================================================
-- 3. Trigger: auto-update updated_at
-- ============================================================

create or replace function private.set_class_curriculum_item_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists class_curriculum_items_set_updated_at
  on public.class_curriculum_items;

create trigger class_curriculum_items_set_updated_at
before update on public.class_curriculum_items
for each row
execute function private.set_class_curriculum_item_updated_at();

revoke all on function private.set_class_curriculum_item_updated_at()
  from public, anon, authenticated;

grant execute on function private.set_class_curriculum_item_updated_at()
  to service_role;

-- ============================================================
-- 4. Tenant integrity validation
-- ============================================================

create or replace function private.validate_class_curriculum_item_tenant_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  class_institution_id uuid;
  class_is_active boolean;
  subject_institution_id uuid;
  subject_is_active boolean;
begin
  select
    classes.institution_id,
    classes.active
  into
    class_institution_id,
    class_is_active
  from public.classes as classes
  where classes.id = new.class_id;

  if not found then
    raise exception 'Curriculum item class does not exist.'
      using errcode = '23503';
  end if;

  if new.active is true and class_is_active is false then
    raise exception 'Cannot add active curriculum item to inactive class.'
      using errcode = '23514';
  end if;

  if class_institution_id is distinct from new.institution_id then
    raise exception 'Curriculum item institution must match class institution.'
      using errcode = '23514';
  end if;

  select
    subjects.institution_id,
    subjects.active
  into
    subject_institution_id,
    subject_is_active
  from public.subjects as subjects
  where subjects.id = new.subject_id;

  if not found then
    raise exception 'Curriculum item subject does not exist.'
      using errcode = '23503';
  end if;

  if new.active is true and subject_is_active is false then
    raise exception 'Cannot add active curriculum item to inactive subject.'
      using errcode = '23514';
  end if;

  if subject_institution_id is distinct from new.institution_id then
    raise exception 'Curriculum item institution must match subject institution.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists class_curriculum_items_validate_tenant_integrity
  on public.class_curriculum_items;

create trigger class_curriculum_items_validate_tenant_integrity
before insert or update of institution_id, class_id, subject_id, active
on public.class_curriculum_items
for each row
execute function private.validate_class_curriculum_item_tenant_integrity();

revoke all on function private.validate_class_curriculum_item_tenant_integrity()
  from public, anon, authenticated;

grant execute on function private.validate_class_curriculum_item_tenant_integrity()
  to service_role;

-- ============================================================
-- 5. Protection: prevent offering without curriculum item
-- ============================================================

create or replace function private.validate_offering_requires_curriculum_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.active is true then
    if not exists (
      select 1
      from public.class_curriculum_items as item
      where item.class_id = new.class_id
        and item.subject_id = new.subject_id
        and item.active is true
    ) then
      raise exception
        'CURRICULUM_COMPONENT_REQUIRED'
        using hint = 'Add this subject to the class curriculum matrix before assigning a teacher.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists subject_offerings_require_curriculum_item
  on public.subject_offerings;

create trigger subject_offerings_require_curriculum_item
before insert or update of class_id, subject_id, active
on public.subject_offerings
for each row
execute function private.validate_offering_requires_curriculum_item();

revoke all on function private.validate_offering_requires_curriculum_item()
  from public, anon, authenticated;

grant execute on function private.validate_offering_requires_curriculum_item()
  to service_role;

-- ============================================================
-- 6. Protection: prevent deactivating item with active offerings
-- ============================================================

create or replace function private.validate_curriculum_item_deactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.active is true and new.active is false then
    if exists (
      select 1
      from public.subject_offerings as offering
      where offering.class_id = new.class_id
        and offering.subject_id = new.subject_id
        and offering.active is true
    ) then
      raise exception
        'CURRICULUM_COMPONENT_HAS_ACTIVE_OFFERINGS'
        using hint = 'Deactivate the assignments first, then deactivate the curriculum item.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists class_curriculum_items_check_deactivation
  on public.class_curriculum_items;

create trigger class_curriculum_items_check_deactivation
before update of active
on public.class_curriculum_items
for each row
execute function private.validate_curriculum_item_deactivation();

revoke all on function private.validate_curriculum_item_deactivation()
  from public, anon, authenticated;

grant execute on function private.validate_curriculum_item_deactivation()
  to service_role;

-- ============================================================
-- 7. RLS
-- ============================================================

alter table public.class_curriculum_items enable row level security;

drop policy if exists class_curriculum_items_select_policy
  on public.class_curriculum_items;

create policy class_curriculum_items_select_policy
on public.class_curriculum_items
for select
to authenticated
using (
  public.can_access_institution(institution_id)
);

drop policy if exists class_curriculum_items_write_policy
  on public.class_curriculum_items;

create policy class_curriculum_items_write_policy
on public.class_curriculum_items
for insert
to authenticated
with check (
  public.can_manage_institution_operations(institution_id)
);

drop policy if exists class_curriculum_items_update_policy
  on public.class_curriculum_items;

create policy class_curriculum_items_update_policy
on public.class_curriculum_items
for update
to authenticated
using (
  public.can_manage_institution_operations(institution_id)
)
with check (
  public.can_manage_institution_operations(institution_id)
);

-- No delete policy — items are soft-deactivated via active = false.

notify pgrst, 'reload schema';

commit;
