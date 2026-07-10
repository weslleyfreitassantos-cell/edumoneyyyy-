import { useQuery } from '@tanstack/react-query';

import {
  guardianDashboardService,
  type GuardianDashboardData,
} from '../services/guardianDashboardService';

export function useGuardianDashboard(
  profileId: string | undefined,
  institutionId: string | undefined,
) {
  return useQuery<GuardianDashboardData>({
    queryKey: [
      'guardian-dashboard',
      profileId,
      institutionId,
    ],

    queryFn: () => {
      if (!profileId) {
        throw new Error(
          'O perfil do responsável não foi informado.',
        );
      }

      if (!institutionId) {
        throw new Error(
          'A instituição do responsável não foi informada.',
        );
      }

      return guardianDashboardService
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
