import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { adminOverviewKeys } from './useAdminOverview';
import { classKeys } from './useClasses';
import { subjectKeys } from './useSubjects';

import {
  assignmentService,
  type AssignmentRow,
} from '../services/assignmentService';

import type {
  SubjectOfferingFormData,
  SubjectOfferingUpdateData,
} from '../schemas/adminSchemas';

export const assignmentKeys = {
  all: ['assignments'] as const,

  list: (institutionId: string) =>
    [
      ...assignmentKeys.all,
      institutionId,
    ] as const,
};

function invalidateAssignments(
  queryClient: ReturnType<
    typeof useQueryClient
  >,
  institutionId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey:
        assignmentKeys.list(
          institutionId,
        ),
    }),
    queryClient.invalidateQueries({
      queryKey: classKeys.list(
        institutionId,
      ),
    }),
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
    queryClient.invalidateQueries({
      queryKey: ['teacher-dashboard'],
    }),
  ]);
}

export function useAssignments(
  institutionId: string,
) {
  return useQuery<AssignmentRow[]>({
    queryKey:
      assignmentKeys.list(institutionId),
    queryFn: () =>
      assignmentService.list(institutionId),
    enabled: Boolean(institutionId),
  });
}

export function useCreateAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      data: SubjectOfferingFormData,
    ) => assignmentService.create(data),

    onSuccess: async (_result, variables) => {
      await invalidateAssignments(
        queryClient,
        variables.institution_id,
      );
    },
  });
}

export function useUpdateAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      institutionId,
      data,
    }: {
      id: string;
      institutionId: string;
      data: SubjectOfferingUpdateData;
    }) =>
      assignmentService.update(
        id,
        institutionId,
        data,
      ),

    onSuccess: async (_result, variables) => {
      await invalidateAssignments(
        queryClient,
        variables.institutionId,
      );
    },
  });
}

export function useSetAssignmentActive() {
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
      assignmentService.setActive(
        id,
        institutionId,
        active,
      ),

    onSuccess: async (_result, variables) => {
      await invalidateAssignments(
        queryClient,
        variables.institutionId,
      );
    },
  });
}
