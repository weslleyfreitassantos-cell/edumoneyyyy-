import { keepPreviousData, useQuery } from '@tanstack/react-query';

import {
  directorPanoramaService,
  type DirectorPanoramaFilters,
  type DirectorPanoramaResult,
} from '../services/directorPanoramaService';

export const directorPanoramaKeys = {
  all: ['director-panorama'] as const,
  detail: (
    institutionId: string | undefined,
    filters: DirectorPanoramaFilters,
  ) => [
    ...directorPanoramaKeys.all,
    institutionId,
    filters.fromDate,
    filters.toDate,
    filters.classId ?? null,
    filters.termId ?? null,
    filters.academicYearId ?? null,
  ] as const,
};

export function useDirectorPanorama(
  institutionId: string | undefined,
  filters: DirectorPanoramaFilters,
) {
  return useQuery<DirectorPanoramaResult>({
    queryKey: directorPanoramaKeys.detail(institutionId, filters),
    queryFn: () => {
      if (!institutionId) {
        throw new Error('Instituição é obrigatória para carregar o panorama acadêmico.');
      }

      return directorPanoramaService.get(institutionId, filters);
    },
    enabled: Boolean(institutionId && filters.fromDate && filters.toDate),
    staleTime: 1000 * 60 * 3,
    placeholderData: keepPreviousData,
    retry: 1,
    retryDelay: (attempt) => Math.min(1000 * (attempt + 1), 2000),
  });
}
