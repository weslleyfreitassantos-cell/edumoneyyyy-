import { useMutation, useQueryClient } from '@tanstack/react-query';

import { adminOverviewKeys } from './useAdminOverview';
import { classKeys } from './useClasses';
import { enrollmentKeys } from './useEnrollments';
import { schoolUserKeys } from './useSchoolUsers';
import { studentKeys } from './useStudents';

import {
  createFullStudentEnrollment,
  type FullStudentEnrollmentDraft,
} from '../services/fullStudentEnrollmentService';

export function useCreateFullStudentEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      institutionId,
      draft,
      existingStudentId,
    }: {
      institutionId: string;
      draft: FullStudentEnrollmentDraft;
      existingStudentId?: string;
    }) =>
      createFullStudentEnrollment(
        institutionId,
        draft,
        existingStudentId,
      ),

    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: studentKeys.list(variables.institutionId),
        }),
        queryClient.invalidateQueries({
          queryKey: enrollmentKeys.list(variables.institutionId),
        }),
        queryClient.invalidateQueries({
          queryKey: schoolUserKeys.list(variables.institutionId),
        }),
        queryClient.invalidateQueries({
          queryKey: classKeys.list(variables.institutionId),
        }),
        queryClient.invalidateQueries({
          queryKey: adminOverviewKeys.detail(variables.institutionId),
        }),
      ]);
    },
  });
}
