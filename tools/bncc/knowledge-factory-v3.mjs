import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildKnowledgeFactory, hashSourceContent } from './knowledge-factory.mjs';
import { loadKnowledgeFactoryV2Inputs, orderQuestionOptions } from './knowledge-factory-v2.mjs';
import { batch } from '../../content/adaptive/tec-escola-core-v9/knowledge-expansion-batch-v3.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const V1_PATH = 'content/adaptive/tec-escola-core-v9/knowledge-gap-batch-v1.json';
const BATCH_PATH = 'content/adaptive/tec-escola-core-v9/knowledge-expansion-batch-v3.json';
const GRAPH_PATH = 'content/bncc/authoring/knowledge-graph-expansion-v3.json';
const UNITS_PATH = 'content/bncc/authoring/curriculum-unit-expansion-v3.json';
const SQL_PATH = 'content/bncc/authoring/knowledge-factory-v3-staging.sql';
const REPORT_PATH = 'content/bncc/authoring/knowledge-factory-inventory-v3.json';
const PURPOSES = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];
const STAGE_GRADES = { FUNDAMENTAL_I: [1, 5], FUNDAMENTAL_II: [6, 9], ENSINO_MEDIO: [1, 3] };
const COMPONENT_SUBJECT = {
  AR: 'ART', CI: 'SCIENCE', CO: 'COMPUTING', EF: 'PHYSICAL_EDUCATION', ER: 'RELIGIOUS_EDUCATION',
  HI: 'HISTORY', LP: 'PORTUGUESE', MA: 'MATHEMATICS', MAT: 'MATHEMATICS', CHS: 'HUMANITIES', LGG: 'LANGUAGES',
};
const OFFICIAL_OVERRIDES = {
  EM13MAT106: {
    sourceId: 'BNCC_EM_2018',
    documentVersion: 'BNCC Ensino Médio, versão homologada 2018',
    url: 'https://basenacionalcomum.mec.gov.br/images/historico/BNCC_EnsinoMedio_embaixa_site_110518.pdf',
    page: null,
    section: 'Matemática e suas Tecnologias > Habilidades',
    description: 'Identificar situações da vida cotidiana nas quais seja necessário fazer escolhas levando-se em conta os riscos probabilísticos (usar este ou aquele método contraceptivo, optar por um tratamento médico em detrimento de outro etc.).',
    correction: 'The local catalog points to the Ensino Fundamental PDF for this Ensino Médio code; source citation corrected in this dossier only.',
  },
  EF01CI04: {
    section: 'Ciências > 1º ano > Vida e evolução',
    description: 'Comparar características físicas entre os colegas, reconhecendo a diversidade e a importância da valorização, do acolhimento e do respeito às diferenças.',
    correction: 'The extracted local excerpt includes the following History skill text; the official skill statement is isolated here without modifying the official catalog.',
  },
  EM13LGG103: {
    page: null,
    section: 'Linguagens e suas Tecnologias > Competência Específica 1 > Habilidades',
    description: 'Analisar o funcionamento das linguagens, para interpretar e produzir criticamente discursos em textos de diversas semioses (visuais, verbais, sonoras, gestuais).',
    correction: 'The local extracted excerpt is polluted by surrounding page text; this dossier uses the official statement verified in the source PDF.',
  },
  EM13LP17: {
    section: 'Linguagens e suas Tecnologias > Língua Portuguesa > Todos os campos de atuação social',
    description: 'Analisar o fenômeno da variação linguística, em seus diferentes níveis (variação fonético-fonológica, lexical, sintática, semântica e estilístico-pragmática) e em suas diferentes dimensões (regional, histórica, social, situacional, ocupacional, etária etc.), de forma a ampliar a compreensão sobre a natureza viva e dinâmica da língua e sobre o fenômeno da constituição de variedades linguísticas de prestígio e estigmatizadas, e a fundamentar o respeito às variedades linguísticas e o combate a preconceitos linguísticos.',
    correction: 'The local extracted excerpt contains following-page text; this dossier isolates the verified official statement.',
  },
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

function sql(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

function jsonSql(value) {
  return `${sql(JSON.stringify(value))}::jsonb`;
}

function textArraySql(values) {
  return `ARRAY[${values.map(sql).join(', ')}]::text[]`;
}

function normalizeText(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeV1Lesson(source) {
  if (!source) return null;
  return {
    ...source,
    estimatedMinutes: source.estimatedMinutes ?? 18,
    remediations: (source.remediations ?? []).map((item) => ({ ...item, trigger: item.trigger ?? item.difficulty ?? 'REUSED_V1_REMEDIATION' })),
  };
}

function excerptForOfficialCode(node) {
  const text = String(node?.officialTextExcerpt ?? '').replace(/^\s*\)\s*/, '').trim();
  const nextCode = text.search(/\s*\([A-Z]{2}\d{2}[A-Z]{2,3}\d{2,3}\)/);
  const excerpt = (nextCode >= 0 ? text.slice(0, nextCode) : text).replace(/\s+/g, ' ').trim();
  return excerpt.replace(/\s+\d{1,4}\s*$/, '').trim();
}

function sourceEvidenceFor(code, proposal, cluster, inputs) {
  const node = inputs.catalog.nodes.find((item) => item.code === code);
  const override = OFFICIAL_OVERRIDES[code] ?? {};
  if (!node?.officialSource) return null;
  const source = node.officialSource;
  const officialDescription = override.description ?? excerptForOfficialCode(node);
  const componentCode = node.componentCode ?? null;
  const officialSubject = COMPONENT_SUBJECT[componentCode] ?? null;
  const sourceStage = node.stage;
  const codeRange = code.match(/^EF(\d{2})/);
  let officialGradeFrom = null;
  let officialGradeTo = null;
  if (codeRange) {
    const pair = codeRange[1];
    if (pair === '15' || pair === '69') {
      officialGradeFrom = pair === '15' ? 1 : 6;
      officialGradeTo = pair === '15' ? 5 : 9;
    } else if (pair === '12') {
      officialGradeFrom = 1;
      officialGradeTo = 2;
    } else if (pair === '35') {
      officialGradeFrom = 3;
      officialGradeTo = 5;
    } else if (pair === '67') {
      officialGradeFrom = 6;
      officialGradeTo = 7;
    } else if (pair === '89') {
      officialGradeFrom = 8;
      officialGradeTo = 9;
    } else {
      officialGradeFrom = Number(pair);
      officialGradeTo = Number(pair);
    }
  } else if (code.startsWith('EM13')) {
    officialGradeFrom = 1;
    officialGradeTo = 3;
  }
  const candidateSubject = cluster?.subject ?? proposal.subjectCode ?? null;
  const gradeCompatible = officialGradeFrom === null
    || (officialGradeFrom <= (proposal.internalGradeTo ?? officialGradeTo)
      && officialGradeTo >= (proposal.internalGradeFrom ?? officialGradeFrom));
  return {
    officialCode: code,
    sourceId: override.sourceId ?? source.id,
    documentVersion: override.documentVersion ?? source.documentVersion,
    url: override.url ?? source.url,
    page: Object.hasOwn(override, 'page') ? override.page : source.page,
    section: override.section ?? `${componentCode ?? 'Official curriculum'} > Habilidades`,
    officialDescription,
    localCatalogExcerpt: node.officialTextExcerpt,
    localCatalogSourceId: source.id,
    localCatalogUrl: source.url,
    localCatalogPage: source.page,
    sourceCorrection: override.correction ?? null,
    sourceStage,
    officialComponentCode: componentCode,
    officialSubjectArea: officialSubject,
    candidateSubject,
    gradeRange: officialGradeFrom === null ? null : { from: officialGradeFrom, to: officialGradeTo },
    gradeCompatible,
    proposalId: proposal.proposalId,
    proposalCanonicalCode: proposal.canonicalCode,
    proposalStatus: proposal.proposalStatus,
    gapClusterId: cluster?.clusterId ?? null,
    referenceStatus: 'OFFICIAL_SOURCE_IDENTIFIED_AND_EXCERPT_CHECKED',
    candidateStatus: 'TECHNICAL_CANDIDATE_NOT_APPROVED_MAPPING',
    mappingClaim: 'NONE',
    mappingStatus: 'MAPPING_PENDING',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
  };
}

function withSkillScope(evidence, skill) {
  if (!evidence || !skill || !evidence.gradeRange) return evidence;
  const from = skill.gradeFrom ?? skill.recommendedGradeFrom;
  const to = skill.gradeTo ?? skill.recommendedGradeTo;
  return {
    ...evidence,
    internalSkillCode: skill.skillCode ?? skill.code,
    internalGradeRange: { from, to },
    gradeCompatible: Number.isInteger(from) && Number.isInteger(to)
      && from >= evidence.gradeRange.from && to <= evidence.gradeRange.to,
  };
}

function buildCandidateDossiers(inputs, sourceBatch) {
  const proposalByCode = new Map(inputs.proposals.proposals.map((proposal) => [proposal.canonicalCode, proposal]));
  const clusterById = new Map(inputs.clusters.clusters.map((cluster) => [cluster.clusterId, cluster]));
  const newSkillsByCandidate = new Map();
  for (const skill of sourceBatch.newSkills) {
    newSkillsByCandidate.set(skill.sourceCandidate, [...(newSkillsByCandidate.get(skill.sourceCandidate) ?? []), skill]);
  }
  const deferred = new Map(sourceBatch.nextQueue.map((item) => [item.targetId, item]));
  const dossiers = [];
  const enrichedSkills = sourceBatch.newSkills.map((skill) => {
    const proposal = proposalByCode.get(skill.sourceCandidate);
    if (!proposal) return { ...skill, sourceEvidence: null };
    const cluster = clusterById.get(proposal.proposalId.replace('V8_PROPOSAL_', 'V8_GAP_'));
    const evidence = withSkillScope(sourceEvidenceFor(skill.officialCodes[0], proposal, cluster, inputs), skill);
    return {
      ...skill,
      sourceEvidence: evidence ? {
        ...evidence,
        evidenceSummary: `The authored capability is a bounded internal interpretation of ${skill.officialCodes[0]}; it is not a promoted BNCC mapping.`,
        observableCapability: skill.observableCapability,
        authoringLimitations: skill.assessmentLimitations,
      } : null,
    };
  });

  for (const candidate of sourceBatch.candidateTargets) {
    const proposal = proposalByCode.get(candidate.targetId);
    if (!proposal) {
      dossiers.push({ targetId: candidate.targetId, status: 'BLOCKED_WITH_EVIDENCE', reason: 'V8_PROPOSAL_NOT_FOUND', mappingStatus: 'MAPPING_PENDING' });
      continue;
    }
    const cluster = clusterById.get(proposal.proposalId.replace('V8_PROPOSAL_', 'V8_GAP_'));
    for (const code of candidate.officialCodes) {
      const key = `${candidate.targetId}:${code}`;
      const deferredItem = deferred.get(key);
      const childSkill = enrichedSkills.find((skill) => skill.sourceCandidate === candidate.targetId && skill.officialCodes.includes(code));
      const reusedSkillCode = candidate.status === 'REUSED_EXISTING_SKILL' ? candidate.reusedSkillCode : null;
      const reusedSkill = candidate.status === 'REUSED_EXISTING_SKILL'
        ? inputs.v4Skills.find((skill) => skill.code === candidate.reusedSkillCode)
        : null;
      const evidence = withSkillScope(sourceEvidenceFor(code, proposal, cluster, inputs), childSkill ?? reusedSkill);
      dossiers.push({
        targetId: candidate.targetId,
        officialCode: code,
        status: deferredItem ? 'ANALYZED_DEFERRED' : candidate.status,
        reason: deferredItem?.reason ?? null,
        proposalId: proposal.proposalId,
        proposalStatus: proposal.proposalStatus,
        childSkillCode: childSkill?.skillCode ?? (deferredItem ? null : reusedSkillCode),
        sourceEvidence: evidence,
        mappingStatus: 'MAPPING_PENDING',
        mappingApproved: false,
        pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      });
    }
  }
  return { dossiers, enrichedSkills };
}

function buildQuestionGroups(inputs, v1, sourceBatch, enrichedSkills) {
  const groups = new Map();
  const makeGroup = (skillCode, details) => {
    const current = groups.get(skillCode);
    if (current) return current;
    const group = { skillCode, questions: [], ...details };
    groups.set(skillCode, group);
    return group;
  };
  const existingUnitBySkill = new Map();
  for (const unit of inputs.v4Units.units) for (const skillCode of unit.canonicalSkills ?? []) {
    if (!existingUnitBySkill.has(skillCode)) existingUnitBySkill.set(skillCode, unit);
  }

  const v1ByCode = new Map(v1.skills.map((item) => [item.skillCode, item]));
  for (const reuseCode of sourceBatch.v1Reuse) {
    const item = v1ByCode.get(reuseCode);
    if (!item) continue;
    const unit = existingUnitBySkill.get(reuseCode);
    const group = makeGroup(reuseCode, {
      subjectCode: item.subjectCode ?? inputs.v4Skills.find((skill) => skill.code === reuseCode)?.subjectCode,
      stage: item.stage ?? inputs.v4Skills.find((skill) => skill.code === reuseCode)?.recommendedStage,
      gradeFrom: item.gradeFrom ?? inputs.v4Skills.find((skill) => skill.code === reuseCode)?.recommendedGradeFrom,
      gradeTo: item.gradeTo ?? inputs.v4Skills.find((skill) => skill.code === reuseCode)?.recommendedGradeTo,
      domain: item.domain ?? inputs.v4Skills.find((skill) => skill.code === reuseCode)?.domain,
      parentSkillCode: inputs.v4Skills.find((skill) => skill.code === reuseCode)?.parent,
      unitId: unit?.unitId ?? null,
      title: inputs.v4Skills.find((skill) => skill.code === reuseCode)?.title ?? item.lesson.title,
      description: inputs.v4Skills.find((skill) => skill.code === reuseCode)?.description ?? item.lesson.objective,
      lesson: normalizeV1Lesson(item.lesson),
      lessonKind: 'V1_REUSED',
    });
    group.questions.push(...item.questions.map((question) => ({ question, kind: 'V1_REUSED', sourceId: question.id })));
  }

  for (const extension of sourceBatch.extensions) {
    const sourceSkill = inputs.v4Skills.find((skill) => skill.code === extension.skillCode);
    const currentV4Lesson = inputs.v4Lessons.find((lesson) => lesson.skill === extension.skillCode);
    const group = makeGroup(extension.skillCode, {
      subjectCode: extension.subjectCode,
      stage: extension.stage,
      gradeFrom: extension.gradeFrom,
      gradeTo: extension.gradeTo,
      domain: extension.domain,
      parentSkillCode: extension.parentSkillCode,
      unitId: extension.unitId,
      title: sourceSkill?.title ?? extension.skillCode,
      description: sourceSkill?.description ?? extension.lesson?.objective ?? extension.skillCode,
      lesson: extension.lesson ?? currentV4Lesson ?? null,
      lessonKind: extension.lesson ? 'V3_AUTHORED' : 'V4_REUSED',
    });
    group.questions.push(...extension.questions.map((question) => ({ question, kind: 'V3_AUTHORED', sourceId: question.id })));
  }

  for (const skill of enrichedSkills) {
    const group = makeGroup(skill.skillCode, {
      subjectCode: skill.subjectCode,
      stage: skill.stage,
      gradeFrom: skill.gradeFrom,
      gradeTo: skill.gradeTo,
      domain: skill.domain,
      parentSkillCode: skill.parentSkillCode,
      unitId: skill.unitId,
      title: skill.title,
      description: skill.description,
      lesson: skill.lesson,
      lessonKind: 'V3_AUTHORED',
      skillDefinition: skill,
    });
    group.questions.push(...skill.questions.map((question) => ({ question, kind: 'V3_AUTHORED', sourceId: question.id })));
  }

  const excludedIds = new Set(sourceBatch.sourceExclusions.map((item) => item.questionId));
  for (const question of inputs.v4Questions) {
    const group = groups.get(question.primarySkill);
    if (!group || excludedIds.has(question.id)) continue;
    group.questions.push({ question, kind: 'V4_REUSED', sourceId: question.id });
  }

  return [...groups.values()].map((group) => ({
    ...group,
    questions: group.questions.sort((left, right) => {
      const purposeDelta = PURPOSES.indexOf(left.question.purpose) - PURPOSES.indexOf(right.question.purpose);
      return purposeDelta || left.sourceId.localeCompare(right.sourceId);
    }),
  }));
}

function buildGraphExpansion(inputs, sourceBatch, enrichedSkills, groups, sourceDossiers, contentHash) {
  const existingCodes = new Set([...inputs.graph.nodes, ...inputs.v4Skills].map((node) => node.code));
  const anchors = sourceBatch.anchors.map((anchor) => ({
    ...anchor,
    nodeKind: 'ANCHOR',
    active: false,
    masteryTargetable: false,
    mappingStatus: 'MAPPING_PENDING',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    publicationStatus: 'STAGING',
    bnccAlignment: 'NOT_CLAIMED',
    officialCode: null,
  }));
  const skills = enrichedSkills.map((skill) => ({
    code: skill.skillCode,
    nodeKind: 'LEAF',
    subjectCode: skill.subjectCode,
    parent: skill.parentSkillCode,
    title: skill.title,
    objective: skill.learningObjective,
    observableCapability: skill.observableCapability,
    domain: skill.domain,
    stage: skill.stage,
    gradeFrom: skill.gradeFrom,
    gradeTo: skill.gradeTo,
    contentReadiness: 'ADAPTIVE_READY',
    active: false,
    masteryTargetable: false,
    mappingStatus: 'MAPPING_PENDING',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    publicationStatus: 'STAGING',
    sourceEvidence: skill.sourceEvidence,
    bnccAlignment: 'NOT_CLAIMED',
  }));
  const existingSkillExtensions = groups.filter((group) => existingCodes.has(group.skillCode)).map((group) => ({
    skillCode: group.skillCode,
    lessonKind: group.lessonKind,
    reusedQuestionCount: group.questions.filter((item) => item.kind === 'V1_REUSED' || item.kind === 'V4_REUSED').length,
    authoredQuestionCount: group.questions.filter((item) => item.kind === 'V3_AUTHORED').length,
    existingSkillStateChanged: false,
    publicationStatus: 'STAGING',
    mappingStatus: 'MAPPING_PENDING',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
  }));
  const output = {
    schemaVersion: 'tec-escola.bncc.knowledge-graph-expansion.v3',
    baseGraphHash: inputs.graph.graphHash,
    packVersion: sourceBatch.packVersion,
    contentHash,
    graphStatus: 'STAGING_NOT_BNCC_PROMOTED',
    summary: {
      existingSkillsExtended: existingSkillExtensions.length,
      newInternalAnchors: anchors.length,
      newInternalSkills: skills.length,
      newSkillCodes: skills.map((skill) => skill.code),
      existingSkillStatesChanged: 0,
      officialMappingsPromoted: 0,
      studentEligibleNodes: 0,
    },
    anchors,
    nodes: skills,
    hierarchyEdges: skills.map((skill) => ({ parent: skill.parent, child: skill.code, stagingOnly: true })),
    existingSkillExtensions,
    sourceDossiers,
    semanticRelationships: [],
    deferredCandidateReferences: sourceDossiers.filter((item) => item.status === 'ANALYZED_DEFERRED'),
    statusContract: {
      mappingStatus: 'MAPPING_PENDING',
      pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      publicationStatus: 'STAGING',
      studentEligible: false,
      humanApprovalClaimed: false,
      officialCanonicalGapReduction: 0,
    },
  };
  return { ...output, expansionHash: sha256(stableJson(output)) };
}

function buildUnitExpansion(inputs, sourceBatch, groups) {
  const skillsByUnit = new Map();
  for (const skill of sourceBatch.newSkills) skillsByUnit.set(skill.unitId, [...(skillsByUnit.get(skill.unitId) ?? []), skill.skillCode]);
  const newUnits = sourceBatch.units.map((unit) => ({
    ...unit,
    subjectName: inputs.registry.subjects.find((item) => item.code === unit.subjectCode)?.name ?? unit.subjectCode,
    officialCodes: [],
    canonicalSkills: [...new Set(skillsByUnit.get(unit.unitId) ?? [])],
    prerequisiteUnitIds: [],
    progressionOrder: 1,
    reviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    publicationStatus: 'STAGING',
    availability: 'NOT_AVAILABLE_TO_STUDENTS',
    bnccAlignment: 'NOT_CLAIMED',
  }));
  const existingUnits = new Map(inputs.v4Units.units.map((unit) => [unit.unitId, unit]));
  const additionsByUnit = new Map();
  for (const group of groups) {
    if (!existingUnits.has(group.unitId)) continue;
    additionsByUnit.set(group.unitId, [...(additionsByUnit.get(group.unitId) ?? []), group.skillCode]);
  }
  const existingUnitExtensions = [...additionsByUnit.entries()].map(([unitId, skillCodes]) => {
    const unit = existingUnits.get(unitId);
    return {
      unitId,
      title: unit.title,
      subjectCode: unit.subjectCode,
      stage: unit.stage,
      domain: unit.domain,
      reuseRationale: 'Reuse the existing V4 unit record without changing its curriculum state; the V3 package remains inactive.',
      addCanonicalSkills: [...new Set(skillCodes)],
      reviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      publicationStatus: 'STAGING',
      availability: 'NOT_AVAILABLE_TO_STUDENTS',
      databaseUnitRowChanged: false,
    };
  });
  const output = {
    schemaVersion: 'tec-escola.bncc.curriculum-unit-expansion.v3',
    baseUnitsHash: inputs.v4Units.unitsHash,
    packVersion: sourceBatch.packVersion,
    newUnits,
    existingUnitExtensions,
    summary: {
      newUnits: newUnits.length,
      reusedExistingUnits: existingUnitExtensions.length,
      newSkillMemberships: newUnits.reduce((sum, unit) => sum + unit.canonicalSkills.length, 0),
      existingSkillReferences: existingUnitExtensions.reduce((sum, unit) => sum + unit.addCanonicalSkills.length, 0),
      studentAvailableUnits: 0,
      unitRowsPersistedBySql: 0,
    },
  };
  return { ...output, expansionHash: sha256(stableJson(output)) };
}

function validateLesson(lesson, skillCode, errors) {
  if (!lesson) {
    errors.push(`LESSON_MISSING:${skillCode}`);
    return;
  }
  if (!lesson.title?.trim() || !lesson.objective?.trim() || (lesson.priorKnowledge?.length ?? 0) < 2
    || (lesson.keyConcepts?.length ?? 0) < 3 || (lesson.progressiveExplanation?.length ?? 0) < 3
    || String(lesson.workedExample ?? '').trim().length < 240 || (lesson.commonErrors?.length ?? 0) < 3
    || (lesson.remediations?.length ?? 0) !== 2 || !lesson.everydayApplication?.trim()
    || !lesson.summary?.trim() || !lesson.practiceGuidance?.trim()) {
    errors.push(`LESSON_STRUCTURE_INCOMPLETE:${skillCode}`);
  }
  if (new Set((lesson.remediations ?? []).map((item) => item.id)).size !== (lesson.remediations ?? []).length
    || (lesson.remediations ?? []).some((item) => !item.trigger?.trim() || !item.explanation?.trim() || !item.workedExample?.trim() || !item.selfCheck?.trim())) {
    errors.push(`LESSON_REMEDIATION_INCOMPLETE:${skillCode}`);
  }
}

function validateQuestion(question, skillCode, ids, stems, errors) {
  if (!question.id || ids.has(question.id)) errors.push(`QUESTION_ID_DUPLICATE_OR_MISSING:${question.id ?? skillCode}`);
  ids.add(question.id);
  const stem = normalizeText(question.statement);
  if (!stem || stems.has(stem)) errors.push(`QUESTION_STEM_DUPLICATE_OR_EMPTY:${question.id}`);
  stems.add(stem);
  if (!PURPOSES.includes(question.purpose)) errors.push(`QUESTION_PURPOSE_INVALID:${question.id}:${question.purpose}`);
  if (!['EASY', 'MEDIUM', 'HARD'].includes(question.difficulty)) errors.push(`QUESTION_DIFFICULTY_INVALID:${question.id}`);
  if (!question.contextFamily?.trim() || !question.cognitiveProcess?.trim()) errors.push(`QUESTION_CONTEXT_OR_PROCESS_MISSING:${question.id}`);
  if (!Array.isArray(question.options) || question.options.length !== 4
    || new Set(question.options.map(normalizeText)).size !== 4 || !question.options.includes(question.correctAnswer)) {
    errors.push(`QUESTION_OPTIONS_OR_ANSWER_INVALID:${question.id}`);
  }
  if (!question.explanation?.trim()) errors.push(`QUESTION_EXPLANATION_MISSING:${question.id}`);
  if (question.kind === 'V3_AUTHORED' && (!question.errorFocus?.trim() || !question.remediationHint?.trim())) {
    errors.push(`QUESTION_REMEDIATION_MISSING:${question.id}`);
  }
}

function validateAcyclic(edges) {
  const adjacency = new Map();
  for (const [parent, child] of edges) adjacency.set(parent, [...(adjacency.get(parent) ?? []), child]);
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

function validateKnowledgeFactoryV3(inputs, v1, sourceBatch, enrichedSkills, dossiers, groups) {
  const errors = [];
  const existingByCode = new Map([...inputs.graph.nodes, ...inputs.v4Skills].map((node) => [node.code, node]));
  const newByCode = new Map(enrichedSkills.map((skill) => [skill.skillCode, skill]));
  const anchorByCode = new Map(sourceBatch.anchors.map((anchor) => [anchor.code, anchor]));
  const groupByCode = new Map(groups.map((group) => [group.skillCode, group]));
  if (sourceBatch.schemaVersion !== 'tec-escola.bncc.knowledge-expansion-batch.v3') errors.push('V3_SCHEMA_VERSION_INVALID');
  if (sourceBatch.packVersion !== 'tec-escola-knowledge-expansion-v3') errors.push('V3_PACK_VERSION_INVALID');
  if (sourceBatch.publicationStatus !== 'STAGING' || sourceBatch.mappingStatus !== 'MAPPING_PENDING'
    || sourceBatch.pedagogicalReviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING' || sourceBatch.bnccAlignment !== 'NOT_CLAIMED') errors.push('V3_STATUS_GATE_CHANGED');
  if (sourceBatch.existingTargets.length !== 12 || sourceBatch.candidateTargets.length !== 12
    || new Set(sourceBatch.candidateTargets.map((item) => item.targetId)).size !== 12
    || enrichedSkills.length !== sourceBatch.newSkills.length) errors.push('V3_TARGET_COUNTS_INVALID');
  if (new Set(enrichedSkills.map((skill) => skill.skillCode)).size !== enrichedSkills.length) errors.push('V3_NEW_SKILL_DUPLICATE');
  for (const skill of enrichedSkills) {
    if (existingByCode.has(skill.skillCode)) errors.push(`NEW_SKILL_COLLIDES_WITH_EXISTING:${skill.skillCode}`);
    if (!/^[A-Z][A-Z0-9_]{4,79}$/.test(skill.skillCode)) errors.push(`SKILL_CODE_INVALID:${skill.skillCode}`);
    const grades = STAGE_GRADES[skill.stage];
    if (!grades || skill.gradeFrom < grades[0] || skill.gradeTo > grades[1] || skill.gradeFrom > skill.gradeTo) errors.push(`GRADE_RANGE_INVALID:${skill.skillCode}`);
    const parent = existingByCode.get(skill.parentSkillCode) ?? newByCode.get(skill.parentSkillCode) ?? anchorByCode.get(skill.parentSkillCode);
    if (!parent) errors.push(`PARENT_MISSING:${skill.skillCode}:${skill.parentSkillCode}`);
    else if (parent.subjectCode !== skill.subjectCode) errors.push(`PARENT_SUBJECT_MISMATCH:${skill.skillCode}`);
    if (!sourceBatch.units.some((unit) => unit.unitId === skill.unitId)) errors.push(`NEW_SKILL_UNIT_MISSING:${skill.skillCode}`);
    if (!skill.sourceEvidence || skill.sourceEvidence.mappingStatus !== 'MAPPING_PENDING' || skill.sourceEvidence.mappingClaim !== 'NONE') errors.push(`SKILL_SOURCE_EVIDENCE_INVALID:${skill.skillCode}`);
    if (skill.sourceEvidence && skill.sourceEvidence.officialSubjectArea !== skill.subjectCode) errors.push(`OFFICIAL_AREA_SUBJECT_MISMATCH:${skill.skillCode}:${skill.sourceEvidence.officialCode}`);
  }
  for (const anchor of sourceBatch.anchors) {
    if (existingByCode.has(anchor.code)) errors.push(`INTERNAL_ANCHOR_COLLISION:${anchor.code}`);
    if (!anchor.description?.includes('interno')) errors.push(`ANCHOR_NOT_IDENTIFIED_AS_INTERNAL:${anchor.code}`);
  }
  for (const target of sourceBatch.existingTargets) {
    if (!existingByCode.has(target.targetId)) errors.push(`EXISTING_TARGET_NOT_FOUND:${target.targetId}`);
    if (!groupByCode.has(target.targetId)) errors.push(`EXISTING_TARGET_HAS_NO_CONTENT_GROUP:${target.targetId}`);
  }
  const v1Codes = new Set(v1.skills.map((skill) => skill.skillCode));
  for (const code of sourceBatch.v1Reuse) if (!v1Codes.has(code) || !groupByCode.has(code)) errors.push(`V1_REUSE_MISSING:${code}`);
  for (const target of sourceBatch.candidateTargets) {
    const proposal = inputs.proposals.proposals.find((item) => item.canonicalCode === target.targetId);
    if (!proposal || proposal.proposalStatus !== 'NEW_SKILL_PENDING_REVIEW') errors.push(`V8_PROPOSAL_INVALID:${target.targetId}`);
    const childSkillCodes = target.childSkillCodes ?? (target.reusedSkillCode ? [target.reusedSkillCode] : []);
    if (!childSkillCodes.length) errors.push(`CANDIDATE_CHILD_SKILL_MISSING:${target.targetId}`);
    for (const code of childSkillCodes) if (!groupByCode.has(code)) errors.push(`CANDIDATE_CONTENT_GROUP_MISSING:${target.targetId}:${code}`);
  }
  for (const item of dossiers) {
    if (item.mappingStatus !== 'MAPPING_PENDING' || item.pedagogicalReviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING' || item.mappingApproved === true) errors.push(`DOSSIER_REVIEW_GATE_CHANGED:${item.targetId}:${item.officialCode}`);
    if (!item.sourceEvidence?.officialDescription?.trim() || !item.sourceEvidence?.url) errors.push(`DOSSIER_SOURCE_INCOMPLETE:${item.targetId}:${item.officialCode}`);
    if (item.sourceEvidence && item.sourceEvidence.gradeCompatible !== true) errors.push(`DOSSIER_GRADE_SCOPE_MISMATCH:${item.targetId}:${item.officialCode}`);
    if (item.status === 'ANALYZED_DEFERRED' && item.childSkillCode) errors.push(`DEFERRED_CODE_HAS_SKILL:${item.officialCode}`);
  }

  const questionIds = new Set();
  const questionStems = new Set();
  for (const group of groups) {
    if (!existingByCode.has(group.skillCode) && !newByCode.has(group.skillCode)) errors.push(`CONTENT_GROUP_SKILL_UNKNOWN:${group.skillCode}`);
    if (!group.unitId || (!inputs.v4Units.units.some((unit) => unit.unitId === group.unitId) && !sourceBatch.units.some((unit) => unit.unitId === group.unitId))) errors.push(`CONTENT_GROUP_UNIT_UNKNOWN:${group.skillCode}:${group.unitId}`);
    if (group.lessonKind === 'V4_REUSED') {
      if (!group.lesson) errors.push(`V4_LESSON_REUSE_MISSING:${group.skillCode}`);
    } else validateLesson(group.lesson, group.skillCode, errors);
    const purposes = new Set();
    for (const item of group.questions) {
      validateQuestion({ ...item.question, kind: item.kind }, group.skillCode, questionIds, questionStems, errors);
      purposes.add(item.question.purpose);
    }
    for (const purpose of PURPOSES) if (!purposes.has(purpose)) errors.push(`ADAPTIVE_PURPOSE_MISSING:${group.skillCode}:${purpose}`);
  }
  const exclusions = new Map(sourceBatch.sourceExclusions.map((item) => [item.questionId, item]));
  for (const [id, exclusion] of exclusions) {
    if (groups.some((group) => group.questions.some((item) => item.sourceId === id))) errors.push(`EXCLUDED_QUESTION_REUSED:${id}`);
    if (exclusion.replacementQuestionId && !groups.some((group) => group.questions.some((item) => item.sourceId === exclusion.replacementQuestionId))) errors.push(`EXCLUDED_QUESTION_REPLACEMENT_MISSING:${id}`);
  }
  const graphEdges = [
    ...inputs.graph.nodes.filter((node) => node.parent).map((node) => [node.parent, node.code]),
    ...enrichedSkills.map((skill) => [skill.parentSkillCode, skill.skillCode]),
  ];
  for (const cycle of validateAcyclic(graphEdges)) errors.push(`GRAPH_CYCLE:${cycle.join('>')}`);
  const reusedUnits = new Set(groups.map((group) => group.unitId).filter((unitId) => inputs.v4Units.units.some((unit) => unit.unitId === unitId)));
  const newUnits = new Set(sourceBatch.units.map((unit) => unit.unitId));
  for (const group of groups) if (!reusedUnits.has(group.unitId) && !newUnits.has(group.unitId)) errors.push(`UNIT_ORPHAN:${group.skillCode}:${group.unitId}`);
  return [...new Set(errors)];
}

function markdownForLesson(lesson) {
  const sections = [
    `## Objetivo\n${lesson.objective}`,
    lesson.priorKnowledge?.length ? `## Antes de começar\n${lesson.priorKnowledge.map((item) => `- ${item}`).join('\n')}` : null,
    lesson.keyConcepts?.length ? `## Conceitos principais\n${lesson.keyConcepts.map((item) => `- ${item}`).join('\n')}` : null,
    lesson.progressiveExplanation?.length ? `## Explicação passo a passo\n${lesson.progressiveExplanation.map((item, index) => `${index + 1}. ${item}`).join('\n')}` : null,
    lesson.workedExample ? `## Exemplo trabalhado\n${lesson.workedExample}` : null,
    lesson.commonErrors?.length ? `## Erros comuns\n${lesson.commonErrors.map((item) => `- ${item}`).join('\n')}` : null,
    lesson.remediations?.length ? `## Como retomar\n${lesson.remediations.map((item) => `### ${item.id}\n${item.explanation}\n\n${item.workedExample}\n\n**Confira:** ${item.selfCheck}`).join('\n\n')}` : null,
    lesson.everydayApplication ? `## Aplicação\n${lesson.everydayApplication}` : null,
    lesson.summary ? `## Resumo\n${lesson.summary}` : null,
    lesson.practiceGuidance ? `## Prática\n${lesson.practiceGuidance}` : null,
  ].filter(Boolean);
  return sections.join('\n\n');
}

function buildStagingSql(sourceBatch, enrichedSkills, groups, graph, units, report, contentHash) {
  const lines = [
    '-- Generated by tools/bncc/knowledge-factory-v3.mjs. Review before any database use.',
    '-- STAGING ONLY: V3 content packs, new skills, lessons, packages, question sets and authored questions are inactive.',
    '-- Existing skills and existing V4 question rows are read-only. No student, enrollment, session, answer or progress writes.',
    `-- V3_CONTENT_HASH=${contentHash}`,
    'begin;',
    `insert into public.learning_adaptive_content_packs(pack_version, canonical_hash, manifest, pedagogical_review_status, active) values (${sql(sourceBatch.packVersion)}, ${sql(contentHash)}, ${jsonSql({ schemaVersion: sourceBatch.schemaVersion, graphExpansionHash: graph.expansionHash, unitExpansionHash: units.expansionHash, skills: groups.map((group) => group.skillCode), authoredQuestionCount: report.content.newQuestions, reusedQuestionCount: report.content.reusedQuestions, mapping_status: 'MAPPING_PENDING', pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING', publication_status: 'STAGING', student_available_content: 0 })}, 'PEDAGOGICAL_REVIEW_PENDING', false) on conflict (pack_version) do update set canonical_hash = excluded.canonical_hash, manifest = excluded.manifest, pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING', active = false, updated_at = now();`,
    'do $v3$ declare v_catalog_id uuid; v_skill_id uuid; v_parent_id uuid; v_lesson_id uuid; v_package_id uuid; v_set_id uuid; v_question_id uuid; v_foreign_pack text; begin',
    "  select id into v_catalog_id from public.learning_curriculum_catalogs where code = 'TECESCOLA_CORE' and version = '1.0' limit 1;",
    "  if v_catalog_id is null then raise exception 'TECESCOLA_CORE_CATALOG_MISSING'; end if;",
  ];

  for (const anchor of sourceBatch.anchors) {
    const metadata = {
      content_pack: sourceBatch.packVersion,
      publication_status: 'STAGING',
      mapping_status: 'MAPPING_PENDING',
      pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING',
      bncc_alignment: 'NOT_CLAIMED',
      internal_grouping_only: true,
      official_code: null,
      mastery_targetable: false,
    };
    lines.push(`  if exists (select 1 from public.learning_curriculum_skills where catalog_id = v_catalog_id and code = ${sql(anchor.code)} and metadata->>'content_pack' is distinct from ${sql(sourceBatch.packVersion)}) then raise exception ${sql(`V3_ANCHOR_CODE_COLLISION:${anchor.code}`)}; end if;`);
    lines.push(`  insert into public.learning_curriculum_skills(catalog_id, code, stage, grade_level, subject_area, domain, title, description, active, node_kind, content_readiness, mastery_targetable, pedagogical_review_status, bncc_alignment_status, metadata) values (v_catalog_id, ${sql(anchor.code)}, ${sql(anchor.stage)}, ${anchor.gradeLevel}, ${sql(anchor.subjectCode)}, 'V3_INTERNAL_ANCHOR', ${sql(anchor.title)}, ${sql(anchor.description)}, false, 'ANCHOR', 'GRAPH_ONLY', false, 'PEDAGOGICAL_REVIEW_PENDING', 'CANDIDATE', ${jsonSql(metadata)}) on conflict (catalog_id, code) do update set stage = excluded.stage, grade_level = excluded.grade_level, subject_area = excluded.subject_area, domain = excluded.domain, title = excluded.title, description = excluded.description, active = false, node_kind = 'ANCHOR', content_readiness = 'GRAPH_ONLY', mastery_targetable = false, pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING', bncc_alignment_status = 'CANDIDATE', metadata = excluded.metadata, updated_at = now();`);
  }

  for (const skill of enrichedSkills) {
    const metadata = {
      content_pack: sourceBatch.packVersion,
      content_version: 3,
      objective: skill.learningObjective,
      observable_capability: skill.observableCapability,
      source_evidence: skill.sourceEvidence,
      mapping_status: 'MAPPING_PENDING',
      bncc_alignment: 'NOT_CLAIMED',
      pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING',
      publication_status: 'STAGING',
      mastery_targetable: false,
      content_authoring_status: 'AUTHORED_NOT_REVIEWED',
      staging_only: true,
      curriculum_unit_id: skill.unitId,
      assessment_limitations: skill.assessmentLimitations,
      cognitive_processes: skill.cognitiveProcesses,
    };
    lines.push(`  select id into v_parent_id from public.learning_curriculum_skills where catalog_id = v_catalog_id and code = ${sql(skill.parentSkillCode)};`);
    lines.push(`  if v_parent_id is null then raise exception ${sql(`V3_PARENT_SKILL_MISSING:${skill.parentSkillCode}`)}; end if;`);
    lines.push(`  if exists (select 1 from public.learning_curriculum_skills where catalog_id = v_catalog_id and code = ${sql(skill.skillCode)} and metadata->>'content_pack' is distinct from ${sql(sourceBatch.packVersion)}) then raise exception ${sql(`V3_SKILL_CODE_COLLISION:${skill.skillCode}`)}; end if;`);
    lines.push(`  insert into public.learning_curriculum_skills(catalog_id, code, stage, grade_level, subject_area, domain, title, description, active, node_kind, content_readiness, mastery_targetable, parent_canonical_skill_id, pedagogical_review_status, bncc_alignment_status, metadata) values (v_catalog_id, ${sql(skill.skillCode)}, ${sql(skill.stage)}, ${skill.gradeFrom}, ${sql(skill.subjectCode)}, ${sql(skill.domain)}, ${sql(skill.title)}, ${sql(skill.description)}, false, 'LEAF', 'ADAPTIVE_READY', false, v_parent_id, 'PEDAGOGICAL_REVIEW_PENDING', 'CANDIDATE', ${jsonSql(metadata)}) on conflict (catalog_id, code) do update set stage = excluded.stage, grade_level = excluded.grade_level, subject_area = excluded.subject_area, domain = excluded.domain, title = excluded.title, description = excluded.description, active = false, node_kind = 'LEAF', content_readiness = 'ADAPTIVE_READY', mastery_targetable = false, parent_canonical_skill_id = excluded.parent_canonical_skill_id, pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING', bncc_alignment_status = 'CANDIDATE', metadata = excluded.metadata, updated_at = now();`);
    lines.push(`  select id into v_skill_id from public.learning_curriculum_skills where catalog_id = v_catalog_id and code = ${sql(skill.skillCode)};`);
    lines.push('  insert into public.learning_skill_hierarchy(parent_skill_id, child_skill_id) values (v_parent_id, v_skill_id) on conflict (parent_skill_id, child_skill_id) do nothing;');
    for (let grade = skill.gradeFrom; grade <= skill.gradeTo; grade += 1) {
      lines.push(`  insert into public.learning_curriculum_grade_targets(catalog_id, stage, grade_level, subject_area, canonical_skill_id, priority, sort_order, active) values (v_catalog_id, ${sql(skill.stage)}, ${grade}, ${sql(skill.subjectCode)}, v_skill_id, 0, 0, false) on conflict (catalog_id, stage, grade_level, subject_area, canonical_skill_id) do update set active = false, updated_at = now();`);
    }
  }

  for (const [groupIndex, group] of groups.entries()) {
    const skill = enrichedSkills.find((item) => item.skillCode === group.skillCode);
    const unit = units.newUnits.find((item) => item.unitId === group.unitId) ?? units.existingUnitExtensions.find((item) => item.unitId === group.unitId);
    const packageTitle = unit?.title ? `${unit.title} — ${group.title}` : group.title;
    const packageMetadata = {
      content_pack: sourceBatch.packVersion,
      content_version: 3,
      skill_code: group.skillCode,
      curriculum_unit_id: group.unitId,
      mapping_status: 'MAPPING_PENDING',
      pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING',
      publication_status: 'STAGING',
      student_available: false,
      reused_existing_skill: !skill,
      lesson_source: group.lessonKind,
    };
    lines.push(`  select id into v_skill_id from public.learning_curriculum_skills where catalog_id = v_catalog_id and code = ${sql(group.skillCode)};`);
    lines.push(`  if v_skill_id is null then raise exception ${sql(`V3_CONTENT_SKILL_MISSING:${group.skillCode}`)}; end if;`);
    if (group.lessonKind === 'V4_REUSED') {
      lines.push(`  select id into v_lesson_id from public.learning_skill_lessons where canonical_skill_id = v_skill_id and version = 4 and metadata->>'content_pack' = 'tec-escola-core-v4' order by id limit 1;`);
      lines.push(`  if v_lesson_id is null then raise exception ${sql(`V3_REUSED_V4_LESSON_MISSING:${group.skillCode}`)}; end if;`);
    } else {
      const lesson = group.lesson;
      const lessonMeta = {
        content_pack: sourceBatch.packVersion,
        content_version: 3,
        source_kind: group.lessonKind,
        mapping_status: 'MAPPING_PENDING',
        pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING',
        publication_status: 'STAGING',
        objective: lesson.objective,
        prior_knowledge: lesson.priorKnowledge ?? [],
        key_concepts: lesson.keyConcepts ?? [],
        progressive_explanation: lesson.progressiveExplanation ?? [],
        common_errors: lesson.commonErrors ?? [],
        remediations: lesson.remediations ?? [],
        everyday_application: lesson.everydayApplication ?? null,
        practice_guidance: lesson.practiceGuidance ?? null,
        assessment_limitations: skill?.assessmentLimitations ?? null,
      };
      lines.push(`  if exists (select 1 from public.learning_skill_lessons where canonical_skill_id = v_skill_id and version = 3 and metadata->>'content_pack' is distinct from ${sql(sourceBatch.packVersion)}) then raise exception ${sql(`V3_LESSON_VERSION_COLLISION:${group.skillCode}`)}; end if;`);
      lines.push(`  insert into public.learning_skill_lessons(canonical_skill_id, version, title, summary, content_markdown, worked_example, tips, estimated_minutes, metadata, active) values (v_skill_id, 3, ${sql(lesson.title)}, ${sql(lesson.summary)}, ${sql(markdownForLesson(lesson))}, ${sql(lesson.workedExample)}, ${textArraySql((lesson.remediations ?? []).map((item) => item.selfCheck))}, ${lesson.estimatedMinutes ?? 18}, ${jsonSql(lessonMeta)}, false) on conflict (canonical_skill_id, version) do update set title = excluded.title, summary = excluded.summary, content_markdown = excluded.content_markdown, worked_example = excluded.worked_example, tips = excluded.tips, estimated_minutes = excluded.estimated_minutes, metadata = excluded.metadata, active = false, updated_at = now() returning id into v_lesson_id;`);
    }

    lines.push(`  select id into v_package_id from public.learning_packages where visibility = 'GLOBAL' and metadata->>'content_pack' = ${sql(sourceBatch.packVersion)} and metadata->>'skill_code' = ${sql(group.skillCode)} limit 1;`);
    lines.push(`  if v_package_id is null then insert into public.learning_packages(package_type, visibility, title, description, subject_area, active, version, metadata) values ('TECESCOLA', 'GLOBAL', ${sql(packageTitle)}, ${sql(group.description)}, ${sql(group.subjectCode)}, false, 3, ${jsonSql(packageMetadata)}) returning id into v_package_id; else update public.learning_packages set title = ${sql(packageTitle)}, description = ${sql(group.description)}, active = false, version = 3, metadata = ${jsonSql(packageMetadata)}, updated_at = now() where id = v_package_id; end if;`);
    lines.push(`  insert into public.learning_package_steps(package_id, position, step_type, lesson_id, title, metadata) values (v_package_id, 0, 'LESSON', v_lesson_id, ${sql(group.lesson.title)}, ${jsonSql({ content_pack: sourceBatch.packVersion, skill_code: group.skillCode, lesson_source: group.lessonKind, staging_only: true })}) on conflict (package_id, position) do update set step_type = 'LESSON', lesson_id = excluded.lesson_id, title = excluded.title, metadata = excluded.metadata;`);
    for (const purpose of PURPOSES) {
      lines.push(`  if exists (select 1 from public.learning_question_sets where scope = 'GLOBAL' and canonical_skill_id = v_skill_id and purpose = ${sql(purpose)} and version = 3 and metadata->>'content_pack' is distinct from ${sql(sourceBatch.packVersion)}) then raise exception ${sql(`V3_QUESTION_SET_VERSION_COLLISION:${group.skillCode}:${purpose}`)}; end if;`);
      lines.push(`  insert into public.learning_question_sets(scope, canonical_skill_id, purpose, version, active, metadata) values ('GLOBAL', v_skill_id, ${sql(purpose)}, 3, false, ${jsonSql({ content_pack: sourceBatch.packVersion, content_version: 3, selection_policy: 'SERVER_SELECTED_V1', publication_status: 'STAGING', pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING', student_available: false })}) on conflict (canonical_skill_id, purpose, version) where scope = 'GLOBAL' do update set active = false, metadata = excluded.metadata, updated_at = now();`);
    }

    const positions = Object.fromEntries(PURPOSES.map((purpose) => [purpose, 0]));
    for (const [questionIndex, item] of group.questions.entries()) {
      const question = item.question;
      const position = positions[question.purpose]++;
      if (item.kind === 'V4_REUSED') {
        lines.push(`  select id into v_question_id from public.learning_question_bank where source_type = 'TECESCOLA_CORE_V4' and metadata->>'content_id' = ${sql(item.sourceId)} limit 1;`);
        lines.push(`  if v_question_id is null then raise exception ${sql(`V3_REUSED_V4_QUESTION_MISSING:${item.sourceId}`)}; end if;`);
      } else {
        const orderedOptions = orderQuestionOptions(question, questionIndex + groupIndex);
        const questionMetadata = {
          content_id: item.sourceId,
          content_pack: sourceBatch.packVersion,
          content_version: 3,
          skill_code: group.skillCode,
          purpose: question.purpose,
          context_family: question.contextFamily,
          cognitive_process: question.cognitiveProcess,
          error_focus: question.errorFocus ?? question.misconceptions?.[0] ?? 'AUTHORED_STAGING_ITEM',
          remediation_hint: question.remediationHint ?? null,
          reused_from: item.kind === 'V1_REUSED' ? 'knowledge-gap-batch-v1' : null,
          mapping_status: 'MAPPING_PENDING',
          pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING',
          publication_status: 'STAGING',
          authoring_provenance: sourceBatch.provenance,
        };
        lines.push('  v_question_id := null;');
        lines.push(`  insert into public.learning_question_bank(package_type, source_type, source_name, subject_area, domain, topic, statement, options, correct_answer, explanation, difficulty, estimated_minutes, provenance, metadata, active) select 'TECESCOLA', 'TECESCOLA_KNOWLEDGE_FACTORY_V3', 'TecEscola BNCC Knowledge Factory V3', ${sql(group.subjectCode)}, ${sql(group.domain)}, ${sql(group.skillCode)}, ${sql(question.statement)}, ${jsonSql(orderedOptions)}, ${jsonSql(question.correctAnswer)}, ${sql(question.explanation)}, ${sql(question.difficulty)}, 3, ${sql(sourceBatch.provenance)}, ${jsonSql(questionMetadata)}, false where not exists (select 1 from public.learning_question_bank existing where existing.source_type = 'TECESCOLA_KNOWLEDGE_FACTORY_V3' and existing.metadata->>'content_id' = ${sql(item.sourceId)}) returning id into v_question_id;`);
        lines.push(`  if v_question_id is null then select id into v_question_id from public.learning_question_bank where source_type = 'TECESCOLA_KNOWLEDGE_FACTORY_V3' and metadata->>'content_id' = ${sql(item.sourceId)} limit 1; end if;`);
        lines.push(`  if v_question_id is null then raise exception ${sql(`V3_QUESTION_INSERT_FAILED:${item.sourceId}`)}; end if;`);
        lines.push(`  update public.learning_question_bank set subject_area = ${sql(group.subjectCode)}, domain = ${sql(group.domain)}, topic = ${sql(group.skillCode)}, statement = ${sql(question.statement)}, options = ${jsonSql(orderedOptions)}, correct_answer = ${jsonSql(question.correctAnswer)}, explanation = ${sql(question.explanation)}, difficulty = ${sql(question.difficulty)}, provenance = ${sql(sourceBatch.provenance)}, metadata = ${jsonSql(questionMetadata)}, active = false where id = v_question_id and source_type = 'TECESCOLA_KNOWLEDGE_FACTORY_V3';`);
      }
      lines.push(`  insert into public.learning_question_bank_skill_links(question_bank_id, canonical_skill_id, skill_role) values (v_question_id, v_skill_id, 'PRIMARY') on conflict (question_bank_id, canonical_skill_id) do nothing;`);
      lines.push(`  select id into v_set_id from public.learning_question_sets where scope = 'GLOBAL' and canonical_skill_id = v_skill_id and purpose = ${sql(question.purpose)} and version = 3;`);
      lines.push(`  insert into public.learning_question_set_items(question_set_id, question_bank_id, position) values (v_set_id, v_question_id, ${position}) on conflict (question_set_id, question_bank_id) do update set position = excluded.position;`);
    }
  }
  lines.push('end $v3$;');
  lines.push('commit;');
  lines.push('');
  return lines.join('\n');
}

function makeNextQueue(inputs, v1, sourceBatch, v2Batch) {
  const usedSkillCodes = new Set(sourceBatch.existingTargets.map((item) => item.targetId));
  const nextExistingSkills = v1.internalSkillGaps.filter((item) => !usedSkillCodes.has(item.skillCode) && item.gaps?.length)
    .sort((left, right) => right.priorityScore - left.priorityScore || left.skillCode.localeCompare(right.skillCode)).slice(0, 12).map((item) => ({
    skillCode: item.skillCode,
    subjectCode: item.subjectCode,
    stage: item.stage,
    gaps: item.gaps,
    priorityScore: item.priorityScore,
    rationale: `Remaining V1 content gaps: ${(item.gaps ?? []).join(', ')}.`,
  }));

  const usedProposalCodes = new Set([
    ...v2Batch.skills.map((skill) => skill.sourceEvidence?.proposalId).filter(Boolean),
    ...sourceBatch.candidateTargets.map((item) => inputs.proposals.proposals.find((proposal) => proposal.canonicalCode === item.targetId)?.proposalId).filter(Boolean),
  ]);
  const clustersById = new Map(inputs.clusters.clusters.map((cluster) => [cluster.clusterId, cluster]));
  const eligible = inputs.proposals.proposals.filter((proposal) => proposal.proposalStatus === 'NEW_SKILL_PENDING_REVIEW' && !usedProposalCodes.has(proposal.proposalId)).map((proposal) => {
    const cluster = clustersById.get(proposal.proposalId.replace('V8_PROPOSAL_', 'V8_GAP_'));
    const descriptorCount = cluster?.officialContext?.descriptorSamples?.length ?? 0;
    const score = (cluster?.semanticObject ? 50 : 0) + (descriptorCount > 0 ? 25 : 0) + Math.min(proposal.officialCodes?.length ?? 0, 5);
    return { proposalId: proposal.proposalId, gapClusterId: cluster?.clusterId ?? null, candidateCanonicalCode: proposal.canonicalCode, title: proposal.title, subject: cluster?.subject ?? null, stage: cluster?.stage ?? null, officialCodes: proposal.officialCodes, priorityScore: score, status: 'NEW_SKILL_PENDING_REVIEW', mappingPromoted: false };
  });
  const codeCounts = new Map();
  for (const item of eligible) codeCounts.set(item.candidateCanonicalCode, (codeCounts.get(item.candidateCanonicalCode) ?? 0) + 1);
  const collisionCodes = new Set(eligible.filter((item) => codeCounts.get(item.candidateCanonicalCode) > 1).map((item) => item.candidateCanonicalCode));
  const buckets = new Map();
  for (const item of eligible.filter((item) => !collisionCodes.has(item.candidateCanonicalCode))) {
    const key = `${item.stage}:${item.subject}`;
    buckets.set(key, [...(buckets.get(key) ?? []), item]);
  }
  const bucketKeys = [...buckets.keys()].sort((left, right) => {
    const scoreDelta = Math.max(...buckets.get(right).map((item) => item.priorityScore)) - Math.max(...buckets.get(left).map((item) => item.priorityScore));
    return scoreDelta || left.localeCompare(right);
  });
  for (const values of buckets.values()) values.sort((left, right) => right.priorityScore - left.priorityScore || String(left.gapClusterId).localeCompare(String(right.gapClusterId)));
  const nextCanonicalCandidates = [];
  while (nextCanonicalCandidates.length < 12 && bucketKeys.some((key) => buckets.get(key).length)) {
    for (const key of bucketKeys) {
      const item = buckets.get(key).shift();
      if (!item) continue;
      nextCanonicalCandidates.push(item);
      if (nextCanonicalCandidates.length === 12) break;
    }
  }
  const distribution = [...nextExistingSkills.map((item) => ({ subject: item.subjectCode, stage: item.stage })), ...nextCanonicalCandidates.map((item) => ({ subject: item.subject, stage: item.stage }))]
    .reduce((result, item) => {
      result.subjects[item.subject] = (result.subjects[item.subject] ?? 0) + 1;
      result.stages[item.stage] = (result.stages[item.stage] ?? 0) + 1;
      return result;
    }, { subjects: {}, stages: {} });
  return {
    selectionPolicy: 'REMAINING_V1_GAPS_AND_V8_PROPOSALS_ROUND_ROBIN_BY_SUBJECT_STAGE',
    existingSkills: nextExistingSkills,
    canonicalCandidates: nextCanonicalCandidates,
    excludedCandidateCodeCollisions: collisionCodes.size,
    subjectDistribution: distribution.subjects,
    stageDistribution: distribution.stages,
  };
}

export function loadKnowledgeFactoryV3Inputs(root = ROOT) {
  const { inputs, batch: v2Batch } = loadKnowledgeFactoryV2Inputs(root);
  return { inputs, v1: readJson(root, V1_PATH), v2Batch, sourceBatch: batch };
}

export function buildKnowledgeFactoryV3({ inputs, v1, v2Batch, sourceBatch = batch }) {
  const baseInventory = buildKnowledgeFactory(inputs);
  const { dossiers, enrichedSkills } = buildCandidateDossiers(inputs, sourceBatch);
  const groups = buildQuestionGroups(inputs, v1, sourceBatch, enrichedSkills);
  const errors = validateKnowledgeFactoryV3(inputs, v1, sourceBatch, enrichedSkills, dossiers, groups);
  if (errors.length) return { errors };

  const candidateIds = new Set(sourceBatch.candidateTargets.map((item) => item.targetId));
  const existingTargets = sourceBatch.existingTargets.map((target) => {
    const group = groups.find((item) => item.skillCode === target.targetId);
    return {
      targetId: target.targetId,
      sourceQueue: 'EXISTING_SKILL_CONTENT_GAPS',
      subject: group.subjectCode,
      stage: group.stage,
      currentStatus: 'COMPLETED_TECHNICALLY_REVIEW_PENDING',
      contentReused: group.questions.filter((item) => item.kind !== 'V3_AUTHORED').length + (group.lessonKind !== 'V3_AUTHORED' ? 1 : 0),
      contentAuthored: group.questions.filter((item) => item.kind === 'V3_AUTHORED').length + (group.lessonKind === 'V3_AUTHORED' ? 1 : 0),
      skillCreatedOrReused: 'EXISTING_SKILL_REUSED',
      unitCreatedOrReused: inputs.v4Units.units.some((unit) => unit.unitId === group.unitId) ? 'EXISTING_UNIT_REUSED' : 'NEW_UNIT',
      lessonStatus: group.lessonKind,
      questionStatus: { total: group.questions.length, purposes: Object.fromEntries(PURPOSES.map((purpose) => [purpose, group.questions.filter((item) => item.question.purpose === purpose).length])) },
      graphValidation: 'PASS_NO_EXISTING_NODE_MUTATION',
      databaseCompilation: 'STAGING_INACTIVE',
      reviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      blockingReason: 'Human pedagogical review and any official mapping decision remain pending.',
    };
  });
  const newCandidates = sourceBatch.candidateTargets.map((candidate) => {
    const candidateSkills = enrichedSkills.filter((skill) => skill.sourceCandidate === candidate.targetId);
    const reused = candidate.status === 'REUSED_EXISTING_SKILL';
    const childSkillCodes = candidate.childSkillCodes ?? (candidate.reusedSkillCode ? [candidate.reusedSkillCode] : []);
    const mappedGroups = childSkillCodes.map((code) => groups.find((group) => group.skillCode === code)).filter(Boolean);
    return {
      targetId: candidate.targetId,
      sourceQueue: 'V8_PROPOSALS_V8',
      subject: inputs.clusters.clusters.find((cluster) => cluster.clusterId === inputs.proposals.proposals.find((proposal) => proposal.canonicalCode === candidate.targetId)?.proposalId.replace('V8_PROPOSAL_', 'V8_GAP_'))?.subject ?? null,
      stage: inputs.clusters.clusters.find((cluster) => cluster.clusterId === inputs.proposals.proposals.find((proposal) => proposal.canonicalCode === candidate.targetId)?.proposalId.replace('V8_PROPOSAL_', 'V8_GAP_'))?.stage ?? null,
      currentStatus: 'COMPLETED_TECHNICALLY_REVIEW_PENDING',
      contentReused: mappedGroups.reduce((sum, group) => sum + group.questions.filter((item) => item.kind !== 'V3_AUTHORED').length + (group.lessonKind !== 'V3_AUTHORED' ? 1 : 0), 0),
      contentAuthored: mappedGroups.reduce((sum, group) => sum + group.questions.filter((item) => item.kind === 'V3_AUTHORED').length + (group.lessonKind === 'V3_AUTHORED' ? 1 : 0), 0),
      skillCreatedOrReused: reused ? `EXISTING_SKILL_REUSED:${candidate.reusedSkillCode}` : candidateSkills.map((skill) => skill.skillCode),
      unitCreatedOrReused: [...new Set(mappedGroups.map((group) => inputs.v4Units.units.some((unit) => unit.unitId === group.unitId) ? 'EXISTING_UNIT_REUSED' : 'NEW_UNIT'))],
      lessonStatus: mappedGroups.map((group) => `${group.skillCode}:${group.lessonKind}`),
      questionStatus: mappedGroups.map((group) => ({ skillCode: group.skillCode, total: group.questions.length, purposes: Object.fromEntries(PURPOSES.map((purpose) => [purpose, group.questions.filter((item) => item.question.purpose === purpose).length])) })),
      graphValidation: 'PASS_STAGING_ONLY_NO_MAPPING_PROMOTION',
      databaseCompilation: 'STAGING_INACTIVE',
      reviewStatus: 'MAPPING_PENDING; PEDAGOGICAL_REVIEW_PENDING',
      blockingReason: null,
    };
  });

  const contentHash = sha256(stableJson({
    sourceBatch,
    v1Reuse: sourceBatch.v1Reuse.map((code) => v1.skills.find((skill) => skill.code === code)),
    sourceDossiers: dossiers,
    sourceHashes: inputs.sourceHashes,
  }));
  const graph = buildGraphExpansion(inputs, sourceBatch, enrichedSkills, groups, dossiers, contentHash);
  const units = buildUnitExpansion(inputs, sourceBatch, groups);
  const completeSequences = groups.filter((group) => PURPOSES.every((purpose) => group.questions.some((item) => item.question.purpose === purpose))).length;
  const authoredQuestions = groups.reduce((sum, group) => sum + group.questions.filter((item) => item.kind === 'V3_AUTHORED').length, 0);
  const reusedV1Questions = groups.reduce((sum, group) => sum + group.questions.filter((item) => item.kind === 'V1_REUSED').length, 0);
  const reusedV4Questions = groups.reduce((sum, group) => sum + group.questions.filter((item) => item.kind === 'V4_REUSED').length, 0);
  const newLessons = groups.filter((group) => group.lessonKind === 'V3_AUTHORED').length;
  const reusedLessons = groups.filter((group) => group.lessonKind === 'V1_REUSED' || group.lessonKind === 'V4_REUSED').length;
  const nextQueue = makeNextQueue(inputs, baseInventory, sourceBatch, v2Batch);
  const reportBody = {
    schemaVersion: 'tec-escola.bncc.knowledge-factory-inventory.v3',
    campaign: 'TECESCOLA_BNCC_KNOWLEDGE_FACTORY_V3_24_TARGETS_CONTENT_EXPANSION',
    factoryVersion: 'V3',
    foundation: { graphHash: inputs.graph.graphHash, unitsHash: inputs.v4Units.unitsHash, v1InventoryHash: baseInventory.inventoryHash },
    hashes: { contentHash, graphExpansionHash: graph.expansionHash, unitExpansionHash: units.expansionHash },
    targets: { originalTargets: 24, existingSkillTargets: 12, newCandidateTargets: 12, processed: existingTargets.length + newCandidates.length, existingSkillsCompleted: existingTargets.filter((target) => target.currentStatus === 'COMPLETED_TECHNICALLY_REVIEW_PENDING').length, candidatesAnalyzed: newCandidates.length, targetManifest: [...existingTargets, ...newCandidates] },
    candidates: {
      newInternalSkillsCreated: enrichedSkills.length,
      candidatesReused: sourceBatch.candidateTargets.filter((item) => item.status === 'REUSED_EXISTING_SKILL').length,
      proposalsSplit: sourceBatch.candidateTargets.filter((item) => item.status === 'SPLIT_INTO_MULTIPLE_SKILLS').length,
      deferredOfficialCodes: sourceBatch.nextQueue.map((item) => ({ ...item, mappingStatus: 'MAPPING_PENDING' })),
      safeReplacementsSelected: 0,
      sourceDossierCount: dossiers.length,
    },
    officialCatalog: {
      officialNodes: baseInventory.baseline.officialNodes,
      canonicalGapsBefore: baseInventory.baseline.officialMappingStatuses.CANONICAL_GAP,
      canonicalGapsAfter: baseInventory.baseline.officialMappingStatuses.CANONICAL_GAP,
      canonicalGapReduction: 0,
      mappingProposalsPrepared: sourceBatch.candidateTargets.length,
      officialCodeReferencesDossiered: dossiers.length,
      mappingsHumanReviewed: 0,
      mappingsPromoted: 0,
      mappingStatus: 'MAPPING_PENDING',
      pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    },
    curriculum: {
      newUnits: units.summary.newUnits,
      reusedUnits: units.summary.reusedExistingUnits,
      graphUnitReferences: units.summary.newSkillMemberships + units.summary.existingSkillReferences,
      persistedUnitRows: 0,
    },
    content: {
      subjects: [...new Set(groups.map((group) => group.subjectCode))].sort(),
      stages: [...new Set(groups.map((group) => group.stage))].sort(),
      newLessons,
      reusedLessons,
      newQuestions: authoredQuestions,
      reusedV1Questions,
      reusedV4Questions,
      reusedQuestions: reusedV1Questions + reusedV4Questions,
      versionedQuestionBankRowsInserted: authoredQuestions + reusedV1Questions,
      questionSetItems: groups.reduce((sum, group) => sum + group.questions.length, 0),
      completeAdaptiveSequences: completeSequences,
      skillSequenceCounts: Object.fromEntries(groups.map((group) => [group.skillCode, Object.fromEntries(PURPOSES.map((purpose) => [purpose, group.questions.filter((item) => item.question.purpose === purpose).length]))])),
      sourceExclusions: sourceBatch.sourceExclusions,
      excludedExistingQuestions: sourceBatch.sourceExclusions.length,
    },
    validation: {
      graphValidation: 'PASS',
      contentStructureValidation: 'PASS_NOT_PEDAGOGICAL_APPROVAL',
      answerKeyValidation: 'PASS',
      adaptiveSequenceValidation: completeSequences === groups.length ? 'PASS' : 'FAIL',
      deterministicOutput: true,
      databaseCompilation: 'GENERATED_STAGING_ONLY',
      studentEligibleRows: 0,
    },
    safety: {
      publicationStatus: 'STAGING',
      mappingStatus: 'MAPPING_PENDING',
      pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      newContentPublished: false,
      studentAvailableContent: 0,
      existingSkillStatesChanged: 0,
      studentHistoryModified: false,
      productionWrites: false,
      otherServicesTouched: false,
    },
    nextCampaign: nextQueue,
  };
  const report = { ...reportBody, inventoryHash: sha256(stableJson(reportBody)) };
  const compiledBatch = {
    ...sourceBatch,
    newSkills: enrichedSkills,
    sourceDossiers: dossiers,
    compiledSkillSequences: groups.map((group) => ({ skillCode: group.skillCode, unitId: group.unitId, lessonKind: group.lessonKind, lessonTitle: group.lesson.title, questionCount: group.questions.length, reusedV1Questions: group.questions.filter((item) => item.kind === 'V1_REUSED').length, reusedV4Questions: group.questions.filter((item) => item.kind === 'V4_REUSED').length, authoredQuestions: group.questions.filter((item) => item.kind === 'V3_AUTHORED').length, purposeCounts: Object.fromEntries(PURPOSES.map((purpose) => [purpose, group.questions.filter((item) => item.question.purpose === purpose).length])) })),
    contentHash,
  };
  const sqlText = buildStagingSql(sourceBatch, enrichedSkills, groups, graph, units, report, contentHash);
  report.hashes.stagingSqlHash = sha256(sqlText);
  report.inventoryHash = sha256(stableJson(Object.fromEntries(Object.entries(report).filter(([key]) => key !== 'inventoryHash'))));
  return { report, graph, units, compiledBatch, sql: sqlText, groups, errors: [] };
}

const OUTPUTS = [
  [BATCH_PATH, 'compiledBatch'],
  [GRAPH_PATH, 'graph'],
  [UNITS_PATH, 'units'],
  [REPORT_PATH, 'report'],
];

export function compileKnowledgeFactoryV3(root = ROOT, check = false) {
  const loaded = loadKnowledgeFactoryV3Inputs(root);
  const result = buildKnowledgeFactoryV3(loaded);
  if (result.errors?.length) throw new Error(`KNOWLEDGE_FACTORY_V3_INVALID\n${result.errors.join('\n')}`);
  const normalizedSql = result.sql.replace(/\r\n/g, '\n');
  if (check) {
    for (const [relativePath, key] of OUTPUTS) {
      const outputPath = path.join(root, relativePath);
      if (!fs.existsSync(outputPath)) throw new Error(`KNOWLEDGE_FACTORY_V3_OUTPUT_MISSING:${relativePath}`);
      const current = readJson(root, relativePath);
      const expected = result[key];
      const hashKey = key === 'graph' ? 'expansionHash' : key === 'units' ? 'expansionHash' : key === 'report' ? 'inventoryHash' : 'contentHash';
      if (current[hashKey] !== expected[hashKey]) throw new Error(`KNOWLEDGE_FACTORY_V3_OUTPUT_STALE:${relativePath}`);
    }
    const sqlPath = path.join(root, SQL_PATH);
    if (!fs.existsSync(sqlPath) || hashSourceContent(fs.readFileSync(sqlPath)) !== hashSourceContent(normalizedSql)) throw new Error(`KNOWLEDGE_FACTORY_V3_OUTPUT_STALE:${SQL_PATH}`);
    return result.report;
  }
  for (const [relativePath, key] of OUTPUTS) {
    const outputPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(result[key], null, 2)}\n`, 'utf8');
  }
  const sqlPath = path.join(root, SQL_PATH);
  fs.mkdirSync(path.dirname(sqlPath), { recursive: true });
  fs.writeFileSync(sqlPath, normalizedSql, 'utf8');
  return result.report;
}

function run() {
  const check = process.argv.includes('--check');
  const report = compileKnowledgeFactoryV3(ROOT, check);
  console.log(`BNCC_KNOWLEDGE_FACTORY_V3=${check ? 'CHECK_PASS' : 'COMPILED'}`);
  console.log(`BNCC_KNOWLEDGE_FACTORY_V3_TARGETS=${report.targets.processed}/24`);
  console.log(`BNCC_KNOWLEDGE_FACTORY_V3_SKILLS=${report.candidates.newInternalSkillsCreated}`);
  console.log(`BNCC_KNOWLEDGE_FACTORY_V3_CONTENT=${report.content.newLessons} lessons/${report.content.newQuestions} authored questions/${report.content.reusedQuestions} reused questions`);
  console.log(`BNCC_KNOWLEDGE_FACTORY_V3_SEQUENCES=${report.content.completeAdaptiveSequences}`);
  console.log(`BNCC_KNOWLEDGE_FACTORY_V3_MAPPING=0 promoted; ${report.officialCatalog.mappingProposalsPrepared} proposals pending`);
  console.log(`BNCC_KNOWLEDGE_FACTORY_V3_PUBLICATION=STAGING; student_available=${report.safety.studentAvailableContent}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
