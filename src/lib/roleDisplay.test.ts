import { describe, expect, it } from 'vitest';

import { getRoleDisplayLabel } from './roleDisplay';

describe('getRoleDisplayLabel', () => {
  it.each([
    ['DIRECTOR', 'Direção'],
    ['director', 'Direção'],
    ['TEACHER', 'Docente'],
    ['teacher', 'Docente'],
    ['STUDENT', 'Estudante'],
    ['student', 'Estudante'],
    ['PARENT', 'Responsável'],
    ['GUARDIAN', 'Responsável'],
  ])('usa rótulo neutro para %s', (role, label) => {
    expect(getRoleDisplayLabel(role)).toBe(label);
  });

  it('preserva papéis desconhecidos e retorna vazio sem papel', () => {
    expect(getRoleDisplayLabel('CUSTOM_ROLE')).toBe('CUSTOM_ROLE');
    expect(getRoleDisplayLabel(null)).toBe('');
  });
});
