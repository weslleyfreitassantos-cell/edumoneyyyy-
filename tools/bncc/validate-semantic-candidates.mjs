import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const catalogPath = path.resolve(root, process.argv[2] ?? 'content/bncc/official/catalog-2018.json');
const registryPath = path.resolve(root, process.argv[3] ?? 'content/bncc/canonical/registry.json');
const candidatesPath = path.resolve(root, process.argv[4] ?? 'content/bncc/mappings/semantic-candidates-2018.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const semantic = JSON.parse(fs.readFileSync(candidatesPath, 'utf8'));
const officialCodes = new Set((catalog.nodes ?? []).map((node) => node.code));
const registryCodes = new Set((registry.skills ?? []).map((skill) => skill.code));
const seen = new Set();
const failures = [];

if (semantic.schemaVersion !== 'tec-escola.bncc.semantic-candidates.v1') failures.push('schema_version');
if (semantic.catalogHash !== catalog.catalogHash) failures.push('catalog_hash');
if (semantic.statusContract?.candidateStatus !== 'SEMANTIC_CANDIDATE') failures.push('candidate_status_contract');
if (semantic.statusContract?.reviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') failures.push('review_status_contract');
if (semantic.summary?.promoted !== 0) failures.push('promoted_non_zero');

for (const item of semantic.candidates ?? []) {
  if (seen.has(item.officialCode)) failures.push(`duplicate:${item.officialCode}`);
  seen.add(item.officialCode);
  if (!officialCodes.has(item.officialCode)) failures.push(`unknown_official:${item.officialCode}`);
  if (item.kind === 'SKILL' && item.reviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') failures.push(`skill_review_status:${item.officialCode}`);
  if (item.kind !== 'SKILL' && item.candidates.length > 0) failures.push(`hierarchy_candidate:${item.officialCode}`);
  if (item.candidates.length > 3) failures.push(`too_many_candidates:${item.officialCode}`);
  const codes = new Set();
  for (const candidate of item.candidates) {
    if (codes.has(candidate.canonicalSkillCode)) failures.push(`duplicate_target:${item.officialCode}`);
    codes.add(candidate.canonicalSkillCode);
    if (!registryCodes.has(candidate.canonicalSkillCode)) failures.push(`unknown_skill:${item.officialCode}:${candidate.canonicalSkillCode}`);
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(candidate.confidence)) failures.push(`confidence:${item.officialCode}`);
    if (candidate.score < 0 || candidate.score > 1) failures.push(`score:${item.officialCode}`);
  }
}

if (seen.size !== officialCodes.size) failures.push('missing_official_nodes');
if (semantic.summary?.totalOfficialNodes !== officialCodes.size) failures.push('summary.totalOfficialNodes');
if (semantic.summary?.promoted !== 0) failures.push('promotion_status');

if (failures.length) {
  console.error(`BNCC_SEMANTIC_CANDIDATES_VALIDATION=FAIL ${failures.slice(0, 30).join(',')}`);
  process.exit(1);
}

console.log(`BNCC_SEMANTIC_CANDIDATES_VALIDATION=PASS total=${seen.size} suggestions=${semantic.summary.semanticSuggestions}`);
