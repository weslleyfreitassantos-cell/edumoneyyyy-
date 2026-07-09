import { z } from 'zod';

export const studentSchema = z.object({
  profile_id: z.string().uuid('Selecione um perfil válido'),
  institution_id: z.string().uuid(),
  registration_number: z.string().min(1, 'RA é obrigatório'),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (YYYY-MM-DD)'),
  cpf: z.string().optional(),
  active: z.boolean().default(true),
});

export const classSchema = z.object({
  name: z.string().min(1, 'Nome da turma é obrigatório'),
  grade_level: z.string().optional(),
  shift: z.string().optional(),
  capacity: z.number().min(1, 'Capacidade deve ser maior que 0').default(30),
  academic_year_id: z.string().uuid('Ano letivo é obrigatório'),
  active: z.boolean().default(true),
});

export type StudentFormData = z.infer<typeof studentSchema>;
export type ClassFormData = z.infer<typeof classSchema>;
