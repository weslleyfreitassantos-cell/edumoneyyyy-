import { useQuery } from '@tanstack/react-query';

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
