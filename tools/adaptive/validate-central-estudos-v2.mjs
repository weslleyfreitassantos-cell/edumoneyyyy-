import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '../..');
const packageRoot = join(root, 'content/adaptive/central-estudos-v2');
const requiredSections = ['introduction', 'explanation', 'workedExample', 'guidedPractice', 'application', 'review', 'learningCheck'];
const validPurposes = new Set(['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW']);

export function calculateExpectedValue(calculation) {
  const { operation, base, percent } = calculation ?? {};
  if (!Number.isFinite(base) || !Number.isFinite(percent)) return null;
  const part = base * percent / 100;
  if (operation === 'PERCENT_OF') return part;
  if (operation === 'PRICE_AFTER_DISCOUNT') return base - part;
  if (operation === 'PRICE_AFTER_INCREASE') return base + part;
  return null;
}

export async function validateCandidate() {
  const [manifest, matrix, journeyRaw, officialCatalog] = await Promise.all([
    readFile(join(packageRoot, 'manifest.json'), 'utf8').then(JSON.parse),
    readFile(join(packageRoot, 'curriculum-matrix.json'), 'utf8').then(JSON.parse),
    readFile(join(packageRoot, 'journeys/ef06ma13-percentual.json'), 'utf8'),
    readFile(join(root, 'content/bncc/official/catalog-2018.json'), 'utf8').then(JSON.parse),
  ]);
  const journey = JSON.parse(journeyRaw);
  const contentSha256 = createHash('sha256').update(journeyRaw).digest('hex');
  const issues = [];
  const mapping = matrix.find((row) => row.journeyCode === journey.journeyCode);
  const officialNode = officialCatalog.nodes.find((node) => node.code === journey.officialSkillCode);
  if (!mapping) issues.push('MISSING_CURRICULUM_MATRIX_ROW');
  if (!officialNode) issues.push('OFFICIAL_CODE_NOT_FOUND_IN_CATALOG');
  if (officialNode && (officialNode.stage !== 'ENSINO_FUNDAMENTAL' || officialNode.gradeOrRange !== '06')) issues.push('OFFICIAL_CODE_SCOPE_MISMATCH');
  if (officialNode && !officialNode.officialTextExcerpt.includes('Resolver e elaborar problemas que envolvam porcentagens')) issues.push('OFFICIAL_TEXT_DOES_NOT_MATCH_PERCENTAGE_SKILL');
  if (manifest.humanPedagogicalReview !== 'PENDING' || journey.pedagogicalReviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') issues.push('HUMAN_REVIEW_MUST_REMAIN_PENDING');
  if (manifest.publicationStatus !== 'NOT_PUBLISHED' || journey.publicationStatus !== 'STAGING') issues.push('CANDIDATE_MUST_REMAIN_UNPUBLISHED');
  if (journey.grade !== 6 || journey.stage !== 'ENSINO_FUNDAMENTAL') issues.push('GRADE_SCOPE_MISMATCH');
  for (const section of requiredSections) {
    if (journey.lesson?.[section] === undefined || journey.lesson?.[section] === null) issues.push(`LESSON_SECTION_MISSING:${section}`);
  }
  for (const section of ['guidedPractice', 'application', 'review']) {
    if (!Array.isArray(journey.lesson?.[section]) || journey.lesson[section].length === 0) issues.push(`LESSON_SECTION_EMPTY:${section}`);
  }

  const ids = new Set();
  const normalizedStatements = new Set();
  const seenPurposes = new Set();
  for (const question of journey.questions ?? []) {
    if (ids.has(question.id)) issues.push(`DUPLICATE_QUESTION_ID:${question.id}`);
    ids.add(question.id);
    const normalized = question.statement.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();
    if (normalizedStatements.has(normalized)) issues.push(`DUPLICATE_QUESTION_STEM:${question.id}`);
    normalizedStatements.add(normalized);
    if (!validPurposes.has(question.purpose)) issues.push(`INVALID_PURPOSE:${question.id}`);
    seenPurposes.add(question.purpose);
    if (question.interactionType !== 'SINGLE_CHOICE') issues.push(`UNSUPPORTED_RUNTIME_INTERACTION:${question.id}`);
    if (!Array.isArray(question.options) || question.options.length < 2) issues.push(`INVALID_OPTIONS:${question.id}`);
    if (!question.options?.includes(question.correctAnswer)) issues.push(`ANSWER_NOT_IN_OPTIONS:${question.id}`);
    if (typeof question.explanation !== 'string' || !question.explanation.trim()) issues.push(`MISSING_EXPLANATION:${question.id}`);
    const calculated = calculateExpectedValue(question.calculation);
    if (calculated === null || Math.abs(calculated - question.calculation.expectedNumeric) > 1e-9) issues.push(`CALCULATION_MISMATCH:${question.id}`);
    const selectedNumericToken = String(question.correctAnswer).match(/^\s*(?:R\$\s*)?(-?\d+(?:[.,]\d+)?)/)?.[1];
    const selectedNumeric = selectedNumericToken === undefined ? Number.NaN : Number(selectedNumericToken.replace(',', '.'));
    if (Number.isFinite(selectedNumeric) && calculated !== null && Math.abs(selectedNumeric - calculated) > 1e-9) issues.push(`ANSWER_VALUE_MISMATCH:${question.id}`);
    if (question.officialSkillCode && question.officialSkillCode !== journey.officialSkillCode) issues.push(`QUESTION_MAPPING_MISMATCH:${question.id}`);
  }
  for (const purpose of validPurposes) if (!seenPurposes.has(purpose)) issues.push(`PURPOSE_NOT_COVERED:${purpose}`);
  const checkIds = journey.lesson.learningCheck?.questionIds ?? [];
  if (checkIds.length !== 5 || checkIds.some((id) => !ids.has(id))) issues.push('LEARNING_CHECK_QUESTION_SET_INVALID');

  return {
    candidate: journey.journeyCode,
    contentVersion: journey.version,
    contentSha256,
    journeyCount: 1,
    grade: journey.grade,
    officialCode: journey.officialSkillCode,
    questionCount: journey.questions?.length ?? 0,
    exerciseTypes: [...new Set((journey.questions ?? []).map((question) => question.interactionType))],
    lessonSections: requiredSections,
    officialSourceExtraction: officialCatalog.extractionStatus,
    mappingStatus: 'CANDIDATE_REQUIRES_HUMAN_CONFIRMATION',
    pedagogicalReview: 'PENDING_HUMAN_REVIEW',
    publication: 'NOT_PUBLISHED',
    issues,
    technicalValidation: issues.length === 0 ? 'PASS' : 'FAIL',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await validateCandidate();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (process.argv.includes('--write')) {
    const docket = {
      docketVersion: 'central-estudos-v2-review-docket-v1',
      candidate: report.candidate,
      contentVersion: report.contentVersion,
      sourcePath: 'content/adaptive/central-estudos-v2/journeys/ef06ma13-percentual.json',
      contentSha256: report.contentSha256,
      technicalValidation: report.technicalValidation,
      humanReview: {
        status: 'PEDAGOGICAL_REVIEW_PENDING',
        reviewer: null,
        reviewedAt: null,
        notes: null,
        criteria: {
          officialAlignment: 'PENDING',
          mathematicalAccuracy: 'PENDING',
          ageAndGradeSuitability: 'PENDING',
          clarityAndAccessibility: 'PENDING',
          answerQuality: 'PENDING',
          culturalAndContextualSuitability: 'PENDING',
        },
      },
      publication: {
        status: 'NOT_PUBLISHED',
        history: [],
      },
      validationIssues: report.issues,
    };
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(packageRoot, 'review-docket.json'), `${JSON.stringify(docket, null, 2)}\n`, 'utf8');
  }
  if (report.technicalValidation !== 'PASS') process.exitCode = 1;
}
