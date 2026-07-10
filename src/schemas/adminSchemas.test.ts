import {
    describe,
    expect,
    it,
} from 'vitest';

import {
    studentSchema,
    studentUpdateSchema,
} from './adminSchemas';

const validStudent = {
    profile_id:
        '11111111-1111-4111-8111-111111111111',

    institution_id:
        '22222222-2222-4222-8222-222222222222',

    birth_date: '2010-05-20',
};

describe('studentSchema', () => {
    it('valida um aluno sem exigir RA', () => {
        const result =
            studentSchema.parse(validStudent);

        expect(result.active).toBe(true);

        expect(result.profile_id).toBe(
            validStudent.profile_id,
        );
    });

    it('transforma CPF vazio em indefinido', () => {
        const result = studentSchema.parse({
            ...validStudent,
            cpf: '',
        });

        expect(result.cpf).toBeUndefined();
    });

    it('rejeita CPF inválido', () => {
        const result = studentSchema.safeParse({
            ...validStudent,
            cpf: '123',
        });

        expect(result.success).toBe(false);
    });

    it('rejeita tentativa de informar RA manualmente', () => {
        const result = studentSchema.safeParse({
            ...validStudent,
            registration_number: '20269999',
        });

        expect(result.success).toBe(false);
    });
});

describe('studentUpdateSchema', () => {
    it('valida os campos editáveis do aluno', () => {
        const result =
            studentUpdateSchema.safeParse({
                birth_date: '2010-05-21',
                cpf: '123.456.789-00',
            });

        expect(result.success).toBe(true);
    });

    it('rejeita alteração manual do RA', () => {
        const result =
            studentUpdateSchema.safeParse({
                registration_number: '20269999',
                birth_date: '2010-05-21',
                cpf: '123.456.789-00',
            });

        expect(result.success).toBe(false);
    });
});