import { describe, expect, it } from 'vitest';

import { adaptElispeakRows } from './import-elispeak-candidates.mjs';

const row = (overrides = {}) => ({
  id: 'cem-001',
  category: 'preposition',
  cefr: 'A2',
  learner_sentence: 'I am interested on improving my speaking.',
  corrected_sentence: 'I am interested in improving my speaking.',
  explanation: 'Use interested in before a noun or gerund.',
  ...overrides,
});

describe('Elispeak candidate adapter', () => {
  it('creates private correction exercises with stable provenance and no answer in the prompt', () => {
    const [exercise] = adaptElispeakRows([row()]);

    expect(exercise).toMatchObject({
      id: 'elispeak-cem-001',
      course_code: 'TEC_ENGLISH_FOUNDATIONS_V5_CANDIDATES',
      language_code: 'en-US',
      level: 2,
      exercise_type: 'TRANSLATION',
      source_id: 'cem-001',
      license: 'MIT',
    });
    expect(exercise.prompt).toContain('I am interested on improving my speaking.');
    expect(exercise.prompt).not.toContain('I am interested in improving my speaking.');
    expect(exercise.answer_key.accepted).toEqual(['I am interested in improving my speaking.']);
    expect(exercise.attribution).toContain('elispeak-MIT.txt');
  });

  it('rejects an unknown level or a malformed row instead of guessing', () => {
    expect(() => adaptElispeakRows([row({ cefr: 'C2' })])).toThrow(/unsupported CEFR level/);
    expect(() => adaptElispeakRows([row({ corrected_sentence: '' })])).toThrow(/sentence, correction/);
  });
});
