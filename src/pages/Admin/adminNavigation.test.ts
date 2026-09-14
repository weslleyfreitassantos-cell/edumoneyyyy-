import { describe, expect, it } from 'vitest';

import {
  ADMIN_MODULES,
  isAdminModuleAvailable,
} from './adminNavigation';

describe('academic documents admin navigation', () => {
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
});
