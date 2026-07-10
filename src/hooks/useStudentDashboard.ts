import { useQuery } from '@tanstack/react-query';

import {
  studentDashboardService,
  type StudentDashboardData,
} from '../services/studentDashboardService';

export function useStudentDashboard(
  profileId: string | undefined,
  institutionId: string | undefined,
) {
  return useQuery<StudentDashboardData>({
    queryKey: [
      'student-dashboard',
      profileId,
      institutionId,
    ],

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

    staleTime: 1000 * 60 * 5,
  });
}
