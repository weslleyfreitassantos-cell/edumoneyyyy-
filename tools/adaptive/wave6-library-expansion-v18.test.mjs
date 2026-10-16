import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pack = JSON.parse(readFileSync('content/adaptive/tec-escola-core-v5/v18-phil-evaluate-argument-expansion-v18.json', 'utf8'));
const migration = readFileSync('supabase/migrations/20261016001700_bncc_philosophy_evaluate_argument_library_expansion_v18.sql', 'utf8');

describe('V18 philosophy evaluate argument expansion', () => {
  it('keeps the pack staged and adds 100 new authorial questions', () => {
    expect(pack.canonicalSkillCode).toBe('PHILOSOPHY_EVALUATE_ARGUMENT');
    expect(pack.questions).toHaveLength(120);
    expect(pack.sourceReconciliation.newQuestions).toBe(100);
    expect(new Set(pack.questions.map((question) => question.id)).size).toBe(120);
    expect(pack.publicationStatus).toBe('STAGING');
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
  });

  it('keeps progressive purposes, balanced answers and explicit argument evidence', () => {
    expect(pack.expectedPurposeCounts).toEqual({ PROBE: 12, PRACTICE: 44, TRANSFER: 29, LOCK_IN: 12, REVIEW: 23 });
    expect(pack.expectedAnswerPositionCounts).toEqual({ A: 30, B: 30, C: 30, D: 30 });
    expect(pack.questions.some((question) => question.statement.includes('premissa'))).toBe(true);
    expect(pack.questions.some((question) => question.statement.includes('evidência'))).toBe(true);
    expect(pack.questions.some((question) => question.statement.includes('contraexemplo'))).toBe(true);
    expect(pack.questions.every((question) => question.explanation && question.hint)).toBe(true);
  });

  it('compiles an inactive migration with review safeguards', () => {
    expect(migration).toContain("'PHILOSOPHY_EVALUATE_ARGUMENT'");
    expect(migration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain("'NOT_CLAIMED'");
    expect(migration).toContain('active = false');
    expect(migration).not.toContain('learning_question_bank.active = true');
  });
});
