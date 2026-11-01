import { describe, expect, it } from 'vitest';

import {
  getFirstPlacementQuestion,
  getNextPlacementQuestion,
  getRecommendedUnitPosition,
  isPlacementRecord,
  PLACEMENT_QUESTION_LIMIT,
} from './tecIdiomasPlacement';

describe('diagnóstico inicial do Tec Idiomas', () => {
  it('valida somente resultados completos e dentro dos limites antes de sincronizar', () => {
    const valid = {
      version: 1,
      kind: 'ASSESSMENT',
      score: 4,
      questionCount: 5,
      highestDifficulty: 3,
      recommendedUnitPosition: 3,
      completedAt: '2026-10-29T12:00:00.000Z',
    };
    expect(isPlacementRecord(valid)).toBe(true);
    expect(isPlacementRecord({ ...valid, score: 6 })).toBe(false);
    expect(isPlacementRecord({ ...valid, recommendedUnitPosition: 5 })).toBe(false);
    expect(isPlacementRecord({ ...valid, kind: 'START_FROM_ZERO', score: 0, questionCount: 0, highestDifficulty: 1, recommendedUnitPosition: 1 })).toBe(true);
    expect(isPlacementRecord({ ...valid, completedAt: 'not-a-date' })).toBe(false);
    expect(isPlacementRecord(null)).toBe(false);
  });

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
