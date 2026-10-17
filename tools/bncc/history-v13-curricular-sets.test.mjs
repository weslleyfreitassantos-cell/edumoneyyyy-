import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { validateQuestionFirstPack } from '../adaptive/compile-question-first-content-v5.mjs';

const packs = [
  'v13-history-time-sources.json',
  'v13-history-local-perspectives.json',
  'v13-history-local-heritage.json',
  'v13-history-local-landmarks.json',
  'v13-history-memory-records.json',
  'v13-history-community-comparisons.json',
  'v13-history-city-country-life.json',
  'v13-history-public-spaces-map.json',
  'v13-history-space-distinctions.json',
].map((file) => JSON.parse(readFileSync(`content/adaptive/tec-escola-core-v5/${file}`, 'utf8')));
const proposals = JSON.parse(readFileSync('content/bncc/mappings/proposals-v8.json', 'utf8'));
const sourceVerification = JSON.parse(readFileSync('content/bncc/authoring/source-verification-v2.json', 'utf8'));

describe('BNCC V13 history curricular sets', () => {
  it('keeps each complete authoring set staged, diverse and balanced', () => {
    const ids = new Set();
    for (const pack of packs) {
      const result = validateQuestionFirstPack(pack);
      expect(result.valid).toBe(true);
      expect(pack.questions).toHaveLength(50);
      expect(pack.sourceReconciliation).toMatchObject({ newQuestions: 50, reusedQuestionsCountedAsNew: false });
      expect(pack.sourceContext).toMatchObject({
        officialCode: expect.stringMatching(/^EF03HI(?:0[2-9]|10)$/),
        mappingStatus: 'CANONICAL_GAP',
        relation: 'AUTHORING_CONTEXT_ONLY',
        relationDecision: 'NOT_ASSERTED',
      });
      expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
      expect(pack.publicationStatus).toBe('STAGING');
      expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
      for (const question of pack.questions) {
        expect(ids.has(question.id)).toBe(false);
        ids.add(question.id);
      }
    }
    expect(ids).toHaveLength(450);
  });

  it('keeps source verification and proposal evidence separate from canonical mapping', () => {
    for (const pack of packs) {
      const proposal = proposals.proposals.find((item) => item.proposalId === pack.sourceContext.proposalId);
      const verification = sourceVerification.records.find((item) => item.verificationId === pack.sourceContext.sourceVerificationRecord);
      expect(proposal).toMatchObject({ proposalStatus: 'NEW_SKILL_PENDING_REVIEW', reviewStatus: 'PROPOSAL_PENDING' });
      expect(verification).toMatchObject({
        officialCode: pack.sourceContext.officialCode,
        technicalVerificationStatus: 'OFFICIAL_SOURCE_VERIFIED_EXACT',
        mappingStatus: 'CANONICAL_GAP',
        studentPublicationStatus: 'STAGING_INACTIVE',
      });
    }
  });
});
