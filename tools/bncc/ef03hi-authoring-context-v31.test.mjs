import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateQuestionFirstPack } from '../adaptive/compile-question-first-content-v5.mjs';

const pack = JSON.parse(readFileSync('content/adaptive/tec-escola-core-v5/v31-history-population-groups-expansion-v31.json', 'utf8'));
const proposals = JSON.parse(readFileSync('content/bncc/mappings/proposals-v8.json', 'utf8'));
const sourceVerification = JSON.parse(readFileSync('content/bncc/authoring/source-verification-v2.json', 'utf8'));

describe('EF03HI01 V31 authoring context', () => {
  it('keeps the educational package staged and unmapped', () => {
    const result = validateQuestionFirstPack(pack);
    expect(result.valid).toBe(true);
    expect(pack.sourceReconciliation.newQuestions).toBe(50);
    expect(pack.sourceContext).toMatchObject({
      officialCode: 'EF03HI01',
      sourceVerificationRecord: 'BNCC_EF03HI01_MEC_P413_V1',
      mappingStatus: 'CANONICAL_GAP',
      relation: 'AUTHORING_CONTEXT_ONLY',
      relationDecision: 'NOT_ASSERTED',
    });
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(pack.publicationStatus).toBe('STAGING');
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.questions).toHaveLength(190);
  });

  it('points to the existing proposal and exact source record without promoting either', () => {
    const proposal = proposals.proposals.find((item) => item.proposalId === pack.sourceContext.proposalId);
    const verification = sourceVerification.records.find((item) => item.verificationId === pack.sourceContext.sourceVerificationRecord);
    expect(proposal).toMatchObject({ officialCodes: ['EF03HI01'], proposalStatus: 'NEW_SKILL_PENDING_REVIEW', reviewStatus: 'PROPOSAL_PENDING' });
    expect(verification).toMatchObject({ officialCode: 'EF03HI01', technicalVerificationStatus: 'OFFICIAL_SOURCE_VERIFIED_EXACT' });
    expect(pack.sourceContext.relationDecision).toBe('NOT_ASSERTED');
  });
});
