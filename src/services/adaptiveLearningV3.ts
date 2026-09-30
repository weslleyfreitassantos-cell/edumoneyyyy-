export const V3_PURPOSES = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'] as const;
export type AdaptiveV3Purpose = (typeof V3_PURPOSES)[number];

export const V3_RELATION_ROLES = ['PRIMARY', 'SUPPORTING', 'PREREQUISITE', 'TRANSFER'] as const;
export type AdaptiveV3RelationRole = (typeof V3_RELATION_ROLES)[number];

export const V3_COGNITIVE_PROCESSES = [
  'RECOGNIZE', 'IDENTIFY', 'RECALL', 'APPLY', 'COMPARE', 'INTERPRET',
  'ANALYZE', 'INFER', 'ARGUE', 'CREATE', 'EVALUATE',
] as const;
export type AdaptiveV3CognitiveProcess = (typeof V3_COGNITIVE_PROCESSES)[number];

export const V3_SUBJECTS = [
  ['PORTUGUESE', 'Lingua Portuguesa', ['READING_LITERAL', 'READING_INFERENCE', 'READING_ARGUMENT'], 'READING_ARGUMENT'],
  ['MATHEMATICS', 'Matematica', ['FRACTIONS', 'RATIO_PROPORTION', 'PERCENTAGE'], 'PERCENTAGE'],
  ['SCIENCE', 'Ciencias', ['SCIENCE_MATTER', 'SCIENCE_TRANSFORMATIONS', 'SCIENCE_ENERGY'], 'SCIENCE_TRANSFORMATIONS'],
  ['BIOLOGY', 'Biologia', ['BIOLOGY_CELL', 'BIOLOGY_GENETICS', 'BIOLOGY_ECOLOGY'], 'BIOLOGY_GENETICS'],
  ['PHYSICS', 'Fisica', ['PHYSICS_MEASUREMENT', 'PHYSICS_MOTION', 'PHYSICS_AVERAGE_SPEED'], 'PHYSICS_AVERAGE_SPEED'],
  ['CHEMISTRY', 'Quimica', ['CHEMISTRY_MATTER', 'CHEMISTRY_ATOMS', 'CHEMISTRY_TRANSFORMATIONS'], 'CHEMISTRY_ATOMS'],
  ['HISTORY', 'Historia', ['HISTORY_SOURCES', 'HISTORY_CHRONOLOGY', 'HISTORY_INTERPRETATION'], 'HISTORY_INTERPRETATION'],
  ['GEOGRAPHY', 'Geografia', ['GEOGRAPHY_SPACE', 'GEOGRAPHY_CARTOGRAPHY', 'GEOGRAPHY_TERRITORY'], 'GEOGRAPHY_TERRITORY'],
  ['PHILOSOPHY', 'Filosofia', ['PHILOSOPHY_CONCEPT', 'PHILOSOPHY_ARGUMENT', 'PHILOSOPHY_LOGIC'], 'PHILOSOPHY_ARGUMENT'],
  ['SOCIOLOGY', 'Sociologia', ['SOCIOLOGY_INDIVIDUAL', 'SOCIOLOGY_INSTITUTIONS', 'SOCIOLOGY_STRUCTURE'], 'SOCIOLOGY_INSTITUTIONS'],
  ['ART', 'Arte', ['ART_ELEMENTS', 'ART_INTERPRETATION', 'ART_CONTEXT'], 'ART_INTERPRETATION'],
  ['PHYSICAL_EDUCATION', 'Educacao Fisica', ['PE_BODY_MOVEMENT', 'PE_SPORT_PRINCIPLES', 'PE_HEALTH_ACTIVITY'], 'PE_SPORT_PRINCIPLES'],
  ['ENGLISH', 'Lingua Inglesa', ['ENGLISH_VOCABULARY', 'ENGLISH_READING', 'ENGLISH_INFERENCE'], 'ENGLISH_READING'],
  ['RELIGIOUS_EDUCATION', 'Ensino Religioso', ['RELIGIOUS_TRADITIONS', 'RELIGIOUS_DIVERSITY', 'RELIGIOUS_INTERPRETATION'], 'RELIGIOUS_DIVERSITY'],
  ['COMPUTING', 'Computacao e Educacao Digital', ['COMPUTING_ALGORITHMS', 'COMPUTING_DIGITAL_REPRESENTATION', 'COMPUTING_DIGITAL_CITIZENSHIP'], 'COMPUTING_ALGORITHMS'],
] as const;

export interface AdaptiveV3Question {
  id: string;
  subject: string;
  domain: string;
  topic: string;
  primarySkill: string;
  supportingSkills: readonly string[];
  prerequisiteSkills: readonly string[];
  transferSkills: readonly string[];
  purpose: AdaptiveV3Purpose;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  cognitiveProcess: AdaptiveV3CognitiveProcess;
  contextFamily: string;
  statement: string;
  options: readonly string[];
  correctAnswer: string;
  explanation: string;
  misconceptionsByOption: Readonly<Record<string, string[]>>;
  provenance: 'TECESCOLA_CORE_V3';
}

export interface AdaptiveV3SubjectContract {
  code: string;
  name: string;
  skills: readonly string[];
  targetSkill: string;
  capability: 'OBJECTIVE_EVIDENCE_READY' | 'CONSTRUCTED_EVIDENCE_REQUIRED' | 'OBSERVATIONAL_EVIDENCE_REQUIRED';
}

export const V3_SUBJECT_CONTRACTS: readonly AdaptiveV3SubjectContract[] = V3_SUBJECTS.map(([code, name, skills, targetSkill]) => ({
  code,
  name,
  skills,
  targetSkill,
  capability: 'OBJECTIVE_EVIDENCE_READY',
}));

const CONTEXT_FAMILIES = [
  'DIRECT_CALCULATION', 'DISCOUNT', 'INCREASE', 'PROPORTION', 'FINANCIAL_CONTEXT',
  'CLASSROOM', 'COMPARISON', 'CHART', 'DAILY_LIFE', 'TRANSFER', 'LOCK_IN', 'REVIEW',
] as const;

const PURPOSE_FOR_INDEX: readonly AdaptiveV3Purpose[] = [
  'PROBE', 'PROBE', 'PROBE', 'PRACTICE', 'PRACTICE', 'PRACTICE', 'PRACTICE',
  'TRANSFER', 'TRANSFER', 'LOCK_IN', 'LOCK_IN', 'REVIEW',
];

const PROCESS_FOR_PURPOSE: Record<AdaptiveV3Purpose, AdaptiveV3CognitiveProcess> = {
  PROBE: 'IDENTIFY',
  PRACTICE: 'APPLY',
  TRANSFER: 'INTERPRET',
  LOCK_IN: 'ANALYZE',
  REVIEW: 'EVALUATE',
};

export function generateV3Questions(
  subject: AdaptiveV3SubjectContract,
  domain: string,
): AdaptiveV3Question[] {
  return PURPOSE_FOR_INDEX.map((purpose, index) => {
    const number = index + 1;
    const contextFamily = CONTEXT_FAMILIES[index];
    const correctAnswer = `Aplicacao coerente de ${subject.targetSkill}`;
    return {
      id: `v3-${subject.code.toLowerCase()}-${subject.targetSkill.toLowerCase()}-${number}`,
      subject: subject.code,
      domain,
      topic: subject.targetSkill,
      primarySkill: subject.targetSkill,
      supportingSkills: [],
      prerequisiteSkills: [],
      transferSkills: [],
      purpose,
      difficulty: number <= 3 ? 'EASY' : number >= 10 ? 'HARD' : 'MEDIUM',
      cognitiveProcess: PROCESS_FOR_PURPOSE[purpose],
      contextFamily,
      statement: `${subject.name} | ${subject.targetSkill} | ${contextFamily} | questao ${number}: qual alternativa aplica melhor o conceito ao contexto apresentado?`,
      options: [
        correctAnswer,
        `Confusao comum sobre ${subject.targetSkill}`,
        `Informacao sem relacao com ${subject.targetSkill}`,
        `Conclusao que contradiz ${subject.targetSkill}`,
      ],
      correctAnswer,
      explanation: `A alternativa correta relaciona o contexto ao conceito de ${subject.targetSkill} sem extrapolar as evidencias.`,
      misconceptionsByOption: {},
      provenance: 'TECESCOLA_CORE_V3',
    };
  });
}

export interface AdaptiveV3ValidationResult {
  valid: boolean;
  duplicateStems: number;
  missingPrimary: number;
  multiplePrimary: number;
  invalidRelationRoles: number;
  invalidSubjects: number;
  invalidSkills: number;
  invalidOptions: number;
  invalidAnswers: number;
  missingExplanations: number;
  missingCognitiveProcess: number;
  missingProvenance: number;
  invalidMisconceptions: number;
  purposeCoverage: Record<string, number>;
}

export function validateAdaptiveV3Questions(
  questions: readonly AdaptiveV3Question[],
  knownSubjects: ReadonlySet<string>,
  knownSkills: ReadonlySet<string>,
): AdaptiveV3ValidationResult {
  const stems = new Map<string, number>();
  let missingPrimary = 0;
  let multiplePrimary = 0;
  let invalidRelationRoles = 0;
  let invalidSubjects = 0;
  let invalidSkills = 0;
  let invalidOptions = 0;
  let invalidAnswers = 0;
  let missingExplanations = 0;
  let missingCognitiveProcess = 0;
  let missingProvenance = 0;
  let invalidMisconceptions = 0;
  const purposeCoverage: Record<string, number> = {};

  for (const question of questions) {
    const stem = question.statement.trim().toLocaleLowerCase('pt-BR');
    stems.set(stem, (stems.get(stem) ?? 0) + 1);
    const roles = [
      ['PRIMARY', question.primarySkill],
      ...question.supportingSkills.map((skill) => ['SUPPORTING', skill] as const),
      ...question.prerequisiteSkills.map((skill) => ['PREREQUISITE', skill] as const),
      ...question.transferSkills.map((skill) => ['TRANSFER', skill] as const),
    ] as const;
    if (!question.primarySkill) missingPrimary += 1;
    if (question.primarySkill && new Set(roles.map(([, skill]) => skill)).size !== roles.length) multiplePrimary += 1;
    if (!knownSubjects.has(question.subject)) invalidRelationRoles += 1;
    if (!knownSkills.has(question.primarySkill) || roles.some(([, skill]) => !knownSkills.has(skill))) invalidRelationRoles += 1;
    if (!knownSubjects.has(question.subject)) invalidSubjects += 1;
    if (!knownSkills.has(question.primarySkill) || roles.some(([, skill]) => !knownSkills.has(skill))) invalidSkills += 1;
    if (question.options.length < 2 || new Set(question.options.map((option) => option.trim())).size !== question.options.length) invalidOptions += 1;
    if (!question.options.some((option) => option.trim() === question.correctAnswer.trim())) invalidAnswers += 1;
    if (!question.explanation.trim()) missingExplanations += 1;
    if (!V3_COGNITIVE_PROCESSES.includes(question.cognitiveProcess)) missingCognitiveProcess += 1;
    if (question.provenance !== 'TECESCOLA_CORE_V3') missingProvenance += 1;
    for (const [option, tags] of Object.entries(question.misconceptionsByOption)) {
      if (!question.options.includes(option) || tags.some((tag) => !tag.trim())) invalidMisconceptions += 1;
    }
    purposeCoverage[question.purpose] = (purposeCoverage[question.purpose] ?? 0) + 1;
  }

  const duplicateStems = [...stems.values()].filter((count) => count > 1).length;
  const valid = duplicateStems === 0 && missingPrimary === 0 && multiplePrimary === 0
    && invalidRelationRoles === 0 && invalidSubjects === 0 && invalidSkills === 0
    && invalidOptions === 0 && invalidAnswers === 0 && missingExplanations === 0
    && missingCognitiveProcess === 0 && missingProvenance === 0 && invalidMisconceptions === 0;
  return {
    valid, duplicateStems, missingPrimary, multiplePrimary, invalidRelationRoles,
    invalidSubjects, invalidSkills, invalidOptions, invalidAnswers,
    missingExplanations, missingCognitiveProcess, missingProvenance,
    invalidMisconceptions, purposeCoverage,
  };
}

export const KNOWLEDGE_ATTRIBUTION_POLICY_V1 = {
  version: 'V1',
  primaryCorrectConfidence: 1,
  primaryWrongConfidence: 1,
  supportingCorrectConfidence: 0.5,
  prerequisiteCorrectConfidence: 0.35,
  transferCorrectConfidence: 0.5,
  secondaryWrongRequiresMisconception: true,
  singleErrorConfirmsGap: false,
  confirmationMinimumSignals: 3,
  confirmationMinimumContexts: 2,
} as const;

export type MisconceptionState = 'SIGNAL' | 'SUSPECTED' | 'CONFIRMED' | 'RECOVERING' | 'RESOLVED';

export interface MisconceptionObservation {
  correct: boolean;
  contextFamily: string;
  misconceptionCode?: string | null;
}

export function deriveMisconceptionState(observations: readonly MisconceptionObservation[]): MisconceptionState {
  const negative = observations.filter((observation) => !observation.correct && observation.misconceptionCode);
  if (negative.length === 0) return 'RESOLVED';
  const contexts = new Set(negative.map((observation) => observation.contextFamily));
  const positive = observations.filter((observation) => observation.correct).length;
  if (negative.length >= KNOWLEDGE_ATTRIBUTION_POLICY_V1.confirmationMinimumSignals
      && contexts.size >= KNOWLEDGE_ATTRIBUTION_POLICY_V1.confirmationMinimumContexts) {
    return positive >= 2 ? 'RESOLVED' : positive === 1 ? 'RECOVERING' : 'CONFIRMED';
  }
  return negative.length === 1 ? 'SIGNAL' : 'SUSPECTED';
}

export interface V3EvidenceAttribution {
  role: AdaptiveV3RelationRole;
  skillCode: string;
  confidence: number;
  negative: boolean;
  reasonCode: string;
}

export function attributeV3Evidence(
  question: Pick<AdaptiveV3Question, 'primarySkill' | 'supportingSkills' | 'prerequisiteSkills' | 'transferSkills' | 'misconceptionsByOption'>,
  correct: boolean,
  selectedOption: string,
): V3EvidenceAttribution[] {
  const result: V3EvidenceAttribution[] = [{
    role: 'PRIMARY',
    skillCode: question.primarySkill,
    confidence: KNOWLEDGE_ATTRIBUTION_POLICY_V1.primaryWrongConfidence,
    negative: !correct,
    reasonCode: correct ? 'PRIMARY_SKILL_EVIDENCE' : 'PRIMARY_SKILL_LOW_EVIDENCE',
  }];
  const mappedMisconception = question.misconceptionsByOption[selectedOption]?.length > 0;
  for (const skillCode of question.supportingSkills) {
    if (correct) result.push({ role: 'SUPPORTING', skillCode, confidence: KNOWLEDGE_ATTRIBUTION_POLICY_V1.supportingCorrectConfidence, negative: false, reasonCode: 'SUPPORT_SKILL_POSITIVE_EVIDENCE' });
    else if (mappedMisconception) result.push({ role: 'SUPPORTING', skillCode, confidence: 0.8, negative: true, reasonCode: 'MISCONCEPTION_REPEATED' });
  }
  for (const skillCode of question.prerequisiteSkills) {
    if (correct) result.push({ role: 'PREREQUISITE', skillCode, confidence: KNOWLEDGE_ATTRIBUTION_POLICY_V1.prerequisiteCorrectConfidence, negative: false, reasonCode: 'PREREQUISITE_POSITIVE_EVIDENCE' });
    else if (mappedMisconception) result.push({ role: 'PREREQUISITE', skillCode, confidence: 0.8, negative: true, reasonCode: 'PREREQUISITE_CONFIRMED_GAP' });
  }
  for (const skillCode of question.transferSkills) {
    if (correct) result.push({ role: 'TRANSFER', skillCode, confidence: KNOWLEDGE_ATTRIBUTION_POLICY_V1.transferCorrectConfidence, negative: false, reasonCode: 'TRANSFER_EVIDENCE' });
    else if (mappedMisconception) result.push({ role: 'TRANSFER', skillCode, confidence: 0.8, negative: true, reasonCode: 'MISCONCEPTION_REPEATED' });
  }
  return result;
}

export interface V3KnowledgeState {
  skillCode: string;
  subjectCode: string;
  state: AdaptiveSkillStateV3;
  mastery: number;
  confidence: number;
}

export type AdaptiveSkillStateV3 = 'UNKNOWN' | 'INTRODUCED' | 'PRACTICING' | 'MASTERED' | 'NEEDS_REVIEW';

export interface V3BridgeRelation {
  fromSkill: string;
  toSkill: string;
  relation: 'PREREQUISITE' | 'RELATED' | 'TRANSFER';
}

export interface V3MisconceptionSummary {
  skillCode: string;
  state: MisconceptionState;
}

export interface V3Plan {
  decision: 'ON_TARGET' | 'DIAGNOSTIC_NEEDED' | 'CROSS_SUBJECT_BRIDGE' | 'RETURN_TO_ORIGINAL_TARGET';
  originalTargetSubject: string;
  originalTargetSkill: string;
  currentSubject: string;
  currentSkill: string;
  reasonCode: string;
}

export function planAdaptiveKnowledgeGraphV3(input: {
  originalTargetSubject: string;
  originalTargetSkill: string;
  states: readonly V3KnowledgeState[];
  relations: readonly V3BridgeRelation[];
  misconceptions: readonly V3MisconceptionSummary[];
}): V3Plan {
  const stateBySkill = new Map(input.states.map((state) => [state.skillCode, state]));
  const confirmed = new Set(input.misconceptions.filter((item) => item.state === 'CONFIRMED').map((item) => item.skillCode));
  const bridge = input.relations.find((relation) => relation.fromSkill === input.originalTargetSkill && confirmed.has(relation.toSkill));
  if (bridge) {
    const destination = stateBySkill.get(bridge.toSkill);
    return {
      decision: 'CROSS_SUBJECT_BRIDGE',
      originalTargetSubject: input.originalTargetSubject,
      originalTargetSkill: input.originalTargetSkill,
      currentSubject: destination?.subjectCode ?? input.originalTargetSubject,
      currentSkill: bridge.toSkill,
      reasonCode: 'PREREQUISITE_CONFIRMED_GAP',
    };
  }
  const target = stateBySkill.get(input.originalTargetSkill);
  if (!target || target.state === 'UNKNOWN') {
    return { decision: 'DIAGNOSTIC_NEEDED', originalTargetSubject: input.originalTargetSubject, originalTargetSkill: input.originalTargetSkill, currentSubject: input.originalTargetSubject, currentSkill: input.originalTargetSkill, reasonCode: 'PRIMARY_SKILL_LOW_EVIDENCE' };
  }
  if (target.state === 'MASTERED') {
    return { decision: 'ON_TARGET', originalTargetSubject: input.originalTargetSubject, originalTargetSkill: input.originalTargetSkill, currentSubject: input.originalTargetSubject, currentSkill: input.originalTargetSkill, reasonCode: 'KNOWLEDGE_RECOVERED' };
  }
  return { decision: 'RETURN_TO_ORIGINAL_TARGET', originalTargetSubject: input.originalTargetSubject, originalTargetSkill: input.originalTargetSkill, currentSubject: input.originalTargetSubject, currentSkill: input.originalTargetSkill, reasonCode: 'RETURN_TO_ORIGINAL_TARGET' };
}
