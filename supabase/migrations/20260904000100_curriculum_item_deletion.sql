-- Allow a school manager to permanently remove an item from a class curriculum.
-- Active assignments and published lessons keep the item protected so deleting
-- a mistaken row cannot orphan operational or currently visible schedule data.

begin;

create or replace function private.validate_curriculum_item_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.subject_offerings as offering
    where offering.class_id = old.class_id
      and offering.subject_id = old.subject_id
      and offering.active is true
  ) then
    raise exception
      'CURRICULUM_COMPONENT_HAS_ACTIVE_OFFERINGS'
      using hint = 'Deactivate the assignments first, then delete the curriculum item.';
  end if;

  if exists (
    select 1
    from public.timetable_entries as timetable_entry
    join public.subject_offerings as offering
      on offering.id = timetable_entry.subject_offering_id
    where offering.class_id = old.class_id
      and offering.subject_id = old.subject_id
      and timetable_entry.active is true
  ) then
    raise exception
      'CURRICULUM_COMPONENT_HAS_ACTIVE_TIMETABLE_ENTRIES'
      using hint = 'Remove the published timetable lessons first, then delete the curriculum item.';
  end if;

  return old;
end;
$$;

drop trigger if exists class_curriculum_items_check_deletion
  on public.class_curriculum_items;

create trigger class_curriculum_items_check_deletion
before delete on public.class_curriculum_items
for each row
execute function private.validate_curriculum_item_deletion();

revoke all on function private.validate_curriculum_item_deletion()
  from public, anon, authenticated;

grant execute on function private.validate_curriculum_item_deletion()
  to service_role;

drop policy if exists class_curriculum_items_delete_policy
  on public.class_curriculum_items;

create policy class_curriculum_items_delete_policy
on public.class_curriculum_items
for delete
to authenticated
using (
  public.can_manage_institution_operations(institution_id)
);

grant delete on table public.class_curriculum_items
  to authenticated;

notify pgrst, 'reload schema';

commit;
