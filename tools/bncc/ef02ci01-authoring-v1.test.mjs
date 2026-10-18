import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildAuthoredCurriculumPack, validateAuthoredCurriculumPack } from './curriculum-authoring-registry-v1.mjs';

const packageSpec = JSON.parse(fs.readFileSync('content/bncc/authoring/packages/EF02CI01-v1.json', 'utf8'));
const source = JSON.parse(fs.readFileSync('content/bncc/authoring/source-verification-v2.json', 'utf8')).records.find((record) => record.officialCode === 'EF02CI01');

describe('EF02CI01 authoring context package', () => {
  it('uses the verified official source without claiming canonical mapping or publication', () => {
    const pack = buildAuthoredCurriculumPack(packageSpec);
    const validation = validateAuthoredCurriculumPack(pack, source);

    expect(validation.valid).toBe(true);
    expect(source.technicalVerificationStatus).toBe('OFFICIAL_SOURCE_VERIFIED_EXACT');
    expect(source.contentDecision).toBe('AUTHORING_CONTEXT_ONLY_UNTIL_CANONICAL_REVIEW');
    expect(source.mappingStatus).toBe('CANONICAL_GAP');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(pack.publicationStatus).toBe('STAGING_INACTIVE');
    expect(pack.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(pack.active).toBe(false);
  });

  it('provides diverse, balanced original assessment and two observable activities', () => {
    const pack = buildAuthoredCurriculumPack(packageSpec);
    const validation = validateAuthoredCurriculumPack(pack, source);

    expect(pack.questions).toHaveLength(40);
    expect(new Set(pack.questions.map((question) => question.statement)).size).toBe(40);
    expect(new Set(pack.questions.map((question) => question.contextFamily)).size).toBe(40);
    expect(validation.purposeCounts).toEqual({ PROBE: 8, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 6 });
    expect(validation.answerPositionCounts).toEqual({ A: 10, B: 10, C: 10, D: 10 });
    expect(pack.lesson.authenticActivities).toHaveLength(2);
    expect(pack.lesson.authenticActivities.every((activity) => activity.steps.length >= 3 && activity.evidence.length > 30)).toBe(true);
  });
});
