import { useQuery } from '@tanstack/react-query';

import {
  adminOverviewService,
  type AdminOverviewData,
} from '../services/adminOverviewService';

export const adminOverviewKeys = {
  all: ['admin-overview'] as const,

  detail: (institutionId: string) =>
    [
      ...adminOverviewKeys.all,
      institutionId,
    ] as const,
};

export function useAdminOverview(
  institutionId: string,
) {
  return useQuery<AdminOverviewData>({
    queryKey:
      adminOverviewKeys.detail(
        institutionId,
      ),

    queryFn: () =>
      adminOverviewService.getOverview(
        institutionId,
      ),

    enabled: Boolean(institutionId),
  });
}
