import { describe, expect, it } from 'vitest';

import { calculateExpectedValue, validateCandidate } from './validate-central-estudos-v2.mjs';

describe('Central de Estudos V2 curriculum candidate', () => {
  it('validates the mapped grade-six lesson and leaves human review/publication pending', async () => {
    const report = await validateCandidate();
    expect(report.technicalValidation).toBe('PASS');
    expect(report.journeyCount).toBe(1);
    expect(report.officialCode).toBe('EF06MA13');
    expect(report.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.questionCount).toBe(10);
    expect(report.pedagogicalReview).toBe('PENDING_HUMAN_REVIEW');
    expect(report.publication).toBe('NOT_PUBLISHED');
    expect(report.issues).toEqual([]);
  });

  it('checks percentage and final-price calculations independently', () => {
    expect(calculateExpectedValue({ operation: 'PERCENT_OF', base: 46, percent: 50 })).toBe(23);
    expect(calculateExpectedValue({ operation: 'PRICE_AFTER_DISCOUNT', base: 150, percent: 20 })).toBe(120);
    expect(calculateExpectedValue({ operation: 'PRICE_AFTER_INCREASE', base: 80, percent: 10 })).toBe(88);
    expect(calculateExpectedValue({ operation: 'UNSUPPORTED', base: 80, percent: 10 })).toBeNull();
  });
});
