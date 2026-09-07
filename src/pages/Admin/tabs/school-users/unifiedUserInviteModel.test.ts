import {
  describe,
  expect,
  it,
} from 'vitest';

import { CURRENT_DATABASE_ROLES } from '../../../../lib/permissions';
import {
  buildUnifiedUserInvitePayload,
  getAllowedInviteTargets,
  getUnifiedUserInviteOption,
  isUnifiedInviteTargetCurrentlySupported,
  UNIFIED_USER_INVITE_OPTIONS,
} from './unifiedUserInviteModel';

const institutionId =
  '22222222-2222-4222-8222-222222222222';

describe('unified user invite model', () => {
  it('mantem apenas roles reais no cadastro unificado', () => {
    expect(
      UNIFIED_USER_INVITE_OPTIONS.map(
        (option) => option.label,
      ),
    ).toEqual([
      'Aluno',
      'Professor',
      'Responsavel',
      'Diretor',
    ]);

    expect(CURRENT_DATABASE_ROLES).toContain(
      'SECRETARY',
    );
    expect(CURRENT_DATABASE_ROLES).not.toContain(
      'SCHOOL_ADMIN',
    );
    expect(CURRENT_DATABASE_ROLES).not.toContain(
      'SUPER_ADMIN',
    );
  });

  it('marca todos os fluxos exibidos como suportados', () => {
    expect(
      UNIFIED_USER_INVITE_OPTIONS.every((option) =>
        isUnifiedInviteTargetCurrentlySupported(
          option.target,
        ),
      ),
    ).toBe(true);
  });

  it('resolve alvos permitidos por papel efetivo', () => {
    expect(getAllowedInviteTargets('ADMIN')).toEqual([
      'DIRECTOR',
      'TEACHER',
      'STUDENT',
      'GUARDIAN',
    ]);
    expect(getAllowedInviteTargets('DIRECTOR')).toEqual([
      'TEACHER',
      'STUDENT',
      'GUARDIAN',
    ]);
    expect(getAllowedInviteTargets('SECRETARY')).toEqual([
      'TEACHER',
      'STUDENT',
      'GUARDIAN',
    ]);
  });

  it('retorna a descricao correta da opcao de responsavel', () => {
    expect(
      getUnifiedUserInviteOption('GUARDIAN')
        .description,
    ).toContain('guardianships');
  });

  it('monta payload normalizado para professor', () => {
    const result =
      buildUnifiedUserInvitePayload({
        institutionId,
        target: 'TEACHER',
        fullName: '  Patricia   Professora  ',
        email: '  PROFESSORA@ESCOLA.COM  ',
        currentRole: 'DIRECTOR',
      });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.payload).toEqual({
        institutionId,
        role: 'TEACHER',
        fullName: 'Patricia Professora',
        email: 'professora@escola.com',
      });
    }
  });

  it('monta payload de aluno com campos especificos', () => {
    const result =
      buildUnifiedUserInvitePayload({
        institutionId,
        target: 'STUDENT',
        fullName: 'Aluno Teste',
        email: 'aluno@escola.com',
        birthDate: '2011-03-12',
        cpf: '12345678901',
        currentRole: 'SECRETARY',
      });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.payload.student).toEqual({
        birthDate: '2011-03-12',
        cpf: '12345678901',
      });
    }
  });

  it('monta payload de responsavel com aluno vinculado', () => {
    const result =
      buildUnifiedUserInvitePayload({
        institutionId,
        target: 'GUARDIAN',
        fullName: 'Responsavel Teste',
        email: 'resp@escola.com',
        guardianStudentId:
          '44444444-4444-4444-8444-444444444444',
        relationship: 'Mae',
        currentRole: 'SECRETARY',
      });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.payload.guardian).toEqual({
        studentId:
          '44444444-4444-4444-8444-444444444444',
        relationship: 'Mae',
      });
    }
  });

  it('bloqueia diretor convidando diretor', () => {
    const result =
      buildUnifiedUserInvitePayload({
        institutionId,
        target: 'DIRECTOR',
        fullName: 'Diretora Nova',
        email: 'diretora@escola.com',
        currentRole: 'DIRECTOR',
      });

    expect(result.success).toBe(false);

    if ('fieldErrors' in result) {
      expect(result.fieldErrors.target).toContain(
        'nao permite',
      );
    }
  });

  it('permite secretaria convidar professor', () => {
    const result =
      buildUnifiedUserInvitePayload({
        institutionId,
        target: 'TEACHER',
        fullName: 'Professor Teste',
        email: 'professor@escola.com',
        currentRole: 'SECRETARY',
      });

    expect(result.success).toBe(true);
  });
});
