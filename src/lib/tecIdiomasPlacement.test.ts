import { describe, expect, it } from 'vitest';

import {
  getFirstPlacementQuestion,
  getNextPlacementQuestion,
  getRecommendedUnitPosition,
  PLACEMENT_QUESTION_LIMIT,
} from './tecIdiomasPlacement';

describe('diagnóstico inicial do Tec Idiomas', () => {
  it('começa com uma questão simples em cada idioma e adapta o próximo nível', () => {
    for (const language of ['en-US', 'es-ES', 'ko-KR'] as const) {
      const first = getFirstPlacementQuestion(language);
      expect(first.difficulty).toBe(1);
      expect(first.options.length).toBeGreaterThanOrEqual(3);

      const nextAfterCorrect = getNextPlacementQuestion(language, [first.id], first.difficulty, true);
      const nextAfterIncorrect = getNextPlacementQuestion(language, [first.id], first.difficulty, false);
      expect(nextAfterCorrect?.difficulty).toBe(2);
      expect(nextAfterIncorrect?.difficulty).toBe(1);
      expect(nextAfterCorrect?.id).not.toBe(first.id);
      expect(nextAfterIncorrect?.id).not.toBe(first.id);
    }
  });

  it('limita a avaliação a cinco perguntas e recomenda unidade sem modificar a trilha', () => {
    const first = getFirstPlacementQuestion('en-US');
    expect(getNextPlacementQuestion(
      'en-US',
      [first.id, 'en-brother-school', 'en-thanks', 'en-nearest-station', 'en-if-it-rains'],
      3,
      true,
    )).toBeNull();
    expect(PLACEMENT_QUESTION_LIMIT).toBe(5);
    expect(getRecommendedUnitPosition(3, 5, 5, 4)).toBe(3);
    expect(getRecommendedUnitPosition(3, 2, 5, 4)).toBe(1);
    expect(getRecommendedUnitPosition(3, 4, 5, 2)).toBe(2);
    expect(getRecommendedUnitPosition(3, 1, 1, 4)).toBe(1);
  });
});
