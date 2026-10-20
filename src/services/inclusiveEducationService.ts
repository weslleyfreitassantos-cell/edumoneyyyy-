import { supabase } from '../lib/supabaseClient';
import { selectCurrentInclusiveProgressStudentIds } from './inclusiveEducationRoster';

// The foundation migration owns the data boundary; the client never bypasses RLS.
export const INCLUSIVE_EDUCATION_DATA_ENABLED = true;

export type InclusivePeiPlan = {
  id: string;
  institution_id: string;
  student_id: string;
  academic_year_id: string | null;
  class_id: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  review_due_on: string | null;
  strengths: string;
  interests: string;
  learning_barriers: string;
  participation_barriers: string;
  pedagogical_objectives: string;
  teaching_strategies: string;
  accessibility_resources: string;
  planned_activities: string;
  monitoring_criteria: string;
  pedagogical_evaluation: string;
  updated_at: string;
  student?: { profile?: { full_name?: string | null } | null } | null;
};

export type InclusivePeiInput = Pick<InclusivePeiPlan, 'student_id' | 'academic_year_id' | 'class_id' | 'status' | 'review_due_on' | 'strengths' | 'interests' | 'learning_barriers' | 'participation_barriers' | 'pedagogical_objectives' | 'teaching_strategies' | 'accessibility_resources' | 'planned_activities' | 'monitoring_criteria' | 'pedagogical_evaluation'>;

export type InclusiveAeePlan = {
  id: string;
  institution_id: string;
  student_id: string;
  pei_plan_id: string | null;
  academic_year_id: string | null;
  class_id: string | null;
  responsible_profile_id: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  objectives: string;
  resources_used: string;
  pedagogical_observations: string;
  review_due_on: string | null;
  updated_at: string;
  student?: { profile?: { full_name?: string | null } | null } | null;
};

export type InclusiveAeeInput = Pick<InclusiveAeePlan, 'student_id' | 'pei_plan_id' | 'academic_year_id' | 'class_id' | 'responsible_profile_id' | 'status' | 'objectives' | 'resources_used' | 'pedagogical_observations' | 'review_due_on'>;

export type InclusiveAeeAssignment = {
  id: string;
  institution_id: string;
  student_id: string;
  professional_profile_id: string;
  active: boolean;
  created_at: string;
  professional?: { full_name?: string | null } | null;
};

export type InclusiveAeeSession = {
  id: string;
  institution_id: string;
  student_id: string;
  aee_plan_id: string;
  professional_profile_id: string;
  attended_on: string;
  objectives: string;
  resources_used: string;
  observations: string;
  created_at: string;
  professional?: { full_name?: string | null } | null;
};

type PersistedRow = { id?: string } | null;

function assertPersisted(result: { data: PersistedRow; error: unknown }, entity: string): void {
  if (result.error) throw result.error;
  if (!result.data?.id) throw new Error(`${entity}_NOT_PERSISTED`);
}

async function resolveCurrentEnrollment(institutionId: string, studentId: string): Promise<{ academic_year_id: string; class_id: string } | null> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('academic_year_id,class_id,classes!inner(institution_id,active)')
    .eq('student_id', studentId)
    .eq('active', true)
    .in('status', ['active', 'ACTIVE'])
    .eq('classes.institution_id', institutionId)
    .eq('classes.active', true)
    .order('enrolled_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? { academic_year_id: data.academic_year_id, class_id: data.class_id } : null;
}

export async function listInclusivePeiPlans(institutionId: string): Promise<InclusivePeiPlan[]> {
  const { data, error } = await supabase
    .from('inclusive_pei_plans')
    .select('id,institution_id,student_id,academic_year_id,class_id,status,review_due_on,strengths,interests,learning_barriers,participation_barriers,pedagogical_objectives,teaching_strategies,accessibility_resources,planned_activities,monitoring_criteria,pedagogical_evaluation,updated_at,student:students(profile:profiles(full_name))')
    .eq('institution_id', institutionId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InclusivePeiPlan[];
}

export async function saveInclusivePeiPlan(institutionId: string, profileId: string, input: InclusivePeiInput, id?: string): Promise<void> {
  const enrollment = !id && !input.academic_year_id
    ? await resolveCurrentEnrollment(institutionId, input.student_id)
    : null;
  if (!id && !input.academic_year_id && !enrollment) throw new Error('STUDENT_ACTIVE_ENROLLMENT_REQUIRED');
  const payload = {
    institution_id: institutionId,
    updated_by: profileId,
    ...input,
    academic_year_id: input.academic_year_id ?? enrollment?.academic_year_id ?? null,
    class_id: input.class_id ?? enrollment?.class_id ?? null,
  };
  const result = id
    ? await supabase.from('inclusive_pei_plans').update(payload).eq('id', id).eq('institution_id', institutionId).select('id').maybeSingle()
    : await supabase.from('inclusive_pei_plans').insert({ ...payload, created_by: profileId }).select('id').single();
  assertPersisted(result, 'PEI');
}

export async function listInclusiveStudents(institutionId: string): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await supabase
    .from('students')
    .select('id,profile:profiles(full_name)')
    .eq('institution_id', institutionId)
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ id: row.id, name: row.profile?.full_name ?? 'Estudante sem nome' }));
}

export async function registerStudentForInclusiveEducation(
  institutionId: string,
  studentId: string,
): Promise<{ registered: true; created: boolean; plan_id: string }> {
  const { data, error } = await supabase.rpc('register_student_for_inclusive_education', {
    p_institution_id: institutionId,
    p_student_id: studentId,
  });
  if (error) throw error;

  const result = data as { registered?: boolean; created?: boolean; plan_id?: string } | null;
  if (result?.registered !== true || typeof result.plan_id !== 'string') {
    throw new Error('INCLUSIVE_STUDENT_REGISTRATION_NOT_CONFIRMED');
  }
  return { registered: true, created: result.created === true, plan_id: result.plan_id };
}

export async function listInclusiveProgressStudents(institutionId: string): Promise<Array<{ id: string; name: string }>> {
  const { data: yearData, error: yearError } = await supabase
    .from('academic_years')
    .select('id')
    .eq('institution_id', institutionId)
    .eq('active', true);
  if (yearError) throw yearError;

  const currentAcademicYearIds = (yearData ?? []).map((year) => year.id);
  if (currentAcademicYearIds.length === 0) return [];

  const [enrollmentResult, peiResult, aeeResult] = await Promise.all([
    supabase
      .from('enrollments')
      .select('student_id,academic_year_id,students:student_id!inner(institution_id,active),classes:class_id!inner(institution_id,active,academic_year_id)')
      .eq('students.institution_id', institutionId)
      .eq('students.active', true)
      .eq('classes.institution_id', institutionId)
      .eq('classes.active', true)
      .eq('active', true)
      .in('status', ['active', 'ACTIVE'])
      .in('academic_year_id', currentAcademicYearIds),
    supabase
      .from('inclusive_pei_plans')
      .select('student_id,academic_year_id,status')
      .eq('institution_id', institutionId)
      .in('status', ['DRAFT', 'ACTIVE']),
    supabase
      .from('inclusive_aee_plans')
      .select('student_id,academic_year_id,status')
      .eq('institution_id', institutionId)
      .in('status', ['DRAFT', 'ACTIVE']),
  ]);
  if (enrollmentResult.error) throw enrollmentResult.error;
  if (peiResult.error) throw peiResult.error;
  if (aeeResult.error) throw aeeResult.error;

  const planRows = [...(peiResult.data ?? []), ...(aeeResult.data ?? [])];
  const enrollmentRows = (enrollmentResult.data ?? []) as unknown as Array<{
    student_id: string;
    academic_year_id: string;
    classes: { academic_year_id: string } | Array<{ academic_year_id: string }> | null;
  }>;
  const currentEnrollments = enrollmentRows.flatMap((enrollment) => {
    const classRow = Array.isArray(enrollment.classes) ? enrollment.classes[0] : enrollment.classes;
    if (!classRow || classRow.academic_year_id !== enrollment.academic_year_id) return [];
    return [{
      student_id: enrollment.student_id,
      academic_year_id: enrollment.academic_year_id,
      class_academic_year_id: classRow.academic_year_id,
    }];
  });
  const progressStudentIds = selectCurrentInclusiveProgressStudentIds(
    currentAcademicYearIds,
    currentEnrollments,
    planRows,
  );
  if (progressStudentIds.length === 0) return [];

  const { data, error } = await supabase
    .from('students')
    .select('id,profile:profiles(full_name)')
    .eq('institution_id', institutionId)
    .eq('active', true)
    .in('id', progressStudentIds)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ id: row.id, name: row.profile?.full_name ?? 'Estudante sem nome' }));
}

export async function listInclusiveAeePlans(institutionId: string): Promise<InclusiveAeePlan[]> {
  const { data, error } = await supabase
    .from('inclusive_aee_plans')
    .select('id,institution_id,student_id,pei_plan_id,academic_year_id,class_id,responsible_profile_id,status,review_due_on,objectives,resources_used,pedagogical_observations,updated_at,student:students(profile:profiles(full_name))')
    .eq('institution_id', institutionId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InclusiveAeePlan[];
}

export async function saveInclusiveAeePlan(institutionId: string, profileId: string, input: InclusiveAeeInput, id?: string): Promise<void> {
  const enrollment = !id && !input.academic_year_id
    ? await resolveCurrentEnrollment(institutionId, input.student_id)
    : null;
  if (!id && !input.academic_year_id && !enrollment) throw new Error('STUDENT_ACTIVE_ENROLLMENT_REQUIRED');
  const payload = {
    institution_id: institutionId,
    updated_by: profileId,
    ...input,
    academic_year_id: input.academic_year_id ?? enrollment?.academic_year_id ?? null,
    class_id: input.class_id ?? enrollment?.class_id ?? null,
  };
  const result = id
    ? await supabase
        .from('inclusive_aee_plans')
        .update(payload)
        .eq('id', id)
        .eq('institution_id', institutionId)
        .select('id')
        .maybeSingle()
    : await supabase
        .from('inclusive_aee_plans')
        .insert({ ...payload, created_by: profileId })
        .select('id')
        .single();
  assertPersisted(result, 'AEE');
}

export async function listInclusiveAeeAssignments(institutionId: string, studentId?: string): Promise<InclusiveAeeAssignment[]> {
  let query = supabase
    .from('inclusive_aee_assignments')
    .select('id,institution_id,student_id,professional_profile_id,active,created_at,professional:profiles!professional_profile_id(full_name)')
    .eq('institution_id', institutionId)
    .order('created_at', { ascending: false });
  if (studentId) query = query.eq('student_id', studentId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as InclusiveAeeAssignment[];
}

export async function saveInclusiveAeeAssignment(
  institutionId: string,
  profileId: string,
  input: Pick<InclusiveAeeAssignment, 'student_id' | 'professional_profile_id' | 'active'>,
  id?: string,
): Promise<void> {
  const result = id
    ? await supabase.from('inclusive_aee_assignments').update({ active: input.active }).eq('id', id).eq('institution_id', institutionId).select('id').maybeSingle()
    : await supabase.from('inclusive_aee_assignments').insert({ ...input, institution_id: institutionId, created_by: profileId }).select('id').single();
  assertPersisted(result, 'AEE_ASSIGNMENT');
}

export async function listInclusiveAeeSessions(institutionId: string, planId: string): Promise<InclusiveAeeSession[]> {
  const { data, error } = await supabase
    .from('inclusive_aee_sessions')
    .select('id,institution_id,student_id,aee_plan_id,professional_profile_id,attended_on,objectives,resources_used,observations,created_at,professional:profiles!professional_profile_id(full_name)')
    .eq('institution_id', institutionId)
    .eq('aee_plan_id', planId)
    .order('attended_on', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InclusiveAeeSession[];
}

export async function saveInclusiveAeeSession(
  institutionId: string,
  profileId: string,
  input: Omit<InclusiveAeeSession, 'id' | 'institution_id' | 'created_at' | 'professional'>,
): Promise<void> {
  const result = await supabase
    .from('inclusive_aee_sessions')
    .insert({ ...input, institution_id: institutionId, created_by: profileId })
    .select('id')
    .single();
  assertPersisted(result, 'AEE_SESSION');
}

export function printInclusiveDocument(title: string): void {
  const previousTitle = document.title;
  document.title = title;
  document.body.dataset.printTarget = 'inclusive';
  const restore = () => {
    delete document.body.dataset.printTarget;
    document.title = previousTitle;
  };
  window.addEventListener('afterprint', restore, { once: true });
  window.print();
}
