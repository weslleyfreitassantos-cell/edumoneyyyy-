import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pack = JSON.parse(readFileSync('content/adaptive/tec-escola-core-v5/v30-portuguese-compare-sources-expansion-v30.json', 'utf8'));
const migration = readFileSync('supabase/migrations/20261016002900_bncc_portuguese_compare_sources_library_expansion_v30.sql', 'utf8');

describe('V30 Portuguese compare sources expansion', () => {
  it('closes the 5000 baseline with staged authorial questions', () => {
    expect(pack.canonicalSkillCode).toBe('PORTUGUESE_COMPARE_SOURCES');
    expect(pack.questions).toHaveLength(90);
    expect(pack.sourceReconciliation.newQuestions).toBe(50);
    expect(new Set(pack.questions.map((question) => question.id)).size).toBe(90);
    expect(pack.publicationStatus).toBe('STAGING');
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
  });

  it('keeps answer distribution and source-scope guidance balanced', () => {
    const positions = Object.values(pack.expectedAnswerPositionCounts);
    expect(Math.max(...positions) - Math.min(...positions)).toBeLessThanOrEqual(2);
    expect(pack.questions.some((question) => question.statement.includes('fonte'))).toBe(true);
    expect(pack.questions.some((question) => question.statement.includes('período'))).toBe(true);
    expect(pack.questions.every((question) => question.explanation && question.hint)).toBe(true);
  });

  it('compiles an inactive migration with review safeguards', () => {
    expect(migration).toContain("'PORTUGUESE_COMPARE_SOURCES'");
    expect(migration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain("'NOT_CLAIMED'");
    expect(migration).toContain('active = false');
    expect(migration).not.toContain('learning_question_bank.active = true');
  });
});
