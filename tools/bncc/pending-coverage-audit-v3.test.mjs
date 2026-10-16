import { describe, expect, it } from 'vitest';
import { buildPendingCoverageAuditV3 } from './build-pending-coverage-audit-v3.mjs';

describe('BNCC pending coverage audit v3', () => {
  it('accounts for every non-mapped official node without promoting it', () => {
    const report = buildPendingCoverageAuditV3();
    expect(report.auditedFacts.pendingNodes).toBe(1721);
    expect(report.byMappingStatus).toEqual({ CANONICAL_GAP: 1496, HIERARCHY_ONLY: 104, HUMAN_REVIEW_BLOCKED: 121 });
    expect(report.policy.noAutomaticPromotion).toBe(true);
    expect(report.records.every((record) => record.studentPublicationStatus === 'STAGING_INACTIVE')).toBe(true);
    expect(report.records.every((record) => record.pedagogicalReviewStatus === 'PEDAGOGICAL_REVIEW_PENDING')).toBe(true);
  });
});
