import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pack = JSON.parse(readFileSync('content/adaptive/tec-escola-core-v5/v25-physics-unit-conversion-expansion-v25.json', 'utf8'));
const migration = readFileSync('supabase/migrations/20261016002400_bncc_physics_unit_conversion_library_expansion_v25.sql', 'utf8');

describe('V25 physics unit conversion expansion', () => {
  it('keeps the pack staged and adds 100 new authorial questions', () => {
    expect(pack.canonicalSkillCode).toBe('PHYSICS_UNIT_CONVERSION');
    expect(pack.questions).toHaveLength(140);
    expect(pack.sourceReconciliation.newQuestions).toBe(100);
    expect(new Set(pack.questions.map((question) => question.id)).size).toBe(140);
    expect(pack.publicationStatus).toBe('STAGING');
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
  });

  it('keeps balanced answers and explicit unit-conversion criteria', () => {
    const positions = Object.values(pack.expectedAnswerPositionCounts);
    expect(Math.max(...positions) - Math.min(...positions)).toBeLessThanOrEqual(2);
    expect(pack.questions.some((question) => question.statement.includes('unidade'))).toBe(true);
    expect(pack.questions.some((question) => question.statement.includes('convers'))).toBe(true);
    expect(pack.questions.some((question) => question.statement.includes('escala'))).toBe(true);
    expect(pack.questions.every((question) => question.explanation && question.hint)).toBe(true);
  });

  it('compiles an inactive migration with review safeguards', () => {
    expect(migration).toContain("'PHYSICS_UNIT_CONVERSION'");
    expect(migration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain("'NOT_CLAIMED'");
    expect(migration).toContain('active = false');
    expect(migration).not.toContain('learning_question_bank.active = true');
  });
});
