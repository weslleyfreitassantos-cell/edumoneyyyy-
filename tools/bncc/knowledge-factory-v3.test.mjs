import { describe, expect, it } from 'vitest';
import { batch } from '../../content/adaptive/tec-escola-core-v9/knowledge-expansion-batch-v3.mjs';
import { buildKnowledgeFactoryV3, loadKnowledgeFactoryV3Inputs } from './knowledge-factory-v3.mjs';
import { orderQuestionOptions } from './knowledge-factory-v2.mjs';

const loaded = loadKnowledgeFactoryV3Inputs();

describe('BNCC knowledge factory V3', () => {
  it('processes 24 targets with complete inactive adaptive sequences', () => {
    const result = buildKnowledgeFactoryV3(loaded);

    expect(result.errors).toEqual([]);
    expect(result.report.targets).toMatchObject({ originalTargets: 24, existingSkillTargets: 12, newCandidateTargets: 12, processed: 24 });
    expect(result.report.candidates.newInternalSkillsCreated).toBe(13);
    expect(result.report.candidates.proposalsSplit).toBe(1);
    expect(result.report.candidates.candidatesReused).toBe(0);
    expect(result.report.content).toMatchObject({ newLessons: 22, reusedLessons: 4, newQuestions: 110, reusedV1Questions: 36, reusedV4Questions: 14, completeAdaptiveSequences: 26 });
    expect(result.report.nextCampaign.existingSkills).toHaveLength(12);
    expect(result.report.nextCampaign.canonicalCandidates).toHaveLength(12);
    expect(result.report.safety).toMatchObject({ publicationStatus: 'STAGING', mappingStatus: 'MAPPING_PENDING', pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING', studentAvailableContent: 0, studentHistoryModified: false, productionWrites: false });
    for (const group of result.groups) {
      expect(new Set(group.questions.map((item) => item.question.purpose))).toEqual(new Set(['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW']));
      expect(group.questions.every(({ question }) => question.options.includes(question.correctAnswer) && question.explanation.trim())).toBe(true);
    }
  });

  it('keeps candidate language and mapping claims explicit, including split/deferred codes', () => {
    const result = buildKnowledgeFactoryV3(loaded);
    const dossiers = result.compiledBatch.sourceDossiers;
    const splitCodes = dossiers.filter((item) => item.targetId === 'LINGUAGENS_UNSPECIFIED_TEXT_LANGUAGE');

    expect(splitCodes.filter((item) => item.status === 'SPLIT_INTO_MULTIPLE_SKILLS').map((item) => item.officialCode).sort()).toEqual(['EM13LGG103', 'EM13LGG301']);
    expect(splitCodes.filter((item) => item.status === 'ANALYZED_DEFERRED').map((item) => item.officialCode).sort()).toEqual(['EM13LGG104', 'EM13LGG201', 'EM13LGG704']);
    expect(dossiers.every((item) => item.mappingStatus === 'MAPPING_PENDING' && item.pedagogicalReviewStatus === 'PEDAGOGICAL_REVIEW_PENDING' && item.mappingApproved === false)).toBe(true);
    expect(result.compiledBatch.sourceDossiers.find((item) => item.officialCode === 'EM13LGG103').sourceEvidence.officialDescription).toMatch(/^Analisar o funcionamento das linguagens/);
    expect(result.compiledBatch.sourceDossiers.find((item) => item.officialCode === 'EM13LP17').sourceEvidence.officialDescription).not.toContain('MINST');
  });

  it('does not reuse the broader Physical Education skill for EF67EF10', () => {
    const result = buildKnowledgeFactoryV3(loaded);
    const candidate = batch.candidateTargets.find((item) => item.targetId === 'EDUCACAO_FISICA_UNSPECIFIED_HEALTH_LIFESTYLE');
    const dossier = result.compiledBatch.sourceDossiers.find((item) => item.officialCode === 'EF67EF10');
    const skill = result.compiledBatch.newSkills.find((item) => item.skillCode === 'PE_DISTINGUISH_ACTIVITY_EXERCISE_FII');

    expect(candidate.status).toBe('ACCEPTED_AS_INTERNAL_SKILL');
    expect(candidate.reusedSkillCode).toBeUndefined();
    expect(dossier.childSkillCode).toBe(skill.skillCode);
    expect(dossier.sourceEvidence).toMatchObject({ gradeRange: { from: 6, to: 7 }, internalGradeRange: { from: 6, to: 7 }, gradeCompatible: true, mappingStatus: 'MAPPING_PENDING' });
    expect(skill.lesson.objective).toContain('Diferenciar atividade física');

    const incompatible = structuredClone(batch);
    incompatible.newSkills.find((item) => item.skillCode === skill.skillCode).gradeTo = 9;
    expect(buildKnowledgeFactoryV3({ ...loaded, sourceBatch: incompatible }).errors).toContain('DOSSIER_GRADE_SCOPE_MISMATCH:EDUCACAO_FISICA_UNSPECIFIED_HEALTH_LIFESTYLE:EF67EF10');
  });

  it('excludes English-language source items from Portuguese exercises and records replacements', () => {
    const result = buildKnowledgeFactoryV3(loaded);
    const { sourceExclusions } = result.report.content;

    expect(sourceExclusions).toHaveLength(4);
    expect(sourceExclusions.every((item) => item.reason === 'LANGUAGE_MISMATCH_ENGLISH')).toBe(true);
    expect(result.groups.flatMap((group) => group.questions).some((item) => sourceExclusions.some((excluded) => excluded.questionId === item.sourceId))).toBe(false);
    expect(sourceExclusions.filter((item) => item.replacementQuestionId)).toHaveLength(3);
  });

  it('generates deterministic staging SQL without student history writes or publication bypasses', () => {
    const first = buildKnowledgeFactoryV3(loaded);
    const second = buildKnowledgeFactoryV3(loaded);

    expect(first.sql).toBe(second.sql);
    expect(first.report.inventoryHash).toBe(second.report.inventoryHash);
    expect(first.sql).toContain('"publication_status":"STAGING"');
    expect(first.sql).toContain('"pedagogical_review_status":"PEDAGOGICAL_REVIEW_PENDING"');
    expect(first.sql).toContain('"mapping_status":"MAPPING_PENDING"');
    expect(first.sql).toContain('active = false');
    expect(first.sql).not.toContain("'PUBLISHED'");
    expect(first.sql).not.toMatch(/(?:insert\s+into|update|delete\s+from)\s+public\.learning_(?:guided_sessions|guided_steps|guided_step_attempts|student_skill_state|skill_evidence|enrollments)/i);
    expect(first.sql).toContain("source_type = 'TECESCOLA_CORE_V4'");
    expect(first.sql).not.toContain('update public.learning_curriculum_skills set');
  });

  it('distributes correct options across the four positions across the generated pack', () => {
    const result = buildKnowledgeFactoryV3(loaded);
    const positions = [0, 0, 0, 0];

    for (const [groupIndex, group] of result.groups.entries()) {
      group.questions.forEach(({ question, kind }, questionIndex) => {
        if (kind === 'V4_REUSED') return;
        const options = orderQuestionOptions(question, questionIndex + groupIndex);
        positions[options.indexOf(question.correctAnswer)] += 1;
      });
    }
    expect(Math.max(...positions) - Math.min(...positions)).toBeLessThanOrEqual(12);
  });
});
