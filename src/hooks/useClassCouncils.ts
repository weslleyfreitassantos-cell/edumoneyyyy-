import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  classCouncilService,
  type ClassCouncilListFilters,
  type CreateClassCouncilInput,
  type UpdateClassCouncilInput,
  type UpdateClassCouncilStudentNoteInput,
} from '../services/classCouncilService';

export function useClassCouncils(
  institutionId: string | null | undefined,
  filters: ClassCouncilListFilters = {},
) {
  return useQuery({
    queryKey: ['class-councils', institutionId, filters],
    queryFn: () => classCouncilService.list(institutionId!, filters),
    enabled: Boolean(institutionId),
  });
}

export function useClassCouncilDetails(
  councilId: string | null | undefined,
) {
  return useQuery({
    queryKey: ['class-council', councilId],
    queryFn: () => classCouncilService.getDetails(councilId!),
    enabled: Boolean(councilId),
  });
}

export function useClassCouncilContextOptions(
  institutionId: string | null | undefined,
) {
  return useQuery({
    queryKey: ['class-council-context-options', institutionId],
    queryFn: () => classCouncilService.listContextOptions(institutionId!),
    enabled: Boolean(institutionId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useClassCouncilEligibleParticipants(
  institutionId: string | null | undefined,
) {
  return useQuery({
    queryKey: ['class-council-eligible-participants', institutionId],
    queryFn: () => classCouncilService.listEligibleParticipants(institutionId!),
    enabled: Boolean(institutionId),
    staleTime: 1000 * 60 * 5,
  });
}

function useCouncilMutation<TInput>(
  mutationFn: (input: TInput) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['class-councils'] });
      if (typeof variables === 'object' && variables !== null && 'councilId' in variables) {
        void queryClient.invalidateQueries({ queryKey: ['class-council', variables.councilId] });
      }
      if (typeof variables === 'string') {
        void queryClient.invalidateQueries({ queryKey: ['class-council', variables] });
      }
    },
  });
}

export function useCreateClassCouncil() {
  return useCouncilMutation<CreateClassCouncilInput>(classCouncilService.create);
}

export function useUpdateClassCouncil() {
  return useCouncilMutation<UpdateClassCouncilInput>(classCouncilService.update);
}

export function useAddClassCouncilParticipant() {
  return useCouncilMutation<{ councilId: string; profileId: string; role: 'DIRECTOR' | 'SECRETARY' | 'TEACHER' }>(
    ({ councilId, profileId, role }) => classCouncilService.addParticipant(councilId, profileId, role),
  );
}

export function useOpenClassCouncil() {
  return useCouncilMutation<{ council: Parameters<typeof classCouncilService.open>[0] }>(
    ({ council }) => classCouncilService.open(council),
  );
}

export function useCompleteClassCouncil() {
  return useCouncilMutation<string>(classCouncilService.complete);
}

export function useReopenClassCouncil() {
  return useCouncilMutation<{ councilId: string; reason: string }>(
    ({ councilId, reason }) => classCouncilService.reopen(councilId, reason),
  );
}

export function useCancelClassCouncil() {
  return useCouncilMutation<string>(classCouncilService.cancel);
}

export function useUpdateClassCouncilStudentNote() {
  return useCouncilMutation<UpdateClassCouncilStudentNoteInput>(classCouncilService.updateStudentNote);
}
