import { useQuery } from '@tanstack/react-query';

import { adaptiveLearningService } from '../services/adaptiveLearningService';

export const adaptiveLearningKeys = {
  all: ['adaptive-learning'] as const,
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
