begin;

-- Production stores enrollment status as ACTIVE. Keep the v7 preview gate
-- restricted to the known demonstration identity and normalize only the
-- functions installed by the previous preview migration.
do $$
declare
  function_row record;
begin
  for function_row in
    select pg_get_functiondef(proc.oid) as definition
      from pg_proc proc
      join pg_namespace namespace
        on namespace.oid = proc.pronamespace
     where namespace.nspname in ('public', 'private')
       and proc.proname in (
         'list_student_guided_learning_targets',
         'assert_bncc_guided_session_scope',
         'start_guided_learning_session_v4',
         'assert_published_v4_session_target'
       )
       and pg_get_functiondef(proc.oid) like '%enrollment.status = ''active''%'
  loop
    execute replace(
      function_row.definition,
      'enrollment.status = ''active''',
      'upper(enrollment.status::text) = ''ACTIVE'''
    );
  end loop;
end;
$$;

do $$
declare
  candidate_count integer;
  candidate_institution_id uuid;
begin
  -- This is still deployment-controlled: the exact fictitious demo student,
  -- active first-year high-school enrollment and institution must resolve to
  -- one institution before the preview allowlist is enabled.
  select count(*)::integer,
         (array_agg(candidate.institution_id order by candidate.institution_id))[1]
    into candidate_count, candidate_institution_id
    from (
      select distinct student.institution_id
        from public.profiles profile
        join public.students student
          on student.profile_id = profile.id
         and student.active
        join public.enrollments enrollment
          on enrollment.student_id = student.id
         and enrollment.active
         and upper(enrollment.status::text) = 'ACTIVE'
        join public.classes class
          on class.id = enrollment.class_id
         and class.institution_id = student.institution_id
         and class.active
        cross join lateral private.normalize_learning_grade_context(class.grade_level) normalized(value)
       where lower(trim(profile.full_name)) = lower('Laura Cristina Moreira Azevedo')
         and upper(coalesce(profile.role::text, '')) = 'STUDENT'
         and profile.active
         and normalized.value->>'stage' = 'ENSINO_MEDIO'
         and nullif(normalized.value->>'grade_level', '')::smallint = 1
    ) candidate;

  if candidate_count = 1 then
    insert into private.bncc_demo_preview_institutions(institution_id)
    values (candidate_institution_id)
    on conflict (institution_id) do update
      set active = true,
          preview_code = excluded.preview_code;
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
