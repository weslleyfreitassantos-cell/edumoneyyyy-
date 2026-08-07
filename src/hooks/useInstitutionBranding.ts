import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { accountKeys } from './useAccounts';
import { userInstitutionKeys } from './useUserInstitutions';
import {
  brandingPublicService,
  normalizePublicSlug,
  type PublicInstitutionBranding,
} from '../services/brandingPublicService';
import {
  brandingMutationService,
  type RemoveInstitutionFaviconInput,
  type RemoveInstitutionLogoInput,
  type SaveInstitutionFaviconInput,
  type SaveInstitutionFaviconResponse,
  type SaveInstitutionLogoInput,
  type SaveInstitutionLogoResponse,
  type InstitutionBranding,
} from '../services/brandingMutationService';

export const institutionBrandingKeys = {
  all: ['institution-branding'] as const,
  public: (publicSlug: string | null) =>
    [
      ...institutionBrandingKeys.all,
      'public',
      publicSlug ?? 'default',
    ] as const,
};

export function usePublicInstitutionBranding(
  publicSlug: string | null,
) {
  const normalizedSlug =
    normalizePublicSlug(publicSlug);

  return useQuery<PublicInstitutionBranding | null>({
    queryKey:
      institutionBrandingKeys.public(
        normalizedSlug,
      ),
    queryFn: () => {
      if (!normalizedSlug) {
        return Promise.resolve(null);
      }

      return brandingPublicService.getPublicBranding(
        normalizedSlug,
      );
    },
    enabled: Boolean(normalizedSlug),
    retry: false,
    staleTime: 1000 * 60 * 10,
  });
}

export function useSaveInstitutionLogo() {
  const queryClient = useQueryClient();

  return useMutation<
    SaveInstitutionLogoResponse,
    Error,
    SaveInstitutionLogoInput
  >({
    mutationFn: (input) =>
      brandingMutationService.saveLogo(input),
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: accountKeys.all,
        }),
        queryClient.invalidateQueries({
          queryKey: userInstitutionKeys.all,
        }),
        queryClient.invalidateQueries({
          queryKey:
            institutionBrandingKeys.public(
              response.publicSlug,
            ),
        }),
      ]);
    },
  });
}

export function useRemoveInstitutionLogo() {
  const queryClient = useQueryClient();

  return useMutation<
    InstitutionBranding,
    Error,
    RemoveInstitutionLogoInput
  >({
    mutationFn: (input) =>
      brandingMutationService.removeLogo(input),
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: accountKeys.all,
        }),
        queryClient.invalidateQueries({
          queryKey: userInstitutionKeys.all,
        }),
        queryClient.invalidateQueries({
          queryKey:
            institutionBrandingKeys.public(
              response.publicSlug,
            ),
        }),
      ]);
    },
  });
}

export function useSaveInstitutionFavicon() {
  const queryClient = useQueryClient();

  return useMutation<
    SaveInstitutionFaviconResponse,
    Error,
    SaveInstitutionFaviconInput
  >({
    mutationFn: (input) =>
      brandingMutationService.saveFavicon(input),
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: accountKeys.all,
        }),
        queryClient.invalidateQueries({
          queryKey: userInstitutionKeys.all,
        }),
        queryClient.invalidateQueries({
          queryKey:
            institutionBrandingKeys.public(
              response.publicSlug,
            ),
        }),
      ]);
    },
  });
}

export function useRemoveInstitutionFavicon() {
  const queryClient = useQueryClient();

  return useMutation<
    InstitutionBranding,
    Error,
    RemoveInstitutionFaviconInput
  >({
    mutationFn: (input) =>
      brandingMutationService.removeFavicon(input),
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: accountKeys.all,
        }),
        queryClient.invalidateQueries({
          queryKey: userInstitutionKeys.all,
        }),
        queryClient.invalidateQueries({
          queryKey:
            institutionBrandingKeys.public(
              response.publicSlug,
            ),
        }),
      ]);
    },
  });
}
