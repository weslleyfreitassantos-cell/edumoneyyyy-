import { describe, expect, it } from 'vitest';

import {
  deriveAdaptiveMasteryStateV2,
  planGuidedLearningJourneyV2,
  type CanonicalSkillNode,
  type SkillPrerequisiteEdge,
  type StudentSkillState,
} from './adaptiveLearningEngine';

const skills: CanonicalSkillNode[] = [
  { id: 'base', code: 'BASE', title: 'Base' },
  { id: 'target', code: 'TARGET', title: 'Objetivo' },
];
const edges: SkillPrerequisiteEdge[] = [{ skillId: 'target', prerequisiteSkillId: 'base' }];
const state = (canonicalSkillId: string, overrides: Partial<StudentSkillState> = {}): StudentSkillState => ({
  canonicalSkillId,
  state: 'PRACTICING',
  masteryEstimate: 70,
  evidenceCount: 2,
  confidence: 2 / 3,
  ...overrides,
});

describe('adaptive learning engine v2', () => {
  it('starts with a probe when the prerequisite is unknown', () => {
    expect(planGuidedLearningJourneyV2('target', skills, edges, [])).toMatchObject({
      currentSkillId: 'base',
      stepType: 'PROBE',
      decisionReason: 'PREREQUISITE_UNKNOWN',
    });
  });

  it('moves from confirmed gap to a lesson and then practice', () => {
    const plan = planGuidedLearningJourneyV2('target', skills, edges, [state('base', { state: 'NEEDS_REVIEW', masteryEstimate: 30 })]);
    expect(plan).toMatchObject({ currentSkillId: 'base', stepType: 'LESSON', decisionReason: 'CONFIRMED_GAP' });
    expect(planGuidedLearningJourneyV2('target', skills, edges, [state('base')])).toMatchObject({ stepType: 'PRACTICE', decisionReason: 'PRACTICE_REQUIRED' });
  });

  it('requires a strong, multi-run evidence set before mastery', () => {
    expect(deriveAdaptiveMasteryStateV2([
      { score: 100, source: 'PRACTICE', runId: 'run-a' },
      { score: 90, source: 'PRACTICE', runId: 'run-b' },
      { score: 85, source: 'TRANSFER', runId: 'run-b' },
    ])).toMatchObject({ state: 'MASTERED', validEvidenceCount: 3, distinctRunCount: 2, masteryPolicyVersion: 'V2' });
    expect(deriveAdaptiveMasteryStateV2([
      { score: 100, source: 'PRACTICE', runId: 'run-a' },
      { score: 90, source: 'PRACTICE', runId: 'run-a' },
      { score: 85, source: 'PRACTICE', runId: 'run-a' },
    ]).state).not.toBe('MASTERED');
  });

  it('does not hide cycle or self-reference errors', () => {
    expect(() => planGuidedLearningJourneyV2('target', skills, [
      ...edges,
      { skillId: 'base', prerequisiteSkillId: 'target' },
    ], [])).toThrow('SKILL_GRAPH_CYCLE');
    expect(() => planGuidedLearningJourneyV2('target', skills, [
      ...edges,
      { skillId: 'base', prerequisiteSkillId: 'base' },
    ], [])).toThrow('SKILL_GRAPH_CYCLE');
  });

  it('returns a stable target-ready review path', () => {
    const mastered = [
      state('base', { state: 'MASTERED', masteryEstimate: 90, evidenceCount: 3 }),
      state('target', { state: 'MASTERED', masteryEstimate: 90, evidenceCount: 3 }),
    ];
    expect(planGuidedLearningJourneyV2('target', skills, edges, mastered)).toMatchObject({
      currentSkillId: 'target',
      stepType: 'REVIEW',
      decisionReason: 'TARGET_READY',
    });
  });
});
