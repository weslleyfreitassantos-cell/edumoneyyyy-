import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagePath = path.resolve(root, process.argv[2] ?? 'content/bncc/packages/tec-escola-core-v4.json');
const unitsPath = path.resolve(root, process.argv[3] ?? 'content/bncc/curriculum/units-v5.json');
const contentPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const units = JSON.parse(fs.readFileSync(unitsPath, 'utf8'));
const failures = [];
const packageSkills = new Set(contentPackage.packages.flatMap((pack) => pack.skills.map((skill) => skill.code)));
const unitIds = new Set();
const unitSkills = [];

for (const unit of units.units ?? []) {
  if (unitIds.has(unit.unitId)) failures.push(`duplicate_unit:${unit.unitId}`);
  unitIds.add(unit.unitId);
  if (!unit.subjectCode || !unit.domain || !unit.title) failures.push(`incomplete_unit:${unit.unitId}`);
  if (unit.bnccAlignment !== 'NOT_CLAIMED' || unit.officialCodes.length !== 0) failures.push(`unclaimed_bncc_violation:${unit.unitId}`);
  if (!Array.isArray(unit.sequence) || unit.sequence.length !== unit.canonicalSkills.length) failures.push(`sequence:${unit.unitId}`);
  for (const [index, item] of unit.sequence.entries()) {
    if (item.position !== index + 1) failures.push(`sequence_order:${unit.unitId}`);
    if (!packageSkills.has(item.skillCode)) failures.push(`unknown_skill:${item.skillCode}`);
    unitSkills.push(item.skillCode);
  }
}

const expectedSkills = [...packageSkills].sort();
const actualSkills = [...new Set(unitSkills)].sort();
if (JSON.stringify(expectedSkills) !== JSON.stringify(actualSkills)) failures.push('package_skill_coverage');
if (units.summary?.totalUnits !== units.units.length) failures.push('summary.totalUnits');
if (units.summary?.totalSkills !== unitSkills.length) failures.push('summary.totalSkills');
if (units.summary?.officialCodesClaimed !== 0) failures.push('summary.officialCodesClaimed');
if (units.summary?.totalPackages !== contentPackage.packages.length) failures.push('summary.totalPackages');

if (failures.length) {
  console.error(`BNCC_CURRICULUM_UNITS_VALIDATION=FAIL ${failures.slice(0, 30).join(',')}`);
  process.exit(1);
}

console.log(`BNCC_CURRICULUM_UNITS_VALIDATION=PASS units=${units.units.length} skills=${unitSkills.length} official_codes=0`);
