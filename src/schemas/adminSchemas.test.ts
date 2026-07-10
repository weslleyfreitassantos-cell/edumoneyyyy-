import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  academicYearSchema,
  academicYearUpdateSchema,
  classSchema,
  classUpdateSchema,
  enrollmentSchema,
  enrollmentStatusUpdateSchema,
  enrollmentTransferSchema,
  guardianSchema,
  studentSchema,
  studentUpdateSchema,
  subjectSchema,
  subjectOfferingSchema,
  subjectOfferingUpdateSchema,
  subjectUpdateSchema,
  teacherSchema,
  termSchema,
  termUpdateSchema,
  unifiedUserInvitePreviewSchema,
} from './adminSchemas';
import { getUnifiedUserInviteOption } from '../pages/Admin/tabs/school-users/unifiedUserInviteModel';

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

const validClass = {
  institution_id:
    '22222222-2222-4222-8222-222222222222',
  academic_year_id:
    '33333333-3333-4333-8333-333333333333',
  name: '9º Ano A',
  grade_level: '9º Ano',
  shift: 'Matutino',
  capacity: 35,
  active: true,
};

const validSubject = {
  institution_id:
    '22222222-2222-4222-8222-222222222222',
  name: 'Matemática',
  code: ' mat ',
  workload: 80,
  active: true,
};

const validGuardian = {
  institution_id:
    '22222222-2222-4222-8222-222222222222',
  full_name: 'Responsável Teste',
  email: 'responsavel@escola.com',
  student_links: [
    {
      student_id:
        '44444444-4444-4444-8444-444444444444',
      relationship: 'Mãe',
      is_primary: true,
    },
  ],
};

const validEnrollment = {
  institution_id:
    '22222222-2222-4222-8222-222222222222',
  student_id:
    '44444444-4444-4444-8444-444444444444',
  class_id:
    '55555555-5555-4555-8555-555555555555',
  academic_year_id:
    '33333333-3333-4333-8333-333333333333',
  status: 'ACTIVE',
  active: true,
} as const;

const validSubjectOffering = {
  institution_id:
    '22222222-2222-4222-8222-222222222222',
  class_id:
    '55555555-5555-4555-8555-555555555555',
  subject_id:
    '77777777-7777-4777-8777-777777777777',
  teacher_profile_id:
    '88888888-8888-4888-8888-888888888888',
  term_id:
    '99999999-9999-4999-8999-999999999999',
  active: true,
};

const validUnifiedInvitePreview = {
  target_type: 'STUDENT',
  full_name: 'Aluno Visual',
  email: '',
  phone: '',
  create_access: true,
  academic_code: 'MAT-001',
  teacher_area: '',
  linked_student_name: '',
  relationship: '',
} as const;

describe('unifiedUserInvitePreviewSchema', () => {
  it('exige nome obrigatorio', () => {
    const result =
      unifiedUserInvitePreviewSchema.safeParse({
        ...validUnifiedInvitePreview,
        full_name: '',
      });

    expect(result.success).toBe(false);
  });

  it('rejeita e-mail invalido quando informado', () => {
    const result =
      unifiedUserInvitePreviewSchema.safeParse({
        ...validUnifiedInvitePreview,
        email: 'email-invalido',
      });

    expect(result.success).toBe(false);
  });

  it('aceita matricula visual para aluno', () => {
    const result =
      unifiedUserInvitePreviewSchema.parse(
        validUnifiedInvitePreview,
      );

    expect(result.academic_code).toBe(
      'MAT-001',
    );
  });

  it('aceita nome do aluno vinculado para responsavel', () => {
    const result =
      unifiedUserInvitePreviewSchema.parse({
        ...validUnifiedInvitePreview,
        target_type: 'GUARDIAN',
        full_name: 'Responsavel Visual',
        linked_student_name:
          'Aluno Vinculado',
        relationship: 'Responsavel legal',
      });

    expect(result.linked_student_name).toBe(
      'Aluno Vinculado',
    );
  });

  it('mantem papel planejado marcado como bloqueado no modelo', () => {
    const result =
      unifiedUserInvitePreviewSchema.parse({
        ...validUnifiedInvitePreview,
        target_type: 'SECRETARY_PLANNED',
        full_name: 'Secretaria Visual',
      });

    expect(
      getUnifiedUserInviteOption(
        result.target_type,
      ).isPlanned,
    ).toBe(true);
  });

  it('nao cria payload de banco', () => {
    const result =
      unifiedUserInvitePreviewSchema.safeParse({
        ...validUnifiedInvitePreview,
        profile_id:
          '11111111-1111-4111-8111-111111111111',
      });

    expect(result.success).toBe(false);
  });
});

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

describe('classSchema', () => {
  it('valida uma turma', () => {
    const result = classSchema.parse({
      ...validClass,
      name: '  9º Ano A  ',
      grade_level: '',
      shift: '',
    });

    expect(result.name).toBe('9º Ano A');
    expect(result.grade_level).toBeUndefined();
    expect(result.shift).toBeUndefined();
  });

  it('rejeita capacidade inválida', () => {
    const result = classSchema.safeParse({
      ...validClass,
      capacity: 0,
    });

    expect(result.success).toBe(false);
  });

  it('rejeita troca de instituição na edição', () => {
    const result =
      classUpdateSchema.safeParse({
        ...validClass,
      });

    expect(result.success).toBe(false);
  });
});

describe('subjectSchema', () => {
  it('valida e normaliza uma disciplina', () => {
    const result =
      subjectSchema.parse(validSubject);

    expect(result.name).toBe(
      'Matemática',
    );
    expect(result.code).toBe('MAT');
  });

  it('transforma código vazio em indefinido', () => {
    const result = subjectSchema.parse({
      ...validSubject,
      code: '',
    });

    expect(result.code).toBeUndefined();
  });

  it('rejeita carga horária inválida', () => {
    const result = subjectSchema.safeParse({
      ...validSubject,
      workload: 0,
    });

    expect(result.success).toBe(false);
  });

  it('rejeita troca de instituição na edição', () => {
    const result =
      subjectUpdateSchema.safeParse({
        ...validSubject,
      });

    expect(result.success).toBe(false);
  });
});

describe('guardianSchema', () => {
  it('valida responsável com vínculo de aluno', () => {
    const result =
      guardianSchema.parse({
        ...validGuardian,
        full_name:
          '  Responsável Teste  ',
        email:
          '  RESPONSAVEL@ESCOLA.COM  ',
      });

    expect(result.full_name).toBe(
      'Responsável Teste',
    );
    expect(result.email).toBe(
      'responsavel@escola.com',
    );
    expect(result.student_links).toHaveLength(1);
  });

  it('rejeita responsável sem aluno vinculado', () => {
    const result =
      guardianSchema.safeParse({
        ...validGuardian,
        student_links: [],
      });

    expect(result.success).toBe(false);
  });

  it('rejeita aluno duplicado no cadastro', () => {
    const result =
      guardianSchema.safeParse({
        ...validGuardian,
        student_links: [
          ...validGuardian.student_links,
          {
            ...validGuardian
              .student_links[0],
            relationship: 'Pai',
          },
        ],
      });

    expect(result.success).toBe(false);
  });
});

describe('enrollmentSchema', () => {
  it('valida uma matrícula ativa', () => {
    const result =
      enrollmentSchema.parse(
        validEnrollment,
      );

    expect(result.status).toBe('ACTIVE');
    expect(result.active).toBe(true);
  });

  it('aplica status ativo por padrão', () => {
    const result =
      enrollmentSchema.parse({
        ...validEnrollment,
        status: undefined,
      });

    expect(result.status).toBe('ACTIVE');
  });

  it('rejeita status ativo marcado como inativo', () => {
    const result =
      enrollmentStatusUpdateSchema.safeParse(
        {
          status: 'ACTIVE',
          active: false,
        },
      );

    expect(result.success).toBe(false);
  });

  it('valida payload de transferência', () => {
    const result =
      enrollmentTransferSchema.safeParse({
        enrollment_id:
          '66666666-6666-4666-8666-666666666666',
        target_class_id:
          '55555555-5555-4555-8555-555555555555',
      });

    expect(result.success).toBe(true);
  });
});

describe('subjectOfferingSchema', () => {
  it('valida uma atribuição acadêmica', () => {
    const result =
      subjectOfferingSchema.parse(
        validSubjectOffering,
      );

    expect(result.active).toBe(true);
  });

  it('aplica ativo por padrão', () => {
    const result =
      subjectOfferingSchema.parse({
        ...validSubjectOffering,
        active: undefined,
      });

    expect(result.active).toBe(true);
  });

  it('rejeita troca de instituição na edição', () => {
    const result =
      subjectOfferingUpdateSchema.safeParse(
        validSubjectOffering,
      );

    expect(result.success).toBe(false);
  });
});
