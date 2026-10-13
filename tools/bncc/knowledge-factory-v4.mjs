import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildKnowledgeFactoryV3, loadKnowledgeFactoryV3Inputs } from './knowledge-factory-v3.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PATHS = {
  official: 'content/bncc/official/catalog-2018.json',
  officialManifest: 'content/bncc/official/manifest.json',
  regulatoryContext: 'content/bncc/official/regulatory-context-v4.json',
  v1: 'content/bncc/authoring/knowledge-factory-inventory-v1.json',
  v3: 'content/bncc/authoring/knowledge-factory-inventory-v3.json',
  v3Units: 'content/bncc/authoring/curriculum-unit-expansion-v3.json',
  units: 'content/bncc/curriculum/units-v5.json',
  report: 'content/bncc/authoring/knowledge-factory-inventory-v4.json',
  checkpoint: 'content/bncc/authoring/knowledge-factory-checkpoint-v4.json',
  docket: 'content/bncc/authoring/knowledge-factory-v4-review-docket.json',
  stagingSql: 'content/bncc/authoring/curriculum-units-v4-staging.sql',
};
const PURPOSES = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];
const MINIMUMS = { PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 };
const OUTPUTS = ['report', 'checkpoint', 'docket', 'stagingSql'];

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

export function hashNormalizedText(value) {
  return hash(String(value).replace(/\r\n/g, '\n'));
}

function hashFile(root, relativePath) {
  return hashNormalizedText(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function sql(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

function jsonSql(value) {
  return `${sql(JSON.stringify(value))}::jsonb`;
}

function groupBy(items, selector) {
  const grouped = new Map();
  for (const item of items) {
    const key = selector(item) ?? 'UNSPECIFIED';
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return Object.fromEntries([...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, rows]) => [key, rows.length]));
}

function hasNeighboringCode(text, ownCode) {
  return [...String(text ?? '').matchAll(/\(([A-Z]{2}\d{2}[A-Z]{2,3}\d{2,3})\)/g)]
    .some((match) => match[1] !== ownCode);
}

function exactSkillIndex() {
  const skills = [];
  const subjectsRoot = path.join(ROOT, 'content/adaptive/tec-escola-core-v4/subjects');
  for (const subject of fs.readdirSync(subjectsRoot).sort()) {
    const source = readJson(ROOT, `content/adaptive/tec-escola-core-v4/subjects/${subject}/skills.json`);
    skills.push(...(source.anchors ?? []), ...(source.leaves ?? []));
  }
  return new Map(skills.map((skill) => [skill.code ?? skill.skillCode, skill]));
}

function buildOfficialMatrix(catalog, inventory, skillIndex) {
  const inventoryByCode = new Map(inventory.officialNodes.map((node) => [node.officialCode, node]));
  return catalog.nodes.map((node) => {
    const tracked = inventoryByCode.get(node.code);
    if (!tracked) throw new Error(`OFFICIAL_NODE_NOT_IN_V1_INVENTORY:${node.code}`);
    const verifiedSkills = (tracked.verifiedCanonicalSkillCodes ?? []).filter((code) => skillIndex.has(code));
    const unknownVerifiedSkills = (tracked.verifiedCanonicalSkillCodes ?? []).filter((code) => !skillIndex.has(code));
    return {
      officialCode: node.code,
      stage: node.stage,
      kind: node.kind,
      requirementType: node.kind === 'SKILL' ? 'TEACHABLE_SKILL_REQUIREMENT' : 'DEVELOPMENT_OBJECTIVE_REQUIRES_EXPERIENTIAL_DESIGN',
      gradeOrRange: node.gradeOrRange,
      componentCode: node.componentCode,
      source: node.officialSource,
      sourceTextStatus: hasNeighboringCode(node.officialTextExcerpt, node.code)
        ? 'NEIGHBORING_OFFICIAL_CODE_PRESENT_REQUIRES_SOURCE_REVIEW'
        : 'AUTOMATED_EXTRACTION_NOT_HUMAN_VERIFIED',
      mappingStatus: tracked.mappingStatus,
      candidateProposalId: tracked.candidateProposalId ?? null,
      verifiedCanonicalSkillCodes: verifiedSkills,
      missingVerifiedSkillRecords: unknownVerifiedSkills,
      contentLinkStatus: verifiedSkills.length ? 'EXACT_VERIFIED_LINK_ONLY' : 'NO_VERIFIED_CONTENT_LINK',
      pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      nextAction: tracked.mappingStatus === 'MAPPED'
        ? 'REVIEW_SOURCE_AND_CONTENT_DEPTH'
        : tracked.mappingStatus === 'HUMAN_REVIEW_BLOCKED'
          ? 'HUMAN_DECISION_REQUIRED'
          : node.kind === 'LEARNING_DEVELOPMENT_OBJECTIVE'
            ? 'AUTHOR_EXPERIENTIAL_EVIDENCE_AND_REVIEW_SOURCE'
            : 'VERIFY_SOURCE_TEXT_THEN_DECIDE_CANONICAL_MAPPING',
    };
  }).sort((a, b) => a.officialCode.localeCompare(b.officialCode));
}

function countPurposes(group) {
  return Object.fromEntries(PURPOSES.map((purpose) => [
    purpose,
    group.questions.filter(({ question }) => question.purpose === purpose).length,
  ]));
}

function lessonReadiness(lesson) {
  if (!lesson) return 'NO_LESSON';
  const complete = typeof lesson.objective === 'string' && lesson.objective.trim()
    && Array.isArray(lesson.keyConcepts) && lesson.keyConcepts.length >= 2
    && Array.isArray(lesson.progressiveExplanation) && lesson.progressiveExplanation.length >= 2
    && typeof lesson.workedExample === 'string' && lesson.workedExample.trim()
    && Array.isArray(lesson.commonErrors) && lesson.commonErrors.length > 0;
  return complete ? 'STRUCTURED_LESSON_CANDIDATE' : 'LESSON_DEPTH_REVIEW_REQUIRED';
}

function groupDepthAudit(groups) {
  return groups.map((group) => {
    const purposeCounts = countPurposes(group);
    const missingMinimums = Object.fromEntries(PURPOSES
      .filter((purpose) => purposeCounts[purpose] < MINIMUMS[purpose])
      .map((purpose) => [purpose, { current: purposeCounts[purpose], target: MINIMUMS[purpose] }]));
    const modalities = [...new Set(group.questions.map(({ question }) => question.type ?? question.responseType ?? (Array.isArray(question.options) ? 'MULTIPLE_CHOICE' : 'UNSPECIFIED')))].sort();
    const isPracticalSubject = ['ART', 'PHYSICAL_EDUCATION'].includes(group.subjectCode);
    const status = PURPOSES.every((purpose) => purposeCounts[purpose] > 0) && group.lesson
      ? 'STRUCTURAL_READY'
      : group.lesson || group.questions.length
        ? 'PARTIAL_CONTENT_READY'
        : 'GRAPH_ONLY';
    return {
      targetId: group.skillCode,
      unitId: group.unitId,
      subject: group.subjectCode,
      stage: group.stage,
      currentDepthStatus: status,
      lessonStatus: lessonReadiness(group.lesson),
      lessonTitle: group.lesson?.title ?? null,
      currentQuestionCount: group.questions.length,
      purposeCounts,
      minimumTargets: isPracticalSubject ? 'AUTHENTIC_PRACTICAL_OR_OBSERVATIONAL_EVIDENCE_REQUIRED' : MINIMUMS,
      missingMinimums: isPracticalSubject ? {} : missingMinimums,
      distinctQuestionModalities: modalities,
      misconceptionRecoveryStatus: (group.lesson?.remediations?.length ?? 0) > 0 ? 'REMEDIATION_CANDIDATE_PRESENT' : 'REMEDIATION_GAP',
      spacedReviewStatus: purposeCounts.REVIEW > 0 ? 'REVIEW_ITEMS_PRESENT_NOT_SPACING_PROVEN' : 'REVIEW_GAP',
      readinessClaim: 'NOT_DEEP_CONTENT_READY',
      nextAction: isPracticalSubject ? 'AUTHOR_AND_REVIEW_AUTHENTIC_PERFORMANCE_EVIDENCE' : 'DEEPEN_DISTINCT_ASSESSMENT_POOL',
      reviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    };
  }).sort((a, b) => a.targetId.localeCompare(b.targetId));
}

function buildUnitStagingSql(units) {
  return buildUnitStagingSqlSafe(units);
  const unitRows = units.map((unit) => {
    const metadata = {
      sourcePack: unit.packageVersion,
      provenance: unit.provenance,
      sourceUnitId: unit.unitId,
      subjectName: unit.subjectName,
      learningGoals: unit.learningGoals,
      prerequisites: unit.prerequisites,
      sequence: unit.sequence,
      evidenceMode: unit.evidenceMode,
      sourceReviewStatus: unit.reviewStatus,
      sourceAvailabilityIsNotPublication: unit.availability,
    };
    return `    (v_catalog_id, ${sql(unit.unitId)}, ${sql(unit.title)}, ${sql(unit.description)}, ${sql(unit.stage)}, ${sql(unit.subjectCode)}, ${sql(unit.domain)}, ${unit.gradeFrom}, ${unit.gradeTo}, '{}'::text[], 'NOT_CLAIMED', 'PEDAGOGICAL_REVIEW_PENDING', 'STAGING', false, ${jsonSql(metadata)})`;
  });
  const memberships = units.flatMap((unit) => unit.canonicalSkills.map((skillCode, index) =>
    `  (${sql(unit.unitId)}, ${sql(skillCode)}, ${index + 1}, ${jsonSql({ sourcePack: unit.packageVersion, sourceUnitId: unit.unitId, bnccAlignment: 'NOT_CLAIMED' })})`));
  return `-- Generated by tools/bncc/knowledge-factory-v4.mjs. Staging only; do not apply without the approved migration/review workflow.\n-- All rows are inactive, not mapped to BNCC, and pending human pedagogical review.\nbegin;\ndo $seed$ declare v_catalog_id uuid; missing_codes text; begin\n  select id into v_catalog_id from public.learning_curriculum_catalogs where code = 'TECESCOLA_CORE' and version = '1.0' limit 1;\n  if v_catalog_id is null then raise exception 'TECESCOLA_CORE_CATALOG_MISSING'; end if;\n  select string_agg(distinct source.skill_code, ', ' order by source.skill_code) into missing_codes\n  from (values\n${memberships.map((line) => `    (${line.trim().replace(/^\(|\)$/, '')})`).join(',\n')}\n  ) as source(unit_code, skill_code, position, metadata)\n  left join public.learning_curriculum_skills skill on skill.catalog_id = v_catalog_id and skill.code = source.skill_code\n  where skill.id is null;\n  if missing_codes is not null then raise exception 'CURRICULUM_UNIT_SKILLS_MISSING:%', missing_codes; end if;\n  insert into public.learning_curriculum_units(catalog_id, code, title, description, stage, subject_area, domain, grade_from, grade_to, official_codes, bncc_alignment_status, pedagogical_review_status, publication_status, active, metadata)\n  values\n${rows.map((line) => `    (${sql('TECESCOLA_CORE')}, ${sql('')}, ${sql('')}, ${sql('')}, ${sql('')}, ${sql('')}, ${sql('')}, 1, 1, '{}'::text[], 'NOT_CLAIMED', 'PEDAGOGICAL_REVIEW_PENDING', 'STAGING', false, '{}'::jsonb)`).length ? rows.map((line, index) => {
    const unit = units[index];
    const metadata = { sourcePack: unit.packageVersion, provenance: unit.provenance, sourceUnitId: unit.unitId, subjectName: unit.subjectName, learningGoals: unit.learningGoals, prerequisites: unit.prerequisites, sequence: unit.sequence, evidenceMode: unit.evidenceMode, sourceReviewStatus: unit.reviewStatus, sourceAvailabilityIsNotPublication: unit.availability };
    return `    (v_catalog_id, ${sql(unit.unitId)}, ${sql(unit.title)}, ${sql(unit.description)}, ${sql(unit.stage)}, ${sql(unit.subjectCode)}, ${sql(unit.domain)}, ${unit.gradeFrom}, ${unit.gradeTo}, '{}'::text[], 'NOT_CLAIMED', 'PEDAGOGICAL_REVIEW_PENDING', 'STAGING', false, ${jsonSql(metadata)})`;
  }).join(',\n') : ''}\n  on conflict (catalog_id, code) do update set\n    title = excluded.title, description = excluded.description, stage = excluded.stage, subject_area = excluded.subject_area, domain = excluded.domain, grade_from = excluded.grade_from, grade_to = excluded.grade_to, metadata = excluded.metadata\n  where public.learning_curriculum_units.active is false and public.learning_curriculum_units.publication_status = 'STAGING' and public.learning_curriculum_units.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING';\n  insert into public.learning_curriculum_unit_skills(unit_id, canonical_skill_id, position, active, metadata)\n  select unit.id, skill.id, source.position, false, source.metadata\n  from (values\n${memberships.map((line) => `    (${line.trim().replace(/^\(|\)$/, '')})`).join(',\n')}\n  ) as source(unit_code, skill_code, position, metadata)\n  join public.learning_curriculum_units unit on unit.catalog_id = v_catalog_id and unit.code = source.unit_code and unit.active is false\n  join public.learning_curriculum_skills skill on skill.catalog_id = v_catalog_id and skill.code = source.skill_code\n  on conflict (unit_id, canonical_skill_id) do nothing;\nend $seed$;\ncommit;\n`;
}

function buildUnitStagingSqlSafe(units) {
  const unitRows = units.map((unit) => {
    const metadata = {
      sourcePack: unit.packageVersion,
      provenance: unit.provenance,
      sourceUnitId: unit.unitId,
      subjectName: unit.subjectName,
      learningGoals: unit.learningGoals,
      prerequisites: unit.prerequisites,
      sequence: unit.sequence,
      evidenceMode: unit.evidenceMode,
      sourceReviewStatus: unit.reviewStatus,
      sourceAvailabilityIsNotPublication: unit.availability,
    };
    return `(v_catalog_id, ${sql(unit.unitId)}, ${sql(unit.title)}, ${sql(unit.description)}, ${sql(unit.stage)}, ${sql(unit.subjectCode)}, ${sql(unit.domain)}, ${unit.gradeFrom}, ${unit.gradeTo}, '{}'::text[], 'NOT_CLAIMED', 'PEDAGOGICAL_REVIEW_PENDING', 'STAGING', false, ${jsonSql(metadata)})`;
  });
  const memberships = units.flatMap((unit) => unit.canonicalSkills.map((skillCode, index) =>
    `(${sql(unit.unitId)}, ${sql(skillCode)}, ${index + 1}, ${jsonSql({ sourcePack: unit.packageVersion, sourceUnitId: unit.unitId, bnccAlignment: 'NOT_CLAIMED' })})`));
  const membershipsValues = memberships.join(',\n    ');
  return `-- Generated by tools/bncc/knowledge-factory-v4.mjs. Staging only; apply only through the approved deployment workflow.\n-- Run knowledge-factory-v3-staging.sql first so its 13 new canonical skill rows exist.\n-- All rows are inactive, not mapped to BNCC, and pending human pedagogical review.\nbegin;\ndo $seed$ declare v_catalog_id uuid; missing_codes text; begin\n  select id into v_catalog_id from public.learning_curriculum_catalogs where code = 'TECESCOLA_CORE' and version = '1.0' limit 1;\n  if v_catalog_id is null then raise exception 'TECESCOLA_CORE_CATALOG_MISSING'; end if;\n  select string_agg(distinct source.skill_code, ', ' order by source.skill_code) into missing_codes from (values\n    ${membershipsValues}\n  ) as source(unit_code, skill_code, position, metadata) left join public.learning_curriculum_skills skill on skill.catalog_id = v_catalog_id and skill.code = source.skill_code where skill.id is null;\n  if missing_codes is not null then raise exception 'CURRICULUM_UNIT_SKILLS_MISSING:%', missing_codes; end if;\n  insert into public.learning_curriculum_units(catalog_id, code, title, description, stage, subject_area, domain, grade_from, grade_to, official_codes, bncc_alignment_status, pedagogical_review_status, publication_status, active, metadata) values\n    ${unitRows.join(',\n    ')}\n  on conflict (catalog_id, code) do update set title = excluded.title, description = excluded.description, stage = excluded.stage, subject_area = excluded.subject_area, domain = excluded.domain, grade_from = excluded.grade_from, grade_to = excluded.grade_to, metadata = excluded.metadata where public.learning_curriculum_units.active is false and public.learning_curriculum_units.publication_status = 'STAGING' and public.learning_curriculum_units.pedagogical_review_status = 'PEDAGOGICAL_REVIEW_PENDING';\n  insert into public.learning_curriculum_unit_skills(unit_id, canonical_skill_id, position, active, metadata) select unit.id, skill.id, source.position, false, source.metadata from (values\n    ${membershipsValues}\n  ) as source(unit_code, skill_code, position, metadata) join public.learning_curriculum_units unit on unit.catalog_id = v_catalog_id and unit.code = source.unit_code and unit.active is false join public.learning_curriculum_skills skill on skill.catalog_id = v_catalog_id and skill.code = source.skill_code on conflict (unit_id, canonical_skill_id) do nothing;\nend $seed$;\ncommit;\n`;
}

function buildKnowledgeFactoryV4(root = ROOT) {
  const official = readJson(root, PATHS.official);
  const officialManifest = readJson(root, PATHS.officialManifest);
  const regulatoryContext = readJson(root, PATHS.regulatoryContext);
  const v1 = readJson(root, PATHS.v1);
  const v3 = readJson(root, PATHS.v3);
  const v3UnitExpansion = readJson(root, PATHS.v3Units);
  const unitCatalog = readJson(root, PATHS.units);
  const v3Result = buildKnowledgeFactoryV3(loadKnowledgeFactoryV3Inputs(root));
  if (v3Result.errors?.length) throw new Error(`V3_FOUNDATION_INVALID:${v3Result.errors.join(',')}`);
  const skillIndex = exactSkillIndex();
  for (const skill of v3Result.compiledBatch.newSkills) skillIndex.set(skill.skillCode, skill);
  const matrix = buildOfficialMatrix(official, v1, skillIndex);
  const depth = groupDepthAudit(v3Result.groups);
  const v3GroupsBySkill = new Map(v3Result.groups.map((group) => [group.skillCode, group]));
  const units = unitCatalog.units.map((unit) => ({ ...unit, canonicalSkills: [...unit.canonicalSkills], sequence: [...unit.sequence] }));
  const unitsById = new Map(units.map((unit) => [unit.unitId, unit]));
  for (const extension of v3UnitExpansion.existingUnitExtensions) {
    const unit = unitsById.get(extension.unitId);
    if (!unit) throw new Error(`V3_UNIT_EXTENSION_TARGET_NOT_FOUND:${extension.unitId}`);
    for (const skillCode of extension.addCanonicalSkills) {
      if (unit.canonicalSkills.includes(skillCode)) continue;
      unit.canonicalSkills.push(skillCode);
      const group = v3GroupsBySkill.get(skillCode);
      if (group) unit.sequence.push({ position: unit.sequence.length + 1, skillCode, readiness: 'STAGING', contentStatus: 'PEDAGOGICAL_REVIEW_PENDING', evidenceMode: unit.evidenceMode, lessonCount: 1, questionCount: group.questions.length });
    }
  }
  for (const sourceUnit of v3UnitExpansion.newUnits) {
    if (unitsById.has(sourceUnit.unitId)) throw new Error(`V3_NEW_UNIT_ID_COLLISION:${sourceUnit.unitId}`);
    const sequence = sourceUnit.canonicalSkills.map((skillCode, index) => {
      const group = v3GroupsBySkill.get(skillCode);
      return { position: index + 1, skillCode, readiness: 'STAGING', contentStatus: 'PEDAGOGICAL_REVIEW_PENDING', evidenceMode: sourceUnit.subjectCode === 'ART' || sourceUnit.subjectCode === 'PHYSICAL_EDUCATION' ? 'AUTHENTIC_PRACTICAL' : 'OBJECTIVE_WITH_SCAFFOLD', lessonCount: group?.lesson ? 1 : 0, questionCount: group?.questions.length ?? 0 };
    });
    const unit = {
      ...sourceUnit,
      packageVersion: 'tec-escola-core-v9-v3',
      provenance: 'TECESCOLA_DERIVED_VERSIONED_CONTENT',
      prerequisites: sourceUnit.prerequisiteUnitIds,
      sequence,
      evidenceMode: sequence[0]?.evidenceMode ?? 'OBJECTIVE_WITH_SCAFFOLD',
      availability: sourceUnit.availability,
    };
    units.push(unit);
    unitsById.set(unit.unitId, unit);
  }
  const unknownUnitSkills = [...new Set(units.flatMap((unit) => unit.canonicalSkills))].filter((code) => !skillIndex.has(code));
  const sourceHashes = Object.fromEntries([
    ...Object.entries(PATHS).filter(([key]) => ['official', 'officialManifest', 'regulatoryContext', 'v1', 'v3', 'v3Units', 'units'].includes(key)).map(([key, relativePath]) => [key, hashFile(root, relativePath)]),
    ['v3Content', v3.hashes.contentHash],
    ['v3Graph', v3.hashes.graphExpansionHash],
    ['v3Units', v3.hashes.unitExpansionHash],
  ]);
  const byStage = groupBy(matrix, (node) => node.stage);
  const byComponent = groupBy(matrix, (node) => node.componentCode);
  const byKind = groupBy(matrix, (node) => node.kind);
  const byMappingStatus = groupBy(matrix, (node) => node.mappingStatus);
  const neighboringCodesForReview = matrix.filter((node) => node.sourceTextStatus === 'NEIGHBORING_OFFICIAL_CODE_PRESENT_REQUIRES_SOURCE_REVIEW').length;
  const v3Targets = v3.targets.targetManifest;
  const deepCoverage = depth.filter((item) => item.readinessClaim === 'DEEP_CONTENT_READY').length;
  const waveQueue = [
    ...depth.filter((item) => item.nextAction !== 'AUTHOR_AND_REVIEW_AUTHENTIC_PERFORMANCE_EVIDENCE' && Object.keys(item.missingMinimums).length).map((item) => ({ wave: 1, id: item.targetId, stage: item.stage, subject: item.subject, status: 'DEPTH_GAP', reason: 'One or more purpose-specific pools are below the V4 deep-assessment minimum.', missingMinimums: item.missingMinimums })),
    ...depth.filter((item) => item.nextAction === 'AUTHOR_AND_REVIEW_AUTHENTIC_PERFORMANCE_EVIDENCE').map((item) => ({ wave: 1, id: item.targetId, stage: item.stage, subject: item.subject, status: 'AUTHENTIC_EVIDENCE_GAP', reason: 'Objective questions alone cannot substantiate performance or observation evidence.' })),
    ...v1.internalSkillGaps.filter((skill) => !depth.some((item) => item.targetId === skill.skillCode)).map((skill) => ({ wave: 2, id: skill.skillCode, stage: skill.stage, subject: skill.subjectCode, status: skill.gaps?.length ? 'CONTENT_GAP' : 'DEPTH_AUDIT_REQUIRED', reason: skill.gaps?.join(', ') || 'Current source inventory lacks a V4 depth audit.' })),
    ...matrix.filter((node) => node.mappingStatus !== 'MAPPED').map((node) => ({ wave: 3, id: node.officialCode, stage: node.stage, subject: node.componentCode, status: node.sourceTextStatus === 'NEIGHBORING_OFFICIAL_CODE_PRESENT_REQUIRES_SOURCE_REVIEW' ? 'SOURCE_TEXT_REVIEW_REQUIRED' : 'MAPPING_REVIEW_REQUIRED', reason: node.nextAction })),
  ].sort((a, b) => a.wave - b.wave || a.stage.localeCompare(b.stage) || a.subject.localeCompare(b.subject) || a.id.localeCompare(b.id));
  const sourceDossierByCode = new Map(v3Result.compiledBatch.sourceDossiers.filter((item) => item.officialCode).map((item) => [item.officialCode, item]));
  const groupById = new Map(v3Result.groups.map((group) => [group.skillCode, group]));
  const reviewDocket = v3Targets.map((target) => {
    const targetGroups = Array.isArray(target.questionStatus)
      ? target.questionStatus.map((item) => groupById.get(item.skillCode)).filter(Boolean)
      : [groupById.get(target.targetId)].filter(Boolean);
    const officialCodes = v3Result.compiledBatch.sourceDossiers.filter((item) => item.targetId === target.targetId).map((item) => item.officialCode).filter(Boolean);
    return {
      targetId: target.targetId,
      stage: target.stage,
      subject: target.subject,
      officialReferences: officialCodes.map((code) => ({ code, sourceEvidence: sourceDossierByCode.get(code)?.sourceEvidence ?? null })),
      lessonSummaries: targetGroups.map((group) => ({ skillCode: group.skillCode, title: group.lesson?.title ?? null, objective: group.lesson?.objective ?? null, workedExamplePresent: Boolean(group.lesson?.workedExample) })),
      concepts: targetGroups.flatMap((group) => group.lesson?.keyConcepts ?? []),
      assessmentSamples: targetGroups.flatMap((group) => group.questions.slice(0, 2).map(({ question }) => ({ id: question.id, purpose: question.purpose, prompt: question.statement ?? question.prompt ?? question.stem ?? null, answerKey: question.correctAnswer ?? null, explanation: question.explanation ?? null }))),
      prerequisiteReferences: targetGroups.flatMap((group) => group.prerequisites ?? []),
      reviewRubric: ['Official source text and page checked against the cited document.', 'Learning objective and prerequisite scope are age-appropriate.', 'Explanation, worked example, and transfer task teach distinct reasoning.', 'Answer key and distractors diagnose plausible misconceptions.', 'Feedback/remediation and progress criteria are pedagogically justified.'],
      qualityRisks: [
        ...(targetGroups.some((group) => group.questions.length < 40) ? ['POOL_BELOW_V4_DEPTH_TARGET'] : []),
        ...(targetGroups.some((group) => !group.lesson?.remediations?.length) ? ['MISCONCEPTION_REMEDIATION_REQUIRES_REVIEW'] : []),
        ...(officialCodes.length ? ['OFFICIAL_MAPPING_NOT_APPROVED'] : ['NO_OFFICIAL_MAPPING_CLAIMED']),
      ],
      humanReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      approvalEvidence: null,
      revisionHistory: [{ version: 'V3_BASELINE', status: 'TECHNICAL_STAGING_ONLY', sourceHash: v3.hashes.contentHash }],
    };
  });
  const officialSummary = {
    totalNodes: matrix.length,
    accountedNodes: matrix.length,
    unaccountedNodes: 0,
    byStage,
    byComponent,
    byKind,
    byMappingStatus,
    sourceTextHumanVerified: 0,
    sourceTextRequiresReview: matrix.length,
    neighboringCodeRowsRequiringReview: neighboringCodesForReview,
    exactVerifiedMappings: matrix.filter((node) => node.mappingStatus === 'MAPPED' && node.verifiedCanonicalSkillCodes.length).length,
    nodesWithExactVerifiedContentLinks: matrix.filter((node) => node.contentLinkStatus === 'EXACT_VERIFIED_LINK_ONLY').length,
    allOtherNodesHaveNoClaimedContentLink: true,
  };
  const reportBody = {
    schemaVersion: 'tec-escola.bncc.knowledge-factory-inventory.v4',
    campaign: 'TECESCOLA_BNCC_TOTAL_KNOWLEDGE_COVERAGE_AND_DEEP_LEARNING_V4',
    generatedBy: 'tools/bncc/knowledge-factory-v4.mjs',
    sourceHashes,
    normativeContext: {
      officialCatalogFreeze: officialManifest.sourceFreezeDate,
      extractionStatus: officialManifest.extraction.status,
      currentReferencesAddedAsContextOnly: regulatoryContext.references.map((reference) => reference.id),
      regulatoryApprovalStatus: regulatoryContext.approvalStatus,
      codeCatalogWasNotRewritten: true,
    },
    officialCoverage: officialSummary,
    teachableRequirements: {
      skillNodes: matrix.filter((node) => node.requirementType === 'TEACHABLE_SKILL_REQUIREMENT').length,
      earlyChildhoodDevelopmentObjectives: matrix.filter((node) => node.requirementType === 'DEVELOPMENT_OBJECTIVE_REQUIRES_EXPERIENTIAL_DESIGN').length,
      mappedWithLessonAndQuestions: matrix.filter((node) => node.verifiedCanonicalSkillCodes.some((code) => {
        const skill = v1.internalSkillGaps.find((item) => item.skillCode === code);
        return skill?.lessonAvailable && skill.questionCount > 0;
      })).length,
      mappedDeepContentReady: 0,
      decisionPendingSourceReviewOrMapping: matrix.filter((node) => node.mappingStatus !== 'MAPPED').length,
    },
    existingContent: {
      v3Targets: v3Targets.length,
      auditedSequences: depth.length,
      deepContentReady: deepCoverage,
      depthStatusCounts: groupBy(depth, (item) => item.currentDepthStatus),
      purposeMinimums: MINIMUMS,
      questionsBelowAnyMinimum: depth.filter((item) => Object.keys(item.missingMinimums).length).length,
      v3QuestionTotal: depth.reduce((sum, item) => sum + item.currentQuestionCount, 0),
      lessonsNeedingDepthReview: depth.filter((item) => item.lessonStatus !== 'STRUCTURED_LESSON_CANDIDATE').length,
      reviewPending: depth.length,
    },
    curriculumUnits: {
      sourceUnitCount: unitCatalog.units.length,
      v3NewUnits: v3UnitExpansion.newUnits.length,
      v3ExistingUnitExtensions: v3UnitExpansion.existingUnitExtensions.length,
      totalCanonicalUnits: units.length,
      skillsReferenced: new Set(units.flatMap((unit) => unit.canonicalSkills)).size,
      missingSkillReferences: unknownUnitSkills,
      officialCodesClaimed: units.reduce((sum, unit) => sum + (unit.officialCodes?.length ?? 0), 0),
      persistedRowsBeforeV4: 0,
      rowsPreparedForStaging: units.length,
      activeRows: 0,
      reviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    },
    humanReview: {
      dossiersPrepared: reviewDocket.length,
      reviewersRecorded: 0,
      approvedItems: 0,
      fabricatedApprovalEvidence: false,
    },
    queue: {
      totalItems: waveQueue.length,
      byWave: groupBy(waveQueue, (item) => `WAVE_${item.wave}`),
      byStatus: groupBy(waveQueue, (item) => item.status),
      items: waveQueue,
    },
    safety: {
      publicationStatus: 'STAGING',
      studentAvailableNewContent: 0,
      productionWrites: false,
      studentHistoryModified: false,
      existingInstitutionalUnitsModified: false,
      otherVpsServicesTouched: false,
      humanPedagogicalApprovalClaimed: false,
    },
  };
  const report = { ...reportBody, inventoryHash: hash(stableJson(reportBody)) };
  const checkpointBody = {
    schemaVersion: 'tec-escola.bncc.knowledge-factory-checkpoint.v4',
    campaign: report.campaign,
    inputHash: hash(stableJson(sourceHashes)),
    outputHash: report.inventoryHash,
    completedWork: ['FOUNDATION_RECONCILED', 'OFFICIAL_NODE_MATRIX_BUILT', 'V3_DEPTH_AUDIT_BUILT', 'UNIT_STAGING_PACKAGE_BUILT', 'HUMAN_REVIEW_DRAFTS_BUILT'],
    currentWave: waveQueue.length ? waveQueue[0].wave : null,
    nextQueueItem: waveQueue[0] ?? null,
    pendingItems: waveQueue.length,
    resumePolicy: 'Recompute from source hashes; completed artifacts are deterministic and never interpreted as approval or publication.',
    nextSteps: ['AUTHOR_AND_VALIDATE_WAVE_1_DEPTH', 'AUTHOR_EXPERIENTIAL_EVIDENCE', 'RECONCILE_ALL_65_INTERNAL_SKILLS', 'REVIEW_OFFICIAL_SOURCE_TEXT_AND_MAPPINGS', 'HUMAN_PEDAGOGICAL_REVIEW'],
  };
  const checkpoint = { ...checkpointBody, checkpointHash: hash(stableJson(checkpointBody)) };
  const stagingSql = buildUnitStagingSql(units);
  return { report, checkpoint, docket: { schemaVersion: 'tec-escola.bncc.review-docket.v4', campaign: report.campaign, status: 'DRAFT_FOR_HUMAN_REVIEW', items: reviewDocket }, stagingSql };
}

function writeOutputs(root, result) {
  for (const key of OUTPUTS) {
    const relativePath = PATHS[key];
    const value = key === 'stagingSql' ? result[key] : `${JSON.stringify(result[key], null, 2)}\n`;
    fs.writeFileSync(path.join(root, relativePath), value);
  }
}

function validateKnowledgeFactoryV4(result) {
  const errors = [];
  const report = result.report;
  if (report.officialCoverage.totalNodes !== 1723) errors.push('OFFICIAL_NODE_COUNT_MISMATCH');
  if (report.officialCoverage.accountedNodes !== report.officialCoverage.totalNodes || report.officialCoverage.unaccountedNodes !== 0) errors.push('OFFICIAL_NODE_ACCOUNTING_MISMATCH');
  if (report.officialCoverage.sourceTextHumanVerified !== 0) errors.push('SOURCE_REVIEW_MUST_NOT_BE_INFERRED');
  if (report.humanReview.approvedItems !== 0 || report.humanReview.fabricatedApprovalEvidence) errors.push('HUMAN_APPROVAL_MUST_REMAIN_PENDING');
  if (report.curriculumUnits.activeRows !== 0 || report.safety.studentAvailableNewContent !== 0) errors.push('V4_CONTENT_MUST_REMAIN_STAGING');
  if (report.curriculumUnits.missingSkillReferences.length) errors.push('CURRICULUM_UNIT_SKILL_REFERENCE_MISSING');
  if (result.docket.items.some((item) => item.approvalEvidence !== null || item.humanReviewStatus !== 'PEDAGOGICAL_REVIEW_PENDING')) errors.push('INVALID_REVIEW_DOCKET_STATE');
  if (!result.stagingSql.includes("'PEDAGOGICAL_REVIEW_PENDING', 'STAGING', false")) errors.push('STAGING_SQL_NOT_INACTIVE');
  if (/insert\s+into\s+public\.learning_(?:guided_sessions|guided_steps|guided_step_attempts|student_skill_state|skill_evidence|enrollments)/i.test(result.stagingSql)) errors.push('STAGING_SQL_TOUCHES_STUDENT_HISTORY');
  if (result.stagingSql.includes("'PUBLISHED'")) errors.push('STAGING_SQL_CONTAINS_PUBLICATION');
  if (result.report.queue.items.some((item) => !item.id || !Number.isInteger(item.wave))) errors.push('INVALID_WAVE_QUEUE_ITEM');
  return [...new Set(errors)];
}

export function compileKnowledgeFactoryV4(root = ROOT, check = false) {
  const result = buildKnowledgeFactoryV4(root);
  const errors = validateKnowledgeFactoryV4(result);
  if (errors.length) throw new Error(`KNOWLEDGE_FACTORY_V4_INVALID\n${errors.join('\n')}`);
  if (check) {
    for (const key of OUTPUTS) {
      const relativePath = PATHS[key];
      const expected = key === 'stagingSql' ? result[key] : `${JSON.stringify(result[key], null, 2)}\n`;
      const actualPath = path.join(root, relativePath);
      if (!fs.existsSync(actualPath) || fs.readFileSync(actualPath, 'utf8').replace(/\r\n/g, '\n') !== expected.replace(/\r\n/g, '\n')) {
        throw new Error(`KNOWLEDGE_FACTORY_V4_OUTPUT_STALE:${relativePath}`);
      }
    }
    return result.report;
  }
  writeOutputs(root, result);
  return result.report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const report = compileKnowledgeFactoryV4(ROOT, check);
  console.log(`Knowledge factory V4 ${check ? 'validated' : 'compiled'}: ${report.officialCoverage.totalNodes} official nodes, ${report.existingContent.auditedSequences} sequences audited, ${report.queue.totalItems} queued gaps, ${report.curriculumUnits.rowsPreparedForStaging} inactive units prepared.`);
}
