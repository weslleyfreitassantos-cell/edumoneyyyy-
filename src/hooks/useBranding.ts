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
  normalizePublicBrandingAssetUrls,
} from '../services/brandingService';
import {
  applyDocumentBranding,
  applyDocumentTitle,
} from '../services/documentBranding';
import { normalizeHostnameValue } from '../services/brandingValidation';

function getWindowHostname(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.location.hostname;
}

const publicBrandingCachePrefix = 'tecescola:public-branding:';
export const PUBLIC_BRANDING_STALE_TIME = 60_000;

function getPublicBrandingCacheKey(hostname: string): string {
  return `${publicBrandingCachePrefix}${normalizeHostnameValue(hostname || 'unknown')}`;
}

const brandingAssetLoadTimeoutMs = 10000;

function preloadImage(url: string): Promise<boolean> {
  if (typeof Image === 'undefined') {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const image = new Image();
    const hasUsableDimensions = () =>
      image.naturalWidth > 0 && image.naturalHeight > 0;
    let settled = false;
    let timeoutId: number | undefined;

    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      resolve(loaded);
    };

    const decodeAndFinish = () => {
      if (typeof image.decode !== 'function') {
        finish(hasUsableDimensions());
        return;
      }

      void image.decode().then(
        () => finish(hasUsableDimensions()),
        () => finish(hasUsableDimensions()),
      );
    };

    image.onload = decodeAndFinish;
    image.onerror = () => finish(false);
    timeoutId = window.setTimeout(
      () => finish(false),
      brandingAssetLoadTimeoutMs,
    );
    image.src = url;

    if (image.complete) {
      if (hasUsableDimensions()) {
        decodeAndFinish();
      } else {
        finish(false);
      }
    }
  });
}

export async function preloadPublicBrandingAssets(
  branding: PublicBranding,
  fallbackBranding?: PublicBranding,
): Promise<PublicBranding> {
  const normalizedBranding = normalizePublicBrandingAssetUrls(branding);
  const assets = [
    ['logo', normalizedBranding.logoUrl],
    ['favicon', normalizedBranding.faviconUrl],
    ['loginBackground', normalizedBranding.loginBackgroundUrl],
  ] as const;
  const loaded = new Map<string, boolean>();
  await Promise.all(
    assets.flatMap(([kind, url]) => {
      const normalizedUrl = url?.trim();

      if (!normalizedUrl) {
        return [];
      }

      return [
        preloadImage(normalizedUrl).then((isLoaded) => {
          loaded.set(`${kind}:${normalizedUrl}`, isLoaded);
        }),
      ];
    }),
  );

  const keepLoadedAsset = (
    kind: (typeof assets)[number][0],
    url: string | null | undefined,
    fallbackUrl: string | null | undefined,
  ) => {
    const normalizedUrl = url?.trim();
    if (normalizedUrl && loaded.get(`${kind}:${normalizedUrl}`)) {
      return url;
    }

    // A transient storage/CDN failure must not erase an already working
    // identity while the tab is being revalidated after being suspended.
    return normalizedUrl && fallbackUrl?.trim()
      ? fallbackUrl
      : null;
  };

  return {
    ...normalizedBranding,
    logoUrl: keepLoadedAsset(
      'logo',
      normalizedBranding.logoUrl,
      fallbackBranding?.logoUrl,
    ),
    faviconUrl: keepLoadedAsset(
      'favicon',
      normalizedBranding.faviconUrl,
      fallbackBranding?.faviconUrl,
    ),
    loginBackgroundUrl: keepLoadedAsset(
      'loginBackground',
      normalizedBranding.loginBackgroundUrl,
      fallbackBranding?.loginBackgroundUrl,
    ),
  };
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

  const readyBranding = await preloadPublicBrandingAssets(branding);
  queryClient.setQueryData(
    brandingKeys.public(normalizedHostname),
    readyBranding,
  );

  if (getWindowHostname() === normalizedHostname) {
    applyDocumentBranding(readyBranding);
  }
}

export function useResolvedBranding(
  hostname = getWindowHostname(),
) {
  const normalizedHostname = normalizeHostnameValue(
    hostname || 'unknown',
  );
  const queryClient = useQueryClient();
  const publicQueryKey = brandingKeys.public(normalizedHostname);
  const query = useQuery<PublicBranding>({
    queryKey: publicQueryKey,
    queryFn: async () => {
      const previousBranding = queryClient.getQueryData<PublicBranding>(
        publicQueryKey,
      );
      const branding = await brandingService.resolveForHostname(
        normalizedHostname,
      );
      if (
        normalizeHostnameValue(getWindowHostname()) ===
        normalizedHostname
      ) {
        // Set the tenant title as soon as its public identity arrives. Image
        // preloads can take several seconds and must not leave the generic
        // index.html title in the browser tab while the page is resolving.
        applyDocumentTitle(branding);
      }
      return preloadPublicBrandingAssets(branding, previousBranding);
    },
    retry: 1,
    retryDelay: 500,
    staleTime: PUBLIC_BRANDING_STALE_TIME,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    const reapplyCurrentBranding = () => {
      if (document.visibilityState === 'hidden') {
        return;
      }

      const currentBranding = queryClient.getQueryData<PublicBranding>(
        publicQueryKey,
      );
      if (currentBranding) {
        applyDocumentBranding(currentBranding);
      }
    };

    window.addEventListener('pageshow', reapplyCurrentBranding);
    document.addEventListener('visibilitychange', reapplyCurrentBranding);

    return () => {
      window.removeEventListener('pageshow', reapplyCurrentBranding);
      document.removeEventListener('visibilitychange', reapplyCurrentBranding);
    };
  }, [normalizedHostname, queryClient]);

  // Keep the last successful identity visible while a background refresh is
  // pending or failed. Only the first load should block the application.
  return query;
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
