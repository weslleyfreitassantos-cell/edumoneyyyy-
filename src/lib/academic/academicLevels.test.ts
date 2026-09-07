import { describe, expect, it } from 'vitest';

import {
  getAcademicLevelLabel,
  normalizeAcademicLevel,
} from './academicLevels';

describe('academicLevels', () => {
  it('normaliza séries do ensino fundamental para o valor canônico', () => {
    expect(normalizeAcademicLevel('7º ano')).toBe('7');
    expect(normalizeAcademicLevel(' 7 ')).toBe('7');
  });

  it('normaliza diferentes formatos do ensino médio', () => {
    expect(normalizeAcademicLevel('1º EM')).toBe('1 EM');
    expect(normalizeAcademicLevel('1ª série do Ensino Médio')).toBe('1 EM');
    expect(normalizeAcademicLevel('3 serie medio')).toBe('3 EM');
  });

  it('recusa níveis ausentes ou fora da educação básica suportada', () => {
    expect(normalizeAcademicLevel('')).toBeNull();
    expect(normalizeAcademicLevel('10º ano')).toBeNull();
    expect(normalizeAcademicLevel('Pré-escola')).toBeNull();
  });

  it('apresenta o rótulo padronizado sem apagar valores legados', () => {
    expect(getAcademicLevelLabel('7º')).toBe('7º ano');
    expect(getAcademicLevelLabel('1º EM')).toBe('1ª série do Ensino Médio');
    expect(getAcademicLevelLabel('Nível antigo')).toBe('Nível antigo');
  });
});
