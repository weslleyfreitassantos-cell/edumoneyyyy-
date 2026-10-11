import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { loadV4Pack, validateV4Pack } from './compile-v4';
import { buildV9DisciplineContentMigration } from './generate-v9-discipline-content';

const migration = readFileSync(
  new URL('../../supabase/migrations/20261011000050_bncc_v4_missing_discipline_content_v9.sql', import.meta.url),
  'utf8',
);

describe('V9 discipline content migration generator', () => {
  it('imports only the four missing V4 discipline skills with complete purpose coverage', () => {
    const pack = loadV4Pack();
    const targets = ['ART_COMPARE_COMPOSITIONS', 'BIOLOGY_CELL_FUNCTION', 'CHEMISTRY_STOICHIOMETRY', 'PE_ANALYZE_MOVEMENT'];
    const minimums = { PROBE: 2, PRACTICE: 1, TRANSFER: 1, LOCK_IN: 1, REVIEW: 1 } as const;

    expect(validateV4Pack(pack).valid).toBe(true);
    for (const code of targets) {
      const questions = pack.questions.filter((question) => question.primarySkill === code);
      expect(pack.leaves.find((leaf) => leaf.code === code)?.readiness).toBe('ADAPTIVE_READY');
      expect(pack.lessons.some((lesson) => lesson.skill === code)).toBe(true);
      expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length);
      for (const [purpose, minimum] of Object.entries(minimums)) {
        expect(questions.filter((question) => question.purpose === purpose).length).toBeGreaterThanOrEqual(minimum);
      }
    }
    expect(targets).toHaveLength(4);
  });

  it('keeps the checked-in SQL reproducible and leaves both curriculum and pedagogy pending', () => {
    const generated = buildV9DisciplineContentMigration();
    expect(generated).toBe(migration);
    expect(generated.match(/'PEDAGOGICAL_REVIEW_PENDING'/g)?.length).toBeGreaterThan(0);
    expect(generated).toContain("'PEDAGOGICAL_REVIEW_PENDING','CANDIDATE',canonical_subject.id");
    expect(generated).toContain("'content_pack','tec-escola-core-v4'");
    expect(generated).not.toContain('PEDAGOGICAL_REVIEWED');
    expect(generated).not.toContain("'bncc_alignment_status','MAPPED'");
  });
});
