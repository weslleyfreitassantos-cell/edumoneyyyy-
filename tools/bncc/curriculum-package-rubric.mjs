const REQUIRED_PHASES = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];

function isNonEmptyText(value, minimum = 1) {
  return typeof value === 'string' && value.trim().length >= minimum;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

export function evaluateCurriculumPackageRubric(pack, { requirements = {}, officialSourceRecord = null } = {}) {
  const lesson = pack?.lesson ?? {};
  const questions = array(pack?.questions);
  const activities = array(lesson.authenticActivities);
  const concepts = array(lesson.keyConcepts);
  const prerequisites = array(lesson.priorKnowledge);
  const phases = array(lesson.progression);
  const remediations = array(lesson.remediations);
  const ids = new Set(questions.map((item) => item?.id).filter(Boolean));
  const expectedDescriptor = officialSourceRecord?.descriptor;
  const requiredQuestionCount = requirements.questions ?? 40;
  const phaseNames = new Set(phases.map((phase) => phase?.phase));
  const phaseIds = phases.flatMap((phase) => array(phase?.questionIds));
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
  const supports = array(lesson.accessibilitySupports);
  const questionSupports = questions.length > 0 && questions.every((question) => array(question?.accessibility?.supports).length >= 2);
  const checks = [
    {
      id: 'official-source-and-descriptor',
      pass: Boolean(officialSourceRecord
        && officialSourceRecord.technicalVerificationStatus === 'OFFICIAL_SOURCE_VERIFIED_EXACT'
        && pack?.sourceContext?.officialCode === officialSourceRecord.officialCode
        && pack?.sourceContext?.descriptor === expectedDescriptor
        && pack?.sourceContext?.officialSource?.url === officialSourceRecord.officialSource?.url
        && pack?.sourceContext?.officialSource?.page === officialSourceRecord.officialSource?.page),
    },
    {
      id: 'concept-coverage-and-progressive-explanation',
      pass: concepts.length >= 4
        && isNonEmptyText(lesson.objective, 20)
        && isNonEmptyText(lesson.explanation, 120)
        && isNonEmptyText(lesson.workedExample, 30)
        && isNonEmptyText(lesson.commonMistake, 20),
    },
    {
      id: 'prerequisites-declared',
      pass: prerequisites.length >= 1 && prerequisites.every((item) => isNonEmptyText(item, 8)),
    },
    {
      id: 'progression-maps-assessments',
      pass: REQUIRED_PHASES.every((phase) => phaseNames.has(phase))
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
      pass: questions.length >= requiredQuestionCount
        && ids.size === questions.length
        && REQUIRED_PHASES.every((phase) => purposes.has(phase))
        && answerIntegrity,
    },
    {
      id: 'targeted-remediation',
      pass: remediations.length >= 2
        && remediations.every((item) => isNonEmptyText(item?.errorFocus) && isNonEmptyText(item?.action, 20)),
    },
    {
      id: 'accessibility-supports',
      pass: supports.length >= 2 || questionSupports,
    },
    {
      id: 'inactive-staging-governance',
      pass: pack?.active === false
        && pack?.publicationStatus === 'STAGING_INACTIVE'
        && pack?.pedagogicalReviewStatus === 'PEDAGOGICAL_REVIEW_PENDING'
        && pack?.officialMappingStatus === 'NOT_CLAIMED',
    },
  ];
  const incomplete = checks.filter((check) => !check.pass).map((check) => check.id);
  return {
    rubricVersion: 'tec-escola.bncc.technical-completeness.v1',
    status: incomplete.length === 0 ? 'AUTOMATED_SCREEN_PASS' : 'AUTOMATED_SCREEN_INCOMPLETE',
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
