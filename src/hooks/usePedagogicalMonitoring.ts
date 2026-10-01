import { useQuery } from '@tanstack/react-query';

import {
  pedagogicalMonitoringService,
  type PedagogicalMonitoringFilters,
  type PedagogicalMonitoringData,
} from '../services/pedagogicalMonitoringService';

export const pedagogicalMonitoringKeys = {
  all: ['pedagogical-monitoring'] as const,
  institution: (
    institutionId: string | undefined,
    filters: PedagogicalMonitoringFilters,
  ) => [
    ...pedagogicalMonitoringKeys.all,
    institutionId,
    filters,
  ] as const,
};

export function usePedagogicalMonitoring(
  institutionId: string | undefined,
  filters: PedagogicalMonitoringFilters,
) {
  return useQuery<PedagogicalMonitoringData>({
    queryKey: pedagogicalMonitoringKeys.institution(
      institutionId,
      filters,
    ),
    queryFn: () => {
      if (!institutionId) {
        throw new Error(
          'Instituição obrigatória para o acompanhamento pedagógico.',
        );
      }

      return pedagogicalMonitoringService.getInstitutionMonitoring(
        institutionId,
        filters,
      );
    },
    enabled: Boolean(institutionId),
    staleTime: 1000 * 60,
  });
}
