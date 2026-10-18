import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateCurriculumPackageRubric } from './curriculum-package-rubric.mjs';
import { getAuthoringProducer } from './bncc-authoring-producers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INPUTS = {
  audit: 'content/bncc/authoring/pending-coverage-audit-v3.json',
  sizing: 'content/bncc/authoring/coverage-sizing-v3.json',
  inventory: 'content/bncc/authoring/knowledge-factory-inventory-v4.json',
  catalog: 'content/bncc/official/catalog-2018.json',
  sourceVerification: 'content/bncc/authoring/source-verification-v2.json',
  packages: 'content/adaptive/tec-escola-core-v5',
  experientialPackages: 'content/bncc/authoring',
};
const OUTPUT_QUEUE = 'content/bncc/authoring/completion-queue-v14.json';
const OUTPUT_CHECKPOINT = 'content/bncc/authoring/bncc-v14-checkpoint.json';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sourceState(record) {
  return record.exactSourceVerified && record.queueStatus !== 'SOURCE_TEXT_REVIEW_REQUIRED'
    ? 'VERIFIED'
    : 'REVIEW_REQUIRED';
}

function queueState(record) {
  if (record.queueStatus === 'SOURCE_TEXT_REVIEW_REQUIRED' || !record.exactSourceVerified) return 'BLOCKED_SOURCE';
  if (record.mappingStatus === 'HUMAN_REVIEW_BLOCKED' || record.nextAction === 'HUMAN_MAPPING_REVIEW_REQUIRED') return 'BLOCKED_HUMAN_PEDAGOGICAL_REVIEW';
  if (record.mappingStatus === 'CANONICAL_GAP' || record.mappingStatus === 'HIERARCHY_ONLY' || record.queueStatus === 'MAPPING_REVIEW_REQUIRED') return 'BLOCKED_CANONICAL_REVIEW';
  return 'READY';
}

function priorityScore(record) {
  const stage = { EDUCACAO_INFANTIL: 40, ENSINO_FUNDAMENTAL: 30, ENSINO_MEDIO: 20 }[record.stage] ?? 10;
  const kind = record.kind === 'LEARNING_DEVELOPMENT_OBJECTIVE' ? 6 : 10;
  const source = record.exactSourceVerified ? 10 : 0;
  const mapping = record.mappingStatus === 'CANONICAL_GAP' ? 5 : record.mappingStatus === 'HUMAN_REVIEW_BLOCKED' ? 3 : 1;
  return stage + kind + source + mapping;
}

function listStagedEvidence({ sourceByCode, sizingByCode, auditByCode }) {
  const dir = path.join(ROOT, INPUTS.packages);
  const evidence = new Map();
  for (const entry of fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort()) {
    let pack;
    try { pack = JSON.parse(fs.readFileSync(path.join(dir, entry), 'utf8')); } catch { continue; }
    const code = pack.sourceContext?.officialCode;
    if (!code) continue;
    const auditRecord = auditByCode.get(code);
    const requirements = auditRecord ? requirementsFor(auditRecord, sizingByCode) : {};
    const sourceRecord = sourceByCode.get(code);
    const rubric = evaluateCurriculumPackageRubric(pack, { requirements, officialSourceRecord: sourceRecord });
    const item = {
      file: path.relative(ROOT, path.join(dir, entry)).replaceAll(path.sep, '/'),
      contentId: pack.contentId,
      questionCount: pack.questions?.length ?? 0,
      lessonCount: pack.lesson ? 1 : 0,
      activityCount: pack.lesson?.authenticActivities?.length ?? 0,
      assessmentCount: pack.lesson?.progression?.length ? 1 : 0,
      active: pack.active === true,
      publicationStatus: pack.publicationStatus,
      pedagogicalReviewStatus: pack.pedagogicalReviewStatus,
      officialMappingStatus: pack.officialMappingStatus,
      legacyCountBasedComplete: Boolean(auditRecord
        && !pack.active
        && ['STAGING', 'STAGING_INACTIVE'].includes(pack.publicationStatus)
        && pack.pedagogicalReviewStatus === 'PEDAGOGICAL_REVIEW_PENDING'
        && pack.officialMappingStatus === 'NOT_CLAIMED'
        && (pack.lesson ? 1 : 0) >= (requirements.lessons ?? 1)
        && (pack.questions?.length ?? 0) >= (requirements.questions ?? 0)
        && (pack.lesson?.authenticActivities?.length ?? 0) >= (requirements.activities ?? 1)
        && (pack.lesson?.progression?.length ?? 0) >= 1
        && auditRecord.exactSourceVerified),
      qualityRubric: rubric,
    };
    evidence.set(code, [...(evidence.get(code) ?? []), item]);
  }

  const experientialDir = path.join(ROOT, INPUTS.experientialPackages);
  for (const entry of fs.readdirSync(experientialDir).filter((name) => /^early-childhood-experiential-v\d+\.json$/.test(name)).sort()) {
    let pack;
    try { pack = JSON.parse(fs.readFileSync(path.join(experientialDir, entry), 'utf8')); } catch { continue; }
    const code = pack.officialCode;
    if (!code) continue;
    const auditRecord = auditByCode.get(code);
    const requirements = auditRecord ? requirementsFor(auditRecord, sizingByCode) : {};
    if (requirements.mode !== 'EDUCATOR_MEDIATED_OBSERVATION') continue;
    const sourceRecord = sourceByCode.get(code);
    const rubric = evaluateCurriculumPackageRubric(pack, { requirements, officialSourceRecord: sourceRecord });
    const contentStatus = pack.contentStatus ?? {};
    const observationExperiences = pack.learningDesign?.observationExperiences ?? [];
    const observationCriteria = pack.learningDesign?.observationCriteria ?? [];
    const item = {
      file: path.relative(ROOT, path.join(experientialDir, entry)).replaceAll(path.sep, '/'),
      contentId: pack.officialCode,
      mode: requirements.mode,
      questionCount: pack.questions?.length ?? 0,
      lessonCount: pack.learningDesign?.objective ? 1 : 0,
      activityCount: observationExperiences.length,
      assessmentCount: observationCriteria.length,
      active: pack.active === true,
      publicationStatus: contentStatus.publicationStatus,
      pedagogicalReviewStatus: contentStatus.pedagogicalReviewStatus,
      officialMappingStatus: contentStatus.officialMappingStatus,
      legacyCountBasedComplete: Boolean(auditRecord
        && pack.active === false
        && contentStatus.publicationStatus === 'STAGING_INACTIVE'
        && contentStatus.pedagogicalReviewStatus === 'PEDAGOGICAL_REVIEW_PENDING'
        && contentStatus.officialMappingStatus === 'NOT_CLAIMED'
        && observationExperiences.length >= (requirements.observationalExperiences ?? 1)
        && observationCriteria.length >= (requirements.observationCriteria ?? 3)
        && auditRecord.exactSourceVerified),
      qualityRubric: rubric,
    };
    evidence.set(code, [...(evidence.get(code) ?? []), item]);
  }
  return evidence;
}

function requirementsFor(record, sizingByCode) {
  const sizing = sizingByCode.get(record.officialCode);
  if (record.kind === 'LEARNING_DEVELOPMENT_OBJECTIVE') {
    return {
      mode: 'EDUCATOR_MEDIATED_OBSERVATION',
      observationalExperiences: sizing?.observationalExperiences ?? 1,
      observationCriteria: sizing?.observationCriteria ?? 3,
      questions: 0,
    };
  }
  return {
    mode: 'OBJECTIVE_LEARNING_PATH',
    lessons: sizing?.technicalMinimumLessons ?? 1,
    workedExamples: sizing?.technicalMinimumWorkedExamples ?? 1,
    activities: sizing?.technicalMinimumActivities ?? 1,
    diagnosticAssessments: sizing?.technicalMinimumDiagnosticAssessments ?? 1,
    masteryAssessments: sizing?.technicalMinimumMasteryAssessments ?? 1,
    questions: sizing?.technicalMinimumQuestions ?? 40,
  };
}

function buildCompletionQueue() {
  const audit = readJson(INPUTS.audit);
  const sizing = readJson(INPUTS.sizing);
  const inventory = readJson(INPUTS.inventory);
  const catalog = readJson(INPUTS.catalog);
  const sourceVerification = readJson(INPUTS.sourceVerification);
  const sizingByCode = new Map((sizing.nodeSizing ?? []).map((item) => [item.officialCode, item]));
  const sourceByCode = new Map((sourceVerification.records ?? []).map((item) => [item.officialCode, item]));
  const auditByCode = new Map((audit.records ?? []).map((item) => [item.officialCode, item]));
  const stagedEvidence = listStagedEvidence({ sourceByCode, sizingByCode, auditByCode });
  const catalogByCode = new Map((catalog.nodes ?? catalog.records ?? []).map((item) => [item.code, item]));
  const tasks = (audit.records ?? []).map((record) => {
    const evidence = stagedEvidence.get(record.officialCode) ?? [];
    const verifiedSource = sourceByCode.get(record.officialCode);
    const requirements = requirementsFor(record, sizingByCode);
    const legacyTechnicalCandidate = evidence.find((item) => item.legacyCountBasedComplete);
    const technicalCandidate = evidence.find((item) => !item.active
      && ['STAGING', 'STAGING_INACTIVE'].includes(item.publicationStatus)
      && item.pedagogicalReviewStatus === 'PEDAGOGICAL_REVIEW_PENDING'
      && item.officialMappingStatus === 'NOT_CLAIMED'
      && item.qualityRubric.status === 'AUTOMATED_SCREEN_PASS');
    const technicalComplete = Boolean(technicalCandidate
      && record.exactSourceVerified
      && verifiedSource?.technicalVerificationStatus === 'OFFICIAL_SOURCE_VERIFIED_EXACT');
    const state = technicalComplete
      ? 'CONTENT_TECHNICALLY_COMPLETE'
      : evidence.length > 0 ? 'CONTENT_REVIEW_REQUIRED' : queueState(record);
    return {
      taskId: `BNCC_${record.officialCode}`,
      officialCode: record.officialCode,
      stage: record.stage,
      componentCode: record.componentCode,
      kind: record.kind,
      priorityScore: priorityScore(record),
      state,
      queueState: queueState(record),
      nextAction: record.nextAction,
      executionClassification: !record.exactSourceVerified
        ? 'SOURCE_VERIFICATION_REQUIRED'
        : queueState(record) === 'BLOCKED_HUMAN_PEDAGOGICAL_REVIEW'
          ? 'HUMAN_REVIEW_REQUIRED'
          : evidence.length > 0
            ? 'COMPLETE_OR_REPAIR_STAGED_PACKAGE'
            : getAuthoringProducer({ officialCode: record.officialCode })
              ? 'AUTHORING_READY'
              : 'NO_REGISTERED_PRODUCER',
      blockers: queueState(record) === 'READY' ? [] : [queueState(record)],
      requirements,
      evidence: {
        source: sourceState(record),
        sourceVerificationId: verifiedSource?.verificationId ?? null,
        catalogDescriptorPresent: Boolean(catalogByCode.get(record.officialCode)),
        stagedPackages: evidence,
      },
      technicalCompleteness: {
        status: technicalComplete ? 'CONTENT_TECHNICALLY_COMPLETE' : 'CONTENT_INCOMPLETE_OR_NOT_STARTED',
        readyForPedagogicalReview: technicalComplete,
        legacyCountBasedStatus: legacyTechnicalCandidate ? 'LEGACY_COUNT_SCREEN_PASS' : 'LEGACY_COUNT_SCREEN_INCOMPLETE',
        qualityRubric: technicalCandidate?.qualityRubric ?? evidence[0]?.qualityRubric ?? null,
        canonicalMappingVerified: false,
        humanPedagogicalApproved: false,
        publicationAuthorized: false,
      },
      gates: {
        active: false,
        studentPublicationStatus: 'STAGING_INACTIVE',
        pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
        officialMappingStatus: 'NOT_CLAIMED',
      },
    };
  }).sort((left, right) => right.priorityScore - left.priorityScore || left.officialCode.localeCompare(right.officialCode));
  const summary = {
    totalTasks: tasks.length,
    byState: Object.fromEntries([...new Set(tasks.map((task) => task.state))].sort().map((state) => [state, tasks.filter((task) => task.state === state).length])),
    byQueueState: Object.fromEntries([...new Set(tasks.map((task) => task.queueState))].sort().map((state) => [state, tasks.filter((task) => task.queueState === state).length])),
    byExecutionClassification: Object.fromEntries([...new Set(tasks.map((task) => task.executionClassification))].sort().map((state) => [state, tasks.filter((task) => task.executionClassification === state).length])),
    contentTechnicallyComplete: tasks.filter((task) => task.technicalCompleteness.status === 'CONTENT_TECHNICALLY_COMPLETE').length,
    legacyCountBasedTechnicalComplete: tasks.filter((task) => task.technicalCompleteness.legacyCountBasedStatus === 'LEGACY_COUNT_SCREEN_PASS').length,
    automatedScreenIncomplete: tasks.filter((task) => task.evidence.stagedPackages.length > 0 && task.technicalCompleteness.status !== 'CONTENT_TECHNICALLY_COMPLETE').length,
    canonicalMappingVerified: tasks.filter((task) => task.technicalCompleteness.canonicalMappingVerified).length,
    readyForPedagogicalReview: tasks.filter((task) => task.technicalCompleteness.readyForPedagogicalReview).length,
    humanPedagogicalApproved: 0,
    publicationAuthorized: 0,
  };
  const artifact = {
    schemaVersion: 'tec-escola.bncc.completion-queue.v14',
    campaignId: 'TECESCOLA_BNCC_AUTONOMOUS_COMPLETION_ENGINE_V14',
    generatedAt: process.env.BNCC_SNAPSHOT_DATE ?? new Date().toISOString().slice(0, 10),
    sourceInputs: INPUTS,
    policy: {
      contentMayBePreparedWithoutCanonicalMapping: true,
      relationForUnmappedContent: 'AUTHORING_CONTEXT_ONLY',
      contentDefault: 'STAGING_INACTIVE',
      pedagogicalReviewDefault: 'PEDAGOGICAL_REVIEW_PENDING',
      publicationAuthorizationDefault: false,
      productionWrites: 'NONE',
    },
    inventorySnapshot: {
      officialNodes: inventory.officialCoverage?.totalNodes ?? 0,
      auditedSequences: inventory.existingContent?.auditedSequences ?? 0,
      priorTechnicalDeepReady: inventory.existingContent?.technicalDeepReady ?? 0,
      pendingCoverageItems: audit.auditedFacts?.queueItems ?? 0,
    },
    summary,
    tasks,
  };
  artifact.queueHash = hash(stableJson({ ...artifact, queueHash: undefined }));
  return artifact;
}

function main() {
  const artifact = buildCompletionQueue();
  fs.writeFileSync(path.join(ROOT, OUTPUT_QUEUE), `${JSON.stringify(artifact, null, 2)}\n`);
  if (process.argv.includes('--queue-only')) {
    console.log(`BNCC_COMPLETION_QUEUE_V14=${artifact.summary.totalTasks}`);
    console.log(`BNCC_CONTENT_TECHNICALLY_COMPLETE=${artifact.summary.contentTechnicallyComplete}`);
    console.log(`BNCC_LEGACY_COUNT_SCREEN_COMPLETE=${artifact.summary.legacyCountBasedTechnicalComplete}`);
    console.log(`BNCC_AUTOMATED_SCREEN_INCOMPLETE=${artifact.summary.automatedScreenIncomplete}`);
    console.log(`BNCC_COMPLETION_QUEUE_HASH=${artifact.queueHash}`);
    return;
  }
  const checkpoint = {
    schemaVersion: 'tec-escola.bncc.campaign-checkpoint.v14',
    campaignId: artifact.campaignId,
    branch: 'codex/bncc-question-first-adaptive-tutor-v5',
    head: process.env.BNCC_HEAD ?? 'WORKTREE',
    recordedAt: artifact.generatedAt,
    lastOperation: {
      type: 'GLOBAL_COMPLETION_QUEUE_AND_V14_STAGED_HISTORY_CONTENT',
      status: 'PARTIAL_TECHNICAL_PROGRESS',
      result: 'QUEUE_RECONCILED_AND_TWO_AUTHORING_CONTEXT_PACKAGES_STAGED',
      studentPublicationStatus: 'STAGING_INACTIVE',
      pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      officialMappingStatus: 'NOT_CLAIMED',
    },
    inventory: artifact.inventorySnapshot,
    summary: artifact.summary,
    evidence: {
      queue: OUTPUT_QUEUE,
      sourceVerification: INPUTS.sourceVerification,
      priorInventory: INPUTS.inventory,
    },
    gates: artifact.policy,
    nextTarget: artifact.tasks.find((task) => task.state !== 'CONTENT_TECHNICALLY_COMPLETE')?.officialCode ?? null,
  };
  checkpoint.checkpointHash = hash(stableJson(checkpoint));
  fs.writeFileSync(path.join(ROOT, OUTPUT_CHECKPOINT), `${JSON.stringify(checkpoint, null, 2)}\n`);
  console.log(`BNCC_COMPLETION_QUEUE_V14=${artifact.summary.totalTasks}`);
  console.log(`BNCC_CONTENT_TECHNICALLY_COMPLETE=${artifact.summary.contentTechnicallyComplete}`);
  console.log(`BNCC_READY_FOR_PEDAGOGICAL_REVIEW=${artifact.summary.readyForPedagogicalReview}`);
  console.log(`BNCC_COMPLETION_QUEUE_HASH=${artifact.queueHash}`);
}

if (process.argv[1] && import.meta.url === `file:///${process.argv[1].replaceAll('\\', '/')}`) main();

export { buildCompletionQueue, queueState };
