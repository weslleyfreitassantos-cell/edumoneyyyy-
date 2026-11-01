-- Runs against the disposable PostgreSQL after the full repository migration set.
-- V8 publishes the exact technical catalog; institutional access stays disabled.
do $tec_idiomas_v8_publication_test$
declare
  expected record;
  v_units integer;
  v_lessons integer;
  v_exercises integer;
  v_fingerprint text;
  v_events integer;
begin
  for expected in
    select * from (values
      ('TEC_ENGLISH_FOUNDATIONS', 1, 3, 12, 84, '71b020e233fa23dcc6a5316d50433d43'),
      ('TEC_ENGLISH_FOUNDATIONS_V2', 4, 2, 8, 56, '66944522eafc1e5c8b6a8f64747fe963'),
      ('TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', 1, 4, 16, 112, '7364e2f7e460e0547b71d27fb802cf8a'),
      ('TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER', 1, 4, 16, 76, 'e88be160e84a605b7b2be5348db65038'),
      ('TEC_KOREAN_FOUNDATIONS_V1', 1, 2, 8, 56, '4ec9dff599c82a8bd6ef39c3c31f577d'),
      ('TEC_KOREAN_FOUNDATIONS_V2_BEGINNER', 1, 4, 16, 72, '308116e9fb684b4df75ddebdcb418c86'),
      ('TEC_SPANISH_FOUNDATIONS_V1', 1, 2, 8, 56, '9867948cfbb963887dfb5de12f644a6d'),
      ('TEC_SPANISH_FOUNDATIONS_V2_BEGINNER', 1, 4, 16, 76, 'f5fb9c9c9ebe4f9fa1453791a2e0d7fe')
    ) as item(course_code, content_version, unit_count, lesson_count, exercise_count, fingerprint)
  loop
    if not exists (
      select 1 from public.tec_english_courses course
       where course.course_code = expected.course_code
         and course.content_version = expected.content_version
         and not course.is_test_fixture
         and course.publication_status = 'PUBLISHED'
    ) then
      raise exception 'V8 expected technical publication: %', expected.course_code;
    end if;
    select count(*)::integer into v_units
      from public.tec_english_units unit
     where unit.course_code = expected.course_code
       and unit.content_version = expected.content_version;
    select count(*)::integer into v_lessons
      from public.tec_english_lessons lesson
      join public.tec_english_units unit on unit.id = lesson.unit_id
     where unit.course_code = expected.course_code
       and unit.content_version = expected.content_version;
    select count(*)::integer into v_exercises
      from public.tec_english_exercises exercise
      join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id
      join public.tec_english_units unit on unit.id = lesson.unit_id
     where unit.course_code = expected.course_code
       and unit.content_version = expected.content_version;
    if (v_units, v_lessons, v_exercises) is distinct from
       (expected.unit_count, expected.lesson_count, expected.exercise_count) then
      raise exception 'V8 content counts differ for %: %, %, %', expected.course_code, v_units, v_lessons, v_exercises;
    end if;
    if exists (
      select 1 from public.tec_english_units unit
       where unit.course_code = expected.course_code
         and unit.content_version = expected.content_version
         and unit.publication_status <> 'PUBLISHED'
    ) or exists (
      select 1 from public.tec_english_lessons lesson
      join public.tec_english_units unit on unit.id = lesson.unit_id
       where unit.course_code = expected.course_code
         and unit.content_version = expected.content_version
         and (lesson.content_version <> unit.content_version
           or lesson.publication_status <> 'PUBLISHED')
    ) or exists (
      select 1 from public.tec_english_exercises exercise
      join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id
      join public.tec_english_units unit on unit.id = lesson.unit_id
       where unit.course_code = expected.course_code
         and unit.content_version = expected.content_version
         and (lesson.content_version <> unit.content_version
           or exercise.content_version <> lesson.content_version
           or exercise.publication_status <> 'PUBLISHED')
    ) then
      raise exception 'V8 child technical or review status differs for %', expected.course_code;
    end if;
    select private.tec_english_course_fingerprint(expected.course_code, expected.content_version)
      into v_fingerprint;
    if v_fingerprint is distinct from expected.fingerprint then
      raise exception 'V8 content fingerprint differs for %', expected.course_code;
    end if;
  end loop;

  select count(*)::integer into v_events
    from private.tec_english_technical_publication_events event
   where event.source_migration = '20261030000200';
  if v_events <> 8 then raise exception 'V8 publication audit has % rows instead of 8', v_events; end if;

  if exists (
    select 1 from public.tec_english_course_releases release
     where release.course_code in (
       'TEC_ENGLISH_FOUNDATIONS', 'TEC_ENGLISH_FOUNDATIONS_V2', 'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION',
       'TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER', 'TEC_KOREAN_FOUNDATIONS_V1', 'TEC_KOREAN_FOUNDATIONS_V2_BEGINNER',
       'TEC_SPANISH_FOUNDATIONS_V1', 'TEC_SPANISH_FOUNDATIONS_V2_BEGINNER'
     ) and release.enabled
  ) then
    raise exception 'V8 publication migration unexpectedly enabled an institution';
  end if;

  if not (select relation.relrowsecurity
            from pg_catalog.pg_class relation
            join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
           where namespace.nspname = 'private'
             and relation.relname = 'tec_english_technical_publication_events') then
    raise exception 'V8 technical publication audit RLS is disabled';
  end if;
  if has_table_privilege('anon', 'private.tec_english_technical_publication_events', 'SELECT')
     or has_table_privilege('authenticated', 'private.tec_english_technical_publication_events', 'SELECT')
     or has_table_privilege('service_role', 'private.tec_english_technical_publication_events', 'SELECT') then
    raise exception 'V8 technical publication audit is exposed through an API role';
  end if;
end;
$tec_idiomas_v8_publication_test$;
