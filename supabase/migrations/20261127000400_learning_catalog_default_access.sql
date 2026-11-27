-- Make the published learning catalog available by default to operational
-- institutions. An explicit disabled release still revokes access.

drop trigger if exists provision_tec_learning_releases_after_institution
  on public.institutions;
drop trigger if exists provision_tec_learning_releases_after_account
  on public.accounts;
drop trigger if exists provision_tec_learning_releases_after_course
  on public.tec_english_courses;

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
      join public.institutions institution
        on institution.id = p_institution_id
     where course.course_code = p_course_code
       and (
         (p_test_mode and course.is_test_fixture)
         or (
           not p_test_mode
           and not course.is_test_fixture
           and course.publication_status = 'PUBLISHED'
           and private.tec_english_course_structure_valid_v2(course.course_code, course.content_version)
           and (
             not private.tec_idiomas_v3_course_allowed(course.course_code)
             or private.tec_idiomas_v3_course_content_eligible(course.course_code, course.content_version)
           )
           and private.tec_english_institution_release_eligible(institution.id)
           and not exists (
             select 1
               from public.tec_english_course_releases release
              where release.course_code = course.course_code
                and release.content_version = course.content_version
                and release.institution_id = p_institution_id
                and release.enabled is false
           )
         )
       )
  );
$$;
revoke all on function private.tec_english_course_available(uuid, text, boolean)
  from public, anon, authenticated;

comment on function private.tec_english_course_available(uuid, text, boolean) is
  'Published courses are available by default to operational institutions; an explicit disabled release revokes access.';
