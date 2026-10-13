import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assessDepthGroup, compileKnowledgeFactoryV4, hashNormalizedText } from './knowledge-factory-v4.mjs';

const root = new URL('../../', import.meta.url);
const readJson = (relativePath) => JSON.parse(fs.readFileSync(new URL(relativePath, root), 'utf8'));

const PURPOSE_COUNTS = { PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 };

function deepSequence() {
  let index = 0;
  const questions = Object.entries(PURPOSE_COUNTS).flatMap(([purpose, count]) => Array.from({ length: count }, (_, position) => {
    const id = `q-${index}`;
    const difficulty = purpose === 'PROBE' ? (position < 2 ? 'EASY' : 'MEDIUM')
      : purpose === 'PRACTICE' ? (position < 6 ? 'MEDIUM' : 'HARD')
        : purpose === 'TRANSFER' ? 'HARD'
          : position % 2 ? 'MEDIUM' : 'EASY';
    const cognitiveProcess = purpose === 'TRANSFER' ? ['ANALYZE', 'COMPARE', 'JUSTIFY', 'EVALUATE'][position % 4] : 'IDENTIFY';
    index += 1;
    return {
      id,
      purpose,
      difficulty,
      cognitiveProcess,
      contextFamily: `context-${id}`,
      statement: `Situação autoral e distinta ${id}: qual conclusão é sustentada pelos dados?`,
      options: ['conclusão A', 'conclusão B', 'conclusão C', 'conclusão D'],
      correctAnswer: 'conclusão A',
      explanation: 'A conclusão A decorre dos elementos informados, sem ultrapassar o que os dados permitem afirmar.',
      hint: 'Separe a evidência observada da conclusão que ela permite sustentar.',
      errorFocus: 'Inferência sem evidência suficiente',
    };
  }));
  return {
    skillCode: 'TEST_SKILL',
    subjectCode: 'SCIENCE',
    stage: 'ENSINO_MEDIO',
    unitId: 'TEST_UNIT',
    lesson: {
      title: 'Lição de teste',
      objective: 'Interpretar evidências e justificar uma conclusão.',
      priorKnowledge: ['Distinguir dado observado de inferência.'],
      keyConcepts: ['Evidência', 'Inferência'],
      progressiveExplanation: ['Observe os dados.', 'Compare padrões.', 'Justifique a conclusão com evidências.'],
      workedExample: 'Em uma tabela, dois valores aumentam juntos; isso mostra associação, não prova causalidade.',
      commonErrors: ['Confundir associação com causalidade.'],
      remediations: [
        { id: 'CAUSALITY', trigger: 'Atribui causa sem comparação.', explanation: 'Procure explicações alternativas.', workedExample: 'Compare grupos com e sem a condição.', selfCheck: 'A causa foi isolada?' },
        { id: 'OVERGENERALIZATION', trigger: 'Generaliza além da amostra.', explanation: 'Verifique quem foi observado.', workedExample: 'Uma turma não representa toda a rede.', selfCheck: 'A amostra permite essa conclusão?' },
      ],
    },
    questions,
  };
}

describe('BNCC total knowledge factory V4', () => {
  it('derives deep readiness from consolidated evidence while keeping human review and publication pending', () => {
    const report = assessDepthGroup(deepSequence());

    expect(report.readinessClaim).toBe('DEEP_CONTENT_READY');
    expect(report.currentQuestionCount).toBe(40);
    expect(report.dimensions).toEqual({
      LESSON_DEPTH_READY: true,
      QUESTION_POOL_DEPTH_READY: true,
      DIFFICULTY_PROGRESSION_READY: true,
      CONTEXT_DIVERSITY_READY: true,
      TRANSFER_READY: true,
      MISCONCEPTION_RECOVERY_READY: true,
      REVIEW_CONTENT_READY: true,
      AUTHENTIC_EVIDENCE_READY: true,
    });
    expect(report.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(report.officialMappingStatus).toBe('MAPPING_PENDING');
    expect(report.studentPublicationStatus).toBe('STAGING_INACTIVE');
  });

  it('does not mistake forty repeated questions for a deep question pool', () => {
    const group = deepSequence();
    group.questions = group.questions.map((question) => ({
      ...question,
      statement: 'A mesma questão repetida sem contexto novo.',
      contextFamily: 'same-context',
    }));
    const report = assessDepthGroup(group);

    expect(report.currentQuestionCount).toBe(1);
    expect(report.readinessClaim).toBe('NOT_DEEP_CONTENT_READY');
    expect(report.dimensions.QUESTION_POOL_DEPTH_READY).toBe(false);
    expect(report.dimensions.CONTEXT_DIVERSITY_READY).toBe(false);
  });

  it('preserves charge and mathematical operators when checking distinct answer choices', () => {
    const group = deepSequence();
    group.questions[0] = {
      ...group.questions[0],
      statement: 'Uma espécie tem 13 prótons e 10 elétrons. Qual é sua carga?',
      options: ['+3', '-3', '+23', '+1'],
      correctAnswer: '+3',
    };
    const report = assessDepthGroup(group);

    expect(report.answerKeyValid).toBe(true);
    expect(report.dimensions.QUESTION_POOL_DEPTH_READY).toBe(true);
  });

  it('preserves isotope subscripts and superscript charges in distinct answer choices', () => {
    const group = deepSequence();
    group.questions[0] = {
      ...group.questions[0],
      statement: 'Qual notação representa sódio-23 neutro?',
      options: ['²³₁₁Na', '¹²₁₁Na', '²³₁₂Na', '²³₁₁Na⁺'],
      correctAnswer: '²³₁₁Na',
    };
    const report = assessDepthGroup(group);

    expect(report.answerKeyValid).toBe(true);
    expect(report.dimensions.QUESTION_POOL_DEPTH_READY).toBe(true);
  });

  it('uses authentic performance evidence rather than an artificial question quota for practical skills', () => {
    const group = deepSequence();
    group.skillCode = 'ART_TEST';
    group.subjectCode = 'ART';
    group.questions = group.questions.slice(0, 5);
    group.lesson.progression = [{ stage: 'FOUNDATION', questionIds: group.questions.map((question) => question.id) }];
    group.authenticActivities = [{
      title: 'Teste teatral', objective: 'Experimentar movimento e voz.', instructions: 'Teste duas escolhas.', evidence: 'Registre pistas e revisao.', privacyGuard: 'Nao grave estudantes.',
      rubric: [
        { criterion: 'Experimentacao', emerging: 'Ainda nao testa.', developing: 'Testa uma vez.', proficient: 'Compara duas escolhas.' },
        { criterion: 'Reflexao', emerging: 'Sem justificativa.', developing: 'Justifica parcialmente.', proficient: 'Justifica com pista observavel.' },
      ],
    }];
    const report = assessDepthGroup(group);

    expect(report.readinessClaim).toBe('DEEP_CONTENT_READY');
    expect(report.dimensions).toMatchObject({ QUESTION_POOL_DEPTH_READY: null, DIFFICULTY_PROGRESSION_READY: null, CONTEXT_DIVERSITY_READY: null, TRANSFER_READY: null, REVIEW_CONTENT_READY: null, AUTHENTIC_EVIDENCE_READY: true });
    expect(report.answerKeyValid).toBe(true);
  });

  it('keeps a practical target below deep-ready when its authentic activity is incomplete', () => {
    const group = deepSequence();
    group.subjectCode = 'ART';
    group.authenticActivities = [];
    const report = assessDepthGroup(group);

    expect(report.readinessClaim).toBe('NOT_DEEP_CONTENT_READY');
    expect(report.missingDepthDimensions).toContain('AUTHENTIC_EVIDENCE_READY');
  });

  it('collapses duplicate stems across legacy and V5 content before evaluating depth', () => {
    const group = deepSequence();
    group.questions.push({ ...group.questions[0], id: 'duplicate-copy' });
    const report = assessDepthGroup(group);

    expect(report.currentQuestionCount).toBe(40);
    expect(report.duplicateQuestionsCollapsed).toBe(1);
    expect(report.readinessClaim).toBe('DEEP_CONTENT_READY');
  });

  it('hashes source text consistently across Windows and Linux line endings', () => {
    expect(hashNormalizedText('source\ntext\n')).toBe(hashNormalizedText('source\r\ntext\r\n'));
  });

  it('accounts for the frozen official catalog without inventing mappings or source approvals', () => {
    const report = readJson('content/bncc/authoring/knowledge-factory-inventory-v4.json');

    expect(report.officialCoverage).toMatchObject({ totalNodes: 1723, accountedNodes: 1723, unaccountedNodes: 0, sourceTextHumanVerified: 0, exactVerifiedMappings: 2 });
    expect(report.officialCoverage.byStage).toEqual({ EDUCACAO_INFANTIL: 104, ENSINO_FUNDAMENTAL: 1407, ENSINO_MEDIO: 212 });
    expect(report.teachableRequirements).toMatchObject({ skillNodes: 1619, earlyChildhoodDevelopmentObjectives: 104, mappedWithLessonAndQuestions: 2, mappedDeepContentReady: 0 });
    expect(report.humanReview).toMatchObject({ reviewersRecorded: 0, approvedItems: 0, fabricatedApprovalEvidence: false });
  });

  it('distinguishes a five-phase structural path from deep assessment coverage', () => {
    const report = readJson('content/bncc/authoring/knowledge-factory-inventory-v4.json');

    expect(report.existingContent).toMatchObject({ v3Targets: 24, auditedSequences: 31, v3QuestionTotal: 160, v5QuestionTotal: 893, consolidatedQuestionTotal: 1168, technicalDeepReady: 31, reviewPending: 31 });
    expect(report.existingContent.depthStatusCounts).toEqual({ STRUCTURAL_READY: 31 });
    expect(report.existingContent.technicalDeepReady).toBe(report.existingContent.depthAudit.filter((item) => item.readinessClaim === 'DEEP_CONTENT_READY').length);
    expect(report.queue.byWave.WAVE_1 ?? 0).toBe(report.existingContent.auditedSequences - report.existingContent.technicalDeepReady);
  });

  it('reconciles the V5 force-motion increment into the V3 sequence without double counting', () => {
    const report = compileKnowledgeFactoryV4(undefined, true);
    const physics = report.existingContent.depthAudit.find((item) => item.targetId === 'PHYSICS_MODEL_FORCE');

    expect(physics).toMatchObject({ originalQuestionCount: 5, v5QuestionCount: 35, currentQuestionCount: 40 });
    expect(physics.purposeCounts).toEqual(PURPOSE_COUNTS);
    expect(physics.pedagogicalReviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(physics.studentPublicationStatus).toBe('STAGING_INACTIVE');
  });

  it('reconciles phishing practice depth while leaving student publication gated', () => {
    const report = compileKnowledgeFactoryV4(undefined, true);
    const phishing = report.existingContent.depthAudit.find((item) => item.targetId === 'COMPUTING_RECOGNIZE_PHISHING');

    expect(phishing).toMatchObject({
      originalQuestionCount: 5,
      v5QuestionCount: 35,
      currentQuestionCount: 40,
      technicalDeepReady: true,
      readinessClaim: 'DEEP_CONTENT_READY',
      pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      officialMappingStatus: 'NOT_CLAIMED',
      studentPublicationStatus: 'STAGING_INACTIVE',
    });
    expect(phishing.purposeCounts).toEqual(PURPOSE_COUNTS);
    expect(phishing.missingDepthDimensions).toEqual([]);
  });

  it('reconciles human-diversity observation with privacy-safe staging gates', () => {
    const report = compileKnowledgeFactoryV4(undefined, true);
    const diversity = report.existingContent.depthAudit.find((item) => item.targetId === 'SCIENCE_COMPARE_HUMAN_DIVERSITY_RESPECTFULLY_FI');

    expect(diversity).toMatchObject({
      originalQuestionCount: 5,
      v5QuestionCount: 35,
      currentQuestionCount: 40,
      technicalDeepReady: true,
      readinessClaim: 'DEEP_CONTENT_READY',
      pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      officialMappingStatus: 'NOT_CLAIMED',
      studentPublicationStatus: 'STAGING_INACTIVE',
    });
    expect(diversity.purposeCounts).toEqual(PURPOSE_COUNTS);
    expect(diversity.missingDepthDimensions).toEqual([]);
  });

  it('reconciles history and unit-rate question-first depth without claiming approval', () => {
    const report = compileKnowledgeFactoryV4(undefined, true);
    const history = report.existingContent.depthAudit.find((item) => item.targetId === 'HISTORY_COMPARE_CAUSES');
    const ratio = report.existingContent.depthAudit.find((item) => item.targetId === 'MATH_RATIO_UNIT_RATE');

    expect(history).toMatchObject({ originalQuestionCount: 6, v5QuestionCount: 34, currentQuestionCount: 40, technicalDeepReady: true, pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING', officialMappingStatus: 'NOT_CLAIMED', studentPublicationStatus: 'STAGING_INACTIVE' });
    expect(history.purposeCounts).toEqual(PURPOSE_COUNTS);
    expect(history.missingDepthDimensions).toEqual([]);
    expect(ratio).toMatchObject({ originalQuestionCount: 10, v5QuestionCount: 30, currentQuestionCount: 40, technicalDeepReady: true, pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING', officialMappingStatus: 'NOT_CLAIMED', studentPublicationStatus: 'STAGING_INACTIVE' });
    expect(ratio.purposeCounts).toEqual(PURPOSE_COUNTS);
    expect(ratio.missingDepthDimensions).toEqual([]);
  });

  it('requires authentic evidence for both physical-education targets', () => {
    const report = compileKnowledgeFactoryV4(undefined, true);
    const distinguish = report.existingContent.depthAudit.find((item) => item.targetId === 'PE_DISTINGUISH_ACTIVITY_EXERCISE_FII');
    const safePlan = report.existingContent.depthAudit.find((item) => item.targetId === 'PE_PLAN_SAFE_ACTIVITY');

    expect(distinguish).toMatchObject({ originalQuestionCount: 5, v5QuestionCount: 6, currentQuestionCount: 11, technicalDeepReady: true, pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING', officialMappingStatus: 'NOT_CLAIMED', studentPublicationStatus: 'STAGING_INACTIVE' });
    expect(distinguish.dimensions.AUTHENTIC_EVIDENCE_READY).toBe(true);
    expect(safePlan).toMatchObject({ originalQuestionCount: 7, v5QuestionCount: 6, currentQuestionCount: 13, technicalDeepReady: true, pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING', officialMappingStatus: 'NOT_CLAIMED', studentPublicationStatus: 'STAGING_INACTIVE' });
    expect(safePlan.dimensions.AUTHENTIC_EVIDENCE_READY).toBe(true);
    expect(safePlan.dimensions.MISCONCEPTION_RECOVERY_READY).toBe(true);
    expect(distinguish.missingDepthDimensions).toEqual([]);
    expect(safePlan.missingDepthDimensions).toEqual([]);
  });

  it('reconciles Portuguese cohesion content and advances the real queue', () => {
    const report = compileKnowledgeFactoryV4(undefined, true);
    const cohesion = report.existingContent.depthAudit.find((item) => item.targetId === 'PORTUGUESE_CONNECT_IDEAS');

    expect(cohesion).toMatchObject({ originalQuestionCount: 5, v5QuestionCount: 35, currentQuestionCount: 40, technicalDeepReady: true, pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING', officialMappingStatus: 'NOT_CLAIMED', studentPublicationStatus: 'STAGING_INACTIVE' });
    expect(cohesion.purposeCounts).toEqual(PURPOSE_COUNTS);
    expect(cohesion.missingDepthDimensions).toEqual([]);
    expect(report.queue.byWave.WAVE_1 ?? 0).toBe(0);
  });

  it('reconciles Portuguese inference while keeping its interpretation and publication gates explicit', () => {
    const report = compileKnowledgeFactoryV4(undefined, true);
    const inference = report.existingContent.depthAudit.find((item) => item.targetId === 'PORTUGUESE_INFER_FROM_CLUES');

    expect(inference).toMatchObject({ originalQuestionCount: 5, v5QuestionCount: 35, currentQuestionCount: 40, technicalDeepReady: true, pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING', officialMappingStatus: 'NOT_CLAIMED', studentPublicationStatus: 'STAGING_INACTIVE' });
    expect(inference.purposeCounts).toEqual(PURPOSE_COUNTS);
    expect(inference.missingDepthDimensions).toEqual([]);
  });

  it('reconciles safe dialogue mediation and advances to the final wave-one target', () => {
    const report = compileKnowledgeFactoryV4(undefined, true);
    const dialogue = report.existingContent.depthAudit.find((item) => item.targetId === 'RELIGIOUS_MEDIATE_DIALOGUE');

    expect(dialogue).toMatchObject({ originalQuestionCount: 5, v5QuestionCount: 35, currentQuestionCount: 40, technicalDeepReady: true, pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING', officialMappingStatus: 'NOT_CLAIMED', studentPublicationStatus: 'STAGING_INACTIVE' });
    expect(dialogue.purposeCounts).toEqual(PURPOSE_COUNTS);
    expect(dialogue.missingDepthDimensions).toEqual([]);
    expect(report.queue.byWave.WAVE_1 ?? 0).toBe(0);
  });

  it('closes all technical depth gaps in Wave 1 while preserving review and student gates', () => {
    const report = compileKnowledgeFactoryV4(undefined, true);
    const evidence = report.existingContent.depthAudit.find((item) => item.targetId === 'SCIENCE_EVIDENCE_CONCLUSION');

    expect(evidence).toMatchObject({ originalQuestionCount: 5, v5QuestionCount: 35, currentQuestionCount: 40, technicalDeepReady: true, pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING', officialMappingStatus: 'NOT_CLAIMED', studentPublicationStatus: 'STAGING_INACTIVE' });
    expect(evidence.purposeCounts).toEqual(PURPOSE_COUNTS);
    expect(evidence.missingDepthDimensions).toEqual([]);
    expect(report.queue.byWave.WAVE_1 ?? 0).toBe(0);
    expect(report.existingContent.technicalDeepReady).toBe(31);
  });

  it('reconciles Biology cell-function sources exactly before auditing the Wave 2 addition', () => {
    const report = compileKnowledgeFactoryV4(undefined, true);
    const biology = report.existingContent.depthAudit.find((item) => item.targetId === 'BIOLOGY_CELL_FUNCTION');

    expect(report.existingContent.waveTwoCandidateTargetsAudited).toBe(5);
    expect(report.existingContent.waveTwoCandidateTargetsDeepReady).toBe(5);
    expect(biology).toMatchObject({
      originalQuestionCount: 22,
      v5QuestionCount: 23,
      currentQuestionCount: 45,
      technicalDeepReady: true,
      readinessClaim: 'DEEP_CONTENT_READY',
      sourceReconciliation: { expectedQuestionCount: 22, actualQuestionCount: 22, status: 'EXACT' },
      pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      officialMappingStatus: 'NOT_CLAIMED',
      studentPublicationStatus: 'STAGING_INACTIVE',
    });
    expect(biology.purposeCounts).toEqual({ PROBE: 4, PRACTICE: 14, TRANSFER: 9, LOCK_IN: 6, REVIEW: 12 });
    expect(biology.missingDepthDimensions).toEqual([]);
    expect(report.queue.byWave.WAVE_2).toBe(47);
    expect(report.existingContent.v5PacksOutsideV3AuditedTargets).toMatchObject([
      { skillCode: 'MATH_SUCCESSIVE_PERCENT_CHANGE', sourceReconciliation: 'PENDING_SOURCE_COUNT_OR_TARGET_RECONCILIATION' },
    ]);
  });

  it('reconciles the complete inheritance source set and preserves allele case in answer validation', () => {
    const report = compileKnowledgeFactoryV4(undefined, true);
    const inheritance = report.existingContent.depthAudit.find((item) => item.targetId === 'BIOLOGY_EXPLAIN_INHERITANCE');

    expect(inheritance).toMatchObject({
      originalQuestionCount: 29,
      v5QuestionCount: 21,
      currentQuestionCount: 50,
      technicalDeepReady: true,
      answerKeyValid: true,
      sourceReconciliation: { expectedQuestionCount: 29, actualQuestionCount: 29, status: 'EXACT' },
      pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      officialMappingStatus: 'NOT_CLAIMED',
      studentPublicationStatus: 'STAGING_INACTIVE',
    });
    expect(inheritance.purposeCounts).toEqual({ PROBE: 5, PRACTICE: 15, TRANSFER: 9, LOCK_IN: 8, REVIEW: 13 });
    expect(inheritance.missingDepthDimensions).toEqual([]);
    expect(report.queue.items.filter((item) => item.id === 'BIOLOGY_EXPLAIN_INHERITANCE')).toEqual([]);
    expect(report.queue.byWave.WAVE_1 ?? 0).toBe(0);
  });

  it('reconciles population-data questions without claiming an unverified curriculum mapping', () => {
    const report = compileKnowledgeFactoryV4(undefined, true);
    const population = report.existingContent.depthAudit.find((item) => item.targetId === 'BIOLOGY_INTERPRET_POPULATION_DATA');

    expect(population).toMatchObject({
      originalQuestionCount: 23,
      v5QuestionCount: 17,
      currentQuestionCount: 40,
      technicalDeepReady: true,
      readinessClaim: 'DEEP_CONTENT_READY',
      sourceReconciliation: { expectedQuestionCount: 23, actualQuestionCount: 23, status: 'EXACT' },
      pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      officialMappingStatus: 'NOT_CLAIMED',
      studentPublicationStatus: 'STAGING_INACTIVE',
    });
    expect(population.purposeCounts).toEqual({ PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 });
    expect(population.missingDepthDimensions).toEqual([]);
    expect(report.queue.items.filter((item) => item.id === 'BIOLOGY_INTERPRET_POPULATION_DATA')).toEqual([]);
  });

  it('reconciles atomic-structure sources and treats positive and negative ion charges as distinct', () => {
    const report = compileKnowledgeFactoryV4(undefined, true);
    const atomic = report.existingContent.depthAudit.find((item) => item.targetId === 'CHEMISTRY_ATOMIC_STRUCTURE');

    expect(atomic).toMatchObject({
      originalQuestionCount: 27,
      v5QuestionCount: 14,
      currentQuestionCount: 41,
      technicalDeepReady: true,
      answerKeyValid: true,
      sourceReconciliation: { expectedQuestionCount: 27, actualQuestionCount: 27, status: 'EXACT' },
      pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      officialMappingStatus: 'NOT_CLAIMED',
      studentPublicationStatus: 'STAGING_INACTIVE',
    });
    expect(atomic.purposeCounts).toEqual({ PROBE: 5, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 });
    expect(atomic.missingDepthDimensions).toEqual([]);
    expect(report.queue.items.filter((item) => item.id === 'CHEMISTRY_ATOMIC_STRUCTURE')).toEqual([]);
  });

  it('reconciles the chemistry reaction-evidence source set before measuring V5 depth', () => {
    const report = compileKnowledgeFactoryV4(undefined, true);
    const reactions = report.existingContent.depthAudit.find((item) => item.targetId === 'CHEMISTRY_REACTION_EVIDENCE');

    expect(report.existingContent.waveTwoCandidateTargetsAudited).toBe(5);
    expect(report.existingContent.waveTwoCandidateTargetsDeepReady).toBe(5);
    expect(reactions).toMatchObject({
      originalQuestionCount: 24,
      v5QuestionCount: 16,
      currentQuestionCount: 40,
      technicalDeepReady: true,
      answerKeyValid: true,
      sourceReconciliation: { expectedQuestionCount: 24, actualQuestionCount: 24, status: 'EXACT' },
      pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      officialMappingStatus: 'NOT_CLAIMED',
      studentPublicationStatus: 'STAGING_INACTIVE',
    });
    expect(reactions.purposeCounts).toEqual({ PROBE: 4, PRACTICE: 12, TRANSFER: 8, LOCK_IN: 6, REVIEW: 10 });
    expect(reactions.missingDepthDimensions).toEqual([]);
    expect(report.queue.items.filter((item) => item.id === 'CHEMISTRY_REACTION_EVIDENCE')).toEqual([]);
    expect(report.queue.byWave.WAVE_2).toBe(47);
  });

  it('prepares navigable unit persistence without student availability or fabricated BNCC links', () => {
    const report = readJson('content/bncc/authoring/knowledge-factory-inventory-v4.json');
    const sql = fs.readFileSync(new URL('../../content/bncc/authoring/curriculum-units-v4-staging.sql', import.meta.url), 'utf8');

    expect(report.curriculumUnits).toMatchObject({ sourceUnitCount: 53, v3NewUnits: 12, v3ExistingUnitExtensions: 13, totalCanonicalUnits: 65, skillsReferenced: 78, missingSkillReferences: [], officialCodesClaimed: 0, persistedRowsBeforeV4: 0, rowsPreparedForStaging: 65, activeRows: 0 });
    expect(sql).toContain("'NOT_CLAIMED', 'PEDAGOGICAL_REVIEW_PENDING', 'STAGING', false");
    expect(sql).toContain('on conflict (catalog_id, code) do update');
    expect(sql).not.toContain("'PUBLISHED'");
    expect(sql).toContain('Run knowledge-factory-v3-staging.sql first');
    expect(sql).not.toMatch(/(?:insert\s+into|update|delete\s+from)\s+public\.learning_(?:guided_sessions|guided_steps|guided_step_attempts|student_skill_state|skill_evidence|enrollments)/i);
  });

  it('builds deterministic, resumable checkpoints and validates committed outputs', () => {
    const first = compileKnowledgeFactoryV4(undefined, true);
    const second = compileKnowledgeFactoryV4(undefined, true);
    const checkpoint = readJson('content/bncc/authoring/knowledge-factory-checkpoint-v4.json');

    expect(first.inventoryHash).toBe(second.inventoryHash);
    expect(checkpoint.inputHash).toHaveLength(64);
    expect(checkpoint.outputHash).toBe(first.inventoryHash);
    expect(checkpoint.completedWork).toContain('OFFICIAL_NODE_MATRIX_BUILT');
    expect(checkpoint.pendingItems).toBe(first.queue.totalItems);
    expect(checkpoint.currentWave).toBe(2);
  });

  it('keeps the historical V1/V2/V3 inputs and production outside the staging writer', () => {
    const report = readJson('content/bncc/authoring/knowledge-factory-inventory-v4.json');
    const sql = fs.readFileSync(new URL('../../content/bncc/authoring/curriculum-units-v4-staging.sql', import.meta.url), 'utf8');

    expect(report.safety).toMatchObject({ publicationStatus: 'STAGING', studentAvailableNewContent: 0, productionWrites: false, studentHistoryModified: false, existingInstitutionalUnitsModified: false, otherVpsServicesTouched: false, humanPedagogicalApprovalClaimed: false });
    expect(sql).not.toMatch(/(?:insert\s+into|update|delete\s+from)\s+public\.learning_(?:units|skills|guided_sessions|guided_steps|student_skill_state)/i);
  });
});
