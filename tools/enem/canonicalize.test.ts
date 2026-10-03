import { describe, expect, it } from 'vitest';

import { canonicalizeEnemArtifacts } from './canonicalize';
import type { ParsedEnemQuestion } from './parse';

function question(overrides: Partial<ParsedEnemQuestion> = {}): ParsedEnemQuestion {
  return {
    questionNumber: 1,
    language: null,
    page: 2,
    area: 'MATEMATICA',
    statement: 'Qual é o resultado?',
    supportText: null,
    options: ['1', '2', '3', '4', '5'],
    officialAnswer: 'C',
    mediaStatus: 'NOT_DETECTED',
    qualityState: 'PARSED',
    reviewReasons: [],
    ...overrides,
  };
}

describe('ENEM canonicalization', () => {
  it('collapses equal booklet occurrences and keeps their provenance', () => {
    const result = canonicalizeEnemArtifacts([
      { year: 2025, day: 'D2', booklet: 'CD5', questions: [question()] },
      { year: 2025, day: 'D2', booklet: 'CD6', questions: [question()] },
    ]);
    expect(result.canonicalQuestions).toHaveLength(1);
    expect(result.canonicalQuestions[0].occurrences).toHaveLength(2);
    expect(result.duplicatesCollapsed).toBe(1);
    expect(result.crossBookletMismatches).toEqual([]);
  });

  it('quarantines same-position booklet mismatches instead of choosing an answer', () => {
    const result = canonicalizeEnemArtifacts([
      { year: 2025, day: 'D2', booklet: 'CD5', questions: [question()] },
      { year: 2025, day: 'D2', booklet: 'CD6', questions: [question({ options: ['10', '20', '30', '40', '50'], officialAnswer: 'A' })] },
    ]);
    expect(result.crossBookletMismatches).toHaveLength(1);
    expect(result.canonicalQuestions.every((item) => item.qualityState === 'REVIEW_REQUIRED')).toBe(true);
  });
});
