import { describe, expect, it } from 'vitest';

import { generateMappingCandidates } from './map-candidates.mjs';

const catalog = {
  catalogVersion: 'TEST',
  catalogHash: 'a'.repeat(64),
  nodes: [
    { code: 'EF06MA01', stage: 'ENSINO_FUNDAMENTAL', kind: 'SKILL', gradeOrRange: '06', componentCode: 'MA', officialSource: { id: 'TEST', page: 1 }, officialTextExcerpt: 'Resolver situações com frações e equivalência.' },
    { code: 'EF06AR01', stage: 'ENSINO_FUNDAMENTAL', kind: 'SKILL', gradeOrRange: '06', componentCode: 'AR', officialSource: { id: 'TEST', page: 2 }, officialTextExcerpt: 'Explorar criação artística.' },
    { code: 'EF06CO01', stage: 'ENSINO_FUNDAMENTAL', kind: 'SKILL', gradeOrRange: '06', componentCode: 'CO', officialSource: { id: 'TEST', page: 3 }, officialTextExcerpt: 'Construir soluções usando algoritmos.' },
    { code: 'EI03CG01', stage: 'EDUCACAO_INFANTIL', kind: 'LEARNING_DEVELOPMENT_OBJECTIVE', gradeOrRange: '03', componentCode: 'CG', officialSource: { id: 'TEST', page: 4 }, officialTextExcerpt: 'Expressar ações e movimentos.' },
  ],
};

const registry = {
  schemaVersion: 'TEST',
  skills: [
    { code: 'FRACTIONS', stage: 'ENSINO_FUNDAMENTAL', gradeLevels: [6], subjectAreas: ['MATEMATICA'], title: 'Fundamentos de frações', aliases: ['frações', 'equivalência'], kind: 'LEAF' },
    { code: 'COMPUTING_ALGORITHMS', stage: 'ENSINO_FUNDAMENTAL', gradeLevels: [6], subjectAreas: ['COMPUTACAO'], title: 'Construir soluções usando algoritmos', aliases: ['algoritmos'], kind: 'LEAF' },
  ],
};

describe('BNCC mapping candidate factory', () => {
  it('proposes only a compatible candidate and keeps it pending review', () => {
    const output = generateMappingCandidates(catalog, registry);
    const fraction = output.candidates.find((item) => item.officialCode === 'EF06MA01');
    const art = output.candidates.find((item) => item.officialCode === 'EF06AR01');
    const computing = output.candidates.find((item) => item.officialCode === 'EF06CO01');
    expect(fraction.mappingType).toBe('ONE_TO_ONE_CANDIDATE');
    expect(fraction.candidateCanonicalSkillCodes).toEqual(['FRACTIONS']);
    expect(fraction.reviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(art.mappingType).toBe('CANONICAL_GAP');
    expect(art.candidateCanonicalSkillCodes).toEqual([]);
    expect(computing.mappingType).toBe('ONE_TO_ONE_CANDIDATE');
    expect(computing.candidateCanonicalSkillCodes).toEqual(['COMPUTING_ALGORITHMS']);
  });

  it('does not force broad official objectives into adaptive leaves', () => {
    const output = generateMappingCandidates(catalog, registry);
    const objective = output.candidates.find((item) => item.officialCode === 'EI03CG01');
    expect(objective.mappingType).toBe('HIERARCHY_ONLY');
    expect(objective.candidateCanonicalSkillCodes).toEqual([]);
  });
});
