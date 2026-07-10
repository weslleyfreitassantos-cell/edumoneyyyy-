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
    registration_number: '20260001',
    birth_date: '2010-05-20',
};

describe('studentSchema', () => {
    it('valida um aluno e aplica o status ativo padrão', () => {
        const result =
            studentSchema.parse(validStudent);

        expect(result.active).toBe(true);
        expect(result.registration_number).toBe(
            '20260001',
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
});

describe('studentUpdateSchema', () => {
    it('valida os campos editáveis do aluno', () => {
        const result =
            studentUpdateSchema.safeParse({
                registration_number: '20260002',
                birth_date: '2010-05-21',
                cpf: '123.456.789-00',
            });

        expect(result.success).toBe(true);
    });
});