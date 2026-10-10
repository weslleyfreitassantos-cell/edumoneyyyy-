import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261010000300_bncc_global_journey_and_content_completion_v3.sql', import.meta.url),
  'utf8',
);

describe('BNCC global journey and content completion v3 migration', () => {
  it('normalizes explicit stage and grade markers without depending on school subjects', () => {
    expect(migration).toContain('normalize_learning_grade_context');
    expect(migration).toContain('s[ée]rie');
    expect(migration).toContain("'ENSINO_MEDIO'");
    expect(migration).toContain("'ENSINO_FUNDAMENTAL'");
    expect(migration).toContain('public.enrollments');
    expect(migration).not.toContain('public.subject_offerings');
    expect(migration).not.toContain('learning_curriculum_subject_links');
  });

  it('promotes only the validated EF06HI01 package with every guided purpose', () => {
    expect(migration).toContain("skill.code = 'EF06HI01'");
    expect(migration).toContain("'TECESCOLA_CORE_V4_HISTORY_PERIODIZATION'");
    expect(migration).toContain("'ADAPTIVE_READY'");
    expect(migration).toContain("pedagogical_review_status = 'TECH_VALIDATED'");
    expect(migration).toContain('"purpose":"PROBE"');
    expect(migration).toContain('"purpose":"PRACTICE"');
    expect(migration).toContain('"purpose":"TRANSFER"');
    expect(migration).toContain('"purpose":"LOCK_IN"');
    expect(migration).toContain('"purpose":"REVIEW"');
    expect(migration).toContain('knowledge_mapping_status');
    expect(migration).toContain('on conflict do nothing');
  });

  it('remains forward-only and idempotent', () => {
    expect(migration).not.toMatch(/drop\s+(table|column|function)/i);
    expect(migration).not.toMatch(/truncate\s/i);
    expect(migration).toContain('on conflict (canonical_skill_id, purpose, version)');
  });
});
