import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const candidatesPath = path.resolve(root, process.argv[2] ?? 'content/bncc/mappings/candidates-2018.json');
const gapsPath = path.resolve(root, process.argv[3] ?? 'content/bncc/canonical/gaps-reviewed.json');
const candidates = JSON.parse(fs.readFileSync(candidatesPath, 'utf8'));
const gaps = JSON.parse(fs.readFileSync(gapsPath, 'utf8'));
const expected = new Set((candidates.candidates ?? []).filter((item) => item.mappingType === 'CANONICAL_GAP').map((item) => item.officialCode));
const actual = new Set();
const failures = [];

if (gaps.schemaVersion !== 'tec-escola.bncc.canonical-gaps.v1') failures.push('schema_version');
if (gaps.catalogHash !== candidates.catalogHash) failures.push('catalog_hash');
if (gaps.statusContract?.gapStatus !== 'CANONICAL_GAP_REVIEW_REQUIRED') failures.push('gap_status_contract');
if (gaps.summary?.promoted !== 0) failures.push('promoted_non_zero');
for (const cluster of gaps.clusters ?? []) {
  if (cluster.domain !== null || cluster.suggestedSkill !== null || cluster.objective !== null || cluster.capability !== null) failures.push(`unreviewed_content:${cluster.clusterId}`);
  if (cluster.reviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') failures.push(`review_status:${cluster.clusterId}`);
  if (cluster.promotionStatus !== 'NOT_PROMOTED') failures.push(`promotion_status:${cluster.clusterId}`);
  for (const code of cluster.officialCodes ?? []) {
    if (actual.has(code)) failures.push(`duplicate:${code}`);
    actual.add(code);
  }
}
for (const code of expected) if (!actual.has(code)) failures.push(`missing:${code}`);
for (const code of actual) if (!expected.has(code)) failures.push(`unexpected:${code}`);
if (gaps.summary?.officialGapCodes !== expected.size) failures.push('summary.officialGapCodes');

if (failures.length) {
  console.error(`BNCC_CANONICAL_GAPS_VALIDATION=FAIL ${failures.slice(0, 30).join(',')}`);
  process.exit(1);
}

console.log(`BNCC_CANONICAL_GAPS_VALIDATION=PASS codes=${actual.size} clusters=${gaps.summary.gapClusters}`);
