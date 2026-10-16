import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pack = JSON.parse(readFileSync('content/adaptive/tec-escola-core-v5/v20-physics-model-force-expansion-v20.json', 'utf8'));
const migration = readFileSync('supabase/migrations/20261016001900_bncc_physics_model_force_library_expansion_v20.sql', 'utf8');

describe('V20 physics model force expansion', () => {
  it('keeps the pack staged and adds 100 new authorial questions', () => {
    expect(pack.canonicalSkillCode).toBe('PHYSICS_MODEL_FORCE');
    expect(pack.questions).toHaveLength(135);
    expect(pack.sourceReconciliation.newQuestions).toBe(100);
    expect(new Set(pack.questions.map((question) => question.id)).size).toBe(135);
    expect(pack.publicationStatus).toBe('STAGING');
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
  });

  it('keeps progressive purposes, balanced answers and explicit force criteria', () => {
    expect(pack.expectedAnswerPositionCounts).toEqual({ A: 34, B: 34, C: 34, D: 33 });
    expect(pack.questions.some((question) => question.statement.includes('força resultante'))).toBe(true);
    expect(pack.questions.some((question) => question.statement.includes('atrito'))).toBe(true);
    expect(pack.questions.some((question) => question.statement.includes('aceleração'))).toBe(true);
    expect(pack.questions.every((question) => question.explanation && question.hint)).toBe(true);
  });

  it('compiles an inactive migration with review safeguards', () => {
    expect(migration).toContain("'PHYSICS_MODEL_FORCE'");
    expect(migration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain("'NOT_CLAIMED'");
    expect(migration).toContain('active = false');
    expect(migration).not.toContain('learning_question_bank.active = true');
  });
});
