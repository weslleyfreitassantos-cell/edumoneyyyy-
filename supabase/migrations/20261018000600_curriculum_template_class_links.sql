begin;

create table if not exists public.curriculum_template_classes (
  id uuid primary key default extensions.uuid_generate_v4(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  template_id uuid not null references public.curriculum_templates(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_template_classes_unique unique (template_id, class_id)
);

create index if not exists curriculum_template_classes_institution_idx
  on public.curriculum_template_classes (institution_id);

create index if not exists curriculum_template_classes_class_idx
  on public.curriculum_template_classes (class_id);

alter table public.curriculum_template_classes enable row level security;

drop policy if exists curriculum_template_classes_select_policy
  on public.curriculum_template_classes;
create policy curriculum_template_classes_select_policy
on public.curriculum_template_classes
for select
to authenticated
using (private.can_access_academic_institution(institution_id));

drop policy if exists curriculum_template_classes_write_policy
  on public.curriculum_template_classes;
create policy curriculum_template_classes_write_policy
on public.curriculum_template_classes
for all
to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

grant select on table public.curriculum_template_classes to authenticated;
grant all on table public.curriculum_template_classes to service_role;

create or replace function public.apply_curriculum_template(
  p_institution_id uuid,
  p_template_id uuid,
  p_class_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  class_item uuid;
  template_item record;
  applied_count integer := 0;
begin
  if not public.can_manage_institution_operations(p_institution_id) then
    raise exception 'INSTITUTION_OPERATION_FORBIDDEN' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.curriculum_templates template_row
    where template_row.id = p_template_id
      and template_row.institution_id = p_institution_id
      and template_row.active is true
  ) then
    raise exception 'CURRICULUM_TEMPLATE_SCOPE_MISMATCH';
  end if;

  foreach class_item in array p_class_ids loop
    if not exists (
      select 1
      from public.classes class_row
      where class_row.id = class_item
        and class_row.institution_id = p_institution_id
        and class_row.active is true
    ) then
      raise exception 'CLASS_SCOPE_MISMATCH';
    end if;

    for template_item in
      select *
      from public.curriculum_template_items
      where template_id = p_template_id
        and institution_id = p_institution_id
        and active is true
    loop
      insert into public.class_curriculum_items (
        institution_id,
        class_id,
        subject_id,
        weekly_lessons,
        lesson_duration_minutes,
        is_complementary,
        needs_review,
        active
      )
      values (
        p_institution_id,
        class_item,
        template_item.subject_id,
        template_item.weekly_lessons,
        template_item.lesson_duration_minutes,
        template_item.is_complementary,
        false,
        true
      )
      on conflict (class_id, subject_id) do update set
        weekly_lessons = excluded.weekly_lessons,
        lesson_duration_minutes = excluded.lesson_duration_minutes,
        is_complementary = excluded.is_complementary,
        active = true,
        needs_review = false,
        updated_at = now();

      if found then
        applied_count := applied_count + 1;
      end if;
    end loop;

    insert into public.curriculum_template_classes (
      institution_id,
      template_id,
      class_id,
      updated_at
    )
    values (p_institution_id, p_template_id, class_item, now())
    on conflict (template_id, class_id) do update set
      institution_id = excluded.institution_id,
      updated_at = now();
  end loop;

  return applied_count;
end;
$$;

revoke all on function public.apply_curriculum_template(uuid, uuid, uuid[])
  from public, anon;
grant execute on function public.apply_curriculum_template(uuid, uuid, uuid[])
  to authenticated, service_role;

-- Preserve the relationship for matrices applied before this migration when
-- the active class matrix still matches the saved template exactly.
insert into public.curriculum_template_classes (institution_id, template_id, class_id)
select template_row.institution_id, template_row.id, class_row.id
from public.curriculum_templates template_row
join public.classes class_row
  on class_row.institution_id = template_row.institution_id
where template_row.active is true
  and class_row.active is true
  and (
    select count(*)
    from public.curriculum_template_items template_item
    where template_item.institution_id = template_row.institution_id
      and template_item.template_id = template_row.id
      and template_item.active is true
  ) > 0
  and (
    select count(*)
    from public.curriculum_template_items template_item
    join public.class_curriculum_items class_item
      on class_item.institution_id = template_item.institution_id
     and class_item.subject_id = template_item.subject_id
     and class_item.weekly_lessons = template_item.weekly_lessons
     and class_item.lesson_duration_minutes = template_item.lesson_duration_minutes
     and class_item.is_complementary = template_item.is_complementary
    where template_item.institution_id = template_row.institution_id
      and template_item.template_id = template_row.id
      and template_item.active is true
      and class_item.class_id = class_row.id
      and class_item.active is true
  ) = (
    select count(*)
    from public.curriculum_template_items template_item
    where template_item.institution_id = template_row.institution_id
      and template_item.template_id = template_row.id
      and template_item.active is true
  )
  and (
    select count(*)
    from public.class_curriculum_items class_item
    where class_item.institution_id = class_row.institution_id
      and class_item.class_id = class_row.id
      and class_item.active is true
  ) = (
    select count(*)
    from public.curriculum_template_items template_item
    where template_item.institution_id = template_row.institution_id
      and template_item.template_id = template_row.id
      and template_item.active is true
  )
on conflict (template_id, class_id) do nothing;

commit;
