import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const sourceVerification = JSON.parse(fs.readFileSync(
  path.resolve(root, 'content/bncc/authoring/source-verification-v2.json'),
  'utf8',
));
const resolutions = JSON.parse(fs.readFileSync(
  path.resolve(root, 'content/bncc/mappings/resolutions-v8.json'),
  'utf8',
));

describe('EF06CI01 source verification', () => {
  it('records the exact official descriptor without promoting its mapping', () => {
    const record = sourceVerification.records.find((item) => item.officialCode === 'EF06CI01');
    const resolution = resolutions.decisions.find((item) => item.officialCode === 'EF06CI01');

    expect(record).toMatchObject({
      verificationId: 'BNCC_EF06CI01_MEC_P346_V1',
      technicalVerificationStatus: 'OFFICIAL_SOURCE_VERIFIED_EXACT',
      mappingStatus: 'HUMAN_REVIEW_BLOCKED',
      studentPublicationStatus: 'STAGING_INACTIVE',
      pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    });
    expect(record.descriptor).toBe(
      'Classificar como homogênea ou heterogênea a mistura de dois ou mais materiais (água e sal, água e óleo, água e areia etc.).',
    );
    expect(resolution.resolutionStatus).toBe('HUMAN_REVIEW_BLOCKED');
    expect(resolution.relationCandidates).toEqual([
      {
        canonicalSkillCode: 'SCIENCE_EXPLAIN_MATTER_TRANSFORMATION',
        relationType: null,
        decision: 'NOT_ASSERTED',
      },
    ]);

    const pendingAudit = JSON.parse(fs.readFileSync(
      path.resolve(root, 'content/bncc/authoring/pending-coverage-audit-v3.json'),
      'utf8',
    ));
    const auditRecord = pendingAudit.records.find((item) => item.officialCode === 'EF06CI01');
    expect(auditRecord.queueStatus).toBe('MAPPING_REVIEW_REQUIRED');
    expect(auditRecord.nextAction).toBe('AUTHOR_CONTENT_AFTER_CANONICAL_REVIEW');
  });

  it('keeps the next science descriptors source-verified and unpublished', () => {
    const expected = {
      EF06CI02: 'HUMAN_REVIEW_BLOCKED',
      EF06CI03: 'CANONICAL_GAP',
      EF06CI04: 'CANONICAL_GAP',
      EF06CI05: 'CANONICAL_GAP',
    };
    for (const [code, mappingStatus] of Object.entries(expected)) {
      const record = sourceVerification.records.find((item) => item.officialCode === code);
      expect(record).toMatchObject({
        technicalVerificationStatus: 'OFFICIAL_SOURCE_VERIFIED_EXACT',
        mappingStatus,
        studentPublicationStatus: 'STAGING_INACTIVE',
        pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      });
    }
  });
});
