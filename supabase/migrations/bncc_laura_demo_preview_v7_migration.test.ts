import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261010000600_bncc_laura_demo_preview_v7.sql', import.meta.url),
  'utf8',
);

describe('Laura BNCC demonstration preview gate', () => {
  it('uses a private institution allowlist and keeps the pedagogical gate visible', () => {
    expect(migration).toContain('private.bncc_demo_preview_institutions');
    expect(migration).toContain('Laura Cristina Moreira');
    expect(migration).toContain('TECESCOLA_BNCC_HIGH_SCHOOL_FIRST_YEAR_V4');
    expect(migration).toContain('PEDAGOGICAL_REVIEW_PENDING');
    expect(migration).toContain('Prévia demonstrativa: conteúdo tecnicamente disponível; revisão pedagógica pendente.');
    expect(migration).not.toMatch(/update\s+public\.learning_curriculum_skills[\s\S]*publication_status\s*=\s*'PUBLISHED'/i);
  });

  it('requires institution, active enrollment, grade scope and complete technical content', () => {
    expect(migration).toContain('private.bncc_demo_preview_allowed(p_institution_id, p_student_id)');
    expect(migration).toContain("skill.publication_status = 'STAGING'");
    expect(migration).toContain("skill.content_readiness = 'CONTENT_READY'");
    expect(migration).toContain('not skill.mastery_targetable');
    expect(migration).toContain('normalize_learning_grade_context');
    expect(migration).toContain('learning_v2_scope_student');
    expect(migration).toContain('assert_published_v4_session_target');
    expect(migration).not.toMatch(/drop\s+table/i);
    expect(migration).not.toMatch(/truncate\s/i);
  });

  it('marks discovery and session metadata as demonstration preview', () => {
    expect(migration).toContain("then 'DEMO_PREVIEW'");
    expect(migration).toContain("'demo_preview', target_skill.publication_status = 'STAGING'");
    expect(migration).toContain("'pedagogical_review_status', target_skill.pedagogical_review_status");
  });
});
