import { describe, expect, it } from 'vitest';

import { expandSemanticCandidates } from './expand-semantic-candidates.mjs';

const catalog = {
  catalogVersion: 'TEST',
  catalogHash: 'a'.repeat(64),
  nodes: [
    { code: 'EF06MA01', stage: 'ENSINO_FUNDAMENTAL', kind: 'SKILL', gradeOrRange: '06', componentCode: 'MA', officialTextExcerpt: ') Resolver situacoes com fracoes e equivalencia. (EF06MA02) Outro descritor.' },
    { code: 'EF06AR01', stage: 'ENSINO_FUNDAMENTAL', kind: 'SKILL', gradeOrRange: '06', componentCode: 'AR', officialTextExcerpt: ') Explorar criacao artistica.' },
    { code: 'EI03CG01', stage: 'EDUCACAO_INFANTIL', kind: 'LEARNING_DEVELOPMENT_OBJECTIVE', gradeOrRange: '03', componentCode: 'CG', officialTextExcerpt: ') Expressar acoes e movimentos.' },
  ],
};

const registry = {
  skills: [
    { code: 'FRACTIONS', stage: 'ENSINO_FUNDAMENTAL', gradeLevels: [6], subjectAreas: ['MATEMATICA'], title: 'Resolver situacoes com fracoes', aliases: ['equivalencia'], objective: 'Resolver problemas com fracoes.' },
    { code: 'ART_SKILL', stage: 'ENSINO_FUNDAMENTAL', gradeLevels: [6], subjectAreas: ['ARTE'], title: 'Interpretar obra artistica', aliases: ['criacao'] },
  ],
};

describe('BNCC semantic candidate expansion', () => {
  it('extracts the local descriptor and ranks only scoped candidates', () => {
    const output = expandSemanticCandidates(catalog, registry);
    const math = output.candidates.find((item) => item.officialCode === 'EF06MA01');
    expect(math.descriptor).toBe('Resolver situacoes com fracoes e equivalencia.');
    expect(math.candidates[0].canonicalSkillCode).toBe('FRACTIONS');
    expect(math.reviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(output.summary.promoted).toBe(0);
  });

  it('does not cross subject or promote hierarchy nodes', () => {
    const output = expandSemanticCandidates(catalog, registry);
    const art = output.candidates.find((item) => item.officialCode === 'EF06AR01');
    const objective = output.candidates.find((item) => item.officialCode === 'EI03CG01');
    expect(art.candidates.every((item) => item.canonicalSkillCode === 'ART_SKILL')).toBe(true);
    expect(objective.candidates).toEqual([]);
    expect(objective.reviewStatus).toBe('NOT_APPLICABLE');
  });
});
