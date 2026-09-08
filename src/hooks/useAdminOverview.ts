import { useQuery } from '@tanstack/react-query';

import {
  adminOverviewService,
  type AdminOverviewData,
} from '../services/adminOverviewService';

export const ADMIN_OVERVIEW_STALE_TIME = 30_000;

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
    staleTime: ADMIN_OVERVIEW_STALE_TIME,
    // Keep the previous metrics visible while a refreshed institution query runs.
    placeholderData: (previous) => previous,
  });
}
