begin;

-- Template deletion is physical; its items are removed by the existing cascade.
grant delete on table public.curriculum_templates to authenticated;

drop policy if exists curriculum_templates_delete_policy on public.curriculum_templates;
create policy curriculum_templates_delete_policy
on public.curriculum_templates
for delete
to authenticated
using (public.can_manage_institution_operations(institution_id));

notify pgrst, 'reload schema';
commit;
