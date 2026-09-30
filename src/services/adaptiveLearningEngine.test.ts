import { describe, expect, it } from 'vitest';

import {
  assertAcyclicSkillGraph,
  deriveStudentSkillState,
  hasSkillGraphCycle,
  planAdaptivePath,
  probeNextSkill,
  type CanonicalSkillNode,
  type SkillPrerequisiteEdge,
} from './adaptiveLearningEngine';

const skills: CanonicalSkillNode[] = [
  { id: 'fractions', code: 'FRACTIONS', title: 'Frações' },
  { id: 'ratio', code: 'RATIO', title: 'Razão' },
  { id: 'proportion', code: 'PROPORTION', title: 'Proporção' },
  { id: 'percentage', code: 'PERCENTAGE', title: 'Porcentagem' },
  { id: 'equations', code: 'EQUATIONS', title: 'Equações' },
  { id: 'linear-function', code: 'LINEAR_FUNCTION', title: 'Função afim' },
];

const edges: SkillPrerequisiteEdge[] = [
  { skillId: 'ratio', prerequisiteSkillId: 'fractions' },
  { skillId: 'proportion', prerequisiteSkillId: 'ratio' },
  { skillId: 'percentage', prerequisiteSkillId: 'proportion' },
  { skillId: 'equations', prerequisiteSkillId: 'percentage' },
  { skillId: 'linear-function', prerequisiteSkillId: 'equations' },
];

describe('adaptive learning engine', () => {
  it('denies self references and direct or indirect cycles', () => {
    expect(() => assertAcyclicSkillGraph(['a'], [{ skillId: 'a', prerequisiteSkillId: 'a' }])).toThrow('SELF_REFERENCE');
    expect(hasSkillGraphCycle(['a', 'b'], [
      { skillId: 'a', prerequisiteSkillId: 'b' },
      { skillId: 'b', prerequisiteSkillId: 'a' },
    ])).toBe(true);
    expect(hasSkillGraphCycle(['a', 'b', 'c'], [
      { skillId: 'a', prerequisiteSkillId: 'b' },
      { skillId: 'b', prerequisiteSkillId: 'c' },
      { skillId: 'c', prerequisiteSkillId: 'a' },
    ])).toBe(true);
    expect(() => assertAcyclicSkillGraph(['a', 'b'], [{ skillId: 'b', prerequisiteSkillId: 'a' }])).not.toThrow();
  });

  it('derives a cautious state and does not turn one error into a gap', () => {
    expect(deriveStudentSkillState('fractions', [0])).toMatchObject({
      state: 'INTRODUCED',
      evidenceCount: 1,
      confidence: 1 / 3,
    });
    expect(deriveStudentSkillState('fractions', [0, 20]).state).toBe('NEEDS_REVIEW');
  });

  it('builds the canonical fraction-to-linear-function bridge', () => {
    const plan = planAdaptivePath('linear-function', skills, edges, [
      { canonicalSkillId: 'fractions', state: 'NEEDS_REVIEW', masteryEstimate: 30, evidenceCount: 2, confidence: 2 / 3 },
    ]);
    expect(plan.decision).toBe('BRIDGE_REINFORCEMENT');
    expect(plan.diagnosticSkillId).toBe('fractions');
    expect(plan.steps.map((skill) => skill.id)).toEqual([
      'fractions', 'ratio', 'proportion', 'percentage', 'equations', 'linear-function',
    ]);
    expect(probeNextSkill('linear-function', skills, edges, [
      { canonicalSkillId: 'fractions', state: 'NEEDS_REVIEW', masteryEstimate: 30, evidenceCount: 2, confidence: 2 / 3 },
    ])).toMatchObject({ decision: 'BRIDGE_REINFORCEMENT', diagnosticSkillId: 'fractions' });
  });

  it('skips mastered prerequisites and reaches the target', () => {
    const plan = planAdaptivePath('linear-function', skills, edges, [
      ...['fractions', 'ratio', 'proportion', 'percentage', 'equations'].map((id) => ({
        canonicalSkillId: id,
        state: 'MASTERED' as const,
        masteryEstimate: 90,
        evidenceCount: 3,
        confidence: 1,
      })),
    ]);
    expect(plan.decision).toBe('DIAGNOSTIC_NEEDED');
    expect(plan.diagnosticSkillId).toBe('linear-function');
    expect(plan.steps.map((skill) => skill.id)).toEqual(['linear-function']);
  });

  it('reports on target when the target itself is mastered', () => {
    const plan = planAdaptivePath('linear-function', skills, edges, [{
      canonicalSkillId: 'linear-function',
      state: 'MASTERED',
      masteryEstimate: 95,
      evidenceCount: 3,
      confidence: 1,
    }]);
    expect(plan).toMatchObject({ decision: 'ON_TARGET', diagnosticSkillId: null, steps: [] });
  });
});
