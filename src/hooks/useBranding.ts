import { useEffect } from 'react';
import {
  type QueryClient,
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

const publicBrandingCachePrefix = 'tecescola:public-branding:';

function getPublicBrandingCacheKey(hostname: string): string {
  return `${publicBrandingCachePrefix}${normalizeHostnameValue(hostname || 'unknown')}`;
}

const brandingAssetLoadTimeoutMs = 1500;

function preloadImage(url: string): Promise<void> {
  if (typeof Image === 'undefined') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    let timeoutId: number | undefined;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      resolve();
    };

    const decodeAndFinish = () => {
      if (typeof image.decode !== 'function') {
        finish();
        return;
      }

      void image.decode().catch(() => undefined).finally(finish);
    };

    image.onload = decodeAndFinish;
    image.onerror = finish;
    timeoutId = window.setTimeout(finish, brandingAssetLoadTimeoutMs);
    image.src = url;

    if (image.complete) {
      if (image.naturalWidth > 0) {
        decodeAndFinish();
      } else {
        finish();
      }
    }
  });
}

export async function preloadPublicBrandingAssets(
  branding: PublicBranding,
): Promise<void> {
  const urls = new Set(
    [branding.logoUrl, branding.faviconUrl, branding.loginBackgroundUrl]
      .map((url) => url?.trim())
      .filter((url): url is string => Boolean(url)),
  );

  await Promise.all([...urls].map(preloadImage));
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

export async function invalidateResolvedPublicBranding(
  queryClient: QueryClient,
  hostname: string | null = getWindowHostname(),
): Promise<void> {
  const normalizedHostname = hostname === null
    ? null
    : normalizeHostnameValue(hostname || 'unknown');

  if (typeof window !== 'undefined') {
    try {
      if (normalizedHostname) {
        window.localStorage.removeItem(
          getPublicBrandingCacheKey(normalizedHostname),
        );
      } else {
        for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
          const key = window.localStorage.key(index);
          if (key?.startsWith(publicBrandingCachePrefix)) {
            window.localStorage.removeItem(key);
          }
        }
      }
    } catch {
      // Storage may be unavailable; the query invalidation still refreshes the active page.
    }
  }

  await queryClient.invalidateQueries({
    queryKey: normalizedHostname
      ? brandingKeys.public(normalizedHostname)
      : brandingKeys.publicRoot,
    exact: Boolean(normalizedHostname),
  });
}

/**
 * Publishes a canonical response only after its visual assets are ready.
 */
export async function updateResolvedPublicBrandingCache(
  queryClient: QueryClient,
  hostname: string,
  branding: PublicBranding,
): Promise<void> {
  const normalizedHostname = normalizeHostnameValue(hostname || 'unknown');

  await preloadPublicBrandingAssets(branding).catch(() => undefined);
  queryClient.setQueryData(
    brandingKeys.public(normalizedHostname),
    branding,
  );

  if (getWindowHostname() === normalizedHostname) {
    applyDocumentBranding(branding);
  }
}

export function useResolvedBranding(
  hostname = getWindowHostname(),
) {
  const normalizedHostname = normalizeHostnameValue(
    hostname || 'unknown',
  );
  const query = useQuery<PublicBranding>({
    queryKey: brandingKeys.public(normalizedHostname),
    queryFn: async () => {
      const branding = await brandingService.resolveForHostname(
        normalizedHostname,
      );
      await preloadPublicBrandingAssets(branding).catch(() => undefined);
      return branding;
    },
    retry: false,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 60,
  });

  // Never paint a cached response while the current hostname is being checked.
  // This prevents the previous tenant's logo/background flashing on navigation.
  return {
    ...query,
    data: query.isFetching || query.isError ? undefined : query.data,
    isLoading: query.isFetching || query.isLoading,
  };
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
    retry: 3,
    staleTime: 1000 * 30,
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
    retry: 3,
    staleTime: 1000 * 30,
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
        invalidateResolvedPublicBranding(queryClient, null),
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
        invalidateResolvedPublicBranding(queryClient, null),
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
