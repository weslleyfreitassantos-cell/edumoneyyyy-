import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  CURRENT_DATABASE_ROLES,
  getEffectiveRole,
  hasEffectivePermission,
  hasPermission,
  PLATFORM_ROLES,
} from './permissions';

describe('school permissions', () => {
  it('mantem SCHOOL_ADMIN fora das roles reais', () => {
    expect(CURRENT_DATABASE_ROLES).toEqual([
      'ADMIN',
      'DIRECTOR',
      'SECRETARY',
      'TEACHER',
      'STUDENT',
      'GUARDIAN',
    ]);
    expect(CURRENT_DATABASE_ROLES).not.toContain(
      'SCHOOL_ADMIN',
    );
    expect(CURRENT_DATABASE_ROLES).not.toContain(
      'SUPER_ADMIN',
    );
  });

  it('declara SUPER_ADMIN como role de plataforma', () => {
    expect(PLATFORM_ROLES).toEqual([
      'USER',
      'SUPER_ADMIN',
    ]);
  });

  it('permite ADMIN criar instituicao e gerenciar usuarios', () => {
    expect(
      hasPermission(
        null,
        'ADMIN',
        'create_institution',
      ),
    ).toBe(true);
    expect(
      hasPermission(
        null,
        'ADMIN',
        'manage_school_users',
      ),
    ).toBe(true);
  });

  it('permite DIRECTOR administrar a instituicao', () => {
    expect(
      hasPermission(
        null,
        'DIRECTOR',
        'manage_academic_structure',
      ),
    ).toBe(true);
  });

  it('mantem SECRETARY alinhada à DIREÇÃO dentro da escola, mas nao criar instituicao', () => {
    expect(
      hasPermission(
        null,
        'SECRETARY',
        'manage_students',
      ),
    ).toBe(true);
    expect(hasPermission(null, 'SECRETARY', 'manage_academic_structure')).toBe(true);
    expect(hasPermission(null, 'SECRETARY', 'manage_assignments')).toBe(true);
    expect(hasPermission(null, 'SECRETARY', 'manage_finance')).toBe(true);
    expect(
      hasPermission(
        null,
        'SECRETARY',
        'create_institution',
      ),
    ).toBe(false);
  });

  it('mantem TEACHER, STUDENT e GUARDIAN restritos', () => {
    expect(
      hasPermission(
        null,
        'TEACHER',
        'manage_school_users',
      ),
    ).toBe(false);
    expect(
      hasPermission(
        null,
        'STUDENT',
        'view_own_student_data',
      ),
    ).toBe(true);
    expect(
      hasPermission(
        null,
        'GUARDIAN',
        'view_linked_students',
      ),
    ).toBe(true);
  });

  it('permite e-mail institucional somente a DIRECTOR e SECRETARY', () => {
    expect(hasPermission(null, 'DIRECTOR', 'send_school_email')).toBe(true);
    expect(hasPermission(null, 'SECRETARY', 'send_school_email')).toBe(true);
    expect(hasPermission(null, 'ADMIN', 'send_school_email')).toBe(false);
    expect(hasPermission(null, 'TEACHER', 'send_school_email')).toBe(false);
    expect(hasPermission(null, 'STUDENT', 'send_school_email')).toBe(false);
    expect(hasPermission(null, 'GUARDIAN', 'send_school_email')).toBe(false);
    expect(hasPermission('SUPER_ADMIN', null, 'send_school_email')).toBe(false);
  });
});

describe('effective role permissions', () => {
  it('resolve SUPER_ADMIN por platform_role', () => {
    expect(
      hasEffectivePermission({
        platformRole: 'SUPER_ADMIN',
        permission: 'manage_accounts',
      }),
    ).toBe(true);
  });

  it('resolve ADMIN por ownership de conta ativa', () => {
    expect(
      getEffectiveRole({
        isAccountOwner: true,
        accountStatus: 'ACTIVE',
        membershipRole: null,
        profileRole: null,
      }),
    ).toBe('ADMIN');
  });

  it('nao resolve ADMIN por ownership suspensa', () => {
    expect(
      getEffectiveRole({
        isAccountOwner: true,
        accountStatus: 'SUSPENDED',
        membershipRole: null,
        profileRole: null,
      }),
    ).toBeNull();
  });

  it('usa membershipRole institucional quando nao ha plataforma ou ownership', () => {
    expect(
      getEffectiveRole({
        membershipRole: 'DIRECTOR',
        profileRole: 'ADMIN',
      }),
    ).toBe('DIRECTOR');
  });

  it('aceita SECRETARY como membership real', () => {
    expect(
      hasEffectivePermission({
        membershipRole: 'SECRETARY',
        profileRole: null,
        permission: 'manage_students',
      }),
    ).toBe(true);
  });

  it('mantem profileRole apenas como fallback legado', () => {
    expect(
      hasEffectivePermission({
        membershipRole: null,
        profileRole: 'ADMIN',
        permission: 'manage_school_users',
      }),
    ).toBe(true);
  });
});
