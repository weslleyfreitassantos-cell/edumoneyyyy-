import { supabase } from '../lib/supabaseClient';
import {
  planAdaptivePath,
  type AdaptivePlan,
  type AdaptiveSkillState,
  type CanonicalSkillNode,
  type SkillPrerequisiteEdge,
  type StudentSkillState,
} from './adaptiveLearningEngine';

export interface AdaptiveStudentGuidance extends AdaptivePlan {
  targetSkill: CanonicalSkillNode;
  diagnosticSkill: CanonicalSkillNode | null;
  message: string;
}

export interface TeacherAdaptiveInsight {
  canonicalSkillId: string;
  skillCode: string;
  skillTitle: string;
  state: AdaptiveSkillState;
  studentCount: number;
  diagnosticNeededCount: number;
}

async function read<T>(query: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as T;
}

function guidanceMessage(decision: AdaptivePlan['decision'], target: string, diagnostic: string | null): string {
  if (decision === 'ON_TARGET') return `Continue em ${target}.`;
  if (decision === 'BRIDGE_REINFORCEMENT') {
    return `Reforço recomendado — vamos fortalecer ${diagnostic ?? 'alguns conhecimentos'} para facilitar ${target}.`;
  }
  return diagnostic
    ? `Vamos conferir ${diagnostic} antes de continuar em ${target}.`
    : `Vamos conferir alguns conhecimentos antes de continuar em ${target}.`;
}

export const adaptiveLearningService = {
  async getStudentGuidance(
    institutionId: string,
    studentId: string,
    targetInstitutionSkillId: string,
  ): Promise<AdaptiveStudentGuidance | null> {
    const link = await read<{ canonical_skill_id: string } | null>(
      supabase
        .from('learning_skill_canonical_links')
        .select('canonical_skill_id')
        .eq('institution_id', institutionId)
        .eq('learning_skill_id', targetInstitutionSkillId)
        .eq('active', true)
        .maybeSingle(),
    );
    if (!link) return null;

    const [skillRows, edgeRows, stateRows] = await Promise.all([
      read<CanonicalSkillNode[]>(
        supabase
          .from('learning_curriculum_skills')
          .select('id,code,title,description')
          .eq('active', true),
      ),
      read<Array<{ skill_id: string; prerequisite_skill_id: string }>>(
        supabase
          .from('learning_skill_prerequisites')
          .select('skill_id,prerequisite_skill_id'),
      ),
      read<Array<{
        canonical_skill_id: string;
        state: AdaptiveSkillState;
        mastery_estimate: number;
        evidence_count: number;
        confidence: number;
      }>>(
        supabase
          .from('learning_student_skill_state')
          .select('canonical_skill_id,state,mastery_estimate,evidence_count,confidence')
          .eq('institution_id', institutionId)
          .eq('student_id', studentId),
      ),
    ]);

    const skills = skillRows;
    const edges: SkillPrerequisiteEdge[] = edgeRows.map((edge) => ({
      skillId: edge.skill_id,
      prerequisiteSkillId: edge.prerequisite_skill_id,
    }));
    const states: StudentSkillState[] = stateRows.map((state) => ({
      canonicalSkillId: state.canonical_skill_id,
      state: state.state,
      masteryEstimate: Number(state.mastery_estimate),
      evidenceCount: state.evidence_count,
      confidence: Number(state.confidence),
    }));
    const plan = planAdaptivePath(link.canonical_skill_id, skills, edges, states);
    const targetSkill = skills.find((skill) => skill.id === plan.targetSkillId);
    if (!targetSkill) return null;
    const diagnosticSkill = plan.diagnosticSkillId
      ? skills.find((skill) => skill.id === plan.diagnosticSkillId) ?? null
      : null;

    return {
      ...plan,
      targetSkill,
      diagnosticSkill,
      message: guidanceMessage(
        plan.decision,
        targetSkill.title,
        diagnosticSkill?.title ?? null,
      ),
    };
  },

  teacherInsights: (institutionId: string) =>
    read<TeacherAdaptiveInsight[]>(
      supabase.rpc('get_teacher_adaptive_insights', {
        p_institution_id: institutionId,
      }),
    ),
};
