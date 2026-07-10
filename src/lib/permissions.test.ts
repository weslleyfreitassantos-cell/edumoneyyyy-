import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  CURRENT_DATABASE_ROLES,
  FUTURE_PLATFORM_ROLES,
  FUTURE_ROLE_PLAN,
  FUTURE_SCHOOL_ROLES,
  getEffectiveRole,
  hasEffectivePermission,
  hasPermission,
} from './permissions';

describe('school permissions', () => {
  it('permite ADMIN gerenciar usuarios da escola', () => {
    expect(
      hasPermission(
        'ADMIN',
        'manage_school_users',
      ),
    ).toBe(true);
  });

  it('permite DIRECTOR por compatibilidade atual', () => {
    expect(
      hasPermission(
        'DIRECTOR',
        'manage_school_users',
      ),
    ).toBe(true);
  });

  it('nao permite TEACHER gerenciar usuarios da escola', () => {
    expect(
      hasPermission(
        'TEACHER',
        'manage_school_users',
      ),
    ).toBe(false);
  });

  it('nao permite STUDENT gerenciar usuarios da escola', () => {
    expect(
      hasPermission(
        'STUDENT',
        'manage_school_users',
      ),
    ).toBe(false);
  });

  it('nao permite GUARDIAN gerenciar usuarios da escola', () => {
    expect(
      hasPermission(
        'GUARDIAN',
        'manage_school_users',
      ),
    ).toBe(false);
  });

  it('documenta roles futuras sem ativa-las como roles atuais do banco', () => {
    expect(FUTURE_PLATFORM_ROLES).toContain(
      'SUPER_ADMIN',
    );
    expect(FUTURE_SCHOOL_ROLES).toEqual([
      'SCHOOL_ADMIN',
      'SECRETARY',
    ]);
    expect(FUTURE_ROLE_PLAN.SECRETARY.scope).toBe(
      'school',
    );

    expect(CURRENT_DATABASE_ROLES).not.toContain(
      'SUPER_ADMIN',
    );
    expect(CURRENT_DATABASE_ROLES).not.toContain(
      'SCHOOL_ADMIN',
    );
    expect(CURRENT_DATABASE_ROLES).not.toContain(
      'SECRETARY',
    );
  });
});

describe('effective school role permissions', () => {
  it('usa membershipRole quando ela existe', () => {
    expect(
      getEffectiveRole({
        membershipRole: 'DIRECTOR',
        profileRole: 'ADMIN',
      }),
    ).toBe('DIRECTOR');
  });

  it('usa profileRole como fallback quando membershipRole nao existe', () => {
    expect(
      getEffectiveRole({
        membershipRole: null,
        profileRole: 'ADMIN',
      }),
    ).toBe('ADMIN');
  });

  it('retorna null quando nao existe membershipRole nem profileRole', () => {
    expect(
      getEffectiveRole({
        membershipRole: null,
        profileRole: null,
      }),
    ).toBeNull();
  });

  it('ignora roles que ainda nao existem no banco', () => {
    expect(
      getEffectiveRole({
        membershipRole: 'SECRETARY',
        profileRole: null,
      }),
    ).toBeNull();
  });

  it('prioriza membershipRole ao verificar permissao efetiva', () => {
    expect(
      hasEffectivePermission({
        membershipRole: 'TEACHER',
        profileRole: 'ADMIN',
        permission: 'manage_school_users',
      }),
    ).toBe(false);
  });

  it('permite ADMIN via membership gerenciar usuarios da escola', () => {
    expect(
      hasEffectivePermission({
        membershipRole: 'ADMIN',
        profileRole: null,
        permission: 'manage_school_users',
      }),
    ).toBe(true);
  });

  it('mantem compatibilidade de DIRECTOR via membership', () => {
    expect(
      hasEffectivePermission({
        membershipRole: 'DIRECTOR',
        profileRole: null,
        permission: 'manage_school_users',
      }),
    ).toBe(true);
  });

  it('nao permite TEACHER via membership gerenciar usuarios da escola', () => {
    expect(
      hasEffectivePermission({
        membershipRole: 'TEACHER',
        profileRole: null,
        permission: 'manage_school_users',
      }),
    ).toBe(false);
  });

  it('mantem fallback com profileRole quando membershipRole nao existe', () => {
    expect(
      hasEffectivePermission({
        membershipRole: null,
        profileRole: 'ADMIN',
        permission: 'manage_school_users',
      }),
    ).toBe(true);
  });
});
