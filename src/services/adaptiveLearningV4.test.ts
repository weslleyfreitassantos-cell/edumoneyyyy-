import { describe, expect, it } from 'vitest';

import {
  aggregateV4Anchor,
  isV4PlannerEligible,
  selectAdaptiveReadyLeaves,
  validateV4Graph,
} from './adaptiveLearningV4';

const anchor = { id: 'anchor', code: 'PERCENTAGE', title: 'Porcentagem', kind: 'ANCHOR' as const, contentReadiness: 'GRAPH_ONLY' as const, masteryTargetable: false };
const leaves = [
  { id: 'base', code: 'IDENTIFY_PERCENT_BASE', title: 'Identificar a base percentual', kind: 'LEAF' as const, contentReadiness: 'ADAPTIVE_READY' as const, masteryTargetable: true },
  { id: 'quantity', code: 'PERCENT_OF_QUANTITY', title: 'Calcular percentual de uma quantidade', kind: 'LEAF' as const, contentReadiness: 'CONTENT_READY' as const, masteryTargetable: true },
];

describe('adaptive learning V4 contracts', () => {
  it('keeps hierarchy separate from prerequisite edges and detects cycles', () => {
    expect(validateV4Graph([anchor, ...leaves], [
      { parentId: anchor.id, childId: leaves[0].id },
      { parentId: anchor.id, childId: leaves[1].id },
    ], [{ skillId: leaves[1].id, prerequisiteSkillId: leaves[0].id }]).valid).toBe(true);
    expect(validateV4Graph([anchor, ...leaves], [
      { parentId: anchor.id, childId: leaves[0].id },
      { parentId: leaves[0].id, childId: anchor.id },
    ], []).hierarchyCycles).toBe(true);
  });

  it('rejects orphan leaves and prerequisite self edges', () => {
    const result = validateV4Graph([...leaves], [], [{ skillId: leaves[0].id, prerequisiteSkillId: leaves[0].id }]);
    expect(result.orphanLeaves).toEqual(['IDENTIFY_PERCENT_BASE', 'PERCENT_OF_QUANTITY']);
    expect(result.selfPrerequisites).toEqual(['base']);
    expect(result.valid).toBe(false);
  });

  it('selects only adaptive-ready leaves for the planner', () => {
    expect(selectAdaptiveReadyLeaves([anchor, ...leaves]).map((skill) => skill.code)).toEqual(['IDENTIFY_PERCENT_BASE']);
    expect(isV4PlannerEligible(leaves[0])).toBe(true);
    expect(isV4PlannerEligible(leaves[1])).toBe(false);
  });

  it('aggregates an anchor without claiming mastery from incomplete children', () => {
    const summary = aggregateV4Anchor(anchor.id, leaves, [
      { canonicalSkillId: 'base', state: 'MASTERED', masteryEstimate: 100, evidenceCount: 3, confidence: 1 },
    ]);
    expect(summary.childrenMastered).toBe(1);
    expect(summary.childrenUnknown).toBe(1);
    expect(summary.coverage).toBe(50);
    expect(summary.state).toBe('UNKNOWN');
  });
});
