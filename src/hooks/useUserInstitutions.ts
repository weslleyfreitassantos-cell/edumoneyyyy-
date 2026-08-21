import { useQuery } from '@tanstack/react-query';

import {
  institutionService,
  type UserInstitution,
} from '../services/institutionService';

export const userInstitutionKeys = {
  all: ['user-institutions'] as const,

  list: (profileId: string | undefined) =>
    [
      ...userInstitutionKeys.all,
      profileId ?? 'anonymous',
    ] as const,

  allActive: () =>
    [...userInstitutionKeys.all, 'all-active'] as const,
};

export function useUserInstitutions(
  profileId: string | undefined,
  platformRole?: string,
) {
  return useQuery<UserInstitution[]>({
    queryKey:
      platformRole === 'SUPER_ADMIN'
        ? userInstitutionKeys.allActive()
        : userInstitutionKeys.list(profileId),

    queryFn: () => {
      if (platformRole === 'SUPER_ADMIN') {
        return institutionService.listAllActiveInstitutions();
      }

      if (!profileId) {
        return Promise.resolve([]);
      }

      return institutionService.listForProfile(
        profileId,
      );
    },

    enabled: Boolean(profileId),
    // Keep the last resolved institution list visible while a background
    // refetch is in progress (for example after returning to the tab).
    placeholderData: (previousData) => previousData,
    staleTime: 1000 * 60 * 10,
  });
}
