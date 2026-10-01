import type { AdaptiveSkillState, StudentSkillState } from './adaptiveLearningEngine';

export const V4_SKILL_KINDS = ['ANCHOR', 'LEAF'] as const;
export type V4SkillKind = (typeof V4_SKILL_KINDS)[number];

export const V4_CONTENT_READINESS = ['GRAPH_ONLY', 'CONTENT_READY', 'ADAPTIVE_READY'] as const;
export type V4ContentReadiness = (typeof V4_CONTENT_READINESS)[number];

export interface V4SkillNode {
  id: string;
  code: string;
  title: string;
  kind: V4SkillKind;
  contentReadiness: V4ContentReadiness;
  masteryTargetable: boolean;
  parentId?: string | null;
  subjectCode?: string | null;
  domain?: string | null;
}

export interface V4HierarchyEdge {
  parentId: string;
  childId: string;
}

export interface V4PrerequisiteEdge {
  skillId: string;
  prerequisiteSkillId: string;
}

export interface V4GraphValidationResult {
  valid: boolean;
  duplicateCodes: string[];
  unknownParents: string[];
  orphanLeaves: string[];
  hierarchyCycles: boolean;
  prerequisiteCycles: boolean;
  selfPrerequisites: string[];
}

export interface V4AnchorSummary {
  anchorId: string;
  childrenTotal: number;
  childrenMastered: number;
  childrenPracticing: number;
  childrenNeedsReview: number;
  childrenUnknown: number;
  coverage: number;
  state: 'MASTERED' | 'PRACTICING' | 'NEEDS_REVIEW' | 'UNKNOWN';
}

export interface V4ContentContract {
  code: string;
  readiness: V4ContentReadiness;
  lesson: boolean;
  purposes: Readonly<Record<'PROBE' | 'PRACTICE' | 'TRANSFER' | 'LOCK_IN' | 'REVIEW', number>>;
  contextFamilies: readonly string[];
}

function hasCycle(nodes: readonly string[], edges: readonly { from: string; to: string }[]): boolean {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (node: string): boolean => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of adjacency.get(node) ?? []) {
      if (visit(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };
  return nodes.some(visit);
}

export function validateV4Graph(
  skills: readonly V4SkillNode[],
  hierarchy: readonly V4HierarchyEdge[],
  prerequisites: readonly V4PrerequisiteEdge[],
): V4GraphValidationResult {
  const ids = new Set(skills.map((skill) => skill.id));
  const codeCounts = new Map<string, number>();
  for (const skill of skills) codeCounts.set(skill.code, (codeCounts.get(skill.code) ?? 0) + 1);
  const duplicateCodes = [...codeCounts.entries()].filter(([, count]) => count > 1).map(([code]) => code).sort();
  const parentByChild = new Map(hierarchy.map((edge) => [edge.childId, edge.parentId]));
  const unknownParents = hierarchy
    .filter((edge) => !ids.has(edge.parentId) || !ids.has(edge.childId))
    .map((edge) => `${edge.parentId}->${edge.childId}`)
    .sort();
  const orphanLeaves = skills
    .filter((skill) => skill.kind === 'LEAF' && !parentByChild.has(skill.id) && !skill.parentId)
    .map((skill) => skill.code)
    .sort();
  const hierarchyCycles = hasCycle(
    [...ids],
    hierarchy.filter((edge) => ids.has(edge.parentId) && ids.has(edge.childId)).map((edge) => ({ from: edge.parentId, to: edge.childId })),
  );
  const selfPrerequisites = prerequisites.filter((edge) => edge.skillId === edge.prerequisiteSkillId).map((edge) => edge.skillId).sort();
  const prerequisiteCycles = hasCycle(
    [...ids],
    prerequisites.filter((edge) => ids.has(edge.skillId) && ids.has(edge.prerequisiteSkillId)).map((edge) => ({ from: edge.skillId, to: edge.prerequisiteSkillId })),
  );
  return {
    valid: duplicateCodes.length === 0 && unknownParents.length === 0 && orphanLeaves.length === 0
      && !hierarchyCycles && !prerequisiteCycles && selfPrerequisites.length === 0,
    duplicateCodes,
    unknownParents,
    orphanLeaves,
    hierarchyCycles,
    prerequisiteCycles,
    selfPrerequisites,
  };
}

export function selectAdaptiveReadyLeaves(skills: readonly V4SkillNode[]): V4SkillNode[] {
  return skills
    .filter((skill) => skill.kind === 'LEAF' && skill.masteryTargetable && skill.contentReadiness === 'ADAPTIVE_READY')
    .sort((left, right) => left.code.localeCompare(right.code));
}

export function aggregateV4Anchor(
  anchorId: string,
  children: readonly V4SkillNode[],
  states: readonly StudentSkillState[],
): V4AnchorSummary {
  const stateById = new Map(states.map((state) => [state.canonicalSkillId, state]));
  const counts = { MASTERED: 0, PRACTICING: 0, NEEDS_REVIEW: 0, UNKNOWN: 0 };
  for (const child of children) {
    const state = stateById.get(child.id)?.state ?? 'UNKNOWN';
    if (state === 'MASTERED') counts.MASTERED += 1;
    else if (state === 'NEEDS_REVIEW') counts.NEEDS_REVIEW += 1;
    else if (state === 'PRACTICING' || state === 'LEARNING' || state === 'INTRODUCED') counts.PRACTICING += 1;
    else counts.UNKNOWN += 1;
  }
  const coverage = children.length ? Math.round(((children.length - counts.UNKNOWN) / children.length) * 100) : 0;
  const state: V4AnchorSummary['state'] = counts.NEEDS_REVIEW > 0
    ? 'NEEDS_REVIEW'
    : counts.PRACTICING > 0
      ? 'PRACTICING'
      : children.length > 0 && counts.MASTERED === children.length
        ? 'MASTERED'
        : 'UNKNOWN';
  return {
    anchorId,
    childrenTotal: children.length,
    childrenMastered: counts.MASTERED,
    childrenPracticing: counts.PRACTICING,
    childrenNeedsReview: counts.NEEDS_REVIEW,
    childrenUnknown: counts.UNKNOWN,
    coverage,
    state,
  };
}

export function isV4PlannerEligible(skill: Pick<V4SkillNode, 'kind' | 'contentReadiness' | 'masteryTargetable'>): boolean {
  return skill.kind === 'LEAF' && skill.masteryTargetable && skill.contentReadiness === 'ADAPTIVE_READY';
}

export function readinessLabel(readiness: V4ContentReadiness): string {
  if (readiness === 'ADAPTIVE_READY') return 'Pronto para jornada';
  if (readiness === 'CONTENT_READY') return 'Conteúdo disponível';
  return 'Conteúdo adaptativo ainda não disponível';
}

export function normalizeV4State(state: AdaptiveSkillState | null | undefined): V4AnchorSummary['state'] {
  if (state === 'MASTERED') return 'MASTERED';
  if (state === 'NEEDS_REVIEW') return 'NEEDS_REVIEW';
  if (state === 'PRACTICING' || state === 'LEARNING' || state === 'INTRODUCED') return 'PRACTICING';
  return 'UNKNOWN';
}
