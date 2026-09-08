import { describe, expect, it } from 'vitest';

import {
  buildGuardianPendingItems,
  buildStudentPendingItems,
  hasIncompleteStudentPersonalData,
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

  it('identifica dados pessoais ou endereço ainda não preenchidos', () => {
    expect(hasIncompleteStudentPersonalData({
      role: 'STUDENT',
      profile: { phone: '' },
      student: {
        cpf: '12345678900',
        sex: 'F',
        nationality: 'Brasileira',
        birthplace: 'Salvador',
        birth_state: 'BA',
        address: {
          postal_code: '',
          street: 'Rua A',
          number: '10',
          neighborhood: 'Centro',
          city: 'Salvador',
          state: 'BA',
        },
      },
    })).toBe(true);

    expect(buildStudentPendingItems({
      birthDate: '2010-01-01',
      hasActiveEnrollment: true,
      hasActiveGuardian: true,
      hasIncompletePersonalData: true,
    })).toEqual([
      {
        id: 'personal-data',
        label: 'Dados pessoais',
        description: 'Complete seus dados pessoais e de endereço no cadastro.',
      },
    ]);
  });

  it('sinaliza telefone ausente do responsável', () => {
    expect(buildGuardianPendingItems({ phone: '   ' })).toHaveLength(1);
    expect(buildGuardianPendingItems({ phone: '(71) 99999-0000' })).toEqual([]);
  });
});
