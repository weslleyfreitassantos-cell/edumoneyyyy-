import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const SUBJECT_AREAS = {
  PORTUGUESE: 'LINGUA_PORTUGUESA',
  MATHEMATICS: 'MATEMATICA',
  SCIENCE: 'CIENCIAS',
  BIOLOGY: 'CIENCIAS_NATUREZA',
  PHYSICS: 'CIENCIAS_NATUREZA',
  CHEMISTRY: 'CIENCIAS_NATUREZA',
  HISTORY: 'HISTORIA',
  GEOGRAPHY: 'GEOGRAFIA',
  PHILOSOPHY: 'FILOSOFIA',
  SOCIOLOGY: 'SOCIOLOGIA',
  ART: 'ARTE',
  PHYSICAL_EDUCATION: 'EDUCACAO_FISICA',
  ENGLISH: 'LINGUA_INGLESA',
  RELIGIOUS_EDUCATION: 'ENSINO_RELIGIOSO',
  COMPUTING: 'COMPUTACAO',
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function stageFor(recommendedStage) {
  return recommendedStage === 'ENSINO_MEDIO' ? 'ENSINO_MEDIO' : 'ENSINO_FUNDAMENTAL';
}

export function syncV4Registries({ packRoot, canonicalPath }) {
  const v4RegistryPath = path.join(packRoot, 'registry.json');
  const currentV4 = readJson(v4RegistryPath);
  const currentCanonical = readJson(canonicalPath);
  const subjects = currentV4.subjects.map((subject) => {
    const subjectPath = path.join(packRoot, 'subjects', subject.code.toLowerCase(), 'skills.json');
    const skills = readJson(subjectPath);
    return {
      ...subject,
      anchors: skills.anchors.map((anchor) => anchor.code),
      leaves: skills.leaves,
    };
  });

  const subjectSkillCodes = new Set(subjects.flatMap((subject) => subject.leaves.map((leaf) => leaf.code)));
  const seedSkills = currentCanonical.skills
    .filter((skill) => !subjectSkillCodes.has(skill.code))
    .map((skill) => ({ ...skill }));
  const v4Skills = subjects.flatMap((subject) => subject.leaves.map((leaf) => ({
    code: leaf.code,
    stage: stageFor(leaf.recommendedStage),
    gradeLevels: Array.from({ length: leaf.recommendedGradeTo - leaf.recommendedGradeFrom + 1 }, (_value, index) => leaf.recommendedGradeFrom + index),
    subjectAreas: [SUBJECT_AREAS[subject.code] ?? subject.code],
    title: leaf.title,
    aliases: [leaf.domain],
    kind: 'LEAF',
  })));
  const canonicalSkills = [...seedSkills, ...v4Skills].sort((left, right) => left.code.localeCompare(right.code));
  const canonical = {
    schemaVersion: currentCanonical.schemaVersion,
    source: 'TECESCOLA_CORE_V1 migration seed + TECESCOLA_CORE_V4 subject skill registries',
    skills: canonicalSkills,
  };
  const v4 = {
    ...currentV4,
    subjects,
  };
  writeJson(v4RegistryPath, v4);
  writeJson(canonicalPath, canonical);
  return {
    v4,
    canonical,
    summary: {
      subjects: subjects.length,
      v4Leaves: v4Skills.length,
      seedSkills: seedSkills.length,
      canonicalSkills: canonicalSkills.length,
    },
  };
}

function run() {
  const packRoot = path.resolve(root, process.argv[2] ?? 'content/adaptive/tec-escola-core-v4');
  const canonicalPath = path.resolve(root, process.argv[3] ?? 'content/bncc/canonical/registry.json');
  const output = syncV4Registries({ packRoot, canonicalPath });
  console.log(`BNCC_V4_REGISTRY_SUBJECTS=${output.summary.subjects}`);
  console.log(`BNCC_V4_REGISTRY_LEAVES=${output.summary.v4Leaves}`);
  console.log(`BNCC_CANONICAL_REGISTRY_SEEDS=${output.summary.seedSkills}`);
  console.log(`BNCC_CANONICAL_REGISTRY_SKILLS=${output.summary.canonicalSkills}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
