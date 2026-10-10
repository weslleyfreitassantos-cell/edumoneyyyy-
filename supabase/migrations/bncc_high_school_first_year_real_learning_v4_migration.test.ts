import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261010000400_bncc_high_school_first_year_real_learning_v4.sql', import.meta.url),
  'utf8',
);

const content = JSON.parse(
  migration.match(/\$json\$([\s\S]*?)\$json\$::jsonb/)?.[1] ?? '[]',
) as Array<{
  code: string;
  source_page: number;
  questions: Array<{ purpose: string; options: string[]; correct: string }>;
}>;

describe('BNCC high-school first-year V4 migration', () => {
  it('uses four official Ensino Medio codes with traceable source pages', () => {
    expect(content.map((item) => item.code)).toEqual([
      'EM13MAT101',
      'EM13LGG303',
      'EM13CNT101',
      'EM13CHS103',
    ]);
    expect(content.map((item) => item.source_page)).toEqual([101, 61, 117, 136]);
    expect(migration).toContain("'BNCC_EM_2018'");
    expect(migration).toContain("'official_grade_range', '1-3'");
    expect(migration).toContain("'recommended_grade_source', 'TECESCOLA_PEDAGOGICAL_SEQUENCE'");
  });

  it('creates a complete V4 path without claiming pedagogical approval', () => {
    const purposes = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];
    for (const item of content) {
      expect(item.questions).toHaveLength(5);
      expect(item.questions.map((question) => question.purpose).sort()).toEqual([...purposes].sort());
      for (const question of item.questions) {
        expect(question.options).toHaveLength(4);
        expect(question.options).toContain(question.correct);
      }
    }
    expect(migration).toContain("'LEAF', 'ADAPTIVE_READY', true");
    expect(migration).toContain("'pedagogical_review_status', 'PENDING'");
    expect(migration).toContain('get_guided_learning_step_v4');
    expect(migration).toContain("'curriculum'");
    expect(migration).not.toMatch(/drop table/i);
    expect(migration).not.toMatch(/truncate\s/i);
    expect(migration).not.toMatch(/\\n\+/);
  });
});
