import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { adminOverviewKeys } from './useAdminOverview';
import { classKeys } from './useClasses';
import { invalidateSchoolSetupReadiness } from './useSchoolSetupReadiness';

import {
  enrollmentService,
  type EnrollmentRow,
} from '../services/enrollmentService';

import type {
  EnrollmentFormData,
  EnrollmentUpdateData,
  EnrollmentStatusUpdateData,
  EnrollmentTransferData,
} from '../schemas/adminSchemas';

export const enrollmentKeys = {
  all: ['enrollments'] as const,

  list: (institutionId: string) =>
    [
      ...enrollmentKeys.all,
      institutionId,
    ] as const,
};

function invalidateEnrollments(
  queryClient: ReturnType<
    typeof useQueryClient
  >,
  institutionId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey:
        enrollmentKeys.list(institutionId),
    }),
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
    queryClient.invalidateQueries({
      queryKey: ['student-dashboard'],
    }),
    queryClient.invalidateQueries({
      queryKey: ['teacher-dashboard'],
    }),
    invalidateSchoolSetupReadiness(queryClient, institutionId),
  ]);
}

export function useEnrollments(
  institutionId: string,
) {
  return useQuery<EnrollmentRow[]>({
    queryKey:
      enrollmentKeys.list(institutionId),
    queryFn: () =>
      enrollmentService.list(institutionId),
    enabled: Boolean(institutionId),
  });
}

export function useCreateEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      data: EnrollmentFormData,
    ) => enrollmentService.create(data),

    onSuccess: async (_result, variables) => {
      await invalidateEnrollments(
        queryClient,
        variables.institution_id,
      );
    },
  });
}

export function useTransferEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      institutionId,
      data,
    }: {
      institutionId: string;
      data: EnrollmentTransferData;
    }) =>
      enrollmentService.transfer(
        institutionId,
        data,
      ),

    onSuccess: async (_result, variables) => {
      await invalidateEnrollments(
        queryClient,
        variables.institutionId,
      );
    },
  });
}

export function useUpdateEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      institutionId,
      data,
    }: {
      id: string;
      institutionId: string;
      data: EnrollmentUpdateData;
    }) =>
      enrollmentService.update(
        id,
        institutionId,
        data,
      ),

    onSuccess: async (_result, variables) => {
      await invalidateEnrollments(
        queryClient,
        variables.institutionId,
      );
    },
  });
}

export function useUpdateEnrollmentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      institutionId,
      data,
    }: {
      id: string;
      institutionId: string;
      data: EnrollmentStatusUpdateData;
    }) =>
      enrollmentService.updateStatus(
        id,
        institutionId,
        data,
      ),

    onSuccess: async (_result, variables) => {
      await invalidateEnrollments(
        queryClient,
        variables.institutionId,
      );
    },
  });
}
