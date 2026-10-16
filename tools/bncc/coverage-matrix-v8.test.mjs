import { describe, expect, it } from 'vitest';
import { buildCoverageMatrix } from './build-coverage-matrix-v8.mjs';

describe('BNCC V8 coverage matrix', () => {
  it('keeps official nodes unique and separates evidence from approval', () => {
    const matrix = buildCoverageMatrix();
    const codes = matrix.rows.map((row) => row.officialCode);
    expect(codes.length).toBe(1723);
    expect(new Set(codes).size).toBe(codes.length);
    expect(matrix.policy.officialSourceVerificationIsNotCanonicalMapping).toBe(true);
    expect(matrix.policy.authoringContextIsNotOfficialApproval).toBe(true);
    expect(matrix.policy.noStudentPublication).toBe(true);
    expect(matrix.policy.noProductionWrites).toBe(true);
    expect(matrix.rows.every((row) => row.governance.studentPublicationStatus === 'STAGING_INACTIVE')).toBe(true);
    expect(matrix.rows.every((row) => row.governance.pedagogicalReviewStatus === 'PEDAGOGICAL_REVIEW_PENDING')).toBe(true);
    const science = matrix.rows.find((row) => row.officialCode === 'EF01CI01');
    expect(science.evidence.packages.some((item) => item.contentId === 'v8-science-materials-conscious-use-fi')).toBe(true);
    expect(science.governance.officialMappingStatus).toBe('NOT_CLAIMED');
  });
});
