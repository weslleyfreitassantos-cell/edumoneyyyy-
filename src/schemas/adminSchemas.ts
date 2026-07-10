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

const studentEditableFields = {
  birth_date: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'Data inválida',
    ),

  cpf: optionalCpfSchema,
};

export const studentSchema = z
  .object({
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

    ...studentEditableFields,
  })
  .strict();

export const studentUpdateSchema = z
  .object(studentEditableFields)
  .strict();

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

export type ClassFormData =
  z.infer<typeof classSchema>;