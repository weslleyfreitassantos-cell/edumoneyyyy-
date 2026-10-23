import { describe, expect, it } from 'vitest';
import { buildKnowledgeFactory, hashSourceContent, loadKnowledgeFactoryInputs, validateKnowledgeBatch } from './knowledge-factory.mjs';

const inputs = loadKnowledgeFactoryInputs();

describe('BNCC knowledge factory', () => {
  it('hashes text sources identically across Windows and Unix line endings', () => {
    expect(hashSourceContent('first\r\nsecond\r\n')).toBe(hashSourceContent('first\nsecond\n'));
  });

  it('reconciles every official node without promoting candidate proposals', () => {
    const report = buildKnowledgeFactory(inputs);

    expect(report.baseline.officialNodes).toBe(1723);
    expect(report.officialNodes).toHaveLength(1723);
    expect(report.baseline.officialMappingStatuses).toMatchObject({
      MAPPED: 2,
      HIERARCHY_ONLY: 104,
      CANONICAL_GAP: 1496,
      HUMAN_REVIEW_BLOCKED: 121,
    });
    expect(report.remainingGaps.officialUnaccountedNodes).toBe(0);
    expect(report.officialNodes.filter((item) => item.candidateIsNotAMapping && item.mappingStatus !== 'MAPPED').length).toBeGreaterThan(0);
    expect(report.officialNodes.filter((item) => item.mappingStatus !== 'MAPPED').every((item) => item.verifiedCanonicalSkillCodes.length === 0)).toBe(true);
  });

  it('labels the production snapshot as historical and preserves the review gate', () => {
    const report = buildKnowledgeFactory(inputs);
    const production = report.baseline.historicalProductionSnapshot;

    expect(production).toMatchObject({
      asOf: '2026-10-12T21:37:24Z',
      evidenceStatus: 'HISTORICAL_ONLY',
      currentProductionState: 'NOT_ASSERTED',
    });
    expect(production.migrationLedger.latestVersion).toBe('20261012000400');
    expect(production.activeCounts.disciplineJourneys).toBe(48);
    expect(production.activeCounts.tecEscolaQuestionBank).toBe(1447);
    expect(production.curriculumAlignmentStatusCounts).toEqual({ CANDIDATE: 152, MAPPED: 2 });
    expect(production.journeyOfficialSkillLinkStatusCounts).toEqual({ MAPPING_PENDING: 3 });
    expect(production.journeyPublication).toMatchObject({
      demoPreview: 48,
      published: 0,
      pedagogicalReviewPending: 48,
      mappingPending: 48,
    });
    expect(production.v9ActiveQuestionSetLinks).toEqual({
      distinctQuestionsLinked: 872,
      bySource: {
        v9QuestionExpansion: 152,
        'v9.3JourneyExpansion': 480,
        'v9.4FourthJourneyExpansion': 240,
      },
      interpretation: 'Linked to active question sets; this is not a claim of general student availability or pedagogical approval.',
    });
    expect(production.scope).toMatchObject({ productionWrites: false, studentHistoryModified: false, otherServicesTouched: false });
  });

  it('validates a cross-subject, cross-stage first batch without declaring it published', () => {
    const report = buildKnowledgeFactory(inputs);

    expect(validateKnowledgeBatch(inputs.batch, inputs)).toEqual([]);
    expect(report.authoredBatch).toMatchObject({
      skills: 3,
      newCanonicalSkills: 0,
      subjects: ['BIOLOGY', 'HISTORY', 'SCIENCE'],
      stages: ['ENSINO_MEDIO', 'FUNDAMENTAL_II'],
      lessons: 3,
      questions: 36,
      newCurriculumUnits: 0,
      officialMappingGapsResolved: 0,
      adaptiveSequencesWithAllPurposes: 3,
      publicationStatus: 'STAGING',
      mappingStatus: 'MAPPING_PENDING',
      pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      technicalValidation: 'PASS',
    });
    expect(report.authoredBatch.stagingSkillCoverage.every((item) => item.studentAvailable === false)).toBe(true);
    expect(report.stagingCoverage).toEqual({
      technicalGapSkillsCovered: 3,
      technicalGapPairsCovered: 14,
      officialMappingGapsResolved: 0,
      newCanonicalSkills: 0,
      newCurriculumUnits: 0,
      studentAvailableSkills: 0,
    });
    expect(report.safety).toMatchObject({
      proposedMappingsPromoted: 0,
      newContentPublished: false,
      newContentAvailableToStudents: false,
    });
  });

  it('rejects publication, fabricated official mappings, and scope mismatches', () => {
    const invalid = structuredClone(inputs.batch);
    invalid.publicationStatus = 'PUBLISHED';
    invalid.skills[0].officialCodes = ['EF06CI01'];
    invalid.skills[1].gradeFrom = 3;

    const errors = validateKnowledgeBatch(invalid, inputs);

    expect(errors).toContain('BATCH_MUST_REMAIN_STAGING');
    expect(errors).toContain('UNVERIFIED_OFFICIAL_CODES:SCIENCE_PLAN_INVESTIGATION');
    expect(errors).toContain('CURRICULUM_SCOPE_MISMATCH:HISTORY_ORDER_EVENTS');
  });

  it('rejects duplicate stems, missing adaptive purposes, and answer keys outside the options', () => {
    const invalid = structuredClone(inputs.batch);
    const biology = invalid.skills.find((item) => item.skillCode === 'BIOLOGY_ECOSYSTEM_INTERACTIONS');
    biology.questions[0].statement = biology.questions[1].statement;
    biology.questions[1].correctAnswer = 'Resposta que não existe';
    biology.questions[0].purpose = 'PRACTICE';

    const errors = validateKnowledgeBatch(invalid, inputs);

    expect(errors).toContain('DUPLICATE_OR_EMPTY_QUESTION_STEM:kgf-bio-eco-02');
    expect(errors).toContain('QUESTION_OPTIONS_INVALID:kgf-bio-eco-02');
    expect(errors).toContain('PURPOSE_COVERAGE:BIOLOGY_ECOSYSTEM_INTERACTIONS:PROBE:1');
  });
});
