import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildCompletionQueue } from './build-completion-queue-v14.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PATHS = {
  queue: 'content/bncc/authoring/completion-queue-v14.json',
  massCheckpoint: 'content/bncc/authoring/bncc-mass-authoring-checkpoint-v1.json',
  autopilotState: 'content/bncc/authoring/bncc-autopilot-state.json',
  legacyRecovery: 'content/bncc/authoring/legacy-package-recovery-v1.json',
  observationReview: 'content/bncc/authoring/early-childhood-observation-review-v1.json',
  highSchoolEvidenceRecovery: 'content/bncc/authoring/high-school-evidence-recovery-v1.json',
};

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function writeJson(relativePath, value) {
  fs.writeFileSync(path.join(ROOT, relativePath), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function selectBalancedAuthorableBatch(tasks, limit = 6) {
  const candidates = tasks.filter((task) => task.evidence.source === 'VERIFIED'
    && task.evidence.stagedPackages.length === 0
    && ['AUTHORING_READY', 'NO_REGISTERED_PRODUCER'].includes(task.executionClassification))
    .sort((left, right) => right.priorityScore - left.priorityScore || left.officialCode.localeCompare(right.officialCode));
  const selected = [];
  const stages = ['EDUCACAO_INFANTIL', 'ENSINO_FUNDAMENTAL', 'ENSINO_MEDIO'];
  for (const stage of stages) {
    const candidate = candidates.find((task) => task.stage === stage && !selected.includes(task));
    if (candidate) selected.push(candidate);
  }
  for (const task of candidates) {
    if (selected.length >= limit) break;
    if (selected.includes(task)) continue;
    if (selected.some((item) => item.componentCode === task.componentCode)) continue;
    selected.push(task);
  }
  for (const task of candidates) {
    if (selected.length >= limit) break;
    if (!selected.includes(task)) selected.push(task);
  }
  return selected.slice(0, limit).map((task) => task.officialCode);
}

function summarizeQueue(queue) {
  const tasks = queue.tasks;
  const uniqueFiles = new Set(tasks.flatMap((task) => task.evidence.stagedPackages.map((item) => item.file)));
  const prepared = tasks.filter((task) => task.technicalCompleteness.status === 'CONTENT_TECHNICALLY_COMPLETE');
  const preparedByStage = Object.fromEntries([...new Set(prepared.map((task) => task.stage))].sort().map((stage) => [stage, prepared.filter((task) => task.stage === stage).length]));
  const preparedByMode = Object.fromEntries([...new Set(prepared.map((task) => task.requirements.mode))].sort().map((mode) => [mode, prepared.filter((task) => task.requirements.mode === mode).length]));
  return {
    rubricVersion: 'tec-escola.bncc.technical-completeness.v2',
    queueHash: queue.queueHash,
    totalTasks: queue.summary.totalTasks,
    contentTechnicallyPrepared: queue.summary.contentTechnicallyComplete,
    contentMissing: queue.summary.totalTasks - queue.summary.contentTechnicallyComplete,
    legacyCountScreenComplete: queue.summary.legacyCountBasedTechnicalComplete,
    automatedQualityScreenIncomplete: queue.summary.automatedScreenIncomplete,
    stagedPackageFiles: uniqueFiles.size,
    sourceVerifiedTasks: tasks.filter((task) => task.evidence.source === 'VERIFIED').length,
    verifiedTasksWithoutRegisteredProducer: tasks.filter((task) => task.evidence.source === 'VERIFIED' && task.executionClassification === 'NO_REGISTERED_PRODUCER').length,
    humanPedagogicalApproved: queue.summary.humanPedagogicalApproved,
    canonicalMappingVerified: queue.summary.canonicalMappingVerified,
    publicationAuthorized: queue.summary.publicationAuthorized,
    preparedByStage,
    preparedByMode,
  };
}

export function reconcileMassAuthoringState({ fullTestStatus, focusedTestStatus } = {}) {
  const queue = buildCompletionQueue();
  writeJson(PATHS.queue, queue);
  const queueSnapshot = summarizeQueue(queue);
  const mass = readJson(PATHS.massCheckpoint);
  const legacyReport = readJson(PATHS.legacyRecovery);
  const observationReport = readJson(PATHS.observationReview);
  const highSchoolEvidenceReport = readJson(PATHS.highSchoolEvidenceRecovery);
  const massBefore = mass.completenessReevaluation ?? {};
  const now = new Date().toISOString();

  mass.schemaVersion = 'tec-escola.bncc.mass-authoring-checkpoint.v2';
  mass.snapshotDate = queue.generatedAt;
  mass.state = 'RECOVERED_LEGACY_GAPS_AND_OBSERVATION_MODE; CONTINUE_SCALE; HUMAN_REVIEW_PENDING';
  mass.reconciliation = {
    rubricVersion: queueSnapshot.rubricVersion,
    sourceOfCurrentCounts: PATHS.queue,
    queueHash: queueSnapshot.queueHash,
    reconciledAt: now,
    priorRubricMetricsRetainedAsHistory: true,
    historicalMetricVersion: 'tec-escola.bncc.technical-completeness.v1',
  };
  mass.completenessReevaluation = {
    priorCountScreenComplete: massBefore.beforeLegacyCountScreenComplete ?? 20,
    priorRubricPassCount: massBefore.beforePackagesPassingStrictRubric ?? 4,
    priorLegacyPackagesFailingStrictRubric: massBefore.legacyPackagesFailingStrictRubric ?? 16,
    priorRubricVersion: 'tec-escola.bncc.technical-completeness.v1',
    currentRubricVersion: queueSnapshot.rubricVersion,
    contentTechnicallyPrepared: queueSnapshot.contentTechnicallyPrepared,
    legacyCountScreenComplete: queueSnapshot.legacyCountScreenComplete,
    legacyCountOnlyNotPrepared: Math.max(0, queueSnapshot.legacyCountScreenComplete - queueSnapshot.contentTechnicallyPrepared),
    contentMissingAgainstQueue: queueSnapshot.contentMissing,
    sourceVerifiedTasks: queueSnapshot.sourceVerifiedTasks,
    verifiedTasksWithoutRegisteredProducer: queueSnapshot.verifiedTasksWithoutRegisteredProducer,
    queueNodes: queueSnapshot.totalTasks,
    queueHash: queueSnapshot.queueHash,
    humanPedagogicalApproved: queueSnapshot.humanPedagogicalApproved,
    canonicalMappingVerified: queueSnapshot.canonicalMappingVerified,
    publicationAuthorized: queueSnapshot.publicationAuthorized,
  };
  mass.legacyPackageRecovery = {
    target: 16,
    reviewed: legacyReport.packages.length,
    repaired: legacyReport.packages.filter((item) => item.status === 'AUTOMATED_SCREEN_PASS').length,
    stillIncomplete: legacyReport.packages.filter((item) => item.status !== 'AUTOMATED_SCREEN_PASS').length,
    evidenceFile: PATHS.legacyRecovery,
    rubricVersion: queueSnapshot.rubricVersion,
  };
  mass.earlyChildhoodObservationRecovery = {
    target: 6,
    reviewed: observationReport.packages.length,
    technicallyPrepared: observationReport.packages.filter((item) => item.status === 'AUTOMATED_SCREEN_PASS').length,
    stillIncomplete: observationReport.packages.filter((item) => item.status !== 'AUTOMATED_SCREEN_PASS').length,
    questionCountRequired: 0,
    humanReviewPending: true,
    evidenceFile: PATHS.observationReview,
  };
  mass.highSchoolEvidenceRecovery = {
    officialCode: highSchoolEvidenceReport.officialCode,
    sourceVerificationId: highSchoolEvidenceReport.sourceVerificationId,
    questionCount: highSchoolEvidenceReport.after.questionCount,
    rubricStatus: highSchoolEvidenceReport.automatedScreen.status,
    answerPositionCounts: highSchoolEvidenceReport.after.answerPositionCounts,
    humanReviewPending: highSchoolEvidenceReport.humanPedagogicalReviewStatus === 'PEDAGOGICAL_REVIEW_PENDING',
    mappingStatus: highSchoolEvidenceReport.canonicalMappingStatus,
    publicationStatus: highSchoolEvidenceReport.publicationStatus,
    publicationAuthorized: highSchoolEvidenceReport.publicationAuthorized,
    evidenceFile: PATHS.highSchoolEvidenceRecovery,
  };
  mass.validationSnapshot = {
    ...mass.validationSnapshot,
    curriculumPackageRubricV2: 'PASS',
    legacyPackageRecovery: `${mass.legacyPackageRecovery.repaired}_OF_${mass.legacyPackageRecovery.target}_PASS`,
    earlyChildhoodObservationMode: `${mass.earlyChildhoodObservationRecovery.technicallyPrepared}_OF_${mass.earlyChildhoodObservationRecovery.target}_PASS_NO_QUIZ_REQUIRED`,
    highSchoolEvidenceRecovery: `${mass.highSchoolEvidenceRecovery.officialCode}_${mass.highSchoolEvidenceRecovery.rubricStatus}`,
    completionQueueV14: `PASS_${queueSnapshot.totalTasks}_TASKS_${queueSnapshot.contentTechnicallyPrepared}_TECHNICALLY_PREPARED`,
    ...(fullTestStatus ? { fullTestSuite: fullTestStatus } : {}),
    ...(focusedTestStatus ? { focusedCampaignTests: focusedTestStatus } : {}),
  };
  mass.nextAuthorableBatch = selectBalancedAuthorableBatch(queue.tasks);
  mass.executorActive = false;
  mass.supervisorActive = false;
  mass.productionWrites = 'NONE';
  mass.publicationAuthorized = false;
  mass.mergeAuthorized = false;
  writeJson(PATHS.massCheckpoint, mass);

  const autopilot = readJson(PATHS.autopilotState);
  autopilot.updatedAt = now;
  autopilot.metrics = autopilot.metrics ?? {};
  autopilot.metrics.currentTechnicalCompletenessSnapshot = queueSnapshot;
  autopilot.metrics.currentTechnicalCompletenessSnapshot.sourceFile = PATHS.queue;
  autopilot.metricSemantics = {
    historicalAutopilotCountersAreExecutionHistory: true,
    historicalCountScreenRubricVersion: 'tec-escola.bncc.technical-completeness.v1',
    currentTechnicalCompletenessSource: PATHS.queue,
    currentTechnicalCompletenessQueueHash: queueSnapshot.queueHash,
    currentTechnicalCompletenessRubricVersion: queueSnapshot.rubricVersion,
    taskRecordsPreserved: true,
  };
  autopilot.checkpoints = autopilot.checkpoints ?? [];
  if (!autopilot.checkpoints.some((entry) => entry.status === 'CURRENT_RUBRIC_SNAPSHOT_RECONCILED' && entry.queueHash === queueSnapshot.queueHash)) {
    autopilot.checkpoints.push({
      taskId: 'BNCC_COMPLETION_QUEUE_RECONCILIATION',
      status: 'CURRENT_RUBRIC_SNAPSHOT_RECONCILED',
      rubricVersion: queueSnapshot.rubricVersion,
      queueHash: queueSnapshot.queueHash,
      at: now,
      taskRecordsPreserved: true,
    });
  }
  writeJson(PATHS.autopilotState, autopilot);

  console.log(JSON.stringify({ queueSnapshot, legacyPackageRecovery: mass.legacyPackageRecovery, earlyChildhoodObservationRecovery: mass.earlyChildhoodObservationRecovery, highSchoolEvidenceRecovery: mass.highSchoolEvidenceRecovery, nextAuthorableBatch: mass.nextAuthorableBatch, historicalTaskRecordsPreserved: true }, null, 2));
  return { queueSnapshot, mass, autopilot };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fullTestStatus = process.argv.find((arg) => arg.startsWith('--full-test-status='))?.split('=').slice(1).join('=');
  const focusedTestStatus = process.argv.find((arg) => arg.startsWith('--focused-test-status='))?.split('=').slice(1).join('=');
  reconcileMassAuthoringState({ fullTestStatus, focusedTestStatus });
}
