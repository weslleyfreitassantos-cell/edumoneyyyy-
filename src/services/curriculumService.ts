import { supabase } from '../lib/supabaseClient';
import { z } from 'zod';

interface CurriculumQueryRow {
  id: string;
  institution_id: string;
  class_id: string;
  subject_id: string;
  weekly_lessons: number;
  lesson_duration_minutes: number;
  needs_review: boolean;
  active: boolean;
  created_at: string | null;
  updated_at: string | null;
  classes: { name: string; academic_year_id: string } | { name: string; academic_year_id: string }[] | null;
  subjects: { name: string; code: string | null } | { name: string; code: string | null }[] | null;
}

export interface CurriculumItemRow {
  id: string;
  institution_id: string;
  class_id: string;
  subject_id: string;
  weekly_lessons: number;
  lesson_duration_minutes: number;
  needs_review: boolean;
  active: boolean;
  class_name: string;
  academic_year_id: string;
  subject_name: string;
  subject_code: string | null;
  weekly_minutes: number;
}

interface OfferingLookupRow {
  id: string;
  class_id: string;
  subject_id: string;
  term_id: string;
  teacher_profile_id: string;
  active: boolean | null;
  classes: { name: string; academic_year_id: string } | { name: string; academic_year_id: string }[] | null;
}

interface TermLookupRow {
  id: string;
  name: string;
  academic_year_id: string;
}

export interface CurriculumTeacherInfo {
  term_id: string;
  term_name: string;
  teacher_profile_id: string | null;
  teacher_name: string | null;
  active: boolean;
}

export const curriculumCreateSchema = z.object({
  institution_id: z.string().uuid('Instituição inválida'),
  class_id: z.string().uuid('Turma é obrigatória'),
  subject_id: z.string().uuid('Disciplina é obrigatória'),
  weekly_lessons: z.number().int().min(1, 'Mínimo de 1 aula semanal').max(20, 'Máximo de 20 aulas semanais'),
  lesson_duration_minutes: z.number().int().min(15, 'Mínimo de 15 minutos').max(180, 'Máximo de 180 minutos'),
});

export const curriculumUpdateSchema = z.object({
  weekly_lessons: z.number().int().min(1, 'Mínimo de 1 aula semanal').max(20, 'Máximo de 20 aulas semanais'),
  lesson_duration_minutes: z.number().int().min(15, 'Mínimo de 15 minutos').max(180, 'Máximo de 180 minutos'),
});

export type CurriculumCreateData = z.infer<typeof curriculumCreateSchema>;
export type CurriculumUpdateData = z.infer<typeof curriculumUpdateSchema>;

function normalizeRelation<T>(relation: T | T[] | null): T | null {
  if (Array.isArray(relation)) return relation[0] ?? null;
  return relation;
}

async function assertClassBelongsToInstitution(classId: string, institutionId: string): Promise<void> {
  const { data, error } = await supabase
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('institution_id', institutionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Turma não encontrada nesta instituição.');
}

async function assertSubjectBelongsToInstitution(subjectId: string, institutionId: string): Promise<void> {
  const { data, error } = await supabase
    .from('subjects')
    .select('id')
    .eq('id', subjectId)
    .eq('institution_id', institutionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Disciplina não encontrada nesta instituição.');
}

function normalizeItem(row: CurriculumQueryRow): CurriculumItemRow {
  const classRel = normalizeRelation(row.classes);
  const subjectRel = normalizeRelation(row.subjects);
  return {
    id: row.id,
    institution_id: row.institution_id,
    class_id: row.class_id,
    subject_id: row.subject_id,
    weekly_lessons: row.weekly_lessons,
    lesson_duration_minutes: row.lesson_duration_minutes,
    needs_review: row.needs_review,
    active: row.active,
    class_name: classRel?.name ?? '',
    academic_year_id: classRel?.academic_year_id ?? '',
    subject_name: subjectRel?.name ?? '',
    subject_code: subjectRel?.code ?? null,
    weekly_minutes: row.weekly_lessons * row.lesson_duration_minutes,
  };
}

function mapCurriculumError(error: unknown): Error {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes('CURRICULUM_COMPONENT_REQUIRED')) {
      return new Error('Adicione esta disciplina à matriz curricular da turma antes de atribuir um professor.');
    }
    if (msg.includes('CURRICULUM_COMPONENT_HAS_ACTIVE_OFFERINGS')) {
      return new Error('Desative primeiro as atribuições ativas desta disciplina.');
    }
    if (msg.includes('CURRICULUM_COMPONENT_HAS_ACTIVE_TIMETABLE_ENTRIES')) {
      return new Error('Remova primeiro as aulas publicadas desta disciplina.');
    }
    if (msg.includes('class_curriculum_items_class_subject_unique') || msg.includes('duplicate key')) {
      return new Error('A disciplina já está presente na matriz desta turma.');
    }
    if (msg.includes('inactive class')) {
      return new Error('A turma selecionada está inativa.');
    }
    if (msg.includes('inactive subject')) {
      return new Error('A disciplina selecionada está inativa.');
    }
    return error;
  }
  return new Error('Não foi possível concluir a operação.');
}

export const curriculumService = {
  async list(institutionId: string): Promise<CurriculumItemRow[]> {
    const { data, error } = await supabase
      .from('class_curriculum_items')
      .select(`
        id,
        institution_id,
        class_id,
        subject_id,
        weekly_lessons,
        lesson_duration_minutes,
        needs_review,
        active,
        created_at,
        updated_at,
        classes:class_id (name, academic_year_id),
        subjects:subject_id (name, code)
      `)
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as unknown as CurriculumQueryRow[]).map(normalizeItem);
  },

  async create(input: CurriculumCreateData): Promise<CurriculumItemRow> {
    const data = curriculumCreateSchema.parse(input);
    await assertClassBelongsToInstitution(data.class_id, data.institution_id);
    await assertSubjectBelongsToInstitution(data.subject_id, data.institution_id);
    const { data: created, error } = await supabase
      .from('class_curriculum_items')
      .insert({ ...data, needs_review: false, active: true })
      .select(`
        id, institution_id, class_id, subject_id,
        weekly_lessons, lesson_duration_minutes,
        needs_review, active, created_at, updated_at,
        classes:class_id (name, academic_year_id),
        subjects:subject_id (name, code)
      `)
      .single();
    if (error) throw mapCurriculumError(error);
    return normalizeItem(created as unknown as CurriculumQueryRow);
  },

  async update(id: string, institutionId: string, input: CurriculumUpdateData): Promise<void> {
    const data = curriculumUpdateSchema.parse(input);
    const { error } = await supabase
      .from('class_curriculum_items')
      .update({ ...data, needs_review: false })
      .eq('id', id)
      .eq('institution_id', institutionId);
    if (error) throw mapCurriculumError(error);
  },

  async delete(id: string, institutionId: string): Promise<void> {
    const { error } = await supabase
      .from('class_curriculum_items')
      .delete()
      .eq('id', id)
      .eq('institution_id', institutionId);
    if (error) throw mapCurriculumError(error);
  },

  async setActive(id: string, institutionId: string, active: boolean): Promise<void> {
    const { error } = await supabase
      .from('class_curriculum_items')
      .update({ active })
      .eq('id', id)
      .eq('institution_id', institutionId);
    if (error) throw mapCurriculumError(error);
  },

  async getTeachersByItem(
    institutionId: string,
    classId: string,
    subjectId: string,
  ): Promise<CurriculumTeacherInfo[]> {
    const [termsResult, offeringsResult] = await Promise.all([
      supabase
        .from('terms')
        .select('id, name, academic_year_id')
        .order('start_date', { ascending: true }),
      supabase
        .from('subject_offerings')
        .select(`
          id, class_id, subject_id, term_id, teacher_profile_id, active,
          classes:class_id (name, academic_year_id)
        `)
        .eq('class_id', classId)
        .eq('subject_id', subjectId),
    ]);
    if (termsResult.error) throw termsResult.error;
    if (offeringsResult.error) throw offeringsResult.error;

    const classItem = (offeringsResult.data ?? []) as unknown as OfferingLookupRow[];
    const classRel = normalizeRelation(classItem[0]?.classes);
    const classYearId = classRel?.academic_year_id ?? '';

    const yearTerms = (termsResult.data ?? []) as TermLookupRow[];
    const classTerms = yearTerms.filter((t) => t.academic_year_id === classYearId);

    return classTerms.map((term) => {
      const offering = classItem.find((o) => o.term_id === term.id);
      return {
        term_id: term.id,
        term_name: term.name,
        teacher_profile_id: offering?.teacher_profile_id ?? null,
        teacher_name: null,
        active: offering?.active !== false,
      };
    });
  },
};
