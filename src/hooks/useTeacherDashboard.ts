import { useQuery } from '@tanstack/react-query';

import {
  teacherDashboardService,
  type TeacherDashboardData,
} from '../services/teacherDashboardService';

export function useTeacherDashboard(
  profileId: string | undefined,
  institutionId: string | undefined,
) {
  return useQuery<TeacherDashboardData>({
    queryKey: [
      'teacher-dashboard',
      profileId,
      institutionId,
    ],

    queryFn: () => {
      if (!profileId) {
        throw new Error(
          'O perfil do professor não foi informado.',
        );
      }

      if (!institutionId) {
        throw new Error(
          'A instituição do professor não foi informada.',
        );
      }

      return teacherDashboardService
        .getDashboard(
          profileId,
          institutionId,
        );
    },

    enabled: Boolean(
      profileId &&
        institutionId,
    ),

    staleTime: 1000 * 60 * 5,
  });
}