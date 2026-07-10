import { z } from 'zod';

const optionalCpfSchema = z.preprocess(
  (value) => {
    if (
      typeof value === 'string' &&
      value.trim() === ''
    ) {
      return undefined;
    }

    return value;
  },
  z
    .string()
    .trim()
    .regex(
      /^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/,
      'CPF deve conter 11 dígitos',
    )
    .optional(),
);

const personIdentityFields = {
  institution_id: z.guid(
    'Instituição inválida',
  ),

  full_name: z
    .string()
    .trim()
    .min(3, 'Nome é obrigatório')
    .max(
      120,
      'Nome deve possuir no máximo 120 caracteres',
    ),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('E-mail inválido'),
};

const studentEditableFields = {
  birth_date: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'Data inválida',
    ),

  cpf: optionalCpfSchema,
};

const dateStringSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Data inválida',
  );

function refineDateOrder<
  T extends {
    start_date: string;
    end_date: string;
  },
>(
  value: T,
  context: z.RefinementCtx,
): void {
  if (value.end_date < value.start_date) {
    context.addIssue({
      code: 'custom',
      path: ['end_date'],
      message:
        'A data final não pode ser anterior à data inicial',
    });
  }
}

export const studentSchema = z
  .object({
    ...personIdentityFields,
    ...studentEditableFields,
  })
  .strict();

export const studentUpdateSchema = z
  .object(studentEditableFields)
  .strict();

export const teacherSchema = z
  .object(personIdentityFields)
  .strict();

const academicYearFields = {
  name: z
    .string()
    .trim()
    .min(3, 'Nome do ano letivo é obrigatório')
    .max(
      80,
      'Nome do ano letivo deve possuir no máximo 80 caracteres',
    ),

  start_date: dateStringSchema,

  end_date: dateStringSchema,

  active: z.boolean().default(true),
};

export const academicYearSchema = z
  .object({
    institution_id: z.guid(
      'Instituição inválida',
    ),

    ...academicYearFields,
  })
  .strict()
  .superRefine(refineDateOrder);

export const academicYearUpdateSchema = z
  .object(academicYearFields)
  .strict()
  .superRefine(refineDateOrder);

const termFields = {
  name: z
    .string()
    .trim()
    .min(2, 'Nome do período é obrigatório')
    .max(
      80,
      'Nome do período deve possuir no máximo 80 caracteres',
    ),

  start_date: dateStringSchema,

  end_date: dateStringSchema,

  active: z.boolean().default(true),
};

export const termSchema = z
  .object({
    academic_year_id: z.guid(
      'Ano letivo é obrigatório',
    ),

    ...termFields,
  })
  .strict()
  .superRefine(refineDateOrder);

export const termUpdateSchema = z
  .object(termFields)
  .strict()
  .superRefine(refineDateOrder);

export const classSchema = z.object({
  name: z
    .string()
    .trim()
    .min(
      1,
      'Nome da turma é obrigatório',
    ),

  grade_level: z
    .string()
    .trim()
    .optional(),

  shift: z
    .string()
    .trim()
    .optional(),

  capacity: z
    .number()
    .int(
      'Capacidade deve ser um número inteiro',
    )
    .min(
      1,
      'Capacidade deve ser maior que 0',
    )
    .default(30),

  academic_year_id: z.guid(
    'Ano letivo é obrigatório',
  ),

  active: z.boolean().default(true),
});

export type StudentFormData =
  z.infer<typeof studentSchema>;

export type StudentUpdateData =
  z.infer<typeof studentUpdateSchema>;

export type TeacherFormData =
  z.infer<typeof teacherSchema>;

export type AcademicYearFormData =
  z.infer<typeof academicYearSchema>;

export type AcademicYearUpdateData =
  z.infer<typeof academicYearUpdateSchema>;

export type TermFormData =
  z.infer<typeof termSchema>;

export type TermUpdateData =
  z.infer<typeof termUpdateSchema>;

export type ClassFormData =
  z.infer<typeof classSchema>;
