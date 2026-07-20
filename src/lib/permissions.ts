import type {
  DatabaseRole,
  PlatformRole,
} from './roles';

export const PLATFORM_ROLES = [
  'USER',
  'SUPER_ADMIN',
] as const satisfies readonly PlatformRole[];

export const CURRENT_DATABASE_ROLES = [
  'ADMIN',
  'DIRECTOR',
  'SECRETARY',
  'TEACHER',
  'STUDENT',
  'GUARDIAN',
] as const satisfies readonly DatabaseRole[];

export type CurrentDatabaseRole =
  (typeof CURRENT_DATABASE_ROLES)[number];

export type LegacyDatabaseRole = Extract<
  CurrentDatabaseRole,
  'ADMIN'
>;

export type InstitutionRole = Exclude<
  CurrentDatabaseRole,
  LegacyDatabaseRole
>;

export type AccountStatus =
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'CANCELED';

export type EffectiveRole = CurrentDatabaseRole;

type EffectiveRoleInput =
  | string
  | CurrentDatabaseRole
  | null
  | undefined;

export const SYSTEM_PERMISSIONS = [
  'view_platform_dashboard',
  'manage_accounts',
  'manage_account_limits',
  'suspend_accounts',
  'view_all_institutions',
  'create_institution',
  'view_account_dashboard',
  'manage_owned_institutions',
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

const ADMIN_PERMISSIONS = [
  'create_institution',
  'view_account_dashboard',
  'manage_owned_institutions',
  'manage_school_users',
  'view_school_dashboard',
  'view_reports',
] as const satisfies readonly SystemPermission[];

const DIRECTOR_PERMISSIONS = [
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
  ADMIN: ADMIN_PERMISSIONS,

  DIRECTOR: DIRECTOR_PERMISSIONS,

  SECRETARY: [
    'manage_school_users',
    'manage_students',
    'manage_guardians',
    'manage_teachers',
    'manage_enrollments',
    'view_school_dashboard',
  ],

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

export const PLATFORM_ROLE_PERMISSIONS: Record<
  PlatformRole,
  readonly SystemPermission[]
> = {
  SUPER_ADMIN: [
    'view_platform_dashboard',
    'manage_accounts',
    'manage_account_limits',
    'suspend_accounts',
    'view_all_institutions',
    'view_school_dashboard',
    'manage_school_users',
    'manage_students',
    'manage_teachers',
    'manage_guardians',
    'manage_enrollments',
    'manage_academic_structure',
    'manage_assignments',
    'view_reports',
  ],
  USER: [],
};

export interface EffectiveRoleSource {
  platformRole?: PlatformRole | string | null;
  isAccountOwner?: boolean;
  accountStatus?: AccountStatus | string | null;
  membershipRole?: EffectiveRoleInput;
  profileRole?: EffectiveRoleInput;
}

export interface EffectivePermissionCheck
  extends EffectiveRoleSource {
  permission: SystemPermission;
}

export interface EffectivePermissionsCheck
  extends EffectiveRoleSource {
  permissions: readonly SystemPermission[];
}

export function isCurrentDatabaseRole(
  role: unknown,
): role is CurrentDatabaseRole {
  return (
    typeof role === 'string' &&
    CURRENT_DATABASE_ROLES.includes(
      role as CurrentDatabaseRole,
    )
  );
}

export function isInstitutionRole(
  role: unknown,
): role is InstitutionRole {
  return (
    isCurrentDatabaseRole(role) &&
    role !== 'ADMIN'
  );
}

export function isPlatformSuperAdmin(
  platformRole: unknown,
): platformRole is 'SUPER_ADMIN' {
  return platformRole === 'SUPER_ADMIN';
}

export function getEffectiveRole({
  isAccountOwner,
  accountStatus,
  membershipRole,
  profileRole,
}: EffectiveRoleSource): EffectiveRole | null {

  if (
    isAccountOwner === true &&
    (accountStatus === undefined ||
      accountStatus === null ||
      accountStatus === 'ACTIVE')
  ) {
    return 'ADMIN';
  }

  if (isCurrentDatabaseRole(membershipRole)) {
    return membershipRole;
  }

  if (isCurrentDatabaseRole(profileRole)) {
    return profileRole;
  }

  return null;
}

export function hasPermission(
  platformRole: PlatformRole | string | null | undefined,
  effectiveRole: EffectiveRole | null | undefined,
  permission: SystemPermission,
): boolean {
  if (isPlatformSuperAdmin(platformRole)) {
    const allowedPermissions: readonly SystemPermission[] =
      PLATFORM_ROLE_PERMISSIONS.SUPER_ADMIN;
    return allowedPermissions.includes(permission);
  }

  if (effectiveRole) {
    const permissions: readonly SystemPermission[] =
      CURRENT_ROLE_PERMISSIONS[effectiveRole];
    return permissions.includes(permission);
  }

  return false;
}

export function hasEffectivePermission({
  platformRole,
  isAccountOwner,
  accountStatus,
  membershipRole,
  profileRole,
  permission,
}: EffectivePermissionCheck): boolean {
  const effectiveRole = getEffectiveRole({
    isAccountOwner,
    accountStatus,
    membershipRole,
    profileRole,
  });

  return hasPermission(platformRole, effectiveRole, permission);
}

export function hasAnyPermission(
  platformRole: PlatformRole | string | null | undefined,
  effectiveRole: EffectiveRole | null | undefined,
  permissions: readonly SystemPermission[],
): boolean {
  return permissions.some((permission) =>
    hasPermission(platformRole, effectiveRole, permission),
  );
}

export function hasAnyEffectivePermission({
  platformRole,
  isAccountOwner,
  accountStatus,
  membershipRole,
  profileRole,
  permissions,
}: EffectivePermissionsCheck): boolean {
  const effectiveRole = getEffectiveRole({
    isAccountOwner,
    accountStatus,
    membershipRole,
    profileRole,
  });

  return hasAnyPermission(platformRole, effectiveRole, permissions);
}

export function hasAllPermissions(
  platformRole: PlatformRole | string | null | undefined,
  effectiveRole: EffectiveRole | null | undefined,
  permissions: readonly SystemPermission[],
): boolean {
  return permissions.every((permission) =>
    hasPermission(platformRole, effectiveRole, permission),
  );
}

export function hasAllEffectivePermissions({
  platformRole,
  isAccountOwner,
  accountStatus,
  membershipRole,
  profileRole,
  permissions,
}: EffectivePermissionsCheck): boolean {
  const effectiveRole = getEffectiveRole({
    isAccountOwner,
    accountStatus,
    membershipRole,
    profileRole,
  });

  return hasAllPermissions(platformRole, effectiveRole, permissions);
}

export function canManageSchoolUsers(
  platformRole: PlatformRole | string | null | undefined,
  effectiveRole: EffectiveRole | null | undefined,
): boolean {
  return hasPermission(platformRole, effectiveRole, 'manage_school_users');
}

export function canManageStudents(
  platformRole: PlatformRole | string | null | undefined,
  effectiveRole: EffectiveRole | null | undefined,
): boolean {
  return hasPermission(platformRole, effectiveRole, 'manage_students');
}

export function canManageTeachers(
  platformRole: PlatformRole | string | null | undefined,
  effectiveRole: EffectiveRole | null | undefined,
): boolean {
  return hasPermission(platformRole, effectiveRole, 'manage_teachers');
}

export function canManageGuardians(
  platformRole: PlatformRole | string | null | undefined,
  effectiveRole: EffectiveRole | null | undefined,
): boolean {
  return hasPermission(platformRole, effectiveRole, 'manage_guardians');
}

export function canManageEnrollments(
  platformRole: PlatformRole | string | null | undefined,
  effectiveRole: EffectiveRole | null | undefined,
): boolean {
  return hasPermission(platformRole, effectiveRole, 'manage_enrollments');
}
