import { describe, expect, it } from 'vitest';

import { seededExerciseOrder } from './tecEnglishExerciseOrder';

describe('seededExerciseOrder', () => {
  it('is a Fisher–Yates permutation that can be reconstructed for an attempt', () => {
    const first = seededExerciseOrder(8, 'session-1:exercise-1');
    expect(first).toEqual(seededExerciseOrder(8, 'session-1:exercise-1'));
    expect(first).not.toEqual(seededExerciseOrder(8, 'session-2:exercise-1'));
    expect([...first].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('returns an empty order for invalid lengths and handles single items', () => {
    expect(seededExerciseOrder(-1, 'seed')).toEqual([]);
    expect(seededExerciseOrder(1, 'seed')).toEqual([0]);
  });
});
