import { describe, expect, it } from 'vitest';

import { calculateExpectedValue, validatePackage } from './validate-central-estudos-v2.mjs';

describe('Central de Estudos V2 curriculum candidate', () => {
  it('validates the three-subject grade-six package and leaves review/publication pending', async () => {
    const report = await validatePackage();
    expect(report.technicalValidation).toBe('PASS');
    expect(report.journeyCount).toBe(9);
    expect(report.lessonCount).toBe(9);
    expect(report.subjects).toEqual({ SCIENCE: 3, PORTUGUESE: 3, MATHEMATICS: 3 });
    expect(report.candidates.every((candidate) => candidate.contentSha256.match(/^[a-f0-9]{64}$/))).toBe(true);
    expect(report.questionCount).toBe(48);
    expect(report.candidates.every((candidate) => candidate.questionCount >= 5 && candidate.questionCount <= 8)).toBe(true);
    expect(report.pedagogicalReview).toBe('PENDING_HUMAN_REVIEW');
    expect(report.publication).toBe('NOT_PUBLISHED');
    expect(report.exerciseTypes).toEqual(['SINGLE_CHOICE']);
    expect(report.purposesCovered).toEqual(['LOCK_IN', 'PRACTICE', 'PROBE', 'REVIEW', 'TRANSFER']);
    expect(report.issues).toEqual([]);
  });

  it('checks percentage and final-price calculations independently', () => {
    expect(calculateExpectedValue({ operation: 'PERCENT_OF', base: 46, percent: 50 })).toBe(23);
    expect(calculateExpectedValue({ operation: 'PRICE_AFTER_DISCOUNT', base: 150, percent: 20 })).toBe(120);
    expect(calculateExpectedValue({ operation: 'PRICE_AFTER_INCREASE', base: 80, percent: 10 })).toBe(88);
    expect(calculateExpectedValue({ operation: 'UNSUPPORTED', base: 80, percent: 10 })).toBeNull();
  });
});
