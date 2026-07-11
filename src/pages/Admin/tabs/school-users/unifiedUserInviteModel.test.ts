import {
  describe,
  expect,
  it,
} from 'vitest';

import { CURRENT_DATABASE_ROLES } from '../../../../lib/permissions';
import {
  buildUnifiedUserInvitePayload,
  getUnifiedUserInviteOption,
  isUnifiedInviteTargetCurrentlySupported,
  UNIFIED_USER_INVITE_OPTIONS,
} from './unifiedUserInviteModel';

const institutionId =
  '22222222-2222-4222-8222-222222222222';

describe('unified user invite model', () => {
  it('mantem labels dos tipos de usuario', () => {
    expect(
      UNIFIED_USER_INVITE_OPTIONS.map(
        (option) => option.label,
      ),
    ).toEqual([
      'Aluno',
      'Professor',
      'Responsável',
      'Diretor',
      'Administração escolar',
      'Secretaria escolar',
    ]);
  });

  it('marca fluxos atuais como suportados', () => {
    const supportedTargets = [
      'STUDENT',
      'TEACHER',
      'GUARDIAN',
      'DIRECTOR',
    ] as const;

    expect(
      supportedTargets.map((target) =>
        isUnifiedInviteTargetCurrentlySupported(
          target,
        ),
      ),
    ).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });

  it('mantem administracao escolar e secretaria como planejados', () => {
    expect(
      isUnifiedInviteTargetCurrentlySupported(
        'SCHOOL_ADMIN_PLANNED',
      ),
    ).toBe(false);
    expect(
      isUnifiedInviteTargetCurrentlySupported(
        'SECRETARY_PLANNED',
      ),
    ).toBe(false);

    expect(
      getUnifiedUserInviteOption(
        'SECRETARY_PLANNED',
      ).isPlanned,
    ).toBe(true);
  });

  it('nao adiciona roles futuras nas roles atuais do banco', () => {
    expect(CURRENT_DATABASE_ROLES).not.toContain(
      'SCHOOL_ADMIN',
    );
    expect(CURRENT_DATABASE_ROLES).not.toContain(
      'SECRETARY',
    );
    expect(CURRENT_DATABASE_ROLES).not.toContain(
      'SUPER_ADMIN',
    );
  });

  it('retorna a descricao correta da opcao', () => {
    expect(
      getUnifiedUserInviteOption('GUARDIAN')
        .description,
    ).toContain('guardianships');
  });

  it('diferencia planejados de fluxos atuais', () => {
    expect(
      getUnifiedUserInviteOption('DIRECTOR')
        .availabilityStatuses,
    ).toContain('available_now');
    expect(
      getUnifiedUserInviteOption(
        'SCHOOL_ADMIN_PLANNED',
      ).availabilityStatuses,
    ).toContain(
      'planned_requires_migration_reconciliation',
    );
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
        currentRole: 'DIRECTOR',
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
        currentRole: 'DIRECTOR',
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

  it('nao monta payload para role planejada', () => {
    const result =
      buildUnifiedUserInvitePayload({
        institutionId,
        target: 'SECRETARY_PLANNED',
        fullName: 'Secretaria Teste',
        email: 'secretaria@escola.com',
        currentRole: 'ADMIN',
      });

    expect(result.success).toBe(false);

    if ('fieldErrors' in result) {
      expect(result.fieldErrors.target).toContain(
        'ainda nao pode',
      );
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
        'Somente ADMIN',
      );
    }
  });
});
