import { supabase } from '../lib/supabaseClient';
import {
  planAdaptivePath,
  type AdaptivePlan,
  type AdaptiveSkillState,
  type CanonicalSkillNode,
  type SkillPrerequisiteEdge,
  type StudentSkillState,
} from './adaptiveLearningEngine';
import {
  resolveAdaptiveCurriculumTargets,
  type AdaptiveCurriculumCandidate,
  type AdaptiveCurriculumTarget,
  type CurriculumGradeTarget,
} from './adaptiveCurriculumResolver';

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

export interface TeacherGuidedInsightV2 {
  sessionId: string;
  studentId: string;
  studentName: string;
  classId: string | null;
  subjectId: string | null;
  targetCanonicalSkillId: string;
  status: string;
  decisionReason: string | null;
  replanCount: number;
  misconceptionSummary: Record<string, number>;
}

interface RawTeacherAdaptiveInsight {
  canonical_skill_id: string;
  skill_code: string;
  skill_title: string;
  state: AdaptiveSkillState;
  student_count: number;
  diagnostic_needed_count: number;
}

interface RawTeacherGuidedInsightV2 {
  session_id: string;
  student_id: string;
  student_name: string;
  class_id: string | null;
  subject_id: string | null;
  target_canonical_skill_id: string;
  status: string;
  decision_reason: string | null;
  replan_count: number;
  misconception_summary: Record<string, number>;
}

interface EnrollmentClassRow {
  id: string;
  institution_id: string;
  grade_level: string | null;
  active: boolean;
}

interface EnrollmentContextRow {
  class_id: string;
  classes: EnrollmentClassRow | EnrollmentClassRow[] | null;
}

interface CurriculumSubjectLinkRow {
  subject_id: string;
  subject_area: string;
}

interface LearningSkillSubjectRow {
  id: string;
  unit_id: string;
  learning_units: { subject_id: string } | { subject_id: string }[] | null;
}

interface CanonicalLinkRow {
  learning_skill_id: string;
  canonical_skill_id: string;
}

interface SubjectOfferingRow {
  class_id: string;
  subject_id: string;
}

interface CurriculumGradeTargetRow {
  canonical_skill_id: string;
  stage: string;
  grade_level: number;
  subject_area: string;
  priority: number;
  sort_order: number;
}

async function read<T>(query: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
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
  async getStudentAdaptiveTargets(
    institutionId: string,
    studentId: string,
  ): Promise<AdaptiveCurriculumTarget[]> {
    const enrollmentRows = await read<EnrollmentContextRow[]>(
      supabase
        .from('enrollments')
        .select('class_id,classes:class_id(id,institution_id,grade_level,active)')
        .eq('student_id', studentId)
        .eq('active', true)
        .eq('status', 'active'),
    );
    const classes = enrollmentRows
      .map((row) => one(row.classes))
      .filter((classRow): classRow is EnrollmentClassRow => Boolean(classRow))
      .filter((classRow) => classRow.institution_id === institutionId && classRow.active);
    const classIds = [...new Set(classes.map((classRow) => classRow.id))];
    if (!classIds.length) return [];

    const offerings = await read<SubjectOfferingRow[]>(
      supabase
        .from('subject_offerings')
        .select('class_id,subject_id')
        .in('class_id', classIds)
        .eq('active', true),
    );
    const subjectIds = [...new Set(offerings.map((offering) => offering.subject_id))];
    if (!subjectIds.length) return [];

    const [subjectLinks, skillRows, targetRows] = await Promise.all([
      read<CurriculumSubjectLinkRow[]>(
        supabase
          .from('learning_curriculum_subject_links')
          .select('subject_id,subject_area')
          .eq('institution_id', institutionId)
          .in('subject_id', subjectIds)
          .eq('active', true),
      ),
      read<LearningSkillSubjectRow[]>(
        supabase
          .from('learning_skills')
          .select('id,unit_id,learning_units:unit_id(subject_id)')
          .eq('institution_id', institutionId)
          .eq('active', true),
      ),
      read<CurriculumGradeTargetRow[]>(
        supabase
          .from('learning_curriculum_grade_targets')
          .select('canonical_skill_id,stage,grade_level,subject_area,priority,sort_order')
          .eq('active', true),
      ),
    ]);
    const skillIds = skillRows.map((skill) => skill.id);
    if (!skillIds.length) return [];

    const canonicalLinks = await read<CanonicalLinkRow[]>(
      supabase
        .from('learning_skill_canonical_links')
        .select('learning_skill_id,canonical_skill_id')
        .eq('institution_id', institutionId)
        .in('learning_skill_id', skillIds)
        .eq('active', true),
    );
    const subjectAreaById = new Map(subjectLinks.map((link) => [link.subject_id, link.subject_area]));
    const canonicalBySkill = new Map(canonicalLinks.map((link) => [link.learning_skill_id, link.canonical_skill_id]));
    const targetsByCanonical = new Map<string, CurriculumGradeTarget[]>();
    for (const row of targetRows) {
      const current = targetsByCanonical.get(row.canonical_skill_id) ?? [];
      current.push({
        canonicalSkillId: row.canonical_skill_id,
        stage: row.stage,
        gradeLevel: row.grade_level,
        subjectArea: row.subject_area,
        priority: row.priority,
        sortOrder: row.sort_order,
      });
      targetsByCanonical.set(row.canonical_skill_id, current);
    }

    const candidates: AdaptiveCurriculumCandidate[] = [];
    for (const classRow of classes) {
      for (const offering of offerings.filter((item) => item.class_id === classRow.id)) {
        const subjectArea = subjectAreaById.get(offering.subject_id);
        if (!subjectArea) continue;

        for (const skill of skillRows) {
          const unit = one(skill.learning_units);
          if (unit?.subject_id !== offering.subject_id) continue;
          const canonicalSkillId = canonicalBySkill.get(skill.id);
          if (!canonicalSkillId) continue;

          for (const target of targetsByCanonical.get(canonicalSkillId) ?? []) {
            candidates.push({
              classId: classRow.id,
              gradeLevel: classRow.grade_level,
              institutionSkillId: skill.id,
              canonicalSkillId,
              subjectArea,
              target,
            });
          }
        }
      }
    }

    return resolveAdaptiveCurriculumTargets(candidates);
  },

  async getStudentAdaptiveTarget(
    institutionId: string,
    studentId: string,
  ): Promise<AdaptiveCurriculumTarget | null> {
    const targets = await this.getStudentAdaptiveTargets(institutionId, studentId);
    return targets[0] ?? null;
  },

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
        valid_evidence_count: number;
        distinct_run_count: number;
        weighted_mastery: number;
        strong_evidence_count: number;
        mastery_policy_version: string;
      }>>(
        supabase
          .from('learning_student_skill_state')
          .select('canonical_skill_id,state,mastery_estimate,evidence_count,confidence,valid_evidence_count,distinct_run_count,weighted_mastery,strong_evidence_count,mastery_policy_version')
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
      validEvidenceCount: state.valid_evidence_count,
      distinctRunCount: state.distinct_run_count,
      weightedMastery: Number(state.weighted_mastery),
      strongEvidenceCount: state.strong_evidence_count,
      masteryPolicyVersion: state.mastery_policy_version,
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

  teacherInsights: async (institutionId: string): Promise<TeacherAdaptiveInsight[]> => {
    const rows = await read<RawTeacherAdaptiveInsight[]>(
      supabase.rpc('get_teacher_adaptive_insights', {
        p_institution_id: institutionId,
      }),
    );

    return rows.map((row) => ({
      canonicalSkillId: row.canonical_skill_id,
      skillCode: row.skill_code,
      skillTitle: row.skill_title,
      state: row.state,
      studentCount: Number(row.student_count),
      diagnosticNeededCount: Number(row.diagnostic_needed_count),
    }));
  },

  teacherGuidedInsightsV2: async (institutionId: string): Promise<TeacherGuidedInsightV2[]> => {
    const rows = await read<RawTeacherGuidedInsightV2[]>(
      supabase.rpc('get_teacher_guided_learning_insights_v2', { p_institution_id: institutionId }),
    );
    return rows.map((row) => ({
      sessionId: row.session_id,
      studentId: row.student_id,
      studentName: row.student_name,
      classId: row.class_id,
      subjectId: row.subject_id,
      targetCanonicalSkillId: row.target_canonical_skill_id,
      status: row.status,
      decisionReason: row.decision_reason,
      replanCount: Number(row.replan_count),
      misconceptionSummary: row.misconception_summary ?? {},
    }));
  },

  resolveTeacherGuidedSessionV2: (input: { sessionId: string; action: 'RESUME' | 'CLOSE' | 'OVERRIDE_TARGET'; targetCanonicalSkillId?: string | null }) =>
    read<{ session_id: string; action: string; current_step_id: string | null }>(
      supabase.rpc('resolve_teacher_guided_learning_session_v2', {
        p_session_id: input.sessionId,
        p_action: input.action,
        p_target_canonical_skill_id: input.targetCanonicalSkillId ?? null,
      }),
    ),
};
