import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pack = JSON.parse(readFileSync('content/adaptive/tec-escola-core-v5/v24-physics-uniform-motion-expansion-v24.json', 'utf8'));
const migration = readFileSync('supabase/migrations/20261016002300_bncc_physics_uniform_motion_library_expansion_v24.sql', 'utf8');

describe('V24 physics uniform motion expansion', () => {
  it('keeps the pack staged and adds 100 new authorial questions', () => {
    expect(pack.canonicalSkillCode).toBe('PHYSICS_UNIFORM_MOTION');
    expect(pack.questions).toHaveLength(140);
    expect(pack.sourceReconciliation.newQuestions).toBe(100);
    expect(new Set(pack.questions.map((question) => question.id)).size).toBe(140);
    expect(pack.publicationStatus).toBe('STAGING');
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
  });

  it('keeps balanced answers and explicit uniform-motion criteria', () => {
    const positions = Object.values(pack.expectedAnswerPositionCounts);
    expect(Math.max(...positions) - Math.min(...positions)).toBeLessThanOrEqual(2);
    expect(pack.questions.some((question) => question.statement.includes('velocidade constante'))).toBe(true);
    expect(pack.questions.some((question) => question.statement.includes('referencial'))).toBe(true);
    expect(pack.questions.some((question) => question.statement.includes('distância'))).toBe(true);
    expect(pack.questions.every((question) => question.explanation && question.hint)).toBe(true);
  });

  it('compiles an inactive migration with review safeguards', () => {
    expect(migration).toContain("'PHYSICS_UNIFORM_MOTION'");
    expect(migration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain("'NOT_CLAIMED'");
    expect(migration).toContain('active = false');
    expect(migration).not.toContain('learning_question_bank.active = true');
  });
});
