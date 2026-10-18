import { describe, expect, it } from 'vitest';

import {
  buildAuthoredCurriculumPack,
  validateAuthoredCurriculumPack,
  validateStoredCurriculumPack,
} from './curriculum-authoring-registry-v1.mjs';

const expectedPurposeCounts = { PROBE: 8, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 6 };
const expectedPositionCounts = { A: 10, B: 10, C: 10, D: 10 };

describe('verified BNCC authoring packages', () => {
  it.each([
    ['EF01MA01', 'v1-mathematics-numbers-quantity-order-code-ef01'],
    ['EF02CI02', 'v1-science-material-properties-and-design-ef02'],
    ['EF06CI05', 'v3-science-cells-structure-and-function-ef06'],
    ['EF07CI03', 'v4-science-heat-transfer-materials-ef07'],
  ])('%s is source-verified, varied, balanced, and remains behind every publication gate', (officialCode, contentId) => {
    const pack = buildAuthoredCurriculumPack(officialCode);
    const validation = validateAuthoredCurriculumPack(pack);

    expect(validation.valid, validation.errors.join(',')).toBe(true);
    expect(validateStoredCurriculumPack(pack).valid).toBe(true);
    expect(pack.contentId).toBe(contentId);
    expect(pack.sourceContext).toMatchObject({
      officialCode,
      relation: 'AUTHORING_CONTEXT_ONLY',
      mappingStatus: 'CANONICAL_GAP',
      sourceStatus: 'OFFICIAL_SOURCE_VERIFIED_EXACT',
    });
    expect(pack.sourceContext.officialSource).toMatchObject({
      url: 'https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf',
    });
    expect(pack.questions).toHaveLength(40);
    expect(pack.expectedPurposeCounts).toEqual(expectedPurposeCounts);
    expect(pack.expectedAnswerPositionCounts).toEqual(expectedPositionCounts);
    expect(new Set(pack.questions.map(({ contextFamily }) => contextFamily)).size).toBe(40);
    expect(new Set(pack.questions.map(({ statement }) => statement)).size).toBe(40);
    expect(pack.questions.every(({ authored, options, correctAnswer }) => authored === true
      && options.length === 4
      && options.filter((option) => option === correctAnswer).length === 1)).toBe(true);
    expect(pack.sourceReconciliation).toMatchObject({
      sourceQuestionCount: 0,
      sourceReconciliationStatus: 'NO_SOURCE_QUESTION_REUSED',
      newQuestions: 40,
    });
    expect(pack.lesson.authenticActivities).toHaveLength(2);
    expect(pack.active).toBe(false);
    expect(pack.publicationStatus).toBe('STAGING_INACTIVE');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(validation.rubric.humanReview.status).toBe('PEDAGOGICAL_REVIEW_PENDING');
  });
});
