import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { adminOverviewKeys } from './useAdminOverview';

import {
  subjectService,
  type SubjectBatchInput,
  type SubjectRow,
} from '../services/subjectService';

import type {
  SubjectFormData,
  SubjectUpdateData,
} from '../schemas/adminSchemas';

export const subjectKeys = {
  all: ['subjects'] as const,

  list: (institutionId: string) =>
    [
      ...subjectKeys.all,
      institutionId,
    ] as const,
};

function invalidateSubjects(
  queryClient: ReturnType<
    typeof useQueryClient
  >,
  institutionId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: subjectKeys.list(
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

export function useSubjects(
  institutionId: string,
) {
  return useQuery<SubjectRow[]>({
    queryKey: subjectKeys.list(institutionId),
    queryFn: () =>
      subjectService.list(institutionId),
    enabled: Boolean(institutionId),
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SubjectFormData) =>
      subjectService.create(data),

    onSuccess: async (_result, variables) => {
      await invalidateSubjects(
        queryClient,
        variables.institution_id,
      );
    },
  });
}

export function useCreateManyMissingSubjects() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      institutionId,
      subjects,
    }: {
      institutionId: string;
      subjects: SubjectBatchInput[];
    }) =>
      subjectService.createManyMissing({
        institutionId,
        subjects,
      }),

    onSuccess: async (_result, variables) => {
      await invalidateSubjects(
        queryClient,
        variables.institutionId,
      );
    },
  });
}

export function useUpdateSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      institutionId,
      data,
    }: {
      id: string;
      institutionId: string;
      data: SubjectUpdateData;
    }) =>
      subjectService.update(
        id,
        institutionId,
        data,
      ),

    onSuccess: async (_result, variables) => {
      await invalidateSubjects(
        queryClient,
        variables.institutionId,
      );
    },
  });
}

export function useSetSubjectActive() {
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
      subjectService.setActive(
        id,
        institutionId,
        active,
      ),

    onSuccess: async (_result, variables) => {
      await invalidateSubjects(
        queryClient,
        variables.institutionId,
      );
    },
  });
}
