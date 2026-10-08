import { useQuery } from '@tanstack/react-query';

import {
  studentDashboardService,
  type StudentAcademicContext,
} from '../services/studentDashboardService';

export const STUDENT_ACADEMIC_CONTEXT_STALE_TIME = 1000 * 60 * 5;

export const studentAcademicContextKeys = {
  detail: (profileId: string, institutionId: string) =>
    ['student-academic-context', profileId, institutionId] as const,
};

export function useStudentAcademicContext(
  profileId: string | undefined,
  institutionId: string | undefined,
) {
  return useQuery<StudentAcademicContext>({
    queryKey: studentAcademicContextKeys.detail(
      profileId ?? '',
      institutionId ?? '',
    ),
    queryFn: () => {
      if (!profileId) {
        throw new Error('O perfil do aluno não foi informado.');
      }

      if (!institutionId) {
        throw new Error('A instituição do aluno não foi informada.');
      }

      return studentDashboardService.getAcademicContext(
        profileId,
        institutionId,
      );
    },
    enabled: Boolean(profileId && institutionId),
    staleTime: STUDENT_ACADEMIC_CONTEXT_STALE_TIME,
  });
}
