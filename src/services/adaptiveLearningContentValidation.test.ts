import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { validateAdaptiveContentPack, validateAdaptiveQuestionContent } from './adaptiveLearningContentValidation';

function readPack(name: string) {
  return JSON.parse(readFileSync(resolve(process.cwd(), `content/adaptive/tec-escola-core-v2/${name}.json`), 'utf8'));
}

describe('adaptive learning content validator', () => {
  it('accepts complete, linked, attributed questions', () => {
    expect(validateAdaptiveQuestionContent([
      { statement: 'Qual e a tese?', options: ['A', 'B', 'C'], explanation: 'A tese e a ideia central.', canonicalSkillId: 'reading', provenance: 'TECESCOLA_CORE_V2' },
      { statement: 'Qual e a consequencia?', options: ['A', 'B'], explanation: 'O conectivo indica resultado.', canonicalSkillId: 'cohesion', provenance: 'TECESCOLA_CORE_V2' },
    ], new Set(['reading', 'cohesion']))).toMatchObject({ valid: true, duplicateStems: 0 });
  });

  it('rejects duplicate stems, bad options, missing explanations and links', () => {
    expect(validateAdaptiveQuestionContent([
      { statement: 'Repete', options: ['A', 'A'], explanation: null, canonicalSkillId: 'missing', provenance: null },
      { statement: 'Repete', options: ['A'], explanation: '', canonicalSkillId: 'missing', provenance: '' },
    ], new Set())).toMatchObject({ valid: false, duplicateStems: 1, invalidOptions: 2, missingExplanations: 2, invalidSkillLinks: 2, invalidProvenance: 2 });
  });

  it('validates the authored mathematics pack with every purpose covered', () => {
    const pack = readPack('mathematics');
    const result = validateAdaptiveContentPack(pack, new Set(pack.skills.map((skill: { code: string }) => skill.code)));

    expect(result.valid).toBe(true);
    expect(result.invalidAnswers).toBe(0);
    expect(result.emptySets).toBe(0);
    expect(result.identicalPurposeSets).toBe(0);
    expect(result.invalidPrerequisites).toBe(0);
    expect(pack.skills).toHaveLength(6);
    for (const skill of pack.skills) {
      expect(skill.questions).toHaveLength(12);
      expect(skill.questions.filter((question: { purpose: string }) => question.purpose === 'PROBE')).toHaveLength(3);
      expect(skill.questions.filter((question: { purpose: string }) => question.purpose === 'PRACTICE')).toHaveLength(4);
      expect(skill.questions.filter((question: { purpose: string }) => question.purpose === 'TRANSFER')).toHaveLength(2);
      expect(skill.questions.filter((question: { purpose: string }) => question.purpose === 'LOCK_IN')).toHaveLength(2);
      expect(skill.questions.filter((question: { purpose: string }) => question.purpose === 'REVIEW')).toHaveLength(1);
    }
    expect(pack.skills.find((skill: { code: string }) => skill.code === 'LINEAR_FUNCTION')?.prerequisites).toEqual(['EQUATIONS']);
  });

  it('validates the three-skill Portuguese pack without reusing one universal set', () => {
    const pack = readPack('portuguese');
    const result = validateAdaptiveContentPack(pack, new Set(pack.skills.map((skill: { code: string }) => skill.code)));

    expect(result.valid).toBe(true);
    expect(result.emptySets).toBe(0);
    expect(result.identicalPurposeSets).toBe(0);
    expect(pack.skills).toHaveLength(3);
    expect(pack.skills.every((skill: { questions: unknown[] }) => skill.questions.length >= 8)).toBe(true);
  });
});
