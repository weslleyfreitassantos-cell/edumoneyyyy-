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
};

export function useUserInstitutions(
  profileId: string | undefined,
) {
  return useQuery<UserInstitution[]>({
    queryKey:
      userInstitutionKeys.list(profileId),

    queryFn: () => {
      if (!profileId) {
        return Promise.resolve([]);
      }

      return institutionService.listForProfile(
        profileId,
      );
    },

    enabled: Boolean(profileId),
    staleTime: 1000 * 60 * 10,
  });
}
