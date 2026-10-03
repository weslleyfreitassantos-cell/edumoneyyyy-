import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const ACTIVE_STATUSES = new Set(['TECH_VALIDATED', 'AUTHORED']);

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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function buildPackage(subject, subjectData) {
  const lessonBySkill = new Map(subjectData.lessons.map((lesson) => [lesson.skill, lesson]));
  const questionsBySkill = new Map();
  for (const question of subjectData.questions) {
    const list = questionsBySkill.get(question.primarySkill) ?? [];
    list.push(question);
    questionsBySkill.set(question.primarySkill, list);
  }

  const skills = subjectData.skills.leaves.map((skill) => {
    const lesson = lessonBySkill.get(skill.code);
    const questions = questionsBySkill.get(skill.code) ?? [];
    const questionStatuses = questions.map((question) => question.content_authoring_status);
    const contentReady = skill.readiness === 'ADAPTIVE_READY'
      && ACTIVE_STATUSES.has(skill.content_authoring_status)
      && lesson
      && ACTIVE_STATUSES.has(lesson.content_authoring_status)
      && questions.length >= 4
      && questionStatuses.every((status) => ACTIVE_STATUSES.has(status));

    return {
      code: skill.code,
      title: skill.title,
      domain: skill.domain,
      parent: skill.parent,
      recommendedStage: skill.recommendedStage,
      recommendedGradeFrom: skill.recommendedGradeFrom,
      recommendedGradeTo: skill.recommendedGradeTo,
      readiness: skill.readiness,
      contentStatus: contentReady ? 'TECH_VALIDATED' : 'SCAFFOLD',
      bnccAlignment: 'NOT_CLAIMED',
      lessonCount: lesson ? 1 : 0,
      questionCount: questions.length,
      questionPurposes: [...new Set(questions.map((question) => question.purpose))].sort(),
    };
  });

  const readySkills = skills.filter((skill) => skill.contentStatus === 'TECH_VALIDATED');
  return {
    packageId: `tec-escola-core-v4-${subject.code.toLowerCase()}`,
    packVersion: 'tec-escola-core-v4',
    subjectCode: subject.code,
    subjectName: subject.name,
    provenance: 'TECESCOLA_DERIVED_VERSIONED_CONTENT',
    bnccAlignment: 'NOT_CLAIMED',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    availability: readySkills.length > 0 ? 'DEFAULT_AUTOMATIC_ELIGIBLE' : 'CURATOR_REVIEW_REQUIRED',
    skills,
    summary: {
      totalSkills: skills.length,
      techValidatedSkills: readySkills.length,
      scaffoldSkills: skills.length - readySkills.length,
      lessons: skills.reduce((total, skill) => total + skill.lessonCount, 0),
      questions: skills.reduce((total, skill) => total + skill.questionCount, 0),
    },
  };
}

export function buildContentPackages(packRoot) {
  const manifest = readJson(path.join(packRoot, 'manifest.json'));
  const registry = readJson(path.join(packRoot, 'registry.json'));
  const packages = registry.subjects.map((subject) => {
    const subjectDir = path.join(packRoot, 'subjects', subject.code.toLowerCase());
    return buildPackage(subject, {
      skills: readJson(path.join(subjectDir, 'skills.json')),
      lessons: readJson(path.join(subjectDir, 'lessons.json')),
      questions: readJson(path.join(subjectDir, 'questions.json')),
    });
  });
  const summary = {
    totalPackages: packages.length,
    defaultAutomaticEligible: packages.filter((item) => item.availability === 'DEFAULT_AUTOMATIC_ELIGIBLE').length,
    curatorReviewRequired: packages.filter((item) => item.availability === 'CURATOR_REVIEW_REQUIRED').length,
    totalSkills: packages.reduce((total, item) => total + item.summary.totalSkills, 0),
    techValidatedSkills: packages.reduce((total, item) => total + item.summary.techValidatedSkills, 0),
    scaffoldSkills: packages.reduce((total, item) => total + item.summary.scaffoldSkills, 0),
    totalLessons: packages.reduce((total, item) => total + item.summary.lessons, 0),
    totalQuestions: packages.reduce((total, item) => total + item.summary.questions, 0),
  };
  const output = {
    schemaVersion: 'tec-escola.bncc.content-packages.v1',
    packVersion: manifest.packVersion,
    sourceOfTruth: manifest.sourceOfTruth,
    provenance: manifest.provenance,
    bnccAlignment: 'NOT_CLAIMED',
    pedagogicalReviewStatus: manifest.pedagogicalReviewStatus,
    statusContract: {
      publishedStatus: 'TECH_VALIDATED',
      scaffoldStatus: 'SCAFFOLD',
      promotionRule: 'SCAFFOLD nunca entra em disponibilidade automática; BNCC só é declarado após mapeamento independente.',
    },
    summary,
    packages,
  };
  return { ...output, contentHash: hash(stableJson(output)) };
}

function run() {
  const packRoot = path.resolve(root, process.argv[2] ?? 'content/adaptive/tec-escola-core-v4');
  const outputPath = path.resolve(root, process.argv[3] ?? 'content/bncc/packages/tec-escola-core-v4.json');
  const output = buildContentPackages(packRoot);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`BNCC_CONTENT_PACKAGES_OUTPUT=${path.relative(root, outputPath)}`);
  console.log(`BNCC_CONTENT_PACKAGES_TOTAL=${output.summary.totalPackages}`);
  console.log(`BNCC_CONTENT_PACKAGES_DEFAULT_ELIGIBLE=${output.summary.defaultAutomaticEligible}`);
  console.log(`BNCC_CONTENT_SKILLS_TECH_VALIDATED=${output.summary.techValidatedSkills}`);
  console.log(`BNCC_CONTENT_HASH=${output.contentHash}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
