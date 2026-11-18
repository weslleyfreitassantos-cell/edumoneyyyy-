import { supabase } from '../lib/supabaseClient';

// Production remains read-safe until the foundation migration is validated.
export const INCLUSIVE_EDUCATION_DATA_ENABLED = false;

export type InclusivePeiPlan = {
  id: string;
  institution_id: string;
  student_id: string;
  academic_year_id: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  review_due_on: string | null;
  strengths: string;
  interests: string;
  learning_barriers: string;
  pedagogical_objectives: string;
  teaching_strategies: string;
  accessibility_resources: string;
  monitoring_criteria: string;
  updated_at: string;
  student?: { profile?: { full_name?: string | null } | null } | null;
};

export type InclusivePeiInput = Pick<InclusivePeiPlan, 'student_id' | 'academic_year_id' | 'status' | 'review_due_on' | 'strengths' | 'interests' | 'learning_barriers' | 'pedagogical_objectives' | 'teaching_strategies' | 'accessibility_resources' | 'monitoring_criteria'>;

export async function listInclusivePeiPlans(institutionId: string): Promise<InclusivePeiPlan[]> {
  const { data, error } = await supabase
    .from('inclusive_pei_plans')
    .select('id,institution_id,student_id,academic_year_id,status,review_due_on,strengths,interests,learning_barriers,pedagogical_objectives,teaching_strategies,accessibility_resources,monitoring_criteria,updated_at,student:students(profile:profiles(full_name))')
    .eq('institution_id', institutionId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InclusivePeiPlan[];
}

export async function saveInclusivePeiPlan(institutionId: string, profileId: string, input: InclusivePeiInput, id?: string): Promise<void> {
  const payload = { institution_id: institutionId, updated_by: profileId, ...input };
  const result = id
    ? await supabase.from('inclusive_pei_plans').update(payload).eq('id', id).eq('institution_id', institutionId)
    : await supabase.from('inclusive_pei_plans').insert({ ...payload, created_by: profileId });
  if (result.error) throw result.error;
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

export async function listInclusiveAeePlans(institutionId: string) {
  const { data, error } = await supabase
    .from('inclusive_aee_plans')
    .select('id,student_id,status,review_due_on,objectives,resources_used,pedagogical_observations,updated_at,student:students(profile:profiles(full_name))')
    .eq('institution_id', institutionId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function printInclusiveDocument(title: string): void {
  document.title = title;
  window.print();
}
