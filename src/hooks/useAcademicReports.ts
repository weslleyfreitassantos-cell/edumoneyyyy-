import { useQuery } from '@tanstack/react-query';

import {
  academicReportService,
  type AcademicReportOptions,
} from '../services/academicReportService';

export const academicReportKeys = {
  all: ['academic-reports'] as const,
  options: (institutionId: string | undefined) => [
    ...academicReportKeys.all,
    'options',
    institutionId,
  ] as const,
};

export function useAcademicReportOptions(
  institutionId: string | undefined,
) {
  return useQuery<AcademicReportOptions>({
    queryKey: academicReportKeys.options(institutionId),
    queryFn: () => {
      if (!institutionId) {
        throw new Error('Instituição obrigatória para os relatórios acadêmicos.');
      }

      return academicReportService.getOptions(institutionId);
    },
    enabled: Boolean(institutionId),
    staleTime: 1000 * 60 * 5,
  });
}
