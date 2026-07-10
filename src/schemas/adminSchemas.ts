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
    profile_id: z
      .string()
      .uuid('Selecione um perfil válido'),

    institution_id: z
      .string()
      .uuid('Instituição inválida'),

    ...studentEditableFields,

    active: z.boolean().default(true),
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
    .int('Capacidade deve ser um número inteiro')
    .min(
      1,
      'Capacidade deve ser maior que 0',
    )
    .default(30),

  academic_year_id: z
    .string()
    .uuid('Ano letivo é obrigatório'),

  active: z.boolean().default(true),
});

export type StudentFormData =
  z.infer<typeof studentSchema>;

export type StudentUpdateData =
  z.infer<typeof studentUpdateSchema>;

export type ClassFormData =
  z.infer<typeof classSchema>;