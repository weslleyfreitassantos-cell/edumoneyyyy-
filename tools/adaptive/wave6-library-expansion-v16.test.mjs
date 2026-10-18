import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pack = JSON.parse(readFileSync('content/adaptive/tec-escola-core-v5/v16-chemistry-stoichiometry-expansion-v16.json', 'utf8'));
const migration = readFileSync('supabase/migrations/20261016001500_bncc_chemistry_stoichiometry_library_expansion_v16.sql', 'utf8');

describe('V16 chemistry stoichiometry expansion', () => {
  it('keeps the pack staged and expands the canonical target with 100 new questions', () => {
    expect(pack.canonicalSkillCode).toBe('CHEMISTRY_STOICHIOMETRY');
    expect(pack.questions).toHaveLength(118);
    expect(pack.sourceReconciliation.newQuestions).toBe(100);
    expect(new Set(pack.questions.map((question) => question.id)).size).toBe(118);
    expect(pack.publicationStatus).toBe('STAGING');
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
  });

  it('balances answer positions and preserves quantitative progression', () => {
    expect(pack.expectedAnswerPositionCounts).toEqual({ A: 30, B: 30, C: 29, D: 29 });
    expect(pack.expectedPurposeCounts).toEqual({ PROBE: 10, PRACTICE: 45, TRANSFER: 30, LOCK_IN: 13, REVIEW: 20 });
    expect(pack.questions.some((question) => question.statement.includes('equação'))).toBe(true);
    expect(pack.questions.some((question) => question.correctAnswer.includes('rendimento'))).toBe(true);
    expect(pack.questions.some((question) => question.explanation.includes('unidades'))).toBe(true);
  });

  it('compiles an inactive migration with the canonical skill and review safeguards', () => {
    expect(migration).toContain("'CHEMISTRY_STOICHIOMETRY'");
    expect(migration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain("'NOT_CLAIMED'");
    expect(migration).toContain('active = false');
    expect(migration).not.toContain('learning_question_bank.active = true');
  });
});
