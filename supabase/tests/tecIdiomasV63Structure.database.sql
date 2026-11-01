-- Runs against the disposable Supabase PostgreSQL started by CI after all
-- repository migrations have been applied. It checks real seeded course rows.
do $tec_idiomas_v63_structure_test$
declare
  profile record;
  v_units integer;
  v_lessons integer;
  v_exercises integer;
  v_publication_status text;
  v_review_status text;
begin
  for profile in
    select * from (values
      ('TEC_ENGLISH_FOUNDATIONS_V2', 4, 2, 8, 56),
      ('TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER', 1, 4, 16, 76),
      ('TEC_KOREAN_FOUNDATIONS_V2_BEGINNER', 1, 4, 16, 72),
      ('TEC_SPANISH_FOUNDATIONS_V2_BEGINNER', 1, 4, 16, 76)
    ) as expected(course_code, content_version, unit_count, lesson_count, exercise_count)
  loop
    if not private.tec_english_course_structure_valid_v2(profile.course_code, profile.content_version) then
      raise exception 'V63 course structure validation failed for % v%', profile.course_code, profile.content_version;
    end if;

    select count(*)::integer into v_units
      from public.tec_english_units unit where unit.course_code = profile.course_code;
    select count(*)::integer into v_lessons
      from public.tec_english_lessons lesson
      join public.tec_english_units unit on unit.id = lesson.unit_id
     where unit.course_code = profile.course_code and lesson.content_version = profile.content_version;
    select count(*)::integer into v_exercises
      from public.tec_english_exercises exercise
      join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id
      join public.tec_english_units unit on unit.id = lesson.unit_id
     where unit.course_code = profile.course_code and exercise.content_version = profile.content_version;
    if (v_units, v_lessons, v_exercises) is distinct from
       (profile.unit_count, profile.lesson_count, profile.exercise_count) then
      raise exception 'V63 course counts differ for %: %, %, %', profile.course_code, v_units, v_lessons, v_exercises;
    end if;

    select course.publication_status, course.review_status
      into v_publication_status, v_review_status
      from public.tec_english_courses course
     where course.course_code = profile.course_code
       and course.content_version = profile.content_version
       and not course.is_test_fixture;
    if v_publication_status is distinct from 'PUBLISHED'
       or v_review_status is distinct from 'PEDAGOGICAL_REVIEW_PENDING' then
      raise exception 'V63 course % did not retain technical publication and pending review states', profile.course_code;
    end if;
  end loop;
end;
$tec_idiomas_v63_structure_test$;
