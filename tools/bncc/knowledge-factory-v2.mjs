import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildKnowledgeFactory, hashSourceContent, loadKnowledgeFactoryInputs } from './knowledge-factory.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BATCH_PATH = 'content/adaptive/tec-escola-core-v9/knowledge-expansion-batch-v2.json';
const GRAPH_PATH = 'content/bncc/authoring/knowledge-graph-expansion-v2.json';
const UNITS_PATH = 'content/bncc/authoring/curriculum-unit-expansion-v2.json';
const SQL_PATH = 'content/bncc/authoring/knowledge-factory-v2-staging.sql';
const REPORT_PATH = 'content/bncc/authoring/knowledge-factory-inventory-v2.json';
const PURPOSES = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];
const SOURCE_TYPES = new Set(['PREREQUISITE', 'RELATED', 'TRANSFER', 'SUPPORTING', 'PROGRESSION', 'SAME_DOMAIN']);
const STAGES = {
  FUNDAMENTAL_I: [1, 5],
  FUNDAMENTAL_II: [6, 9],
  ENSINO_MEDIO: [1, 3],
};

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

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalized(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function similarity(left, right) {
  const a = new Set(normalized(left).split(' ').filter(Boolean));
  const b = new Set(normalized(right).split(' ').filter(Boolean));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / (a.size + b.size - intersection);
}

function sql(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

function jsonSql(value) {
  return `${sql(JSON.stringify(value))}::jsonb`;
}

function textArraySql(values) {
  return `ARRAY[${values.map(sql).join(', ')}]::text[]`;
}

export function orderQuestionOptions(question, index) {
  const options = question.options ?? [];
  if (!options.length) return [];
  const offset = index % options.length;
  return [...options.slice(offset), ...options.slice(0, offset)];
}

function sourceCatalog(inputs) {
  return new Map(inputs.catalog.nodes.map((node) => [node.code, node]));
}

function buildNextPriorityQueues(inputs, v1, batch) {
  const selectedProposalIds = new Set(batch.skills.map((skill) => skill.sourceEvidence.proposalId));
  const clustersById = new Map(inputs.clusters.clusters.map((cluster) => [cluster.clusterId, cluster]));
  const existingCodes = new Set([...baseSkillNodes(inputs), ...inputs.v4Skills].map((node) => node.code));
  const pendingProposals = inputs.proposals.proposals
    .filter((proposal) => proposal.proposalStatus === 'NEW_SKILL_PENDING_REVIEW'
      && !selectedProposalIds.has(proposal.proposalId)
      && !existingCodes.has(proposal.canonicalCode))
    .map((proposal) => {
      const cluster = clustersById.get(proposal.proposalId.replace('V8_PROPOSAL_', 'V8_GAP_'));
      const descriptorCount = cluster?.officialContext?.descriptorSamples?.length ?? 0;
      return {
        proposalId: proposal.proposalId,
        gapClusterId: cluster?.clusterId ?? null,
        candidateCanonicalCode: proposal.canonicalCode,
        title: proposal.title,
        subject: cluster?.subject ?? null,
        stage: cluster?.stage ?? null,
        officialCodes: proposal.officialCodes,
        evidenceScore: (cluster?.semanticObject ? 50 : 0) + (descriptorCount > 0 ? 25 : 0) + Math.min(proposal.officialCodes?.length ?? 0, 5),
        status: 'NEW_SKILL_PENDING_REVIEW',
        mappingPromoted: false,
      };
    });
  const codeCounts = new Map();
  for (const proposal of pendingProposals) codeCounts.set(proposal.candidateCanonicalCode, (codeCounts.get(proposal.candidateCanonicalCode) ?? 0) + 1);
  for (const proposal of pendingProposals) proposal.possibleCanonicalCodeCollision = codeCounts.get(proposal.candidateCanonicalCode) > 1;
  const buckets = new Map();
  for (const proposal of pendingProposals) {
    const key = `${proposal.stage}:${proposal.subject}`;
    buckets.set(key, [...(buckets.get(key) ?? []), proposal]);
  }
  const bucketKeys = [...buckets.keys()].sort((left, right) => {
    const leftScore = Math.max(...buckets.get(left).map((item) => item.evidenceScore));
    const rightScore = Math.max(...buckets.get(right).map((item) => item.evidenceScore));
    return rightScore - leftScore || left.localeCompare(right);
  });
  for (const key of bucketKeys) buckets.get(key).sort((left, right) => right.evidenceScore - left.evidenceScore || String(left.gapClusterId).localeCompare(String(right.gapClusterId)));
  const canonicalExpansionCandidates = [];
  const uniqueCodeBuckets = bucketKeys.filter((key) => buckets.get(key).some((item) => !item.possibleCanonicalCodeCollision));
  while (canonicalExpansionCandidates.length < 12 && uniqueCodeBuckets.some((key) => buckets.get(key).some((item) => !item.possibleCanonicalCodeCollision))) {
    for (const key of uniqueCodeBuckets) {
      const candidates = buckets.get(key);
      const index = candidates.findIndex((item) => !item.possibleCanonicalCodeCollision);
      if (index < 0) continue;
      const [candidate] = candidates.splice(index, 1);
      const { evidenceScore, ...output } = candidate;
      canonicalExpansionCandidates.push({ ...output, priorityScore: evidenceScore });
      if (canonicalExpansionCandidates.length === 12) break;
    }
  }

  return {
    existingSkillContentGaps: v1.priorityQueue.map((skill) => ({ ...skill, status: 'CONTENT_GAP_REVIEW_REQUIRED' })),
    canonicalExpansionCandidates: {
      source: 'V8 clusters + proposals; proposals are not promoted mappings',
      selectionPolicy: 'ROUND_ROBIN_SUBJECT_AND_STAGE_WITHIN_EVIDENCE_SCORE_BANDS',
      totalPendingCandidates: inputs.proposals.proposals.filter((proposal) => proposal.proposalStatus === 'NEW_SKILL_PENDING_REVIEW').length,
      deferredForCandidateCodeCollision: pendingProposals.filter((proposal) => proposal.possibleCanonicalCodeCollision).length,
      nextBatch: canonicalExpansionCandidates,
    },
  };
}

function baseSkillNodes(inputs) {
  return inputs.graph.nodes.filter((node) => ['ANCHOR', 'LEAF', 'SEED_SKILL'].includes(node.class));
}

function validateAcyclic(edges) {
  const adjacency = new Map();
  for (const [from, to] of edges) adjacency.set(from, [...(adjacency.get(from) ?? []), to]);
  const visiting = new Set();
  const visited = new Set();
  const cycles = [];
  function visit(code, pathSoFar) {
    if (visiting.has(code)) {
      cycles.push([...pathSoFar, code]);
      return;
    }
    if (visited.has(code)) return;
    visiting.add(code);
    for (const next of adjacency.get(code) ?? []) visit(next, [...pathSoFar, code]);
    visiting.delete(code);
    visited.add(code);
  }
  for (const code of adjacency.keys()) visit(code, []);
  return cycles;
}

export function validateKnowledgeExpansionBatch(batch, inputs) {
  const errors = [];
  const existingNodes = baseSkillNodes(inputs);
  const existingByCode = new Map([...existingNodes, ...inputs.v4Skills].map((node) => [node.code, node]));
  const officialByCode = sourceCatalog(inputs);
  const clustersById = new Map(inputs.clusters.clusters.map((cluster) => [cluster.clusterId, cluster]));
  const proposalsById = new Map(inputs.proposals.proposals.map((proposal) => [proposal.proposalId, proposal]));
  const batchByCode = new Map();
  const questionIds = new Set();
  const questionStems = new Set();
  const unitDefinitions = new Map();

  if (batch.schemaVersion !== 'tec-escola.bncc.knowledge-expansion-batch.v2') errors.push('V2_SCHEMA_VERSION_INVALID');
  if (!batch.packVersion?.trim()) errors.push('V2_PACK_VERSION_MISSING');
  if (batch.publicationStatus !== 'STAGING') errors.push('V2_BATCH_MUST_REMAIN_STAGING');
  if (batch.mappingStatus !== 'MAPPING_PENDING') errors.push('V2_MAPPING_MUST_REMAIN_PENDING');
  if (batch.pedagogicalReviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') errors.push('V2_REVIEW_MUST_REMAIN_PENDING');
  if (batch.bnccAlignment !== 'NOT_CLAIMED') errors.push('V2_BNCC_ALIGNMENT_MUST_NOT_BE_CLAIMED');
  if (!Array.isArray(batch.skills) || batch.skills.length < 3) errors.push('V2_BATCH_REQUIRES_AT_LEAST_THREE_SKILLS');

  for (const skill of batch.skills ?? []) {
    if (batchByCode.has(skill.skillCode)) errors.push(`DUPLICATE_V2_SKILL:${skill.skillCode}`);
    batchByCode.set(skill.skillCode, skill);
    if (existingByCode.has(skill.skillCode)) errors.push(`SKILL_ALREADY_EXISTS:${skill.skillCode}`);
  }

  for (const skill of batch.skills ?? []) {
    if (!/^[A-Z][A-Z0-9_]{4,79}$/.test(skill.skillCode ?? '')) errors.push(`SKILL_CODE_INVALID:${skill.skillCode}`);
    if (!skill.subjectCode || !skill.domain || !skill.title || !skill.description || !skill.learningObjective || !skill.observableCapability) {
      errors.push(`SKILL_DEFINITION_INCOMPLETE:${skill.skillCode}`);
    }
    const [minGrade, maxGrade] = STAGES[skill.stage] ?? [];
    if (minGrade === undefined || skill.gradeFrom < minGrade || skill.gradeTo > maxGrade || skill.gradeFrom > skill.gradeTo) {
      errors.push(`SKILL_STAGE_GRADE_INVALID:${skill.skillCode}`);
    }
    if (skill.mappingStatus !== 'MAPPING_PENDING' || skill.pedagogicalReviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING'
      || skill.publicationStatus !== 'STAGING' || skill.contentReadiness !== 'ADAPTIVE_READY') {
      errors.push(`SKILL_STATUS_INVALID:${skill.skillCode}`);
    }
    if (skill.parentSkillCode) {
      const parent = existingByCode.get(skill.parentSkillCode) ?? batchByCode.get(skill.parentSkillCode);
      if (!parent) errors.push(`SKILL_PARENT_UNKNOWN:${skill.skillCode}:${skill.parentSkillCode}`);
      else if (parent.subjectCode !== skill.subjectCode) errors.push(`SKILL_PARENT_SUBJECT_MISMATCH:${skill.skillCode}`);
    }
    const evidence = skill.sourceEvidence ?? {};
    const official = officialByCode.get(evidence.candidateOfficialReference);
    if (!official) errors.push(`SOURCE_REFERENCE_UNKNOWN:${skill.skillCode}`);
    else if (official.officialSource.id !== evidence.sourceId
      || official.officialSource.documentVersion !== evidence.documentVersion
      || official.officialSource.url !== evidence.url
      || official.officialSource.page !== evidence.page) errors.push(`SOURCE_EVIDENCE_MISMATCH:${skill.skillCode}`);
    if (official?.stage === 'ENSINO_MEDIO' && skill.stage !== 'ENSINO_MEDIO'
      || official?.stage === 'ENSINO_FUNDAMENTAL' && !['FUNDAMENTAL_I', 'FUNDAMENTAL_II'].includes(skill.stage)) {
      errors.push(`SOURCE_STAGE_MISMATCH:${skill.skillCode}`);
    }
    if (evidence.mappingClaim !== 'NONE' || evidence.reviewStatus !== 'MAPPING_PENDING') errors.push(`SOURCE_EVIDENCE_CLAIMS_MAPPING:${skill.skillCode}`);
    if (!evidence.evidenceSummary?.trim()) errors.push(`SOURCE_EVIDENCE_SUMMARY_MISSING:${skill.skillCode}`);
    const gapCluster = clustersById.get(evidence.gapClusterId);
    const proposal = proposalsById.get(evidence.proposalId);
    if (!gapCluster || !gapCluster.officialCodes.includes(evidence.candidateOfficialReference)) errors.push(`V8_GAP_CLUSTER_REFERENCE_INVALID:${skill.skillCode}`);
    if (!proposal || !proposal.officialCodes.includes(evidence.candidateOfficialReference)
      || proposal.proposalStatus !== 'NEW_SKILL_PENDING_REVIEW'
      || evidence.proposalStatus !== proposal.proposalStatus) errors.push(`V8_PROPOSAL_REFERENCE_INVALID:${skill.skillCode}`);
    if (gapCluster && (gapCluster.component !== evidence.officialComponentCode || evidence.candidateSubjectCode !== skill.subjectCode)) {
      errors.push(`V8_SOURCE_SUBJECT_OR_COMPONENT_MISMATCH:${skill.skillCode}`);
    }

    for (const existing of existingNodes.filter((node) => node.subjectCode === skill.subjectCode && ['LEAF', 'SEED_SKILL'].includes(node.class))) {
      if (normalized(existing.title) === normalized(skill.title)) errors.push(`DUPLICATE_SKILL_TITLE:${skill.skillCode}:${existing.code}`);
      if (similarity(existing.title, skill.title) >= 0.82) errors.push(`POSSIBLE_DUPLICATE_SKILL_TITLE:${skill.skillCode}:${existing.code}`);
    }
    for (const existing of inputs.v4Skills.filter((node) => node.subjectCode === skill.subjectCode)) {
      if (normalized(existing.objective) && normalized(existing.objective) === normalized(skill.learningObjective)) errors.push(`DUPLICATE_SKILL_OBJECTIVE:${skill.skillCode}:${existing.code}`);
    }
    for (const other of batch.skills ?? []) {
      if (other.skillCode === skill.skillCode || other.subjectCode !== skill.subjectCode) continue;
      if (normalized(other.title) === normalized(skill.title) || similarity(other.title, skill.title) >= 0.82) {
        errors.push(`POSSIBLE_DUPLICATE_BATCH_SKILL_TITLE:${skill.skillCode}:${other.skillCode}`);
      }
      if (normalized(other.learningObjective) && normalized(other.learningObjective) === normalized(skill.learningObjective)) {
        errors.push(`DUPLICATE_BATCH_SKILL_OBJECTIVE:${skill.skillCode}:${other.skillCode}`);
      }
    }

    const lesson = skill.lesson ?? {};
    if (!lesson.title || !lesson.objective || (lesson.priorKnowledge?.length ?? 0) < 2 || (lesson.keyConcepts?.length ?? 0) < 3
      || (lesson.progressiveExplanation?.length ?? 0) < 3 || (lesson.commonErrors?.length ?? 0) < 3
      || (lesson.remediations?.length ?? 0) < 2 || String(lesson.workedExample ?? '').length < 240
      || !lesson.everydayApplication?.trim() || !lesson.summary?.trim() || !lesson.practiceGuidance?.trim()) {
      errors.push(`LESSON_STRUCTURE_INCOMPLETE:${skill.skillCode}`);
    }
    if (new Set((lesson.remediations ?? []).map((item) => item.id)).size !== (lesson.remediations ?? []).length
      || (lesson.remediations ?? []).some((item) => !item.trigger?.trim() || !item.explanation?.trim() || !item.workedExample?.trim() || !item.selfCheck?.trim())) {
      errors.push(`LESSON_REMEDIATION_INCOMPLETE:${skill.skillCode}`);
    }

    const questions = skill.questions ?? [];
    const purposes = Object.fromEntries(PURPOSES.map((purpose) => [purpose, 0]));
    const contexts = new Set();
    const answerPositions = [0, 0, 0, 0];
    for (const [questionIndex, question] of questions.entries()) {
      if (questionIds.has(question.id)) errors.push(`DUPLICATE_QUESTION_ID:${question.id}`);
      questionIds.add(question.id);
      if (!question.id || question.skillCode && question.skillCode !== skill.skillCode) errors.push(`QUESTION_SKILL_MISMATCH:${question.id}`);
      if (!PURPOSES.includes(question.purpose)) errors.push(`QUESTION_PURPOSE_INVALID:${question.id}`);
      else purposes[question.purpose] += 1;
      if (!question.contextFamily?.trim() || !question.cognitiveProcess?.trim()) errors.push(`QUESTION_CLASSIFICATION_MISSING:${question.id}`);
      contexts.add(question.contextFamily);
      const stem = normalized(question.statement);
      if (!stem || questionStems.has(stem)) errors.push(`DUPLICATE_OR_EMPTY_QUESTION_STEM:${question.id}`);
      questionStems.add(stem);
      if (!Array.isArray(question.options) || question.options.length !== 4 || new Set(question.options.map(normalized)).size !== 4
        || !question.options.includes(question.correctAnswer)) errors.push(`QUESTION_OPTIONS_INVALID:${question.id}`);
      else answerPositions[orderQuestionOptions(question, questionIndex).indexOf(question.correctAnswer)] += 1;
      if (!question.explanation?.trim() || !question.errorFocus?.trim() || !question.remediationHint?.trim()) errors.push(`QUESTION_FEEDBACK_INCOMPLETE:${question.id}`);
    }
    if (questions.length !== 12) errors.push(`QUESTION_COUNT_MUST_BE_12:${skill.skillCode}:${questions.length}`);
    for (const purpose of PURPOSES) {
      const minimum = purpose === 'PRACTICE' ? 4 : 2;
      if (purposes[purpose] < minimum) errors.push(`PURPOSE_COVERAGE:${skill.skillCode}:${purpose}:${purposes[purpose]}`);
    }
    if (contexts.size < 8) errors.push(`QUESTION_CONTEXT_DIVERSITY:${skill.skillCode}:${contexts.size}`);
    if (Math.max(...answerPositions) > 4) errors.push(`QUESTION_ANSWER_POSITION_BIAS:${skill.skillCode}:${answerPositions.join(',')}`);

    const unit = skill.unit ?? {};
    if (unit.mode === 'CREATE') {
      const definition = stableJson({ title: unit.title, description: unit.description, subjectCode: unit.subjectCode, stage: unit.stage, gradeFrom: unit.gradeFrom, gradeTo: unit.gradeTo, domain: unit.domain, learningGoals: unit.learningGoals, prerequisiteUnitIds: unit.prerequisiteUnitIds });
      if (unitDefinitions.has(unit.unitId) && unitDefinitions.get(unit.unitId) !== definition) errors.push(`INCONSISTENT_NEW_UNIT_DEFINITION:${unit.unitId}`);
      unitDefinitions.set(unit.unitId, definition);
      if (unit.subjectCode !== skill.subjectCode || unit.stage !== skill.stage || unit.domain !== skill.domain
        || unit.gradeFrom !== skill.gradeFrom || unit.gradeTo !== skill.gradeTo) errors.push(`NEW_UNIT_SCOPE_MISMATCH:${unit.unitId}`);
      if (inputs.v4Units.units.some((candidate) => candidate.subjectCode === unit.subjectCode && candidate.stage === unit.stage
        && candidate.domain === unit.domain && candidate.gradeFrom <= unit.gradeTo && candidate.gradeTo >= unit.gradeFrom)) {
        errors.push(`NEW_UNIT_OVERLAPS_EXISTING:${unit.unitId}`);
      }
      if (!unit.title || !unit.description || (unit.learningGoals?.length ?? 0) < 2 || unit.reviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING') {
        errors.push(`NEW_UNIT_INCOMPLETE:${unit.unitId}`);
      }
    } else if (unit.mode === 'EXTEND_EXISTING') {
      const existingUnit = inputs.v4Units.units.find((candidate) => candidate.unitId === unit.unitId);
      if (!existingUnit) errors.push(`UNIT_REUSE_TARGET_UNKNOWN:${unit.unitId}`);
      else if (existingUnit.subjectCode !== skill.subjectCode || existingUnit.stage !== skill.stage || existingUnit.domain !== unit.domain
        || existingUnit.gradeFrom > skill.gradeFrom || existingUnit.gradeTo < skill.gradeTo) {
        errors.push(`UNIT_REUSE_SCOPE_MISMATCH:${unit.unitId}`);
      }
      if (!unit.reuseRationale?.trim()) errors.push(`UNIT_REUSE_RATIONALE_MISSING:${unit.unitId}`);
    } else errors.push(`UNIT_MODE_INVALID:${skill.skillCode}`);

    for (const relationship of skill.relationships ?? []) {
      if (relationship.from !== skill.skillCode || !SOURCE_TYPES.has(relationship.type) || !relationship.rationale?.trim()) {
        errors.push(`RELATIONSHIP_INVALID:${skill.skillCode}`);
      }
      const target = existingByCode.get(relationship.to) ?? batchByCode.get(relationship.to);
      if (!target) errors.push(`RELATIONSHIP_TARGET_UNKNOWN:${skill.skillCode}:${relationship.to}`);
    }
  }

  if (new Set((batch.skills ?? []).map((skill) => skill.subjectCode)).size < 3) errors.push('V2_BATCH_MUST_CROSS_THREE_SUBJECTS');
  if (new Set((batch.skills ?? []).map((skill) => skill.stage)).size < 2) errors.push('V2_BATCH_MUST_CROSS_TWO_STAGES');

  const allCodes = new Set([...existingByCode.keys(), ...batchByCode.keys()]);
  const prereqEdges = [
    ...(inputs.relationships.prerequisites ?? []).map(([skill, prerequisite]) => [skill, prerequisite]),
    ...(batch.skills ?? []).flatMap((skill) => skill.relationships.filter((edge) => edge.type === 'PREREQUISITE').map((edge) => [edge.from, edge.to])),
  ];
  for (const [from, to] of prereqEdges) if (!allCodes.has(from) || !allCodes.has(to)) errors.push(`PREREQUISITE_REFERENCE_UNKNOWN:${from}:${to}`);
  for (const cycle of validateAcyclic(prereqEdges)) errors.push(`PREREQUISITE_CYCLE:${cycle.join('>')}`);

  return [...new Set(errors)];
}

function buildGraphExpansion(batch, inputs) {
  const nodes = batch.skills.map((skill) => ({
    code: skill.skillCode,
    class: 'LEAF',
    subjectCode: skill.subjectCode,
    subjectName: inputs.registry.subjects.find((subject) => subject.code === skill.subjectCode)?.name ?? skill.subjectCode,
    parent: skill.parentSkillCode,
    title: skill.title,
    objective: skill.learningObjective,
    observableCapability: skill.observableCapability,
    domain: skill.domain,
    stage: skill.stage,
    gradeFrom: skill.gradeFrom,
    gradeTo: skill.gradeTo,
    contentReadiness: skill.contentReadiness,
    mappingStatus: skill.mappingStatus,
    pedagogicalReviewStatus: skill.pedagogicalReviewStatus,
    publicationStatus: skill.publicationStatus,
    sourceEvidence: skill.sourceEvidence,
    bnccAlignment: 'NOT_CLAIMED',
  }));
  const hierarchyEdges = batch.skills.map((skill) => ({ parent: skill.parentSkillCode, child: skill.skillCode }));
  const semanticRelationships = batch.skills.flatMap((skill) => skill.relationships ?? []);
  const output = {
    schemaVersion: 'tec-escola.bncc.knowledge-graph-expansion.v2',
    baseGraphHash: inputs.graph.graphHash,
    packVersion: batch.packVersion,
    graphStatus: 'STAGING_NOT_BNCC_PROMOTED',
    summary: { baseCanonicalSkills: inputs.graph.summary.targetableSkills, newCanonicalSkills: nodes.length, totalCanonicalSkills: inputs.graph.summary.targetableSkills + nodes.length },
    nodes,
    hierarchyEdges,
    semanticRelationships,
    statusContract: { mappingStatus: 'MAPPING_PENDING', pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING', publicationStatus: 'STAGING', studentEligible: false },
  };
  return { ...output, expansionHash: sha256(stableJson(output)) };
}

function buildUnitExpansion(batch, inputs) {
  const created = [];
  const extensions = [];
  for (const skill of batch.skills) {
    const unit = skill.unit;
    if (unit.mode === 'CREATE') {
      let target = created.find((item) => item.unitId === unit.unitId);
      if (!target) {
        target = {
          unitId: unit.unitId,
          title: unit.title,
          description: unit.description,
          subjectCode: unit.subjectCode,
          subjectName: inputs.registry.subjects.find((subject) => subject.code === unit.subjectCode)?.name ?? unit.subjectCode,
          domain: unit.domain,
          stage: unit.stage,
          gradeFrom: unit.gradeFrom,
          gradeTo: unit.gradeTo,
          officialCodes: [],
          canonicalSkills: [],
          learningGoals: [...unit.learningGoals],
          prerequisiteUnitIds: [...unit.prerequisiteUnitIds],
          reviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
          publicationStatus: 'STAGING',
          availability: 'NOT_AVAILABLE_TO_STUDENTS',
          bnccAlignment: 'NOT_CLAIMED',
        };
        created.push(target);
      }
      target.canonicalSkills.push(skill.skillCode);
    } else {
      let extension = extensions.find((item) => item.unitId === unit.unitId);
      if (!extension) {
        extension = {
          unitId: unit.unitId,
          title: unit.title,
          subjectCode: unit.subjectCode,
          stage: unit.stage,
          domain: unit.domain,
          reuseRationale: unit.reuseRationale,
          addCanonicalSkills: [],
          reviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
          publicationStatus: 'STAGING',
          availability: 'NOT_AVAILABLE_TO_STUDENTS',
        };
        extensions.push(extension);
      }
      extension.addCanonicalSkills.push(skill.skillCode);
    }
  }
  for (const unit of created) {
    unit.learningGoals = [...new Set(unit.learningGoals)];
    unit.canonicalSkills = [...new Set(unit.canonicalSkills)];
  }
  for (const extension of extensions) extension.addCanonicalSkills = [...new Set(extension.addCanonicalSkills)];
  const output = {
    schemaVersion: 'tec-escola.bncc.curriculum-unit-expansion.v2',
    baseUnitsHash: inputs.v4Units.unitsHash,
    packVersion: batch.packVersion,
    newUnits: created,
    existingUnitExtensions: extensions,
    summary: { newUnits: created.length, reusedExistingUnits: extensions.length, newSkillMemberships: created.reduce((sum, unit) => sum + unit.canonicalSkills.length, 0) + extensions.reduce((sum, unit) => sum + unit.addCanonicalSkills.length, 0), studentAvailableUnits: 0 },
  };
  return { ...output, expansionHash: sha256(stableJson(output)) };
}

function buildStagingSql(batch, graph, units, contentHash) {
  const lines = [
    '-- Generated by tools/bncc/knowledge-factory-v2.mjs. Review before any database use.',
    '-- STAGING ONLY: every skill, lesson, question, question set, package and grade target is inactive.',
    '-- No schema change, mapping promotion, publication, student assignment, or student-history write.',
    `-- V2_CONTENT_HASH=${contentHash}`,
    'begin;',
    `insert into public.learning_adaptive_content_packs(pack_version, canonical_hash, manifest, pedagogical_review_status, active) values (${sql(batch.packVersion)}, ${sql(contentHash)}, ${jsonSql({ schemaVersion: batch.schemaVersion, graphExpansionHash: graph.expansionHash, unitExpansionHash: units.expansionHash, skills: batch.skills.map((skill) => skill.skillCode), mapping_status: 'MAPPING_PENDING', pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING', publication_status: 'STAGING' })}, 'PEDAGOGICAL_REVIEW_PENDING', false) on conflict (pack_version) do update set canonical_hash = excluded.canonical_hash, manifest = excluded.manifest, pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING', active = false, updated_at = now();`,
    'do $v2$ declare v_catalog_id uuid; v_skill_id uuid; v_parent_id uuid; v_lesson_id uuid; v_package_id uuid; v_set_id uuid; v_question_id uuid; begin',
    "  select id into v_catalog_id from public.learning_curriculum_catalogs where code = 'TECESCOLA_CORE' and version = '1.0' limit 1;",
    "  if v_catalog_id is null then raise exception 'TECESCOLA_CORE_CATALOG_MISSING'; end if;",
  ];

  for (const skill of batch.skills) {
    const metadata = {
      content_pack: batch.packVersion,
      content_version: skill.contentVersion,
      objective: skill.learningObjective,
      observable_capability: skill.observableCapability,
      source_evidence: skill.sourceEvidence,
      mapping_status: 'MAPPING_PENDING',
      bncc_alignment: 'NOT_CLAIMED',
      pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING',
      publication_status: 'STAGING',
      mastery_targetable: false,
      content_authoring_status: 'AUTHORED_NOT_REVIEWED',
      demo_preview_only: false,
      staging_only: true,
      v2_graph_expansion_hash: graph.expansionHash,
      curriculum_unit_id: skill.unit.unitId,
      cognitive_processes: skill.cognitiveProcesses,
    };
    lines.push(`  select id into v_parent_id from public.learning_curriculum_skills where catalog_id = v_catalog_id and code = ${sql(skill.parentSkillCode)};`);
    lines.push(`  if v_parent_id is null then raise exception ${sql(`V2_PARENT_SKILL_MISSING:${skill.parentSkillCode}`)}; end if;`);
    lines.push(`  insert into public.learning_curriculum_skills(catalog_id, code, stage, grade_level, subject_area, domain, title, description, active, node_kind, content_readiness, mastery_targetable, parent_canonical_skill_id, pedagogical_review_status, bncc_alignment_status, metadata) values (v_catalog_id, ${sql(skill.skillCode)}, ${sql(skill.stage)}, ${skill.gradeFrom}, ${sql(skill.subjectCode)}, ${sql(skill.domain)}, ${sql(skill.title)}, ${sql(skill.description)}, false, 'LEAF', 'ADAPTIVE_READY', false, v_parent_id, 'PEDAGOGICAL_REVIEW_PENDING', 'CANDIDATE', ${jsonSql(metadata)}) on conflict (catalog_id, code) do update set stage = excluded.stage, grade_level = excluded.grade_level, subject_area = excluded.subject_area, domain = excluded.domain, title = excluded.title, description = excluded.description, active = false, node_kind = 'LEAF', content_readiness = 'ADAPTIVE_READY', mastery_targetable = false, parent_canonical_skill_id = excluded.parent_canonical_skill_id, pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING', bncc_alignment_status = 'CANDIDATE', metadata = excluded.metadata, updated_at = now();`);
    lines.push(`  select id into v_skill_id from public.learning_curriculum_skills where catalog_id = v_catalog_id and code = ${sql(skill.skillCode)};`);
    lines.push('  insert into public.learning_skill_hierarchy(parent_skill_id, child_skill_id) values (v_parent_id, v_skill_id) on conflict (parent_skill_id, child_skill_id) do nothing;');
    for (let grade = skill.gradeFrom; grade <= skill.gradeTo; grade += 1) {
      lines.push(`  insert into public.learning_curriculum_grade_targets(catalog_id, stage, grade_level, subject_area, canonical_skill_id, priority, sort_order, active) values (v_catalog_id, ${sql(skill.stage)}, ${grade}, ${sql(skill.subjectCode)}, v_skill_id, 0, 0, false) on conflict (catalog_id, stage, grade_level, subject_area, canonical_skill_id) do update set active = false, updated_at = now();`);
    }

    const lesson = skill.lesson;
    const lessonContent = [
      `## Objetivo\n${lesson.objective}`,
      `## Antes de começar\n${lesson.priorKnowledge.map((item) => `- ${item}`).join('\n')}`,
      `## Conceitos principais\n${lesson.keyConcepts.map((item) => `- ${item}`).join('\n')}`,
      `## Explicação passo a passo\n${lesson.progressiveExplanation.map((item, index) => `${index + 1}. ${item}`).join('\n')}`,
      `## Exemplo trabalhado\n${lesson.workedExample}`,
      `## Erros comuns\n${lesson.commonErrors.map((item) => `- ${item}`).join('\n')}`,
      `## Como retomar\n${lesson.remediations.map((item) => `### ${item.id}\n${item.explanation}\n\n${item.workedExample}\n\n**Confira:** ${item.selfCheck}`).join('\n\n')}`,
      `## Aplicação\n${lesson.everydayApplication}`,
      `## Resumo\n${lesson.summary}`,
      `## Prática\n${lesson.practiceGuidance}`,
    ].join('\n\n');
    lines.push(`  insert into public.learning_skill_lessons(canonical_skill_id, version, title, summary, content_markdown, worked_example, tips, estimated_minutes, metadata, active) values (v_skill_id, 1, ${sql(lesson.title)}, ${sql(lesson.summary)}, ${sql(lessonContent)}, ${sql(lesson.workedExample)}, ${textArraySql(lesson.remediations.map((item) => item.selfCheck))}, 10, ${jsonSql({ content_pack: batch.packVersion, content_version: skill.contentVersion, mapping_status: 'MAPPING_PENDING', pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING', publication_status: 'STAGING', objective: lesson.objective, prior_knowledge: lesson.priorKnowledge, key_concepts: lesson.keyConcepts, progressive_explanation: lesson.progressiveExplanation, common_errors: lesson.commonErrors, remediations: lesson.remediations, everyday_application: lesson.everydayApplication, practice_guidance: lesson.practiceGuidance })}, false) on conflict (canonical_skill_id, version) do update set title = excluded.title, summary = excluded.summary, content_markdown = excluded.content_markdown, worked_example = excluded.worked_example, tips = excluded.tips, estimated_minutes = excluded.estimated_minutes, metadata = excluded.metadata, active = false, updated_at = now() returning id into v_lesson_id;`);

    const packageTitle = skill.unit.mode === 'CREATE' ? skill.unit.title : `${skill.unit.title} - ${skill.title}`;
    const packageMetadata = { content_pack: batch.packVersion, content_version: skill.contentVersion, curriculum_unit_id: skill.unit.unitId, skill_code: skill.skillCode, mapping_status: 'MAPPING_PENDING', pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING', publication_status: 'STAGING' };
    lines.push(`  select id into v_package_id from public.learning_packages where visibility = 'GLOBAL' and metadata->>'content_pack' = ${sql(batch.packVersion)} and metadata->>'skill_code' = ${sql(skill.skillCode)} limit 1;`);
    lines.push(`  if v_package_id is null then insert into public.learning_packages(package_type, visibility, title, description, subject_area, active, version, metadata) values ('TECESCOLA', 'GLOBAL', ${sql(packageTitle)}, ${sql(skill.unit.mode === 'CREATE' ? skill.unit.description : skill.description)}, ${sql(skill.subjectCode)}, false, 1, ${jsonSql(packageMetadata)}) returning id into v_package_id; else update public.learning_packages set title = ${sql(packageTitle)}, description = ${sql(skill.description)}, active = false, version = 1, metadata = ${jsonSql(packageMetadata)}, updated_at = now() where id = v_package_id; end if;`);
    lines.push(`  insert into public.learning_package_steps(package_id, position, step_type, lesson_id, title, metadata) values (v_package_id, 0, 'LESSON', v_lesson_id, ${sql(lesson.title)}, ${jsonSql({ content_pack: batch.packVersion, skill_code: skill.skillCode, staging_only: true })}) on conflict (package_id, position) do update set step_type = 'LESSON', lesson_id = excluded.lesson_id, title = excluded.title, metadata = excluded.metadata;`);

    for (const purpose of PURPOSES) {
      lines.push(`  insert into public.learning_question_sets(scope, canonical_skill_id, purpose, version, active, metadata) values ('GLOBAL', v_skill_id, ${sql(purpose)}, 2, false, ${jsonSql({ content_pack: batch.packVersion, content_version: skill.contentVersion, selection_policy: 'SERVER_SELECTED_V1', publication_status: 'STAGING', pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING' })}) on conflict (canonical_skill_id, purpose, version) where scope = 'GLOBAL' do update set active = false, metadata = excluded.metadata, updated_at = now();`);
    }

    const purposePositions = Object.fromEntries(PURPOSES.map((purpose) => [purpose, 0]));
    for (const [index, question] of skill.questions.entries()) {
      const orderedOptions = orderQuestionOptions(question, index);
      const purposePosition = purposePositions[question.purpose]++;
      const questionMetadata = { content_id: question.id, content_pack: batch.packVersion, content_version: skill.contentVersion, skill_code: skill.skillCode, purpose: question.purpose, context_family: question.contextFamily, cognitive_process: question.cognitiveProcess, error_focus: question.errorFocus, remediation_hint: question.remediationHint, mapping_status: 'MAPPING_PENDING', pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING', publication_status: 'STAGING', authoring_provenance: batch.provenance };
      lines.push(`  insert into public.learning_question_bank(package_type, source_type, source_name, subject_area, domain, topic, statement, options, correct_answer, explanation, difficulty, estimated_minutes, provenance, metadata, active) select 'TECESCOLA', ${sql('TECESCOLA_KNOWLEDGE_FACTORY_V2')}, ${sql('TecEscola Knowledge Factory V2')}, ${sql(skill.subjectCode)}, ${sql(skill.domain)}, ${sql(skill.skillCode)}, ${sql(question.statement)}, ${jsonSql(orderedOptions)}, ${jsonSql(question.correctAnswer)}, ${sql(question.explanation)}, ${sql(question.difficulty)}, 3, ${sql(batch.provenance)}, ${jsonSql(questionMetadata)}, false where not exists (select 1 from public.learning_question_bank existing where existing.source_type = ${sql('TECESCOLA_KNOWLEDGE_FACTORY_V2')} and existing.metadata->>'content_id' = ${sql(question.id)}) returning id into v_question_id;`);
      lines.push(`  if v_question_id is null then select id into v_question_id from public.learning_question_bank where source_type = ${sql('TECESCOLA_KNOWLEDGE_FACTORY_V2')} and metadata->>'content_id' = ${sql(question.id)} limit 1; end if;`);
      lines.push(`  if v_question_id is null then raise exception ${sql(`V2_QUESTION_INSERT_FAILED:${question.id}`)}; end if;`);
      lines.push(`  update public.learning_question_bank set subject_area = ${sql(skill.subjectCode)}, domain = ${sql(skill.domain)}, topic = ${sql(skill.skillCode)}, statement = ${sql(question.statement)}, options = ${jsonSql(orderedOptions)}, correct_answer = ${jsonSql(question.correctAnswer)}, explanation = ${sql(question.explanation)}, difficulty = ${sql(question.difficulty)}, provenance = ${sql(batch.provenance)}, metadata = ${jsonSql(questionMetadata)}, active = false where id = v_question_id;`);
      lines.push(`  insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role) values (v_question_id, v_skill_id, 'PRIMARY') on conflict (question_bank_id, canonical_skill_id) do update set skill_role = 'PRIMARY';`);
      lines.push(`  select id into v_set_id from public.learning_question_sets where scope = 'GLOBAL' and canonical_skill_id = v_skill_id and purpose = ${sql(question.purpose)} and version = 2;`);
      lines.push(`  insert into public.learning_question_set_items(question_set_id, question_bank_id, position) values (v_set_id, v_question_id, ${purposePosition}) on conflict (question_set_id, question_bank_id) do update set position = excluded.position;`);
    }

    for (const edge of skill.relationships.filter((item) => item.type === 'PREREQUISITE' || item.type === 'RELATED' || item.type === 'TRANSFER')) {
      if (edge.type === 'PREREQUISITE') {
        lines.push(`  insert into public.learning_skill_prerequisites(skill_id, prerequisite_skill_id) select source.id, target.id from public.learning_curriculum_skills source, public.learning_curriculum_skills target where source.catalog_id = v_catalog_id and target.catalog_id = v_catalog_id and source.code = ${sql(edge.from)} and target.code = ${sql(edge.to)} on conflict (skill_id, prerequisite_skill_id) do nothing;`);
      }
      lines.push(`  insert into public.learning_skill_relationships(from_canonical_skill_id, to_canonical_skill_id, relation_type, relation_source, confidence, metadata) select source.id, target.id, ${sql(edge.type)}, 'KNOWLEDGE_FACTORY_V2', 0.75, ${jsonSql({ rationale: edge.rationale, content_pack: batch.packVersion, staging_only: true })} from public.learning_curriculum_skills source, public.learning_curriculum_skills target where source.catalog_id = v_catalog_id and target.catalog_id = v_catalog_id and source.code = ${sql(edge.from)} and target.code = ${sql(edge.to)} on conflict (from_canonical_skill_id, to_canonical_skill_id, relation_type) do update set relation_source = excluded.relation_source, confidence = excluded.confidence, metadata = excluded.metadata;`);
    }
  }
  lines.push('end $v2$;');
  lines.push('commit;');
  lines.push('');
  return lines.join('\n');
}

export function buildKnowledgeFactoryV2(batch, inputs) {
  const errors = validateKnowledgeExpansionBatch(batch, inputs);
  if (errors.length) return { errors };
  const v1 = buildKnowledgeFactory(inputs);
  const graph = buildGraphExpansion(batch, inputs);
  const units = buildUnitExpansion(batch, inputs);
  const contentHash = sha256(stableJson({ batch, baseGraphHash: inputs.graph.graphHash, baseUnitsHash: inputs.v4Units.unitsHash }));
  const sqlText = buildStagingSql(batch, graph, units, contentHash);
  const relationCounts = batch.skills.flatMap((skill) => skill.relationships ?? []).reduce((counts, relation) => {
    counts[relation.type] = (counts[relation.type] ?? 0) + 1;
    return counts;
  }, {});
  const reportBody = {
    schemaVersion: 'tec-escola.bncc.knowledge-factory-inventory.v2',
    factoryVersion: 'V2',
    foundation: { graphHash: inputs.graph.graphHash, unitsHash: inputs.v4Units.unitsHash, v1InventoryHash: v1.inventoryHash },
    hashes: { contentHash, graphExpansionHash: graph.expansionHash, unitExpansionHash: units.expansionHash, stagingSqlHash: sha256(sqlText) },
    officialCatalog: {
      nodesAccounted: v1.baseline.officialNodes,
      mappingStatuses: v1.baseline.officialMappingStatuses,
      canonicalGapNodesBefore: v1.baseline.officialMappingStatuses.CANONICAL_GAP,
      canonicalGapNodesAfter: v1.baseline.officialMappingStatuses.CANONICAL_GAP,
      officialMappingGapsBefore: v1.remainingGaps.officialMappingGaps,
      officialMappingGapsAfter: v1.remainingGaps.officialMappingGaps,
      humanReviewBlocked: v1.baseline.officialMappingStatuses.HUMAN_REVIEW_BLOCKED,
      hierarchyOnly: v1.baseline.officialMappingStatuses.HIERARCHY_ONLY,
      officialMappingGapsResolved: 0,
      officialMappingsReviewed: 0,
      officialMappingReviewPending: batch.skills.length,
      officialMappingsPromoted: 0,
      candidateEvidenceCount: batch.skills.length,
      candidateEvidenceStatus: 'MAPPING_PENDING_NOT_A_MAPPING',
    },
    canonicalGraph: {
      internalSkillsBefore: inputs.graph.summary.targetableSkills,
      newCanonicalSkills: batch.skills.length,
      internalSkillsAfter: inputs.graph.summary.targetableSkills + batch.skills.length,
      existingSkillsExpanded: 0,
      technicalGapsResolved: 0,
      typedRelationships: relationCounts,
      databasePrerequisiteEdges: relationCounts.PREREQUISITE ?? 0,
      databaseRelationshipsOmittedAsUnsupportedTypes: (relationCounts.SUPPORTING ?? 0) + (relationCounts.PROGRESSION ?? 0) + (relationCounts.SAME_DOMAIN ?? 0),
      newPrerequisiteRelations: relationCounts.PREREQUISITE ?? 0,
    },
    curriculum: {
      baselineUnits: inputs.v4Units.units.length,
      newUnits: units.summary.newUnits,
      reusedExistingUnits: units.summary.reusedExistingUnits,
      finalUniqueUnits: inputs.v4Units.units.length + units.summary.newUnits,
      unitSkillMemberships: units.summary.newSkillMemberships,
      inactiveGradeTargets: batch.skills.reduce((count, skill) => count + skill.gradeTo - skill.gradeFrom + 1, 0),
    },
    content: {
      subjects: [...new Set(batch.skills.map((skill) => skill.subjectCode))].sort(),
      stages: [...new Set(batch.skills.map((skill) => skill.stage))].sort(),
      newLessons: batch.skills.filter((skill) => skill.lesson).length,
      skillsWithLessons: batch.skills.filter((skill) => skill.lesson).length,
      newQuestions: batch.skills.reduce((sum, skill) => sum + skill.questions.length, 0),
      skillsWithQuestions: batch.skills.filter((skill) => skill.questions.length > 0).length,
      completeAdaptiveSequences: batch.skills.filter((skill) => PURPOSES.every((purpose) => skill.questions.some((question) => question.purpose === purpose))).length,
      skillsWithCompleteAdaptiveSequence: batch.skills.filter((skill) => PURPOSES.every((purpose) => skill.questions.some((question) => question.purpose === purpose))).length,
      purposeCountsBySkill: Object.fromEntries(batch.skills.map((skill) => [skill.skillCode, Object.fromEntries(PURPOSES.map((purpose) => [purpose, skill.questions.filter((question) => question.purpose === purpose).length]))])),
    },
    databaseCompilation: { method: 'FORWARD_ONLY_DML_STAGING_SQL_NO_SCHEMA_CHANGE', idempotentBy: ['catalog+skill_code', 'skill+lesson_version', 'question_source+content_id', 'skill+purpose+set_version', 'unit_id+skill_code'], studentEligibleRows: 0 },
    safety: { publicationStatus: 'STAGING', mappingStatus: 'MAPPING_PENDING', pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING', newContentPublished: false, studentAvailableContent: 0, studentHistoryModified: false, productionWrites: false, otherServicesTouched: false },
    nextPriorityQueues: buildNextPriorityQueues(inputs, v1, batch),
  };
  return {
    report: { ...reportBody, inventoryHash: sha256(stableJson(reportBody)) },
    graph,
    units,
    sql: sqlText,
  };
}

export function loadKnowledgeFactoryV2Inputs(root = ROOT) {
  const inputs = loadKnowledgeFactoryInputs(root);
  return { inputs, batch: readJson(root, BATCH_PATH) };
}

export function compileKnowledgeFactoryV2(root = ROOT, check = false) {
  const { inputs, batch } = loadKnowledgeFactoryV2Inputs(root);
  const result = buildKnowledgeFactoryV2(batch, inputs);
  if (result.errors) throw new Error(`KNOWLEDGE_FACTORY_V2_INVALID\n${result.errors.join('\n')}`);
  const outputs = [
    [GRAPH_PATH, result.graph],
    [UNITS_PATH, result.units],
    [REPORT_PATH, result.report],
  ];
  const normalizedSql = result.sql.replace(/\r\n/g, '\n');
  if (check) {
    for (const [relativePath, expected] of outputs) {
      const currentPath = path.join(root, relativePath);
      if (!fs.existsSync(currentPath)) throw new Error(`KNOWLEDGE_FACTORY_V2_OUTPUT_MISSING:${relativePath}`);
      const current = readJson(root, relativePath);
      const outputHash = relativePath === GRAPH_PATH ? 'expansionHash' : relativePath === UNITS_PATH ? 'expansionHash' : 'inventoryHash';
      if (current[outputHash] !== expected[outputHash]) throw new Error(`KNOWLEDGE_FACTORY_V2_OUTPUT_STALE:${relativePath}`);
    }
    const currentSqlPath = path.join(root, SQL_PATH);
    if (!fs.existsSync(currentSqlPath) || hashSourceContent(fs.readFileSync(currentSqlPath)) !== hashSourceContent(normalizedSql)) {
      throw new Error(`KNOWLEDGE_FACTORY_V2_OUTPUT_STALE:${SQL_PATH}`);
    }
    return result.report;
  }
  for (const [relativePath, data] of outputs) {
    const outputPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  }
  const sqlPath = path.join(root, SQL_PATH);
  fs.mkdirSync(path.dirname(sqlPath), { recursive: true });
  fs.writeFileSync(sqlPath, normalizedSql, 'utf8');
  return result.report;
}

function run() {
  const report = compileKnowledgeFactoryV2(ROOT, process.argv.includes('--check'));
  console.log(`BNCC_KNOWLEDGE_FACTORY_V2=${process.argv.includes('--check') ? 'CHECK_PASS' : 'COMPILED'}`);
  console.log(`BNCC_KNOWLEDGE_FACTORY_V2_SKILLS=${report.canonicalGraph.newCanonicalSkills}`);
  console.log(`BNCC_KNOWLEDGE_FACTORY_V2_UNITS=${report.curriculum.newUnits} created, ${report.curriculum.reusedExistingUnits} reused`);
  console.log(`BNCC_KNOWLEDGE_FACTORY_V2_CONTENT=${report.content.newLessons} lessons/${report.content.newQuestions} questions`);
  console.log(`BNCC_KNOWLEDGE_FACTORY_V2_MAPPING_GAPS_RESOLVED=${report.officialCatalog.officialMappingGapsResolved}`);
  console.log(`BNCC_KNOWLEDGE_FACTORY_V2_PUBLICATION=${report.safety.publicationStatus}; student_available=${report.safety.studentAvailableContent}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
