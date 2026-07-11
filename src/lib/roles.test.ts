import { describe, expect, it } from 'vitest';

import {
    mapDatabaseRole,
    mapPlatformRole,
} from './roles';

describe('mapDatabaseRole', () => {
    it('mapeia os papéis reconhecidos', () => {
        expect(mapDatabaseRole('ADMIN')).toBe('admin');
        expect(mapDatabaseRole('DIRECTOR')).toBe('director');
        expect(mapDatabaseRole('SECRETARY')).toBe('secretary');
        expect(mapDatabaseRole('TEACHER')).toBe('teacher');
        expect(mapDatabaseRole('STUDENT')).toBe('student');
        expect(mapDatabaseRole('GUARDIAN')).toBe('parent');
    });

    it('rejeita papéis inválidos', () => {
        expect(mapDatabaseRole('UNKNOWN')).toBeNull();
        expect(mapDatabaseRole('')).toBeNull();
        expect(mapDatabaseRole('guardian')).toBeNull();
    });
});

describe('mapPlatformRole', () => {
    it('mapeia SUPER_ADMIN como papel global', () => {
        expect(mapPlatformRole('SUPER_ADMIN')).toBe('super_admin');
        expect(mapPlatformRole('USER')).toBeNull();
    });
});
