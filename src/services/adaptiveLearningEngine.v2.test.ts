import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  deriveAdaptiveMasteryStateV2,
  planGuidedLearningJourneyV2,
  V2_MASTERY_POLICY,
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
  it('keeps the TypeScript mastery policy aligned with the pre-release RPC', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260930001000_adaptive_learning_guided_journey_v2.sql'), 'utf8');

    expect(V2_MASTERY_POLICY).toMatchObject({
      minValidEvidence: 3,
      minDistinctRuns: 2,
      minWeightedMastery: 80,
      minConfidence: 0.6,
      strongSources: ['TRANSFER', 'LOCK_IN', 'REVIEW'],
    });
    expect(migration).toContain("evidence.source in ('TRANSFER', 'LOCK_IN', 'REVIEW')");
    expect(migration).toContain("case step_row.purpose when 'PROBE' then 'DIAGNOSTIC' else step_row.purpose end");
    expect(migration).toContain("source in ('PRACTICE', 'DIAGNOSTIC', 'TRANSFER', 'LOCK_IN', 'REVIEW', 'SIMULATION', 'EXAM')");
  });

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
