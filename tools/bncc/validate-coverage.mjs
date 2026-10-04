import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const catalogPath = path.resolve(root, process.argv[2] ?? 'content/bncc/official/catalog-2018.json');
const coveragePath = path.resolve(root, process.argv[3] ?? 'content/bncc/mappings/coverage-2018.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
const failures = [];
const catalogCodes = new Set((catalog.nodes ?? []).map((node) => node.code));
const mappingCodes = new Set();
const allowedStatuses = new Set(['MAPPED', 'HIERARCHY_ONLY', 'EXPLICITLY_NON_ADAPTIVE', 'SOURCE_REVIEW_REQUIRED', 'UNACCOUNTED']);

for (const mapping of coverage.mappings ?? []) {
  if (mappingCodes.has(mapping.officialCode)) failures.push(`duplicate:${mapping.officialCode}`);
  mappingCodes.add(mapping.officialCode);
  if (!catalogCodes.has(mapping.officialCode)) failures.push(`unknown:${mapping.officialCode}`);
  if (!allowedStatuses.has(mapping.status)) failures.push(`status:${mapping.officialCode}`);
  if (mapping.status === 'MAPPED' && !(mapping.canonicalSkillCodes?.length > 0)) {
    failures.push(`mapped_without_canonical:${mapping.officialCode}`);
  }
  if (mapping.status === 'EXPLICITLY_NON_ADAPTIVE' && !mapping.rationale) {
    failures.push(`non_adaptive_without_rationale:${mapping.officialCode}`);
  }
  if (mapping.status === 'HIERARCHY_ONLY' && mapping.kind === 'SKILL') {
    failures.push(`skill_marked_hierarchy_only:${mapping.officialCode}`);
  }
  if (mapping.status === 'SOURCE_REVIEW_REQUIRED' && mapping.reviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') {
    failures.push(`source_review_without_pending_status:${mapping.officialCode}`);
  }
  if (mapping.status === 'HIERARCHY_ONLY' && mapping.reviewStatus !== 'NOT_APPLICABLE') {
    failures.push(`hierarchy_with_review_status:${mapping.officialCode}`);
  }
  if (mapping.status === 'UNACCOUNTED' && mapping.reviewStatus !== 'REVIEW_REQUIRED') {
    failures.push(`unaccounted_without_review:${mapping.officialCode}`);
  }
}

for (const code of catalogCodes) {
  if (!mappingCodes.has(code)) failures.push(`missing:${code}`);
}

const mapped = (coverage.mappings ?? []).filter((mapping) => mapping.status === 'MAPPED').length;
const hierarchyOnly = (coverage.mappings ?? []).filter((mapping) => mapping.status === 'HIERARCHY_ONLY').length;
const explicitlyNonAdaptive = (coverage.mappings ?? []).filter((mapping) => mapping.status === 'EXPLICITLY_NON_ADAPTIVE').length;
const sourceReviewRequired = (coverage.mappings ?? []).filter((mapping) => mapping.status === 'SOURCE_REVIEW_REQUIRED').length;
const unaccounted = (coverage.mappings ?? []).filter((mapping) => mapping.status === 'UNACCOUNTED').length;
if (coverage.summary?.totalOfficialNodes !== catalogCodes.size) failures.push('summary.totalOfficialNodes');
if (coverage.summary?.mapped !== mapped) failures.push('summary.mapped');
if (coverage.summary?.hierarchyOnly !== hierarchyOnly) failures.push('summary.hierarchyOnly');
if (coverage.summary?.explicitlyNonAdaptive !== explicitlyNonAdaptive) failures.push('summary.explicitlyNonAdaptive');
if (coverage.summary?.sourceReviewRequired !== sourceReviewRequired) failures.push('summary.sourceReviewRequired');
if (coverage.summary?.unaccounted !== unaccounted) failures.push('summary.unaccounted');
if (coverage.catalogHash !== catalog.catalogHash) failures.push('catalogHash');

if (failures.length) {
  console.error(`BNCC_MAPPING_VALIDATION=FAIL ${failures.slice(0, 30).join(',')}`);
  process.exit(1);
}

console.log(`BNCC_MAPPING_VALIDATION=PASS total=${catalogCodes.size} mapped=${mapped} hierarchy_only=${hierarchyOnly} source_review_required=${sourceReviewRequired} explicit_non_adaptive=${explicitlyNonAdaptive} unaccounted=${unaccounted}`);
