import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const outputPath = path.resolve(root, process.argv[2] ?? 'content/bncc/packages/tec-escola-core-v4.json');
const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
const failures = [];
if (output.schemaVersion !== 'tec-escola.bncc.content-packages.v1') failures.push('schema_version');
if (output.bnccAlignment !== 'NOT_CLAIMED') failures.push('bncc_alignment');
if (output.pedagogicalReviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') failures.push('pedagogical_review_status');

const packageIds = new Set();
let skillCount = 0;
for (const item of output.packages ?? []) {
  if (packageIds.has(item.packageId)) failures.push(`duplicate_package:${item.packageId}`);
  packageIds.add(item.packageId);
  for (const skill of item.skills ?? []) {
    skillCount += 1;
    if (skill.bnccAlignment !== 'NOT_CLAIMED') failures.push(`skill_bncc_alignment:${skill.code}`);
    if (skill.contentStatus === 'TECH_VALIDATED' && skill.readiness !== 'ADAPTIVE_READY') {
      failures.push(`published_not_adaptive_ready:${skill.code}`);
    }
    if (skill.contentStatus === 'TECH_VALIDATED' && (skill.lessonCount < 1 || skill.questionCount < 4)) {
      failures.push(`published_without_content:${skill.code}`);
    }
  }
  const expectedEligible = (item.skills ?? []).some((skill) => skill.contentStatus === 'TECH_VALIDATED');
  if ((item.availability === 'DEFAULT_AUTOMATIC_ELIGIBLE') !== expectedEligible) {
    failures.push(`availability:${item.packageId}`);
  }
}

if (output.summary?.totalPackages !== packageIds.size) failures.push('summary.totalPackages');
if (output.summary?.totalSkills !== skillCount) failures.push('summary.totalSkills');
if (output.summary?.defaultAutomaticEligible !== (output.packages ?? []).filter((item) => item.availability === 'DEFAULT_AUTOMATIC_ELIGIBLE').length) {
  failures.push('summary.defaultAutomaticEligible');
}

const { contentHash, ...withoutHash } = output;
const stableJson = JSON.stringify(withoutHash, (_key, current) => {
  if (!current || typeof current !== 'object' || Array.isArray(current)) return current;
  return Object.keys(current).sort().reduce((result, key) => {
    result[key] = current[key];
    return result;
  }, {});
});
if (crypto.createHash('sha256').update(stableJson).digest('hex') !== contentHash) failures.push('content_hash');

if (failures.length) {
  console.error(`BNCC_CONTENT_PACKAGES_VALIDATION=FAIL ${failures.slice(0, 30).join(',')}`);
  process.exit(1);
}

console.log(`BNCC_CONTENT_PACKAGES_VALIDATION=PASS packages=${packageIds.size} skills=${skillCount}`);
