import { describe, expect, it } from 'vitest';

import {
  suggestPeriods,
  suggestTeacherAvailabilityFromSchoolSlots,
} from './academicAutomationService';

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

describe('suggestTeacherAvailabilityFromSchoolSlots', () => {
  it('merges adjacent school slots and keeps recesses as separate windows', () => {
    const suggestions = suggestTeacherAvailabilityFromSchoolSlots([
      { day_of_week: 1, start_time: '07:00:00', end_time: '07:50:00', active: true },
      { day_of_week: 1, start_time: '07:50:00', end_time: '08:40:00', active: true },
      { day_of_week: 1, start_time: '09:50:00', end_time: '10:40:00', active: true },
      { day_of_week: 2, start_time: '13:00:00', end_time: '13:50:00', active: true },
      { day_of_week: 2, start_time: '14:00:00', end_time: '14:50:00', active: false },
    ]);

    expect(suggestions).toEqual([
      { day_of_week: 1, start_time: '07:00', end_time: '08:40' },
      { day_of_week: 1, start_time: '09:50', end_time: '10:40' },
      { day_of_week: 2, start_time: '13:00', end_time: '13:50' },
    ]);
  });
});
