import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PURPOSES = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];
const JOURNEY_FILES = [
  'journey-expansion-a-v1.json',
  'journey-expansion-b-v1.json',
  'journey-expansion-c-v1.json',
  'journey-expansion-d-v1.json',
];
const LESSON_FILES = ['lesson-expansion-v1.json', 'lesson-expansion-v2.json'];
const QUESTION_FILES = ['question-expansion-v1.json', 'question-expansion-v2.json', 'question-expansion-v3.json'];
const BATCH_PATH = 'content/adaptive/tec-escola-core-v9/knowledge-gap-batch-v1.json';
const SNAPSHOT_PATH = 'content/bncc/authoring/production-baseline-2026-10-12.json';
const OUTPUT_PATH = 'content/bncc/authoring/knowledge-factory-inventory-v1.json';

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function hashSourceContent(value) {
  const text = Buffer.isBuffer(value) ? value.toString('utf8') : String(value);
  return hash(text.replace(/\r\n/g, '\n'));
}

function normalizedText(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();
}

function questionRows(journey) {
  return journey.questionRows ?? journey.questions ?? [];
}

const COMPACT_PURPOSE_BY_POSITION = [
  'PROBE', 'PROBE',
  ...Array(8).fill('PRACTICE'),
  ...Array(4).fill('TRANSFER'),
  ...Array(3).fill('LOCK_IN'),
  ...Array(3).fill('REVIEW'),
];

function addQuestions(target, questions, purposeOf) {
  questions.forEach((question, index) => {
    const questionKey = typeof question?.id === 'string'
      ? question.id
      : normalizedText(Array.isArray(question) ? question[3] : question?.statement);
    target.questionKeys ??= new Set();
    if (!questionKey || target.questionKeys.has(questionKey)) return;
    target.questionKeys.add(questionKey);
    target.questionCount += 1;
    const purpose = purposeOf(question, index);
    if (PURPOSES.includes(purpose)) target.purposeCounts[purpose] += 1;
  });
}

function collectSourcePaths(root) {
  const packRoot = path.join(root, 'content/adaptive/tec-escola-core-v4');
  const registry = readJson(root, 'content/adaptive/tec-escola-core-v4/registry.json');
  const paths = [
    'content/bncc/official/catalog-2018.json',
    'content/bncc/mappings/coverage-2018.json',
    'content/bncc/canonical/graph-v4.json',
    'content/bncc/canonical/relationships-v4.json',
    'content/bncc/canonical/clusters-v8.json',
    'content/bncc/mappings/proposals-v8.json',
    'content/bncc/curriculum/units-v5.json',
    'content/bncc/packages/tec-escola-core-v4.json',
    'content/bncc/progress.json',
    'content/bncc/authoring/production-baseline-2026-10-12.json',
    'content/adaptive/tec-escola-core-v4/manifest.json',
    'content/adaptive/tec-escola-core-v4/registry.json',
    'content/adaptive/tec-escola-core-v4/relationships.json',
    ...JOURNEY_FILES.map((file) => `content/adaptive/tec-escola-core-v9/${file}`),
    ...LESSON_FILES.map((file) => `content/adaptive/tec-escola-core-v9/${file}`),
    ...QUESTION_FILES.map((file) => `content/adaptive/tec-escola-core-v9/${file}`),
    BATCH_PATH,
    SNAPSHOT_PATH,
  ];
  for (const subject of registry.subjects) {
    const dir = path.relative(root, path.join(packRoot, 'subjects', subject.code.toLowerCase())).split(path.sep).join('/');
    paths.push(`${dir}/skills.json`, `${dir}/lessons.json`, `${dir}/questions.json`);
  }
  return [...new Set(paths)].sort();
}

export function loadKnowledgeFactoryInputs(root = ROOT) {
  const catalog = readJson(root, 'content/bncc/official/catalog-2018.json');
  const coverage = readJson(root, 'content/bncc/mappings/coverage-2018.json');
  const graph = readJson(root, 'content/bncc/canonical/graph-v4.json');
  const relationships = readJson(root, 'content/adaptive/tec-escola-core-v4/relationships.json');
  const canonicalRelationships = readJson(root, 'content/bncc/canonical/relationships-v4.json');
  const clusters = readJson(root, 'content/bncc/canonical/clusters-v8.json');
  const proposals = readJson(root, 'content/bncc/mappings/proposals-v8.json');
  const v4Units = readJson(root, 'content/bncc/curriculum/units-v5.json');
  const v4ContentPackage = readJson(root, 'content/bncc/packages/tec-escola-core-v4.json');
  const historicalProgress = readJson(root, 'content/bncc/progress.json');
  const registry = readJson(root, 'content/adaptive/tec-escola-core-v4/registry.json');
  const lessons = LESSON_FILES.flatMap((file) => readJson(root, `content/adaptive/tec-escola-core-v9/${file}`).lessons ?? []);
  const questions = QUESTION_FILES.flatMap((file) => readJson(root, `content/adaptive/tec-escola-core-v9/${file}`).questions ?? []);
  const journeys = JOURNEY_FILES.flatMap((file) => readJson(root, `content/adaptive/tec-escola-core-v9/${file}`).journeys ?? []);
  const v4Skills = [];
  const v4Lessons = [];
  const v4Questions = [];

  for (const subject of registry.subjects) {
    const dir = `content/adaptive/tec-escola-core-v4/subjects/${subject.code.toLowerCase()}`;
    const skillPack = readJson(root, `${dir}/skills.json`);
    v4Skills.push(...skillPack.leaves.map((skill) => ({ ...skill, subjectCode: subject.code, subjectName: subject.name })));
    v4Lessons.push(...readJson(root, `${dir}/lessons.json`));
    v4Questions.push(...readJson(root, `${dir}/questions.json`));
  }

  const paths = collectSourcePaths(root);
  const sourceHashes = Object.fromEntries(paths.map((relativePath) => [relativePath, hashSourceContent(fs.readFileSync(path.join(root, relativePath)))]));
  return {
    catalog,
    coverage,
    graph,
    relationships,
    canonicalRelationships,
    clusters,
    proposals,
    v4Units,
    v4ContentPackage,
    historicalProgress,
    registry,
    v4Skills,
    v4Lessons,
    v4Questions,
    v9Lessons: lessons,
    v9Questions: questions,
    v9Journeys: journeys,
    batch: readJson(root, BATCH_PATH),
    productionBaseline: readJson(root, SNAPSHOT_PATH),
    sourceHashes,
  };
}

export function validateKnowledgeBatch(batch, inputs) {
  const errors = [];
  const skillsByCode = new Map(inputs.v4Skills.map((skill) => [skill.code, skill]));
  const batchCodes = new Set();
  const questionIds = new Set();
  const allowedPurposes = new Set(PURPOSES);
  const allowedDifficulty = new Set(['EASY', 'MEDIUM', 'HARD']);
  const allowedProcesses = new Set(['IDENTIFY', 'RECOGNIZE', 'APPLY', 'COMPARE', 'INTERPRET', 'ANALYZE', 'EVALUATE', 'EXPLAIN', 'INFER', 'ARGUE']);

  if (batch.schemaVersion !== 'tec-escola.bncc.knowledge-gap-batch.v1') errors.push('BATCH_SCHEMA_VERSION_INVALID');
  if (batch.publicationStatus !== 'STAGING') errors.push('BATCH_MUST_REMAIN_STAGING');
  if (batch.mappingStatus !== 'MAPPING_PENDING') errors.push('BATCH_MAPPING_MUST_REMAIN_PENDING');
  if (batch.pedagogicalReviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') errors.push('BATCH_PEDAGOGICAL_REVIEW_MUST_REMAIN_PENDING');
  if (batch.bnccAlignment !== 'NOT_CLAIMED') errors.push('BATCH_MUST_NOT_CLAIM_BNCC_ALIGNMENT');
  if (!Array.isArray(batch.skills) || batch.skills.length === 0) errors.push('BATCH_HAS_NO_SKILLS');

  for (const item of batch.skills ?? []) {
    if (batchCodes.has(item.skillCode)) errors.push(`DUPLICATE_BATCH_SKILL:${item.skillCode}`);
    batchCodes.add(item.skillCode);
    const sourceSkill = skillsByCode.get(item.skillCode);
    if (!sourceSkill) {
      errors.push(`UNKNOWN_CANONICAL_SKILL:${item.skillCode}`);
      continue;
    }
    if (item.subjectCode !== sourceSkill.subjectCode || item.stage !== sourceSkill.recommendedStage
      || item.gradeFrom !== sourceSkill.recommendedGradeFrom || item.gradeTo !== sourceSkill.recommendedGradeTo) {
      errors.push(`CURRICULUM_SCOPE_MISMATCH:${item.skillCode}`);
    }
    if (item.officialCodes?.length) errors.push(`UNVERIFIED_OFFICIAL_CODES:${item.skillCode}`);
    if (item.mappingStatus !== 'MAPPING_PENDING' || item.pedagogicalReviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') {
      errors.push(`SKILL_REVIEW_GATE_CHANGED:${item.skillCode}`);
    }
    if (!item.lesson || item.lesson.skillCode !== item.skillCode) errors.push(`LESSON_SKILL_MISMATCH:${item.skillCode}`);
    const lesson = item.lesson ?? {};
    if ((lesson.priorKnowledge?.length ?? 0) < 2 || (lesson.keyConcepts?.length ?? 0) < 3
      || (lesson.progressiveExplanation?.length ?? 0) < 3 || (lesson.commonErrors?.length ?? 0) < 3
      || (lesson.remediations?.length ?? 0) !== 2 || String(lesson.workedExample ?? '').length < 240
      || !lesson.everydayApplication?.trim() || !lesson.practiceGuidance?.trim() || !lesson.summary?.trim()) {
      errors.push(`LESSON_STRUCTURE_INCOMPLETE:${item.skillCode}`);
    }
    if (new Set((lesson.remediations ?? []).map((entry) => entry.id)).size !== (lesson.remediations ?? []).length
      || (lesson.remediations ?? []).some((entry) => !entry.explanation?.trim() || !entry.workedExample?.trim() || !entry.selfCheck?.trim())) {
      errors.push(`LESSON_REMEDIATION_INCOMPLETE:${item.skillCode}`);
    }

    const localQuestions = item.questions ?? [];
    const purposes = Object.fromEntries(PURPOSES.map((purpose) => [purpose, 0]));
    const contexts = new Set();
    const stems = new Set();
    const answerPositions = [0, 0, 0, 0];
    for (const question of localQuestions) {
      if (questionIds.has(question.id)) errors.push(`DUPLICATE_QUESTION_ID:${question.id}`);
      questionIds.add(question.id);
      if (question.skillCode !== item.skillCode) errors.push(`QUESTION_SKILL_MISMATCH:${question.id}`);
      if (!allowedPurposes.has(question.purpose)) errors.push(`QUESTION_PURPOSE_INVALID:${question.id}`);
      else purposes[question.purpose] += 1;
      if (!allowedDifficulty.has(question.difficulty) || !allowedProcesses.has(question.cognitiveProcess)) {
        errors.push(`QUESTION_CLASSIFICATION_INVALID:${question.id}`);
      }
      if (!question.contextFamily?.trim()) errors.push(`QUESTION_CONTEXT_MISSING:${question.id}`);
      else contexts.add(question.contextFamily);
      const stem = normalizedText(question.statement);
      if (!stem || stems.has(stem)) errors.push(`DUPLICATE_OR_EMPTY_QUESTION_STEM:${question.id}`);
      stems.add(stem);
      if (!Array.isArray(question.options) || question.options.length !== 4
        || new Set(question.options.map(normalizedText)).size !== 4
        || !question.options.includes(question.correctAnswer)) errors.push(`QUESTION_OPTIONS_INVALID:${question.id}`);
      else answerPositions[question.options.indexOf(question.correctAnswer)] += 1;
      if (!question.explanation?.trim() || !question.errorFocus?.trim() || !question.remediationHint?.trim()) {
        errors.push(`QUESTION_FEEDBACK_INCOMPLETE:${question.id}`);
      }
    }
    if (localQuestions.length !== 12) errors.push(`QUESTION_COUNT_MUST_BE_12:${item.skillCode}:${localQuestions.length}`);
    for (const purpose of PURPOSES) {
      const minimum = purpose === 'PRACTICE' ? 4 : 2;
      if (purposes[purpose] < minimum) errors.push(`PURPOSE_COVERAGE:${item.skillCode}:${purpose}:${purposes[purpose]}`);
    }
    if (contexts.size < 8) errors.push(`CONTEXT_DIVERSITY:${item.skillCode}:${contexts.size}`);
    if (Math.max(...answerPositions) > 4) errors.push(`ANSWER_POSITION_BIAS:${item.skillCode}:${answerPositions.join(',')}`);
  }

  if (batchCodes.size < 2) errors.push('BATCH_MUST_CROSS_SUBJECTS');
  if (new Set((batch.skills ?? []).map((item) => item.stage)).size < 2) errors.push('BATCH_MUST_CROSS_STAGES');
  return errors;
}

function countBy(items, selector) {
  return items.reduce((counts, item) => {
    const key = selector(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function buildSkillInventory(inputs) {
  const lessonCodes = new Set([...inputs.v4Lessons, ...inputs.v9Lessons].map((lesson) => lesson.skill ?? lesson.skillCode));
  const lessonsBySkill = new Map([...inputs.v4Lessons, ...inputs.v9Lessons].map((lesson) => [lesson.skill ?? lesson.skillCode, lesson]));
  const packageSkillStatus = new Map(inputs.v4ContentPackage.packages.flatMap((pack) => pack.skills.map((skill) => [skill.code, skill])));
  const questionsBySkill = new Map();
  const put = (skillCode, questionList, purposeSelector) => {
    if (!skillCode) return;
    const aggregate = questionsBySkill.get(skillCode) ?? { questionCount: 0, purposeCounts: Object.fromEntries(PURPOSES.map((purpose) => [purpose, 0])) };
    addQuestions(aggregate, questionList, purposeSelector);
    questionsBySkill.set(skillCode, aggregate);
  };
  for (const question of inputs.v4Questions) put(question.primarySkill, [question], (item) => item.purpose);
  for (const question of inputs.v9Questions) put(question.skill, [question], (item) => item.purpose);
  for (const journey of inputs.v9Journeys) {
    const list = questionRows(journey);
    put(journey.skill, list, (question, index) => Array.isArray(question)
      ? COMPACT_PURPOSE_BY_POSITION[index]
      : question.purpose);
    if (journey.skill) lessonCodes.add(journey.skill);
  }

  const unlockCounts = new Map();
  const prerequisitesBySkill = new Map();
  const knownSkillCodes = new Set(inputs.v4Skills.map((skill) => skill.code));
  for (const relationship of inputs.relationships.relationships ?? []) {
    if (relationship.type !== 'PREREQUISITE') continue;
    unlockCounts.set(relationship.to, (unlockCounts.get(relationship.to) ?? 0) + 1);
    prerequisitesBySkill.set(relationship.from, [...(prerequisitesBySkill.get(relationship.from) ?? []), relationship]);
  }
  const officialCodesBySkill = new Map();
  for (const mapping of inputs.coverage.mappings) {
    if (mapping.status !== 'MAPPED') continue;
    for (const code of mapping.canonicalSkillCodes ?? []) {
      officialCodesBySkill.set(code, [...(officialCodesBySkill.get(code) ?? []), mapping.officialCode]);
    }
  }

  return inputs.v4Skills.map((skill) => {
    const assessment = questionsBySkill.get(skill.code) ?? { questionCount: 0, purposeCounts: Object.fromEntries(PURPOSES.map((purpose) => [purpose, 0])) };
    const lessonReady = lessonCodes.has(skill.code);
    const lesson = lessonsBySkill.get(skill.code);
    const prerequisiteEdges = prerequisitesBySkill.get(skill.code) ?? [];
    const unresolvedPrerequisites = prerequisiteEdges.filter((edge) => !knownSkillCodes.has(edge.to));
    const packageStatus = packageSkillStatus.get(skill.code);
    const missingPurposes = PURPOSES.filter((purpose) => assessment.purposeCounts[purpose] === 0);
    const underSequenceMinimum = assessment.questionCount < 12 || PURPOSES.some((purpose) => assessment.purposeCounts[purpose] < (purpose === 'PRACTICE' ? 4 : 2));
    const gaps = [];
    if (!lessonReady) gaps.push('LESSON_GAP');
    if (assessment.questionCount === 0) gaps.push('KNOWLEDGE_GAP');
    if (assessment.questionCount < 12) gaps.push('QUESTION_GAP');
    if (missingPurposes.some((purpose) => purpose === 'PROBE' || purpose === 'LOCK_IN' || purpose === 'REVIEW')) gaps.push('ASSESSMENT_GAP');
    if (underSequenceMinimum) gaps.push('PRACTICE_GAP');
    if (unresolvedPrerequisites.length > 0) gaps.push('PREREQUISITE_GAP');
    if (!officialCodesBySkill.has(skill.code)) gaps.push('MAPPING_GAP');
    if (skill.readiness !== 'ADAPTIVE_READY') gaps.push('ADAPTIVE_READINESS_GAP');
    gaps.push('REVIEW_GAP', 'PEDAGOGICAL_VALIDATION_GAP');

    const unlocks = unlockCounts.get(skill.code) ?? 0;
    const score = (!lessonReady ? 30 : 0)
      + (assessment.questionCount === 0 ? 25 : 0)
      + (assessment.questionCount < 12 ? Math.min(20, (12 - assessment.questionCount) * 2) : 0)
      + (underSequenceMinimum ? missingPurposes.length * 5 : 0)
      + (skill.readiness !== 'ADAPTIVE_READY' ? 10 : 0)
      + Math.min(unlocks, 5) * 4;

    return {
      skillCode: skill.code,
      title: skill.title,
      subjectCode: skill.subjectCode,
      stage: skill.recommendedStage,
      gradeFrom: skill.recommendedGradeFrom,
      gradeTo: skill.recommendedGradeTo,
      sourceReadiness: skill.readiness,
      sourceAuthoringStatus: skill.content_authoring_status,
      domain: skill.domain,
      parentSkillCode: skill.parent,
      objective: skill.objective,
      lessonAvailable: lessonReady,
      lessonObjective: lesson?.objective ?? null,
      hasWorkedExample: Boolean(lesson?.workedExample?.trim()),
      hasRemediation: Boolean((lesson?.remediations?.length ?? 0) > 0 || lesson?.commonMistake?.trim()),
      questionCount: assessment.questionCount,
      purposeCounts: assessment.purposeCounts,
      missingPurposes,
      prerequisites: prerequisiteEdges.map((edge) => ({ skillCode: edge.to, rationale: edge.rationale, source: edge.source })),
      unresolvedPrerequisiteCodes: unresolvedPrerequisites.map((edge) => edge.to),
      prerequisiteUnlockCount: unlocks,
      verifiedOfficialCodes: officialCodesBySkill.get(skill.code) ?? [],
      mappingStatus: officialCodesBySkill.has(skill.code) ? 'VERIFIED_LINK_EXISTS' : 'NO_VERIFIED_LINK',
      v4CoreContentStatus: packageStatus?.contentStatus ?? 'NOT_IN_V4_PACKAGE',
      pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      gaps: [...new Set(gaps)],
      priorityScore: score,
      publicationStatus: 'NOT_PUBLISHED_BY_FACTORY',
    };
  });
}

function buildOfficialInventory(inputs) {
  const coverageByCode = new Map(inputs.coverage.mappings.map((mapping) => [mapping.officialCode, mapping]));
  const proposalByCode = new Map();
  for (const proposal of inputs.proposals.proposals ?? []) {
    for (const code of proposal.officialCodes ?? []) proposalByCode.set(code, proposal);
  }
  return inputs.catalog.nodes.map((node) => {
    const mapping = coverageByCode.get(node.code);
    const proposal = proposalByCode.get(node.code);
    return {
      officialCode: node.code,
      stage: node.stage,
      kind: node.kind,
      gradeOrRange: node.gradeOrRange,
      componentCode: node.componentCode,
      sourceId: node.officialSource.id,
      sourcePage: node.officialSource.page,
      mappingStatus: mapping?.status ?? 'UNACCOUNTED',
      verifiedCanonicalSkillCodes: mapping?.status === 'MAPPED' ? mapping.canonicalSkillCodes ?? [] : [],
      candidateProposalId: proposal?.proposalId ?? null,
      candidateProposalStatus: proposal?.proposalStatus ?? null,
      candidateIsNotAMapping: Boolean(proposal),
    };
  });
}

function diversifyQueue(queue, maximum = 12) {
  const sorted = [...queue].sort((left, right) => right.priorityScore - left.priorityScore
    || left.subjectCode.localeCompare(right.subjectCode)
    || left.skillCode.localeCompare(right.skillCode));
  const selected = [];
  const deferred = [];
  const subjectCounts = new Map();
  const stageCounts = new Map();
  for (const item of sorted) {
    const subjectCount = subjectCounts.get(item.subjectCode) ?? 0;
    const stageCount = stageCounts.get(item.stage) ?? 0;
    if (subjectCount >= 1 || (selected.length >= 4 && stageCount >= Math.ceil(maximum * 0.6))) {
      deferred.push(item);
      continue;
    }
    selected.push(item);
    subjectCounts.set(item.subjectCode, subjectCount + 1);
    stageCounts.set(item.stage, stageCount + 1);
    if (selected.length === maximum) break;
  }
  for (const item of [...deferred, ...sorted]) {
    if (selected.length >= maximum) break;
    if (!selected.some((selectedItem) => selectedItem.skillCode === item.skillCode)) selected.push(item);
  }
  return selected;
}

export function buildKnowledgeFactory(inputs) {
  const officialInventory = buildOfficialInventory(inputs);
  const skillInventory = buildSkillInventory(inputs);
  const batchErrors = validateKnowledgeBatch(inputs.batch, inputs);
  const skillInventoryByCode = new Map(skillInventory.map((skill) => [skill.skillCode, skill]));
  const stagingSkillCoverage = inputs.batch.skills.map((item) => {
    const sourceSkill = skillInventoryByCode.get(item.skillCode);
    const covers = [];
    if (sourceSkill?.gaps.includes('KNOWLEDGE_GAP') && item.questions.length > 0) covers.push('KNOWLEDGE_GAP');
    if (sourceSkill?.gaps.includes('LESSON_GAP') && item.lesson) covers.push('LESSON_GAP');
    if (sourceSkill?.gaps.includes('QUESTION_GAP') && item.questions.length >= 12) covers.push('QUESTION_GAP');
    if (sourceSkill?.gaps.includes('PRACTICE_GAP') && item.questions.filter((question) => question.purpose === 'PRACTICE').length >= 4) covers.push('PRACTICE_GAP');
    if (sourceSkill?.gaps.includes('ASSESSMENT_GAP') && PURPOSES.every((purpose) => item.questions.filter((question) => question.purpose === purpose).length >= (purpose === 'PRACTICE' ? 4 : 2))) covers.push('ASSESSMENT_GAP');
    return {
      skillCode: item.skillCode,
      existingCanonicalSkill: Boolean(sourceSkill),
      existingUnitIds: inputs.v4Units.units.filter((unit) => unit.canonicalSkills.includes(item.skillCode)).map((unit) => unit.unitId),
      sourceGaps: sourceSkill?.gaps.filter((gap) => ['KNOWLEDGE_GAP', 'LESSON_GAP', 'QUESTION_GAP', 'PRACTICE_GAP', 'ASSESSMENT_GAP'].includes(gap)) ?? [],
      technicalGapsCoveredInStaging: covers,
      lessonCount: item.lesson ? 1 : 0,
      questionCount: item.questions.length,
      purposeCounts: Object.fromEntries(PURPOSES.map((purpose) => [purpose, item.questions.filter((question) => question.purpose === purpose).length])),
      publicationStatus: inputs.batch.publicationStatus,
      mappingStatus: item.mappingStatus,
      pedagogicalReviewStatus: item.pedagogicalReviewStatus,
      studentAvailable: false,
    };
  });
  const v9JourneyQuestions = inputs.v9Journeys.reduce((total, journey) => total + questionRows(journey).length, 0);
  const sourceRows = officialInventory.reduce((counts, item) => {
    counts[item.mappingStatus] = (counts[item.mappingStatus] ?? 0) + 1;
    return counts;
  }, {});
  const v4PurposeCounts = Object.fromEntries(PURPOSES.map((purpose) => [purpose, inputs.v4Questions.filter((question) => question.purpose === purpose).length]));
  const batchSummary = {
    skills: inputs.batch.skills.length,
    newCanonicalSkills: stagingSkillCoverage.filter((item) => !item.existingCanonicalSkill).length,
    existingCanonicalSkillsExpanded: stagingSkillCoverage.filter((item) => item.existingCanonicalSkill).length,
    newCurriculumUnits: stagingSkillCoverage.filter((item) => item.existingUnitIds.length === 0).length,
    officialMappingGapsResolved: 0,
    subjects: [...new Set(inputs.batch.skills.map((item) => item.subjectCode))].sort(),
    stages: [...new Set(inputs.batch.skills.map((item) => item.stage))].sort(),
    lessons: inputs.batch.skills.filter((item) => item.lesson).length,
    questions: inputs.batch.skills.reduce((total, item) => total + item.questions.length, 0),
    adaptiveSequencesWithAllPurposes: inputs.batch.skills.filter((item) => PURPOSES.every((purpose) => item.questions.some((question) => question.purpose === purpose))).length,
    publicationStatus: inputs.batch.publicationStatus,
    mappingStatus: inputs.batch.mappingStatus,
    pedagogicalReviewStatus: inputs.batch.pedagogicalReviewStatus,
    technicalValidation: batchErrors.length === 0 ? 'PASS' : 'FAIL',
    stagingSkillCoverage,
  };
  const technicalGapSkillCodes = new Set(skillInventory
    .filter((skill) => skill.gaps.some((gap) => ['KNOWLEDGE_GAP', 'LESSON_GAP', 'QUESTION_GAP', 'PRACTICE_GAP', 'ASSESSMENT_GAP'].includes(gap)))
    .map((skill) => skill.skillCode));
  const stagingCoveredSkillCodes = new Set(stagingSkillCoverage
    .filter((item) => item.sourceGaps.length > 0 && item.sourceGaps.every((gap) => item.technicalGapsCoveredInStaging.includes(gap)))
    .map((item) => item.skillCode));
  const body = {
    schemaVersion: 'tec-escola.bncc.knowledge-factory-inventory.v1',
    sourceHashes: inputs.sourceHashes,
    sourceBasis: {
      officialCatalogVersion: inputs.catalog.catalogVersion,
      officialCatalogHash: inputs.catalog.catalogHash,
      mappingCoverageHash: inputs.coverage.coverageHash,
      canonicalGraphHash: inputs.graph.graphHash,
      gapClusterHash: inputs.clusters.gapsHash,
      proposalsHash: inputs.proposals.proposalsHash,
      curriculumOverlay: [
        { id: 'LDB_14_945_2024', url: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/lei/l14945.htm', use: 'Áreas e articulação curricular do Ensino Médio; não cria por si só correspondências canônicas.' },
        { id: 'CNE_CEB_2_2024', url: 'https://portal.mec.gov.br/index.php?option=com_docman&view=download&alias=265041-rceb002-24&category_slug=novembro-2024&Itemid=30192', use: 'Diretrizes Curriculares Nacionais para o Ensino Médio.' },
        { id: 'CNE_CEB_1_2022_COMPUTACAO', url: 'https://acervoportal.mec.gov.br/conselho-nacional-de-educacao/base-nacional-comum-curricular-bncc', use: 'Complemento oficial de Computação, mantido com versão e proveniência próprias.' },
      ],
      alignmentRule: 'Área, componente ou semelhança de nome não equivale a mapeamento oficial; somente MAPPED fornece códigos vinculados.',
    },
    baseline: {
      officialNodes: inputs.catalog.nodes.length,
      officialMappingStatuses: sourceRows,
      officialComponentCounts: countBy(inputs.catalog.nodes, (node) => node.componentCode),
      internalCanonical: inputs.graph.summary,
      v4Source: {
        subjects: inputs.registry.subjects.length,
        skills: inputs.v4Skills.length,
        lessons: inputs.v4Lessons.length,
        questions: inputs.v4Questions.length,
        questionPurposes: v4PurposeCounts,
        packageSummary: inputs.v4ContentPackage.summary,
        curriculumUnits: inputs.v4Units.summary,
      },
      historicalProgressSnapshot: {
        updatedAt: inputs.historicalProgress.updatedAt,
        officialNodesAtSnapshot: inputs.historicalProgress.officialCatalog.uniqueCodes,
        declaredCanonicalGapsAtSnapshot: inputs.historicalProgress.mapping.canonicalGaps,
        note: 'Histórico versionado; não usado como fonte atual quando diverge dos registros e do snapshot de produção abaixo.',
      },
      v9StructuredAssets: {
        journeyAssets: inputs.v9Journeys.length,
        questionsInJourneyAssets: v9JourneyQuestions,
        lessonExpansionLessons: inputs.v9Lessons.length,
        questionExpansionQuestions: inputs.v9Questions.length,
        mappingReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      },
      productionReadOnly: inputs.productionBaseline,
    },
    officialNodes: officialInventory,
    internalSkillGaps: skillInventory,
    priorityQueue: diversifyQueue(skillInventory.filter((item) => item.gaps.some((gap) => ['KNOWLEDGE_GAP', 'LESSON_GAP', 'QUESTION_GAP', 'PRACTICE_GAP', 'ASSESSMENT_GAP'].includes(gap)))),
    authoredBatch: batchSummary,
    stagingCoverage: {
      technicalGapSkillsCovered: stagingCoveredSkillCodes.size,
      technicalGapPairsCovered: stagingSkillCoverage.reduce((total, item) => total + item.technicalGapsCoveredInStaging.length, 0),
      officialMappingGapsResolved: 0,
      newCanonicalSkills: batchSummary.newCanonicalSkills,
      newCurriculumUnits: batchSummary.newCurriculumUnits,
      studentAvailableSkills: 0,
    },
    gapTypeCounts: countBy(skillInventory.flatMap((item) => item.gaps), (gap) => gap),
    remainingGaps: {
      officialMappingGaps: officialInventory.filter((item) => ['CANONICAL_GAP', 'HUMAN_REVIEW_BLOCKED', 'MAPPING_PENDING', 'SOURCE_REVIEW_REQUIRED'].includes(item.mappingStatus)).length,
      technicalContentGaps: skillInventory.filter((item) => item.gaps.some((gap) => ['KNOWLEDGE_GAP', 'LESSON_GAP', 'QUESTION_GAP', 'PRACTICE_GAP', 'ASSESSMENT_GAP'].includes(gap))).length,
      technicalContentGapSkillsNotCoveredByStaging: technicalGapSkillCodes.size - stagingCoveredSkillCodes.size,
      pedagogicalReviewPendingSkills: skillInventory.filter((item) => item.gaps.includes('PEDAGOGICAL_VALIDATION_GAP')).length,
      officialUnaccountedNodes: officialInventory.filter((item) => item.mappingStatus === 'UNACCOUNTED').length,
    },
    safety: {
      proposedMappingsPromoted: 0,
      newContentPublished: false,
      studentHistoryModified: false,
      newContentAvailableToStudents: false,
      publicationBlocker: 'Human pedagogical review and explicit scoped publication are pending.',
    },
  };
  return { ...body, inventoryHash: hash(stableJson(body)) };
}

function run() {
  const root = process.cwd();
  const inputs = loadKnowledgeFactoryInputs(root);
  const errors = validateKnowledgeBatch(inputs.batch, inputs);
  if (errors.length) throw new Error(`KNOWLEDGE_BATCH_INVALID\n${errors.join('\n')}`);
  const report = buildKnowledgeFactory(inputs);
  const outputPath = path.join(root, OUTPUT_PATH);

  if (process.argv.includes('--check')) {
    if (!fs.existsSync(outputPath)) throw new Error(`KNOWLEDGE_FACTORY_INVENTORY_MISSING:${OUTPUT_PATH}`);
    const current = readJson(root, OUTPUT_PATH);
    if (current.inventoryHash !== report.inventoryHash) throw new Error('KNOWLEDGE_FACTORY_INVENTORY_STALE');
    console.log(`KNOWLEDGE_FACTORY_CHECK=PASS skills=${report.internalSkillGaps.length} official=${report.officialNodes.length} batch=${report.authoredBatch.skills}/${report.authoredBatch.questions}`);
    return;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`KNOWLEDGE_FACTORY_OUTPUT=${path.relative(root, outputPath)}`);
  console.log(`KNOWLEDGE_FACTORY_INVENTORY_HASH=${report.inventoryHash}`);
  console.log(`KNOWLEDGE_FACTORY_OFFICIAL_NODES=${report.baseline.officialNodes}`);
  console.log(`KNOWLEDGE_FACTORY_INTERNAL_SKILLS=${report.internalSkillGaps.length}`);
  console.log(`KNOWLEDGE_FACTORY_PRIORITY_BATCH=${report.priorityQueue.map((item) => item.skillCode).join(',')}`);
  console.log(`KNOWLEDGE_FACTORY_AUTHORED=${report.authoredBatch.skills}/${report.authoredBatch.lessons}/${report.authoredBatch.questions}`);
  console.log(`KNOWLEDGE_FACTORY_REMAINING_OFFICIAL_MAPPING_GAPS=${report.remainingGaps.officialMappingGaps}`);
  console.log('KNOWLEDGE_FACTORY_PUBLICATION=STAGING_ONLY');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
