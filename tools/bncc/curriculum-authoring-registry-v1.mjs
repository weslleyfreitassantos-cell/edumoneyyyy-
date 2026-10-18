import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateCurriculumPackageRubric } from './curriculum-package-rubric.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const AUTHORING_DIR = 'content/bncc/authoring/packages';
const SOURCE_PATH = 'content/bncc/authoring/source-verification-v2.json';
const PURPOSES = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];
const POSITIONS = ['A', 'B', 'C', 'D'];

function buildAuthenticActivities(activities = [], contentId) {
  const levelNames = {
    Inicial: 'emerging',
    'Em desenvolvimento': 'developing',
    Consolidado: 'proficient',
  };
  return activities.map((activity, index) => {
    const levels = Object.fromEntries((activity.rubric ?? []).map((entry) => {
      const separator = entry.indexOf(':');
      const label = entry.slice(0, separator).trim();
      return [levelNames[label], entry.slice(separator + 1).trim()];
    }).filter(([level, text]) => level && text));
    return {
      id: activity.id ?? `${contentId}-activity-${index + 1}`,
      title: activity.title,
      instructions: [activity.context, ...(activity.steps ?? []).map((step, stepIndex) => `${stepIndex + 1}. ${step}`)].join('\n'),
      steps: activity.steps,
      evidence: activity.evidence,
      privacyGuard: activity.privacyGuard ?? 'Usar materiais escolares seguros, fictícios ou autorizados; não coletar nem compartilhar dados pessoais.',
      rubric: [
        {
          criterion: 'Realização da tarefa',
          emerging: levels.emerging,
          developing: levels.developing,
          proficient: levels.proficient,
        },
        {
          criterion: 'Registro e explicação da evidência',
          emerging: 'Identifica uma parte da evidência com demonstração e apoio.',
          developing: 'Registra a evidência principal usando pistas ou lembretes.',
          proficient: 'Registra a evidência observável e a relaciona ao resultado da tarefa.',
        },
      ],
    };
  });
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

let sourceRecords;
function getSourceRecords() {
  sourceRecords ??= new Map((readJson(SOURCE_PATH).records ?? []).map((record) => [record.officialCode, record]));
  return sourceRecords;
}

let specsByCode;
export function discoverAuthoredCurriculumSpecs() {
  if (specsByCode) return specsByCode;
  const directory = path.join(ROOT, AUTHORING_DIR);
  const specs = new Map();
  if (!fs.existsSync(directory)) return (specsByCode = specs);
  for (const name of fs.readdirSync(directory).filter((entry) => entry.endsWith('.json')).sort()) {
    const relativePath = `${AUTHORING_DIR}/${name}`;
    const spec = readJson(relativePath);
    if (spec.schemaVersion !== 'tec-escola.bncc.authored-curriculum-package.v1') throw new Error(`INVALID_AUTHORING_PACKAGE_SCHEMA:${relativePath}`);
    if (!spec.officialCode || specs.has(spec.officialCode)) throw new Error(`DUPLICATE_OR_MISSING_AUTHORING_CODE:${relativePath}`);
    specs.set(spec.officialCode, { ...spec, sourceFile: relativePath });
  }
  specsByCode = specs;
  return specsByCode;
}

export function buildAuthoredCurriculumPack(specOrCode) {
  const spec = typeof specOrCode === 'string' ? discoverAuthoredCurriculumSpecs().get(specOrCode) : specOrCode;
  if (!spec) throw new Error(`AUTHORING_SPEC_NOT_FOUND:${specOrCode}`);
  const source = getSourceRecords().get(spec.officialCode);
  if (!source || source.technicalVerificationStatus !== 'OFFICIAL_SOURCE_VERIFIED_EXACT') throw new Error(`OFFICIAL_SOURCE_NOT_VERIFIED:${spec.officialCode}`);
  if (spec.officialDescriptor !== source.descriptor) throw new Error(`OFFICIAL_DESCRIPTOR_MISMATCH:${spec.officialCode}`);
  if (spec.officialSource?.url !== source.officialSource?.url || spec.officialSource?.page !== source.officialSource?.page) throw new Error(`OFFICIAL_SOURCE_LOCATOR_MISMATCH:${spec.officialCode}`);

  let questionIndex = 0;
  const questions = PURPOSES.flatMap((purpose) => (spec.assessments?.[purpose] ?? []).map((row) => {
    if (!Array.isArray(row) || row.length !== 9) throw new Error(`INVALID_AUTHORED_ASSESSMENT_ROW:${spec.officialCode}:${purpose}`);
    const [difficulty, cognitiveProcess, contextFamily, statement, correctAnswer, distractors, errorFocus, explanation, hint] = row;
    const index = questionIndex++;
    const options = [...distractors];
    const answerIndex = index % POSITIONS.length;
    options.splice(answerIndex, 0, correctAnswer);
    return {
      id: `${spec.contentId}-${String(index + 1).padStart(2, '0')}`,
      statement,
      prompt: statement,
      options,
      correctAnswer,
      answerPosition: POSITIONS[answerIndex],
      misconceptions: Object.fromEntries(distractors.map((distractor) => [distractor, [errorFocus]])),
      purpose,
      difficulty,
      cognitiveProcess,
      contextFamily,
      explanation,
      hint,
      errorFocus,
      feedback: { correct: `Boa observação: ${explanation}`, incorrect: explanation, hint, errorFocus },
      accessibility: { textOnly: true, supports: spec.lesson.accessibilitySupports },
      authored: true,
    };
  }));
  const progression = PURPOSES.map((phase) => ({
    phase,
    questionIds: questions.filter((question) => question.purpose === phase).map((question) => question.id),
  }));
  const purposeCounts = Object.fromEntries(PURPOSES.map((purpose) => [purpose, questions.filter((question) => question.purpose === purpose).length]));
  const positionCounts = Object.fromEntries(POSITIONS.map((position) => [position, questions.filter((question) => question.answerPosition === position).length]));
  return {
    packVersion: 'tec-escola-core-v5-question-first',
    contentVersion: 1,
    lessonVersion: 1,
    contentId: spec.contentId,
    canonicalSkillCode: spec.canonicalSkillCode,
    subject: spec.subject,
    domain: spec.domain,
    topic: spec.topic,
    databasePackId: 'TECESCOLA_CORE_V5_QUESTION_FIRST',
    officialMappingStatus: 'NOT_CLAIMED',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    publicationStatus: 'STAGING_INACTIVE',
    active: false,
    contentAuthoringStatus: 'AUTHORED',
    expectedPurposeCounts: purposeCounts,
    expectedQuestionCount: questions.length,
    expectedContextCount: new Set(questions.map((question) => question.contextFamily)).size,
    expectedAnswerPositionCounts: positionCounts,
    sourceContext: {
      officialCode: spec.officialCode,
      relation: 'AUTHORING_CONTEXT_ONLY',
      mappingStatus: source.mappingStatus,
      sourceStatus: source.technicalVerificationStatus,
      descriptor: source.descriptor,
      officialSource: source.officialSource,
      note: 'Conteúdo autoral em staging; o vínculo canônico, a revisão pedagógica e a publicação continuam pendentes.',
    },
    sourceReconciliation: { sourceQuestionCount: 0, feedbackAdded: 0, sourceReconciliationStatus: 'NO_SOURCE_QUESTION_REUSED', newQuestions: questions.length, reusedQuestionsCountedAsNew: false },
    lesson: {
      ...spec.lesson,
      authenticActivities: buildAuthenticActivities(spec.lesson.authenticActivities, spec.contentId),
      progression,
      reviewWindowsDays: [1, 3, 7],
      reviewScheduleStatus: 'SUGGESTED_NOT_AUTOMATED',
      sourceDossier: [{ officialCode: spec.officialCode, descriptor: source.descriptor, officialSource: source.officialSource, checkedAt: source.evidenceCheckedAt, relation: 'AUTHORING_CONTEXT_ONLY' }],
      copyrightNote: 'Material autoral; o descritor BNCC é citado apenas como referência curricular e não como exercício reproduzido.',
    },
    questions,
  };
}

export function validateAuthoredCurriculumPack(pack, officialSourceRecord = getSourceRecords().get(pack?.sourceContext?.officialCode)) {
  const rubric = evaluateCurriculumPackageRubric(pack, {
    requirements: { questions: 40, activities: 2 },
    officialSourceRecord,
  });
  return {
    valid: rubric.status === 'AUTOMATED_SCREEN_PASS',
    errors: rubric.incomplete,
    rubric,
    questionCount: pack?.questions?.length ?? 0,
    purposeCounts: pack?.expectedPurposeCounts ?? {},
    answerPositionCounts: pack?.expectedAnswerPositionCounts ?? {},
  };
}

export function validateStoredCurriculumPack(pack) {
  const errors = [];
  const questions = pack?.questions ?? [];
  if (!pack?.sourceContext?.officialCode || pack?.sourceContext?.relation !== 'AUTHORING_CONTEXT_ONLY') errors.push('SOURCE_CONTEXT_INVALID');
  if (pack?.active !== false || pack?.publicationStatus !== 'STAGING_INACTIVE' || pack?.officialMappingStatus !== 'NOT_CLAIMED') errors.push('STAGING_GOVERNANCE_INVALID');
  if (!pack?.lesson?.objective || !pack?.lesson?.workedExample || !pack?.lesson?.explanation) errors.push('LESSON_CORE_MISSING');
  if (questions.length < 40) errors.push(`QUESTIONS_BELOW_TECHNICAL_MINIMUM:${questions.length}<40`);
  const ids = new Set();
  const contexts = new Set();
  for (const question of questions) {
    if (!question?.id || ids.has(question.id)) errors.push(`QUESTION_ID_INVALID:${question?.id ?? 'MISSING'}`);
    ids.add(question?.id);
    if (!question?.contextFamily || contexts.has(question.contextFamily)) errors.push(`QUESTION_CONTEXT_INVALID:${question?.contextFamily ?? 'MISSING'}`);
    contexts.add(question?.contextFamily);
    if (!Array.isArray(question?.options) || question.options.length !== 4 || question.options.filter((option) => option === question.correctAnswer).length !== 1) errors.push(`QUESTION_ANSWER_INVALID:${question?.id ?? 'MISSING'}`);
    if (!question?.statement || !question?.explanation || !question?.hint || !question?.errorFocus) errors.push(`QUESTION_FEEDBACK_INVALID:${question?.id ?? 'MISSING'}`);
  }
  return { valid: errors.length === 0, errors, questionCount: questions.length, contextCount: contexts.size };
}

export function writeAuthoredCurriculumPacks({ checkOnly = false, officialCodes = [] } = {}) {
  const specs = discoverAuthoredCurriculumSpecs();
  const selected = officialCodes.length ? officialCodes.map((code) => {
    const spec = specs.get(code);
    if (!spec) throw new Error(`AUTHORING_SPEC_NOT_FOUND:${code}`);
    return spec;
  }) : [...specs.values()];
  for (const spec of selected) {
    const pack = buildAuthoredCurriculumPack(spec);
    const validation = validateAuthoredCurriculumPack(pack);
    if (!validation.valid) throw new Error(`${spec.officialCode}_RUBRIC_FAILED:${validation.errors.join(',')}`);
    const outputPath = path.resolve(ROOT, spec.outputPath);
    if (!outputPath.startsWith(`${path.resolve(ROOT, 'content/adaptive/tec-escola-core-v5')}${path.sep}`)) throw new Error(`OUTPUT_PATH_OUTSIDE_STAGING:${spec.officialCode}`);
    const serialized = `${JSON.stringify(pack, null, 2)}\n`;
    if (checkOnly) {
      if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8') !== serialized) throw new Error(`${spec.officialCode}_AUTHORED_PACKAGE_STALE`);
    } else {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, serialized, 'utf8');
    }
    console.log(`${spec.officialCode} ${checkOnly ? 'VALID' : 'WRITTEN'} questions=${validation.questionCount} rubric=${validation.rubric.status} staging=inactive`);
  }
  return selected.map((spec) => spec.officialCode);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  writeAuthoredCurriculumPacks({ checkOnly: args.includes('--check'), officialCodes: args.filter((arg) => !arg.startsWith('--')) });
}
