import { describe, expect, it } from 'vitest';
import { buildProposalsV8 } from './build-proposals-v8.mjs';
import { reviewProposalsV8 } from './review-proposals-v8.mjs';

describe('BNCC V8 proposal and review gates', () => {
  const clusters = { catalogVersion: 'TEST', catalogHash: 'a'.repeat(64), contextHash: 'b'.repeat(64), gapsHash: 'c'.repeat(64), clusters: [{ clusterId: 'V8_GAP_TEST', officialCodes: ['EF01MA01'], stage: 'ENSINO_FUNDAMENTAL', gradeRange: '01', component: 'MA', subject: 'MATEMATICA', domain: null, subdomain: null, semanticObject: 'NUMBERS_QUANTITY', cognitiveOperation: 'IDENTIFICAR', officialContext: { descriptorSamples: ['Identificar números.'] }, currentCandidates: [], semanticCandidateSkills: [], reviewStatus: 'PEDAGOGICAL_REVIEW_PENDING', promotionStatus: 'NOT_PROMOTED' }] };
  const registry = { skills: [{ code: 'MATH_NUMBERS', stage: 'ENSINO_FUNDAMENTAL' }] };

  it('creates a pending proposal instead of a fake canonical skill', () => {
    const output = buildProposalsV8(clusters, registry);
    expect(output.summary.newSkillPendingReview).toBe(1);
    expect(output.proposals[0].reviewStatus).toBe('PROPOSAL_PENDING');
    expect(output.summary.promoted).toBe(0);
  });

  it('keeps independent review honest for new skills', () => {
    const proposal = buildProposalsV8(clusters, registry);
    const reviewed = reviewProposalsV8(proposal, registry);
    expect(reviewed.summary.humanReviewRequired).toBe(1);
    expect(reviewed.reviews[0].promotionStatus).toBe('NOT_PROMOTED');
    expect(reviewed.reviews[0].decision).toBe('HUMAN_REVIEW_REQUIRED');
  });
});
