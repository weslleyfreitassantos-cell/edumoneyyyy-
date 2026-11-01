import { describe, expect, it } from 'vitest';

import { tecLanguageLocale } from './tecLanguage';

describe('tecLanguageLocale', () => {
  it('recognizes Korean skill codes across course versions', () => {
    expect(tecLanguageLocale(undefined, 'ko_v2_greetings')).toBe('ko-KR');
    expect(tecLanguageLocale('TEC_KOREAN_FOUNDATIONS_V2_BEGINNER')).toBe('ko-KR');
  });

  it('does not classify English or Spanish course codes as Korean', () => {
    expect(tecLanguageLocale('TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER')).toBe('en-US');
    expect(tecLanguageLocale(undefined, 'es_v1_greetings')).toBe('es-ES');
  });
});
