import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { adminOverviewKeys } from './useAdminOverview';

import {
  guardianService,
  type GuardianRow,
} from '../services/guardianService';

import type {
  GuardianFormData,
} from '../schemas/adminSchemas';

export const guardianKeys = {
  all: ['guardians'] as const,

  list: (institutionId: string) =>
    [
      ...guardianKeys.all,
      institutionId,
    ] as const,
};

function invalidateGuardians(
  queryClient: ReturnType<
    typeof useQueryClient
  >,
  institutionId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: guardianKeys.list(
        institutionId,
      ),
    }),
    queryClient.invalidateQueries({
      queryKey:
        adminOverviewKeys.detail(
          institutionId,
        ),
    }),
  ]);
}

export function useGuardians(
  institutionId: string,
) {
  return useQuery<GuardianRow[]>({
    queryKey:
      guardianKeys.list(institutionId),
    queryFn: () =>
      guardianService.list(institutionId),
    enabled: Boolean(institutionId),
  });
}

export function useCreateGuardian() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      data: GuardianFormData,
    ) => guardianService.create(data),

    onSuccess: async (_result, variables) => {
      await invalidateGuardians(
        queryClient,
        variables.institution_id,
      );
    },
  });
}

export function useSetGuardianshipActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      institutionId,
      active,
    }: {
      id: string;
      institutionId: string;
      active: boolean;
    }) =>
      guardianService.setLinkActive(
        id,
        institutionId,
        active,
      ),

    onSuccess: async (_result, variables) => {
      await invalidateGuardians(
        queryClient,
        variables.institutionId,
      );
    },
  });
}
