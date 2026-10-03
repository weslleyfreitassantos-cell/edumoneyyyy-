import { describe, expect, it } from 'vitest';
import { reviewMappings } from './review-mappings.mjs';

const catalog = {
  catalogVersion: 'TEST',
  catalogHash: 'a'.repeat(64),
  nodes: [
    { code: 'EF06CO01', stage: 'ENSINO_FUNDAMENTAL', kind: 'SKILL', gradeOrRange: '06', componentCode: 'CO', officialTextExcerpt: 'Rastrear algoritmo com condicoes.' },
    { code: 'EI03CG01', stage: 'EDUCACAO_INFANTIL', kind: 'LEARNING_DEVELOPMENT_OBJECTIVE', gradeOrRange: '03', componentCode: 'CG', officialTextExcerpt: 'Expressar ações e movimentos.' },
    { code: 'EF06AR01', stage: 'ENSINO_FUNDAMENTAL', kind: 'SKILL', gradeOrRange: '06', componentCode: 'AR', officialTextExcerpt: 'Explorar criação artística.' },
  ],
};

const registry = {
  skills: [
    { code: 'COMPUTING_TRACE_ALGORITHM', stage: 'ENSINO_FUNDAMENTAL', gradeLevels: [6], subjectAreas: ['COMPUTACAO'], title: 'Rastrear algoritmo com condicoes', aliases: ['ALGORITMOS'], kind: 'LEAF' },
  ],
};

const candidates = {
  candidatesHash: 'b'.repeat(64),
  candidates: [
    { officialCode: 'EF06CO01', kind: 'SKILL', stage: 'ENSINO_FUNDAMENTAL', gradeOrRange: '06', componentCode: 'CO', confidence: 'HIGH', confidenceScore: 0.8, candidateCanonicalSkillCodes: ['COMPUTING_TRACE_ALGORITHM'] },
    { officialCode: 'EI03CG01', kind: 'LEARNING_DEVELOPMENT_OBJECTIVE', stage: 'EDUCACAO_INFANTIL', gradeOrRange: '03', componentCode: 'CG', confidence: 'LOW', confidenceScore: 0, candidateCanonicalSkillCodes: [] },
    { officialCode: 'EF06AR01', kind: 'SKILL', stage: 'ENSINO_FUNDAMENTAL', gradeOrRange: '06', componentCode: 'AR', confidence: 'LOW', confidenceScore: 0, candidateCanonicalSkillCodes: [] },
  ],
};

describe('BNCC independent mapping review', () => {
  it('classifies a strict candidate without promoting it', () => {
    const output = reviewMappings(candidates, catalog, registry);
    const review = output.reviews.find((item) => item.officialCode === 'EF06CO01');
    expect(review.decision).toBe('APPROVE_CONSERVATIVE');
    expect(review.reviewStatus).toBe('TECHNICALLY_REVIEWED');
    expect(review.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(review.promotionStatus).toBe('NOT_PROMOTED');
  });

  it('keeps hierarchy nodes outside adaptive skill promotion', () => {
    const output = reviewMappings(candidates, catalog, registry);
    const review = output.reviews.find((item) => item.officialCode === 'EI03CG01');
    expect(review.decision).toBe('HIERARCHY_ONLY');
    expect(review.pedagogicalReviewStatus).toBe('NOT_APPLICABLE');
    expect(review.canonicalSkill).toBeNull();
  });

  it('records canonical gaps instead of inventing a mapping', () => {
    const output = reviewMappings(candidates, catalog, registry);
    const review = output.reviews.find((item) => item.officialCode === 'EF06AR01');
    expect(review.decision).toBe('CANONICAL_GAP');
    expect(review.candidateCanonicalSkillCodes).toEqual([]);
    expect(review.promotionStatus).toBe('NOT_PROMOTED');
  });
});
