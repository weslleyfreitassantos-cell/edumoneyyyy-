-- V7 activation invariant: staging content is never student-readable. Every
-- non-fixture course must be approved for its exact content fingerprint,
-- published, and explicitly released to the requesting active institution.

create or replace function private.tec_english_course_available(
  p_institution_id uuid,
  p_course_code text,
  p_test_mode boolean
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.tec_english_courses course
     where course.course_code = p_course_code
       and (
         (p_test_mode and course.is_test_fixture)
         or (
           not p_test_mode and not course.is_test_fixture
           and course.publication_status = 'PUBLISHED'
           and course.review_status = 'PEDAGOGICAL_REVIEWED'
           and (
             not private.tec_idiomas_v3_course_version_allowed(course.course_code, course.content_version)
             or private.tec_idiomas_v3_course_content_eligible(course.course_code, course.content_version)
           )
           and exists (
             select 1 from public.tec_english_pedagogical_reviews review
              where review.course_code = course.course_code
                and review.content_version = course.content_version
                and review.decision = 'APPROVED'
                and review.snapshot_fingerprint = private.tec_english_course_fingerprint(course.course_code, course.content_version)
           )
           and exists (
             select 1 from public.tec_english_course_releases release
             join public.institutions institution on institution.id = release.institution_id
              where release.course_code = course.course_code
                and release.content_version = course.content_version
                and release.institution_id = p_institution_id
                and release.enabled
                and institution.active
           )
         )
       )
  );
$$;
revoke all on function private.tec_english_course_available(uuid, text, boolean) from public, anon, authenticated;

create or replace function private.tec_english_lesson_ready(p_lesson_id text, p_test_mode boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.tec_english_lessons lesson
      join public.tec_english_units unit on unit.id = lesson.unit_id
      join public.tec_english_courses course on course.course_code = unit.course_code
     where lesson.id = p_lesson_id
       and exists (select 1 from public.tec_english_exercises exercise where exercise.lesson_id = lesson.id)
       and (
         (p_test_mode and course.is_test_fixture)
         or (
           not p_test_mode and not course.is_test_fixture
           and course.publication_status = 'PUBLISHED'
           and course.review_status = 'PEDAGOGICAL_REVIEWED'
           and exists (
             select 1 from public.tec_english_pedagogical_reviews review
              where review.course_code = course.course_code
                and review.content_version = course.content_version
                and review.decision = 'APPROVED'
                and review.snapshot_fingerprint = private.tec_english_course_fingerprint(course.course_code, course.content_version)
           )
           and exists (
             select 1
               from public.tec_english_course_releases release
               join public.institutions institution on institution.id = release.institution_id
              where release.course_code = course.course_code
                and release.content_version = course.content_version
                and release.enabled
                and institution.active
           )
           and (
             (
               private.tec_idiomas_v3_course_version_allowed(course.course_code, course.content_version)
               and private.tec_idiomas_v3_course_content_eligible(course.course_code, course.content_version)
               and unit.content_version = course.content_version
               and lesson.content_version = course.content_version
               and unit.publication_status = 'PUBLISHED'
               and unit.review_status = 'PEDAGOGICAL_REVIEWED'
               and lesson.publication_status = 'PUBLISHED'
               and lesson.review_status = 'PEDAGOGICAL_REVIEWED'
               and not exists (
                 select 1 from public.tec_english_exercises exercise
                  where exercise.lesson_id = lesson.id
                    and (exercise.content_version <> course.content_version
                      or exercise.publication_status <> 'PUBLISHED'
                      or exercise.review_status <> 'PEDAGOGICAL_REVIEWED')
               )
             )
             or (
               not private.tec_idiomas_v3_course_allowed(course.course_code)
               and unit.publication_status = 'PUBLISHED'
               and unit.review_status = 'PEDAGOGICAL_REVIEWED'
               and lesson.publication_status = 'PUBLISHED'
               and lesson.review_status = 'PEDAGOGICAL_REVIEWED'
               and not exists (
                 select 1 from public.tec_english_exercises exercise
                  where exercise.lesson_id = lesson.id
                    and (exercise.publication_status <> 'PUBLISHED' or exercise.review_status <> 'PEDAGOGICAL_REVIEWED')
               )
             )
           )
         )
       )
  );
$$;
revoke all on function private.tec_english_lesson_ready(text, boolean) from public, anon, authenticated;
