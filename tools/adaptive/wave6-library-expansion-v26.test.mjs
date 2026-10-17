import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pack = JSON.parse(readFileSync('content/adaptive/tec-escola-core-v5/v26-biology-cell-function-expansion-v26.json', 'utf8'));
const migration = readFileSync('supabase/migrations/20261016002500_bncc_biology_cell_function_library_expansion_v26.sql', 'utf8');

describe('V26 biology cell function expansion', () => {
  it('keeps the pack staged and adds 100 new authorial questions', () => {
    expect(pack.canonicalSkillCode).toBe('BIOLOGY_CELL_FUNCTION');
    expect(pack.questions).toHaveLength(123);
    expect(pack.sourceReconciliation.newQuestions).toBe(100);
    expect(new Set(pack.questions.map((question) => question.id)).size).toBe(123);
    expect(pack.publicationStatus).toBe('STAGING');
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
  });

  it('keeps balanced answers and explicit cell-function criteria', () => {
    const positions = Object.values(pack.expectedAnswerPositionCounts);
    expect(Math.max(...positions) - Math.min(...positions)).toBeLessThanOrEqual(2);
    expect(pack.questions.some((question) => question.statement.includes('membrana'))).toBe(true);
    expect(pack.questions.some((question) => question.statement.includes('célula'))).toBe(true);
    expect(pack.questions.some((question) => question.statement.includes('função'))).toBe(true);
    expect(pack.questions.every((question) => question.explanation && question.hint)).toBe(true);
  });

  it('compiles an inactive migration with review safeguards', () => {
    expect(migration).toContain("'BIOLOGY_CELL_FUNCTION'");
    expect(migration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain("'NOT_CLAIMED'");
    expect(migration).toContain('active = false');
    expect(migration).not.toContain('learning_question_bank.active = true');
  });
});
