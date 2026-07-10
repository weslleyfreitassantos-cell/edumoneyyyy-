import type { UserRole } from '../types';

export const ROLE_MAP = {
    ADMIN: 'admin',
    DIRECTOR: 'director',
    TEACHER: 'teacher',
    STUDENT: 'student',
    GUARDIAN: 'parent',
} as const satisfies Record<string, UserRole>;

export type DatabaseRole = keyof typeof ROLE_MAP;

export function isDatabaseRole(role: string): role is DatabaseRole {
    return Object.prototype.hasOwnProperty.call(ROLE_MAP, role);
}

export function mapDatabaseRole(role: string): UserRole | null {
    if (!isDatabaseRole(role)) {
        return null;
    }

    return ROLE_MAP[role];
}