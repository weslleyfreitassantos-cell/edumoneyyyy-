import { describe, expect, it } from 'vitest';

import { validateAdaptiveQuestionContent } from './adaptiveLearningContentValidation';

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
});
