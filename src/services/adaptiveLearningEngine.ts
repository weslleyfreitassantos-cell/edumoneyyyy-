export type AdaptiveSkillState =
  | 'UNKNOWN'
  | 'INTRODUCED'
  | 'LEARNING'
  | 'PRACTICING'
  | 'MASTERED'
  | 'NEEDS_REVIEW';

export type AdaptivePlanDecision =
  | 'ON_TARGET'
  | 'DIAGNOSTIC_NEEDED'
  | 'BRIDGE_REINFORCEMENT';

export interface CanonicalSkillNode {
  id: string;
  code: string;
  title: string;
  description?: string | null;
}

export interface SkillPrerequisiteEdge {
  skillId: string;
  prerequisiteSkillId: string;
}

export interface StudentSkillState {
  canonicalSkillId: string;
  state: AdaptiveSkillState;
  masteryEstimate: number;
  evidenceCount: number;
  confidence: number;
  validEvidenceCount?: number;
  distinctRunCount?: number;
  weightedMastery?: number;
  strongEvidenceCount?: number;
  masteryPolicyVersion?: 'V1' | 'V2' | string;
}

export interface AdaptivePlan {
  decision: AdaptivePlanDecision;
  targetSkillId: string;
  diagnosticSkillId: string | null;
  steps: CanonicalSkillNode[];
}

export interface ProbeResult {
  decision: AdaptivePlanDecision;
  targetSkillId: string;
  diagnosticSkillId: string | null;
}

function prerequisiteMap(edges: readonly SkillPrerequisiteEdge[]) {
  const map = new Map<string, string[]>();
  for (const edge of edges) {
    const prerequisites = map.get(edge.skillId) ?? [];
    prerequisites.push(edge.prerequisiteSkillId);
    map.set(edge.skillId, prerequisites);
  }
  return map;
}

export function hasSkillGraphCycle(
  skillIds: readonly string[],
  edges: readonly SkillPrerequisiteEdge[],
): boolean {
  const knownIds = new Set(skillIds);
  const adjacency = prerequisiteMap(edges);
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (skillId: string): boolean => {
    if (visiting.has(skillId)) return true;
    if (visited.has(skillId)) return false;
    visiting.add(skillId);
    for (const prerequisiteId of adjacency.get(skillId) ?? []) {
      if (!knownIds.has(prerequisiteId) || visit(prerequisiteId)) return true;
    }
    visiting.delete(skillId);
    visited.add(skillId);
    return false;
  };

  return skillIds.some(visit);
}

export function assertAcyclicSkillGraph(
  skillIds: readonly string[],
  edges: readonly SkillPrerequisiteEdge[],
): void {
  if (edges.some((edge) => edge.skillId === edge.prerequisiteSkillId)) {
    throw new Error('SELF_REFERENCE');
  }
  if (hasSkillGraphCycle(skillIds, edges)) {
    throw new Error('SKILL_GRAPH_CYCLE');
  }
}

function orderedPathToTarget(
  targetSkillId: string,
  skillsById: Map<string, CanonicalSkillNode>,
  prerequisites: Map<string, string[]>,
): CanonicalSkillNode[] {
  const ordered: CanonicalSkillNode[] = [];
  const visited = new Set<string>();

  const visit = (skillId: string) => {
    if (visited.has(skillId)) return;
    visited.add(skillId);
    for (const prerequisiteId of prerequisites.get(skillId) ?? []) {
      visit(prerequisiteId);
    }
    const skill = skillsById.get(skillId);
    if (skill) ordered.push(skill);
  };

  visit(targetSkillId);
  return ordered;
}

function isMastered(state: StudentSkillState | undefined): boolean {
  if (state?.masteryPolicyVersion === 'V2') return state.state === 'MASTERED';
  return Boolean(
    state &&
      state.evidenceCount >= 2 &&
      (state.state === 'MASTERED' || state.masteryEstimate >= 80),
  );
}

function isConfirmedGap(state: StudentSkillState | undefined): boolean {
  if (state?.masteryPolicyVersion === 'V2') return state.state === 'NEEDS_REVIEW';
  return Boolean(
    state &&
      state.evidenceCount >= 2 &&
      (state.state === 'NEEDS_REVIEW' || state.masteryEstimate < 60),
  );
}

export function planAdaptivePath(
  targetSkillId: string,
  skills: readonly CanonicalSkillNode[],
  edges: readonly SkillPrerequisiteEdge[],
  states: readonly StudentSkillState[],
): AdaptivePlan {
  const skillsById = new Map(skills.map((skill) => [skill.id, skill]));
  const stateBySkill = new Map(
    states.map((state) => [state.canonicalSkillId, state]),
  );
  const path = orderedPathToTarget(
    targetSkillId,
    skillsById,
    prerequisiteMap(edges),
  );
  const targetState = stateBySkill.get(targetSkillId);

  if (isMastered(targetState)) {
    return {
      decision: 'ON_TARGET',
      targetSkillId,
      diagnosticSkillId: null,
      steps: [],
    };
  }

  const prerequisiteSteps = path.filter((skill) => skill.id !== targetSkillId);
  const firstConfirmedGap = prerequisiteSteps.find((skill) =>
    isConfirmedGap(stateBySkill.get(skill.id)),
  );
  const firstUndeterminedPrerequisite = prerequisiteSteps.find(
    (skill) => !isMastered(stateBySkill.get(skill.id)),
  );

  if (firstConfirmedGap) {
    return {
      decision: 'BRIDGE_REINFORCEMENT',
      targetSkillId,
      diagnosticSkillId: firstConfirmedGap.id,
      steps: path.filter((skill) => !isMastered(stateBySkill.get(skill.id))),
    };
  }

  if (firstUndeterminedPrerequisite) {
    return {
      decision: 'DIAGNOSTIC_NEEDED',
      targetSkillId,
      diagnosticSkillId: firstUndeterminedPrerequisite.id,
      steps: [firstUndeterminedPrerequisite],
    };
  }

  return {
    decision: 'DIAGNOSTIC_NEEDED',
    targetSkillId,
    diagnosticSkillId: targetSkillId,
    steps: [skillsById.get(targetSkillId)].filter(
      (skill): skill is CanonicalSkillNode => Boolean(skill),
    ),
  };
}

/**
 * Probe the first unresolved point without generating a recovery path yet.
 * Keeping this pure makes the diagnostic boundary independently testable.
 */
export function probeNextSkill(
  targetSkillId: string,
  skills: readonly CanonicalSkillNode[],
  edges: readonly SkillPrerequisiteEdge[],
  states: readonly StudentSkillState[],
): ProbeResult {
  const plan = planAdaptivePath(targetSkillId, skills, edges, states);
  return {
    decision: plan.decision,
    targetSkillId: plan.targetSkillId,
    diagnosticSkillId: plan.diagnosticSkillId,
  };
}

export function deriveStudentSkillState(
  canonicalSkillId: string,
  scores: readonly number[],
): StudentSkillState {
  const normalizedScores = scores.filter(
    (score) => Number.isFinite(score) && score >= 0 && score <= 100,
  );
  const evidenceCount = normalizedScores.length;
  const masteryEstimate = evidenceCount
    ? Math.round(
        (normalizedScores.reduce((sum, score) => sum + score, 0) /
          evidenceCount) *
          100,
      ) / 100
    : 0;
  const confidence = Math.min(1, evidenceCount / 3);
  let state: AdaptiveSkillState = 'UNKNOWN';

  if (evidenceCount === 1) {
    state = 'INTRODUCED';
  } else if (evidenceCount >= 3 && masteryEstimate >= 80) {
    state = 'MASTERED';
  } else if (evidenceCount >= 2 && masteryEstimate < 60) {
    state = 'NEEDS_REVIEW';
  } else if (evidenceCount >= 2) {
    state = 'PRACTICING';
  }

  return {
    canonicalSkillId,
    state,
    masteryEstimate,
    evidenceCount,
    confidence,
  };
}

/**
 * V2 deliberately keeps the pedagogical decision small and inspectable. It
 * describes the next operation only; the database appends the following step
 * after evidence is recorded instead of materializing a speculative journey.
 */
export type GuidedStepTypeV2 =
  | 'PROBE'
  | 'DIAGNOSTIC'
  | 'LESSON'
  | 'PRACTICE'
  | 'TRANSFER'
  | 'LOCK_IN'
  | 'REVIEW'
  | 'RETURN_TO_TARGET';

export type AdaptiveDecisionReasonV2 =
  | 'PREREQUISITE_UNKNOWN'
  | 'CONFIRMED_GAP'
  | 'PRACTICE_REQUIRED'
  | 'TRANSFER_REQUIRED'
  | 'TARGET_READY'
  | 'REVIEW_REQUIRED'
  | 'TEACHER_SUPPORT_REQUIRED';

export interface AdaptiveEvidenceSample {
  score: number;
  source: 'PROBE' | 'PRACTICE' | 'TRANSFER' | 'LOCK_IN' | 'REVIEW' | 'DIAGNOSTIC' | 'SIMULATION' | 'EXAM';
  runId?: string | null;
}

export interface AdaptiveMasteryPolicyState {
  state: AdaptiveSkillState;
  validEvidenceCount: number;
  distinctRunCount: number;
  weightedMastery: number;
  confidence: number;
  strongEvidenceCount: number;
  masteryPolicyVersion: 'V2';
}

export interface GuidedJourneyPlanV2 {
  originalTargetSkillId: string;
  currentSkillId: string;
  stepType: GuidedStepTypeV2;
  decisionReason: AdaptiveDecisionReasonV2;
  replanCount: number;
  nextSkills: string[];
}

const V2_STRONG_SOURCES = new Set<AdaptiveEvidenceSample['source']>([
  'TRANSFER',
  'LOCK_IN',
  'REVIEW',
]);

/** The single V2 mastery policy used by pure code and mirrored by the RPC. */
export function deriveAdaptiveMasteryStateV2(
  samples: readonly AdaptiveEvidenceSample[],
): AdaptiveMasteryPolicyState {
  const valid = samples.filter((sample) => Number.isFinite(sample.score) && sample.score >= 0 && sample.score <= 100);
  const runIds = new Set(valid.map((sample) => sample.runId).filter((id): id is string => Boolean(id)));
  const distinctRunCount = Math.max(runIds.size, valid.length ? 1 : 0);
  const strongEvidenceCount = valid.filter((sample) => V2_STRONG_SOURCES.has(sample.source)).length;
  const weightedSamples = valid.map((sample) => {
    const sourceWeight = sample.source === 'PROBE' || sample.source === 'DIAGNOSTIC'
      ? 0.8
      : sample.source === 'TRANSFER' || sample.source === 'LOCK_IN' || sample.source === 'REVIEW'
        ? 1.2
        : 1;
    return { score: sample.score, weight: sourceWeight };
  });
  const weightedMastery = weightedSamples.length
    ? Math.round((weightedSamples.reduce((sum, sample) => sum + sample.score * sample.weight, 0) / weightedSamples.reduce((sum, sample) => sum + sample.weight, 0)) * 100) / 100
    : 0;
  const confidence = Math.min(1, valid.length / 5);
  const mastered = valid.length >= 3
    && distinctRunCount >= 2
    && weightedMastery >= 80
    && confidence >= 0.6
    && strongEvidenceCount >= 1;
  const state: AdaptiveSkillState = mastered
    ? 'MASTERED'
    : valid.length >= 2 && weightedMastery < 60
      ? 'NEEDS_REVIEW'
      : valid.length === 0
        ? 'UNKNOWN'
        : valid.length === 1
          ? 'INTRODUCED'
          : 'PRACTICING';

  return {
    state,
    validEvidenceCount: valid.length,
    distinctRunCount,
    weightedMastery,
    confidence,
    strongEvidenceCount,
    masteryPolicyVersion: 'V2',
  };
}

function stableTopologicalPath(
  targetSkillId: string,
  skills: readonly CanonicalSkillNode[],
  edges: readonly SkillPrerequisiteEdge[],
): string[] {
  const known = new Set(skills.map((skill) => skill.id));
  const prerequisites = prerequisiteMap(edges);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: string[] = [];

  const visit = (skillId: string) => {
    if (visiting.has(skillId)) throw new Error('SKILL_GRAPH_CYCLE');
    if (visited.has(skillId)) return;
    if (!known.has(skillId)) return;
    visiting.add(skillId);
    for (const prerequisiteId of [...(prerequisites.get(skillId) ?? [])].sort()) visit(prerequisiteId);
    visiting.delete(skillId);
    visited.add(skillId);
    ordered.push(skillId);
  };

  visit(targetSkillId);
  return ordered;
}

function v2State(state: StudentSkillState | undefined): AdaptiveMasteryPolicyState {
  if (!state) {
    return deriveAdaptiveMasteryStateV2([]);
  }
  if (state.masteryPolicyVersion === 'V2') {
    return {
      state: state.state,
      validEvidenceCount: state.validEvidenceCount ?? state.evidenceCount,
      distinctRunCount: state.distinctRunCount ?? state.evidenceCount,
      weightedMastery: state.weightedMastery ?? state.masteryEstimate,
      confidence: state.confidence,
      strongEvidenceCount: state.strongEvidenceCount ?? 0,
      masteryPolicyVersion: 'V2',
    };
  }
  const samples = Array.from({ length: Math.max(0, state.evidenceCount) }, (_, index) => ({
    score: state.masteryEstimate,
    source: index === state.evidenceCount - 1 ? 'LOCK_IN' as const : 'PRACTICE' as const,
    runId: `legacy-${index < 2 ? index : Math.floor(index / 2)}`,
  }));
  return deriveAdaptiveMasteryStateV2(samples);
}

/**
 * Pick the next step in the guided journey. Only this step and the IDs of its
 * immediate candidates are returned; future content is resolved after new
 * evidence so a stale plan cannot outrun the learner.
 */
export function planGuidedLearningJourneyV2(
  targetSkillId: string,
  skills: readonly CanonicalSkillNode[],
  edges: readonly SkillPrerequisiteEdge[],
  states: readonly StudentSkillState[],
  replanCount = 0,
): GuidedJourneyPlanV2 {
  const path = stableTopologicalPath(targetSkillId, skills, edges);
  const byId = new Map(states.map((state) => [state.canonicalSkillId, state]));
  const firstUnmastered = path.find((skillId) => v2State(byId.get(skillId)).state !== 'MASTERED');
  if (!firstUnmastered) {
    return {
      originalTargetSkillId: targetSkillId,
      currentSkillId: targetSkillId,
      stepType: 'REVIEW',
      decisionReason: 'TARGET_READY',
      replanCount,
      nextSkills: [],
    };
  }

  const current = v2State(byId.get(firstUnmastered));
  const isTarget = firstUnmastered === targetSkillId;
  if (replanCount >= 2 && current.state === 'NEEDS_REVIEW') {
    return {
      originalTargetSkillId: targetSkillId,
      currentSkillId: firstUnmastered,
      stepType: 'REVIEW',
      decisionReason: 'TEACHER_SUPPORT_REQUIRED',
      replanCount,
      nextSkills: path.slice(path.indexOf(firstUnmastered) + 1, path.indexOf(firstUnmastered) + 2),
    };
  }
  if (current.state === 'UNKNOWN') {
    return {
      originalTargetSkillId: targetSkillId,
      currentSkillId: firstUnmastered,
      stepType: 'PROBE',
      decisionReason: 'PREREQUISITE_UNKNOWN',
      replanCount,
      nextSkills: path.slice(path.indexOf(firstUnmastered) + 1, path.indexOf(firstUnmastered) + 2),
    };
  }
  if (current.state === 'NEEDS_REVIEW') {
    return {
      originalTargetSkillId: targetSkillId,
      currentSkillId: firstUnmastered,
      stepType: 'LESSON',
      decisionReason: 'CONFIRMED_GAP',
      replanCount,
      nextSkills: path.slice(path.indexOf(firstUnmastered) + 1, path.indexOf(firstUnmastered) + 2),
    };
  }
  return {
    originalTargetSkillId: targetSkillId,
    currentSkillId: firstUnmastered,
    stepType: isTarget ? 'TRANSFER' : 'PRACTICE',
    decisionReason: isTarget ? 'TRANSFER_REQUIRED' : 'PRACTICE_REQUIRED',
    replanCount,
    nextSkills: path.slice(path.indexOf(firstUnmastered) + 1, path.indexOf(firstUnmastered) + 2),
  };
}
