import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261010000100_complete_subject_practices_and_bncc_guided_learning_v1.sql', import.meta.url),
  'utf8',
);

describe('complete subject practices and BNCC guided learning v1 migration', () => {
  it('uses the canonical ENEM subject metadata and preserves media-aware readiness', () => {
    expect(migration).toContain("metadata->>'enem_subject'");
    expect(migration).toContain("'STRUCTURED_TEXT_WITH_MEDIA'");
    expect(migration).toContain('not structured.required_media_present or structured.required_media_validated');
    expect(migration).toContain('ready_count integer');
    expect(migration).toContain('availability_status text');
    expect(migration).toContain("when counted.pool_count >= counted.question_count then 'AVAILABLE'");
  });

  it('publishes only the explicitly validated BNCC mappings', () => {
    expect(migration).toContain("code = 'BNCC_2018'");
    expect(migration).toContain("'EF06HI01'");
    expect(migration).toContain("'EF09CI01'");
    expect(migration).toContain("bncc_alignment_status = 'MAPPED'");
    expect(migration).toContain('official_code');
    expect(migration).toContain('list_student_guided_learning_targets');
  });

  it('enforces institutional, grade and canonical-skill scope in the database', () => {
    expect(migration).toContain('validate_bncc_guided_session_scope');
    expect(migration).toContain('LEARNING_V4_BNCC_MAPPING_REQUIRED');
    expect(migration).toContain('LEARNING_V4_TARGET_NOT_ELIGIBLE');
    expect(migration).toContain('learning_curriculum_subject_links');
    expect(migration).toContain('enrollment_context');
    expect(migration).toContain("new.planner_version <> 'V4'");
    expect(migration).not.toMatch(/drop table/i);
    expect(migration).not.toMatch(/truncate\s/i);
  });
});
