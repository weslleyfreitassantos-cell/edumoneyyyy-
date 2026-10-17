import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pack = JSON.parse(readFileSync('content/adaptive/tec-escola-core-v5/v15-chemistry-atomic-structure-expansion-v15.json', 'utf8'));
const migration = readFileSync('supabase/migrations/20261016001400_bncc_chemistry_atomic_structure_library_expansion_v15.sql', 'utf8');

describe('V15 chemistry atomic structure expansion', () => {
  it('keeps the pack staged and expands the canonical target with 100 new questions', () => {
    expect(pack.canonicalSkillCode).toBe('CHEMISTRY_ATOMIC_STRUCTURE');
    expect(pack.questions).toHaveLength(114);
    expect(pack.sourceReconciliation.newQuestions).toBe(100);
    expect(new Set(pack.questions.map((question) => question.id)).size).toBe(114);
    expect(pack.publicationStatus).toBe('STAGING');
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
  });

  it('balances answer positions and preserves model-and-evidence progression', () => {
    expect(pack.expectedAnswerPositionCounts).toEqual({ A: 29, B: 29, C: 28, D: 28 });
    expect(pack.expectedPurposeCounts).toEqual({ PROBE: 10, PRACTICE: 41, TRANSFER: 29, LOCK_IN: 13, REVIEW: 21 });
    expect(pack.questions.some((question) => question.statement.includes('número atômico'))).toBe(true);
    expect(pack.questions.some((question) => question.correctAnswer.includes('isótopos'))).toBe(true);
    expect(pack.questions.some((question) => question.explanation.includes('modelo atômico'))).toBe(true);
  });

  it('compiles an inactive migration with the canonical skill and review safeguards', () => {
    expect(migration).toContain("'CHEMISTRY_ATOMIC_STRUCTURE'");
    expect(migration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain("'NOT_CLAIMED'");
    expect(migration).toContain('active = false');
    expect(migration).not.toContain('learning_question_bank.active = true');
  });
});
