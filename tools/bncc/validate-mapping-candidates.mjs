import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const catalogPath = path.resolve(root, process.argv[2] ?? 'content/bncc/official/catalog-2018.json');
const candidatesPath = path.resolve(root, process.argv[3] ?? 'content/bncc/mappings/candidates-2018.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const coverage = JSON.parse(fs.readFileSync(candidatesPath, 'utf8'));
const failures = [];
if (coverage.schemaVersion !== 'tec-escola.bncc.mapping-candidates.v1') failures.push('schema_version');
if (coverage.statusContract?.candidateStatus !== 'CANDIDATE') failures.push('candidate_status_contract');
if (coverage.statusContract?.reviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') failures.push('review_status_contract');
const officialCodes = new Set((catalog.nodes ?? []).map((node) => node.code));
const registryCodes = new Set(coverage.registry?.skillCodes ?? []);
const candidateCodes = new Set();

for (const candidate of coverage.candidates ?? []) {
  if (candidateCodes.has(candidate.officialCode)) failures.push(`duplicate:${candidate.officialCode}`);
  candidateCodes.add(candidate.officialCode);
  if (!officialCodes.has(candidate.officialCode)) failures.push(`unknown_official:${candidate.officialCode}`);
  if (candidate.status !== 'CANDIDATE') failures.push(`status:${candidate.officialCode}`);
  if (candidate.reviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') failures.push(`review_status:${candidate.officialCode}`);
  if (candidate.mappingSource !== 'TECESCOLA_DERIVED_AUTOMATED') failures.push(`mapping_source:${candidate.officialCode}`);
  if (candidate.mappingType === 'ONE_TO_ONE_CANDIDATE' && candidate.candidateCanonicalSkillCodes.length !== 1) failures.push(`candidate_target:${candidate.officialCode}`);
  if (candidate.candidateCanonicalSkillCodes.some((code) => !registryCodes.has(code))) failures.push(`unknown_skill:${candidate.officialCode}`);
  if (candidate.mappingType === 'CANONICAL_GAP' && candidate.candidateCanonicalSkillCodes.length > 0) failures.push(`gap_with_target:${candidate.officialCode}`);
}

for (const code of officialCodes) if (!candidateCodes.has(code)) failures.push(`missing:${code}`);
if (coverage.catalogHash !== catalog.catalogHash) failures.push('catalog_hash');
if (coverage.summary?.totalOfficialNodes !== officialCodes.size) failures.push('summary.totalOfficialNodes');
if (coverage.summary?.pedagogicalReviewPending !== candidateCodes.size) failures.push('summary.pedagogicalReviewPending');

if (failures.length) {
  console.error(`BNCC_MAPPING_CANDIDATES_VALIDATION=FAIL ${failures.slice(0, 30).join(',')}`);
  process.exit(1);
}

console.log(`BNCC_MAPPING_CANDIDATES_VALIDATION=PASS total=${candidateCodes.size} registry=${registryCodes.size}`);
