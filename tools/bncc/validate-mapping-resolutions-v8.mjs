import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const resolutionPath = path.resolve(root, process.argv[2] ?? 'content/bncc/mappings/resolutions-v8.json');
const resolution = JSON.parse(fs.readFileSync(resolutionPath, 'utf8'));
const failures = [];
const allowedRelations = new Set(['PRIMARY', 'SUPPORTING', 'PREREQUISITE', 'TRANSFER']);
const allowedStatuses = new Set(['HUMAN_REVIEW_BLOCKED']);
const decisions = resolution.decisions ?? [];
const codes = new Set();

for (const decision of decisions) {
  if (codes.has(decision.officialCode)) failures.push(`duplicate:${decision.officialCode}`);
  codes.add(decision.officialCode);
  if (!decision.officialCode) failures.push('missing_code');
  if (!allowedStatuses.has(decision.resolutionStatus)) failures.push(`status:${decision.officialCode}`);
  if (decision.reviewStatus !== 'REVIEW_REQUIRED') failures.push(`review_status:${decision.officialCode}`);
  if (!Array.isArray(decision.blockers) || decision.blockers.length === 0) failures.push(`blockers:${decision.officialCode}`);
  if (!Array.isArray(decision.relationCandidates)) failures.push(`relations:${decision.officialCode}`);
  for (const relation of decision.relationCandidates ?? []) {
    if (!relation.canonicalSkillCode) failures.push(`relation_target:${decision.officialCode}`);
    if (relation.relationType !== null && !allowedRelations.has(relation.relationType)) {
      failures.push(`relation_type:${decision.officialCode}`);
    }
    if (relation.decision !== 'NOT_ASSERTED' && relation.relationType === null) {
      failures.push(`relation_decision:${decision.officialCode}`);
    }
  }
}

const expected = resolution.summary?.mappingPendingBefore;
if (resolution.summary?.resolved !== decisions.length) failures.push('summary.resolved');
if (resolution.summary?.humanReviewBlocked !== decisions.filter((item) => item.resolutionStatus === 'HUMAN_REVIEW_BLOCKED').length) failures.push('summary.humanReviewBlocked');
if (resolution.summary?.relationDecisionsAsserted !== 0) failures.push('summary.relationDecisionsAsserted');
if (resolution.summary?.duplicates !== 0) failures.push('summary.duplicates');
if (expected !== decisions.length) failures.push('summary.mappingPendingBefore');

if (failures.length) {
  console.error(`BNCC_MAPPING_RESOLUTIONS_VALIDATION=FAIL ${failures.slice(0, 30).join(',')}`);
  process.exit(1);
}

console.log(`BNCC_MAPPING_RESOLUTIONS_VALIDATION=PASS pending_before=${expected} resolved=${decisions.length} human_blocked=${resolution.summary.humanReviewBlocked} relations_asserted=0`);
