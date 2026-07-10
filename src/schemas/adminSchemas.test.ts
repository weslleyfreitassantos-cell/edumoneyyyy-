import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  academicYearSchema,
  academicYearUpdateSchema,
  studentSchema,
  studentUpdateSchema,
  teacherSchema,
  termSchema,
  termUpdateSchema,
} from './adminSchemas';

const validStudent = {
  institution_id:
    '22222222-2222-4222-8222-222222222222',

  full_name: 'Aluno Teste',

  email: 'aluno@escola.com',

  birth_date: '2010-05-20',
};

const validTeacher = {
  institution_id:
    '22222222-2222-4222-8222-222222222222',

  full_name: 'Professor Teste',

  email: 'professor@escola.com',
};

const validAcademicYear = {
  institution_id:
    '22222222-2222-4222-8222-222222222222',
  name: 'Ano letivo 2026',
  start_date: '2026-01-20',
  end_date: '2026-12-10',
  active: true,
};

const validTerm = {
  academic_year_id:
    '33333333-3333-4333-8333-333333333333',
  name: '1º Bimestre',
  start_date: '2026-01-20',
  end_date: '2026-03-31',
  active: true,
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
    const result =
      studentSchema.safeParse({
        ...validStudent,
        cpf: '123',
      });

    expect(result.success).toBe(false);
  });

  it('rejeita perfil criado manualmente', () => {
    const result =
      studentSchema.safeParse({
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

describe('teacherSchema', () => {
  it('valida o cadastro do professor', () => {
    const result =
      teacherSchema.parse(validTeacher);

    expect(result.full_name).toBe(
      'Professor Teste',
    );

    expect(result.email).toBe(
      'professor@escola.com',
    );
  });

  it('normaliza nome e e-mail do professor', () => {
    const result = teacherSchema.parse({
      ...validTeacher,
      full_name:
        '  Professor Teste  ',
      email:
        '  PROFESSOR@ESCOLA.COM  ',
    });

    expect(result.full_name).toBe(
      'Professor Teste',
    );

    expect(result.email).toBe(
      'professor@escola.com',
    );
  });

  it('rejeita campos extras no cadastro do professor', () => {
    const result =
      teacherSchema.safeParse({
        ...validTeacher,
        role: 'ADMIN',
      });

    expect(result.success).toBe(false);
  });
});

describe('academicYearSchema', () => {
  it('valida um ano letivo', () => {
    const result =
      academicYearSchema.parse({
        ...validAcademicYear,
        name: '  Ano letivo 2026  ',
      });

    expect(result.name).toBe(
      'Ano letivo 2026',
    );
  });

  it('rejeita data final anterior à inicial', () => {
    const result =
      academicYearSchema.safeParse({
        ...validAcademicYear,
        start_date: '2026-12-10',
        end_date: '2026-01-20',
      });

    expect(result.success).toBe(false);
  });

  it('rejeita alteração com campo externo', () => {
    const result =
      academicYearUpdateSchema.safeParse({
        name: 'Ano letivo 2026',
        start_date: '2026-01-20',
        end_date: '2026-12-10',
        institution_id:
          '22222222-2222-4222-8222-222222222222',
        active: true,
      });

    expect(result.success).toBe(false);
  });
});

describe('termSchema', () => {
  it('valida um período', () => {
    const result = termSchema.parse({
      ...validTerm,
      name: '  1º Bimestre  ',
    });

    expect(result.name).toBe(
      '1º Bimestre',
    );
  });

  it('rejeita data final anterior à inicial', () => {
    const result = termSchema.safeParse({
      ...validTerm,
      start_date: '2026-03-31',
      end_date: '2026-01-20',
    });

    expect(result.success).toBe(false);
  });

  it('rejeita edição com troca de ano letivo', () => {
    const result =
      termUpdateSchema.safeParse({
        name: '2º Bimestre',
        start_date: '2026-04-01',
        end_date: '2026-06-30',
        academic_year_id:
          '33333333-3333-4333-8333-333333333333',
        active: true,
      });

    expect(result.success).toBe(false);
  });
});
