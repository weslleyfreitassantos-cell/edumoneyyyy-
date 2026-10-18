import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { buildCompletionQueue } from './build-completion-queue-v14.mjs';
import { getAuthoringProducer } from './bncc-authoring-producers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PATHS = {
  queue: 'content/bncc/authoring/completion-queue-v14.json',
  campaignCheckpoint: 'content/bncc/authoring/bncc-v14-checkpoint.json',
  state: 'content/bncc/authoring/bncc-autopilot-state.json',
  log: path.join('.git', 'bncc-autopilot.log.jsonl'),
  lock: path.join('.git', 'bncc-autopilot.lock'),
  stop: path.join('.git', 'bncc-autopilot.stop'),
};
const CAMPAIGN_ID = 'TECESCOLA_BNCC_AUTOPILOT';
const SCHEMA_VERSION = 'tec-escola.bncc.autopilot-state.v1';
const RUN_STATUS = Object.freeze({
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  CAMPAIGN_COMPLETE: 'CAMPAIGN_COMPLETE',
  EXECUTION_BUDGET_REACHED: 'EXECUTION_BUDGET_REACHED',
  HUMAN_REVIEW_BLOCKED: 'HUMAN_REVIEW_BLOCKED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  USER_STOPPED: 'USER_STOPPED',
  NO_EXECUTABLE_TASKS: 'NO_EXECUTABLE_TASKS',
  SYSTEM_UNRECOVERABLE: 'SYSTEM_UNRECOVERABLE',
});
const LEGACY_RUN_STATUS = {
  LIMIT_REACHED: RUN_STATUS.EXECUTION_BUDGET_REACHED,
  SAFE_BUDGET_REACHED: RUN_STATUS.EXECUTION_BUDGET_REACHED,
  STOPPED_BY_USER: RUN_STATUS.USER_STOPPED,
  NO_SAFE_WORK_REMAINING: RUN_STATUS.NO_EXECUTABLE_TASKS,
};
const DEFAULTS = {
  maxTasks: Number(process.env.BNCC_AUTOPILOT_MAX_TASKS ?? 8),
  maxCycles: Number(process.env.BNCC_AUTOPILOT_MAX_CYCLES ?? 32),
  maxSeconds: Number(process.env.BNCC_AUTOPILOT_MAX_SECONDS ?? 900),
  retryLimit: Number(process.env.BNCC_AUTOPILOT_RETRY_LIMIT ?? 3),
};

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(absolute(relativePath), 'utf8'));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function hash(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : stableJson(value)).digest('hex');
}

function now() {
  return new Date().toISOString();
}

function writeJsonAtomic(relativePath, value) {
  const outputPath = absolute(relativePath);
  const tempPath = `${outputPath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tempPath, outputPath);
}

function appendLog(event) {
  const logPath = absolute(PATHS.log);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${JSON.stringify({ at: now(), ...event })}\n`);
}

function gitHead() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`GIT_HEAD_UNAVAILABLE:${result.stderr?.trim() ?? ''}`);
  return result.stdout.trim();
}

function refreshQueue() {
  const head = gitHead();
  const result = spawnSync(process.execPath, [absolute('tools/bncc/build-completion-queue-v14.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, BNCC_HEAD: head.slice(0, 12) },
  });
  if (result.status !== 0) throw new Error(`QUEUE_REFRESH_FAILED:${result.stderr?.trim() ?? result.stdout?.trim() ?? ''}`);
  return readJson(PATHS.queue);
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock() {
  const lockPath = absolute(PATHS.lock);
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  try {
    const fd = fs.openSync(lockPath, 'wx');
    fs.writeFileSync(fd, `${JSON.stringify({ pid: process.pid, startedAt: now(), head: gitHead() })}\n`);
    fs.closeSync(fd);
    return () => { try { fs.unlinkSync(lockPath); } catch { /* already released */ } };
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let lock;
    try { lock = JSON.parse(fs.readFileSync(lockPath, 'utf8')); } catch { lock = null; }
    if (lock && isProcessAlive(lock.pid)) throw new Error(`AUTOPILOT_LOCK_HELD:${lock.pid}`);
    fs.unlinkSync(lockPath);
    return acquireLock();
  }
}

function parseOptions(args) {
  const options = { ...DEFAULTS };
  for (const arg of args) {
    const match = arg.match(/^--(max-tasks|max-cycles|max-seconds|retry-limit)=(\d+)$/);
    if (!match) continue;
    const key = { 'max-tasks': 'maxTasks', 'max-cycles': 'maxCycles', 'max-seconds': 'maxSeconds', 'retry-limit': 'retryLimit' }[match[1]];
    options[key] = Number(match[2]);
  }
  return options;
}

function taskHash(task) {
  return hash({ taskId: task.taskId, officialCode: task.officialCode, requirements: task.requirements, evidence: task.evidence });
}

function createInitialState(queue) {
  const completed = queue.tasks.filter((task) => task.state === 'CONTENT_TECHNICALLY_COMPLETE').map((task) => task.taskId);
  return {
    schemaVersion: SCHEMA_VERSION,
    campaignId: CAMPAIGN_ID,
    executionId: crypto.randomUUID(),
    createdAt: now(),
    updatedAt: now(),
    runStatus: RUN_STATUS.IDLE,
    currentTask: null,
    lastCompletedTask: completed.at(-1) ?? null,
    nextTask: queue.tasks.find((task) => !completed.includes(task.taskId))?.taskId ?? null,
    queueHash: queue.queueHash,
    taskRecords: Object.fromEntries(completed.map((taskId) => [taskId, { taskId, status: 'CONTENT_TECHNICALLY_COMPLETE', attempts: 0, checkpointHash: hash({ taskId, status: 'CONTENT_TECHNICALLY_COMPLETE' }) }])),
    blockedTasks: [],
    metrics: {
      cycles: 0,
      completedTasks: completed.length,
      contentCompleteBaseline: completed.length,
      learningPathsCompleted: completed.length,
      learningPathsCompletedDelta: 0,
      realContentPackagesCreated: 0,
      realContentPackagesValidated: 0,
      briefsCreated: 0,
      briefsConvertedToPackages: 0,
      tasksWithoutAuthoringProvider: 0,
      technicalContentGapsReduced: 0,
      partialTasks: 0,
      awaitingAuthoringTasks: 0,
      blockedTasks: 0,
      failedTasks: 0,
      pendingTasks: queue.tasks.length - completed.length,
    },
    checkpoints: [],
    policy: {
      productionWrites: 'NONE',
      remoteMigrations: 'NO',
      publicationAuthorized: false,
      automaticGitCommit: false,
      automaticGitPush: false,
    },
  };
}

function loadState(queue) {
  const statePath = absolute(PATHS.state);
  if (!fs.existsSync(statePath)) return createInitialState(queue);
  const state = readJson(PATHS.state);
  if (state.schemaVersion !== SCHEMA_VERSION || state.campaignId !== CAMPAIGN_ID) throw new Error('AUTOPILOT_STATE_SCHEMA_INVALID');
  state.runStatus = LEGACY_RUN_STATUS[state.runStatus] ?? state.runStatus;
  return reconcileStateWithQueue(queue, state);
}

function saveState(state) {
  state.updatedAt = now();
  writeJsonAtomic(PATHS.state, state);
}

function reconcileStateWithQueue(queue, state) {
  state.metrics = state.metrics ?? {};
  if (!Number.isInteger(state.metrics.contentCompleteBaseline)) state.metrics.contentCompleteBaseline = state.metrics.completedTasks ?? 0;
  state.taskRecords = state.taskRecords ?? {};
  state.blockedTasks = state.blockedTasks ?? [];
  for (const task of queue.tasks) {
    const record = state.taskRecords[task.taskId];
    if (
      record
      && record.lastAction === 'AUTHORING_CONTEXT_BRIEF_CREATED'
      && !getAuthoringProducer(task)
      && !task.evidence?.stagedPackages?.length
    ) {
      record.status = 'AWAITING_CONTENT_AUTHORING';
      record.lastAction = 'AUTHORING_CONTEXT_BRIEF_CREATED';
      record.updatedAt = record.updatedAt ?? now();
    }
  }
  state.blockedTasks = state.blockedTasks.filter((blocked) => {
    const task = queue.tasks.find((candidate) => candidate.taskId === blocked.taskId);
    const producer = task ? getAuthoringProducer(task) : null;
    if (!task || task.state !== 'CONTENT_TECHNICALLY_COMPLETE' || !producer || !task.evidence?.stagedPackages?.length) return true;
    try {
      const packageData = readJson(task.evidence.stagedPackages[0].file);
      return !validateExistingPackage(task, packageData).valid;
    } catch {
      return true;
    }
  });
  const completedTasks = queue.tasks.filter((task) => task.state === 'CONTENT_TECHNICALLY_COMPLETE');
  for (const task of completedTasks) {
    const record = state.taskRecords[task.taskId] ?? { taskId: task.taskId, attempts: 0 };
    if (record.status !== 'CONTENT_TECHNICALLY_COMPLETE') {
      record.status = 'CONTENT_TECHNICALLY_COMPLETE';
      record.lastAction = 'QUEUE_COMPLETION_RECONCILED';
      record.lastPath = task.evidence.stagedPackages?.[0]?.file ?? null;
      record.updatedAt = now();
      record.checkpointHash = hash({ taskId: task.taskId, status: record.status, queueHash: queue.queueHash });
    }
    state.taskRecords[task.taskId] = record;
  }
  state.queueHash = queue.queueHash;
  state.metrics.completedTasks = completedTasks.length;
  state.metrics.learningPathsCompleted = completedTasks.length;
  state.metrics.learningPathsCompletedDelta = completedTasks.length - state.metrics.contentCompleteBaseline;
  state.metrics.technicalContentGapsReduced = Math.max(0, state.metrics.learningPathsCompletedDelta);
  state.metrics.pendingTasks = queue.tasks.length - completedTasks.length;
  state.metrics.partialTasks = Object.values(state.taskRecords).filter((record) => record.status === 'CONTENT_PARTIAL').length;
  state.metrics.awaitingAuthoringTasks = Object.values(state.taskRecords).filter((record) => record.status === 'AWAITING_CONTENT_AUTHORING').length;
  state.metrics.failedTasks = Object.values(state.taskRecords).filter((record) => record.status === 'FAILED_RECOVERABLE').length;
  state.metrics.blockedTasks = state.blockedTasks.length;
  state.metrics.realContentPackagesCreated = Object.values(state.taskRecords).filter((record) => record.lastAction === 'CONTENT_PACKAGE_CREATED').length;
  state.metrics.realContentPackagesValidated = Object.values(state.taskRecords).filter((record) => ['CONTENT_PACKAGE_CREATED', 'EXISTING_PACKAGE_VALIDATED'].includes(record.lastAction)).length;
  state.metrics.briefsCreated = Object.values(state.taskRecords).filter((record) => record.lastAction === 'AUTHORING_CONTEXT_BRIEF_CREATED').length;
  state.metrics.briefsConvertedToPackages = Object.values(state.taskRecords).filter((record) => record.briefConverted === true).length;
  state.metrics.tasksWithoutAuthoringProvider = queue.tasks.filter((task) => hasSafeAuthoringCandidate(task) && !getAuthoringProducer(task) && !task.evidence?.stagedPackages?.length).length;
  const completedIds = new Set(completedTasks.map((task) => task.taskId));
  state.lastCompletedTask = completedIds.has(state.lastCompletedTask)
    ? state.lastCompletedTask
    : completedTasks.at(-1)?.taskId ?? null;
  state.nextTask = selectNextTask(queue, state)?.taskId ?? null;
  return state;
}

function queueSummary(queue, state) {
  return {
    campaign: CAMPAIGN_ID,
    executorImplemented: true,
    executorActive: fs.existsSync(absolute(PATHS.lock)),
    queueHash: queue.queueHash,
    totalTasks: queue.summary.totalTasks,
    queueStates: queue.summary.byQueueState,
    contentTechnicallyComplete: queue.summary.contentTechnicallyComplete,
    readyForPedagogicalReview: queue.summary.readyForPedagogicalReview,
    canonicalMappingVerified: queue.summary.canonicalMappingVerified,
    pendingTasks: state.metrics.pendingTasks,
    completedTasks: state.metrics.completedTasks,
    blockedTasks: state.metrics.blockedTasks,
    partialTasks: state.metrics.partialTasks,
    failedTasks: state.metrics.failedTasks,
    realContentPackagesCreated: state.metrics.realContentPackagesCreated,
    realContentPackagesValidated: state.metrics.realContentPackagesValidated,
    learningPathsCompleted: state.metrics.learningPathsCompleted,
    learningPathsCompletedDelta: state.metrics.learningPathsCompletedDelta,
    briefsCreated: state.metrics.briefsCreated,
    briefsConvertedToPackages: state.metrics.briefsConvertedToPackages,
    tasksWithoutAuthoringProvider: state.metrics.tasksWithoutAuthoringProvider,
    technicalContentGapsReduced: state.metrics.technicalContentGapsReduced,
    awaitingAuthoringTasks: state.metrics.awaitingAuthoringTasks,
    lastCompletedTask: state.lastCompletedTask,
    nextTask: state.nextTask,
    runStatus: state.runStatus,
    stopReason: state.runStatus,
    resumable: state.runStatus === RUN_STATUS.EXECUTION_BUDGET_REACHED,
    stopRequested: fs.existsSync(absolute(PATHS.stop)),
    metricReconciliation: reconcileMetrics(queue),
    policy: state.policy,
  };
}

function determineRunStatus({ queue, state, stopRequested = false, cycles = 0, tasksProcessed = 0, options = DEFAULTS, elapsedMs = 0 }) {
  if (stopRequested) return RUN_STATUS.USER_STOPPED;
  if (queue.tasks.length > 0 && queue.tasks.every((task) => task.state === 'CONTENT_TECHNICALLY_COMPLETE')) {
    return RUN_STATUS.CAMPAIGN_COMPLETE;
  }
  if (
    tasksProcessed >= options.maxTasks ||
    cycles >= options.maxCycles ||
    elapsedMs >= options.maxSeconds * 1000
  ) {
    return RUN_STATUS.EXECUTION_BUDGET_REACHED;
  }
  if ((state.metrics.failedTasks ?? 0) > 0) return RUN_STATUS.VALIDATION_FAILED;
  if ((state.blockedTasks?.length ?? 0) > 0) return RUN_STATUS.HUMAN_REVIEW_BLOCKED;
  if (!selectNextTask(queue, state)) return RUN_STATUS.NO_EXECUTABLE_TASKS;
  return RUN_STATUS.SYSTEM_UNRECOVERABLE;
}

function reconcileMetrics(queue) {
  const inventory = readJson('content/bncc/authoring/knowledge-factory-inventory-v4.json');
  const sourceVerification = readJson('content/bncc/authoring/source-verification-v2.json');
  const coverageMatrix = readJson('content/bncc/authoring/coverage-matrix-v8.json');
  const coverage = readJson('content/bncc/mappings/coverage-2018.json');
  const queueCanonicalMappingVerified = queue.tasks.filter((task) => task.technicalCompleteness.canonicalMappingVerified).length;
  return {
    officialCatalogNodes: inventory.officialCoverage?.totalNodes ?? 0,
    queueTasks: queue.summary.totalTasks,
    queuePendingTasks: queue.tasks.filter((task) => task.state !== 'CONTENT_TECHNICALLY_COMPLETE').length,
    sourceVerificationRecords: sourceVerification.records?.length ?? 0,
    coverageMatrixExactSourceVerification: coverageMatrix.summary?.rowsWithExactSourceVerification ?? 0,
    canonicalMappingDatasetClaims: coverage.summary?.mapped ?? 0,
    canonicalMappingDatasetPending: coverage.summary?.canonicalGaps ?? 0,
    queueCanonicalMappingVerified,
    queueCanonicalMappingPending: queue.tasks.length - queueCanonicalMappingVerified,
    explanation: 'MAPPED is the coverage-dataset scope; queueCanonicalMappingVerified is the publication-gate scope and remains false until each task is explicitly validated and promoted.',
  };
}

function hasSafeAuthoringCandidate(task) {
  return task.evidence?.source === 'VERIFIED'
    && task.state !== 'CONTENT_TECHNICALLY_COMPLETE'
    && (
      task.officialCode === 'EF01CI01'
      || Boolean(getAuthoringProducer(task))
      || Boolean(task.evidence?.stagedPackages?.length)
    );
}

function selectNextTask(queue, state) {
  const blocked = new Set((state.blockedTasks ?? []).map((item) => item.taskId));
  const taskRecords = state.taskRecords ?? {};
  return queue.tasks.find((task) => {
    const record = taskRecords[task.taskId];
    const producer = getAuthoringProducer(task);
    const producerNeedsExecution = task.state === 'CONTENT_TECHNICALLY_COMPLETE'
      && producer?.executionRequired === true
      && record?.lastAction !== 'CONTENT_PACKAGE_CREATED';
    return hasSafeAuthoringCandidate(task)
      || producerNeedsExecution
      ? !blocked.has(task.taskId)
        && (!['CONTENT_PARTIAL', 'BLOCKED_REVIEW', 'AWAITING_CONTENT_AUTHORING'].includes(record?.status)
          || Boolean(producer)
          || Boolean(task.evidence?.stagedPackages?.length))
      : false;
  }) ?? null;
}

function validateExistingPackage(task, stagedPackage) {
  const errors = [];
  if (stagedPackage.sourceContext?.officialCode !== task.officialCode) errors.push('SOURCE_CONTEXT_CODE_MISMATCH');
  if (stagedPackage.sourceContext?.relation !== 'AUTHORING_CONTEXT_ONLY') errors.push('RELATION_NOT_AUTHORING_CONTEXT_ONLY');
  if (stagedPackage.officialMappingStatus !== 'NOT_CLAIMED') errors.push('MAPPING_CLAIMED');
  if (!['STAGING', 'STAGING_INACTIVE'].includes(stagedPackage.publicationStatus)) errors.push('PUBLICATION_NOT_STAGING');
  if (stagedPackage.pedagogicalReviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') errors.push('PEDAGOGICAL_REVIEW_NOT_PENDING');
  if (!stagedPackage.lesson?.title || !stagedPackage.lesson?.objective || !(stagedPackage.lesson?.explanation || stagedPackage.lesson?.progressiveExplanation)) errors.push('LESSON_CORE_MISSING');
  if ((stagedPackage.lesson?.authenticActivities?.length ?? 0) < task.requirements.activities) errors.push(`ACTIVITIES_BELOW_MINIMUM:${stagedPackage.lesson?.authenticActivities?.length ?? 0}<${task.requirements.activities}`);
  if (!Array.isArray(stagedPackage.questions) || stagedPackage.questions.length < task.requirements.questions) errors.push(`QUESTIONS_BELOW_MINIMUM:${stagedPackage.questions?.length ?? 0}<${task.requirements.questions}`);
  const ids = new Set();
  const contexts = new Set();
  for (const question of stagedPackage.questions ?? []) {
    if (!question.id || ids.has(question.id)) errors.push(`QUESTION_ID_DUPLICATE:${question.id ?? 'MISSING'}`);
    ids.add(question.id);
    if (!question.contextFamily || contexts.has(question.contextFamily)) errors.push(`QUESTION_CONTEXT_DUPLICATE:${question.contextFamily ?? 'MISSING'}`);
    contexts.add(question.contextFamily);
    if (!Array.isArray(question.options) || question.options.length !== 4 || !question.options.includes(question.correctAnswer)) errors.push(`QUESTION_OPTIONS_INVALID:${question.id ?? 'MISSING'}`);
    if (!question.statement || !question.explanation || !question.hint || !question.errorFocus) errors.push(`QUESTION_FEEDBACK_MISSING:${question.id ?? 'MISSING'}`);
  }
  return { valid: errors.length === 0, errors, questionCount: stagedPackage.questions?.length ?? 0, contextCount: contexts.size };
}

function writeProducerPackage(task, producer) {
  const pack = producer.build();
  const producerValidation = producer.validate(pack);
  if (!producerValidation.valid) throw new Error(`${producer.id.toUpperCase()}_PACK_INVALID:${producerValidation.errors.join(',')}`);
  const validation = validateExistingPackage(task, pack);
  if (!validation.valid) throw new Error(`${producer.id.toUpperCase()}_AUTOPILOT_VALIDATION_FAILED:${validation.errors.join(',')}`);
  writeJsonAtomic(producer.path, pack);
  return { kind: 'CONTENT_PACKAGE_CREATED', path: producer.path, validation: { ...validation, producer: producerValidation } };
}

function writeEf01Ci01Activity() {
  const relativePath = 'content/adaptive/tec-escola-core-v5/science-materials-conscious-use-fi-v8.json';
  const pack = readJson(relativePath);
  pack.lesson = pack.lesson ?? {};
  pack.lesson.authenticActivities = [
    {
      id: 'materials-origin-use-destination-map',
      title: 'Mapa de material, uso e destino',
      instructions: 'Em pequenos grupos, escolha dois objetos seguros do cotidiano escolar. Observe de que material parecem ser feitos, compare uma propriedade ligada ao uso e consulte um adulto sobre a orientação local para reutilização ou descarte. Registre a comparação por desenho, tabela, fala gravada sem dados pessoais ou texto curto.',
      evidence: 'Registro multimodal com dois objetos, uma propriedade observada, uma hipótese sobre a origem, uma decisão de redução, reutilização, reparo ou encaminhamento e uma conclusão limitada ao contexto.',
      privacyGuard: 'Não fotografar pessoas, documentos ou resíduos perigosos; não registrar nomes, endereços ou informações de coleta individual.',
      rubric: [
        { criterion: 'Comparação com critério', emerging: 'Lista objetos sem indicar uma propriedade.', developing: 'Relaciona uma propriedade ao uso com apoio.', proficient: 'Compara propriedades relevantes e explica o vínculo com a função.' },
        { criterion: 'Origem e destino', emerging: 'Trata o objeto pronto como se fosse retirado diretamente da natureza.', developing: 'Distingue origem e destino com orientação.', proficient: 'Registra origem como hipótese contextual e consulta regras locais antes de decidir.' },
        { criterion: 'Consumo consciente e segurança', emerging: 'Propõe descarte ou reutilização sem verificar segurança.', developing: 'Escolhe uma alternativa segura após mediação.', proficient: 'Considera reduzir, reutilizar, reparar e encaminhar conforme condição do objeto e orientação local.' },
      ],
    },
  ];
  writeJsonAtomic(relativePath, pack);
  const validation = validateExistingPackage({
    officialCode: 'EF01CI01',
    requirements: { activities: 1, questions: 40 },
  }, pack);
  if (!validation.valid) throw new Error(`EF01CI01_ACTIVITY_PACK_INVALID:${validation.errors.join(',')}`);
  return { kind: 'AUTHENTIC_ACTIVITY_CREATED', path: relativePath, validation };
}

function writeAuthoringBrief(task) {
  const source = readJson('content/bncc/authoring/source-verification-v2.json').records.find((record) => record.officialCode === task.officialCode);
  const brief = {
    schemaVersion: 'tec-escola.bncc.authoring-context-brief.v1',
    taskId: task.taskId,
    officialCode: task.officialCode,
    stage: task.stage,
    componentCode: task.componentCode,
    relation: 'AUTHORING_CONTEXT_ONLY',
    sourceStatus: task.evidence.source,
    officialMappingStatus: 'NOT_CLAIMED',
    publicationStatus: 'STAGING_INACTIVE',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    sourceEvidence: source ? {
      verificationId: source.verificationId,
      descriptor: source.descriptor,
      officialSource: source.officialSource,
      technicalVerificationStatus: source.technicalVerificationStatus,
      evidenceCheckedAt: source.evidenceCheckedAt,
    } : null,
    requirements: task.requirements,
    missingRequirements: ['AUTHORING_PACKAGE', 'LESSON', 'WORKED_EXAMPLES', 'GUIDED_ACTIVITIES', 'ASSESSMENTS', 'REMEDIATION', 'PEDAGOGICAL_REVIEW'],
    nextAction: task.nextAction,
    checkpointHash: taskHash(task),
  };
  const relativePath = `content/bncc/authoring/tasks/${task.taskId}.json`;
  if (fs.existsSync(absolute(relativePath))) {
    try {
      const existing = readJson(relativePath);
      if (existing.taskId === task.taskId && existing.officialCode === task.officialCode && existing.relation === 'AUTHORING_CONTEXT_ONLY') {
        return { kind: 'AUTHORING_CONTEXT_BRIEF_ALREADY_PRESENT', path: relativePath, created: false, validation: { valid: true, errors: [] } };
      }
    } catch {
      // An invalid historical brief is replaced below with the canonical context-only record.
    }
  }
  fs.mkdirSync(path.dirname(absolute(relativePath)), { recursive: true });
  writeJsonAtomic(relativePath, brief);
  return { kind: 'AUTHORING_CONTEXT_BRIEF_CREATED', path: relativePath, created: true, validation: { valid: true, errors: [] } };
}

function processTask(task, state, options) {
  const record = state.taskRecords[task.taskId] ?? { taskId: task.taskId, attempts: 0 };
  record.attempts = (record.attempts ?? 0) + 1;
  record.lastStartedAt = now();
  state.taskRecords[task.taskId] = record;
  state.currentTask = task.taskId;
  saveState(state);

  let outcome;
  try {
    if (task.officialCode === 'EF01CI01') {
      outcome = writeEf01Ci01Activity();
    } else if (getAuthoringProducer(task)) {
      outcome = writeProducerPackage(task, getAuthoringProducer(task));
    } else if (task.evidence.stagedPackages?.length) {
      const packagePath = task.evidence.stagedPackages[0].file;
      const packageData = readJson(packagePath);
      const validation = validateExistingPackage(task, packageData);
      outcome = { kind: validation.valid ? 'EXISTING_PACKAGE_VALIDATED' : 'EXISTING_PACKAGE_REVIEW_BLOCKED', path: packagePath, validation };
      if (!validation.valid) throw new Error(`EXISTING_PACKAGE_REVIEW_BLOCKED:${validation.errors.join(',')}`);
    } else {
      outcome = writeAuthoringBrief(task);
    }
  } catch (error) {
    record.status = 'FAILED_RECOVERABLE';
    record.lastError = error instanceof Error ? error.message : String(error);
    record.updatedAt = now();
    state.metrics.failedTasks += 1;
    if (record.attempts >= options.retryLimit) {
      state.blockedTasks.push({ taskId: task.taskId, reason: record.lastError, attempts: record.attempts, at: now() });
      state.metrics.blockedTasks += 1;
    }
    record.checkpointHash = hash({ taskId: task.taskId, status: record.status, error: record.lastError, attempts: record.attempts });
    state.checkpoints.push({ taskId: task.taskId, status: record.status, checkpointHash: record.checkpointHash, at: now() });
    saveState(state);
    appendLog({ event: 'task_failed', taskId: task.taskId, status: record.status, error: record.lastError, attempts: record.attempts });
    return { status: record.status, taskId: task.taskId, error: record.lastError };
  }

  const refreshedQueue = refreshQueue();
  const refreshedTask = refreshedQueue.tasks.find((candidate) => candidate.taskId === task.taskId);
  const technicallyComplete = refreshedTask?.state === 'CONTENT_TECHNICALLY_COMPLETE';
  record.status = technicallyComplete
    ? 'CONTENT_TECHNICALLY_COMPLETE'
    : (['AUTHORING_CONTEXT_BRIEF_CREATED', 'AUTHORING_CONTEXT_BRIEF_ALREADY_PRESENT'].includes(outcome.kind)
      ? 'AWAITING_CONTENT_AUTHORING'
      : (outcome.kind === 'EXISTING_PACKAGE_REVIEW_BLOCKED' ? 'BLOCKED_REVIEW' : 'CONTENT_PARTIAL'));
  record.lastAction = outcome.kind;
  record.lastPath = outcome.path ?? null;
  record.lastValidation = outcome.validation ?? null;
  record.briefConverted = Boolean(outcome.briefConverted);
  record.updatedAt = now();
  record.checkpointHash = hash({ taskId: task.taskId, status: record.status, queueHash: refreshedQueue.queueHash, outcome });
  if (record.status === 'BLOCKED_REVIEW') state.blockedTasks.push({ taskId: task.taskId, reason: 'REVIEW_REQUIRED', attempts: record.attempts, at: now() });
  state.queueHash = refreshedQueue.queueHash;
  state.lastCompletedTask = record.status === 'CONTENT_TECHNICALLY_COMPLETE' ? task.taskId : state.lastCompletedTask;
  state.nextTask = selectNextTask(refreshedQueue, state)?.taskId ?? null;
  state.currentTask = null;
  reconcileStateWithQueue(refreshedQueue, state);
  state.checkpoints.push({ taskId: task.taskId, status: record.status, checkpointHash: record.checkpointHash, at: now(), queueHash: refreshedQueue.queueHash });
  saveState(state);
  appendLog({ event: 'task_processed', taskId: task.taskId, status: record.status, action: outcome.kind, queueHash: refreshedQueue.queueHash });
  return { status: record.status, taskId: task.taskId, action: outcome.kind, nextTask: state.nextTask };
}

function run(mode, options) {
  if (mode === 'resume') {
    try { fs.unlinkSync(absolute(PATHS.stop)); } catch { /* no pending stop request */ }
  }
  const release = acquireLock();
  const startedAt = Date.now();
  const initialHead = gitHead();
  let state = null;
  try {
    let queue = refreshQueue();
    state = loadState(queue);
    state.runStatus = RUN_STATUS.RUNNING;
    saveState(state);
    let cycles = 0;
    let tasksProcessed = 0;
    while (cycles < options.maxCycles && tasksProcessed < options.maxTasks && Date.now() - startedAt < options.maxSeconds * 1000) {
      if (fs.existsSync(absolute(PATHS.stop))) {
        state.runStatus = RUN_STATUS.USER_STOPPED;
        state.currentTask = null;
        saveState(state);
        appendLog({ event: 'run_stopped', reason: 'USER_STOP_FLAG' });
        break;
      }
      if (gitHead() !== initialHead) throw new Error('GIT_HEAD_CHANGED_DURING_AUTOPILOT');
      queue = refreshQueue();
      state.metrics.cycles += 1;
      cycles += 1;
      const task = selectNextTask(queue, state);
      if (!task) {
        state.runStatus = determineRunStatus({ queue, state, cycles, tasksProcessed, options, elapsedMs: Date.now() - startedAt });
        state.nextTask = null;
        saveState(state);
        appendLog({ event: 'run_stopped', reason: state.runStatus });
        break;
      }
      const result = processTask(task, state, options);
      tasksProcessed += 1;
      if (result.status === 'FAILED_RECOVERABLE' && (state.taskRecords[task.taskId]?.attempts ?? 0) < options.retryLimit) continue;
      if (mode === 'once') break;
    }
    if (state.runStatus === RUN_STATUS.RUNNING) {
      queue = refreshQueue();
      reconcileStateWithQueue(queue, state);
      state.runStatus = determineRunStatus({ queue, state, cycles, tasksProcessed, options, elapsedMs: Date.now() - startedAt });
    }
    state.currentTask = null;
    saveState(state);
    return { mode, cycles, tasksProcessed, summary: queueSummary(refreshQueue(), state) };
  } catch (error) {
    if (state) {
      state.runStatus = RUN_STATUS.SYSTEM_UNRECOVERABLE;
      state.currentTask = null;
      state.lastError = error instanceof Error ? error.message : String(error);
      saveState(state);
      appendLog({ event: 'run_failed', reason: RUN_STATUS.SYSTEM_UNRECOVERABLE, error: state.lastError });
    }
    throw error;
  } finally {
    release();
  }
}

function status() {
  const queue = readJson(PATHS.queue);
  const state = loadState(queue);
  saveState(state);
  console.log(JSON.stringify(queueSummary(queue, state), null, 2));
}

function stop() {
  const stopPath = absolute(PATHS.stop);
  fs.mkdirSync(path.dirname(stopPath), { recursive: true });
  fs.writeFileSync(stopPath, `${JSON.stringify({ requestedAt: now(), pid: process.pid })}\n`);
  console.log('BNCC_AUTOPILOT_STOP_REQUESTED=YES');
}

function main() {
  const args = process.argv.slice(2);
  const mode = args.find((arg) => ['--status', '--once', '--loop', '--resume', '--stop'].includes(arg)) ?? '--status';
  const options = parseOptions(args);
  if (mode === '--status') return status();
  if (mode === '--stop') return stop();
  if (!['--once', '--loop', '--resume'].includes(mode)) throw new Error('USAGE: --status|--once|--loop|--resume|--stop');
  if (mode === '--once') {
    options.maxCycles = 1;
    options.maxTasks = 1;
  }
  const result = run(mode.slice(2), options);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export { createInitialState, determineRunStatus, parseOptions, queueSummary, reconcileMetrics, selectNextTask, validateExistingPackage };
