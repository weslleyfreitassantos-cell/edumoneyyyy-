import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('./20261027000100_tec_idiomas_v3_runtime.sql', import.meta.url), 'utf8');

function functionBody(name: string): string {
  const start = migration.indexOf(`create or replace function ${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = migration.indexOf('\ncreate or replace function ', start + 1);
  return migration.slice(start, next < 0 ? undefined : next);
}

describe('Tec Idiomas V3 runtime migration', () => {
  it('keeps course-scoped stats private and limits write access to the database service', () => {
    expect(migration).toContain('create table public.tec_language_course_stats_v1');
    expect(migration).toContain('alter table public.tec_language_course_stats_v1 enable row level security');
    expect(migration).toContain('revoke all on table public.tec_language_course_stats_v1 from public, anon, authenticated');
    expect(migration).toContain('grant all on table public.tec_language_course_stats_v1 to service_role');
    expect(migration).not.toMatch(/create\s+policy[^;]*tec_language_course_stats_v1/i);
  });

  it('allowlists only the intended three courses and gates every runtime endpoint', () => {
    const allowlist = functionBody('private.tec_idiomas_v3_course_allowed');
    for (const code of [
      'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', 'TEC_SPANISH_FOUNDATIONS_V1', 'TEC_KOREAN_FOUNDATIONS_V1',
    ]) expect(allowlist).toContain(code);
    expect(allowlist).not.toContain('TEC_ENGLISH_FOUNDATIONS_V2_TEST');

    for (const name of [
      'public.get_tec_language_course_map_v1',
      'public.start_tec_language_lesson_v1',
      'public.get_tec_language_session_v1',
      'public.submit_tec_language_answer_v1',
    ]) {
      const body = functionBody(name);
      expect(body).toContain('private.tec_idiomas_v3_course_allowed(p_course_code)');
      expect(body).toContain('private.tec_english_current_student_id(p_institution_id)');
      expect(body).toContain('private.tec_english_course_available(p_institution_id, p_course_code, false)');
      expect(body).toContain('private.tec_english_lesson_ready');
      expect(body).toContain("set search_path = ''");
    }
  });

  it('makes only the exact V3 version-1 snapshots directly available to active institutions', () => {
    const versions = functionBody('private.tec_idiomas_v3_course_version_allowed');
    const content = functionBody('private.tec_idiomas_v3_course_content_eligible');
    const availability = functionBody('private.tec_english_course_available');
    expect(versions).toContain("('TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', 1)");
    expect(versions).toContain("('TEC_SPANISH_FOUNDATIONS_V1', 1)");
    expect(versions).toContain("('TEC_KOREAN_FOUNDATIONS_V1', 1)");
    expect(content).toContain('not course.is_test_fixture');
    expect(content).toContain("course.publication_status in ('STAGING', 'PUBLISHED')");
    expect(content).toContain('count(*) = 4');
    expect(content).toContain('count(*) = 16');
    expect(content).toContain('count(*) = 112');
    expect(content).toContain('count(*) = 2');
    expect(content).toContain('count(*) = 8');
    expect(content).toContain('count(*) = 56');
    expect(content).toContain('content_version <> course.content_version');
    expect(content).toContain('having count(exercise.id) <> 7');
    expect(content).not.toContain('review_status');
    expect(content).not.toContain('tec_english_pedagogical_reviews');
    expect(content).not.toContain('tec_english_course_releases');

    const v3Start = availability.indexOf('private.tec_idiomas_v3_course_version_allowed');
    const legacyStart = availability.indexOf('\n             or (', v3Start);
    const directBranch = availability.slice(v3Start, legacyStart);
    expect(directBranch).toContain('private.tec_idiomas_v3_course_content_eligible');
    expect(directBranch).toContain('institution.active');
    expect(directBranch).not.toContain('review_status');
    expect(directBranch).not.toContain('tec_english_course_releases');
    expect(availability).toContain("course.publication_status = 'PUBLISHED'");
    expect(availability).toContain("course.review_status = 'PEDAGOGICAL_REVIEWED'");
  });

  it('keeps V3 sessions out of the legacy aggregate XP and answer wrappers', () => {
    const start = functionBody('public.start_tec_english_lesson_v1');
    const session = functionBody('public.get_tec_english_session_v1');
    const answer = functionBody('public.submit_tec_english_answer_v1');
    expect(start).toContain("'TEC_ENGLISH_FOUNDATIONS'");
    expect(start).toContain('unit.course_code = v_course_code');
    expect(start).toContain('private.tec_english_start_lesson_unchecked_v1');
    for (const body of [session, answer]) {
      expect(body).toContain('v_course_code <> v_expected_course');
      expect(body).toContain('session.student_id = v_student_id');
      expect(body).toContain('private.tec_english_course_available');
    }
    expect(answer).toContain('private.tec_english_submit_answer_unchecked_v1');
  });

  it('never returns answer keys or accepted answers in the student exercise payload', () => {
    const exercise = functionBody('private.tec_english_public_exercise');
    expect(exercise).toContain('dialogue_context');
    expect(exercise).not.toContain('answer_key');
    expect(exercise).not.toContain('accepted_answers');
  });

  it('preserves the legacy English snapshot while fingerprinting metadata for the new allowlisted courses', () => {
    const snapshot = functionBody('private.tec_english_course_snapshot');
    for (const code of [
      'TEC_ENGLISH_FOUNDATIONS_V2', 'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION',
      'TEC_SPANISH_FOUNDATIONS_V1', 'TEC_KOREAN_FOUNDATIONS_V1',
    ]) expect(snapshot).toContain(code);
    expect(snapshot).toContain("'skill_code', exercise.skill_code");
    expect(snapshot).toContain("'dialogue_context', exercise.dialogue_context");
  });

  it('restores legacy English totals, records XP per course, and respects replay idempotency', () => {
    const submit = functionBody('public.submit_tec_language_answer_v1');
    expect(submit).toContain('for update');
    expect(submit).toContain('v_was_replay');
    expect(submit).toContain('private.tec_english_submit_answer_unchecked_v1');
    expect(submit).toContain('public.tec_language_course_stats_v1');
    expect(submit).toContain('v_old_stats.xp');
    expect(submit).toContain('v_old_stats.current_streak');
    expect(submit).toContain('not v_was_replay');
    expect(submit).toContain('v_had_xp_event');
    expect(submit).toContain("delete from public.tec_english_xp_events event");
  });

  it('grants the four public RPCs only to authenticated users and never auto-releases content', () => {
    expect(migration.match(/grant execute on function public\.get_tec_language_course_map_v1[\s\S]*?to authenticated/g)).toHaveLength(1);
    expect(migration).toContain('grant execute on function public.submit_tec_language_answer_v1');
    expect(migration).not.toMatch(/grant execute on function public\.get_tec_language_course_map_v1[^;]*to anon/i);
    expect(migration).not.toContain('insert into public.tec_english_course_releases');
    expect(migration).not.toContain('update public.tec_english_courses');
    expect(existsSync(new URL('./20261028000100_tec_idiomas_v3_beta_release.sql', import.meta.url))).toBe(false);
  });
});
