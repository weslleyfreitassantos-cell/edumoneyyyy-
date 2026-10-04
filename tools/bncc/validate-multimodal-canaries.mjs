import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const canaryPath = path.resolve(root, process.argv[2] ?? 'content/bncc/canaries/multimodal-v1.json');
const catalogPath = path.resolve(root, 'content/bncc/official/catalog-2018.json');
const coveragePath = path.resolve(root, 'content/bncc/mappings/coverage-2018.json');
const registryPath = path.resolve(root, 'content/adaptive/tec-escola-core-v4/registry.json');
const packagePath = path.resolve(root, 'content/bncc/packages/tec-escola-core-v4.json');
const canaries = JSON.parse(fs.readFileSync(canaryPath, 'utf8'));
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const contentPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const failures = [];
const byId = new Map();
const officialCodes = new Set((catalog.nodes ?? []).map((node) => node.code));
const coverageByCode = new Map((coverage.mappings ?? []).map((mapping) => [mapping.officialCode, mapping]));
const skillCodes = new Set((registry.subjects ?? []).flatMap((subject) => [
  ...(subject.anchors ?? []),
  ...(subject.leaves ?? []).map((skill) => skill.code),
]));
const packageSkills = new Map((contentPackage.packages ?? []).flatMap((item) => (item.skills ?? []).map((skill) => [skill.code, skill])));

if (canaries.schemaVersion !== 'tec-escola.bncc.multimodal-canaries.v1') failures.push('schema_version');
if (canaries.technicalReviewStatus !== 'TECH_VALIDATED') failures.push('technical_review_status');
if (canaries.pedagogicalReviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') failures.push('pedagogical_review_status');

for (const canary of canaries.canaries ?? []) {
  if (byId.has(canary.id)) failures.push(`duplicate_id:${canary.id}`);
  byId.set(canary.id, canary);
  if (!officialCodes.has(canary.officialCode)) failures.push(`unknown_official_code:${canary.id}`);
  if (canary.canonicalSkill && !skillCodes.has(canary.canonicalSkill)) failures.push(`unknown_canonical_skill:${canary.id}`);
  const mapping = coverageByCode.get(canary.officialCode);
  if (!mapping) failures.push(`missing_mapping:${canary.id}`);
  if (mapping && canary.mappingStatus !== mapping.status && !(canary.mappingStatus === 'NOT_ADAPTIVE' && mapping.kind !== 'SKILL')) {
    failures.push(`mapping_status_mismatch:${canary.id}`);
  }
  if (canary.canonicalSkill && canary.contentIds) {
    const skill = packageSkills.get(canary.canonicalSkill);
    if (!skill) failures.push(`missing_content_skill:${canary.id}`);
    if (skill && canary.contentIds.includes(canary.canonicalSkill) && (skill.lessonCount < 1 || skill.questionCount < 1)) {
      failures.push(`content_skill_without_content:${canary.id}`);
    }
  }
}

const requiredModes = new Set(['OBJECTIVE', 'CONSTRUCTED', 'OBSERVATIONAL', 'PRACTICAL_OBSERVATIONAL_CONSTRUCTED', 'OBJECTIVE_COMPUTATIONAL']);
for (const mode of requiredModes) {
  if (!(canaries.canaries ?? []).some((canary) => canary.mode === mode)) failures.push(`missing_mode:${mode}`);
}

const constructed = byId.get(canaries.gate?.constructedCanary);
if (!constructed?.content?.guidance || !constructed.content.example || !constructed.content.constructedTask || !constructed.content.rubric?.length || !constructed.content.review) {
  failures.push('constructed_canary_incomplete');
}
const observational = byId.get(canaries.gate?.observationalCanary);
if (!observational?.content?.educatorGuidance || !observational.content.experience || !observational.content.materials?.length || !observational.content.observationCriteria?.length || !observational.content.reflectionRecord || observational.content.childQuiz !== false) {
  failures.push('observational_canary_incomplete');
}
if (!canaries.gate?.massAuthoringAllowed) {
  // This is intentional: canaries must pass before scale-out is enabled.
} else {
  failures.push('mass_authoring_enabled_before_review');
}

if (failures.length) {
  console.error(`BNCC_MULTIMODAL_CANARY_VALIDATION=FAIL ${failures.join(',')}`);
  process.exit(1);
}

console.log('OBJECTIVE_CANARY=PASS');
console.log('CONSTRUCTED_CANARY=PASS');
console.log('OBSERVATIONAL_CANARY=PASS');
console.log('PRACTICAL_CANARY=PASS');
console.log('COMPUTATIONAL_CANARY=PASS');
console.log(`BNCC_MULTIMODAL_CANARY_VALIDATION=PASS count=${canaries.canaries.length} mass_authoring_allowed=${canaries.gate.massAuthoringAllowed}`);

