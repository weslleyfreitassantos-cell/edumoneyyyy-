import { describe, expect, it } from 'vitest';
import { promoteSafeMappings } from './promote-safe-mappings.mjs';

const catalog = {
  catalogVersion: 'test',
  catalogHash: 'a'.repeat(64),
  nodes: [
    { code: 'EF06HI01', officialTextExcerpt: 'Analisar a periodização dos processos históricos.' },
    { code: 'EF09CI01', officialTextExcerpt: 'Explicar mudanças de estado físico da matéria e sua constituição submicroscópica.' },
  ],
};

const reviews = {
  catalogVersion: 'test',
  catalogHash: 'a'.repeat(64),
  candidatesHash: 'b'.repeat(64),
  generatedAt: '2026-10-03T00:00:00.000Z',
  reviews: [
    {
      officialCode: 'EF06HI01',
      decision: 'APPROVE_CONSERVATIVE',
      candidateCanonicalSkillCodes: ['HISTORY_INTERPRET_PERIODIZATION'],
      canonicalSkill: { code: 'HISTORY_INTERPRET_PERIODIZATION' },
      checks: { stage: true, component: true, grade: true, uniqueness: true },
    },
    {
      officialCode: 'EF09CI01',
      decision: 'APPROVE_CONSERVATIVE',
      candidateCanonicalSkillCodes: ['SCIENCE_EXPLAIN_MATTER_TRANSFORMATION'],
      canonicalSkill: { code: 'SCIENCE_EXPLAIN_MATTER_TRANSFORMATION' },
      checks: { stage: true, component: true, grade: true, uniqueness: true },
    },
  ],
};

describe('BNCC safe mapping promotions', () => {
  it('promotes only allowlisted technical matches and keeps pedagogical review pending', () => {
    const output = promoteSafeMappings(reviews, catalog);
    expect(output.summary.promoted).toBe(2);
    expect(output.promotions.map((item) => item.officialCode)).toEqual(['EF06HI01', 'EF09CI01']);
    expect(output.promotions.every((item) => item.status === 'MAPPED')).toBe(true);
    expect(output.promotions.every((item) => item.reviewStatus === 'TECH_VALIDATED')).toBe(true);
    expect(output.promotions.every((item) => item.pedagogicalReviewStatus === 'PEDAGOGICAL_REVIEW_PENDING')).toBe(true);
  });

  it('rejects a promotion when the frozen official evidence is incomplete', () => {
    expect(() => promoteSafeMappings(reviews, {
      ...catalog,
      nodes: catalog.nodes.map((node) => node.code === 'EF09CI01'
        ? { ...node, officialTextExcerpt: 'Explicar transformações da matéria.' }
        : node),
    })).toThrow(/EF09CI01 does not contain the expected official evidence/);
  });
});
