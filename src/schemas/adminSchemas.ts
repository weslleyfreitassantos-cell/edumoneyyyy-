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

export const studentSchema = z.object({
  profile_id: z
    .string()
    .uuid('Selecione um perfil válido'),

  institution_id: z
    .string()
    .uuid('Instituição inválida'),

  registration_number: z
    .string()
    .trim()
    .min(1, 'RA é obrigatório')
    .max(50, 'RA deve possuir no máximo 50 caracteres'),

  birth_date: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'Data inválida',
    ),

  cpf: optionalCpfSchema,

  active: z.boolean().default(true),
});

export const studentUpdateSchema =
  studentSchema.pick({
    registration_number: true,
    birth_date: true,
    cpf: true,
  });

export const classSchema = z.object({
  name: z
    .string()
    .min(1, 'Nome da turma é obrigatório'),

  grade_level: z.string().optional(),
  shift: z.string().optional(),

  capacity: z
    .number()
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