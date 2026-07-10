import { useQuery } from '@tanstack/react-query';

import {
  schoolUserService,
  type SchoolUserRow,
} from '../services/schoolUserService';

export const schoolUserKeys = {
  all: ['school-users'] as const,

  list: (institutionId: string) =>
    [
      ...schoolUserKeys.all,
      institutionId,
    ] as const,
};

export function useSchoolUsers(
  institutionId: string,
) {
  return useQuery<SchoolUserRow[]>({
    queryKey:
      schoolUserKeys.list(institutionId),

    queryFn: () =>
      schoolUserService.list(institutionId),

    enabled: Boolean(institutionId),
  });
}
