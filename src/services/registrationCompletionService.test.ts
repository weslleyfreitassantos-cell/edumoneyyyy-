import { describe, expect, it } from 'vitest';

import {
  buildGuardianPendingItems,
  buildStudentPendingItems,
} from './registrationCompletionService';

describe('registrationCompletionService', () => {
  it('identifica as pendências operacionais do aluno', () => {
    expect(buildStudentPendingItems({
      birthDate: null,
      hasActiveEnrollment: false,
      hasActiveGuardian: false,
    }).map((item) => item.id)).toEqual([
      'birth-date',
      'enrollment',
      'guardian',
    ]);
  });

  it('não cria pendências para aluno com cadastro operacional completo', () => {
    expect(buildStudentPendingItems({
      birthDate: '2010-01-01',
      hasActiveEnrollment: true,
      hasActiveGuardian: true,
    })).toEqual([]);
  });

  it('sinaliza telefone ausente do responsável', () => {
    expect(buildGuardianPendingItems({ phone: '   ' })).toHaveLength(1);
    expect(buildGuardianPendingItems({ phone: '(71) 99999-0000' })).toEqual([]);
  });
});
