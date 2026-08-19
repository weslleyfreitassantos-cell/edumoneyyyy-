import { useQuery } from '@tanstack/react-query';

import {
  schoolSetupService,
  type SchoolSetupReadiness,
} from '../services/schoolSetupService';

export const schoolSetupKeys = {
  all: ['school-setup-readiness'] as const,
  detail: (institutionId: string) =>
    [...schoolSetupKeys.all, institutionId] as const,
};

export function useSchoolSetupReadiness(
  institutionId: string,
) {
  return useQuery<SchoolSetupReadiness>({
    queryKey: schoolSetupKeys.detail(institutionId),
    queryFn: () => schoolSetupService.getReadiness(institutionId),
    enabled: Boolean(institutionId),
  });
}
