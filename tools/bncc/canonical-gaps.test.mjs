import { describe, expect, it } from 'vitest';

import { clusterCanonicalGaps } from './cluster-canonical-gaps.mjs';

const candidates = {
  catalogVersion: 'TEST',
  catalogHash: 'a'.repeat(64),
  candidates: [
    { officialCode: 'EF06MA01', mappingType: 'CANONICAL_GAP', stage: 'ENSINO_FUNDAMENTAL', gradeOrRange: '06', componentCode: 'MA' },
    { officialCode: 'EF06MA02', mappingType: 'CANONICAL_GAP', stage: 'ENSINO_FUNDAMENTAL', gradeOrRange: '06', componentCode: 'MA' },
    { officialCode: 'EF06AR01', mappingType: 'CANONICAL_GAP', stage: 'ENSINO_FUNDAMENTAL', gradeOrRange: '06', componentCode: 'AR' },
    { officialCode: 'EF06CO01', mappingType: 'ONE_TO_ONE_CANDIDATE', stage: 'ENSINO_FUNDAMENTAL', gradeOrRange: '06', componentCode: 'CO' },
  ],
};

const semantic = {
  candidates: [
    { officialCode: 'EF06MA01', descriptor: 'Resolver problemas com fracoes.', candidates: [{ canonicalSkillCode: 'FRACTIONS' }] },
    { officialCode: 'EF06MA02', descriptor: 'Resolver problemas com numeros.', candidates: [{ canonicalSkillCode: 'NUMBERS' }] },
    { officialCode: 'EF06AR01', descriptor: 'Explorar composicao artistica.', candidates: [] },
  ],
};

describe('BNCC canonical gap clustering', () => {
  it('groups gaps without creating a synthetic skill', () => {
    const output = clusterCanonicalGaps(candidates, semantic);
    expect(output.summary.officialGapCodes).toBe(3);
    expect(output.clusters.every((cluster) => cluster.suggestedSkill === null)).toBe(true);
    expect(output.clusters.find((cluster) => cluster.subject === 'MATEMATICA').officialCodes).toHaveLength(2);
    expect(output.summary.promoted).toBe(0);
  });

  it('keeps semantic signals as review context only', () => {
    const output = clusterCanonicalGaps(candidates, semantic);
    const art = output.clusters.find((cluster) => cluster.subject === 'ARTE');
    expect(art.semanticCandidateSkills).toEqual([]);
    expect(art.reviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
  });
});
