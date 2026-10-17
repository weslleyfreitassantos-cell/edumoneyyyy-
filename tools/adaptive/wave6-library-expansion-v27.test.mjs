import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pack = JSON.parse(readFileSync('content/adaptive/tec-escola-core-v5/v27-geography-map-scale-expansion-v27.json', 'utf8'));
const migration = readFileSync('supabase/migrations/20261016002600_bncc_geography_map_scale_library_expansion_v27.sql', 'utf8');

describe('V27 geography map scale expansion', () => {
  it('keeps the pack staged and adds 100 new authorial questions', () => {
    expect(pack.canonicalSkillCode).toBe('GEOGRAPHY_MAP_SCALE');
    expect(pack.questions).toHaveLength(140);
    expect(pack.sourceReconciliation.newQuestions).toBe(100);
    expect(new Set(pack.questions.map((question) => question.id)).size).toBe(140);
    expect(pack.publicationStatus).toBe('STAGING');
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
  });

  it('keeps balanced answers and explicit map-reading criteria', () => {
    const positions = Object.values(pack.expectedAnswerPositionCounts);
    expect(Math.max(...positions) - Math.min(...positions)).toBeLessThanOrEqual(2);
    expect(pack.questions.some((question) => question.statement.includes('escala'))).toBe(true);
    expect(pack.questions.some((question) => question.statement.includes('legenda'))).toBe(true);
    expect(pack.questions.some((question) => question.statement.includes('mapa'))).toBe(true);
    expect(pack.questions.every((question) => question.explanation && question.hint)).toBe(true);
  });

  it('compiles an inactive migration with review safeguards', () => {
    expect(migration).toContain("'GEOGRAPHY_MAP_SCALE'");
    expect(migration).toContain("'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain("'NOT_CLAIMED'");
    expect(migration).toContain('active = false');
    expect(migration).not.toContain('learning_question_bank.active = true');
  });
});
