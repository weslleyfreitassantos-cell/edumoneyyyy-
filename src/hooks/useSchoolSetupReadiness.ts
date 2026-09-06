import { useQuery, type QueryClient } from '@tanstack/react-query';

import {
  schoolSetupService,
  type SchoolSetupReadiness,
} from '../services/schoolSetupService';

export const schoolSetupKeys = {
  all: ['school-setup-readiness'] as const,
  detail: (institutionId: string) =>
    [...schoolSetupKeys.all, institutionId] as const,
};

export function invalidateSchoolSetupReadiness(
  queryClient: QueryClient,
  institutionId: string | null | undefined,
) {
  if (!institutionId) return Promise.resolve();
  return queryClient.invalidateQueries({
    queryKey: schoolSetupKeys.detail(institutionId),
  });
}

export function useSchoolSetupReadiness(
  institutionId: string,
) {
  return useQuery<SchoolSetupReadiness>({
    queryKey: schoolSetupKeys.detail(institutionId),
    queryFn: () => schoolSetupService.getReadiness(institutionId),
    enabled: Boolean(institutionId),
  });
}
