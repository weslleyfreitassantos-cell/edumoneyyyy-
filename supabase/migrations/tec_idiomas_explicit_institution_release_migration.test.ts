import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20261030000200_tec_idiomas_explicit_institution_release.sql', 'utf8');

describe('Tec Idiomas V7 explicit institution release gate', () => {
  it('requires exact published approval and an enabled release for the requesting active institution', () => {
    const available = migration.slice(
      migration.indexOf('create or replace function private.tec_english_course_available'),
      migration.indexOf('revoke all on function private.tec_english_course_available'),
    );
    expect(available).toContain("course.publication_status = 'PUBLISHED'");
    expect(available).toContain("course.review_status = 'PEDAGOGICAL_REVIEWED'");
    expect(available).toContain("review.decision = 'APPROVED'");
    expect(available).toContain('review.snapshot_fingerprint = private.tec_english_course_fingerprint');
    expect(available).toContain('release.institution_id = p_institution_id');
    expect(available).toContain('release.enabled');
    expect(available).toContain('institution.active');
    expect(available).not.toContain("course.publication_status in ('STAGING', 'PUBLISHED')");
  });

  it('keeps staging fixtures isolated to test mode and requires published approved lessons at runtime', () => {
    const available = migration.slice(
      migration.indexOf('create or replace function private.tec_english_course_available'),
      migration.indexOf('revoke all on function private.tec_english_course_available'),
    );
    const ready = migration.slice(
      migration.indexOf('create or replace function private.tec_english_lesson_ready'),
      migration.indexOf('revoke all on function private.tec_english_lesson_ready'),
    );
    expect(available).toContain('(p_test_mode and course.is_test_fixture)');
    expect(ready).toContain('(p_test_mode and course.is_test_fixture)');
    expect(ready).toContain("course.publication_status = 'PUBLISHED'");
    expect(ready).toContain("lesson.review_status = 'PEDAGOGICAL_REVIEWED'");
    expect(ready).toContain('release.enabled');
  });
});
