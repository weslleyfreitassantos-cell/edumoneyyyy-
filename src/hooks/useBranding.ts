import { useEffect } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { accountKeys } from './useAccounts';
import {
  brandingService,
  FALLBACK_BRANDING,
  type AccountDomain,
  type BrandingRecord,
  type PublicBranding,
  type SaveBrandingInput,
} from '../services/brandingService';
import { applyDocumentBranding } from '../services/documentBranding';
import { normalizeHostnameValue } from '../services/brandingValidation';

function getWindowHostname(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.location.hostname;
}

export const brandingKeys = {
  publicRoot: ['public-branding'] as const,
  public: (hostname: string) =>
    [
      ...brandingKeys.publicRoot,
      normalizeHostnameValue(hostname || 'unknown'),
    ] as const,
  global: ['branding', 'global'] as const,
  account: (accountId: string | undefined) =>
    [
      'branding',
      'account',
      accountId ?? 'unknown',
    ] as const,
  accountDomains: (accountId: string | undefined) =>
    [
      'account-domains',
      accountId ?? 'unknown',
    ] as const,
  domainRequests: ['account-domains', 'requests'] as const,
};

export function useResolvedBranding(
  hostname = getWindowHostname(),
) {
  const normalizedHostname = normalizeHostnameValue(
    hostname || 'unknown',
  );

  return useQuery<PublicBranding>({
    queryKey: brandingKeys.public(normalizedHostname),
    queryFn: () =>
      brandingService.resolveForHostname(normalizedHostname),
    retry: false,
    staleTime: 1000 * 60,
  });
}

export function useHostBranding(
  hostname = getWindowHostname(),
): PublicBranding {
  const query = useResolvedBranding(hostname);
  const branding = query.data ?? FALLBACK_BRANDING;

  useEffect(
    () => applyDocumentBranding(branding),
    [
      branding.displayName,
      branding.faviconUrl,
      branding.primaryColor,
      branding.secondaryColor,
    ],
  );

  return branding;
}

export function useGlobalBranding() {
  return useQuery<BrandingRecord | null>({
    queryKey: brandingKeys.global,
    queryFn: () => brandingService.getGlobalBranding(),
    retry: false,
  });
}

export function useAccountBranding(
  accountId: string | undefined,
) {
  return useQuery<BrandingRecord | null>({
    queryKey: brandingKeys.account(accountId),
    queryFn: () => {
      if (!accountId) {
        return Promise.resolve(null);
      }

      return brandingService.getAccountBranding(accountId);
    },
    enabled: Boolean(accountId),
    retry: false,
  });
}

export function useSaveGlobalBranding() {
  const queryClient = useQueryClient();

  return useMutation<
    BrandingRecord,
    Error,
    SaveBrandingInput
  >({
    mutationFn: (input) =>
      brandingService.saveGlobalBranding(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: brandingKeys.global,
        }),
        queryClient.invalidateQueries({
          queryKey: brandingKeys.publicRoot,
        }),
        queryClient.invalidateQueries({
          queryKey: accountKeys.all,
        }),
      ]);
    },
  });
}

export function useSaveAccountBranding(accountId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    BrandingRecord,
    Error,
    SaveBrandingInput
  >({
    mutationFn: (input) =>
      brandingService.saveAccountBranding(accountId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: brandingKeys.account(accountId),
        }),
        queryClient.invalidateQueries({
          queryKey: brandingKeys.accountDomains(accountId),
        }),
        queryClient.invalidateQueries({
          queryKey: brandingKeys.publicRoot,
        }),
      ]);
    },
  });
}

export function useAccountDomains(
  accountId: string | undefined,
) {
  return useQuery<AccountDomain[]>({
    queryKey: brandingKeys.accountDomains(accountId),
    queryFn: () => {
      if (!accountId) {
        return Promise.resolve([]);
      }

      return brandingService.listAccountDomains(accountId);
    },
    enabled: Boolean(accountId),
    retry: false,
  });
}

export function useDomainRequests() {
  return useQuery<AccountDomain[]>({
    queryKey: brandingKeys.domainRequests,
    queryFn: () => brandingService.listPendingDomains(),
    retry: false,
  });
}

export function useRequestAccountDomain(
  accountId: string,
) {
  const queryClient = useQueryClient();

  return useMutation<AccountDomain, Error, string>({
    mutationFn: (hostname) =>
      brandingService.requestAccountDomain(
        accountId,
        hostname,
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: brandingKeys.accountDomains(accountId),
        }),
        queryClient.invalidateQueries({
          queryKey: brandingKeys.domainRequests,
        }),
        queryClient.invalidateQueries({
          queryKey: brandingKeys.publicRoot,
        }),
      ]);
    },
  });
}

export function useActivateDomain() {
  const queryClient = useQueryClient();

  return useMutation<AccountDomain, Error, string>({
    mutationFn: (domainId) =>
      brandingService.activateDomain(domainId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: brandingKeys.domainRequests,
        }),
        queryClient.invalidateQueries({
          queryKey: brandingKeys.publicRoot,
        }),
      ]);
    },
  });
}

export function useDisableDomain() {
  const queryClient = useQueryClient();

  return useMutation<AccountDomain, Error, string>({
    mutationFn: (domainId) =>
      brandingService.disableDomain(domainId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: brandingKeys.domainRequests,
        }),
        queryClient.invalidateQueries({
          queryKey: brandingKeys.publicRoot,
        }),
      ]);
    },
  });
}
