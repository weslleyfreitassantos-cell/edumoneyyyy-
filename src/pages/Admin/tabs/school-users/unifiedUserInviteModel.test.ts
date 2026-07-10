import {
  describe,
  expect,
  it,
} from 'vitest';

import { CURRENT_DATABASE_ROLES } from '../../../../lib/permissions';
import {
  getUnifiedUserInviteOption,
  isUnifiedInviteTargetCurrentlySupported,
  UNIFIED_USER_INVITE_OPTIONS,
} from './unifiedUserInviteModel';

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

  it('marca fluxos atuais como visuais e suportados', () => {
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

  it('diferencia planejados de fluxos visuais atuais', () => {
    expect(
      getUnifiedUserInviteOption('DIRECTOR')
        .availabilityStatuses,
    ).toContain('available_now_visual_only');
    expect(
      getUnifiedUserInviteOption(
        'SCHOOL_ADMIN_PLANNED',
      ).availabilityStatuses,
    ).toContain(
      'planned_requires_migration_reconciliation',
    );
  });
});
