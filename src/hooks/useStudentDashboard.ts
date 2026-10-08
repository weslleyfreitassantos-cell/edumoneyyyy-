import { useQuery } from '@tanstack/react-query';

import {
  studentDashboardService,
  type StudentDashboardData,
} from '../services/studentDashboardService';

export const STUDENT_DASHBOARD_STALE_TIME = 1000 * 60 * 5;

export const studentDashboardKeys = {
  detail: (profileId: string, institutionId: string) =>
    ['student-dashboard', profileId, institutionId] as const,
};

export function useStudentDashboard(
  profileId: string | undefined,
  institutionId: string | undefined,
) {
  return useQuery<StudentDashboardData>({
    queryKey: studentDashboardKeys.detail(
      profileId ?? '',
      institutionId ?? '',
    ),

    queryFn: () => {
      if (!profileId) {
        throw new Error(
          'O perfil do aluno não foi informado.',
        );
      }

      if (!institutionId) {
        throw new Error(
          'A instituição do aluno não foi informada.',
        );
      }

      return studentDashboardService
        .getDashboard(
          profileId,
          institutionId,
        );
    },

    enabled: Boolean(
      profileId && institutionId,
    ),

    staleTime: STUDENT_DASHBOARD_STALE_TIME,
  });
}
