-- Mantém a autorização no banco e elimina a divergência entre as telas de seleção.
create or replace function private.learning_can_assign_activity(
  target_activity_id uuid,
  target_institution_id uuid,
  target_class_id uuid
)
returns boolean language sql stable security definer set search_path = public, private
as $$
  select exists (
    select 1
    from public.learning_activities a
    where a.id = target_activity_id
      and a.institution_id = target_institution_id
      and a.teacher_id = auth.uid()
      and private.learning_teacher_owns_subject_class(
        target_institution_id,
        a.subject_id,
        target_class_id
      )
  );
$$;

drop policy if exists learning_assignments_insert on public.learning_assignments;
create policy learning_assignments_insert on public.learning_assignments
for insert with check (
  assigned_by = auth.uid()
  and private.learning_can_assign_activity(activity_id, institution_id, class_id)
);
