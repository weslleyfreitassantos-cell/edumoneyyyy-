import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const catalog = JSON.parse(fs.readFileSync(
  path.resolve(root, 'content/bncc/official/catalog-2018.json'),
  'utf8',
));
const sourceVerification = JSON.parse(fs.readFileSync(
  path.resolve(root, 'content/bncc/authoring/source-verification-v2.json'),
  'utf8',
));
const pendingAudit = JSON.parse(fs.readFileSync(
  path.resolve(root, 'content/bncc/authoring/pending-coverage-audit-v3.json'),
  'utf8',
));

const targetNodes = catalog.nodes
  .filter((node) => /^EF05LP\d{2}$/.test(node.code))
  .sort((left, right) => left.code.localeCompare(right.code));

function descriptorFromCatalog(node) {
  const excerpt = node.officialTextExcerpt.replace(/^\)\s*/, '').split(' BASE NACIONAL')[0];
  return (excerpt.match(/^(.*?)(?=\s+\([A-Z]{2}\d{2}[A-Z]{2}\d{2}\))/s)?.[1] ?? excerpt).trim();
}

describe('EF05LP source verification', () => {
  it('records every fifth-grade Portuguese skill with exact local descriptor evidence', () => {
    expect(targetNodes).toHaveLength(28);

    for (const node of targetNodes) {
      const record = sourceVerification.records.find((item) => item.officialCode === node.code);
      expect(record).toMatchObject({
        verificationId: `BNCC_${node.code}_MEC_P${node.officialSource.page}_V1`,
        technicalVerificationStatus: 'OFFICIAL_SOURCE_VERIFIED_EXACT',
        descriptor: descriptorFromCatalog(node),
        mappingStatus: 'CANONICAL_GAP',
        studentPublicationStatus: 'STAGING_INACTIVE',
        pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      });
      expect(record.officialSource).toMatchObject({
        id: 'BNCC_EI_EF_2018',
        page: node.officialSource.page,
      });
    }
  });

  it('keeps the batch in the mapping-review queue and out of student publication', () => {
    for (const node of targetNodes) {
      const auditRecord = pendingAudit.records.find((item) => item.officialCode === node.code);
      expect(auditRecord).toMatchObject({
        queueStatus: 'MAPPING_REVIEW_REQUIRED',
        exactSourceVerified: true,
        nextAction: 'AUTHOR_CONTENT_AFTER_CANONICAL_REVIEW',
        studentPublicationStatus: 'STAGING_INACTIVE',
        pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      });
    }
  });
});
