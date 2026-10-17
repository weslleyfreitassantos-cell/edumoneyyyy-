import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));

function nextAction(node, mapping, verified) {
  if (verified) return node.kind === 'LEARNING_DEVELOPMENT_OBJECTIVE' ? 'AUTHOR_EXPERIENTIAL_EVIDENCE_AND_PEDAGOGICAL_REVIEW' : 'AUTHOR_CONTENT_AFTER_CANONICAL_REVIEW';
  if (mapping.status === 'CANONICAL_GAP') return 'CANONICAL_MAPPING_REVIEW_REQUIRED';
  if (mapping.status === 'HIERARCHY_ONLY') return 'CURRICULAR_HIERARCHY_REVIEW_REQUIRED';
  if (mapping.status === 'HUMAN_REVIEW_BLOCKED') return 'HUMAN_MAPPING_REVIEW_REQUIRED';
  return 'SOURCE_AND_MAPPING_REVIEW_REQUIRED';
}

export function buildPendingCoverageAuditV3() {
  const catalog = readJson('content/bncc/official/catalog-2018.json');
  const coverage = readJson('content/bncc/mappings/coverage-2018.json');
  const inventory = readJson('content/bncc/authoring/knowledge-factory-inventory-v4.json');
  const verification = readJson('content/bncc/authoring/source-verification-v2.json');
  const mappings = new Map(coverage.mappings.map((mapping) => [mapping.officialCode, mapping]));
  const verified = new Set(verification.records.map((record) => record.officialCode));
  const queue = new Map((inventory.queue?.items ?? []).map((item) => [item.id, item]));
  const pending = (catalog.nodes ?? []).filter((node) => (mappings.get(node.code)?.status ?? 'UNACCOUNTED') !== 'MAPPED');
  const records = pending.map((node) => {
    const mapping = mappings.get(node.code) ?? { status: 'UNACCOUNTED' };
    const queueItem = queue.get(node.code);
    const queueStatus = verified.has(node.code) && ['HUMAN_REVIEW_BLOCKED', 'CANONICAL_GAP'].includes(mapping.status)
      ? 'MAPPING_REVIEW_REQUIRED'
      : queueItem?.status ?? 'NOT_IN_QUEUE';
    return {
      officialCode: node.code,
      stage: node.stage,
      componentCode: node.componentCode,
      kind: node.kind,
      mappingStatus: mapping.status,
      queueStatus,
      exactSourceVerified: verified.has(node.code),
      nextAction: nextAction(node, mapping, verified.has(node.code)),
      studentPublicationStatus: 'STAGING_INACTIVE',
      pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    };
  });
  const countBy = (field) => Object.fromEntries([...records.reduce((map, record) => map.set(record[field], (map.get(record[field]) ?? 0) + 1), new Map()).entries()].sort());
  const samples = Object.fromEntries([...new Set(records.map((record) => record.nextAction))].sort().map((action) => [action, records.filter((record) => record.nextAction === action).slice(0, 12).map((record) => record.officialCode)]));
  return {
    schemaVersion: 'tec-escola.bncc.pending-coverage-audit.v3',
    campaignId: 'TECESCOLA_BNCC_5000_AND_REAL_COVERAGE_V3',
    generatedAt: '2026-10-16',
    auditedFacts: { officialNodes: catalog.nodes?.length ?? 0, pendingNodes: records.length, queueItems: inventory.queue?.totalItems ?? 0, mappedNodes: (catalog.nodes ?? []).length - records.length },
    byMappingStatus: countBy('mappingStatus'),
    byQueueStatus: countBy('queueStatus'),
    byNextAction: countBy('nextAction'),
    samples,
    policy: {
      noAutomaticPromotion: true,
      canonicalGapRule: 'No content package may claim BNCC alignment until a stable canonical mapping is reviewed.',
      earlyChildhoodRule: 'Development objectives use educator-mediated observation, not automatic child multiple-choice quizzes.',
      publicationGates: { studentPublicationStatus: 'STAGING_INACTIVE', pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING', officialMappingStatus: 'NOT_CLAIMED' },
    },
    records,
  };
}

function main() {
  const report = buildPendingCoverageAuditV3();
  fs.writeFileSync(path.join(ROOT, 'content/bncc/authoring/pending-coverage-audit-v3.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ valid: true, pendingNodes: report.auditedFacts.pendingNodes, byMappingStatus: report.byMappingStatus, byQueueStatus: report.byQueueStatus }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
