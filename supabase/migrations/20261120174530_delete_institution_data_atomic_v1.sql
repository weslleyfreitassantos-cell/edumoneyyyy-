begin;

create function public.delete_institution_data_atomic_v1(
  p_account_id uuid,
  p_institution_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_table text;
  v_table_oid oid;
  v_deleted bigint;
  v_summary jsonb := '{}'::jsonb;
  v_tables constant text[] := array[
    'learning_answers',
    'learning_attempts',
    'learning_skill_progress',
    'learning_student_skill_state',
    'learning_skill_reviews',
    'learning_evidence_attributions',
    'learning_misconception_signals',
    'learning_guided_step_attempts',
    'learning_guided_session_events',
    'learning_guided_steps',
    'learning_guided_sessions',
    'learning_attempt_run_answers',
    'learning_attempt_runs',
    'learning_daily_plan_items',
    'learning_daily_plans',
    'learning_error_notebook',
    'learning_package_progress',
    'learning_package_assignments',
    'learning_packages',
    'learning_simulation_attempts',
    'learning_simulations',
    'learning_question_bank',
    'learning_question_sets',
    'learning_question_skill_links',
    'learning_questions',
    'learning_assignments',
    'learning_activities',
    'learning_skill_canonical_links',
    'learning_skill_evidence',
    'learning_curriculum_subject_links',
    'learning_skills',
    'learning_units',
    'learning_student_gamification',
    'learning_gamification_events',
    'learning_resources',
    'learning_collections',
    'learning_posts',
    'timetable_version_entries',
    'timetable_versions',
    'timetable_entries',
    'school_schedule_breaks',
    'school_time_slots',
    'teacher_availability',
    'teacher_subjects',
    'institution_shift_settings',
    'student_term_results',
    'term_closures',
    'attendance_records',
    'grades',
    'attendance_sessions',
    'assessments',
    'class_curriculum_items',
    'subject_offerings',
    'enrollments',
    'guardianships',
    'rooms',
    'classes',
    'subjects',
    'terms',
    'academic_policies',
    'academic_years',
    'student_registration_counters',
    'students',
    'memberships',
    'institution_branding'
  ];
begin
  if p_account_id is null or p_institution_id is null then
    raise exception using errcode = '22023', message = 'INVALID_INSTITUTION_DELETE_SCOPE';
  end if;

  if not exists (
    select 1
      from public.institutions institution
     where institution.id = p_institution_id
       and institution.account_id = p_account_id
  ) then
    raise exception using errcode = 'P0002', message = 'INSTITUTION_NOT_FOUND';
  end if;

  foreach v_table in array v_tables loop
    v_summary := v_summary || pg_catalog.jsonb_build_object(v_table, 0);
    v_table_oid := pg_catalog.to_regclass(pg_catalog.format('public.%I', v_table));
    if v_table_oid is null then
      continue;
    end if;

    if not exists (
      select 1
        from pg_catalog.pg_attribute attribute
       where attribute.attrelid = v_table_oid
         and attribute.attname = 'institution_id'
         and attribute.attnum > 0
         and not attribute.attisdropped
    ) then
      -- Keep this omission inside the transaction. The final institution
      -- delete must either succeed or roll every earlier delete back.
      continue;
    end if;

    execute pg_catalog.format(
      'delete from public.%I where institution_id = $1',
      v_table
    ) using p_institution_id;
    get diagnostics v_deleted = row_count;
    v_summary := v_summary || pg_catalog.jsonb_build_object(v_table, v_deleted);
  end loop;

  delete from public.institutions institution
   where institution.id = p_institution_id
     and institution.account_id = p_account_id;
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then
    raise exception using errcode = 'P0002', message = 'INSTITUTION_NOT_FOUND';
  end if;

  return pg_catalog.jsonb_build_object(
    'institutionDeleted', true,
    'summary', v_summary
  );
end;
$function$;

alter function public.delete_institution_data_atomic_v1(uuid, uuid) owner to postgres;
revoke all on function public.delete_institution_data_atomic_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.delete_institution_data_atomic_v1(uuid, uuid)
  to service_role;

commit;
