import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagePath = path.resolve(root, process.argv[2] ?? 'content/bncc/packages/tec-escola-core-v4.json');
const relationshipsPath = path.resolve(root, process.argv[3] ?? 'content/bncc/canonical/relationships-v4.json');
const outputPath = path.resolve(root, process.argv[4] ?? 'content/bncc/curriculum/units-v5.json');
const contentPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const relationships = JSON.parse(fs.readFileSync(relationshipsPath, 'utf8'));

function stableJson(value) {
  return JSON.stringify(value, (_key, current) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return current;
    return Object.keys(current).sort().reduce((result, key) => {
      result[key] = current[key];
      return result;
    }, {});
  });
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function titleCase(value) {
  return value.toLowerCase().replace(/(^|_)([a-z])/g, (_match, prefix, letter) => `${prefix ? ' ' : ''}${letter.toUpperCase()}`);
}

const prerequisiteBySkill = new Map();
for (const [parent, child] of relationships.hierarchy ?? []) {
  const current = prerequisiteBySkill.get(child) ?? [];
  current.push(parent);
  prerequisiteBySkill.set(child, current.sort());
}

const units = [];
for (const pack of contentPackage.packages ?? []) {
  const byDomain = new Map();
  for (const skill of pack.skills ?? []) {
    const key = skill.domain || 'GERAL';
    const skills = byDomain.get(key) ?? [];
    skills.push(skill);
    byDomain.set(key, skills);
  }

  for (const [domain, skills] of [...byDomain.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const orderedSkills = [...skills].sort((left, right) => left.code.localeCompare(right.code));
    const grades = orderedSkills.flatMap((skill) => [skill.recommendedGradeFrom, skill.recommendedGradeTo]).filter(Number.isInteger);
    const stages = [...new Set(orderedSkills.map((skill) => skill.recommendedStage).filter(Boolean))];
    const unitId = `V5_${pack.subjectCode}_${domain}`;
    units.push({
      unitId,
      title: `${pack.subjectName} - ${titleCase(domain)}`,
      description: `Unidade derivada do pacote global ${pack.packVersion}, organizada por domínio para navegação progressiva.`,
      subjectCode: pack.subjectCode,
      subjectName: pack.subjectName,
      domain,
      stage: stages.length === 1 ? stages[0] : 'MULTI_STAGE',
      gradeFrom: grades.length ? Math.min(...grades) : null,
      gradeTo: grades.length ? Math.max(...grades) : null,
      officialCodes: [],
      canonicalSkills: orderedSkills.map((skill) => skill.code),
      learningGoals: orderedSkills.map((skill) => skill.title),
      prerequisites: orderedSkills.flatMap((skill) => prerequisiteBySkill.get(skill.code) ?? []).filter((code, index, list) => list.indexOf(code) === index).sort(),
      sequence: orderedSkills.map((skill, index) => ({
        position: index + 1,
        skillCode: skill.code,
        readiness: skill.readiness,
        contentStatus: skill.contentStatus,
        evidenceMode: skill.readiness === 'ADAPTIVE_READY' ? 'OBJECTIVE' : 'OBJECTIVE_SCAFFOLD',
        lessonCount: skill.lessonCount,
        questionCount: skill.questionCount,
      })),
      evidenceMode: orderedSkills.some((skill) => skill.readiness === 'ADAPTIVE_READY') ? 'OBJECTIVE_WITH_SCAFFOLD' : 'OBJECTIVE_SCAFFOLD',
      packageId: pack.packageId,
      packageVersion: pack.packVersion,
      availability: pack.availability,
      provenance: 'TECESCOLA_DERIVED_VERSIONED_CONTENT',
      bnccAlignment: 'NOT_CLAIMED',
      reviewStatus: pack.pedagogicalReviewStatus,
    });
  }
}

const artifact = {
  schemaVersion: 'tec-escola.bncc.curriculum-units.v5',
  sourceOfTruth: 'tec-escola-core-v4-content-packages',
  packVersion: contentPackage.packVersion,
  generatedAt: process.env.BNCC_GENERATED_AT ?? '2026-10-04T00:00:00.000Z',
  statusContract: {
    unitType: 'NAVIGABLE_CURRICULUM_UNIT',
    officialMappingRule: 'officialCodes remain empty while BNCC alignment is NOT_CLAIMED',
    availabilityRule: 'units inherit DEFAULT_AUTOMATIC_ELIGIBLE from their global package',
    adaptiveRule: 'units expose V4 readiness without changing the Adaptive V4 engine',
  },
  summary: {
    totalUnits: units.length,
    totalPackages: contentPackage.packages.length,
    totalSkills: units.reduce((total, unit) => total + unit.canonicalSkills.length, 0),
    automaticEligibleUnits: units.filter((unit) => unit.availability === 'DEFAULT_AUTOMATIC_ELIGIBLE').length,
    officialCodesClaimed: units.reduce((total, unit) => total + unit.officialCodes.length, 0),
  },
  units,
};

artifact.unitsHash = hash(stableJson({ ...artifact, generatedAt: undefined }));
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
console.log(`BNCC_CURRICULUM_UNITS_OUTPUT=${path.relative(root, outputPath)}`);
console.log(`BNCC_CURRICULUM_UNITS=${units.length}`);
console.log(`BNCC_CURRICULUM_UNIT_SKILLS=${artifact.summary.totalSkills}`);
console.log(`BNCC_CURRICULUM_UNIT_HASH=${artifact.unitsHash}`);
