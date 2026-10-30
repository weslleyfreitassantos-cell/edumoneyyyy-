import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261030000100_tec_idiomas_v63_ui_reset_activity.sql'), 'utf8').replace(/\r\n/g, '\n');

describe('Tec Idiomas V6.3 migration contract', () => {
  it('keeps content promotion behind the existing human review and profile-specific structure checks', () => {
    expect(migration).toContain('private.tec_english_course_structure_valid_v2');
    expect(migration).toContain("('TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER', 1)");
    expect(migration).toContain("('TEC_SPANISH_FOUNDATIONS_V2_BEGINNER', 1)");
    expect(migration).toContain("('TEC_KOREAN_FOUNDATIONS_V2_BEGINNER', 1)");
    expect(migration).toContain("('TEC_ENGLISH_FOUNDATIONS_V2', 4)");
    expect(migration).toContain("<> 4");
    expect(migration).toContain("<> 7");
    expect(migration).toContain("raise exception 'TEC_ENGLISH_REVIEW_CONTENT_INCOMPLETE'");
    expect(migration).toContain("decision = 'APPROVED'");
    expect(migration).toContain("review_status = 'PEDAGOGICAL_REVIEW_PENDING'");
    const reviewInsert = migration.search(/insert\s+into\s+public\.tec_english_pedagogical_reviews/i);
    expect(reviewInsert).toBeGreaterThan(-1);
    expect(migration.match(/insert\s+into\s+public\.tec_english_pedagogical_reviews/gi)).toHaveLength(1);
    expect(migration.indexOf('if not public.is_platform_super_admin()')).toBeLessThan(reviewInsert);
  });

  it('limits activity reset to the authenticated student’s active session in the requested institution/course', () => {
    expect(migration).toContain('private.tec_english_current_student_id(p_institution_id)');
    expect(migration).toMatch(/if p_course_code not in \([\s\S]{0,300}'TEC_ENGLISH_FOUNDATIONS'/);
    expect(migration).toContain("session.status = 'IN_PROGRESS'");
    expect(migration).toContain('session.student_id = v_student_id');
    expect(migration).toContain('session.institution_id = p_institution_id');
    expect(migration).toContain('session.lesson_id = p_lesson_id');
    expect(migration).toContain('unit.course_code = p_course_code');
    expect(migration).toContain('tec_language_reset_activity_idempotency_v1');
    expect(migration).toContain('grant execute on function public.reset_tec_language_activity_v1(uuid, text, text, uuid) to authenticated');
    expect(migration).toContain('grant execute on function public.reset_tec_language_course_v1(uuid, text) to authenticated');
  });

  it('deletes only selected-language allowlisted progress and records a restricted audit trail', () => {
    expect(migration).toContain("when 'en' then array['TEC_ENGLISH_FOUNDATIONS'");
    expect(migration).toContain("when 'es' then array['TEC_SPANISH_FOUNDATIONS_V1'");
    expect(migration).toContain("when 'ko' then array['TEC_KOREAN_FOUNDATIONS_V1'");
    expect(migration).toContain('unit.course_code = any(v_codes)');
    expect(migration).toContain('stats.institution_id = p_institution_id and stats.student_id = v_student_id');
    expect(migration).toContain('placement.institution_id = p_institution_id and placement.student_id = v_student_id');
    expect(migration).toContain('alter table public.tec_language_reset_audit_v1 enable row level security');
    expect(migration).toContain('revoke all on table public.tec_language_reset_audit_v1 from public, anon, authenticated');
    expect(migration).toContain("'global_xp_removed', v_global_xp_removed");
    expect(migration).not.toContain('disable row level security');
  });

  it('requires the exact V2 V3 snapshot, no user activity or prior review, and preserves STAGING on version 4', () => {
    expect(migration).toContain("course_code = 'TEC_ENGLISH_FOUNDATIONS_V2' and content_version = 3 and publication_status = 'STAGING' and review_status = 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain('private.tec_english_course_snapshot(\'TEC_ENGLISH_FOUNDATIONS_V2\', 3)');
    expect(migration).toContain("raise exception 'TEC_IDIOMAS_V63_V2_REVIEW_OR_RELEASE_EXISTS'");
    expect(migration).toContain("raise exception 'TEC_IDIOMAS_V63_V2_STUDENT_ACTIVITY_EXISTS'");
    expect(migration).toContain("publication_status = 'STAGING', review_status = 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain('v_changed <> 48');
    expect(migration).toContain("private.tec_english_course_structure_valid_v2('TEC_ENGLISH_FOUNDATIONS_V2', 4)");
    expect(migration).toContain('-- BEGIN GENERATED TEC ENGLISH V2 V4 SNAPSHOT UPDATE');
    expect(migration).toContain('-- END GENERATED TEC ENGLISH V2 V4 SNAPSHOT UPDATE');
  });
});
