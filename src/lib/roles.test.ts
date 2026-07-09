import { describe, expect, it } from 'vitest';

import { mapDatabaseRole } from './roles';

describe('mapDatabaseRole', () => {
    it('mapeia os papéis reconhecidos', () => {
        expect(mapDatabaseRole('ADMIN')).toBe('admin');
        expect(mapDatabaseRole('DIRECTOR')).toBe('director');
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