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
