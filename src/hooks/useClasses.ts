import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { adminOverviewKeys } from './useAdminOverview';
import { invalidateSchoolSetupReadiness } from './useSchoolSetupReadiness';

import {
  classService,
  type ClassDeletionImpact,
  type ClassRow,
} from '../services/classService';

import type {
  ClassFormData,
  ClassUpdateData,
} from '../schemas/adminSchemas';

export const classKeys = {
  all: ['classes'] as const,

  list: (institutionId: string) =>
    [
      ...classKeys.all,
      institutionId,
    ] as const,

  deletionImpact: (institutionId: string, classId: string) =>
    [...classKeys.all, 'deletion-impact', institutionId, classId] as const,
};

function invalidateClasses(
  queryClient: ReturnType<
    typeof useQueryClient
  >,
  institutionId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: classKeys.list(
        institutionId,
      ),
    }),
    queryClient.invalidateQueries({
      queryKey:
        adminOverviewKeys.detail(
          institutionId,
        ),
    }),
    invalidateSchoolSetupReadiness(queryClient, institutionId),
  ]);
}

export function useClasses(
  institutionId: string,
) {
  return useQuery<ClassRow[]>({
    queryKey: classKeys.list(institutionId),
    queryFn: () =>
      classService.list(institutionId),
    enabled: Boolean(institutionId),
  });
}

export function useClassDeletionImpact(
  institutionId: string,
  classId: string | null,
) {
  return useQuery<ClassDeletionImpact>({
    queryKey: classKeys.deletionImpact(institutionId, classId ?? 'none'),
    queryFn: () => classService.getDeletionImpact(classId as string, institutionId),
    enabled: Boolean(institutionId && classId),
  });
}

export function useCreateClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ClassFormData) =>
      classService.create(data),

    onSuccess: async (_result, variables) => {
      await invalidateClasses(
        queryClient,
        variables.institution_id,
      );
    },
  });
}

export function useUpdateClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      institutionId,
      data,
    }: {
      id: string;
      institutionId: string;
      data: ClassUpdateData;
    }) =>
      classService.update(
        id,
        institutionId,
        data,
      ),

    onSuccess: async (_result, variables) => {
      await invalidateClasses(
        queryClient,
        variables.institutionId,
      );
    },
  });
}

export function useSetClassActive() {
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
      classService.setActive(
        id,
        institutionId,
        active,
      ),

    onSuccess: async (_result, variables) => {
      await invalidateClasses(
        queryClient,
        variables.institutionId,
      );
    },
  });
}

export function useDeleteClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      institutionId,
    }: {
      id: string;
      institutionId: string;
    }) => classService.delete(id, institutionId),
    onSuccess: async (_result, variables) => {
      await invalidateClasses(queryClient, variables.institutionId);
      await queryClient.removeQueries({
        queryKey: classKeys.deletionImpact(variables.institutionId, variables.id),
      });
    },
  });
}
