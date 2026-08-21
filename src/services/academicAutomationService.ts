import { supabase } from '../lib/supabaseClient';

export type PeriodModel = 'BIMESTERS_4' | 'TRIMESTERS_3' | 'SEMESTERS_2' | 'CUSTOM';

export interface PeriodDraft {
  name: string;
  start_date: string;
  end_date: string;
  active: boolean;
}

export interface TeacherSubjectRow {
  id: string;
  institution_id: string;
  teacher_profile_id: string;
  subject_id: string;
  primary_subject: boolean;
  active: boolean;
}

export interface TeacherAvailabilityRow {
  id: string;
  institution_id: string;
  teacher_profile_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active: boolean;
}

export interface SchoolTimeSlotRow {
  id: string;
  institution_id: string;
  shift: string;
  day_of_week: number;
  slot_number: number;
  start_time: string;
  end_time: string;
  active: boolean;
}

export interface CurriculumTemplateRow {
  id: string;
  institution_id: string;
  name: string;
  grade_level: string | null;
  stage: string | null;
  active: boolean;
}

function assertDateOrder(startDate: string, endDate: string, message = 'A data inicial deve ser anterior ou igual a data final.'): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
    throw new Error(message);
  }
}

function dateFromIso(value: string): Date {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error('Data invalida.');
  return date;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function suggestPeriods(startDate: string, endDate: string, model: Exclude<PeriodModel, 'CUSTOM'>): PeriodDraft[] {
  assertDateOrder(startDate, endDate);
  const count = model === 'BIMESTERS_4' ? 4 : model === 'TRIMESTERS_3' ? 3 : 2;
  const start = dateFromIso(startDate);
  const end = dateFromIso(endDate);
  const totalDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Array.from({ length: count }, (_, index) => {
    const periodStart = new Date(start.getTime() + Math.floor((totalDays * index) / count) * 86_400_000);
    const periodEnd = new Date(start.getTime() + (Math.floor((totalDays * (index + 1)) / count) - 1) * 86_400_000);
    return { name: `${index + 1}º ${model === 'BIMESTERS_4' ? 'Bimestre' : model === 'TRIMESTERS_3' ? 'Trimestre' : 'Semestre'}`, start_date: isoDate(periodStart), end_date: isoDate(periodEnd), active: true };
  });
}

export function validatePeriods(startDate: string, endDate: string, periods: PeriodDraft[]): void {
  assertDateOrder(startDate, endDate);
  if (periods.length === 0) throw new Error('Informe pelo menos um periodo.');
  const sorted = [...periods].sort((left, right) => left.start_date.localeCompare(right.start_date));
  let previousEnd = '';
  for (const period of sorted) {
    assertDateOrder(period.start_date, period.end_date, 'O periodo possui datas invalidas.');
    if (period.start_date < startDate || period.end_date > endDate) throw new Error('Todos os periodos devem estar dentro do ano letivo.');
    if (previousEnd && period.start_date <= previousEnd) throw new Error('Os periodos nao podem se sobrepor.');
    previousEnd = period.end_date;
  }
}

export const academicAutomationService = {
  async createAcademicYearWithTerms(input: { institution_id: string; name: string; start_date: string; end_date: string; active: boolean; periods: PeriodDraft[] }): Promise<{ year_id: string; term_count: number }> {
    validatePeriods(input.start_date, input.end_date, input.periods);
    const { data, error } = await supabase.rpc('create_academic_year_with_terms', {
      p_institution_id: input.institution_id,
      p_name: input.name.trim(),
      p_start_date: input.start_date,
      p_end_date: input.end_date,
      p_active: input.active,
      p_terms: input.periods,
    });
    if (error) throw error;
    return data as { year_id: string; term_count: number };
  },

  async copyPreviousYear(input: { institution_id: string; source_year_id: string; target_year_id: string; copy_teachers: boolean; copy_rooms: boolean }): Promise<Record<string, number>> {
    const { data, error } = await supabase.rpc('copy_academic_year_structure', {
      p_institution_id: input.institution_id,
      p_source_year_id: input.source_year_id,
      p_target_year_id: input.target_year_id,
      p_copy_teachers: input.copy_teachers,
      p_copy_rooms: input.copy_rooms,
    });
    if (error) throw error;
    return (data ?? {}) as Record<string, number>;
  },

  async listTeacherSubjects(institutionId: string, teacherProfileId: string): Promise<TeacherSubjectRow[]> {
    const { data, error } = await supabase.from('teacher_subjects').select('*').eq('institution_id', institutionId).eq('teacher_profile_id', teacherProfileId).order('primary_subject', { ascending: false });
    if (error) throw error;
    return (data ?? []) as TeacherSubjectRow[];
  },

  async replaceTeacherSubjects(input: { institution_id: string; teacher_profile_id: string; subject_ids: string[]; primary_subject_id?: string }): Promise<void> {
    const subjectIds = [...new Set(input.subject_ids)];
    const { error: deactivateError } = await supabase.from('teacher_subjects').update({ active: false }).eq('institution_id', input.institution_id).eq('teacher_profile_id', input.teacher_profile_id);
    if (deactivateError) throw deactivateError;
    if (subjectIds.length === 0) return;
    const { error } = await supabase.from('teacher_subjects').insert(subjectIds.map((subject_id) => ({ institution_id: input.institution_id, teacher_profile_id: input.teacher_profile_id, subject_id, primary_subject: subject_id === input.primary_subject_id, active: true })));
    if (error) throw error;
  },

  async listTeacherAvailability(institutionId: string, teacherProfileId: string): Promise<TeacherAvailabilityRow[]> {
    const { data, error } = await supabase.from('teacher_availability').select('*').eq('institution_id', institutionId).eq('teacher_profile_id', teacherProfileId).eq('active', true).order('day_of_week').order('start_time');
    if (error) throw error;
    return (data ?? []) as TeacherAvailabilityRow[];
  },

  async replaceTeacherAvailability(input: { institution_id: string; teacher_profile_id: string; availability: Array<Omit<TeacherAvailabilityRow, 'id' | 'active' | 'institution_id' | 'teacher_profile_id'>> }): Promise<void> {
    for (const window of input.availability) {
      if (window.start_time >= window.end_time) throw new Error('O horario final deve ser posterior ao inicial.');
    }
    const { error: deactivateError } = await supabase.from('teacher_availability').update({ active: false }).eq('institution_id', input.institution_id).eq('teacher_profile_id', input.teacher_profile_id);
    if (deactivateError) throw deactivateError;
    if (input.availability.length === 0) return;
    const { error } = await supabase.from('teacher_availability').insert(input.availability.map((window) => ({ ...window, institution_id: input.institution_id, teacher_profile_id: input.teacher_profile_id, active: true })));
    if (error) throw error;
  },

  async createWholeYearAssignment(input: { institution_id: string; class_id: string; subject_id: string; teacher_profile_id: string; academic_year_id: string }): Promise<number> {
    const { data, error } = await supabase.rpc('create_whole_year_assignment', { p_institution_id: input.institution_id, p_class_id: input.class_id, p_subject_id: input.subject_id, p_teacher_profile_id: input.teacher_profile_id, p_academic_year_id: input.academic_year_id });
    if (error) throw error;
    return Number(data ?? 0);
  },

  async listTimeSlots(institutionId: string, shift?: string): Promise<SchoolTimeSlotRow[]> {
    let query = supabase.from('school_time_slots').select('*').eq('institution_id', institutionId).eq('active', true).order('day_of_week').order('slot_number');
    if (shift) query = query.eq('shift', shift);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as SchoolTimeSlotRow[];
  },

  async upsertTimeSlots(input: { institution_id: string; shift: string; slots: Array<{ day_of_week: number; slot_number: number; start_time: string; end_time: string }> }): Promise<void> {
    const positions = new Set<string>();
    for (const slot of input.slots) {
      if (slot.start_time >= slot.end_time) throw new Error('O horario final deve ser posterior ao inicial.');
      const position = `${slot.day_of_week}:${slot.slot_number}`;
      if (positions.has(position)) throw new Error('Não é possível repetir a posição de um horário no mesmo dia.');
      positions.add(position);
    }

    const { data: existingSlots, error: existingError } = await supabase
      .from('school_time_slots')
      .select('id, day_of_week, slot_number')
      .eq('institution_id', input.institution_id)
      .eq('shift', input.shift)
      .eq('active', true);
    if (existingError) throw existingError;

    const staleIds = (existingSlots ?? [])
      .filter((slot) => !positions.has(`${slot.day_of_week}:${slot.slot_number}`))
      .map((slot) => slot.id);
    if (staleIds.length > 0) {
      const { error: deactivateError } = await supabase
        .from('school_time_slots')
        .update({ active: false })
        .eq('institution_id', input.institution_id)
        .eq('shift', input.shift)
        .in('id', staleIds);
      if (deactivateError) throw deactivateError;
    }

    const { error } = await supabase.from('school_time_slots').upsert(input.slots.map((slot) => ({ ...slot, institution_id: input.institution_id, shift: input.shift, active: true })), { onConflict: 'institution_id,shift,day_of_week,slot_number' });
    if (error) throw error;
  },

  async applyCurriculumTemplate(input: { institution_id: string; template_id: string; class_ids: string[] }): Promise<number> {
    const { data, error } = await supabase.rpc('apply_curriculum_template', { p_institution_id: input.institution_id, p_template_id: input.template_id, p_class_ids: input.class_ids });
    if (error) throw error;
    return Number(data ?? 0);
  },

  async listCurriculumTemplates(institutionId: string): Promise<CurriculumTemplateRow[]> {
    const { data, error } = await supabase.from('curriculum_templates').select('id, institution_id, name, grade_level, stage, active').eq('institution_id', institutionId).eq('active', true).order('name');
    if (error) throw error;
    return (data ?? []) as CurriculumTemplateRow[];
  },

  async createCurriculumTemplate(input: { institution_id: string; name: string; grade_level?: string; stage?: string; items: Array<{ subject_id: string; weekly_lessons: number; lesson_duration_minutes: number }> }): Promise<CurriculumTemplateRow> {
    if (!input.name.trim() || input.items.length === 0) throw new Error('O modelo precisa de nome e pelo menos uma disciplina.');
    const { data: template, error: templateError } = await supabase.from('curriculum_templates').insert({ institution_id: input.institution_id, name: input.name.trim(), grade_level: input.grade_level?.trim() || null, stage: input.stage?.trim() || null, active: true }).select('id, institution_id, name, grade_level, stage, active').single();
    if (templateError) throw templateError;
    const { error: itemsError } = await supabase.from('curriculum_template_items').insert(input.items.map((item) => ({ institution_id: input.institution_id, template_id: template.id, ...item, active: true })));
    if (itemsError) throw itemsError;
    return template as CurriculumTemplateRow;
  },
};
