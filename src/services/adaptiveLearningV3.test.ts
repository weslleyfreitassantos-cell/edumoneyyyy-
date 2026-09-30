import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  KNOWLEDGE_ATTRIBUTION_POLICY_V1,
  V3_COGNITIVE_PROCESSES,
  V3_PURPOSES,
  V3_RELATION_ROLES,
  V3_SUBJECT_CONTRACTS,
  attributeV3Evidence,
  deriveMisconceptionState,
  generateV3Questions,
  planAdaptiveKnowledgeGraphV3,
  validateAdaptiveV3Questions,
} from './adaptiveLearningV3';

describe('adaptive learning V3 knowledge graph contract', () => {
  it('keeps the authored registry aligned with the executable subject contract', () => {
    const registry = JSON.parse(readFileSync(resolve(process.cwd(), 'content/adaptive/tec-escola-core-v3/registry.json'), 'utf8')) as {
      subjects: Array<{ code: string; targetSkill: string; skills: Array<{ code: string }> }>;
    };
    expect(registry.subjects.map((subject) => subject.code)).toEqual(V3_SUBJECT_CONTRACTS.map((subject) => subject.code));
    expect(registry.subjects.every((subject) => subject.skills.length >= 3 && subject.skills.some((skill) => skill.code === subject.targetSkill))).toBe(true);
  });

  it('supports all canonical subjects with three skills and a real target vertical', () => {
    expect(V3_SUBJECT_CONTRACTS).toHaveLength(15);
    const questions = V3_SUBJECT_CONTRACTS.flatMap((subject) => generateV3Questions(subject, subject.skills[2]));
    const result = validateAdaptiveV3Questions(
      questions,
      new Set(V3_SUBJECT_CONTRACTS.map((subject) => subject.code)),
      new Set(V3_SUBJECT_CONTRACTS.flatMap((subject) => subject.skills)),
    );

    expect(result.valid).toBe(true);
    expect(questions).toHaveLength(180);
    for (const subject of V3_SUBJECT_CONTRACTS) {
      expect(subject.skills).toHaveLength(3);
      expect(questions.filter((question) => question.subject === subject.code)).toHaveLength(12);
      for (const purpose of V3_PURPOSES) {
        expect(questions.filter((question) => question.subject === subject.code && question.purpose === purpose).length).toBeGreaterThan(0);
      }
    }
  });

  it('rejects a question without exactly one primary knowledge mapping', () => {
    const subject = V3_SUBJECT_CONTRACTS[0];
    const [question] = generateV3Questions(subject, subject.skills[2]);
    const invalid = { ...question, primarySkill: '', supportingSkills: [subject.skills[0]] };
    const result = validateAdaptiveV3Questions([invalid], new Set([subject.code]), new Set(subject.skills));
    expect(result.valid).toBe(false);
    expect(result.missingPrimary).toBe(1);
  });

  it('does not penalize supporting skills for an unmapped wrong answer', () => {
    const attribution = attributeV3Evidence({
      primarySkill: 'PHYSICS_AVERAGE_SPEED',
      supportingSkills: ['MATH_DIVISION'],
      prerequisiteSkills: [],
      transferSkills: [],
      misconceptionsByOption: {},
    }, false, 'wrong option');
    expect(attribution.map((item) => item.skillCode)).toEqual(['PHYSICS_AVERAGE_SPEED']);
  });

  it('allows explicit low-weight positive evidence for supporting skills', () => {
    const attribution = attributeV3Evidence({
      primarySkill: 'PHYSICS_AVERAGE_SPEED',
      supportingSkills: ['MATH_DIVISION'],
      prerequisiteSkills: [],
      transferSkills: [],
      misconceptionsByOption: {},
    }, true, 'correct option');
    expect(attribution.find((item) => item.skillCode === 'MATH_DIVISION')).toMatchObject({
      role: 'SUPPORTING',
      confidence: KNOWLEDGE_ATTRIBUTION_POLICY_V1.supportingCorrectConfidence,
      negative: false,
    });
  });

  it('requires repeated and diverse evidence before confirming a misconception', () => {
    expect(deriveMisconceptionState([{ correct: false, contextFamily: 'DISCOUNT', misconceptionCode: 'DISCOUNT_AS_FINAL_PRICE' }])).toBe('SIGNAL');
    expect(deriveMisconceptionState([
      { correct: false, contextFamily: 'DISCOUNT', misconceptionCode: 'DISCOUNT_AS_FINAL_PRICE' },
      { correct: false, contextFamily: 'INCREASE', misconceptionCode: 'DISCOUNT_AS_FINAL_PRICE' },
    ])).toBe('SUSPECTED');
    expect(deriveMisconceptionState([
      { correct: false, contextFamily: 'DISCOUNT', misconceptionCode: 'DISCOUNT_AS_FINAL_PRICE' },
      { correct: false, contextFamily: 'INCREASE', misconceptionCode: 'DISCOUNT_AS_FINAL_PRICE' },
      { correct: false, contextFamily: 'PROPORTION', misconceptionCode: 'DISCOUNT_AS_FINAL_PRICE' },
    ])).toBe('CONFIRMED');
    expect(deriveMisconceptionState([
      { correct: false, contextFamily: 'DISCOUNT', misconceptionCode: 'DISCOUNT_AS_FINAL_PRICE' },
      { correct: false, contextFamily: 'INCREASE', misconceptionCode: 'DISCOUNT_AS_FINAL_PRICE' },
      { correct: false, contextFamily: 'PROPORTION', misconceptionCode: 'DISCOUNT_AS_FINAL_PRICE' },
      { correct: true, contextFamily: 'TRANSFER' },
    ])).toBe('RECOVERING');
  });

  it('bridges a confirmed cross-subject blocker and preserves the original target', () => {
    const plan = planAdaptiveKnowledgeGraphV3({
      originalTargetSubject: 'PHYSICS',
      originalTargetSkill: 'PHYSICS_AVERAGE_SPEED',
      states: [
        { subjectCode: 'PHYSICS', skillCode: 'PHYSICS_AVERAGE_SPEED', state: 'PRACTICING', mastery: 62, confidence: 0.6 },
        { subjectCode: 'MATHEMATICS', skillCode: 'MATH_DIVISION', state: 'NEEDS_REVIEW', mastery: 38, confidence: 0.8 },
      ],
      relations: [{ fromSkill: 'PHYSICS_AVERAGE_SPEED', toSkill: 'MATH_DIVISION', relation: 'PREREQUISITE' }],
      misconceptions: [{ skillCode: 'MATH_DIVISION', state: 'CONFIRMED' }],
    });
    expect(plan).toMatchObject({
      decision: 'CROSS_SUBJECT_BRIDGE',
      originalTargetSubject: 'PHYSICS',
      originalTargetSkill: 'PHYSICS_AVERAGE_SPEED',
      currentSubject: 'MATHEMATICS',
      currentSkill: 'MATH_DIVISION',
      reasonCode: 'PREREQUISITE_CONFIRMED_GAP',
    });
  });

  it('keeps the V3 taxonomy explicit and stable', () => {
    expect(V3_RELATION_ROLES).toEqual(['PRIMARY', 'SUPPORTING', 'PREREQUISITE', 'TRANSFER']);
    expect(V3_COGNITIVE_PROCESSES).toContain('INFER');
    expect(KNOWLEDGE_ATTRIBUTION_POLICY_V1.singleErrorConfirmsGap).toBe(false);
  });
});
