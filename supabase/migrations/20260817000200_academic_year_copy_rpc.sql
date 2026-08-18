-- Copy only academic structure between years. Students, enrollments, grades,
-- attendance and report data are intentionally excluded.

begin;

create or replace function public.copy_academic_year_structure(
  p_institution_id uuid,
  p_source_year_id uuid,
  p_target_year_id uuid,
  p_copy_teachers boolean default false,
  p_copy_rooms boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_class record;
  source_item record;
  source_offering record;
  source_room record;
  source_slot record;
  target_class_id uuid;
  target_term_id uuid;
  copied_classes integer := 0;
  copied_items integer := 0;
  copied_offerings integer := 0;
  copied_rooms integer := 0;
  copied_slots integer := 0;
begin
  if not public.is_institution_admin(p_institution_id) then
    raise exception 'INSTITUTION_OPERATION_FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from public.academic_years y where y.id = p_source_year_id and y.institution_id = p_institution_id) then raise exception 'SOURCE_YEAR_SCOPE_MISMATCH'; end if;
  if not exists (select 1 from public.academic_years y where y.id = p_target_year_id and y.institution_id = p_institution_id and y.id <> p_source_year_id) then raise exception 'TARGET_YEAR_SCOPE_MISMATCH'; end if;

  create temporary table academic_class_copy_map (
    source_class_id uuid primary key,
    target_class_id uuid not null
  ) on commit drop;

  for source_class in select * from public.classes where institution_id = p_institution_id and academic_year_id = p_source_year_id and active is true order by id loop
    insert into public.classes (institution_id, academic_year_id, name, grade_level, shift, capacity, active)
    values (p_institution_id, p_target_year_id, source_class.name, source_class.grade_level, source_class.shift, source_class.capacity, source_class.active)
    returning id into target_class_id;
    insert into academic_class_copy_map values (source_class.id, target_class_id);
    copied_classes := copied_classes + 1;

    for source_item in select * from public.class_curriculum_items where institution_id = p_institution_id and class_id = source_class.id and active is true loop
      insert into public.class_curriculum_items (institution_id, class_id, subject_id, weekly_lessons, lesson_duration_minutes, needs_review, active)
      values (p_institution_id, target_class_id, source_item.subject_id, source_item.weekly_lessons, source_item.lesson_duration_minutes, source_item.needs_review, source_item.active)
      on conflict (class_id, subject_id) do nothing;
      copied_items := copied_items + 1;
    end loop;

    if p_copy_teachers then
      for source_offering in
        select so.*, row_number() over (partition by so.class_id, so.subject_id order by source_term.start_date) as term_position
        from public.subject_offerings so
        join public.terms source_term on source_term.id = so.term_id
        where so.class_id = source_class.id and so.active is true
        order by so.subject_id, source_term.start_date
      loop
        select target_term.id into target_term_id
        from public.terms target_term
        where target_term.academic_year_id = p_target_year_id
          and target_term.active is true
        order by target_term.start_date
        offset source_offering.term_position - 1 limit 1;

        if target_term_id is not null and exists (
          select 1 from public.teacher_subjects ts
          join public.memberships m on m.profile_id = ts.teacher_profile_id and m.institution_id = p_institution_id and m.role = 'TEACHER'::public.user_role and m.active is true
          where ts.institution_id = p_institution_id and ts.teacher_profile_id = source_offering.teacher_profile_id and ts.subject_id = source_offering.subject_id and ts.active is true
        ) then
          insert into public.subject_offerings (class_id, subject_id, teacher_profile_id, term_id, active)
          values (target_class_id, source_offering.subject_id, source_offering.teacher_profile_id, target_term_id, true)
          on conflict do nothing;
          if found then copied_offerings := copied_offerings + 1; end if;
        end if;
      end loop;
    end if;
  end loop;

  if p_copy_rooms then
    for source_room in select * from public.rooms where institution_id = p_institution_id and active is true loop
      insert into public.rooms (institution_id, name, code, capacity, active)
      values (p_institution_id, source_room.name, source_room.code, source_room.capacity, true);
      copied_rooms := copied_rooms + 1;
    end loop;
  end if;

  if p_copy_rooms then
    for source_slot in select * from public.school_time_slots where institution_id = p_institution_id and active is true loop
      insert into public.school_time_slots (institution_id, shift, day_of_week, slot_number, start_time, end_time, active)
      values (p_institution_id, source_slot.shift, source_slot.day_of_week, source_slot.slot_number, source_slot.start_time, source_slot.end_time, true)
      on conflict (institution_id, shift, day_of_week, slot_number) do nothing;
      if found then copied_slots := copied_slots + 1; end if;
    end loop;
  end if;

  return jsonb_build_object('classes', copied_classes, 'curriculum_items', copied_items, 'suggested_offerings', copied_offerings, 'rooms', copied_rooms, 'time_slots', copied_slots);
end;
$$;

revoke all on function public.copy_academic_year_structure(uuid, uuid, uuid, boolean, boolean) from public, anon;
grant execute on function public.copy_academic_year_structure(uuid, uuid, uuid, boolean, boolean) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
