import { supabase } from '../lib/supabaseClient';
import {
  planAutomaticAssignments,
  type AutomaticAssignmentPlan,
} from '../lib/academic/timetableGenerator/automaticPreparation';

export interface AssignmentAutomationCandidate extends AutomaticAssignmentPlan {
  weeklyLessons: number;
}

export interface AssignmentAutomationMissing {
  classId: string;
  subjectId: string;
}

export interface AssignmentAutomationPreview {
  academicYearId: string;
  activeTermCount: number;
  coveredCount: number;
  candidates: AssignmentAutomationCandidate[];
  unassigned: AssignmentAutomationMissing[];
}

export interface AssignmentAutomationResult {
  created: number;
  candidates: number;
  unassigned: number;
}

interface AssignmentPreparationData {
  academicYearId: string;
  termIds: string[];
  classes: Array<{
    id: string;
    institution_id: string;
    academic_year_id: string;
    name: string;
    shift: string | null;
  }>;
  curriculumItems: Array<{
    class_id: string;
    subject_id: string;
    weekly_lessons: number;
    lesson_duration_minutes: number;
  }>;
  offerings: Array<{
    id: string;
    class_id: string;
    subject_id: string;
    teacher_profile_id: string;
    term_id: string;
  }>;
  teacherSubjects: Array<{
    institution_id: string;
    teacher_profile_id: string;
    subject_id: string;
    active: boolean;
  }>;
}

function throwQueryError(result: { error: unknown }, context: string): void {
  if (result.error) {
    throw new Error(`${context}: ${String((result.error as { message?: unknown }).message ?? 'erro de consulta')}`);
  }
}

async function listActiveOfferings(institutionId: string) {
  const { data, error } = await supabase
    .from('subject_offerings')
    .select('id, class_id, subject_id, teacher_profile_id, term_id, classes!inner(institution_id)')
    .eq('classes.institution_id', institutionId)
    .eq('active', true);

  throwQueryError({ error }, 'Não foi possível carregar as atribuições atuais');
  return (data ?? []) as AssignmentPreparationData['offerings'];
}

async function loadPreparationData(
  institutionId: string,
  academicYearId: string,
): Promise<AssignmentPreparationData> {
  const [termsResult, classesResult, curriculumResult, offerings, skillsResult] = await Promise.all([
    supabase
      .from('terms')
      .select('id')
      .eq('academic_year_id', academicYearId)
      .eq('active', true),
    supabase
      .from('classes')
      .select('id, institution_id, academic_year_id, name, shift')
      .eq('institution_id', institutionId)
      .eq('academic_year_id', academicYearId)
      .eq('active', true),
    supabase
      .from('class_curriculum_items')
      .select('class_id, subject_id, weekly_lessons, lesson_duration_minutes')
      .eq('institution_id', institutionId)
      .eq('active', true),
    listActiveOfferings(institutionId),
    supabase
      .from('teacher_subjects')
      .select('institution_id, teacher_profile_id, subject_id, active')
      .eq('institution_id', institutionId)
      .eq('active', true),
  ]);

  throwQueryError(termsResult, 'Não foi possível carregar os períodos ativos');
  throwQueryError(classesResult, 'Não foi possível carregar as turmas');
  throwQueryError(curriculumResult, 'Não foi possível carregar a matriz curricular');
  throwQueryError(skillsResult, 'Não foi possível carregar as habilitações');

  const classIds = new Set((classesResult.data ?? []).map((item) => String(item.id)));

  return {
    academicYearId,
    termIds: (termsResult.data ?? []).map((item) => String(item.id)),
    classes: (classesResult.data ?? []).map((item) => ({
      id: String(item.id),
      institution_id: String(item.institution_id),
      academic_year_id: String(item.academic_year_id),
      name: String(item.name),
      shift: item.shift == null ? null : String(item.shift),
    })),
    curriculumItems: (curriculumResult.data ?? [])
      .filter((item) => classIds.has(String(item.class_id)))
      .map((item) => ({
        class_id: String(item.class_id),
        subject_id: String(item.subject_id),
        weekly_lessons: Number(item.weekly_lessons ?? 0),
        lesson_duration_minutes: Number(item.lesson_duration_minutes ?? 0),
      })),
    offerings: offerings.map((item) => ({
      id: String(item.id),
      class_id: String(item.class_id),
      subject_id: String(item.subject_id),
      teacher_profile_id: String(item.teacher_profile_id),
      term_id: String(item.term_id),
    })),
    teacherSubjects: (skillsResult.data ?? []).map((item) => ({
      institution_id: String(item.institution_id),
      teacher_profile_id: String(item.teacher_profile_id),
      subject_id: String(item.subject_id),
      active: item.active === true,
    })),
  };
}

function buildPlan(data: AssignmentPreparationData) {
  return planAutomaticAssignments({
    classes: data.classes.map((item) => ({
      id: item.id,
      institutionId: item.institution_id,
      academicYearId: item.academic_year_id,
      name: item.name,
      shift: item.shift,
    })),
    curriculumItems: data.curriculumItems.map((item) => ({
      classId: item.class_id,
      subjectId: item.subject_id,
      weeklyLessons: item.weekly_lessons,
      lessonDurationMinutes: item.lesson_duration_minutes,
    })),
    subjectOfferings: data.offerings.map((item) => ({
      id: item.id,
      institutionId: data.classes[0]?.institution_id ?? '',
      classId: item.class_id,
      subjectId: item.subject_id,
      teacherProfileId: item.teacher_profile_id,
      termId: item.term_id,
    })),
    teacherSubjects: data.teacherSubjects.map((item) => ({
      institutionId: item.institution_id,
      teacherProfileId: item.teacher_profile_id,
      subjectId: item.subject_id,
      active: item.active,
    })),
    termIds: data.termIds,
  });
}

export const assignmentAutomationService = {
  async preview(input: { institutionId: string; academicYearId: string }): Promise<AssignmentAutomationPreview> {
    const data = await loadPreparationData(input.institutionId, input.academicYearId);
    const plan = buildPlan(data);
    const plannedKeys = new Set(plan.assignments.map((item) => `${item.classId}:${item.subjectId}`));
    const missingKeys = new Set(plan.unassigned.map((item) => `${item.classId}:${item.subjectId}`));
    const coveredCount = data.curriculumItems.filter((item) => {
      if (item.weekly_lessons <= 0) return false;
      const key = `${item.class_id}:${item.subject_id}`;
      return !plannedKeys.has(key) && !missingKeys.has(key);
    }).length;

    return {
      academicYearId: input.academicYearId,
      activeTermCount: data.termIds.length,
      coveredCount,
      candidates: plan.assignments.map((item) => ({
        ...item,
        weeklyLessons: data.curriculumItems.find(
          (curriculum) => curriculum.class_id === item.classId && curriculum.subject_id === item.subjectId,
        )?.weekly_lessons ?? 0,
      })),
      unassigned: plan.unassigned,
    };
  },

  async apply(input: { institutionId: string; academicYearId: string }): Promise<AssignmentAutomationResult> {
    const data = await loadPreparationData(input.institutionId, input.academicYearId);
    const plan = buildPlan(data);
    let created = 0;

    for (const assignment of plan.assignments) {
      const { data: result, error } = await supabase.rpc('create_whole_year_assignment', {
        p_institution_id: input.institutionId,
        p_class_id: assignment.classId,
        p_subject_id: assignment.subjectId,
        p_teacher_profile_id: assignment.teacherProfileId,
        p_academic_year_id: input.academicYearId,
      });
      if (error) throw error;
      created += Number(result ?? 0);
    }

    return {
      created,
      candidates: plan.assignments.length,
      unassigned: plan.unassigned.length,
    };
  },
};
