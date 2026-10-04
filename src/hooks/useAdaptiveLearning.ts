import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adaptiveLearningService } from '../services/adaptiveLearningService';

export const adaptiveLearningKeys = {
  all: ['adaptive-learning'] as const,
  studentTarget: (institutionId: string, studentId: string) => [
    ...adaptiveLearningKeys.all,
    'student-target',
    institutionId,
    studentId,
  ] as const,
  studentGuidance: (institutionId: string, studentId: string, targetSkillId: string) => [
    ...adaptiveLearningKeys.all,
    'student-guidance',
    institutionId,
    studentId,
    targetSkillId,
  ] as const,
  teacherInsights: (institutionId: string) => [
    ...adaptiveLearningKeys.all,
    'teacher-insights',
    institutionId,
  ] as const,
  teacherGuidedInsightsV2: (institutionId: string) => [
    ...adaptiveLearningKeys.all,
    'teacher-guided-insights-v2',
    institutionId,
  ] as const,
  teacherStudentKnowledgeGraph: (institutionId: string, studentId: string, classId: string, subjectId: string) => [
    ...adaptiveLearningKeys.all,
    'teacher-student-knowledge-graph-v3',
    institutionId,
    studentId,
    classId,
    subjectId,
  ] as const,
  teacherClassHeatmap: (institutionId: string, classId: string, subjectId: string) => [
    ...adaptiveLearningKeys.all,
    'teacher-class-knowledge-heatmap-v3',
    institutionId,
    classId,
    subjectId,
  ] as const,
  studentV3Plan: (institutionId: string, studentId: string, targetSkillId: string) => [
    ...adaptiveLearningKeys.all,
    'student-v3-plan',
    institutionId,
    studentId,
    targetSkillId,
  ] as const,
};

export function useStudentAdaptiveTarget(
  institutionId?: string,
  studentId?: string,
) {
  return useQuery({
    queryKey: adaptiveLearningKeys.studentTarget(
      institutionId ?? '',
      studentId ?? '',
    ),
    queryFn: async () => {
      try {
        return await adaptiveLearningService.getStudentAdaptiveTarget(
          institutionId!,
          studentId!,
        );
      } catch {
        // Missing adaptive configuration must preserve the legacy study center.
        return null;
      }
    },
    enabled: Boolean(institutionId && studentId),
    staleTime: 60_000,
    retry: false,
  });
}

export function useStudentAdaptiveGuidance(
  institutionId?: string,
  studentId?: string,
  targetSkillId?: string,
) {
  return useQuery({
    queryKey: adaptiveLearningKeys.studentGuidance(
      institutionId ?? '',
      studentId ?? '',
      targetSkillId ?? '',
    ),
    queryFn: async () => {
      try {
        return await adaptiveLearningService.getStudentGuidance(
          institutionId!,
          studentId!,
          targetSkillId!,
        );
      } catch {
        // Adaptive guidance is additive.  Legacy study content remains usable
        // when an older database has not received this migration yet.
        return null;
      }
    },
    enabled: Boolean(institutionId && studentId && targetSkillId),
    staleTime: 60_000,
    retry: false,
  });
}

export function useTeacherAdaptiveInsights(institutionId?: string) {
  return useQuery({
    queryKey: adaptiveLearningKeys.teacherInsights(institutionId ?? ''),
    queryFn: async () => {
      try {
        return await adaptiveLearningService.teacherInsights(institutionId!);
      } catch {
        return [];
      }
    },
    enabled: Boolean(institutionId),
    staleTime: 60_000,
    retry: false,
  });
}

export function useTeacherGuidedInsightsV2(institutionId?: string) {
  return useQuery({
    queryKey: adaptiveLearningKeys.teacherGuidedInsightsV2(institutionId ?? ''),
    queryFn: async () => {
      try {
        return await adaptiveLearningService.teacherGuidedInsightsV2(institutionId!);
      } catch {
        return [];
      }
    },
    enabled: Boolean(institutionId),
    staleTime: 30_000,
    retry: false,
  });
}

export function useTeacherStudentKnowledgeGraph(institutionId?: string, studentId?: string, classId?: string, subjectId?: string) {
  return useQuery({
    queryKey: adaptiveLearningKeys.teacherStudentKnowledgeGraph(institutionId ?? '', studentId ?? '', classId ?? '', subjectId ?? ''),
    queryFn: async () => {
      try {
        return await adaptiveLearningService.teacherStudentKnowledgeGraph(institutionId!, studentId!, classId!, subjectId!);
      } catch {
        return [];
      }
    },
    enabled: Boolean(institutionId && studentId && classId && subjectId),
    staleTime: 60_000,
    retry: false,
  });
}

export function useTeacherClassKnowledgeHeatmap(institutionId?: string, classId?: string, subjectId?: string) {
  return useQuery({
    queryKey: adaptiveLearningKeys.teacherClassHeatmap(institutionId ?? '', classId ?? '', subjectId ?? ''),
    queryFn: async () => {
      try {
        return await adaptiveLearningService.teacherClassKnowledgeHeatmap(institutionId!, classId!, subjectId!);
      } catch {
        return [];
      }
    },
    enabled: Boolean(institutionId && classId && subjectId),
    staleTime: 60_000,
    retry: false,
  });
}

export function useStudentAdaptiveV3Plan(
  institutionId?: string,
  studentId?: string,
  targetSkillId?: string,
) {
  return useQuery({
    queryKey: adaptiveLearningKeys.studentV3Plan(institutionId ?? '', studentId ?? '', targetSkillId ?? ''),
    queryFn: async () => {
      try {
        return await adaptiveLearningService.studentV3Plan(institutionId!, studentId!, targetSkillId!);
      } catch {
        return null;
      }
    },
    enabled: Boolean(institutionId && studentId && targetSkillId),
    staleTime: 60_000,
    retry: false,
  });
}

export function useResolveTeacherGuidedSessionV2(institutionId?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { sessionId: string; action: 'RESUME' | 'CLOSE' | 'OVERRIDE_TARGET'; targetCanonicalSkillId?: string | null }) => adaptiveLearningService.resolveTeacherGuidedSessionV2(input),
    onSuccess: () => {
      if (institutionId) void client.invalidateQueries({ queryKey: adaptiveLearningKeys.teacherGuidedInsightsV2(institutionId) });
    },
  });
}
