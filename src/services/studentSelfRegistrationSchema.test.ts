import { describe, expect, it } from 'vitest';

import {
  normalizeStudentPhone,
  normalizeStudentRegistration,
  validateStudentRegistrationForConfirmation,
} from './studentSelfRegistrationSchema';

const completeStudent = {
  birthDate: '2010-03-12',
  cpf: '529.982.247-25',
  socialName: '  Ana   Souza ',
  rg: ' 12\u00007 ',
  rgIssuingAuthority: ' SSP ',
  rgState: 'ba',
  birthCertificate: '',
  nationality: ' Brasileira ',
  birthplace: ' Salvador ',
  birthState: 'ba',
  sex: 'F',
  address: {
    postalCode: '40140-110',
    street: ' Rua   A ',
    number: '10',
    complement: '',
    neighborhood: 'Centro',
    city: 'Salvador',
    state: 'ba',
    ruralZone: false,
  },
  previousSchooling: {
    originSchool: '',
    originNetwork: '',
    city: '',
    state: '',
    lastGrade: '',
    originYear: '2025',
    status: '',
    observations: '',
    historyDelivered: false,
    transferDeclaration: false,
  },
  health: {
    allergies: '',
    healthConditions: '',
    emergencyMedication: '',
    disability: '',
    autism: false,
    giftedness: false,
    needsSpecialEducation: false,
  },
};

describe('studentSelfRegistrationSchema', () => {
  it('normaliza texto, documentos, telefone e UFs', () => {
    const normalized = normalizeStudentRegistration(completeStudent);

    expect(normalized.socialName).toBe('Ana Souza');
    expect(normalized.rg).toBe('127');
    expect(normalized.cpf).toBe('52998224725');
    expect(normalized.address.postalCode).toBe('40140110');
    expect(normalized.address.state).toBe('BA');
    expect(normalizeStudentPhone('(71) 99999-0000')).toBe('71999990000');
  });

  it('rejeita CPF inválido, data futura e ano de origem futuro', () => {
    expect(() => normalizeStudentRegistration({ ...completeStudent, cpf: '123.456.789-00' })).toThrow('CPF inválido');
    expect(() => normalizeStudentRegistration({ ...completeStudent, birthDate: '2999-01-01' })).toThrow('Data de nascimento inválida');
    expect(() => normalizeStudentRegistration({ ...completeStudent, previousSchooling: { ...completeStudent.previousSchooling, originYear: '2999' } })).toThrow('Ano de origem inválido');
  });

  it('exige os campos atuais obrigatórios antes da confirmação', () => {
    expect(() => validateStudentRegistrationForConfirmation(
      { ...completeStudent, address: { ...completeStudent.address, city: '' } },
      '71999990000',
    )).toThrow('Complete os dados cadastrais obrigatórios');
  });
});
