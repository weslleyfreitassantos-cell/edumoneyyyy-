import {
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { adminOverviewKeys } from './useAdminOverview';
import { guardianKeys } from './useGuardians';
import { schoolUserKeys } from './useSchoolUsers';
import { studentKeys } from './useStudents';
import { teacherKeys } from './useTeachers';
import { invalidateSchoolSetupReadiness } from './useSchoolSetupReadiness';
import {
  schoolUserManagementService,
  type ManageSchoolUserPayload,
  type ManageSchoolUserResponse,
} from '../services/schoolUserManagementService';

export function useManageSchoolUser() {
  const queryClient = useQueryClient();

  return useMutation<
    ManageSchoolUserResponse,
    Error,
    ManageSchoolUserPayload
  >({
    mutationFn: (payload) =>
      schoolUserManagementService.manage(payload),

    onSuccess: async (_result, variables) => {
      const institutionId =
        variables.institutionId;

      await Promise.all([
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
        queryClient.invalidateQueries({
          queryKey:
            studentKeys.list(institutionId),
        }),
        queryClient.invalidateQueries({
          queryKey:
            teacherKeys.list(institutionId),
        }),
        queryClient.invalidateQueries({
          queryKey:
            guardianKeys.list(institutionId),
        }),
        invalidateSchoolSetupReadiness(queryClient, institutionId),
      ]);
    },
  });
}
