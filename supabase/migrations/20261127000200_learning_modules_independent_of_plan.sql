-- Seed the published learning catalog for every operational institution.
-- Existing runtime eligibility checks remain in place for suspended or inactive institutions.

insert into public.tec_english_course_releases(
  course_code, content_version, institution_id, enabled,
  updated_by_profile_id, updated_by_id_snapshot, updated_by_name, updated_by_email, updated_at
)
select
  course.course_code, course.content_version, institution.id, true,
  null, gen_random_uuid(), 'Liberação automática do catálogo institucional',
  'system@grupotec.dev.br', now()
from public.tec_english_courses course
cross join public.institutions institution
join public.accounts account on account.id = institution.account_id
where not course.is_test_fixture
  and course.publication_status = 'PUBLISHED'
  and institution.active is true
  and institution.suspended_at is null
  and account.status = 'ACTIVE'
  and public.is_institution_operational(institution.id)
on conflict (course_code, institution_id) do nothing;

insert into public.tec_english_course_release_events(
  course_code, content_version, institution_id, action,
  actor_id_snapshot, actor_name, actor_email
)
select
  release.course_code, release.content_version, release.institution_id, 'ENABLED',
  release.updated_by_id_snapshot, release.updated_by_name, release.updated_by_email
from public.tec_english_course_releases release
where release.updated_by_email = 'system@grupotec.dev.br'
  and release.enabled is true
  and release.updated_at >= now() - interval '1 minute'
  and not exists (
    select 1 from public.tec_english_course_release_events event
    where event.course_code = release.course_code
      and event.content_version = release.content_version
      and event.institution_id = release.institution_id
      and event.actor_email = release.updated_by_email
      and event.action = 'ENABLED'
      and event.occurred_at >= release.updated_at
  );
