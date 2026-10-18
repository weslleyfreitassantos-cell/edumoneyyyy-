import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pack = JSON.parse(readFileSync('content/adaptive/tec-escola-core-v5/v22-physics-interpret-motion-graph-expansion-v22.json', 'utf8'));
const migration = readFileSync('supabase/migrations/20261016002100_bncc_physics_interpret_motion_graph_library_expansion_v22.sql', 'utf8');

describe('V22 physics interpret motion graph expansion', () => {
  it('keeps the pack staged and adds 100 new authorial questions', () => {
    expect(pack.canonicalSkillCode).toBe('PHYSICS_INTERPRET_MOTION_GRAPH');
    expect(pack.questions).toHaveLength(124);
    expect(pack.sourceReconciliation.newQuestions).toBe(100);
    expect(new Set(pack.questions.map((question) => question.id)).size).toBe(124);
    expect(pack.publicationStatus).toBe('STAGING');
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
  });

  it('keeps balanced new answers and explicit graph criteria', () => {
    const positions = Object.values(pack.expectedAnswerPositionCounts);
    expect(Math.max(...positions) - Math.min(...positions)).toBeLessThanOrEqual(2);
    expect(pack.questions.some((question) => question.statement.includes('gráfico'))).toBe(true);
    expect(pack.questions.some((question) => question.statement.includes('velocidade'))).toBe(true);
    expect(pack.questions.some((question) => question.statement.includes('inclinação'))).toBe(true);
    expect(pack.questions.every((question) => question.explanation && question.hint)).toBe(true);
  });

  it('compiles an inactive migration with review safeguards', () => {
    expect(migration).toContain("'PHYSICS_INTERPRET_MOTION_GRAPH'");
    expect(migration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain("'NOT_CLAIMED'");
    expect(migration).toContain('active = false');
    expect(migration).not.toContain('learning_question_bank.active = true');
  });
});
