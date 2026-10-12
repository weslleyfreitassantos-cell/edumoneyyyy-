import { describe, expect, it } from 'vitest';
import { buildKnowledgeFactoryV2, loadKnowledgeFactoryV2Inputs, orderQuestionOptions, validateKnowledgeExpansionBatch } from './knowledge-factory-v2.mjs';

const { inputs, batch } = loadKnowledgeFactoryV2Inputs();

describe('BNCC knowledge factory V2', () => {
  it('adds distinct cross-subject skills and units without resolving official mappings', () => {
    const result = buildKnowledgeFactoryV2(batch, inputs);

    expect(result.errors).toBeUndefined();
    expect(result.report.canonicalGraph).toMatchObject({
      internalSkillsBefore: 71,
      newCanonicalSkills: 3,
      internalSkillsAfter: 74,
      technicalGapsResolved: 0,
    });
    expect(result.report.curriculum).toMatchObject({ newUnits: 2, reusedExistingUnits: 1 });
    expect(result.report.officialCatalog).toMatchObject({
      canonicalGapNodesBefore: 1496,
      canonicalGapNodesAfter: 1496,
      officialMappingGapsBefore: 1617,
      officialMappingGapsAfter: 1617,
      humanReviewBlocked: 121,
      hierarchyOnly: 104,
      officialMappingGapsResolved: 0,
      officialMappingsReviewed: 0,
      officialMappingsPromoted: 0,
    });
    expect(result.report.content).toMatchObject({ newLessons: 3, newQuestions: 36, completeAdaptiveSequences: 3 });
  });

  it('balances correct-option positions deterministically in every skill and adaptive set', () => {
    for (const skill of batch.skills) {
      const positions = [0, 0, 0, 0];
      skill.questions.forEach((question, index) => {
        const options = orderQuestionOptions(question, index);
        positions[options.indexOf(question.correctAnswer)] += 1;
      });
      expect(positions).toEqual([3, 3, 3, 3]);
    }

    const { sql } = buildKnowledgeFactoryV2(batch, inputs);
    expect(sql.match(/on conflict \(question_set_id, question_bank_id\) do update set position/g)).toHaveLength(36);
  });

  it('uses V8 gap clusters and unapproved proposals as traceable evidence without promoting mappings', () => {
    const result = buildKnowledgeFactoryV2(batch, inputs);
    const selectedIds = new Set(batch.skills.map((skill) => skill.sourceEvidence.proposalId));

    expect(batch.skills.every((skill) => skill.sourceEvidence.proposalStatus === 'NEW_SKILL_PENDING_REVIEW'
      && skill.sourceEvidence.mappingClaim === 'NONE')).toBe(true);
    expect(result.report.officialCatalog.officialMappingsReviewed).toBe(0);
    expect(result.report.officialCatalog.officialMappingsPromoted).toBe(0);
    expect(result.report.nextPriorityQueues.canonicalExpansionCandidates.nextBatch).toHaveLength(12);
    expect(new Set(result.report.nextPriorityQueues.canonicalExpansionCandidates.nextBatch.map((item) => item.subject)).size).toBeGreaterThan(3);
    expect(result.report.nextPriorityQueues.canonicalExpansionCandidates.nextBatch.every((item) => !item.possibleCanonicalCodeCollision)).toBe(true);
    expect(result.report.nextPriorityQueues.canonicalExpansionCandidates.nextBatch.every((item) => item.status === 'NEW_SKILL_PENDING_REVIEW'
      && item.mappingPromoted === false && !selectedIds.has(item.proposalId))).toBe(true);

    const invalid = structuredClone(batch);
    invalid.skills[0].sourceEvidence.proposalStatus = 'MAPPED';
    expect(validateKnowledgeExpansionBatch(invalid, inputs)).toContain('V8_PROPOSAL_REFERENCE_INVALID:SCIENCE_COMPARE_MATERIAL_CHOICES_FI');
  });

  it('rejects duplicate skill identities, question identities, and prerequisite cycles', () => {
    const duplicateSkill = structuredClone(batch);
    duplicateSkill.skills[1].skillCode = duplicateSkill.skills[0].skillCode;
    expect(validateKnowledgeExpansionBatch(duplicateSkill, inputs)).toContain(`DUPLICATE_V2_SKILL:${duplicateSkill.skills[0].skillCode}`);

    const existingV1Skill = structuredClone(batch);
    existingV1Skill.skills[0].skillCode = inputs.v4Skills[0].code;
    expect(validateKnowledgeExpansionBatch(existingV1Skill, inputs)).toContain(`SKILL_ALREADY_EXISTS:${inputs.v4Skills[0].code}`);

    const duplicateQuestion = structuredClone(batch);
    duplicateQuestion.skills[1].questions[0].id = duplicateQuestion.skills[0].questions[0].id;
    expect(validateKnowledgeExpansionBatch(duplicateQuestion, inputs)).toContain(`DUPLICATE_QUESTION_ID:${duplicateQuestion.skills[0].questions[0].id}`);

    const cyclic = structuredClone(batch);
    cyclic.skills[0].relationships.push({
      from: cyclic.skills[0].skillCode,
      to: cyclic.skills[0].skillCode,
      type: 'PREREQUISITE',
      rationale: 'Ciclo usado apenas para validar a regra do grafo.',
    });
    expect(validateKnowledgeExpansionBatch(cyclic, inputs).some((error) => error.startsWith('PREREQUISITE_CYCLE:'))).toBe(true);
  });

  it('keeps every generated database row inactive and excludes learner progress writes', () => {
    const { sql } = buildKnowledgeFactoryV2(batch, inputs);

    expect(sql).toContain("'PEDAGOGICAL_REVIEW_PENDING', false)");
    expect(sql).toContain("'ADAPTIVE_READY', false, v_parent_id, 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(sql).toContain('correct_answer');
    expect(sql).not.toMatch(/learning_guided_sessions|learning_guided_steps|learning_student_skill_state|learning_skill_evidence|learning_guided_step_attempts/);
    expect(sql).not.toContain("'PUBLISHED'");
  });
});
