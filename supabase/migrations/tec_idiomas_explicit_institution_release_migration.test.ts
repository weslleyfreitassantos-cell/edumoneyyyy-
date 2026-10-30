import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20261030000200_tec_idiomas_explicit_institution_release.sql', 'utf8');

function functionBody(start: string, end: string) {
  const startIndex = migration.indexOf(start);
  const endIndex = migration.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThan(-1);
  expect(endIndex).toBeGreaterThan(startIndex);
  return migration.slice(startIndex, endIndex);
}

describe('Tec Idiomas V8 publication and explicit institution release', () => {
  it('makes only a technically published, structurally eligible course available to its explicitly released active institution', () => {
    const available = functionBody(
      'create or replace function private.tec_english_course_available',
      'revoke all on function private.tec_english_course_available',
    );
    expect(available).toContain("course.publication_status = 'PUBLISHED'");
    expect(available).toContain('private.tec_idiomas_v8_course_version_allowed');
    expect(available).toContain('private.tec_english_course_structure_valid_v2');
    expect(available).toContain('private.tec_idiomas_v3_course_content_eligible');
    expect(available).toContain('release.institution_id = p_institution_id');
    expect(available).toContain('release.enabled');
    expect(available).toContain('institution.active');
    expect(available).toContain('(p_test_mode and course.is_test_fixture)');
    expect(available).not.toMatch(/review_status|pedagogical_reviews|snapshot_fingerprint|decision\s*=\s*'APPROVED'/i);
  });

  it('keeps lesson readiness bound to published versions and exercises without editorial approval fields', () => {
    const ready = functionBody(
      'create or replace function private.tec_english_lesson_ready',
      'revoke all on function private.tec_english_lesson_ready',
    );
    expect(ready).toContain('(p_test_mode and course.is_test_fixture)');
    expect(ready).toContain("course.publication_status = 'PUBLISHED'");
    expect(ready).toContain("unit.publication_status = 'PUBLISHED'");
    expect(ready).toContain("lesson.publication_status = 'PUBLISHED'");
    expect(ready).toContain("exercise.publication_status <> 'PUBLISHED'");
    expect(ready).toContain('lesson.content_version = course.content_version');
    expect(ready).not.toMatch(/review_status|pedagogical_reviews|snapshot_fingerprint|release\.enabled/i);
  });

  it('publishes exactly the eight fingerprint-bound canonical versions without enabling institutions or changing review state', () => {
    const publication = functionBody('do $tec_english_v8_publish$', '$tec_english_v8_publish$;');
    const expectedCodes = [
      'TEC_ENGLISH_FOUNDATIONS', 'TEC_ENGLISH_FOUNDATIONS_V2', 'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION',
      'TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER', 'TEC_KOREAN_FOUNDATIONS_V1', 'TEC_KOREAN_FOUNDATIONS_V2_BEGINNER',
      'TEC_SPANISH_FOUNDATIONS_V1', 'TEC_SPANISH_FOUNDATIONS_V2_BEGINNER',
    ];
    for (const code of expectedCodes) expect(publication).toContain(code);
    expect(publication).toContain('v_course_count <> 8');
    expect(publication).toContain('v_changed <> 8');
    expect(publication).toContain('v_changed <> 25');
    expect(publication).toContain('v_changed <> 100');
    expect(publication).toContain('v_changed <> 588');
    expect(publication).toContain('private.tec_english_course_fingerprint');
    expect(publication).toContain('v_fingerprint is distinct from v_expected.fingerprint');
    expect(publication).toContain("'TECHNICAL_CATALOG'");
    expect(publication).not.toMatch(/review_status|pedagogical_reviews|tec_english_course_releases|tec_language_|tec_english_xp/i);
    expect(publication).toContain('TEC_IDIOMAS_V8_PARTIAL_OR_UNEXPECTED_PUBLICATION_STATE');
    expect(migration).not.toMatch(/disable\s+row\s+level\s+security/i);
  });

  it('allows Super Admins to manage explicit releases without requiring review records', () => {
    const targets = functionBody(
      'create or replace function public.get_tec_english_release_targets_v1',
      'create or replace function public.set_tec_english_institution_release_v1',
    );
    const release = functionBody(
      'create or replace function public.set_tec_english_institution_release_v1',
      'revoke all on function public.get_tec_english_release_targets_v1',
    );
    for (const body of [targets, release]) {
      expect(body).toContain('public.is_platform_super_admin()');
      expect(body).toContain('private.tec_idiomas_v8_course_version_allowed');
      expect(body).not.toMatch(/review_status|pedagogical_reviews|snapshot_fingerprint|decision\s*=\s*'APPROVED'/i);
    }
    expect(targets).toContain('where item.active');
    expect(release).toContain('institution.active');
    expect(release).toContain('public.tec_english_course_release_events');
    expect(release).toContain("case when p_enabled then 'ENABLED' else 'DISABLED' end");
  });

  it('retires new pedagogical approval writes but preserves historical review data', () => {
    expect(migration).toContain("raise exception 'TEC_ENGLISH_PEDAGOGICAL_REVIEW_RETIRED'");
    expect(migration).toContain('revoke all on function public.review_tec_english_course_v1');
    expect(migration).toContain('revoke all on function public.get_tec_english_review_history_v1()');
    expect(migration).not.toMatch(/delete\s+from\s+public\.tec_english_pedagogical_reviews/i);
    expect(migration).not.toMatch(/truncate\s+table\s+public\.tec_english_pedagogical_reviews/i);
    expect(migration).toContain('private.tec_english_technical_publication_events');
    expect(migration).toContain('revoke all on table private.tec_english_technical_publication_events from public, anon, authenticated, service_role');
  });
});
