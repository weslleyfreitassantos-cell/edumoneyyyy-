begin;

-- Account ownership remains intentionally broader than academic operation.
-- ADMIN owns the commercial account, but only operational institution roles
-- may read or manage the school's academic records.
create or replace function public.is_institution_admin(
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_current_profile_active()
    and public.is_institution_operational(target_institution_id)
    and (
      public.is_platform_super_admin()
      or exists (
        select 1
        from public.memberships as membership
        where membership.profile_id = auth.uid()
          and membership.institution_id = target_institution_id
          and membership.active is true
          and membership.role = any (
            array[
              'DIRECTOR'::public.user_role,
              'SECRETARY'::public.user_role
            ]
          )
      )
    );
$$;

-- This helper is only referenced by academic/operational school policies and
-- RPCs. Keep can_access_institution unchanged for account-owned institutions.
create or replace function public.can_manage_institution_operations(
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_institution_admin(target_institution_id);
$$;

-- has_institution_role is retained for legacy call sites, but ADMIN is not an
-- academic role even when an old membership still carries that value.
create or replace function private.has_institution_role(
  target_institution_id uuid,
  allowed_roles public.user_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_current_profile_active()
    and public.is_institution_operational(target_institution_id)
    and (
      exists (
        select 1
        from public.memberships as membership
        where membership.profile_id = auth.uid()
          and membership.institution_id = target_institution_id
          and membership.active is true
          and membership.role <> 'ADMIN'::public.user_role
          and membership.role = any (allowed_roles)
      )
      or (
        (
          'ADMIN'::public.user_role = any (allowed_roles)
          or 'DIRECTOR'::public.user_role = any (allowed_roles)
        )
        and public.is_institution_admin(target_institution_id)
      )
    );
$$;

create or replace function private.can_access_academic_institution(
  target_institution_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_current_profile_active()
    and public.is_institution_operational(target_institution_id)
    and (
      public.is_platform_super_admin()
      or exists (
        select 1
        from public.memberships as membership
        where membership.profile_id = auth.uid()
          and membership.institution_id = target_institution_id
          and membership.active is true
          and membership.role = any (
            array[
              'DIRECTOR'::public.user_role,
              'SECRETARY'::public.user_role,
              'TEACHER'::public.user_role,
              'STUDENT'::public.user_role,
              'GUARDIAN'::public.user_role
            ]
          )
      )
    );
$$;

alter function public.is_institution_admin(uuid) owner to postgres;
alter function public.can_manage_institution_operations(uuid) owner to postgres;
alter function private.has_institution_role(uuid, public.user_role[]) owner to postgres;
alter function private.can_access_academic_institution(uuid) owner to postgres;

revoke all on function private.can_access_academic_institution(uuid)
  from public, anon, authenticated;
grant execute on function private.can_access_academic_institution(uuid)
  to authenticated, service_role;

-- ADMIN keeps account/institution metadata and only the DIRECTOR identity
-- needed for the explicit ADMIN -> DIRECTOR management flow.
drop policy if exists profiles_select_policy on public.profiles;
create policy profiles_select_policy
on public.profiles
for select
to authenticated
using (
  private.is_current_profile_active()
  and (
    id = auth.uid()
    or public.is_platform_super_admin()
    or exists (
      select 1
      from public.memberships as membership
      where membership.profile_id = profiles.id
        and (
          private.has_exact_institution_role(
            membership.institution_id,
            array['DIRECTOR', 'SECRETARY']::public.user_role[]
          )
          or (
            membership.role = 'DIRECTOR'::public.user_role
            and public.owns_institution(membership.institution_id)
          )
        )
    )
  )
);

drop policy if exists memberships_select_policy on public.memberships;
create policy memberships_select_policy
on public.memberships
for select
to authenticated
using (
  private.is_current_profile_active()
  and (
    profile_id = auth.uid()
    or public.is_platform_super_admin()
    or private.has_exact_institution_role(
      memberships.institution_id,
      array['DIRECTOR', 'SECRETARY']::public.user_role[]
    )
    or (
      memberships.role = 'DIRECTOR'::public.user_role
      and public.owns_institution(memberships.institution_id)
    )
  )
);

drop policy if exists students_select_policy on public.students;
create policy students_select_policy
on public.students
for select
to authenticated
using (
  private.is_current_profile_active()
  and (
    public.can_manage_institution_operations(institution_id)
    or profile_id = auth.uid()
    or private.is_guardian_of_student(id)
  )
);

drop policy if exists students_update_policy on public.students;
create policy students_update_policy
on public.students
for update
to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists guardianships_select_policy on public.guardianships;
create policy guardianships_select_policy
on public.guardianships
for select
to authenticated
using (
  private.is_current_profile_active()
  and (
    guardian_profile_id = auth.uid()
    or private.can_manage_student(student_id)
  )
);

drop policy if exists guardianships_update_policy on public.guardianships;
create policy guardianships_update_policy
on public.guardianships
for update
to authenticated
using (private.can_manage_student(student_id))
with check (private.can_manage_student(student_id));

drop policy if exists academic_years_select_policy on public.academic_years;
create policy academic_years_select_policy
on public.academic_years
for select
to authenticated
using (private.can_access_academic_institution(institution_id));

drop policy if exists academic_years_write_policy on public.academic_years;
create policy academic_years_write_policy
on public.academic_years
for all
to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists terms_select_policy on public.terms;
create policy terms_select_policy
on public.terms
for select
to authenticated
using (
  exists (
    select 1
    from public.academic_years as academic_year
    where academic_year.id = terms.academic_year_id
      and private.can_access_academic_institution(academic_year.institution_id)
  )
);

drop policy if exists terms_write_policy on public.terms;
create policy terms_write_policy
on public.terms
for all
to authenticated
using (
  exists (
    select 1
    from public.academic_years as academic_year
    where academic_year.id = terms.academic_year_id
      and public.can_manage_institution_operations(academic_year.institution_id)
  )
)
with check (
  exists (
    select 1
    from public.academic_years as academic_year
    where academic_year.id = terms.academic_year_id
      and public.can_manage_institution_operations(academic_year.institution_id)
  )
);

drop policy if exists classes_select_policy on public.classes;
create policy classes_select_policy
on public.classes
for select
to authenticated
using (private.can_access_academic_institution(institution_id));

drop policy if exists classes_write_policy on public.classes;
create policy classes_write_policy
on public.classes
for all
to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists subjects_select_policy on public.subjects;
create policy subjects_select_policy
on public.subjects
for select
to authenticated
using (private.can_access_academic_institution(institution_id));

drop policy if exists subjects_write_policy on public.subjects;
create policy subjects_write_policy
on public.subjects
for all
to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists class_curriculum_items_select_policy on public.class_curriculum_items;
create policy class_curriculum_items_select_policy
on public.class_curriculum_items
for select
to authenticated
using (private.can_access_academic_institution(institution_id));

drop policy if exists class_curriculum_items_write_policy on public.class_curriculum_items;
create policy class_curriculum_items_write_policy
on public.class_curriculum_items
for insert
to authenticated
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists class_curriculum_items_update_policy on public.class_curriculum_items;
create policy class_curriculum_items_update_policy
on public.class_curriculum_items
for update
to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists enrollments_select_policy on public.enrollments;
create policy enrollments_select_policy
on public.enrollments
for select
to authenticated
using (
  exists (
    select 1
    from public.classes as class
    join public.students as student
      on student.id = enrollments.student_id
    where class.id = enrollments.class_id
      and class.institution_id = student.institution_id
      and private.can_access_academic_institution(class.institution_id)
  )
);

drop policy if exists enrollments_write_policy on public.enrollments;
create policy enrollments_write_policy
on public.enrollments
for all
to authenticated
using (
  exists (
    select 1
    from public.classes as class
    where class.id = enrollments.class_id
      and public.can_manage_institution_operations(class.institution_id)
  )
)
with check (
  exists (
    select 1
    from public.classes as class
    where class.id = enrollments.class_id
      and public.can_manage_institution_operations(class.institution_id)
  )
);

drop policy if exists subject_offerings_select_policy on public.subject_offerings;
create policy subject_offerings_select_policy
on public.subject_offerings
for select
to authenticated
using (
  private.is_current_profile_active()
  and (
    teacher_profile_id = auth.uid()
    or exists (
      select 1
      from public.classes as class
      where class.id = subject_offerings.class_id
        and private.can_access_academic_institution(class.institution_id)
    )
  )
);

drop policy if exists subject_offerings_write_policy on public.subject_offerings;
create policy subject_offerings_write_policy
on public.subject_offerings
for all
to authenticated
using (
  exists (
    select 1
    from public.classes as class
    where class.id = subject_offerings.class_id
      and public.can_manage_institution_operations(class.institution_id)
  )
)
with check (
  exists (
    select 1
    from public.classes as class
    where class.id = subject_offerings.class_id
      and public.can_manage_institution_operations(class.institution_id)
  )
);

drop policy if exists rooms_select_policy on public.rooms;
create policy rooms_select_policy
on public.rooms
for select
to authenticated
using (private.can_access_academic_institution(institution_id));

drop policy if exists rooms_write_policy on public.rooms;
create policy rooms_write_policy
on public.rooms
for insert
to authenticated
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists rooms_update_policy on public.rooms;
create policy rooms_update_policy
on public.rooms
for update
to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists teacher_subjects_select_policy on public.teacher_subjects;
create policy teacher_subjects_select_policy
on public.teacher_subjects
for select
to authenticated
using (private.can_access_academic_institution(institution_id));

drop policy if exists teacher_subjects_write_policy on public.teacher_subjects;
create policy teacher_subjects_write_policy
on public.teacher_subjects
for all
to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists teacher_availability_select_policy on public.teacher_availability;
create policy teacher_availability_select_policy
on public.teacher_availability
for select
to authenticated
using (private.can_access_academic_institution(institution_id));

drop policy if exists teacher_availability_write_policy on public.teacher_availability;
create policy teacher_availability_write_policy
on public.teacher_availability
for all
to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists school_time_slots_select_policy on public.school_time_slots;
create policy school_time_slots_select_policy
on public.school_time_slots
for select
to authenticated
using (private.can_access_academic_institution(institution_id));

drop policy if exists school_time_slots_write_policy on public.school_time_slots;
create policy school_time_slots_write_policy
on public.school_time_slots
for all
to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists curriculum_templates_select_policy on public.curriculum_templates;
create policy curriculum_templates_select_policy
on public.curriculum_templates
for select
to authenticated
using (private.can_access_academic_institution(institution_id));

drop policy if exists curriculum_templates_write_policy on public.curriculum_templates;
create policy curriculum_templates_write_policy
on public.curriculum_templates
for all
to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists curriculum_templates_delete_policy on public.curriculum_templates;
create policy curriculum_templates_delete_policy
on public.curriculum_templates
for delete
to authenticated
using (public.can_manage_institution_operations(institution_id));

drop policy if exists curriculum_template_items_select_policy on public.curriculum_template_items;
create policy curriculum_template_items_select_policy
on public.curriculum_template_items
for select
to authenticated
using (private.can_access_academic_institution(institution_id));

drop policy if exists curriculum_template_items_write_policy on public.curriculum_template_items;
create policy curriculum_template_items_write_policy
on public.curriculum_template_items
for all
to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists timetable_entries_select_policy on public.timetable_entries;
create policy timetable_entries_select_policy
on public.timetable_entries
for select
to authenticated
using (private.can_access_academic_institution(institution_id));

drop policy if exists timetable_entries_write_policy on public.timetable_entries;
create policy timetable_entries_write_policy
on public.timetable_entries
for insert
to authenticated
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists timetable_entries_update_policy on public.timetable_entries;
create policy timetable_entries_update_policy
on public.timetable_entries
for update
to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists timetable_versions_select_policy on public.timetable_versions;
create policy timetable_versions_select_policy
on public.timetable_versions
for select
to authenticated
using (private.can_access_academic_institution(institution_id));

drop policy if exists timetable_versions_write_policy on public.timetable_versions;
create policy timetable_versions_write_policy
on public.timetable_versions
for all
to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists timetable_version_entries_select_policy on public.timetable_version_entries;
create policy timetable_version_entries_select_policy
on public.timetable_version_entries
for select
to authenticated
using (private.can_access_academic_institution(institution_id));

drop policy if exists timetable_version_entries_write_policy on public.timetable_version_entries;
create policy timetable_version_entries_write_policy
on public.timetable_version_entries
for all
to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists school_schedule_breaks_select_policy on public.school_schedule_breaks;
create policy school_schedule_breaks_select_policy
on public.school_schedule_breaks
for select
to authenticated
using (private.can_access_academic_institution(institution_id));

drop policy if exists school_schedule_breaks_write_policy on public.school_schedule_breaks;
create policy school_schedule_breaks_write_policy
on public.school_schedule_breaks
for all
to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists institution_shift_settings_select_policy on public.institution_shift_settings;
create policy institution_shift_settings_select_policy
on public.institution_shift_settings
for select
to authenticated
using (private.can_access_academic_institution(institution_id));

drop policy if exists institution_shift_settings_insert_policy on public.institution_shift_settings;
create policy institution_shift_settings_insert_policy
on public.institution_shift_settings
for insert
to authenticated
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists institution_shift_settings_update_policy on public.institution_shift_settings;
create policy institution_shift_settings_update_policy
on public.institution_shift_settings
for update
to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists academic_policies_select_policy on public.academic_policies;
create policy academic_policies_select_policy
on public.academic_policies
for select
to authenticated
using (private.can_access_academic_institution(institution_id));

drop policy if exists academic_policies_insert_policy on public.academic_policies;
create policy academic_policies_insert_policy
on public.academic_policies
for insert
to authenticated
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists academic_policies_update_policy on public.academic_policies;
create policy academic_policies_update_policy
on public.academic_policies
for update
to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists term_closures_select_policy on public.term_closures;
create policy term_closures_select_policy
on public.term_closures
for select
to authenticated
using (
  public.can_manage_institution_operations(institution_id)
  or private.is_teacher_for_offering(subject_offering_id, institution_id)
);

drop policy if exists academic_calendar_events_staff_select
  on public.academic_calendar_events;
create policy academic_calendar_events_staff_select
on public.academic_calendar_events
for select
to authenticated
using (public.can_manage_institution_operations(institution_id));

drop policy if exists academic_calendar_events_staff_insert
  on public.academic_calendar_events;
create policy academic_calendar_events_staff_insert
on public.academic_calendar_events
for insert
to authenticated
with check (
  public.can_manage_institution_operations(institution_id)
  and created_by = auth.uid()
);

drop policy if exists academic_calendar_events_staff_update
  on public.academic_calendar_events;
create policy academic_calendar_events_staff_update
on public.academic_calendar_events
for update
to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

-- The staff policies for sensitive enrollment details use the same strict
-- operational boundary; students/guardians keep their dedicated paths.
drop policy if exists student_registration_details_staff_select
  on public.student_registration_details;
create policy student_registration_details_staff_select
on public.student_registration_details
for select
to authenticated
using (public.can_manage_institution_operations(institution_id));

drop policy if exists student_registration_details_staff_write
  on public.student_registration_details;
create policy student_registration_details_staff_write
on public.student_registration_details
for all
to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists student_addresses_staff_access on public.student_addresses;
create policy student_addresses_staff_access
on public.student_addresses
for all
to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists student_previous_schooling_staff_access
  on public.student_previous_schooling;
create policy student_previous_schooling_staff_access
on public.student_previous_schooling
for all
to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists student_health_information_staff_access
  on public.student_health_information;
create policy student_health_information_staff_access
on public.student_health_information
for all
to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

drop policy if exists student_documents_staff_access on public.student_documents;
create policy student_documents_staff_access
on public.student_documents
for all
to authenticated
using (public.can_manage_institution_operations(institution_id))
with check (public.can_manage_institution_operations(institution_id));

-- Learning reference tables were among the remaining direct can_access/
-- is_institution_admin call sites. Teacher/student-specific learning policies
-- remain unchanged.
drop policy if exists learning_units_select on public.learning_units;
create policy learning_units_select
on public.learning_units
for select
using (private.can_access_academic_institution(institution_id));

drop policy if exists learning_units_write on public.learning_units;
create policy learning_units_write
on public.learning_units
for all
using (
  public.can_manage_institution_operations(institution_id)
  or (
    private.learning_is_teacher(institution_id)
    and private.learning_teacher_owns_subject(institution_id, subject_id)
  )
)
with check (
  public.can_manage_institution_operations(institution_id)
  or (
    private.learning_is_teacher(institution_id)
    and private.learning_teacher_owns_subject(institution_id, subject_id)
  )
);

drop policy if exists learning_skills_select on public.learning_skills;
create policy learning_skills_select
on public.learning_skills
for select
using (private.can_access_academic_institution(institution_id));

drop policy if exists learning_skills_write on public.learning_skills;
create policy learning_skills_write
on public.learning_skills
for all
using (
  public.can_manage_institution_operations(institution_id)
  or (
    private.learning_is_teacher(institution_id)
    and exists (
      select 1
      from public.learning_units as unit
      where unit.id = unit_id
        and unit.institution_id = institution_id
        and private.learning_teacher_owns_subject(institution_id, unit.subject_id)
    )
  )
)
with check (
  public.can_manage_institution_operations(institution_id)
  or (
    private.learning_is_teacher(institution_id)
    and exists (
      select 1
      from public.learning_units as unit
      where unit.id = unit_id
        and unit.institution_id = institution_id
        and private.learning_teacher_owns_subject(institution_id, unit.subject_id)
    )
  )
);

-- Keep the existing account-owner overview route available. RLS now returns
-- only rows visible to the actor, so ADMIN sees metadata without academic rows.
create or replace function public.get_admin_overview_fast(p_institution_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.can_access_institution(p_institution_id) then
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

-- Workload and calendar-blocker RPCs are explicit API boundaries. Keep their
-- existing validation and result shape, but remove the generic ownership path.
create or replace function public.get_academic_day_blockers(
  p_institution_id uuid,
  p_date date,
  p_academic_year_id uuid default null,
  p_class_id uuid default null,
  p_subject_id uuid default null
)
returns table (
  event_id uuid,
  event_type public.academic_calendar_event_type
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Autenticação necessária.';
  end if;

  if not private.can_access_academic_institution(p_institution_id) then
    raise exception using errcode = '42501', message = 'Sem acesso à instituição informada.';
  end if;

  return query
    select blockers.event_id, blockers.event_type
    from private.academic_day_blockers(
      p_institution_id,
      p_date,
      p_academic_year_id,
      p_class_id,
      p_subject_id
    ) as blockers;
end;
$$;

create or replace function public.get_subject_offering_workload_progress(
  p_institution_id uuid,
  p_subject_offering_id uuid,
  p_reference_date date default current_date
)
returns table (
  subject_offering_id uuid,
  term_start_date date,
  term_end_date date,
  reference_date date,
  planned_occurrences bigint,
  planned_occurrences_to_date bigint,
  suspended_occurrences bigint,
  delivered_sessions bigint,
  planned_minutes bigint,
  planned_minutes_to_date bigint,
  delivered_minutes bigint,
  completion_percent numeric,
  delivery_vs_plan_to_date_percent numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Autenticação necessária.';
  end if;

  if not private.can_access_academic_institution(p_institution_id) then
    raise exception using errcode = '42501', message = 'Sem acesso à instituição informada.';
  end if;

  if not (
    public.can_manage_institution_operations(p_institution_id)
    or private.is_teacher_for_offering(p_subject_offering_id, p_institution_id)
  ) then
    raise exception using errcode = '42501', message = 'Sem permissão para consultar a carga horária desta atribuição.';
  end if;

  if not exists (
    select 1
    from public.subject_offerings as offering
    join public.classes as class_record on class_record.id = offering.class_id
    join public.subjects as subject_record on subject_record.id = offering.subject_id
    where offering.id = p_subject_offering_id
      and class_record.institution_id = p_institution_id
      and subject_record.institution_id = p_institution_id
      and offering.active is true
  ) then
    raise exception using errcode = 'P0002', message = 'A atribuição selecionada não foi encontrada.';
  end if;

  return query
    select progress.*
    from private.subject_offering_workload_progress(
      p_institution_id,
      p_subject_offering_id,
      p_reference_date
    ) as progress;
end;
$$;

alter function private.is_admin_or_director(uuid) owner to postgres;
alter function private.can_manage_student(uuid) owner to postgres;
alter function private.can_view_attendance_institution(uuid) owner to postgres;
alter function private.can_view_grades_institution(uuid) owner to postgres;
alter function private.can_view_student_term_result(uuid, uuid) owner to postgres;

notify pgrst, 'reload schema';
commit;
