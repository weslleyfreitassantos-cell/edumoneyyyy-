import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PACK_DIR = resolve(ROOT, 'content/adaptive/tec-escola-core-v5');
const DEFAULT_OUTPUT = resolve(PACK_DIR, 'pedagogical-review-v1.json');
const REQUIRED_PURPOSES = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];
const REQUIRED_LESSON_FIELDS = [
  'title',
  'objective',
  'summary',
  'explanation',
  'workedExample',
  'commonMistake',
  'tips',
];

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function hasText(value) {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

function addIssue(issues, code, detail) {
  issues.push({ code, detail });
}

function auditVisualStimulus(question, issues) {
  if (!question.visualStimulus) return;
  const items = Array.isArray(question.visualStimulus.items)
    ? question.visualStimulus.items
    : [question.visualStimulus];
  if (!items.length) {
    addIssue(issues, 'VISUAL_STIMULUS_EMPTY', question.id ?? 'unknown');
    return;
  }
  items.forEach((item, index) => {
    if (!hasText(item?.src)) addIssue(issues, 'VISUAL_STIMULUS_SRC_MISSING', `${question.id ?? 'unknown'}:${index}`);
    if (!hasText(item?.alt)) addIssue(issues, 'VISUAL_STIMULUS_ALT_MISSING', `${question.id ?? 'unknown'}:${index}`);
  });
}

export function auditPack(pack, file) {
  const issues = [];
  const lesson = pack.lesson ?? {};
  const questions = Array.isArray(pack.questions) ? pack.questions : [];

  REQUIRED_LESSON_FIELDS.forEach((field) => {
    if (field === 'tips' || field === 'progression') {
      if (!Array.isArray(lesson[field]) || lesson[field].length === 0) {
        addIssue(issues, `LESSON_${field.toUpperCase()}_MISSING`, field);
      }
      return;
    }
    if (!hasText(lesson[field])) addIssue(issues, `LESSON_${field.toUpperCase()}_MISSING`, field);
  });

  if (questions.length < 8) addIssue(issues, 'QUESTION_COUNT_BELOW_MINIMUM', String(questions.length));
  const purposes = new Set(questions.map((question) => question.purpose));
  REQUIRED_PURPOSES
    .filter((purpose) => !purposes.has(purpose))
    .forEach((purpose) => addIssue(issues, 'PURPOSE_MISSING', purpose));

  const statements = new Set();
  questions.forEach((question, index) => {
    const label = question.id ?? `${pack.contentId ?? file}:${index}`;
    ['statement', 'explanation', 'hint', 'errorFocus', 'purpose', 'difficulty', 'cognitiveProcess'].forEach((field) => {
      if (!hasText(question[field])) addIssue(issues, 'QUESTION_FIELD_MISSING', `${label}:${field}`);
    });

    const options = Array.isArray(question.options) ? question.options : [];
    const distinctOptions = new Set(options.map((option) => String(option).trim()));
    if (options.length !== 4 || distinctOptions.size !== 4) {
      addIssue(issues, 'QUESTION_OPTIONS_INVALID', label);
    }
    if (!options.some((option) => String(option).trim() === String(question.correctAnswer ?? '').trim())) {
      addIssue(issues, 'QUESTION_CORRECT_ANSWER_NOT_IN_OPTIONS', label);
    }
    const normalizedStatement = String(question.statement ?? '').trim().toLocaleLowerCase();
    if (normalizedStatement && statements.has(normalizedStatement)) {
      addIssue(issues, 'QUESTION_STATEMENT_DUPLICATED', label);
    }
    if (normalizedStatement) statements.add(normalizedStatement);
    auditVisualStimulus(question, issues);
  });

  const pedagogicalReview = issues.length === 0 ? 'APPROVED_BY_STRUCTURAL_PEDAGOGICAL_RUBRIC' : 'HOLD_FOR_PEDAGOGICAL_REPAIR';
  return {
    file,
    contentId: pack.contentId ?? null,
    canonicalSkillCode: pack.canonicalSkillCode ?? null,
    subject: pack.subject ?? null,
    title: lesson.title ?? null,
    questionCount: questions.length,
    purposes: REQUIRED_PURPOSES.filter((purpose) => purposes.has(purpose)),
    pedagogicalReview,
    publicationDecision: issues.length === 0 ? 'HOLD_FOR_OFFICIAL_MAPPING' : 'HOLD_FOR_PEDAGOGICAL_REPAIR',
    issues,
  };
}

export function buildPedagogicalReview({ packDirectory = PACK_DIR, reviewedAt = new Date().toISOString() } = {}) {
  const entries = readdirSync(packDirectory)
    .filter((file) => file.endsWith('.json'))
    .map((file) => ({ file, pack: readJson(resolve(packDirectory, file)) }))
    .filter(({ pack }) => pack.packVersion === 'tec-escola-core-v5-question-first')
    .filter(({ pack }) => pack.publicationStatus === 'STAGING')
    .sort((left, right) => left.file.localeCompare(right.file))
    .map(({ file, pack }) => auditPack(pack, file));

  const approved = entries.filter((entry) => entry.issues.length === 0);
  const held = entries.filter((entry) => entry.issues.length > 0);
  const report = {
    schemaVersion: 'tec-escola.adaptive.pedagogical-review.v1',
    reviewedAt,
    reviewerType: 'CODEX_AI_PEDAGOGICAL_REVIEW',
    scope: 'STAGING question-first V5 packs only',
    rubric: {
      lessonFields: REQUIRED_LESSON_FIELDS,
      minimumQuestions: 8,
      requiredPurposeSequence: REQUIRED_PURPOSES,
      progression: 'recommended when present; not a publication blocker for a complete pack',
      questionOptions: 4,
      accessibility: ['visual stimulus requires src and alt text'],
      feedback: ['explanation', 'hint', 'errorFocus'],
    },
    publicationPolicy: {
      approvedByRubricStillRequiresOfficialMapping: true,
      officialMappingStatusRequired: 'MAPPED',
      pedagogicalReviewStatusRequired: 'PEDAGOGICAL_REVIEWED',
      sourceFilesWereNotMutated: true,
    },
    summary: {
      reviewed: entries.length,
      pedagogicallyApproved: approved.length,
      heldForRepair: held.length,
      publishableByCurrentStudentGate: 0,
    },
    entries,
  };
  const digest = createHash('sha256').update(JSON.stringify(report)).digest('hex');
  return { ...report, reportSha256: digest };
}

export function writePedagogicalReview(outputPath = DEFAULT_OUTPUT) {
  const report = buildPedagogicalReview();
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const outputPath = process.argv[2] ? resolve(ROOT, process.argv[2]) : DEFAULT_OUTPUT;
  const report = writePedagogicalReview(outputPath);
  process.stdout.write(`${JSON.stringify({ outputPath, summary: report.summary, reportSha256: report.reportSha256 }, null, 2)}\n`);
}
