import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pack = JSON.parse(readFileSync('content/adaptive/tec-escola-core-v5/v14-chemistry-reaction-evidence-expansion-v14.json', 'utf8'));
const migration = readFileSync('supabase/migrations/20261016001300_bncc_chemistry_reaction_evidence_library_expansion_v14.sql', 'utf8');

describe('V14 chemistry reaction evidence expansion', () => {
  it('keeps the pack staged and expands the canonical target with 100 new questions', () => {
    expect(pack.canonicalSkillCode).toBe('CHEMISTRY_REACTION_EVIDENCE');
    expect(pack.questions).toHaveLength(116);
    expect(pack.sourceReconciliation.newQuestions).toBe(100);
    expect(new Set(pack.questions.map((question) => question.id)).size).toBe(116);
    expect(pack.publicationStatus).toBe('STAGING');
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
  });

  it('balances answer positions and preserves evidence-focused progression', () => {
    expect(pack.expectedAnswerPositionCounts).toEqual({ A: 29, B: 29, C: 29, D: 29 });
    expect(pack.expectedPurposeCounts).toEqual({ PROBE: 12, PRACTICE: 43, TRANSFER: 28, LOCK_IN: 11, REVIEW: 22 });
    expect(pack.questions.some((question) => question.statement.includes('controles'))).toBe(true);
    expect(pack.questions.some((question) => question.correctAnswer.includes('sistema medido'))).toBe(true);
    expect(pack.questions.some((question) => question.explanation.includes('composição'))).toBe(true);
  });

  it('compiles an inactive migration with the canonical skill and review safeguards', () => {
    expect(migration).toContain("'CHEMISTRY_REACTION_EVIDENCE'");
    expect(migration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain("'NOT_CLAIMED'");
    expect(migration).toContain('active = false');
    expect(migration).not.toContain('learning_question_bank.active = true');
  });
});
