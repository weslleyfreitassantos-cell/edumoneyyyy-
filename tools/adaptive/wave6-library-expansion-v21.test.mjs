import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pack = JSON.parse(readFileSync('content/adaptive/tec-escola-core-v5/v21-physics-interpret-acceleration-expansion-v21.json', 'utf8'));
const migration = readFileSync('supabase/migrations/20261016002000_bncc_physics_interpret_acceleration_library_expansion_v21.sql', 'utf8');

describe('V21 physics interpret acceleration expansion', () => {
  it('keeps the pack staged and adds 100 new authorial questions', () => {
    expect(pack.canonicalSkillCode).toBe('PHYSICS_INTERPRET_ACCELERATION');
    expect(pack.questions).toHaveLength(140);
    expect(pack.sourceReconciliation.newQuestions).toBe(100);
    expect(new Set(pack.questions.map((question) => question.id)).size).toBe(140);
    expect(pack.publicationStatus).toBe('STAGING');
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
  });

  it('keeps balanced answers and explicit acceleration criteria', () => {
    expect(pack.expectedAnswerPositionCounts).toEqual({ A: 35, B: 35, C: 35, D: 35 });
    expect(pack.questions.some((question) => question.statement.includes('aceleração'))).toBe(true);
    expect(pack.questions.some((question) => question.statement.includes('velocidade'))).toBe(true);
    expect(pack.questions.some((question) => question.statement.includes('m/s²'))).toBe(true);
    expect(pack.questions.every((question) => question.explanation && question.hint)).toBe(true);
  });

  it('compiles an inactive migration with review safeguards', () => {
    expect(migration).toContain("'PHYSICS_INTERPRET_ACCELERATION'");
    expect(migration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain("'NOT_CLAIMED'");
    expect(migration).toContain('active = false');
    expect(migration).not.toContain('learning_question_bank.active = true');
  });
});
