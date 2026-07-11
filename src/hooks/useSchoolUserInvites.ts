import {
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { adminOverviewKeys } from './useAdminOverview';
import { guardianKeys } from './useGuardians';
import { schoolUserKeys } from './useSchoolUsers';
import { studentKeys } from './useStudents';
import { teacherKeys } from './useTeachers';

import {
  schoolUserInviteService,
  type SchoolUserInviteResponse,
} from '../services/schoolUserInviteService';

import type {
  UnifiedUserInvitePayload,
} from '../pages/Admin/tabs/school-users/unifiedUserInviteModel';

export function useInviteSchoolUser() {
  const queryClient = useQueryClient();

  return useMutation<
    SchoolUserInviteResponse,
    Error,
    UnifiedUserInvitePayload
  >({
    mutationFn: (payload) =>
      schoolUserInviteService.invite(payload),

    onSuccess: async (_result, variables) => {
      const institutionId =
        variables.institutionId;

      const invalidations = [
        queryClient.invalidateQueries({
          queryKey:
            schoolUserKeys.list(institutionId),
        }),
        queryClient.invalidateQueries({
          queryKey:
            adminOverviewKeys.detail(
              institutionId,
            ),
        }),
      ];

      if (variables.role === 'STUDENT') {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey:
              studentKeys.list(institutionId),
          }),
        );
      }

      if (variables.role === 'TEACHER') {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey:
              teacherKeys.list(institutionId),
          }),
        );
      }

      if (variables.role === 'GUARDIAN') {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey:
              guardianKeys.list(institutionId),
          }),
        );
      }

      await Promise.all(invalidations);
    },
  });
}
