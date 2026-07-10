import type { DatabaseRole } from './roles';

export const CURRENT_DATABASE_ROLES = [
  'ADMIN',
  'DIRECTOR',
  'TEACHER',
  'STUDENT',
  'GUARDIAN',
] as const satisfies readonly DatabaseRole[];

export type CurrentDatabaseRole =
  (typeof CURRENT_DATABASE_ROLES)[number];

export const FUTURE_PLATFORM_ROLES = [
  'SUPER_ADMIN',
] as const;

export type FuturePlatformRole =
  (typeof FUTURE_PLATFORM_ROLES)[number];

export const FUTURE_SCHOOL_ROLES = [
  'SCHOOL_ADMIN',
  'SECRETARY',
] as const;

export type FutureSchoolRole =
  (typeof FUTURE_SCHOOL_ROLES)[number];

export const SYSTEM_PERMISSIONS = [
  'create_school',
  'manage_school',
  'manage_school_users',
  'manage_students',
  'manage_guardians',
  'manage_teachers',
  'manage_enrollments',
  'manage_academic_structure',
  'manage_assignments',
  'view_school_dashboard',
  'view_reports',
  'view_own_classes',
  'view_own_student_data',
  'view_linked_students',
] as const;

export type SystemPermission =
  (typeof SYSTEM_PERMISSIONS)[number];

const ADMIN_COMPATIBLE_PERMISSIONS = [
  'manage_school',
  'manage_school_users',
  'manage_students',
  'manage_guardians',
  'manage_teachers',
  'manage_enrollments',
  'manage_academic_structure',
  'manage_assignments',
  'view_school_dashboard',
  'view_reports',
] as const satisfies readonly SystemPermission[];

export const CURRENT_ROLE_PERMISSIONS = {
  ADMIN: ADMIN_COMPATIBLE_PERMISSIONS,

  // TODO: when SCHOOL_ADMIN exists, DIRECTOR should keep fewer permissions
  // than school administration while preserving pedagogical oversight.
  DIRECTOR: ADMIN_COMPATIBLE_PERMISSIONS,

  TEACHER: [
    'view_own_classes',
  ],

  STUDENT: [
    'view_own_student_data',
  ],

  GUARDIAN: [
    'view_linked_students',
  ],
} as const satisfies Record<
  CurrentDatabaseRole,
  readonly SystemPermission[]
>;

export interface FutureRolePlan {
  scope: 'platform' | 'school';
  description: string;
  plannedPermissions: readonly SystemPermission[];
  storagePlan: string;
}

export const FUTURE_ROLE_PLAN = {
  SUPER_ADMIN: {
    scope: 'platform',
    description:
      'Administra a plataforma e cria escolas, sem representar um vinculo escolar comum.',
    plannedPermissions: [
      'create_school',
      'view_reports',
    ],
    storagePlan:
      'Deve viver em profiles.platform_role quando a plataforma separar papeis globais.',
  },

  SCHOOL_ADMIN: {
    scope: 'school',
    description:
      'Administra usuarios, estrutura e operacao interna de uma escola.',
    plannedPermissions: ADMIN_COMPATIBLE_PERMISSIONS,
    storagePlan:
      'Deve viver em memberships.role quando os novos papeis escolares forem migrados.',
  },

  SECRETARY: {
    scope: 'school',
    description:
      'Opera cadastros escolares, alunos, responsaveis e matriculas dentro da propria escola.',
    plannedPermissions: [
      'manage_school_users',
      'manage_students',
      'manage_guardians',
      'manage_teachers',
      'manage_enrollments',
      'view_school_dashboard',
    ],
    storagePlan:
      'Deve viver em memberships.role depois da reconciliacao das migrations e das Edge Functions.',
  },
} as const satisfies Record<
  FuturePlatformRole | FutureSchoolRole,
  FutureRolePlan
>;

export function hasPermission(
  role: CurrentDatabaseRole,
  permission: SystemPermission,
): boolean {
  const permissions: readonly SystemPermission[] =
    CURRENT_ROLE_PERMISSIONS[role];

  return permissions.includes(permission);
}

export function hasAnyPermission(
  role: CurrentDatabaseRole,
  permissions: readonly SystemPermission[],
): boolean {
  return permissions.some((permission) =>
    hasPermission(role, permission),
  );
}

export function hasAllPermissions(
  role: CurrentDatabaseRole,
  permissions: readonly SystemPermission[],
): boolean {
  return permissions.every((permission) =>
    hasPermission(role, permission),
  );
}

export function canManageSchoolUsers(
  role: CurrentDatabaseRole,
): boolean {
  return hasPermission(
    role,
    'manage_school_users',
  );
}

export function canManageStudents(
  role: CurrentDatabaseRole,
): boolean {
  return hasPermission(role, 'manage_students');
}

export function canManageTeachers(
  role: CurrentDatabaseRole,
): boolean {
  return hasPermission(role, 'manage_teachers');
}

export function canManageGuardians(
  role: CurrentDatabaseRole,
): boolean {
  return hasPermission(role, 'manage_guardians');
}

export function canManageEnrollments(
  role: CurrentDatabaseRole,
): boolean {
  return hasPermission(
    role,
    'manage_enrollments',
  );
}
