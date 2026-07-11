import type { UserRole } from '../types';

export const ROLE_MAP = {
    ADMIN: 'admin',
    DIRECTOR: 'director',
    SECRETARY: 'secretary',
    TEACHER: 'teacher',
    STUDENT: 'student',
    GUARDIAN: 'parent',
} as const satisfies Record<string, UserRole>;

export type DatabaseRole = keyof typeof ROLE_MAP;

export const PLATFORM_ROLE_MAP = {
    USER: 'user',
    SUPER_ADMIN: 'super_admin',
} as const;

export type PlatformRole = keyof typeof PLATFORM_ROLE_MAP;

export function isDatabaseRole(role: string): role is DatabaseRole {
    return Object.prototype.hasOwnProperty.call(ROLE_MAP, role);
}

export function isPlatformRole(role: string): role is PlatformRole {
    return Object.prototype.hasOwnProperty.call(
        PLATFORM_ROLE_MAP,
        role,
    );
}

export function mapDatabaseRole(role: string): UserRole | null {
    if (!isDatabaseRole(role)) {
        return null;
    }

    return ROLE_MAP[role];
}

export function mapPlatformRole(role: string): UserRole | null {
    if (!isPlatformRole(role)) {
        return null;
    }

    if (role === 'USER') {
        return null;
    }

    return PLATFORM_ROLE_MAP[role];
}
