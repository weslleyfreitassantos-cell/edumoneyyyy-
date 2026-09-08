-- Consolidate the overview metrics into one database round trip.
create or replace function public.get_admin_overview_fast(p_institution_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.can_manage_institution_operations(p_institution_id) then
    raise exception 'ADMIN_OVERVIEW_FORBIDDEN' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'active_students', (select count(*) from public.students where institution_id = p_institution_id and coalesce(active, true)),
    'inactive_students', (select count(*) from public.students where institution_id = p_institution_id and not coalesce(active, true)),
    'active_teachers', (select count(*) from public.memberships where institution_id = p_institution_id and role = 'TEACHER' and coalesce(active, true)),
    'active_guardians', (select count(distinct g.guardian_profile_id) from public.guardianships g join public.students s on s.id = g.student_id where s.institution_id = p_institution_id and coalesce(g.active, true)),
    'active_classes', (select count(*) from public.classes where institution_id = p_institution_id and coalesce(active, true)),
    'active_subjects', (select count(*) from public.subjects where institution_id = p_institution_id and coalesce(active, true)),
    'active_enrollments', (select count(*) from public.enrollments e join public.students s on s.id = e.student_id join public.classes c on c.id = e.class_id where s.institution_id = p_institution_id and c.institution_id = p_institution_id and coalesce(e.active, true)),
    'active_assignments', (select count(*) from public.subject_offerings o join public.classes c on c.id = o.class_id join public.subjects s on s.id = o.subject_id where c.institution_id = p_institution_id and s.institution_id = p_institution_id and coalesce(o.active, true)),
    'active_curriculum_items', (select count(*) from public.class_curriculum_items i where i.institution_id = p_institution_id and coalesce(i.active, true)),
    'curriculum_items_needing_review', (select count(*) from public.class_curriculum_items i where i.institution_id = p_institution_id and i.needs_review)
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_admin_overview_fast(uuid) from public, anon;
grant execute on function public.get_admin_overview_fast(uuid) to authenticated;
