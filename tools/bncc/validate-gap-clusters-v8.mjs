import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const candidates = JSON.parse(fs.readFileSync(path.resolve(root, process.argv[2] ?? 'content/bncc/mappings/candidates-2018.json'), 'utf8'));
const clusters = JSON.parse(fs.readFileSync(path.resolve(root, process.argv[3] ?? 'content/bncc/canonical/clusters-v8.json'), 'utf8'));
const expected = new Set((candidates.candidates ?? []).filter((item) => item.mappingType === 'CANONICAL_GAP').map((item) => item.officialCode));
const actual = new Set(); const failures = [];
for (const cluster of clusters.clusters ?? []) {
  if (!cluster.clusterId.startsWith('V8_GAP_')) failures.push(`cluster_id:${cluster.clusterId}`);
  if (!cluster.officialCodes?.length || !cluster.semanticObject || !cluster.cognitiveOperation) failures.push(`missing_cluster_context:${cluster.clusterId}`);
  if (cluster.reviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') failures.push(`review_status:${cluster.clusterId}`);
  if (cluster.promotionStatus !== 'NOT_PROMOTED') failures.push(`promotion_status:${cluster.clusterId}`);
  for (const code of cluster.officialCodes ?? []) { if (actual.has(code)) failures.push(`duplicate_code:${code}`); actual.add(code); if (!expected.has(code)) failures.push(`unexpected_code:${code}`); }
  const identity = `${cluster.stage}|${cluster.gradeRange}|${cluster.component}|${cluster.cognitiveOperation}|${cluster.semanticObject}`;
  if (cluster.clusterId !== `V8_GAP_${identity.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase()}`) failures.push(`unstable_id:${cluster.clusterId}`);
}
for (const code of expected) if (!actual.has(code)) failures.push(`missing_code:${code}`);
if (clusters.summary?.officialGapCodes !== actual.size) failures.push('summary.officialGapCodes');
if (clusters.summary?.gapClusters !== clusters.clusters.length) failures.push('summary.gapClusters');
if (failures.length) { console.error(`BNCC_V8_CLUSTER_VALIDATION=FAIL ${failures.slice(0, 30).join(',')}`); process.exit(1); }
console.log(`BNCC_V8_CLUSTER_VALIDATION=PASS codes=${actual.size} clusters=${clusters.clusters.length} contextualized=${clusters.summary.contextualizedClusters}`);
