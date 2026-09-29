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
  return Boolean(
    state &&
      state.evidenceCount >= 2 &&
      (state.state === 'MASTERED' || state.masteryEstimate >= 80),
  );
}

function isConfirmedGap(state: StudentSkillState | undefined): boolean {
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
