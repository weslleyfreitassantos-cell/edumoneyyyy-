-- Tec Idiomas V6.3: scoped course/activity resets and profile-aware review shape.
-- This migration intentionally does not approve or publish any content, enable
-- any institution, or run automatically against production in this work.

begin;
set local lock_timeout = '3s';
set local statement_timeout = '90s';

-- Keep content/progress shape stable between the preconditions and update.
lock table public.tec_english_courses, public.tec_english_units,
  public.tec_english_lessons, public.tec_english_exercises,
  public.tec_english_lesson_sessions, public.tec_english_lesson_progress,
  public.tec_english_answer_attempts, public.tec_english_xp_events,
  public.tec_english_student_stats,
  public.tec_language_course_stats_v1, public.tec_language_placement_attempts_v1,
  public.tec_english_skill_mastery_v2, public.tec_english_skill_review_attempts_v2,
  public.tec_english_pedagogical_reviews, public.tec_english_course_releases
  in share row exclusive mode;

create or replace function private.tec_english_course_structure_valid_v2(
  p_course_code text,
  p_content_version integer
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
       and course.content_version = p_content_version
       and not course.is_test_fixture
       and case
         when (p_course_code, p_content_version) in (
           ('TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER', 1),
           ('TEC_SPANISH_FOUNDATIONS_V2_BEGINNER', 1),
           ('TEC_KOREAN_FOUNDATIONS_V2_BEGINNER', 1)
         ) then
           (select count(*) = 4 from public.tec_english_units unit where unit.course_code = course.course_code)
           and (select count(*) = 16 from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = course.course_code)
           and (select count(*) = case when course.course_code = 'TEC_KOREAN_FOUNDATIONS_V2_BEGINNER' then 72 else 76 end
                  from public.tec_english_exercises exercise
                  join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id
                  join public.tec_english_units unit on unit.id = lesson.unit_id
                 where unit.course_code = course.course_code)
           and not exists (
             select 1 from public.tec_english_lessons lesson
             join public.tec_english_units unit on unit.id = lesson.unit_id
             where unit.course_code = course.course_code
               and ((select count(*) from public.tec_english_exercises exercise where exercise.lesson_id = lesson.id) not between 4 and 5
                 or (select count(distinct exercise.exercise_type) from public.tec_english_exercises exercise where exercise.lesson_id = lesson.id) not between 3 and 4
                 or exists (select 1 from public.tec_english_exercises exercise where exercise.lesson_id = lesson.id and exercise.exercise_type not in ('MULTIPLE_CHOICE', 'MATCHING', 'FILL_BLANK', 'WORD_ORDER')))
           )
         when (p_course_code, p_content_version) in (
           ('TEC_ENGLISH_FOUNDATIONS_V2', 4)
         ) then
           (select count(*) = 2 from public.tec_english_units unit where unit.course_code = course.course_code)
           and (select count(*) = 8 from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = course.course_code)
           and (select count(*) = 56 from public.tec_english_exercises exercise join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = course.course_code)
           and not exists (
             select 1 from public.tec_english_lessons lesson
             join public.tec_english_units unit on unit.id = lesson.unit_id
             where unit.course_code = course.course_code
               and ((select count(*) from public.tec_english_exercises exercise where exercise.lesson_id = lesson.id) <> 7
                 or (select count(distinct exercise.exercise_type) from public.tec_english_exercises exercise where exercise.lesson_id = lesson.id) <> 7
                 or exists (select 1 from public.tec_english_exercises exercise where exercise.lesson_id = lesson.id and exercise.exercise_type not in ('MULTIPLE_CHOICE', 'WORD_ORDER', 'TRANSLATION', 'LISTENING', 'MATCHING', 'FILL_BLANK', 'SPEAKING')))
           )
         when p_course_code in ('TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', 'TEC_SPANISH_FOUNDATIONS_V1', 'TEC_KOREAN_FOUNDATIONS_V1') and p_content_version = 1 then
           (select count(*) = case when course.course_code = 'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION' then 4 else 2 end
              from public.tec_english_units unit where unit.course_code = course.course_code)
           and (select count(*) = case when course.course_code = 'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION' then 16 else 8 end
                  from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = course.course_code)
           and (select count(*) = case when course.course_code = 'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION' then 112 else 56 end
                  from public.tec_english_exercises exercise join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = course.course_code)
           and not exists (
             select 1 from public.tec_english_lessons lesson
             join public.tec_english_units unit on unit.id = lesson.unit_id
             where unit.course_code = course.course_code
               and ((select count(*) from public.tec_english_exercises exercise where exercise.lesson_id = lesson.id) <> 7
                 or (select count(distinct exercise.exercise_type) from public.tec_english_exercises exercise where exercise.lesson_id = lesson.id) <> 7)
           )
         else
           not exists (
             select 1 from public.tec_english_lessons lesson
             join public.tec_english_units unit on unit.id = lesson.unit_id
             where unit.course_code = course.course_code
               and ((select count(*) from public.tec_english_exercises exercise where exercise.lesson_id = lesson.id) <> 7
                 or (select count(distinct exercise.exercise_type) from public.tec_english_exercises exercise where exercise.lesson_id = lesson.id) <> 7)
           )
       end
       and not exists (
         select 1 from public.tec_english_units unit where unit.course_code = course.course_code
           and unit.content_version <> course.content_version
       )
       and not exists (
         select 1 from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id
          where unit.course_code = course.course_code and lesson.content_version <> course.content_version
       )
       and not exists (
         select 1 from public.tec_english_exercises exercise
         join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id
         join public.tec_english_units unit on unit.id = lesson.unit_id
          where unit.course_code = course.course_code and exercise.content_version <> course.content_version
       )
  );
$$;
revoke all on function private.tec_english_course_structure_valid_v2(text, integer) from public, anon, authenticated;

-- Recreate the existing human-review procedure without weakening identity,
-- fingerprint, checklist, authorization, or approval immutability checks.
create or replace function public.review_tec_english_course_v1(
  p_course_code text,
  p_content_version integer,
  p_decision text,
  p_notes text,
  p_expected_fingerprint text,
  p_checklist jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course public.tec_english_courses%rowtype;
  v_profile public.profiles%rowtype;
  v_fingerprint text;
  v_review_id uuid;
begin
  if not public.is_platform_super_admin() then
    raise exception 'TEC_ENGLISH_REVIEW_FORBIDDEN' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('APPROVED', 'CHANGES_REQUESTED')
     or length(btrim(coalesce(p_notes, ''))) < 10
     or length(p_notes) > 2000 then
    raise exception 'TEC_ENGLISH_REVIEW_INVALID_DECISION' using errcode = '22023';
  end if;
  if p_decision = 'APPROVED' and (
    p_checklist is null
    or pg_catalog.jsonb_typeof(p_checklist) is distinct from 'object'
    or p_checklist ->> 'translation' is distinct from 'true'
    or p_checklist ->> 'audio' is distinct from 'true'
    or p_checklist ->> 'instructions' is distinct from 'true'
    or p_checklist ->> 'alternatives' is distinct from 'true'
    or p_checklist ->> 'progression' is distinct from 'true'
    or p_checklist ->> 'brazilian' is distinct from 'true'
    or p_checklist ->> 'accessibility' is distinct from 'true'
    or p_checklist ->> 'references' is distinct from 'true'
  ) then
    raise exception 'TEC_ENGLISH_REVIEW_CHECKLIST_INCOMPLETE' using errcode = '22023';
  end if;

  select * into v_course from public.tec_english_courses course
   where course.course_code = p_course_code and course.content_version = p_content_version
   for update;
  if not found or v_course.is_test_fixture or v_course.publication_status = 'ARCHIVED' then
    raise exception 'TEC_ENGLISH_REVIEW_VERSION_NOT_REVIEWABLE' using errcode = 'P0002';
  end if;
  v_fingerprint := private.tec_english_course_fingerprint(p_course_code, p_content_version);
  if v_fingerprint is null or p_expected_fingerprint is null or v_fingerprint is distinct from p_expected_fingerprint then
    raise exception 'TEC_ENGLISH_REVIEW_CONTENT_CHANGED' using errcode = '40001';
  end if;
  if exists (
    select 1 from public.tec_english_pedagogical_reviews prior
     where prior.course_code = p_course_code and prior.content_version = p_content_version
       and prior.decision = 'APPROVED' and prior.snapshot_fingerprint <> v_fingerprint
  ) then
    raise exception 'TEC_ENGLISH_CONTENT_VERSION_IMMUTABLE' using errcode = '55000';
  end if;

  if p_decision = 'APPROVED' then
    if not exists (select 1 from public.tec_english_units unit where unit.course_code = p_course_code)
       or exists (select 1 from public.tec_english_units unit where unit.course_code = p_course_code and unit.content_version <> p_content_version)
       or exists (select 1 from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = p_course_code and lesson.content_version <> p_content_version)
       or exists (select 1 from public.tec_english_exercises exercise join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = p_course_code and exercise.content_version <> p_content_version)
       or exists (select 1 from public.tec_english_units unit where unit.course_code = p_course_code and not exists (select 1 from public.tec_english_lessons lesson where lesson.unit_id = unit.id))
       or not private.tec_english_course_structure_valid_v2(p_course_code, p_content_version) then
      raise exception 'TEC_ENGLISH_REVIEW_CONTENT_INCOMPLETE' using errcode = '22023';
    end if;
    update public.tec_english_courses set publication_status = 'PUBLISHED', review_status = 'PEDAGOGICAL_REVIEWED', updated_at = now() where course_code = p_course_code;
    update public.tec_english_units set publication_status = 'PUBLISHED', review_status = 'PEDAGOGICAL_REVIEWED' where course_code = p_course_code;
    update public.tec_english_lessons lesson set publication_status = 'PUBLISHED', review_status = 'PEDAGOGICAL_REVIEWED' from public.tec_english_units unit where unit.id = lesson.unit_id and unit.course_code = p_course_code;
    update public.tec_english_exercises exercise set publication_status = 'PUBLISHED', review_status = 'PEDAGOGICAL_REVIEWED' from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id where lesson.id = exercise.lesson_id and unit.course_code = p_course_code;
  else
    update public.tec_english_courses set publication_status = 'STAGING', review_status = 'CHANGES_REQUESTED', updated_at = now() where course_code = p_course_code;
    update public.tec_english_units set publication_status = 'STAGING', review_status = 'CHANGES_REQUESTED' where course_code = p_course_code;
    update public.tec_english_lessons lesson set publication_status = 'STAGING', review_status = 'CHANGES_REQUESTED' from public.tec_english_units unit where unit.id = lesson.unit_id and unit.course_code = p_course_code;
    update public.tec_english_exercises exercise set publication_status = 'STAGING', review_status = 'CHANGES_REQUESTED' from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id where lesson.id = exercise.lesson_id and unit.course_code = p_course_code;
  end if;

  if private.tec_english_course_fingerprint(p_course_code, p_content_version) is distinct from p_expected_fingerprint then
    raise exception 'TEC_ENGLISH_REVIEW_CONTENT_CHANGED' using errcode = '40001';
  end if;
  select * into v_profile from public.profiles profile where profile.id = auth.uid();
  insert into public.tec_english_pedagogical_reviews(course_code, content_version, snapshot_fingerprint, decision, notes, reviewer_profile_id, reviewer_id_snapshot, reviewer_name, reviewer_email)
  values (p_course_code, p_content_version, v_fingerprint, p_decision, btrim(p_notes), v_profile.id, auth.uid(), coalesce(nullif(btrim(v_profile.full_name), ''), v_profile.email), v_profile.email)
  returning id into v_review_id;
  return pg_catalog.jsonb_build_object('review_id', v_review_id, 'course_code', p_course_code, 'content_version', p_content_version, 'decision', p_decision, 'reviewer_name', coalesce(nullif(btrim(v_profile.full_name), ''), v_profile.email), 'reviewer_email', v_profile.email, 'reviewed_at', now(), 'snapshot_fingerprint', v_fingerprint);
end;
$$;
revoke all on function public.review_tec_english_course_v1(text, integer, text, text, text, jsonb) from public, anon;
grant execute on function public.review_tec_english_course_v1(text, integer, text, text, text, jsonb) to authenticated;

create table public.tec_language_reset_audit_v1 (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  action text not null check (action in ('COURSE', 'ACTIVITY')),
  locale text not null check (locale in ('en', 'es', 'ko')),
  course_code text not null,
  source_session_id uuid,
  result_session_id uuid,
  details jsonb not null default '{}'::jsonb check (pg_catalog.jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  check ((action = 'ACTIVITY' and source_session_id is not null and result_session_id is not null)
      or (action = 'COURSE' and source_session_id is null and result_session_id is null))
);
create unique index tec_language_reset_activity_idempotency_v1
  on public.tec_language_reset_audit_v1(institution_id, student_id, source_session_id)
  where action = 'ACTIVITY';
alter table public.tec_language_reset_audit_v1 enable row level security;
revoke all on table public.tec_language_reset_audit_v1 from public, anon, authenticated;
grant all on table public.tec_language_reset_audit_v1 to service_role;

create or replace function public.reset_tec_language_activity_v1(
  p_institution_id uuid,
  p_course_code text,
  p_lesson_id text,
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := private.tec_english_current_student_id(p_institution_id);
  v_session public.tec_english_lesson_sessions%rowtype;
  v_new_session_id uuid;
  v_existing_result uuid;
  v_prior_reset boolean := false;
  v_session_payload jsonb;
  v_locale text;
  v_test_mode boolean := private.tec_english_test_mode();
  v_discarded_answers integer;
begin
  if p_course_code is null or p_lesson_id is null or p_session_id is null then
    raise exception 'TEC_LANGUAGE_RESET_INVALID_REQUEST' using errcode = '22023';
  end if;
  if v_student_id is null or not exists (select 1 from public.institutions institution where institution.id = p_institution_id and institution.active) then
    raise exception 'TEC_ENGLISH_STUDENT_ACCESS_REQUIRED' using errcode = '42501';
  end if;
  if p_course_code not in (
    'TEC_ENGLISH_FOUNDATIONS',
    'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', 'TEC_SPANISH_FOUNDATIONS_V1', 'TEC_KOREAN_FOUNDATIONS_V1',
    'TEC_ENGLISH_FOUNDATIONS_V2', 'TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER',
    'TEC_SPANISH_FOUNDATIONS_V2_BEGINNER', 'TEC_KOREAN_FOUNDATIONS_V2_BEGINNER'
  ) then raise exception 'TEC_LANGUAGE_RESET_UNSUPPORTED_COURSE' using errcode = '22023'; end if;
  if not private.tec_english_course_available(p_institution_id, p_course_code, v_test_mode) then
    raise exception 'TEC_ENGLISH_COURSE_NOT_AVAILABLE' using errcode = '42501';
  end if;
  v_locale := case when p_course_code like 'TEC_SPANISH%' then 'es' when p_course_code like 'TEC_KOREAN%' then 'ko' else 'en' end;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_institution_id::text || ':' || v_student_id::text || ':' || v_locale, 1));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_session_id::text, 0));
  select true, audit.result_session_id into v_prior_reset, v_existing_result
    from public.tec_language_reset_audit_v1 audit
   where audit.institution_id = p_institution_id and audit.student_id = v_student_id
     and audit.source_session_id = p_session_id and audit.action = 'ACTIVITY';
  if v_prior_reset then
    if v_existing_result is null then raise exception 'TEC_LANGUAGE_RESET_REPLAY_EXPIRED' using errcode = 'P0002'; end if;
    v_session_payload := private.tec_english_session_payload(v_existing_result, v_student_id, p_institution_id);
    if v_session_payload is null then raise exception 'TEC_LANGUAGE_RESET_REPLAY_EXPIRED' using errcode = 'P0002'; end if;
    return v_session_payload || pg_catalog.jsonb_build_object('course_code', p_course_code, 'reset', true, 'replayed', true);
  end if;
  select session.* into v_session
    from public.tec_english_lesson_sessions session
    join public.tec_english_lessons lesson on lesson.id = session.lesson_id
    join public.tec_english_units unit on unit.id = lesson.unit_id
   where session.id = p_session_id and session.student_id = v_student_id
     and session.institution_id = p_institution_id and session.lesson_id = p_lesson_id
     and unit.course_code = p_course_code and session.status = 'IN_PROGRESS'
   for update of session;
  if not found or not private.tec_english_lesson_ready(p_lesson_id, v_test_mode) then
    raise exception 'TEC_LANGUAGE_RESET_ACTIVE_SESSION_REQUIRED' using errcode = '42501';
  end if;
  select count(*)::integer into v_discarded_answers from public.tec_english_answer_attempts attempt where attempt.session_id = p_session_id;
  delete from public.tec_english_lesson_sessions session where session.id = p_session_id;
  insert into public.tec_english_lesson_sessions(institution_id, student_id, lesson_id, status, current_position)
  values (p_institution_id, v_student_id, p_lesson_id, 'IN_PROGRESS', 1)
  returning id into v_new_session_id;
  insert into public.tec_language_reset_audit_v1(institution_id, student_id, action, locale, course_code, source_session_id, result_session_id, details)
  values (p_institution_id, v_student_id, 'ACTIVITY', v_locale,
          p_course_code, p_session_id, v_new_session_id, pg_catalog.jsonb_build_object('discarded_answer_count', v_discarded_answers));
  v_session_payload := private.tec_english_session_payload(v_new_session_id, v_student_id, p_institution_id);
  if v_session_payload is null then raise exception 'TEC_LANGUAGE_RESET_SESSION_CREATION_FAILED' using errcode = 'P0002'; end if;
  return v_session_payload || pg_catalog.jsonb_build_object('course_code', p_course_code, 'reset', true, 'replayed', false);
end;
$$;
revoke all on function public.reset_tec_language_activity_v1(uuid, text, text, uuid) from public, anon;
grant execute on function public.reset_tec_language_activity_v1(uuid, text, text, uuid) to authenticated;

create or replace function public.reset_tec_language_course_v1(
  p_institution_id uuid,
  p_locale text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := private.tec_english_current_student_id(p_institution_id);
  v_codes text[];
  v_removed_sessions integer := 0;
  v_removed_progress integer := 0;
  v_removed_attempts integer := 0;
  v_removed_xp_events integer := 0;
  v_global_xp_removed integer := 0;
  v_test_mode boolean := private.tec_english_test_mode();
begin
  if v_student_id is null or not exists (select 1 from public.institutions institution where institution.id = p_institution_id and institution.active) then
    raise exception 'TEC_ENGLISH_STUDENT_ACCESS_REQUIRED' using errcode = '42501';
  end if;
  v_codes := case p_locale
    when 'en' then array['TEC_ENGLISH_FOUNDATIONS', 'TEC_ENGLISH_FOUNDATIONS_V2', 'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', 'TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER']
    when 'es' then array['TEC_SPANISH_FOUNDATIONS_V1', 'TEC_SPANISH_FOUNDATIONS_V2_BEGINNER']
    when 'ko' then array['TEC_KOREAN_FOUNDATIONS_V1', 'TEC_KOREAN_FOUNDATIONS_V2_BEGINNER']
    else null end;
  if v_codes is null then raise exception 'TEC_LANGUAGE_RESET_INVALID_LOCALE' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_institution_id::text || ':' || v_student_id::text || ':' || p_locale, 1));
  if not exists (
    select 1 from unnest(v_codes) as candidate(code)
     where private.tec_english_course_available(p_institution_id, candidate.code, v_test_mode)
  ) then raise exception 'TEC_ENGLISH_COURSE_NOT_AVAILABLE' using errcode = '42501'; end if;

  -- All deletes are bounded to this student's active institution and the
  -- explicit allowlist for the selected language. V3 XP is course-scoped and
  -- deliberately does not alter shared English totals.
  select coalesce(sum(event.xp), 0)::integer into v_global_xp_removed
    from public.tec_english_xp_events event
    join public.tec_english_lessons lesson on lesson.id = event.lesson_id
    join public.tec_english_units unit on unit.id = lesson.unit_id
   where event.institution_id = p_institution_id and event.student_id = v_student_id
     and unit.course_code = any(v_codes)
     and unit.course_code not in ('TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', 'TEC_SPANISH_FOUNDATIONS_V1', 'TEC_KOREAN_FOUNDATIONS_V1');
  delete from public.tec_english_xp_events event
   using public.tec_english_lessons lesson, public.tec_english_units unit
   where event.lesson_id = lesson.id and lesson.unit_id = unit.id
     and event.institution_id = p_institution_id and event.student_id = v_student_id
     and unit.course_code = any(v_codes)
     and unit.course_code not in ('TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', 'TEC_SPANISH_FOUNDATIONS_V1', 'TEC_KOREAN_FOUNDATIONS_V1');
  get diagnostics v_removed_xp_events = row_count;
  if v_global_xp_removed > 0 then
    update public.tec_english_student_stats stats set xp = greatest(0, stats.xp - v_global_xp_removed), updated_at = now()
     where stats.institution_id = p_institution_id and stats.student_id = v_student_id;
  end if;

  delete from public.tec_english_lesson_progress progress
   using public.tec_english_lessons lesson, public.tec_english_units unit
   where progress.lesson_id = lesson.id and lesson.unit_id = unit.id
     and progress.institution_id = p_institution_id and progress.student_id = v_student_id and unit.course_code = any(v_codes);
  get diagnostics v_removed_progress = row_count;

  select count(*)::integer into v_removed_attempts from public.tec_english_answer_attempts attempt
   join public.tec_english_lesson_sessions session on session.id = attempt.session_id
   join public.tec_english_lessons lesson on lesson.id = session.lesson_id
   join public.tec_english_units unit on unit.id = lesson.unit_id
   where session.institution_id = p_institution_id and session.student_id = v_student_id and unit.course_code = any(v_codes);
  delete from public.tec_english_lesson_sessions session
   using public.tec_english_lessons lesson, public.tec_english_units unit
   where session.lesson_id = lesson.id and lesson.unit_id = unit.id
     and session.institution_id = p_institution_id and session.student_id = v_student_id and unit.course_code = any(v_codes);
  get diagnostics v_removed_sessions = row_count;

  delete from public.tec_language_course_stats_v1 stats
   where stats.institution_id = p_institution_id and stats.student_id = v_student_id and stats.course_code = any(v_codes);
  delete from public.tec_language_placement_attempts_v1 placement
   where placement.institution_id = p_institution_id and placement.student_id = v_student_id and placement.course_code = any(v_codes);

  delete from public.tec_english_skill_mastery_v2 mastery
   where mastery.institution_id = p_institution_id and mastery.student_id = v_student_id
     and exists (
       select 1 from public.tec_english_exercises exercise
       join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id
       join public.tec_english_units unit on unit.id = lesson.unit_id
       where exercise.skill_code = mastery.skill_code and unit.course_code = any(v_codes)
     )
     and not exists (
       select 1 from public.tec_english_exercises exercise
       join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id
       join public.tec_english_units unit on unit.id = lesson.unit_id
       where exercise.skill_code = mastery.skill_code and not (unit.course_code = any(v_codes))
     );

  insert into public.tec_language_reset_audit_v1(institution_id, student_id, action, locale, course_code, details)
  values (p_institution_id, v_student_id, 'COURSE', p_locale, 'TEC_LANGUAGE_' || upper(p_locale),
    pg_catalog.jsonb_build_object('sessions', v_removed_sessions, 'progress', v_removed_progress,
      'answer_attempts', v_removed_attempts, 'global_xp_events', v_removed_xp_events,
      'global_xp_removed', v_global_xp_removed, 'placement_attempts_removed', true));
  return pg_catalog.jsonb_build_object('reset', true, 'locale', p_locale, 'course_codes', to_jsonb(v_codes),
    'sessions_removed', v_removed_sessions, 'progress_removed', v_removed_progress,
    'answer_attempts_removed', v_removed_attempts, 'global_xp_removed', v_global_xp_removed,
    'course_xp_removed', true, 'placement_removed', true, 'replayed', false);
end;
$$;
revoke all on function public.reset_tec_language_course_v1(uuid, text) from public, anon;
grant execute on function public.reset_tec_language_course_v1(uuid, text) to authenticated;

-- V2 candidate update is guarded by exact-source drift checks and the absence
-- of any dependent student or review activity. The content remains STAGING.
do $tec_english_v2_v4_precheck$
begin
  if not exists (select 1 from public.tec_english_courses where course_code = 'TEC_ENGLISH_FOUNDATIONS_V2' and content_version = 3 and publication_status = 'STAGING' and review_status = 'PEDAGOGICAL_REVIEW_PENDING' and not is_test_fixture) then
    raise exception 'TEC_IDIOMAS_V63_V2_COURSE_STATE_DRIFT';
  end if;
  if exists (select 1 from public.tec_english_units where course_code = 'TEC_ENGLISH_FOUNDATIONS_V2' and (publication_status <> 'STAGING' or review_status <> 'PEDAGOGICAL_REVIEW_PENDING'))
     or exists (select 1 from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = 'TEC_ENGLISH_FOUNDATIONS_V2' and (lesson.publication_status <> 'STAGING' or lesson.review_status <> 'PEDAGOGICAL_REVIEW_PENDING'))
     or exists (select 1 from public.tec_english_exercises exercise join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = 'TEC_ENGLISH_FOUNDATIONS_V2' and (exercise.publication_status <> 'STAGING' or exercise.review_status <> 'PEDAGOGICAL_REVIEW_PENDING')) then
    raise exception 'TEC_IDIOMAS_V63_V2_CHILD_REVIEW_STATE_DRIFT';
  end if;
  if exists (select 1 from public.tec_english_pedagogical_reviews where course_code = 'TEC_ENGLISH_FOUNDATIONS_V2')
     or exists (select 1 from public.tec_english_course_releases where course_code = 'TEC_ENGLISH_FOUNDATIONS_V2') then
    raise exception 'TEC_IDIOMAS_V63_V2_REVIEW_OR_RELEASE_EXISTS';
  end if;
  if exists (
    select 1 from public.tec_english_lesson_sessions session
    join public.tec_english_lessons lesson on lesson.id = session.lesson_id
    join public.tec_english_units unit on unit.id = lesson.unit_id
    where unit.course_code = 'TEC_ENGLISH_FOUNDATIONS_V2'
  ) or exists (
    select 1 from public.tec_english_answer_attempts attempt
    join public.tec_english_lesson_sessions session on session.id = attempt.session_id
    join public.tec_english_lessons lesson on lesson.id = session.lesson_id
    join public.tec_english_units unit on unit.id = lesson.unit_id
    where unit.course_code = 'TEC_ENGLISH_FOUNDATIONS_V2'
  ) or exists (
    select 1 from public.tec_english_lesson_progress progress
    join public.tec_english_lessons lesson on lesson.id = progress.lesson_id
    join public.tec_english_units unit on unit.id = lesson.unit_id
    where unit.course_code = 'TEC_ENGLISH_FOUNDATIONS_V2'
  ) or exists (
    select 1 from public.tec_english_xp_events event
    join public.tec_english_lessons lesson on lesson.id = event.lesson_id
    join public.tec_english_units unit on unit.id = lesson.unit_id
    where unit.course_code = 'TEC_ENGLISH_FOUNDATIONS_V2'
  ) or exists (
    select 1 from public.tec_language_course_stats_v1 where course_code = 'TEC_ENGLISH_FOUNDATIONS_V2'
  ) or exists (
    select 1 from public.tec_language_placement_attempts_v1 where course_code = 'TEC_ENGLISH_FOUNDATIONS_V2'
  ) or exists (
    select 1 from public.tec_english_skill_review_attempts_v2 attempt
    where exists (select 1 from public.tec_english_exercises exercise join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id join public.tec_english_units unit on unit.id = lesson.unit_id where exercise.skill_code = attempt.skill_code and unit.course_code = 'TEC_ENGLISH_FOUNDATIONS_V2')
  ) or exists (
    select 1 from public.tec_english_skill_mastery_v2 mastery
    where exists (select 1 from public.tec_english_exercises exercise join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id join public.tec_english_units unit on unit.id = lesson.unit_id where exercise.skill_code = mastery.skill_code and unit.course_code = 'TEC_ENGLISH_FOUNDATIONS_V2')
  ) then
    raise exception 'TEC_IDIOMAS_V63_V2_STUDENT_ACTIVITY_EXISTS';
  end if;
  if (select count(*) from public.tec_english_units where course_code = 'TEC_ENGLISH_FOUNDATIONS_V2' and content_version = 3) <> 2
     or (select count(*) from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = 'TEC_ENGLISH_FOUNDATIONS_V2' and lesson.content_version = 3) <> 8
     or (select count(*) from public.tec_english_exercises exercise join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = 'TEC_ENGLISH_FOUNDATIONS_V2' and exercise.content_version = 3) <> 56 then
    raise exception 'TEC_IDIOMAS_V63_V2_SHAPE_DRIFT';
  end if;
end $tec_english_v2_v4_precheck$;

-- BEGIN GENERATED TEC ENGLISH V2 V4 SNAPSHOT UPDATE
do $tec_english_v2_v4_content$
declare
  v_changed integer;
begin
  if private.tec_english_course_snapshot('TEC_ENGLISH_FOUNDATIONS_V2', 3) is distinct from '{"course":{"course_code":"TEC_ENGLISH_FOUNDATIONS_V2","content_version":3,"title":"Inglês em conversas do cotidiano","description":"Pratique rotinas, escola, família e lugares em diálogos curtos e situações do dia a dia.","author":"Equipe de conteúdo Tec Escola","xp_per_lesson":30},"units":[{"id":"english-v2-unit-4","position":4,"title":"Minha rotina","description":"Fale sobre horários, atividades diárias e planos da semana.","content_version":3,"author":"Equipe de conteúdo Tec Escola","lessons":[{"id":"english-v2-u4-l1","position":1,"title":"Meu dia começa","introduction":"A rotina ganha sentido quando juntamos uma ação e um horário. Observe como a conversa avança da hora de acordar para a próxima atividade.\n\nObjetivo: Usar verbos simples e horários para descrever uma rotina da manhã.","xp_reward":30,"content_version":3,"author":"Equipe de conteúdo Tec Escola","exercises":[{"id":"english-v2-u4-l1-e1","position":1,"type":"MULTIPLE_CHOICE","instruction":"Conversa guiada · escolha uma resposta que mantenha o diálogo.","prompt":"What time do you wake up?","options":["I wake up at seven.","It is Tuesday.","The library is near the school."],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["I wake up at seven."],"answer_key":{"accepted":["I wake up at seven."]},"explanation":"A pergunta “What time…” pede um horário; “at seven” informa a hora.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"routine_time","difficulty_level":1,"dialogue_speaker":"Mia","dialogue_context":[]},{"id":"english-v2-u4-l1-e2","position":2,"type":"MULTIPLE_CHOICE","instruction":"Conversa guiada · escolha uma resposta que mantenha o diálogo.","prompt":"What do you do after breakfast?","options":["I go to school.","My sister is eleven.","Turn left at the park."],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["I go to school."],"answer_key":{"accepted":["I go to school."]},"explanation":"A resposta continua o assunto da rotina com uma atividade depois do café.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"routine_time","difficulty_level":2,"dialogue_speaker":"Mia","dialogue_context":[{"speaker":"Mia","text":"What time do you wake up?"},{"speaker":"Você","text":"I wake up at seven."}]},{"id":"english-v2-u4-l1-e3","position":3,"type":"WORD_ORDER","instruction":"Monte a frase na ordem correta.","prompt":"Monte: “Eu tomo café da manhã às sete.”","options":[],"word_bank":["seven.","at","breakfast","have","I"],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["I have breakfast at seven."],"answer_key":{"accepted":["I have breakfast at seven."]},"explanation":"A ordem básica é pessoa, ação e complemento; “at seven” indica o horário.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"word_order","difficulty_level":1,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u4-l1-e4","position":4,"type":"TRANSLATION","instruction":"Escreva uma tradução natural em inglês.","prompt":"Eu vou para a escola de manhã.","options":[],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["I go to school in the morning."],"answer_key":{"accepted":["I go to school in the morning."]},"explanation":"“In the morning” é uma forma natural de dizer “de manhã”.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"routine_time","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u4-l1-e5","position":5,"type":"LISTENING","instruction":"Ouça a fala e responda sem ver a transcrição.","prompt":"Que horário aparece na frase?","options":[],"word_bank":[],"left_items":[],"right_items":[],"audio_text":"I wake up at six thirty.","accepted_answers":["six thirty","6:30","half past six"],"answer_key":{"accepted":["six thirty","6:30","half past six"]},"explanation":"“Six thirty” corresponde a seis e meia.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"listening_comprehension","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u4-l1-e6","position":6,"type":"MATCHING","instruction":"Associe cada expressão ao significado.","prompt":"Encontre os pares correspondentes.","options":[],"word_bank":[],"left_items":["wake up","have breakfast","go to school"],"right_items":["acordar","tomar café da manhã","ir para a escola"],"audio_text":null,"accepted_answers":[],"answer_key":{"pairs":{"wake up":"acordar","have breakfast":"tomar café da manhã","go to school":"ir para a escola"}},"explanation":"As expressões descrevem ações comuns do começo do dia.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"routine_vocabulary","difficulty_level":1,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u4-l1-e7","position":7,"type":"FILL_BLANK","instruction":"Escolha a palavra que completa a frase.","prompt":"I ___ breakfast before school.","options":["have","has","am"],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["have"],"answer_key":{"accepted":["have"]},"explanation":"Com “I”, usamos “have”: “I have breakfast”.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"simple_present","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]}]},{"id":"english-v2-u4-l2","position":2,"title":"Horários e atividades","introduction":"“What time” pergunta a hora. Para responder, use uma atividade e “at” antes do horário.\n\nObjetivo: Perguntar “what time” e responder com “at” mais um horário.","xp_reward":30,"content_version":3,"author":"Equipe de conteúdo Tec Escola","exercises":[{"id":"english-v2-u4-l2-e1","position":1,"type":"MULTIPLE_CHOICE","instruction":"Conversa guiada · escolha uma resposta que mantenha o diálogo.","prompt":"What time does your class start?","options":["It starts at eight.","My cousin is kind.","The pencil is blue."],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["It starts at eight."],"answer_key":{"accepted":["It starts at eight."]},"explanation":"“What time” pede um horário; “at eight” responde diretamente.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"routine_time","difficulty_level":2,"dialogue_speaker":"Noah","dialogue_context":[]},{"id":"english-v2-u4-l2-e2","position":2,"type":"MULTIPLE_CHOICE","instruction":"Conversa guiada · escolha uma resposta que mantenha o diálogo.","prompt":"And what do you do after class?","options":["I do my homework.","It is next to the bank.","She is my aunt."],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["I do my homework."],"answer_key":{"accepted":["I do my homework."]},"explanation":"A resposta acompanha a conversa sobre a rotina escolar.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"routine_time","difficulty_level":2,"dialogue_speaker":"Noah","dialogue_context":[{"speaker":"Noah","text":"What time does your class start?"},{"speaker":"Você","text":"It starts at eight."}]},{"id":"english-v2-u4-l2-e3","position":3,"type":"WORD_ORDER","instruction":"Monte a frase na ordem correta.","prompt":"Monte: “Minha aula termina ao meio-dia.”","options":[],"word_bank":["noon.","at","ends","class","My"],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["My class ends at noon."],"answer_key":{"accepted":["My class ends at noon."]},"explanation":"“My class” é o sujeito, “ends” a ação e “at noon” o horário.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"word_order","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u4-l2-e4","position":4,"type":"TRANSLATION","instruction":"Escreva uma tradução natural em inglês.","prompt":"Nós estudamos inglês à tarde.","options":[],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["We study English in the afternoon."],"answer_key":{"accepted":["We study English in the afternoon."]},"explanation":"“In the afternoon” expressa “à tarde”.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"routine_time","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u4-l2-e5","position":5,"type":"LISTENING","instruction":"Ouça a fala e responda sem ver a transcrição.","prompt":"A que horas começa a atividade?","options":[],"word_bank":[],"left_items":[],"right_items":[],"audio_text":"The club starts at half past three.","accepted_answers":["half past three","three thirty","3:30"],"answer_key":{"accepted":["half past three","three thirty","3:30"]},"explanation":"“Half past three” e “three thirty” significam três e meia.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"time_listening","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u4-l2-e6","position":6,"type":"MATCHING","instruction":"Associe cada expressão ao significado.","prompt":"Encontre os pares correspondentes.","options":[],"word_bank":[],"left_items":["at noon","at night","in the afternoon"],"right_items":["ao meio-dia","à noite","à tarde"],"audio_text":null,"accepted_answers":[],"answer_key":{"pairs":{"at noon":"ao meio-dia","at night":"à noite","in the afternoon":"à tarde"}},"explanation":"Use “at” para horários pontuais e “in” em partes do dia.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"time_expressions","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u4-l2-e7","position":7,"type":"SPEAKING","instruction":"Ouça o exemplo e repita. A transcrição é apenas um apoio, não uma nota de pronúncia.","prompt":"Repita: “My class starts at eight.”","options":[],"word_bank":[],"left_items":[],"right_items":[],"audio_text":"My class starts at eight.","accepted_answers":["My class starts at eight."],"answer_key":{"accepted":["My class starts at eight."]},"explanation":"Ouça, fale se quiser e confira o texto reconhecido. O navegador não mede precisão fonética.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"routine_speaking","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]}]},{"id":"english-v2-u4-l3","position":3,"title":"Dias da semana","introduction":"Use “on” antes de um dia da semana. Em uma conversa, uma pergunta sobre sábado pode levar a um plano simples.\n\nObjetivo: Reconhecer os dias da semana e falar de planos com “on”.","xp_reward":30,"content_version":3,"author":"Equipe de conteúdo Tec Escola","exercises":[{"id":"english-v2-u4-l3-e1","position":1,"type":"MULTIPLE_CHOICE","instruction":"Conversa guiada · escolha uma resposta que mantenha o diálogo.","prompt":"What do you do on Saturday?","options":["I play soccer with my friends.","My classroom is upstairs.","The bus is at seven."],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["I play soccer with my friends."],"answer_key":{"accepted":["I play soccer with my friends."]},"explanation":"A resposta apresenta uma atividade para o sábado.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"days_and_plans","difficulty_level":2,"dialogue_speaker":"Lia","dialogue_context":[]},{"id":"english-v2-u4-l3-e2","position":2,"type":"MULTIPLE_CHOICE","instruction":"Conversa guiada · escolha uma resposta que mantenha o diálogo.","prompt":"Do you study on Sunday?","options":["No, I rest with my family.","Turn right at the corner.","She has a red notebook."],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["No, I rest with my family."],"answer_key":{"accepted":["No, I rest with my family."]},"explanation":"A resposta usa “No” e acrescenta um plano coerente para domingo.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"days_and_plans","difficulty_level":2,"dialogue_speaker":"Lia","dialogue_context":[{"speaker":"Lia","text":"What do you do on Saturday?"},{"speaker":"Você","text":"I play soccer with my friends."}]},{"id":"english-v2-u4-l3-e3","position":3,"type":"WORD_ORDER","instruction":"Monte a frase na ordem correta.","prompt":"Monte: “Na segunda-feira, eu estudo matemática.”","options":[],"word_bank":["math.","study","I","Monday,","On"],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["On Monday, I study math."],"answer_key":{"accepted":["On Monday, I study math."]},"explanation":"O dia vem com “on”; depois, sujeito e verbo.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"word_order","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u4-l3-e4","position":4,"type":"TRANSLATION","instruction":"Escreva uma tradução natural em inglês.","prompt":"Ela visita a avó no domingo.","options":[],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["She visits her grandmother on Sunday.","She visits her grandma on Sunday."],"answer_key":{"accepted":["She visits her grandmother on Sunday.","She visits her grandma on Sunday."]},"explanation":"“Grandmother” e “grandma” podem significar “avó”; use “on” com Sunday.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"days_and_plans","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u4-l3-e5","position":5,"type":"LISTENING","instruction":"Ouça a fala e responda sem ver a transcrição.","prompt":"Em que dia a pessoa visita a avó?","options":[],"word_bank":[],"left_items":[],"right_items":[],"audio_text":"I visit my grandmother on Friday.","accepted_answers":["Friday","on Friday"],"answer_key":{"accepted":["Friday","on Friday"]},"explanation":"A palavra ouvida é “Friday”, sexta-feira.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"days_listening","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u4-l3-e6","position":6,"type":"FILL_BLANK","instruction":"Escolha a palavra que completa a frase.","prompt":"We play volleyball ___ Saturday.","options":["on","at","in"],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["on"],"answer_key":{"accepted":["on"]},"explanation":"Use “on” antes de dias da semana.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"simple_present","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u4-l3-e7","position":7,"type":"SPEAKING","instruction":"Ouça o exemplo e repita. A transcrição é apenas um apoio, não uma nota de pronúncia.","prompt":"Repita: “I read a book on Sunday.”","options":[],"word_bank":[],"left_items":[],"right_items":[],"audio_text":"I read a book on Sunday.","accepted_answers":["I read a book on Sunday."],"answer_key":{"accepted":["I read a book on Sunday."]},"explanation":"A fala serve para praticar e conferir a transcrição, sem avaliação fonética automatizada.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"days_speaking","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]}]},{"id":"english-v2-u4-l4","position":4,"title":"Hábitos e frequência","introduction":"No Simple Present, “he” e “she” normalmente recebem “-s” no verbo. Compare “I read” e “she reads”.\n\nObjetivo: Descrever hábitos no Simple Present e observar a concordância verbal com “he” e “she”.","xp_reward":30,"content_version":3,"author":"Equipe de conteúdo Tec Escola","exercises":[{"id":"english-v2-u4-l4-e1","position":1,"type":"MULTIPLE_CHOICE","instruction":"Conversa guiada · escolha uma resposta que mantenha o diálogo.","prompt":"Does your brother walk to school?","options":["Yes, he walks with a friend.","It is Wednesday.","The museum is across the street."],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["Yes, he walks with a friend."],"answer_key":{"accepted":["Yes, he walks with a friend."]},"explanation":"Com “he”, o verbo afirmativo “walk” recebe “-s”: “walks”.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"simple_present","difficulty_level":3,"dialogue_speaker":"Ben","dialogue_context":[]},{"id":"english-v2-u4-l4-e2","position":2,"type":"MULTIPLE_CHOICE","instruction":"Conversa guiada · escolha uma resposta que mantenha o diálogo.","prompt":"What does he do after school?","options":["He reads and then plays music.","They are in the classroom.","It is next to the park."],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["He reads and then plays music."],"answer_key":{"accepted":["He reads and then plays music."]},"explanation":"“Reads” e “plays” concordam com “he”.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"simple_present","difficulty_level":3,"dialogue_speaker":"Ben","dialogue_context":[{"speaker":"Ben","text":"Does your brother walk to school?"},{"speaker":"Você","text":"Yes, he walks with a friend."}]},{"id":"english-v2-u4-l4-e3","position":3,"type":"WORD_ORDER","instruction":"Monte a frase na ordem correta.","prompt":"Monte: “Ela ajuda a família em casa.”","options":[],"word_bank":["home.","at","family","her","helps","She"],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["She helps her family at home."],"answer_key":{"accepted":["She helps her family at home."]},"explanation":"Com “she”, usamos “helps”.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"simple_present","difficulty_level":3,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u4-l4-e4","position":4,"type":"TRANSLATION","instruction":"Escreva uma tradução natural em inglês.","prompt":"Nós lemos antes de dormir.","options":[],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["We read before bed.","We read before going to sleep."],"answer_key":{"accepted":["We read before bed.","We read before going to sleep."]},"explanation":"As duas frases expressam uma rotina de leitura antes de dormir.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"simple_present","difficulty_level":3,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u4-l4-e5","position":5,"type":"MATCHING","instruction":"Associe cada expressão ao significado.","prompt":"Encontre os pares correspondentes.","options":[],"word_bank":[],"left_items":["read a book","help at home","walk to school"],"right_items":["ler um livro","ajudar em casa","ir a pé para a escola"],"audio_text":null,"accepted_answers":[],"answer_key":{"pairs":{"read a book":"ler um livro","help at home":"ajudar em casa","walk to school":"ir a pé para a escola"}},"explanation":"Cada expressão apresenta um hábito cotidiano.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"daily_habits","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u4-l4-e6","position":6,"type":"FILL_BLANK","instruction":"Escolha a palavra que completa a frase.","prompt":"My sister ___ her homework after lunch.","options":["does","do","is"],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["does"],"answer_key":{"accepted":["does"]},"explanation":"Com “my sister” (she), usamos “does”.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"simple_present","difficulty_level":3,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u4-l4-e7","position":7,"type":"SPEAKING","instruction":"Ouça o exemplo e repita. A transcrição é apenas um apoio, não uma nota de pronúncia.","prompt":"Repita: “She studies English every day.”","options":[],"word_bank":[],"left_items":[],"right_items":[],"audio_text":"She studies English every day.","accepted_answers":["She studies English every day."],"answer_key":{"accepted":["She studies English every day."]},"explanation":"O retorno mostra palavras reconhecidas; não atribui uma nota de pronúncia.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"simple_present_speaking","difficulty_level":3,"dialogue_speaker":null,"dialogue_context":[]}]}]},{"id":"english-v2-unit-5","position":5,"title":"Conversas do cotidiano","description":"Converse sobre escola, família, objetos e lugares.","content_version":3,"author":"Equipe de conteúdo Tec Escola","lessons":[{"id":"english-v2-u5-l1","position":1,"title":"Na escola","introduction":"Diálogos escolares podem começar com uma pergunta sobre um objeto ou uma sala e continuar com uma resposta útil.\n\nObjetivo: Usar perguntas curtas para pedir e oferecer informação na escola.","xp_reward":30,"content_version":3,"author":"Equipe de conteúdo Tec Escola","exercises":[{"id":"english-v2-u5-l1-e1","position":1,"type":"MULTIPLE_CHOICE","instruction":"Conversa guiada · escolha uma resposta que mantenha o diálogo.","prompt":"Where is the science room?","options":["It is next to the library.","I wake up at six.","My aunt is a teacher."],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["It is next to the library."],"answer_key":{"accepted":["It is next to the library."]},"explanation":"A pergunta “Where is…” pede um lugar.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"school_vocabulary","difficulty_level":2,"dialogue_speaker":"Alex","dialogue_context":[]},{"id":"english-v2-u5-l1-e2","position":2,"type":"MULTIPLE_CHOICE","instruction":"Conversa guiada · escolha uma resposta que mantenha o diálogo.","prompt":"Can I borrow your pencil?","options":["Sure, here you are.","It starts on Monday.","She reads at home."],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["Sure, here you are."],"answer_key":{"accepted":["Sure, here you are."]},"explanation":"“Sure, here you are” é uma resposta natural ao emprestar um objeto.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"school_vocabulary","difficulty_level":2,"dialogue_speaker":"Alex","dialogue_context":[{"speaker":"Alex","text":"Where is the science room?"},{"speaker":"Você","text":"It is next to the library."}]},{"id":"english-v2-u5-l1-e3","position":3,"type":"WORD_ORDER","instruction":"Monte a frase na ordem correta.","prompt":"Monte: “A biblioteca fica perto da sala de música.”","options":[],"word_bank":["room.","music","the","near","is","library","The"],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["The library is near the music room."],"answer_key":{"accepted":["The library is near the music room."]},"explanation":"“Near” indica que um lugar fica perto de outro.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"school_vocabulary","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u5-l1-e4","position":4,"type":"LISTENING","instruction":"Ouça a fala e responda sem ver a transcrição.","prompt":"Qual material a pessoa precisa?","options":[],"word_bank":[],"left_items":[],"right_items":[],"audio_text":"I need my notebook for class.","accepted_answers":["notebook","my notebook"],"answer_key":{"accepted":["notebook","my notebook"]},"explanation":"A palavra ouvida é “notebook”, caderno.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"school_listening","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u5-l1-e5","position":5,"type":"MATCHING","instruction":"Associe cada expressão ao significado.","prompt":"Encontre os pares correspondentes.","options":[],"word_bank":[],"left_items":["notebook","pencil","classroom"],"right_items":["caderno","lápis","sala de aula"],"audio_text":null,"accepted_answers":[],"answer_key":{"pairs":{"notebook":"caderno","pencil":"lápis","classroom":"sala de aula"}},"explanation":"São palavras frequentes no ambiente escolar.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"school_objects","difficulty_level":1,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u5-l1-e6","position":6,"type":"FILL_BLANK","instruction":"Escolha a palavra que completa a frase.","prompt":"The art room is ___ the library.","options":["near","seven","brother"],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["near"],"answer_key":{"accepted":["near"]},"explanation":"“Near” conecta dois lugares próximos.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"school_vocabulary","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u5-l1-e7","position":7,"type":"SPEAKING","instruction":"Ouça o exemplo e repita. A transcrição é apenas um apoio, não uma nota de pronúncia.","prompt":"Repita: “Can I borrow your notebook?”","options":[],"word_bank":[],"left_items":[],"right_items":[],"audio_text":"Can I borrow your notebook?","accepted_answers":["Can I borrow your notebook?"],"answer_key":{"accepted":["Can I borrow your notebook?"]},"explanation":"A transcrição é uma ajuda opcional; você também pode digitar.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"school_speaking","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]}]},{"id":"english-v2-u5-l2","position":2,"title":"Minha família","introduction":"Para perguntar idade, use “How old…?”. Responda com “I am…” ou “He/She is…”.\n\nObjetivo: Usar vocabulário familiar e perguntas simples sobre idade e parentesco.","xp_reward":30,"content_version":3,"author":"Equipe de conteúdo Tec Escola","exercises":[{"id":"english-v2-u5-l2-e1","position":1,"type":"MULTIPLE_CHOICE","instruction":"Conversa guiada · escolha uma resposta que mantenha o diálogo.","prompt":"How old is your sister?","options":["She is twelve years old.","The station is on the left.","My class starts at eight."],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["She is twelve years old."],"answer_key":{"accepted":["She is twelve years old."]},"explanation":"“How old” pergunta idade; “she is twelve” responde.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"family_vocabulary","difficulty_level":2,"dialogue_speaker":"Ravi","dialogue_context":[]},{"id":"english-v2-u5-l2-e2","position":2,"type":"MULTIPLE_CHOICE","instruction":"Conversa guiada · escolha uma resposta que mantenha o diálogo.","prompt":"What does she like to do?","options":["She likes drawing with me.","It is next to the bank.","We study on Thursday."],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["She likes drawing with me."],"answer_key":{"accepted":["She likes drawing with me."]},"explanation":"A resposta mantém o assunto sobre a irmã.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"family_vocabulary","difficulty_level":2,"dialogue_speaker":"Ravi","dialogue_context":[{"speaker":"Ravi","text":"How old is your sister?"},{"speaker":"Você","text":"She is twelve years old."}]},{"id":"english-v2-u5-l2-e3","position":3,"type":"TRANSLATION","instruction":"Escreva uma tradução natural em inglês.","prompt":"Meu primo mora com a família.","options":[],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["My cousin lives with his family.","My cousin lives with her family."],"answer_key":{"accepted":["My cousin lives with his family.","My cousin lives with her family."]},"explanation":"O gênero de “cousin” não é indicado pela palavra em inglês; as duas formas são possíveis.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"family_vocabulary","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u5-l2-e4","position":4,"type":"LISTENING","instruction":"Ouça a fala e responda sem ver a transcrição.","prompt":"Quem mora com a pessoa?","options":[],"word_bank":[],"left_items":[],"right_items":[],"audio_text":"My grandmother lives with us.","accepted_answers":["grandmother","my grandmother"],"answer_key":{"accepted":["grandmother","my grandmother"]},"explanation":"“Grandmother” significa avó.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"family_listening","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u5-l2-e5","position":5,"type":"MATCHING","instruction":"Associe cada expressão ao significado.","prompt":"Encontre os pares correspondentes.","options":[],"word_bank":[],"left_items":["cousin","grandmother","brother"],"right_items":["primo ou prima","avó","irmão"],"audio_text":null,"accepted_answers":[],"answer_key":{"pairs":{"cousin":"primo ou prima","grandmother":"avó","brother":"irmão"}},"explanation":"“Cousin” serve para primo ou prima; o contexto informa a pessoa.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"family_words","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u5-l2-e6","position":6,"type":"FILL_BLANK","instruction":"Escolha a palavra que completa a frase.","prompt":"My aunt’s son is my ___.","options":["cousin","classroom","Tuesday"],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["cousin"],"answer_key":{"accepted":["cousin"]},"explanation":"O filho da sua tia ou do seu tio é seu primo ou sua prima.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"family_vocabulary","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u5-l2-e7","position":7,"type":"SPEAKING","instruction":"Ouça o exemplo e repita. A transcrição é apenas um apoio, não uma nota de pronúncia.","prompt":"Repita: “My family has dinner together.”","options":[],"word_bank":[],"left_items":[],"right_items":[],"audio_text":"My family has dinner together.","accepted_answers":["My family has dinner together."],"answer_key":{"accepted":["My family has dinner together."]},"explanation":"O reconhecimento de voz apenas transcreve o que percebe; não mede fonética.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"family_speaking","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]}]},{"id":"english-v2-u5-l3","position":3,"title":"Lugares da cidade","introduction":"“Where is…?” pergunta onde fica algo. “Turn left” e “turn right” indicam virar à esquerda ou à direita.\n\nObjetivo: Perguntar onde fica um lugar e entender instruções curtas de direção.","xp_reward":30,"content_version":3,"author":"Equipe de conteúdo Tec Escola","exercises":[{"id":"english-v2-u5-l3-e1","position":1,"type":"MULTIPLE_CHOICE","instruction":"Conversa guiada · escolha uma resposta que mantenha o diálogo.","prompt":"Excuse me, where is the bus station?","options":["It is across from the park.","I read before bed.","My father is forty."],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["It is across from the park."],"answer_key":{"accepted":["It is across from the park."]},"explanation":"A resposta informa a localização da estação.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"directions_places","difficulty_level":2,"dialogue_speaker":"Sofia","dialogue_context":[]},{"id":"english-v2-u5-l3-e2","position":2,"type":"MULTIPLE_CHOICE","instruction":"Conversa guiada · escolha uma resposta que mantenha o diálogo.","prompt":"How can I get there?","options":["Go straight and turn left.","She has a blue notebook.","We have lunch at noon."],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["Go straight and turn left."],"answer_key":{"accepted":["Go straight and turn left."]},"explanation":"A resposta dá duas instruções de direção.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"directions_places","difficulty_level":3,"dialogue_speaker":"Sofia","dialogue_context":[{"speaker":"Sofia","text":"Excuse me, where is the bus station?"},{"speaker":"Você","text":"It is across from the park."}]},{"id":"english-v2-u5-l3-e3","position":3,"type":"WORD_ORDER","instruction":"Monte a frase na ordem correta.","prompt":"Monte: “Vire à direita na esquina.”","options":[],"word_bank":["corner.","the","at","right","Turn"],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["Turn right at the corner."],"answer_key":{"accepted":["Turn right at the corner."]},"explanation":"“Turn right” significa virar à direita.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"directions_places","difficulty_level":3,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u5-l3-e4","position":4,"type":"TRANSLATION","instruction":"Escreva uma tradução natural em inglês.","prompt":"O mercado fica atrás da escola.","options":[],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["The market is behind the school."],"answer_key":{"accepted":["The market is behind the school."]},"explanation":"“Behind” significa atrás de.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"directions_places","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u5-l3-e5","position":5,"type":"LISTENING","instruction":"Ouça a fala e responda sem ver a transcrição.","prompt":"Para qual lado a pessoa deve virar?","options":[],"word_bank":[],"left_items":[],"right_items":[],"audio_text":"Turn left at the next street.","accepted_answers":["left","turn left"],"answer_key":{"accepted":["left","turn left"]},"explanation":"“Left” significa esquerda.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"directions_listening","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u5-l3-e6","position":6,"type":"FILL_BLANK","instruction":"Escolha a palavra que completa a frase.","prompt":"The bank is ___ the library and the café.","options":["between","Monday","sister"],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["between"],"answer_key":{"accepted":["between"]},"explanation":"“Between” indica que algo fica entre dois lugares.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"directions_places","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u5-l3-e7","position":7,"type":"SPEAKING","instruction":"Ouça o exemplo e repita. A transcrição é apenas um apoio, não uma nota de pronúncia.","prompt":"Repita: “Go straight and turn left.”","options":[],"word_bank":[],"left_items":[],"right_items":[],"audio_text":"Go straight and turn left.","accepted_answers":["Go straight and turn left."],"answer_key":{"accepted":["Go straight and turn left."]},"explanation":"Repita se quiser e use a transcrição como referência, sem nota de pronúncia.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"directions_speaking","difficulty_level":3,"dialogue_speaker":null,"dialogue_context":[]}]},{"id":"english-v2-u5-l4","position":4,"title":"Objetos e perguntas","introduction":"Perguntas simples ajudam a descobrir o que é um objeto ou onde está. Preste atenção na resposta e mantenha o diálogo.\n\nObjetivo: Usar “this”, “where” e expressões de posição em perguntas curtas sobre objetos e lugares.","xp_reward":30,"content_version":3,"author":"Equipe de conteúdo Tec Escola","exercises":[{"id":"english-v2-u5-l4-e1","position":1,"type":"MULTIPLE_CHOICE","instruction":"Conversa guiada · escolha uma resposta que mantenha o diálogo.","prompt":"What is this?","options":["It is a map of the city.","I wake up at seven.","He visits on Sunday."],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["It is a map of the city."],"answer_key":{"accepted":["It is a map of the city."]},"explanation":"“What is this?” pergunta o que é o objeto apresentado.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"object_questions","difficulty_level":2,"dialogue_speaker":"Maya","dialogue_context":[]},{"id":"english-v2-u5-l4-e2","position":2,"type":"MULTIPLE_CHOICE","instruction":"Conversa guiada · escolha uma resposta que mantenha o diálogo.","prompt":"Where can I find the history book?","options":["It is on the shelf by the window.","My brother is thirteen.","We play soccer on Saturday."],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["It is on the shelf by the window."],"answer_key":{"accepted":["It is on the shelf by the window."]},"explanation":"A resposta indica o lugar do livro.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"object_questions","difficulty_level":3,"dialogue_speaker":"Maya","dialogue_context":[{"speaker":"Maya","text":"I need the history book for class."},{"speaker":"Você","text":"Let’s look for it in the library."}]},{"id":"english-v2-u5-l4-e3","position":3,"type":"WORD_ORDER","instruction":"Monte a frase na ordem correta.","prompt":"Monte: “Onde fica a entrada do museu?”","options":[],"word_bank":["entrance?","museum","the","is","Where"],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["Where is the museum entrance?"],"answer_key":{"accepted":["Where is the museum entrance?"]},"explanation":"Em perguntas com “where”, o lugar vem depois do verbo “is”.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"object_questions","difficulty_level":3,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u5-l4-e4","position":4,"type":"TRANSLATION","instruction":"Escreva uma tradução natural em inglês.","prompt":"A chave está sobre a mesa.","options":[],"word_bank":[],"left_items":[],"right_items":[],"audio_text":null,"accepted_answers":["The key is on the table."],"answer_key":{"accepted":["The key is on the table."]},"explanation":"“On the table” significa sobre a mesa.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"object_questions","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u5-l4-e5","position":5,"type":"LISTENING","instruction":"Ouça a fala e responda sem ver a transcrição.","prompt":"Onde está a mochila?","options":[],"word_bank":[],"left_items":[],"right_items":[],"audio_text":"The backpack is under the chair.","accepted_answers":["under the chair"],"answer_key":{"accepted":["under the chair"]},"explanation":"“Under the chair” significa embaixo da cadeira.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"object_listening","difficulty_level":3,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u5-l4-e6","position":6,"type":"MATCHING","instruction":"Associe cada expressão ao significado.","prompt":"Encontre os pares correspondentes.","options":[],"word_bank":[],"left_items":["on the table","under the chair","by the window"],"right_items":["sobre a mesa","embaixo da cadeira","perto da janela"],"audio_text":null,"accepted_answers":[],"answer_key":{"pairs":{"on the table":"sobre a mesa","under the chair":"embaixo da cadeira","by the window":"perto da janela"}},"explanation":"As expressões indicam posição ou proximidade.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"object_positions","difficulty_level":2,"dialogue_speaker":null,"dialogue_context":[]},{"id":"english-v2-u5-l4-e7","position":7,"type":"SPEAKING","instruction":"Ouça o exemplo e repita. A transcrição é apenas um apoio, não uma nota de pronúncia.","prompt":"Repita: “Where is the museum entrance?”","options":[],"word_bank":[],"left_items":[],"right_items":[],"audio_text":"Where is the museum entrance?","accepted_answers":["Where is the museum entrance?"],"answer_key":{"accepted":["Where is the museum entrance?"]},"explanation":"O microfone é opcional; o texto pode ser digitado.","content_version":3,"author":"Equipe de conteúdo Tec Escola","skill_code":"object_speaking","difficulty_level":3,"dialogue_speaker":null,"dialogue_context":[]}]}]}]}'::jsonb then
    raise exception 'TEC_IDIOMAS_V63_V2_SOURCE_DRIFT';
  end if;
  update public.tec_english_exercises
     set exercise_type = 'SPEAKING',
         instruction = 'Ouça o exemplo e repita. A transcrição é apenas um apoio, não uma nota de pronúncia.',
         prompt = 'Repita: “I get dressed and leave at eight.”',
         options = '[]'::jsonb,
         word_bank = '[]'::jsonb,
         left_items = '[]'::jsonb,
         right_items = '[]'::jsonb,
         audio_text = 'I get dressed and leave at eight.',
         accepted_answers = '["I get dressed and leave at eight."]'::jsonb,
         answer_key = '{"accepted":["I get dressed and leave at eight."]}'::jsonb,
         explanation = 'A fala opcional ajuda a praticar a rotina; o sistema não atribui nota de pronúncia.',
         skill_code = 'routine_speaking',
         difficulty_level = 2,
         dialogue_speaker = null,
         dialogue_context = '[]'::jsonb,
         content_version = 4,
         publication_status = 'STAGING',
         review_status = 'PEDAGOGICAL_REVIEW_PENDING'
   where id = 'english-v2-u4-l1-e2'
     and lesson_id = 'english-v2-u4-l1'
     and position = 2
     and exercise_type = 'MULTIPLE_CHOICE'
     and content_version = 3;
  get diagnostics v_changed = row_count;
  if v_changed <> 1 then raise exception 'TEC_IDIOMAS_V63_REPLACEMENT_DRIFT:english-v2-u4-l1'; end if;
  update public.tec_english_exercises
     set exercise_type = 'FILL_BLANK',
         instruction = 'Escolha a palavra que completa a frase.',
         prompt = 'I ___ my homework after class.',
         options = '["do","does","am"]'::jsonb,
         word_bank = '[]'::jsonb,
         left_items = '[]'::jsonb,
         right_items = '[]'::jsonb,
         audio_text = null,
         accepted_answers = '["do"]'::jsonb,
         answer_key = '{"accepted":["do"]}'::jsonb,
         explanation = 'Com “I”, usamos “do”: “I do my homework”.',
         skill_code = 'homework_routine',
         difficulty_level = 2,
         dialogue_speaker = null,
         dialogue_context = '[]'::jsonb,
         content_version = 4,
         publication_status = 'STAGING',
         review_status = 'PEDAGOGICAL_REVIEW_PENDING'
   where id = 'english-v2-u4-l2-e2'
     and lesson_id = 'english-v2-u4-l2'
     and position = 2
     and exercise_type = 'MULTIPLE_CHOICE'
     and content_version = 3;
  get diagnostics v_changed = row_count;
  if v_changed <> 1 then raise exception 'TEC_IDIOMAS_V63_REPLACEMENT_DRIFT:english-v2-u4-l2'; end if;
  update public.tec_english_exercises
     set exercise_type = 'MATCHING',
         instruction = 'Associe cada expressão ao significado.',
         prompt = 'Encontre os pares correspondentes.',
         options = '[]'::jsonb,
         word_bank = '[]'::jsonb,
         left_items = '["Saturday","Sunday","Monday"]'::jsonb,
         right_items = '["sábado","domingo","segunda-feira"]'::jsonb,
         audio_text = null,
         accepted_answers = '[]'::jsonb,
         answer_key = '{"pairs":{"Saturday":"sábado","Sunday":"domingo","Monday":"segunda-feira"}}'::jsonb,
         explanation = 'Reconheça os dias da semana e use “on” antes do dia em inglês.',
         skill_code = 'days_and_plans',
         difficulty_level = 2,
         dialogue_speaker = null,
         dialogue_context = '[]'::jsonb,
         content_version = 4,
         publication_status = 'STAGING',
         review_status = 'PEDAGOGICAL_REVIEW_PENDING'
   where id = 'english-v2-u4-l3-e2'
     and lesson_id = 'english-v2-u4-l3'
     and position = 2
     and exercise_type = 'MULTIPLE_CHOICE'
     and content_version = 3;
  get diagnostics v_changed = row_count;
  if v_changed <> 1 then raise exception 'TEC_IDIOMAS_V63_REPLACEMENT_DRIFT:english-v2-u4-l3'; end if;
  update public.tec_english_exercises
     set exercise_type = 'LISTENING',
         instruction = 'Ouça a fala e responda sem ver a transcrição.',
         prompt = 'O que ele faz depois de ler?',
         options = '[]'::jsonb,
         word_bank = '[]'::jsonb,
         left_items = '[]'::jsonb,
         right_items = '[]'::jsonb,
         audio_text = 'He reads and then plays music.',
         accepted_answers = '["plays music"]'::jsonb,
         answer_key = '{"accepted":["plays music"]}'::jsonb,
         explanation = 'A expressão “then plays music” informa o que acontece depois da leitura.',
         skill_code = 'daily_habits_listening',
         difficulty_level = 2,
         dialogue_speaker = null,
         dialogue_context = '[]'::jsonb,
         content_version = 4,
         publication_status = 'STAGING',
         review_status = 'PEDAGOGICAL_REVIEW_PENDING'
   where id = 'english-v2-u4-l4-e2'
     and lesson_id = 'english-v2-u4-l4'
     and position = 2
     and exercise_type = 'MULTIPLE_CHOICE'
     and content_version = 3;
  get diagnostics v_changed = row_count;
  if v_changed <> 1 then raise exception 'TEC_IDIOMAS_V63_REPLACEMENT_DRIFT:english-v2-u4-l4'; end if;
  update public.tec_english_exercises
     set exercise_type = 'TRANSLATION',
         instruction = 'Escreva uma tradução natural em inglês.',
         prompt = 'A sala de ciências fica ao lado da biblioteca.',
         options = '[]'::jsonb,
         word_bank = '[]'::jsonb,
         left_items = '[]'::jsonb,
         right_items = '[]'::jsonb,
         audio_text = null,
         accepted_answers = '["The science room is next to the library."]'::jsonb,
         answer_key = '{"accepted":["The science room is next to the library."]}'::jsonb,
         explanation = '“Next to” indica que a sala de ciências fica ao lado da biblioteca.',
         skill_code = 'school_places',
         difficulty_level = 2,
         dialogue_speaker = null,
         dialogue_context = '[]'::jsonb,
         content_version = 4,
         publication_status = 'STAGING',
         review_status = 'PEDAGOGICAL_REVIEW_PENDING'
   where id = 'english-v2-u5-l1-e2'
     and lesson_id = 'english-v2-u5-l1'
     and position = 2
     and exercise_type = 'MULTIPLE_CHOICE'
     and content_version = 3;
  get diagnostics v_changed = row_count;
  if v_changed <> 1 then raise exception 'TEC_IDIOMAS_V63_REPLACEMENT_DRIFT:english-v2-u5-l1'; end if;
  update public.tec_english_exercises
     set exercise_type = 'WORD_ORDER',
         instruction = 'Monte a frase na ordem correta.',
         prompt = 'Monte: “Meu primo mora com a família dele.”',
         options = '[]'::jsonb,
         word_bank = '["family.","his","with","lives","cousin","My"]'::jsonb,
         left_items = '[]'::jsonb,
         right_items = '[]'::jsonb,
         audio_text = null,
         accepted_answers = '["My cousin lives with his family."]'::jsonb,
         answer_key = '{"accepted":["My cousin lives with his family."]}'::jsonb,
         explanation = 'Use “lives” com “my cousin” e “with his family” para completar a ideia.',
         skill_code = 'family_living_arrangements',
         difficulty_level = 2,
         dialogue_speaker = null,
         dialogue_context = '[]'::jsonb,
         content_version = 4,
         publication_status = 'STAGING',
         review_status = 'PEDAGOGICAL_REVIEW_PENDING'
   where id = 'english-v2-u5-l2-e2'
     and lesson_id = 'english-v2-u5-l2'
     and position = 2
     and exercise_type = 'MULTIPLE_CHOICE'
     and content_version = 3;
  get diagnostics v_changed = row_count;
  if v_changed <> 1 then raise exception 'TEC_IDIOMAS_V63_REPLACEMENT_DRIFT:english-v2-u5-l2'; end if;
  update public.tec_english_exercises
     set exercise_type = 'MATCHING',
         instruction = 'Associe cada expressão ao significado.',
         prompt = 'Encontre os pares correspondentes.',
         options = '[]'::jsonb,
         word_bank = '[]'::jsonb,
         left_items = '["go straight","turn left","turn right"]'::jsonb,
         right_items = '["siga em frente","vire à esquerda","vire à direita"]'::jsonb,
         audio_text = null,
         accepted_answers = '[]'::jsonb,
         answer_key = '{"pairs":{"go straight":"siga em frente","turn left":"vire à esquerda","turn right":"vire à direita"}}'::jsonb,
         explanation = 'As expressões indicam três instruções comuns para pedir ou dar direções.',
         skill_code = 'directions',
         difficulty_level = 2,
         dialogue_speaker = null,
         dialogue_context = '[]'::jsonb,
         content_version = 4,
         publication_status = 'STAGING',
         review_status = 'PEDAGOGICAL_REVIEW_PENDING'
   where id = 'english-v2-u5-l3-e2'
     and lesson_id = 'english-v2-u5-l3'
     and position = 2
     and exercise_type = 'MULTIPLE_CHOICE'
     and content_version = 3;
  get diagnostics v_changed = row_count;
  if v_changed <> 1 then raise exception 'TEC_IDIOMAS_V63_REPLACEMENT_DRIFT:english-v2-u5-l3'; end if;
  update public.tec_english_exercises
     set exercise_type = 'FILL_BLANK',
         instruction = 'Escolha a palavra que completa a frase.',
         prompt = 'The history book is on the ___ by the window.',
         options = '["shelf","turn","brother"]'::jsonb,
         word_bank = '[]'::jsonb,
         left_items = '[]'::jsonb,
         right_items = '[]'::jsonb,
         audio_text = null,
         accepted_answers = '["shelf"]'::jsonb,
         answer_key = '{"accepted":["shelf"]}'::jsonb,
         explanation = '“Shelf” significa prateleira: o livro está na prateleira perto da janela.',
         skill_code = 'classroom_objects',
         difficulty_level = 2,
         dialogue_speaker = null,
         dialogue_context = '[]'::jsonb,
         content_version = 4,
         publication_status = 'STAGING',
         review_status = 'PEDAGOGICAL_REVIEW_PENDING'
   where id = 'english-v2-u5-l4-e2'
     and lesson_id = 'english-v2-u5-l4'
     and position = 2
     and exercise_type = 'MULTIPLE_CHOICE'
     and content_version = 3;
  get diagnostics v_changed = row_count;
  if v_changed <> 1 then raise exception 'TEC_IDIOMAS_V63_REPLACEMENT_DRIFT:english-v2-u5-l4'; end if;
  update public.tec_english_courses set content_version = 4, publication_status = 'STAGING', review_status = 'PEDAGOGICAL_REVIEW_PENDING', updated_at = now() where course_code = 'TEC_ENGLISH_FOUNDATIONS_V2' and content_version = 3;
  get diagnostics v_changed = row_count; if v_changed <> 1 then raise exception 'TEC_IDIOMAS_V63_V2_COURSE_UPDATE_COUNT'; end if;
  update public.tec_english_units set content_version = 4, publication_status = 'STAGING', review_status = 'PEDAGOGICAL_REVIEW_PENDING' where course_code = 'TEC_ENGLISH_FOUNDATIONS_V2' and content_version = 3;
  get diagnostics v_changed = row_count; if v_changed <> 2 then raise exception 'TEC_IDIOMAS_V63_V2_UNIT_UPDATE_COUNT'; end if;
  update public.tec_english_lessons lesson set content_version = 4, publication_status = 'STAGING', review_status = 'PEDAGOGICAL_REVIEW_PENDING' from public.tec_english_units unit where unit.id = lesson.unit_id and unit.course_code = 'TEC_ENGLISH_FOUNDATIONS_V2' and lesson.content_version = 3;
  get diagnostics v_changed = row_count; if v_changed <> 8 then raise exception 'TEC_IDIOMAS_V63_V2_LESSON_UPDATE_COUNT'; end if;
  update public.tec_english_exercises exercise set content_version = 4, publication_status = 'STAGING', review_status = 'PEDAGOGICAL_REVIEW_PENDING' from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id where lesson.id = exercise.lesson_id and unit.course_code = 'TEC_ENGLISH_FOUNDATIONS_V2' and exercise.content_version = 3;
  get diagnostics v_changed = row_count; if v_changed <> 48 then raise exception 'TEC_IDIOMAS_V63_V2_REMAINING_EXERCISE_UPDATE_COUNT'; end if;
  if exists (select 1 from public.tec_english_courses where course_code = 'TEC_ENGLISH_FOUNDATIONS_V2' and (publication_status <> 'STAGING' or review_status <> 'PEDAGOGICAL_REVIEW_PENDING')) or exists (select 1 from public.tec_english_units where course_code = 'TEC_ENGLISH_FOUNDATIONS_V2' and (publication_status <> 'STAGING' or review_status <> 'PEDAGOGICAL_REVIEW_PENDING')) or exists (select 1 from public.tec_english_lessons lesson join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = 'TEC_ENGLISH_FOUNDATIONS_V2' and (lesson.publication_status <> 'STAGING' or lesson.review_status <> 'PEDAGOGICAL_REVIEW_PENDING')) or exists (select 1 from public.tec_english_exercises exercise join public.tec_english_lessons lesson on lesson.id = exercise.lesson_id join public.tec_english_units unit on unit.id = lesson.unit_id where unit.course_code = 'TEC_ENGLISH_FOUNDATIONS_V2' and (exercise.publication_status <> 'STAGING' or exercise.review_status <> 'PEDAGOGICAL_REVIEW_PENDING')) then raise exception 'TEC_IDIOMAS_V63_V2_REVIEW_STATE_INVALID'; end if;
  if not private.tec_english_course_structure_valid_v2('TEC_ENGLISH_FOUNDATIONS_V2', 4) then raise exception 'TEC_IDIOMAS_V63_V2_STRUCTURE_INVALID'; end if;
  if (select publication_status <> 'STAGING' or review_status <> 'PEDAGOGICAL_REVIEW_PENDING' from public.tec_english_courses where course_code = 'TEC_ENGLISH_FOUNDATIONS_V2') then raise exception 'TEC_IDIOMAS_V63_V2_REVIEW_STATE_INVALID'; end if;
end $tec_english_v2_v4_content$;
-- END GENERATED TEC ENGLISH V2 V4 SNAPSHOT UPDATE

commit;
