import { describe, expect, it } from 'vitest';

import {
  ADMIN_MODULES,
  isAdminModuleAvailable,
} from './adminNavigation';

describe('academic documents admin navigation', () => {
  it('registra relatórios acadêmicos somente para direção e secretaria', () => {
    const module = ADMIN_MODULES.find((item) => item.id === 'academic-reports');

    expect(module).toMatchObject({
      label: 'Relatórios acadêmicos',
      groupId: 'school-operation',
      permission: 'view_academic_reports',
      href: '/admin?module=academic-reports',
      allowedRoles: ['DIRECTOR', 'SECRETARY'],
    });
    expect(isAdminModuleAvailable(module!, 'DIRECTOR')).toBe(true);
    expect(isAdminModuleAvailable(module!, 'SECRETARY')).toBe(true);
    expect(isAdminModuleAvailable(module!, 'ADMIN')).toBe(false);
    expect(isAdminModuleAvailable(module!, 'TEACHER')).toBe(false);
    expect(isAdminModuleAvailable(module!, 'STUDENT')).toBe(false);
    expect(isAdminModuleAvailable(module!, 'GUARDIAN')).toBe(false);
  });

  it('registers the module only for director and secretary', () => {
    const module = ADMIN_MODULES.find((item) => item.id === 'academic-documents');

    expect(module).toMatchObject({
      label: 'Documentos acadêmicos',
      groupId: 'school-operation',
      permission: 'issue_academic_documents',
      href: '/admin?module=academic-documents',
      allowedRoles: ['DIRECTOR', 'SECRETARY'],
    });
    expect(isAdminModuleAvailable(module!, 'DIRECTOR')).toBe(true);
    expect(isAdminModuleAvailable(module!, 'SECRETARY')).toBe(true);
    expect(isAdminModuleAvailable(module!, 'ADMIN')).toBe(false);
    expect(isAdminModuleAvailable(module!, 'TEACHER')).toBe(false);
    expect(isAdminModuleAvailable(module!, 'STUDENT')).toBe(false);
    expect(isAdminModuleAvailable(module!, 'GUARDIAN')).toBe(false);
  });

  it('mantém o prontuário como deep-link interno para direção e secretaria', () => {
    const module = ADMIN_MODULES.find((item) => item.id === 'student-record');

    expect(module).toMatchObject({
      label: 'Prontuário acadêmico',
      permission: 'view_student_academic_record',
      visibleInSidebar: false,
      allowedRoles: ['DIRECTOR', 'SECRETARY'],
    });
    expect(isAdminModuleAvailable(module!, 'DIRECTOR')).toBe(true);
    expect(isAdminModuleAvailable(module!, 'SECRETARY')).toBe(true);
    expect(isAdminModuleAvailable(module!, 'ADMIN')).toBe(false);
    expect(isAdminModuleAvailable(module!, 'TEACHER')).toBe(false);
    expect(isAdminModuleAvailable(module!, 'STUDENT')).toBe(false);
    expect(isAdminModuleAvailable(module!, 'GUARDIAN')).toBe(false);
  });
});
