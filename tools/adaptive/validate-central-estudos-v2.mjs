import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '../..');
const packageRoot = join(root, 'content/adaptive/central-estudos-v2');
const requiredSections = ['introduction', 'explanation', 'workedExample', 'guidedPractice', 'application', 'review', 'learningCheck'];
const validPurposes = new Set(['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW']);
const expectedSubjects = new Set(['MATHEMATICS', 'PORTUGUESE', 'SCIENCE']);
const reviewCriteria = {
  officialAlignment: 'PENDING',
  pedagogicalAccuracy: 'PENDING',
  ageAndGradeSuitability: 'PENDING',
  clarityAndAccessibility: 'PENDING',
  answerQuality: 'PENDING',
  culturalAndContextualSuitability: 'PENDING',
};

const normalizeText = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export function calculateExpectedValue(calculation) {
  const { operation, base, percent } = calculation ?? {};
  if (!Number.isFinite(base) || !Number.isFinite(percent)) return null;
  const part = base * percent / 100;
  if (operation === 'PERCENT_OF') return part;
  if (operation === 'PRICE_AFTER_DISCOUNT') return base - part;
  if (operation === 'PRICE_AFTER_INCREASE') return base + part;
  return null;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function validateJourney(journey, fileName, mapping, officialCatalog, manifest) {
  const issues = [];
  const label = `${fileName}:`;
  const officialNode = officialCatalog.nodes.find((node) => node.code === journey.officialSkillCode);
  const expectedOfficialText = journey.officialText ?? mapping?.officialText;

  if (!journey.journeyCode) issues.push(`${label}JOURNEY_CODE_MISSING`);
  if (!mapping) issues.push(`${label}MISSING_CURRICULUM_MATRIX_ROW`);
  if (officialCatalog.extractionStatus !== 'AUTOMATED_TEXT_EXTRACTION_REVIEW_REQUIRED') issues.push(`${label}UNEXPECTED_CATALOG_EXTRACTION_STATE`);
  if (!officialNode) issues.push(`${label}OFFICIAL_CODE_NOT_FOUND_IN_CATALOG`);
  if (officialNode && (officialNode.stage !== 'ENSINO_FUNDAMENTAL' || officialNode.gradeOrRange !== '06')) issues.push(`${label}OFFICIAL_CODE_SCOPE_MISMATCH`);
  if (officialNode && expectedOfficialText && !normalizeText(officialNode.officialTextExcerpt).includes(normalizeText(expectedOfficialText))) issues.push(`${label}OFFICIAL_TEXT_DOES_NOT_MATCH_CATALOG`);
  if (!expectedOfficialText?.trim()) issues.push(`${label}OFFICIAL_TEXT_MISSING`);
  if (mapping && (mapping.journeyCode !== journey.journeyCode || mapping.officialSkillCode !== journey.officialSkillCode || mapping.subject !== journey.subject || mapping.grade !== journey.grade)) issues.push(`${label}CURRICULUM_MATRIX_MISMATCH`);
  if (mapping && mapping.pedagogicalReviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') issues.push(`${label}MATRIX_REVIEW_MUST_REMAIN_PENDING`);
  if (mapping && mapping.publicationStatus !== 'STAGING') issues.push(`${label}MATRIX_PUBLICATION_MUST_REMAIN_STAGING`);
  if (manifest.humanPedagogicalReview !== 'PENDING' || journey.pedagogicalReviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') issues.push(`${label}HUMAN_REVIEW_MUST_REMAIN_PENDING`);
  if (manifest.publicationStatus !== 'NOT_PUBLISHED' || journey.publicationStatus !== 'STAGING') issues.push(`${label}CANDIDATE_MUST_REMAIN_UNPUBLISHED`);
  if (journey.version !== manifest.packVersion) issues.push(`${label}CONTENT_VERSION_MISMATCH`);
  if (journey.grade !== 6 || journey.stage !== 'ENSINO_FUNDAMENTAL') issues.push(`${label}GRADE_SCOPE_MISMATCH`);
  if (!expectedSubjects.has(journey.subject)) issues.push(`${label}UNEXPECTED_SUBJECT`);
  if (!journey.unitCode?.trim() || !journey.unitTitle?.trim()) issues.push(`${label}UNIT_METADATA_MISSING`);

  for (const section of requiredSections) {
    if (journey.lesson?.[section] === undefined || journey.lesson?.[section] === null) issues.push(`${label}LESSON_SECTION_MISSING:${section}`);
  }
  for (const section of ['guidedPractice', 'application', 'review']) {
    if (!Array.isArray(journey.lesson?.[section]) || journey.lesson[section].length === 0) issues.push(`${label}LESSON_SECTION_EMPTY:${section}`);
  }
  if (!journey.lesson?.title?.trim() || !Number.isFinite(journey.lesson?.estimatedMinutes)) issues.push(`${label}LESSON_METADATA_INVALID`);

  const questions = Array.isArray(journey.questions) ? journey.questions : [];
  if (questions.length < 5 || questions.length > 8) issues.push(`${label}QUESTION_COUNT_OUT_OF_RANGE`);
  const ids = new Set();
  const statements = new Set();
  const seenPurposes = new Set();
  for (const question of questions) {
    if (!question?.id || ids.has(question.id)) issues.push(`${label}DUPLICATE_OR_MISSING_QUESTION_ID:${question?.id ?? 'unknown'}`);
    if (question?.id) ids.add(question.id);
    const normalizedStatement = normalizeText(question?.statement);
    if (!normalizedStatement || statements.has(normalizedStatement)) issues.push(`${label}DUPLICATE_OR_MISSING_QUESTION_STEM:${question?.id ?? 'unknown'}`);
    statements.add(normalizedStatement);
    if (!validPurposes.has(question?.purpose)) issues.push(`${label}INVALID_PURPOSE:${question?.id ?? 'unknown'}`);
    seenPurposes.add(question?.purpose);
    if (question?.interactionType !== 'SINGLE_CHOICE') issues.push(`${label}UNSUPPORTED_RUNTIME_INTERACTION:${question?.id ?? 'unknown'}`);
    if (!['EASY', 'MEDIUM', 'HARD'].includes(question?.difficulty)) issues.push(`${label}INVALID_DIFFICULTY:${question?.id ?? 'unknown'}`);
    if (!Array.isArray(question?.options) || question.options.length < 2 || question.options.some((option) => typeof option !== 'string' || !option.trim())) issues.push(`${label}INVALID_OPTIONS:${question?.id ?? 'unknown'}`);
    if (!question?.options?.includes(question?.correctAnswer)) issues.push(`${label}ANSWER_NOT_IN_OPTIONS:${question?.id ?? 'unknown'}`);
    if (typeof question?.explanation !== 'string' || !question.explanation.trim()) issues.push(`${label}MISSING_EXPLANATION:${question?.id ?? 'unknown'}`);
    if (typeof question?.misconception !== 'string' || !question.misconception.trim()) issues.push(`${label}MISSING_MISCONCEPTION:${question?.id ?? 'unknown'}`);
    if (question?.officialSkillCode && question.officialSkillCode !== journey.officialSkillCode) issues.push(`${label}QUESTION_MAPPING_MISMATCH:${question.id}`);
    if (question?.calculation) {
      const calculated = calculateExpectedValue(question.calculation);
      if (calculated === null || Math.abs(calculated - question.calculation.expectedNumeric) > 1e-9) issues.push(`${label}CALCULATION_MISMATCH:${question.id}`);
      const selectedNumericToken = String(question.correctAnswer).match(/^\s*(?:R\$\s*)?(-?\d+(?:[.,]\d+)?)/)?.[1];
      const selectedNumeric = selectedNumericToken === undefined ? Number.NaN : Number(selectedNumericToken.replace(',', '.'));
      if (Number.isFinite(selectedNumeric) && calculated !== null && Math.abs(selectedNumeric - calculated) > 1e-9) issues.push(`${label}ANSWER_VALUE_MISMATCH:${question.id}`);
    }
  }
  for (const purpose of validPurposes) if (!seenPurposes.has(purpose)) issues.push(`${label}PURPOSE_NOT_COVERED:${purpose}`);
  const checkIds = journey.lesson?.learningCheck?.questionIds ?? [];
  if (checkIds.length !== 5 || checkIds.some((id) => !ids.has(id))) issues.push(`${label}LEARNING_CHECK_QUESTION_SET_INVALID`);

  return issues;
}

export async function validatePackage(rootOverride = root) {
  const packageDir = join(rootOverride, 'content/adaptive/central-estudos-v2');
  const [manifest, matrix, officialCatalog, fileNames] = await Promise.all([
    readJson(join(packageDir, 'manifest.json')),
    readJson(join(packageDir, 'curriculum-matrix.json')),
    readJson(join(rootOverride, 'content/bncc/official/catalog-2018.json')),
    readdir(join(packageDir, 'journeys')),
  ]);
  const journeyFiles = fileNames.filter((name) => name.endsWith('.json')).sort();
  const journeys = await Promise.all(journeyFiles.map(async (fileName) => ({
    fileName,
    raw: await readFile(join(packageDir, 'journeys', fileName), 'utf8'),
    journey: await readJson(join(packageDir, 'journeys', fileName)),
  })));
  const issues = [];
  const journeyCodes = new Set();
  const officialCodes = new Set();
  const matrixByJourney = new Map();
  for (const entry of matrix) {
    if (matrixByJourney.has(entry.journeyCode)) issues.push(`DUPLICATE_MATRIX_JOURNEY:${entry.journeyCode}`);
    matrixByJourney.set(entry.journeyCode, entry);
  }

  const allJourneyIssues = [];
  const subjectCounts = {};
  let questionCount = 0;
  const purposes = new Set();
  const exerciseTypes = new Set();
  const candidateReports = [];
  for (const { fileName, raw, journey } of journeys) {
    if (journeyCodes.has(journey.journeyCode)) issues.push(`DUPLICATE_JOURNEY_CODE:${journey.journeyCode}`);
    journeyCodes.add(journey.journeyCode);
    if (officialCodes.has(journey.officialSkillCode)) issues.push(`DUPLICATE_OFFICIAL_SKILL:${journey.officialSkillCode}`);
    officialCodes.add(journey.officialSkillCode);
    subjectCounts[journey.subject] = (subjectCounts[journey.subject] ?? 0) + 1;
    questionCount += journey.questions?.length ?? 0;
    for (const question of journey.questions ?? []) {
      purposes.add(question.purpose);
      exerciseTypes.add(question.interactionType);
    }
    const entryIssues = validateJourney(journey, fileName, matrixByJourney.get(journey.journeyCode), officialCatalog, manifest);
    allJourneyIssues.push(...entryIssues);
    candidateReports.push({
      journeyCode: journey.journeyCode,
      title: journey.journeyTitle,
      file: `content/adaptive/central-estudos-v2/journeys/${fileName}`,
      subject: journey.subject,
      grade: journey.grade,
      officialSkillCode: journey.officialSkillCode,
      contentVersion: journey.version,
      contentSha256: createHash('sha256').update(raw).digest('hex'),
      questionCount: journey.questions?.length ?? 0,
      exerciseTypes: [...new Set((journey.questions ?? []).map((question) => question.interactionType))],
      reviewStatus: journey.pedagogicalReviewStatus,
      publicationStatus: journey.publicationStatus,
      issues: entryIssues,
    });
  }
  issues.push(...allJourneyIssues);
  for (const subject of expectedSubjects) {
    if ((subjectCounts[subject] ?? 0) < 3) issues.push(`SUBJECT_LESSON_COUNT_BELOW_TARGET:${subject}`);
  }
  for (const subject of Object.keys(subjectCounts)) if (!expectedSubjects.has(subject)) issues.push(`UNEXPECTED_PACKAGE_SUBJECT:${subject}`);
  for (const entry of matrix) if (!journeyCodes.has(entry.journeyCode)) issues.push(`ORPHAN_MATRIX_ENTRY:${entry.journeyCode}`);
  if (manifest.subjects?.length !== expectedSubjects.size || expectedSubjects.size !== new Set(manifest.subjects ?? []).size || [...expectedSubjects].some((subject) => !manifest.subjects.includes(subject))) issues.push('MANIFEST_SUBJECTS_MISMATCH');
  if (manifest.gradeScopes?.length !== 1 || manifest.gradeScopes[0]?.stage !== 'ENSINO_FUNDAMENTAL' || manifest.gradeScopes[0]?.grade !== 6) issues.push('MANIFEST_GRADE_SCOPE_MISMATCH');
  if (manifest.candidateCount !== undefined && manifest.candidateCount !== journeys.length) issues.push('MANIFEST_CANDIDATE_COUNT_MISMATCH');

  const docket = await readJson(join(packageDir, 'review-docket.json')).catch(() => null);
  const docketItems = Array.isArray(docket?.items) ? docket.items : [];
  const docketMap = new Map(docketItems.map((item) => [`${item.candidate}:${item.contentVersion}`, item]));
  if (docket && docketItems.length !== journeys.length) issues.push('REVIEW_DOCKET_COUNT_MISMATCH');
  for (const candidate of candidateReports) {
    const item = docketMap.get(`${candidate.journeyCode}:${candidate.contentVersion}`);
    if (docket && !item) issues.push(`REVIEW_DOCKET_ENTRY_MISSING:${candidate.journeyCode}`);
    if (item && item.contentSha256 !== candidate.contentSha256) issues.push(`REVIEW_DOCKET_FINGERPRINT_MISMATCH:${candidate.journeyCode}`);
    if (item && (item.humanReview?.status !== 'PEDAGOGICAL_REVIEW_PENDING' || item.publication?.status !== 'NOT_PUBLISHED')) issues.push(`REVIEW_DOCKET_STATE_INVALID:${candidate.journeyCode}`);
  }

  return {
    packageVersion: manifest.packVersion,
    journeyCount: journeys.length,
    lessonCount: journeys.length,
    questionCount,
    subjects: subjectCounts,
    officialCatalogExtraction: officialCatalog.extractionStatus,
    mappingStatus: 'CANDIDATE_REQUIRES_HUMAN_CONFIRMATION',
    pedagogicalReview: 'PENDING_HUMAN_REVIEW',
    publication: 'NOT_PUBLISHED',
    exerciseTypes: [...exerciseTypes].sort(),
    purposesCovered: [...purposes].sort(),
    candidates: candidateReports,
    issues,
    technicalValidation: issues.length === 0 ? 'PASS' : 'FAIL',
  };
}

async function writeReviewDocket(report, packageDir) {
  const oldDocket = await readJson(join(packageDir, 'review-docket.json')).catch(() => ({}));
  const previous = new Map((oldDocket.items ?? []).map((item) => [`${item.candidate}:${item.contentVersion}`, item]));
  const items = [];
  for (const candidate of report.candidates) {
    const old = previous.get(`${candidate.journeyCode}:${candidate.contentVersion}`);
    const preservedReview = old?.contentSha256 === candidate.contentSha256 ? old.humanReview : null;
    const preservedPublication = old?.contentSha256 === candidate.contentSha256 ? old.publication : null;
    items.push({
      candidate: candidate.journeyCode,
      title: candidate.title,
      subject: candidate.subject,
      grade: candidate.grade,
      officialCode: candidate.officialSkillCode,
      contentVersion: candidate.contentVersion,
      sourcePath: candidate.file,
      contentSha256: candidate.contentSha256,
      technicalValidation: candidate.issues.length === 0 ? 'PASS' : 'FAIL',
      humanReview: preservedReview ?? {
        status: 'PEDAGOGICAL_REVIEW_PENDING', reviewer: null, reviewedAt: null, notes: null,
        criteria: reviewCriteria,
      },
      publication: preservedPublication ?? { status: 'NOT_PUBLISHED', history: [] },
      validationIssues: candidate.issues,
    });
  }
  await writeFile(join(packageDir, 'review-docket.json'), `${JSON.stringify({ docketVersion: 'central-estudos-v2-review-docket-v2', items }, null, 2)}\n`, 'utf8');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let report = await validatePackage();
  if (process.argv.includes('--write')) {
    await writeReviewDocket(report, packageRoot);
    report = await validatePackage();
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.technicalValidation !== 'PASS') process.exitCode = 1;
}
