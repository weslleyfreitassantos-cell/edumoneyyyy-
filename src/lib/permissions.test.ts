import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  CURRENT_DATABASE_ROLES,
  getEffectiveRole,
  getManageableSchoolUserRoles,
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

  it('limita a gestão de usuários pela hierarquia administrativa', () => {
    expect(getManageableSchoolUserRoles('ADMIN')).toEqual(['DIRECTOR']);
    expect(getManageableSchoolUserRoles('DIRECTOR')).toEqual([
      'SECRETARY',
      'TEACHER',
      'STUDENT',
      'GUARDIAN',
    ]);
    expect(getManageableSchoolUserRoles('SECRETARY')).toEqual([
      'TEACHER',
      'STUDENT',
      'GUARDIAN',
    ]);
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

  it('mantem e-mail fora do ADMIN e avisos sob permissao propria', () => {
    expect(hasPermission(null, 'DIRECTOR', 'send_school_email')).toBe(true);
    expect(hasPermission(null, 'SECRETARY', 'send_school_email')).toBe(true);
    expect(hasPermission(null, 'ADMIN', 'send_school_email')).toBe(false);
    expect(hasPermission(null, 'DIRECTOR', 'manage_school_communications')).toBe(true);
    expect(hasPermission(null, 'SECRETARY', 'manage_school_communications')).toBe(true);
    expect(hasPermission(null, 'ADMIN', 'manage_school_communications')).toBe(false);
    expect(hasPermission(null, 'TEACHER', 'send_school_email')).toBe(false);
    expect(hasPermission(null, 'STUDENT', 'send_school_email')).toBe(false);
    expect(hasPermission(null, 'GUARDIAN', 'send_school_email')).toBe(false);
    expect(hasPermission('SUPER_ADMIN', null, 'send_school_email')).toBe(false);
  });

  it('reserva a emissão de documentos acadêmicos à direção e secretaria', () => {
    expect(hasPermission(null, 'DIRECTOR', 'issue_academic_documents')).toBe(true);
    expect(hasPermission(null, 'SECRETARY', 'issue_academic_documents')).toBe(true);
    expect(hasPermission(null, 'ADMIN', 'issue_academic_documents')).toBe(false);
    expect(hasPermission(null, 'TEACHER', 'issue_academic_documents')).toBe(false);
    expect(hasPermission(null, 'STUDENT', 'issue_academic_documents')).toBe(false);
    expect(hasPermission(null, 'GUARDIAN', 'issue_academic_documents')).toBe(false);
    expect(hasPermission('SUPER_ADMIN', null, 'issue_academic_documents')).toBe(false);
  });

  it('reserva o prontuário acadêmico à direção e secretaria', () => {
    expect(hasPermission(null, 'DIRECTOR', 'view_student_academic_record')).toBe(true);
    expect(hasPermission(null, 'SECRETARY', 'view_student_academic_record')).toBe(true);
    expect(hasPermission(null, 'ADMIN', 'view_student_academic_record')).toBe(false);
    expect(hasPermission(null, 'TEACHER', 'view_student_academic_record')).toBe(false);
    expect(hasPermission(null, 'STUDENT', 'view_student_academic_record')).toBe(false);
    expect(hasPermission(null, 'GUARDIAN', 'view_student_academic_record')).toBe(false);
    expect(hasPermission('SUPER_ADMIN', null, 'view_student_academic_record')).toBe(false);
  });

  it('reserva relatórios acadêmicos à direção e secretaria', () => {
    expect(hasPermission(null, 'DIRECTOR', 'view_academic_reports')).toBe(true);
    expect(hasPermission(null, 'SECRETARY', 'view_academic_reports')).toBe(true);
    expect(hasPermission(null, 'ADMIN', 'view_academic_reports')).toBe(false);
    expect(hasPermission(null, 'TEACHER', 'view_academic_reports')).toBe(false);
    expect(hasPermission(null, 'STUDENT', 'view_academic_reports')).toBe(false);
    expect(hasPermission(null, 'GUARDIAN', 'view_academic_reports')).toBe(false);
    expect(hasPermission('SUPER_ADMIN', null, 'view_academic_reports')).toBe(false);
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
