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
    institution_id:
        '22222222-2222-4222-8222-222222222222',

    full_name: 'Aluno Teste',

    email: 'aluno@escola.com',

    birth_date: '2010-05-20',
};

describe('studentSchema', () => {
    it('valida o cadastro completo do aluno', () => {
        const result =
            studentSchema.parse(validStudent);

        expect(result.full_name).toBe(
            'Aluno Teste',
        );

        expect(result.email).toBe(
            'aluno@escola.com',
        );
    });

    it('normaliza nome e e-mail', () => {
        const result = studentSchema.parse({
            ...validStudent,
            full_name: '  Aluno Teste  ',
            email: '  ALUNO@ESCOLA.COM  ',
        });

        expect(result.full_name).toBe(
            'Aluno Teste',
        );

        expect(result.email).toBe(
            'aluno@escola.com',
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

    it('rejeita perfil criado manualmente', () => {
        const result = studentSchema.safeParse({
            ...validStudent,
            profile_id:
                '11111111-1111-4111-8111-111111111111',
        });

        expect(result.success).toBe(false);
    });
});

describe('studentUpdateSchema', () => {
    it('valida os campos acadêmicos editáveis', () => {
        const result =
            studentUpdateSchema.safeParse({
                birth_date: '2010-05-21',
                cpf: '123.456.789-00',
            });

        expect(result.success).toBe(true);
    });

    it('rejeita alteração de e-mail pela edição acadêmica', () => {
        const result =
            studentUpdateSchema.safeParse({
                email: 'outro@escola.com',
                birth_date: '2010-05-21',
                cpf: '',
            });

        expect(result.success).toBe(false);
    });
});