import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reviews = JSON.parse(fs.readFileSync(path.resolve(root, process.argv[2] ?? 'content/bncc/mappings/reviews-2018.json'), 'utf8'));
const candidates = JSON.parse(fs.readFileSync(path.resolve(root, process.argv[3] ?? 'content/bncc/mappings/candidates-2018.json'), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.resolve(root, process.argv[4] ?? 'content/bncc/official/catalog-2018.json'), 'utf8'));
const failures = [];
const candidateCodes = new Set(candidates.candidates.map((item) => item.officialCode));
const catalogCodes = new Set(catalog.nodes.map((item) => item.code));
const reviewCodes = new Set();
const allowedDecisions = new Set(['APPROVE_CONSERVATIVE', 'NEEDS_HUMAN_REVIEW', 'REJECT', 'CANONICAL_GAP', 'HIERARCHY_ONLY']);

for (const review of reviews.reviews ?? []) {
  if (reviewCodes.has(review.officialCode)) failures.push(`duplicate:${review.officialCode}`);
  reviewCodes.add(review.officialCode);
  if (!candidateCodes.has(review.officialCode)) failures.push(`unknown_candidate:${review.officialCode}`);
  if (!catalogCodes.has(review.officialCode)) failures.push(`unknown_catalog:${review.officialCode}`);
  if (!allowedDecisions.has(review.decision)) failures.push(`decision:${review.officialCode}`);
  if (review.promotionStatus !== 'NOT_PROMOTED') failures.push(`promoted:${review.officialCode}`);
  if (review.decision === 'APPROVE_CONSERVATIVE') {
    if (review.pedagogicalReviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') failures.push(`approve_without_pedagogical_pending:${review.officialCode}`);
    if (review.checks?.scoreRecomputed < 0.75 || review.checks?.margin < 0.15) failures.push(`approve_without_threshold:${review.officialCode}`);
  }
  if (review.decision === 'HIERARCHY_ONLY' && review.canonicalSkill) failures.push(`hierarchy_with_skill:${review.officialCode}`);
}

for (const code of candidateCodes) if (!reviewCodes.has(code)) failures.push(`missing:${code}`);
if (reviews.catalogHash !== catalog.catalogHash) failures.push('catalogHash');
if (reviews.candidatesHash !== candidates.candidatesHash) failures.push('candidatesHash');

const count = (predicate) => (reviews.reviews ?? []).filter(predicate).length;
const expected = {
  total: reviews.reviews?.length ?? 0,
  technicallyReviewed: count((item) => item.reviewStatus === 'TECHNICALLY_REVIEWED'),
  technicallyClassified: count((item) => item.reviewStatus === 'TECHNICALLY_CLASSIFIED'),
  approveConservative: count((item) => item.decision === 'APPROVE_CONSERVATIVE'),
  needsHumanReview: count((item) => item.decision === 'NEEDS_HUMAN_REVIEW'),
  rejected: count((item) => item.decision === 'REJECT'),
  canonicalGaps: count((item) => item.decision === 'CANONICAL_GAP'),
  hierarchyOnly: count((item) => item.decision === 'HIERARCHY_ONLY'),
  pedagogicalReviewPending: count((item) => item.pedagogicalReviewStatus === 'PEDAGOGICAL_REVIEW_PENDING'),
  promoted: 0,
};
for (const [key, value] of Object.entries(expected)) {
  if (reviews.summary?.[key] !== value) failures.push(`summary.${key}`);
}

const stableJson = (value) => JSON.stringify(value, (_key, current) => {
  if (!current || typeof current !== 'object' || Array.isArray(current)) return current;
  return Object.keys(current).sort().reduce((result, key) => {
    result[key] = current[key];
    return result;
  }, {});
});
const expectedHash = crypto.createHash('sha256').update(stableJson({ ...reviews, generatedAt: undefined, reviewHash: undefined })).digest('hex');
if (reviews.reviewHash !== expectedHash) failures.push('reviewHash');

if (failures.length) {
  console.error(`BNCC_MAPPING_REVIEW_VALIDATION=FAIL ${failures.slice(0, 30).join(',')}`);
  process.exit(1);
}

console.log(`BNCC_MAPPING_REVIEW_VALIDATION=PASS total=${expected.total} approve_conservative=${expected.approveConservative} needs_human=${expected.needsHumanReview} gaps=${expected.canonicalGaps} hierarchy_only=${expected.hierarchyOnly}`);
