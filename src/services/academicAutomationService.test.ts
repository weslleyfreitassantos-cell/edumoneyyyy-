import { describe, expect, it } from 'vitest';

import { suggestPeriods } from './academicAutomationService';

describe('suggestPeriods', () => {
  it('uses Portuguese ordinal indicators for four bimesters', () => {
    const periods = suggestPeriods(
      '2026-01-10',
      '2026-12-10',
      'BIMESTERS_4',
    );

    expect(periods.map((period) => period.name)).toEqual([
      '1º Bimestre',
      '2º Bimestre',
      '3º Bimestre',
      '4º Bimestre',
    ]);
  });

  it('keeps the same ordinal format for trimesters and semesters', () => {
    expect(
      suggestPeriods('2026-01-01', '2026-12-31', 'TRIMESTERS_3').map(
        (period) => period.name,
      ),
    ).toEqual(['1º Trimestre', '2º Trimestre', '3º Trimestre']);

    expect(
      suggestPeriods('2026-01-01', '2026-12-31', 'SEMESTERS_2').map(
        (period) => period.name,
      ),
    ).toEqual(['1º Semestre', '2º Semestre']);
  });
});
