import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDir, '../..');
const packageRoot = join(repositoryRoot, 'content/adaptive/tec-escola-core-v4');
const reportPath = join(repositoryRoot, 'reports/adaptive-v4-content-quality.json');

const normalize = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;
const hashJson = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function auditSubject(subjectCode, skills, lessons, questions) {
  const skillCodes = new Set(skills.map((skill) => skill.code));
  const lessonIds = new Set();
  const questionIds = new Set();
  const lessonGaps = [];
  const questionIssues = [];
  const duplicateStems = [];
  const stemOwners = new Map();
  const purposes = {};
  const questionFormats = {};

  for (const lesson of lessons) {
    if (lesson.skill && !skillCodes.has(lesson.skill)) lessonGaps.push({ id: lesson.id ?? lesson.skill, issue: 'UNKNOWN_SKILL' });
    const id = lesson.id ?? lesson.skill;
    if (id && lessonIds.has(id)) lessonGaps.push({ id, issue: 'DUPLICATE_LESSON_ID' });
    if (id) lessonIds.add(id);
    if (!nonEmpty(lesson.objective)) lessonGaps.push({ id, issue: 'MISSING_OBJECTIVE' });
    if (!nonEmpty(lesson.explanation)) lessonGaps.push({ id, issue: 'MISSING_EXPLANATION' });
    if (!nonEmpty(lesson.workedExample)) lessonGaps.push({ id, issue: 'MISSING_WORKED_EXAMPLE' });
  }

  for (const question of questions) {
    if (question.id && questionIds.has(question.id)) questionIssues.push({ id: question.id, issue: 'DUPLICATE_QUESTION_ID' });
    if (question.id) questionIds.add(question.id);
    if (!skillCodes.has(question.primarySkill)) questionIssues.push({ id: question.id, issue: 'UNKNOWN_PRIMARY_SKILL' });
    if (!nonEmpty(question.statement)) questionIssues.push({ id: question.id, issue: 'MISSING_STATEMENT' });
    if (!nonEmpty(question.explanation)) questionIssues.push({ id: question.id, issue: 'MISSING_EXPLANATION' });
    const options = Array.isArray(question.options) ? question.options : [];
    if (options.length < 2 || options.some((option) => !nonEmpty(option))) questionIssues.push({ id: question.id, issue: 'INVALID_OPTIONS' });
    if (!options.some((option) => normalize(option) === normalize(question.correctAnswer))) questionIssues.push({ id: question.id, issue: 'ANSWER_NOT_IN_OPTIONS' });
    if (new Set(options.map(normalize)).size !== options.length) questionIssues.push({ id: question.id, issue: 'DUPLICATE_OPTIONS' });

    const stem = normalize(question.statement);
    if (stemOwners.has(stem)) duplicateStems.push({ first: stemOwners.get(stem), duplicate: question.id });
    else if (stem) stemOwners.set(stem, question.id);

    const purpose = question.purpose || 'UNSPECIFIED';
    purposes[purpose] = (purposes[purpose] ?? 0) + 1;
    const format = question.interactionType || 'SINGLE_CHOICE';
    questionFormats[format] = (questionFormats[format] ?? 0) + 1;
  }

  const lessonStructure = {
    intro: lessons.filter((lesson) => nonEmpty(lesson.introduction)).length,
    explanation: lessons.filter((lesson) => nonEmpty(lesson.explanation)).length,
    workedExample: lessons.filter((lesson) => nonEmpty(lesson.workedExample)).length,
    guidedPractice: lessons.filter((lesson) => Array.isArray(lesson.guidedPractice) && lesson.guidedPractice.length > 0).length,
    application: lessons.filter((lesson) => Array.isArray(lesson.application) && lesson.application.length > 0).length,
    review: lessons.filter((lesson) => Array.isArray(lesson.review) && lesson.review.length > 0).length,
    learningCheck: lessons.filter((lesson) => Array.isArray(lesson.learningCheck) && lesson.learningCheck.length > 0).length,
  };
  const requiredLessonSections = Object.keys(lessonStructure);
  const completeLessonCount = lessons.filter((lesson) => requiredLessonSections.every((section) => {
    const value = lesson[section];
    return Array.isArray(value) ? value.length > 0 : nonEmpty(value);
  })).length;

  return {
    subject: subjectCode,
    skillCount: skills.length,
    lessonCount: lessons.length,
    questionCount: questions.length,
    questionsByPurpose: Object.fromEntries(Object.entries(purposes).sort(([a], [b]) => a.localeCompare(b))),
    questionFormats,
    lessonStructure,
    fullLessonCompleteness: {
      requiredSections: requiredLessonSections,
      completeLessonCount,
      incompleteLessonCount: lessons.length - completeLessonCount,
    },
    lessonGaps,
    questionIssues,
    duplicateStems,
    technicalStatus: lessonGaps.length || questionIssues.length || duplicateStems.length ? 'ISSUES_FOUND' : 'STRUCTURALLY_VALID',
    pedagogicalReview: 'PENDING_HUMAN_REVIEW',
  };
}

export async function buildAuditReport() {
  const manifest = JSON.parse(await readFile(join(packageRoot, 'manifest.json'), 'utf8'));
  const subjects = [];
  const packContent = [];
  for (const code of manifest.subjects) {
    const folder = code.toLocaleLowerCase('en-US');
    const [skills, lessons, questions] = await Promise.all([
      readFile(join(packageRoot, 'subjects', folder, 'skills.json'), 'utf8').then(JSON.parse),
      readFile(join(packageRoot, 'subjects', folder, 'lessons.json'), 'utf8').then(JSON.parse),
      readFile(join(packageRoot, 'subjects', folder, 'questions.json'), 'utf8').then(JSON.parse),
    ]);
    subjects.push(auditSubject(code, skills.leaves ?? [], lessons, questions));
    packContent.push({ subject: code, skills, lessons, questions });
  }

  const totals = subjects.reduce((sum, subject) => ({
    skills: sum.skills + subject.skillCount,
    lessons: sum.lessons + subject.lessonCount,
    questions: sum.questions + subject.questionCount,
    structuralIssues: sum.structuralIssues + subject.lessonGaps.length + subject.questionIssues.length + subject.duplicateStems.length,
    completeLessons: sum.completeLessons + subject.fullLessonCompleteness.completeLessonCount,
  }), { skills: 0, lessons: 0, questions: 0, structuralIssues: 0, completeLessons: 0 });
  const report = {
    reportVersion: 'central-estudos-v2-content-audit-v1',
    sourcePack: manifest.packVersion,
    sourcePackSha256: hashJson({ manifest, subjects: packContent }),
    provenance: manifest.provenance,
    bnccMapping: 'NOT_CLAIMED_BY_SOURCE_PACK',
    humanPedagogicalReview: 'PENDING',
    questionModeCoverage: 'SINGLE_CHOICE_ONLY_IN_CURRENT_V4_PACK',
    publication: 'NO_NEW_CONTENT_PUBLISHED_BY_THIS_AUDIT',
    totals,
    subjects,
  };
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await buildAuditReport();
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (process.argv.includes('--write')) {
    const { mkdir } = await import('node:fs/promises');
    const { dirname: pathDirname } = await import('node:path');
    await mkdir(pathDirname(reportPath), { recursive: true });
    await writeFile(reportPath, json, 'utf8');
    process.stdout.write(`Wrote ${reportPath}\n`);
  } else {
    process.stdout.write(json);
  }
}
