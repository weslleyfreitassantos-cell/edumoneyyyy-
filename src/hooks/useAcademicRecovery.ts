import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  academicRecoveryService,
  type AcademicRecoveryCandidate,
  type SaveAcademicRecoveryInput,
} from '../services/academicRecoveryService';

export const academicRecoveryKeys = {
  all: ['academic-recovery'] as const,
  candidates: (
    institutionId: string | undefined,
    subjectOfferingId: string | undefined,
  ) => [...academicRecoveryKeys.all, 'candidates', institutionId, subjectOfferingId] as const,
};

export function useAcademicRecoveryCandidates(
  institutionId: string | undefined,
  subjectOfferingId: string | undefined,
) {
  return useQuery<AcademicRecoveryCandidate[]>({
    queryKey: academicRecoveryKeys.candidates(institutionId, subjectOfferingId),
    queryFn: () => {
      if (!institutionId || !subjectOfferingId) {
        throw new Error('Instituição e oferta são obrigatórias para carregar a recuperação.');
      }

      return academicRecoveryService.listCandidates(institutionId, subjectOfferingId);
    },
    enabled: Boolean(institutionId && subjectOfferingId),
    staleTime: 1000 * 30,
  });
}

export function useSaveAcademicRecovery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveAcademicRecoveryInput) =>
      academicRecoveryService.save(input),
    onSuccess: async (_result, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: academicRecoveryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['academic-closing'] }),
        queryClient.invalidateQueries({ queryKey: ['report-card', input.institutionId] }),
      ]);
    },
  });
}

export function useCancelAcademicRecovery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { institutionId: string; recoveryId: string }) =>
      academicRecoveryService.cancel(input.institutionId, input.recoveryId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: academicRecoveryKeys.all });
    },
  });
}
