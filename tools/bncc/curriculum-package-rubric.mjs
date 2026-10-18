const REQUIRED_PHASES = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];
const OBJECTIVE_MODE = 'OBJECTIVE_LEARNING_PATH';
const PERFORMANCE_MODE = 'PRACTICAL_PERFORMANCE';
const OBSERVATION_MODE = 'EDUCATOR_MEDIATED_OBSERVATION';

function isNonEmptyText(value, minimum = 1) {
  return typeof value === 'string' && value.trim().length >= minimum;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  return typeof value === 'string'
    ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    : '';
}

function sourceIsExact(pack, officialSourceRecord) {
  if (!officialSourceRecord || officialSourceRecord.technicalVerificationStatus !== 'OFFICIAL_SOURCE_VERIFIED_EXACT') return false;
  const sourceContext = pack?.sourceContext ?? {};
  const officialSource = sourceContext.officialSource ?? pack?.officialSource ?? {};
  const code = sourceContext.officialCode ?? pack?.officialCode;
  const descriptor = sourceContext.descriptor ?? pack?.descriptor;
  const sourceStatus = sourceContext.sourceStatus ?? pack?.sourceStatus;
  return code === officialSourceRecord.officialCode
    && descriptor === officialSourceRecord.descriptor
    && (sourceStatus === 'OFFICIAL_SOURCE_VERIFIED_EXACT' || sourceStatus === 'VERIFIED')
    && officialSource.url === officialSourceRecord.officialSource?.url
    && officialSource.page === officialSourceRecord.officialSource?.page;
}

function result(mode, checks, structuralIds) {
  const incomplete = checks.filter((check) => !check.pass).map((check) => check.id);
  const structuralIncomplete = checks.filter((check) => structuralIds.has(check.id) && !check.pass);
  const qualityIncomplete = checks.filter((check) => !structuralIds.has(check.id) && !check.pass);
  const structuralPass = structuralIncomplete.length === 0;
  const qualityPass = qualityIncomplete.length === 0;
  const prepared = structuralPass && qualityPass;
  return {
    rubricVersion: 'tec-escola.bncc.technical-completeness.v2',
    mode,
    status: prepared ? 'AUTOMATED_SCREEN_PASS' : 'AUTOMATED_SCREEN_INCOMPLETE',
    structuralValidationStatus: structuralPass ? 'STRUCTURAL_VALIDATION_PASS' : 'STRUCTURAL_VALIDATION_FAIL',
    automatedQualityScreenStatus: qualityPass ? 'AUTOMATED_QUALITY_SCREEN_PASS' : 'AUTOMATED_QUALITY_SCREEN_INCOMPLETE',
    contentTechnicalPreparationStatus: prepared ? 'CONTENT_TECHNICALLY_PREPARED' : 'CONTENT_REPAIR_REQUIRED',
    humanPedagogicalApprovalStatus: 'HUMAN_PEDAGOGICAL_REVIEW_PENDING',
    checks,
    incomplete,
    humanReview: {
      status: 'PEDAGOGICAL_REVIEW_PENDING',
      requiredJudgments: [
        'CONCEPTUAL_ACCURACY_AND_SCOPE',
        'AGE_AND_CONTEXT_SUITABILITY',
        'INCLUSION_AND_NON_STIGMATIZING_LANGUAGE',
        'ASSESSMENT_VALIDITY',
        'OFFICIAL_MAPPING_AND_PUBLICATION_APPROVAL',
      ],
      automatedApprovalClaimed: false,
    },
  };
}

function evaluateObservationPackage(pack, requirements, officialSourceRecord) {
  const design = pack?.learningDesign ?? {};
  const contentStatus = pack?.contentStatus ?? {};
  const experiences = array(design.observationExperiences);
  const criteria = array(design.observationCriteria);
  const requiredFields = array(design.evidenceRecord?.requiredFields);
  const adaptations = array(design.adaptations);
  const expectedExperiences = requirements.observationalExperiences ?? 1;
  const expectedCriteria = requirements.observationCriteria ?? 3;
  const checks = [
    {
      id: 'official-source-and-descriptor',
      pass: sourceIsExact(pack, officialSourceRecord),
    },
    {
      id: 'observation-experience-structure',
      pass: experiences.length >= expectedExperiences
        && experiences.every((experience) => isNonEmptyText(experience?.title, 8)
          && array(experience?.steps).length >= 3
          && isNonEmptyText(experience?.observableEvidence, 20)),
    },
    {
      id: 'observation-criteria',
      pass: criteria.length >= expectedCriteria
        && criteria.every((criterion) => isNonEmptyText(criterion, 12)),
    },
    {
      id: 'privacy-aware-evidence-record',
      pass: requiredFields.length >= 4
        && isNonEmptyText(design.evidenceRecord?.privacy, 30)
        && /privacidade|privacy|consentimento|confidencial|não expor|nao expor|imagem|dados pessoais|autorizado/i.test(design.evidenceRecord.privacy),
    },
    {
      id: 'accessible-participation-adaptations',
      pass: adaptations.length >= 2 && adaptations.every((adaptation) => isNonEmptyText(adaptation, 20)),
    },
    {
      id: 'inactive-staging-governance',
      pass: pack?.active === false
        && contentStatus.publicationStatus === 'STAGING_INACTIVE'
        && contentStatus.pedagogicalReviewStatus === 'PEDAGOGICAL_REVIEW_PENDING'
        && contentStatus.officialMappingStatus === 'NOT_CLAIMED'
        && contentStatus.studentQuiz === 'NOT_CREATED'
        && contentStatus.humanApproval === 'NOT_GRANTED',
    },
  ];
  return result(OBSERVATION_MODE, checks, new Set(['official-source-and-descriptor', 'observation-experience-structure', 'observation-criteria', 'privacy-aware-evidence-record', 'inactive-staging-governance']));
}

export function evaluateCurriculumPackageRubric(pack, { requirements = {}, officialSourceRecord = null } = {}) {
  const mode = requirements.mode ?? pack?.evidenceMode ?? OBJECTIVE_MODE;
  if (mode === OBSERVATION_MODE) return evaluateObservationPackage(pack, requirements, officialSourceRecord);

  const lesson = pack?.lesson ?? {};
  const questions = array(pack?.questions);
  const activities = array(lesson.authenticActivities);
  const concepts = array(lesson.keyConcepts);
  const prerequisites = array(lesson.priorKnowledge);
  const phases = array(lesson.progression);
  const remediations = array(lesson.remediations);
  const ids = new Set(questions.map((item) => item?.id).filter(Boolean));
  const phaseNames = new Set(phases.map((phase) => phase?.phase ?? phase?.stage));
  const phaseIds = phases.flatMap((phase) => array(phase?.questionIds));
  const requiredPhases = Array.isArray(requirements.phases)
    ? requirements.phases
    : mode === PERFORMANCE_MODE ? [] : REQUIRED_PHASES;
  const purposes = new Set(questions.map((item) => item?.purpose));
  const answerIntegrity = questions.every((question) => (
    isNonEmptyText(question?.id)
    && array(question?.options).length === 4
    && question.options.filter((option) => option === question.correctAnswer).length === 1
    && isNonEmptyText(question?.explanation, 12)
    && isNonEmptyText(question?.hint, 8)
    && isNonEmptyText(question?.errorFocus)
  ));
  const lessonActivitiesComplete = activities.length >= (requirements.activities ?? 1)
    && activities.every((activity) => array(activity?.steps).length >= 3
      && isNonEmptyText(activity?.evidence)
      && array(activity?.rubric).length >= 2);
  const questionCount = requirements.questions ?? (mode === PERFORMANCE_MODE ? 0 : 40);
  const hasObjectiveQuestionContract = mode === OBJECTIVE_MODE && questionCount > 0;
  const normalizedStatements = questions.map((question) => normalizeText(question?.statement)).filter(Boolean);
  const statementDiversityComplete = !hasObjectiveQuestionContract
    || (normalizedStatements.length === questions.length && new Set(normalizedStatements).size === normalizedStatements.length);
  const normalizedContexts = questions.map((question) => normalizeText(question?.contextFamily)).filter(Boolean);
  const minimumContextFamilies = requirements.contextFamilies ?? Math.ceil(questionCount * 0.9);
  const contextDiversityComplete = !hasObjectiveQuestionContract
    || (normalizedContexts.length === questions.length
      && new Set(normalizedContexts).size >= minimumContextFamilies);
  const purposesComplete = !hasObjectiveQuestionContract || requiredPhases.every((phase) => purposes.has(phase));
  const answerPositions = questions.map((question) => question.options?.indexOf(question.correctAnswer)).filter((position) => position >= 0);
  const positionCounts = [0, 0, 0, 0].map((position) => answerPositions.filter((item) => item === position).length);
  const answerPositionDiversity = !hasObjectiveQuestionContract || questions.length < 8
    || (positionCounts.filter((count) => count > 0).length >= Math.min(4, Math.ceil(questions.length / 4))
      && Math.max(...positionCounts) <= Math.ceil(questions.length * 0.5));
  const supports = array(lesson.accessibilitySupports);
  const questionSupports = questions.length > 0 && questions.every((question) => array(question?.accessibility?.supports).length >= 2);
  const sourcePass = sourceIsExact(pack, officialSourceRecord);
  const checks = [
    {
      id: 'official-source-and-descriptor',
      pass: sourcePass,
    },
    {
      id: 'concept-coverage-and-progressive-explanation',
      pass: concepts.length >= (requirements.concepts ?? (mode === PERFORMANCE_MODE ? 2 : 3))
        && isNonEmptyText(lesson.objective, 20)
        && isNonEmptyText(lesson.explanation ?? lesson.progressiveExplanation, 120)
        && isNonEmptyText(lesson.workedExample, 30)
        && isNonEmptyText(lesson.commonMistake ?? lesson.commonErrors, 20),
    },
    {
      id: 'prerequisites-declared',
      pass: prerequisites.length >= (requirements.prerequisites ?? 1)
        && prerequisites.every((item) => isNonEmptyText(item, 8)),
    },
    {
      id: 'progression-maps-assessments',
      pass: phaseNames.size >= requiredPhases.length
        && requiredPhases.every((phase) => phaseNames.has(phase))
        && phaseIds.length === ids.size
        && new Set(phaseIds).size === phaseIds.length
        && phaseIds.every((id) => ids.has(id)),
    },
    {
      id: 'authentic-practice-and-observable-evidence',
      pass: lessonActivitiesComplete,
    },
    {
      id: 'assessment-coverage-and-answer-feedback',
      pass: questions.length >= questionCount
        && ids.size === questions.length
        && purposesComplete
        && answerIntegrity,
    },
    {
      id: 'question-statement-diversity',
      pass: statementDiversityComplete,
    },
    {
      id: 'question-context-diversity',
      pass: contextDiversityComplete,
    },
    {
      id: 'answer-position-diversity',
      pass: answerPositionDiversity,
    },
    {
      id: 'targeted-remediation',
      pass: remediations.length >= (requirements.remediations ?? 2)
        && remediations.every((item) => isNonEmptyText(item?.errorFocus) && isNonEmptyText(item?.action, 20)),
    },
    {
      id: 'accessibility-supports',
      pass: supports.length >= (requirements.accessibilitySupports ?? 2) || questionSupports,
    },
    {
      id: 'inactive-staging-governance',
      pass: pack?.active === false
        && pack?.publicationStatus === 'STAGING_INACTIVE'
        && pack?.pedagogicalReviewStatus === 'PEDAGOGICAL_REVIEW_PENDING'
        && pack?.officialMappingStatus === 'NOT_CLAIMED',
    },
  ];
  const structuralIds = new Set(['official-source-and-descriptor', 'progression-maps-assessments', 'assessment-coverage-and-answer-feedback', 'inactive-staging-governance']);
  return result(mode, checks, structuralIds);
}
