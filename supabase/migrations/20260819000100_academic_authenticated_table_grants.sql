-- Explicit API privileges for the academic surfaces used by the frontend.
-- RLS policies remain responsible for tenant isolation and operation scope.

begin;

revoke all on table public.class_curriculum_items,
  public.teacher_subjects,
  public.teacher_availability,
  public.school_time_slots,
  public.curriculum_templates,
  public.curriculum_template_items,
  public.timetable_versions,
  public.timetable_version_entries,
  public.rooms,
  public.timetable_entries
  from anon;

grant select, insert, update on table public.class_curriculum_items
  to authenticated;

grant select, insert, update on table public.teacher_subjects
  to authenticated;

grant select, insert, update on table public.teacher_availability
  to authenticated;

grant select, insert, update on table public.school_time_slots
  to authenticated;

grant select, insert on table public.curriculum_templates
  to authenticated;

grant insert on table public.curriculum_template_items
  to authenticated;

grant select, insert on table public.timetable_versions
  to authenticated;

grant select, insert, update on table public.timetable_version_entries
  to authenticated;

grant select, insert, update on table public.rooms
  to authenticated;

grant select, insert, update on table public.timetable_entries
  to authenticated;

notify pgrst, 'reload schema';
commit;
