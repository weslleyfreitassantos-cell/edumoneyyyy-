import { supabase } from '../lib/supabaseClient';
import { academicShiftSettingsService } from './academicShiftSettingsService';

export interface ClassBatchInput {
  institutionId: string;
  academicYearId: string;
  baseName: string;
  count: number;
  gradeLevel?: string;
  shift?: string;
  capacity: number;
  templateId?: string;
  assignTeachers: boolean;
}

export interface ClassBatchResult {
  createdClassIds: string[];
  createdClassNames: string[];
  curriculumItemsApplied: number;
  assignmentsCreated: number;
  uncoveredSubjects: string[];
}

export interface EducationPresetGrade {
  key: string;
  label: string;
  baseName: string;
  gradeLevel: string;
  stage: string;
  defaultClassCount: number;
}

export interface EducationPresetInput {
  institutionId: string;
  academicYearId: string;
  classCounts: Record<string, number>;
  shift?: string;
  capacity: number;
  templateId?: string;
  assignTeachers: boolean;
}

export const EDUCATION_PRESET_GRADES: EducationPresetGrade[] = [
  ...Array.from({ length: 5 }, (_, index) => ({
    key: `fundamental-${index + 1}`,
    label: `${index + 1}º ano`,
    baseName: `${index + 1}º ano`,
    gradeLevel: String(index + 1),
    stage: 'Ensino Fundamental - anos iniciais',
    defaultClassCount: 2,
  })),
  ...Array.from({ length: 4 }, (_, index) => ({
    key: `fundamental-${index + 6}`,
    label: `${index + 6}º ano`,
    baseName: `${index + 6}º ano`,
    gradeLevel: String(index + 6),
    stage: 'Ensino Fundamental - anos finais',
    defaultClassCount: 2,
  })),
  ...Array.from({ length: 3 }, (_, index) => ({
    key: `medio-${index + 1}`,
    label: `${index + 1}ª série do Ensino Médio`,
    baseName: `${index + 1}ª série EM`,
    gradeLevel: `${index + 1}º EM`,
    stage: 'Ensino Médio',
    defaultClassCount: 2,
  })),
];

export interface EducationPresetClassDefinition {
  grade: EducationPresetGrade;
  count: number;
  names: string[];
}

export function buildEducationPresetClassDefinitions(
  classCounts: Record<string, number>,
): EducationPresetClassDefinition[] {
  const definitions = EDUCATION_PRESET_GRADES.map((grade) => {
    const count = classCounts[grade.key] ?? grade.defaultClassCount;

    if (!Number.isInteger(count) || count < 0 || count > 26) {
      throw new Error(`A quantidade de turmas para ${grade.label} deve estar entre 0 e 26.`);
    }

    return {
      grade,
      count,
      names: count > 0 ? buildClassBatchNames(grade.baseName, count) : [],
    };
  });

  if (definitions.every((definition) => definition.count === 0)) {
    throw new Error('Informe pelo menos uma turma no preset escolar.');
  }

  return definitions;
}

interface TemplateItemRow {
  subject_id: string;
  weekly_lessons: number;
  lesson_duration_minutes: number;
  subjects:
    | { name: string }
    | { name: string }[]
    | null;
}

interface TeacherSubjectRow {
  teacher_profile_id: string;
  subject_id: string;
  primary_subject: boolean | null;
}

interface TeacherMembershipRow {
  profile_id: string;
  active: boolean | null;
  profiles:
    | { active: boolean | null }
    | { active: boolean | null }[]
    | null;
}

function normalizeRelation<T>(relation: T | T[] | null): T | null {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('pt-BR');
}

function classLetter(index: number): string {
  let value = index + 1;
  let result = '';

  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }

  return result;
}

export function buildClassBatchNames(baseName: string, count: number): string[] {
  const normalizedBaseName = baseName.trim();

  if (!normalizedBaseName) {
    throw new Error('Informe o nome-base das turmas.');
  }

  if (!Number.isInteger(count) || count < 1 || count > 26) {
    throw new Error('A quantidade de turmas deve estar entre 1 e 26.');
  }

  return Array.from({ length: count }, (_, index) => {
    const letter = classLetter(index);

    if (normalizedBaseName.includes('{letra}')) {
      return normalizedBaseName.replaceAll('{letra}', letter);
    }

    return count === 1
      ? normalizedBaseName
      : `${normalizedBaseName} ${letter}`;
  });
}

function validateInput(input: ClassBatchInput): void {
  if (!input.institutionId || !input.academicYearId) {
    throw new Error('Instituição e ano letivo são obrigatórios.');
  }

  buildClassBatchNames(input.baseName, input.count);

  if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 500) {
    throw new Error('A capacidade deve ser um número inteiro entre 1 e 500.');
  }
}

async function listEligibleTeachers(
  institutionId: string,
): Promise<Map<string, string>> {
  const [teacherSubjectsResult, membershipsResult] = await Promise.all([
    supabase
      .from('teacher_subjects')
      .select('teacher_profile_id, subject_id, primary_subject')
      .eq('institution_id', institutionId)
      .eq('active', true),
    supabase
      .from('memberships')
      .select('profile_id, active, profiles:profile_id(active)')
      .eq('institution_id', institutionId)
      .eq('role', 'TEACHER')
      .eq('active', true),
  ]);

  if (teacherSubjectsResult.error) throw teacherSubjectsResult.error;
  if (membershipsResult.error) throw membershipsResult.error;

  const eligibleProfiles = new Set<string>();

  for (const membership of (membershipsResult.data ?? []) as TeacherMembershipRow[]) {
    const profile = normalizeRelation(membership.profiles);

    if (membership.active !== false && profile?.active !== false) {
      eligibleProfiles.add(membership.profile_id);
    }
  }

  const bySubject = new Map<string, string>();
  const candidates = (teacherSubjectsResult.data ?? []) as TeacherSubjectRow[];

  for (const candidate of candidates) {
    if (!eligibleProfiles.has(candidate.teacher_profile_id)) continue;

    const currentTeacher = bySubject.get(candidate.subject_id);

    if (!currentTeacher || candidate.primary_subject === true) {
      bySubject.set(candidate.subject_id, candidate.teacher_profile_id);
    }
  }

  return bySubject;
}

export const classAutomationService = {
  async createBatch(input: ClassBatchInput): Promise<ClassBatchResult> {
    validateInput(input);

    const names = buildClassBatchNames(input.baseName, input.count);
    const normalizedNames = new Set(names.map(normalizeName));

    const { data: academicYear, error: academicYearError } = await supabase
      .from('academic_years')
      .select('id')
      .eq('id', input.academicYearId)
      .eq('institution_id', input.institutionId)
      .maybeSingle();

    if (academicYearError) throw academicYearError;
    if (!academicYear) throw new Error('Ano letivo não encontrado nesta instituição.');

    const normalizedShift =
      await academicShiftSettingsService.assertShiftEnabled(
        input.institutionId,
        input.shift,
      );

    const { data: existingClasses, error: classesError } = await supabase
      .from('classes')
      .select('name')
      .eq('institution_id', input.institutionId)
      .eq('academic_year_id', input.academicYearId);

    if (classesError) throw classesError;

    const duplicateName = (existingClasses ?? []).find((classRecord) =>
      normalizedNames.has(normalizeName(String(classRecord.name))),
    );

    if (duplicateName) {
      throw new Error(`A turma ${duplicateName.name} já existe neste ano letivo.`);
    }

    let templateItems: TemplateItemRow[] = [];

    if (input.templateId) {
      const { data: template, error: templateError } = await supabase
        .from('curriculum_templates')
        .select('id')
        .eq('id', input.templateId)
        .eq('institution_id', input.institutionId)
        .eq('active', true)
        .maybeSingle();

      if (templateError) throw templateError;
      if (!template) throw new Error('Modelo curricular não encontrado nesta instituição.');

      const { data: items, error: itemsError } = await supabase
        .from('curriculum_template_items')
        .select('subject_id, weekly_lessons, lesson_duration_minutes, subjects:subject_id(name)')
        .eq('template_id', input.templateId)
        .eq('institution_id', input.institutionId)
        .eq('active', true);

      if (itemsError) throw itemsError;

      templateItems = (items ?? []) as TemplateItemRow[];

      if (templateItems.length === 0) {
        throw new Error('O modelo curricular selecionado não possui disciplinas ativas.');
      }
    }

    const { data: createdClasses, error: createError } = await supabase
      .from('classes')
      .insert(
        names.map((name) => ({
          institution_id: input.institutionId,
          academic_year_id: input.academicYearId,
          name,
          grade_level: input.gradeLevel?.trim() || null,
          shift: normalizedShift,
          capacity: input.capacity,
          active: true,
        })),
      )
      .select('id, name');

    if (createError) throw createError;

    const classRows = (createdClasses ?? []) as { id: string; name: string }[];
    const result: ClassBatchResult = {
      createdClassIds: classRows.map((classRecord) => classRecord.id),
      createdClassNames: classRows.map((classRecord) => classRecord.name),
      curriculumItemsApplied: 0,
      assignmentsCreated: 0,
      uncoveredSubjects: [],
    };

    if (!input.templateId) return result;

    const curriculumRows = result.createdClassIds.flatMap((classId) =>
      templateItems.map((item) => ({
        institution_id: input.institutionId,
        class_id: classId,
        subject_id: item.subject_id,
        weekly_lessons: item.weekly_lessons,
        lesson_duration_minutes: item.lesson_duration_minutes,
        needs_review: false,
        active: true,
      })),
    );

    const { error: curriculumError } = await supabase
      .from('class_curriculum_items')
      .upsert(curriculumRows, { onConflict: 'class_id,subject_id' });

    if (curriculumError) throw curriculumError;
    result.curriculumItemsApplied = curriculumRows.length;

    if (!input.assignTeachers) return result;

    const teacherBySubject = await listEligibleTeachers(input.institutionId);
    const { data: terms, error: termsError } = await supabase
      .from('terms')
      .select('id')
      .eq('academic_year_id', input.academicYearId)
      .eq('active', true)
      .order('start_date');

    if (termsError) throw termsError;

    const subjectNames = new Map(
      templateItems.map((item) => [
        item.subject_id,
        normalizeRelation(item.subjects)?.name ?? 'Disciplina sem nome',
      ]),
    );

    const missingSubjectIds = templateItems
      .map((item) => item.subject_id)
      .filter((subjectId) => !teacherBySubject.has(subjectId));

    result.uncoveredSubjects = [...new Set(
      missingSubjectIds.map((subjectId) => subjectNames.get(subjectId) ?? subjectId),
    )];

    if (result.uncoveredSubjects.length > 0 || (terms ?? []).length === 0) {
      return result;
    }

    for (const classId of result.createdClassIds) {
      for (const item of templateItems) {
        const teacherProfileId = teacherBySubject.get(item.subject_id);
        if (!teacherProfileId) continue;

        const { data, error } = await supabase.rpc('create_whole_year_assignment', {
          p_institution_id: input.institutionId,
          p_class_id: classId,
          p_subject_id: item.subject_id,
          p_teacher_profile_id: teacherProfileId,
          p_academic_year_id: input.academicYearId,
        });

        if (error) throw error;
        result.assignmentsCreated += Number(data ?? 0);
      }
    }

    return result;
  },

  async createEducationPreset(input: EducationPresetInput): Promise<ClassBatchResult> {
    const definitions = buildEducationPresetClassDefinitions(input.classCounts);
    const result: ClassBatchResult = {
      createdClassIds: [],
      createdClassNames: [],
      curriculumItemsApplied: 0,
      assignmentsCreated: 0,
      uncoveredSubjects: [],
    };

    for (const definition of definitions) {
      if (definition.count === 0) continue;

      const batch = await this.createBatch({
        institutionId: input.institutionId,
        academicYearId: input.academicYearId,
        baseName: definition.grade.baseName,
        count: definition.count,
        gradeLevel: definition.grade.gradeLevel,
        shift: input.shift,
        capacity: input.capacity,
        templateId: input.templateId,
        assignTeachers: input.assignTeachers,
      });

      result.createdClassIds.push(...batch.createdClassIds);
      result.createdClassNames.push(...batch.createdClassNames);
      result.curriculumItemsApplied += batch.curriculumItemsApplied;
      result.assignmentsCreated += batch.assignmentsCreated;
      result.uncoveredSubjects.push(...batch.uncoveredSubjects);
    }

    result.uncoveredSubjects = [...new Set(result.uncoveredSubjects)];
    return result;
  },
};
