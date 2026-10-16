import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pack = JSON.parse(readFileSync('content/adaptive/tec-escola-core-v5/v19-phil-distinguish-concept-expansion-v19.json', 'utf8'));
const migration = readFileSync('supabase/migrations/20261016001800_bncc_philosophy_distinguish_concept_library_expansion_v19.sql', 'utf8');

describe('V19 philosophy distinguish concept expansion', () => {
  it('keeps the pack staged and adds 100 new authorial questions', () => {
    expect(pack.canonicalSkillCode).toBe('PHILOSOPHY_DISTINGUISH_CONCEPT');
    expect(pack.questions).toHaveLength(140);
    expect(pack.sourceReconciliation.newQuestions).toBe(100);
    expect(new Set(pack.questions.map((question) => question.id)).size).toBe(140);
    expect(pack.publicationStatus).toBe('STAGING');
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
  });

  it('keeps progressive purposes, balanced answers and explicit concept criteria', () => {
    expect(pack.expectedPurposeCounts).toEqual({ PROBE: 14, PRACTICE: 52, TRANSFER: 33, LOCK_IN: 16, REVIEW: 25 });
    expect(pack.expectedAnswerPositionCounts).toEqual({ A: 35, B: 35, C: 35, D: 35 });
    expect(pack.questions.some((question) => question.statement.includes('definição'))).toBe(true);
    expect(pack.questions.some((question) => question.statement.includes('necessária'))).toBe(true);
    expect(pack.questions.some((question) => question.statement.includes('categoria'))).toBe(true);
    expect(pack.questions.every((question) => question.explanation && question.hint)).toBe(true);
  });

  it('compiles an inactive migration with review safeguards', () => {
    expect(migration).toContain("'PHILOSOPHY_DISTINGUISH_CONCEPT'");
    expect(migration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain("'NOT_CLAIMED'");
    expect(migration).toContain('active = false');
    expect(migration).not.toContain('learning_question_bank.active = true');
  });
});
