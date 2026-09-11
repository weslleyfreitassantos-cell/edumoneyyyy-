import { useQuery } from '@tanstack/react-query';

import {
  workloadService,
  type SubjectOfferingWorkloadProgress,
} from '../services/workloadService';

export const workloadKeys = {
  all: ['workload'] as const,
  subjectOffering: (
    institutionId: string | undefined,
    subjectOfferingId: string | undefined,
    referenceDate: string | undefined,
  ) =>
    [
      ...workloadKeys.all,
      'subject-offering',
      institutionId,
      subjectOfferingId,
      referenceDate,
    ] as const,
};

export function useSubjectOfferingWorkloadProgress(
  institutionId: string | undefined,
  subjectOfferingId: string | undefined,
  referenceDate: string | undefined,
) {
  return useQuery<SubjectOfferingWorkloadProgress>({
    queryKey: workloadKeys.subjectOffering(
      institutionId,
      subjectOfferingId,
      referenceDate,
    ),
    queryFn: () => {
      if (!institutionId || !subjectOfferingId) {
        throw new Error(
          'Instituição e atribuição são obrigatórias para carregar a carga horária.',
        );
      }

      return workloadService.getSubjectOfferingProgress(
        institutionId,
        subjectOfferingId,
        referenceDate,
      );
    },
    enabled: Boolean(institutionId && subjectOfferingId),
    staleTime: 1000 * 30,
  });
}
