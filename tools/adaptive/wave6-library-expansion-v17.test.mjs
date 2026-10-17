import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pack = JSON.parse(readFileSync('content/adaptive/tec-escola-core-v5/v17-phil-ethical-principle-expansion-v17.json', 'utf8'));
const migration = readFileSync('supabase/migrations/20261016001600_bncc_philosophy_ethical_principle_library_expansion_v17.sql', 'utf8');

describe('V17 philosophy ethical principle expansion', () => {
  it('keeps the pack staged and adds 100 new authorial questions', () => {
    expect(pack.canonicalSkillCode).toBe('PHILOSOPHY_APPLY_ETHICAL_PRINCIPLE');
    expect(pack.questions).toHaveLength(119);
    expect(pack.sourceReconciliation.newQuestions).toBe(100);
    expect(new Set(pack.questions.map((question) => question.id)).size).toBe(119);
    expect(pack.publicationStatus).toBe('STAGING');
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
  });

  it('keeps a progressive purpose mix and balanced answer positions', () => {
    expect(pack.expectedPurposeCounts).toEqual({ PROBE: 12, PRACTICE: 43, TRANSFER: 29, LOCK_IN: 13, REVIEW: 22 });
    expect(pack.expectedAnswerPositionCounts).toEqual({ A: 30, B: 30, C: 30, D: 29 });
    expect(pack.questions.some((question) => question.statement.includes('consentimento'))).toBe(true);
    expect(pack.questions.some((question) => question.statement.includes('proporcional'))).toBe(true);
    expect(pack.questions.every((question) => question.explanation && question.hint)).toBe(true);
  });

  it('compiles an inactive migration with review safeguards', () => {
    expect(migration).toContain("'PHILOSOPHY_APPLY_ETHICAL_PRINCIPLE'");
    expect(migration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain("'NOT_CLAIMED'");
    expect(migration).toContain('active = false');
    expect(migration).not.toContain('learning_question_bank.active = true');
  });
});
