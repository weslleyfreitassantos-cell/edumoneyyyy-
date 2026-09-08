import { describe, expect, it } from 'vitest';

import {
  normalizeAcademicShift,
  normalizeAcademicShifts,
  toAcademicShift,
} from './academicShifts';

describe('academic shifts', () => {
  it('normalizes labels used by legacy records', () => {
    expect(normalizeAcademicShift('Manhã')).toBe('MATUTINO');
    expect(normalizeAcademicShift('Tarde')).toBe('VESPERTINO');
    expect(normalizeAcademicShift('Integral')).toBe('INTEGRAL');
    expect(normalizeAcademicShift('Noite')).toBe('NOTURNO');
  });

  it('removes duplicates and preserves the canonical order', () => {
    expect(normalizeAcademicShifts(['Noite', 'Matutino', 'Noite', 'Tarde'])).toEqual([
      'MATUTINO',
      'VESPERTINO',
      'NOTURNO',
    ]);
  });

  it('rejects unknown shift values', () => {
    expect(toAcademicShift('escala especial')).toBeNull();
  });
});
