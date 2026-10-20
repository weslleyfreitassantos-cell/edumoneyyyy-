import { useEffect, useMemo, useState } from 'react';
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
import {
  DEFAULT_BRAND_PRIMARY_COLOR,
  DEFAULT_BRAND_SECONDARY_COLOR,
  normalizeHostnameValue,
  sanitizeBrandColor,
} from '../services/brandingValidation';
import { classifyHostname } from '../lib/subdomain';

function getWindowHostname(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.location.hostname;
}

const publicBrandingCachePrefix = 'tecescola:public-branding:';
const publicBrandingCacheVersion = 1;
export const PUBLIC_BRANDING_STALE_TIME = 60_000;

function getPublicBrandingCacheKey(hostname: string): string {
  return `${publicBrandingCachePrefix}${normalizeHostnameValue(hostname || 'unknown')}`;
}

function isInstitutionHostname(hostname: string): boolean {
  return classifyHostname(
    normalizeHostnameValue(hostname || 'unknown'),
  ).type === 'institution';
}

function hasBrandingAssets(branding: PublicBranding): boolean {
  return Boolean(
    branding.logoUrl ||
      branding.faviconUrl ||
      branding.loginBackgroundUrl,
  );
}

interface PersistedPublicBranding {
  cachedAt: number;
  branding: PublicBranding;
}

function normalizeCachedAssetUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function readPersistedPublicBranding(
  hostname: string,
): PersistedPublicBranding | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(
      getPublicBrandingCacheKey(hostname),
    );
    if (!raw) {
      return null;
    }

    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') {
      return null;
    }

    const record = value as Record<string, unknown>;
    const cachedAt = record.cachedAt;
    const rawBranding = record.branding;
    if (
      record.version !== publicBrandingCacheVersion ||
      typeof cachedAt !== 'number' ||
      !Number.isFinite(cachedAt) ||
      cachedAt <= 0 ||
      cachedAt > Date.now() + 60_000 ||
      !rawBranding ||
      typeof rawBranding !== 'object'
    ) {
      return null;
    }

    const candidate = rawBranding as Record<string, unknown>;
    const validScopes: PublicBranding['scope'][] = [
      'GLOBAL',
      'ACCOUNT',
      'INSTITUTION',
      'FALLBACK',
    ];
    if (
      typeof candidate.scope !== 'string' ||
      !validScopes.includes(candidate.scope as PublicBranding['scope'])
    ) {
      return null;
    }

    // An empty resolution must not become a successful, persistent identity
    // for a school subdomain. Older builds could cache this generic fallback.
    if (
      isInstitutionHostname(hostname) &&
      candidate.scope !== 'INSTITUTION'
    ) {
      window.localStorage.removeItem(getPublicBrandingCacheKey(hostname));
      return null;
    }

    const cachedBranding: PublicBranding = {
      scope: candidate.scope as PublicBranding['scope'],
      displayName:
        typeof candidate.displayName === 'string'
          ? candidate.displayName
          : null,
      ...(typeof candidate.documentTitle === 'string'
        ? { documentTitle: candidate.documentTitle }
        : {}),
      logoUrl: normalizeCachedAssetUrl(candidate.logoUrl),
      faviconUrl: normalizeCachedAssetUrl(candidate.faviconUrl),
      loginBackgroundUrl: normalizeCachedAssetUrl(
        candidate.loginBackgroundUrl,
      ),
      primaryColor: sanitizeBrandColor(
        typeof candidate.primaryColor === 'string'
          ? candidate.primaryColor
          : null,
        DEFAULT_BRAND_PRIMARY_COLOR,
      ),
      secondaryColor: sanitizeBrandColor(
        typeof candidate.secondaryColor === 'string'
          ? candidate.secondaryColor
          : null,
        DEFAULT_BRAND_SECONDARY_COLOR,
      ),
    };

    return {
      cachedAt,
      branding: normalizePublicBrandingAssetUrls(cachedBranding),
    };
  } catch {
    // Storage can be disabled, full, or contain data from an older build.
    return null;
  }
}

function persistPublicBranding(
  hostname: string,
  branding: PublicBranding,
): void {
  if (
    typeof window === 'undefined' ||
    (isInstitutionHostname(hostname) && branding.scope !== 'INSTITUTION')
  ) {
    return;
  }

  try {
    window.localStorage.setItem(
      getPublicBrandingCacheKey(hostname),
      JSON.stringify({
        version: publicBrandingCacheVersion,
        cachedAt: Date.now(),
        branding: normalizePublicBrandingAssetUrls(branding),
      }),
    );
  } catch {
    // Branding remains available through React Query when storage is unavailable.
  }
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

const preparedBrandingAssetsByClient = new WeakMap<QueryClient, Set<string>>();
const inFlightBrandingAssetPreloadsByClient = new WeakMap<
  QueryClient,
  Map<string, Promise<PublicBranding>>
>();

function getBrandingAssetCacheKey(
  hostname: string,
  branding: PublicBranding,
): string {
  return JSON.stringify([
    normalizeHostnameValue(hostname || 'unknown'),
    branding.logoUrl ?? null,
    branding.faviconUrl ?? null,
    branding.loginBackgroundUrl ?? null,
  ]);
}

function areBrandingAssetsPrepared(
  queryClient: QueryClient,
  cacheKey: string,
): boolean {
  return preparedBrandingAssetsByClient.get(queryClient)?.has(cacheKey) ?? false;
}

function markBrandingAssetsPrepared(
  queryClient: QueryClient,
  cacheKey: string,
): void {
  let prepared = preparedBrandingAssetsByClient.get(queryClient);
  if (!prepared) {
    prepared = new Set<string>();
    preparedBrandingAssetsByClient.set(queryClient, prepared);
  }
  prepared.add(cacheKey);
}

function preloadPersistedBrandingAssets(
  queryClient: QueryClient,
  cacheKey: string,
  branding: PublicBranding,
): Promise<PublicBranding> {
  let inFlight = inFlightBrandingAssetPreloadsByClient.get(queryClient);
  if (!inFlight) {
    inFlight = new Map<string, Promise<PublicBranding>>();
    inFlightBrandingAssetPreloadsByClient.set(queryClient, inFlight);
  }

  const currentPreload = inFlight.get(cacheKey);
  if (currentPreload) {
    return currentPreload;
  }

  const preload = preloadPublicBrandingAssets(branding).finally(() => {
    inFlight?.delete(cacheKey);
  });
  inFlight.set(cacheKey, preload);
  return preload;
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
  persistPublicBranding(normalizedHostname, readyBranding);
  queryClient.setQueryData(
    brandingKeys.public(normalizedHostname),
    readyBranding,
  );
  if (hasBrandingAssets(readyBranding)) {
    markBrandingAssetsPrepared(
      queryClient,
      getBrandingAssetCacheKey(normalizedHostname, readyBranding),
    );
  }

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
  const publicQueryKey = useMemo(
    () => brandingKeys.public(normalizedHostname),
    [normalizedHostname],
  );
  const persistedBranding = useMemo(
    () => readPersistedPublicBranding(normalizedHostname),
    [normalizedHostname],
  );
  const persistedBrandingAssetsKey = persistedBranding
    ? getBrandingAssetCacheKey(
        normalizedHostname,
        persistedBranding.branding,
      )
    : null;
  const [persistedAssetsReady, setPersistedAssetsReady] = useState(() =>
    !persistedBranding ||
    !hasBrandingAssets(persistedBranding.branding) ||
    (persistedBrandingAssetsKey !== null &&
      areBrandingAssetsPrepared(queryClient, persistedBrandingAssetsKey)),
  );

  useEffect(() => {
    if (
      persistedAssetsReady ||
      !persistedBranding ||
      !hasBrandingAssets(persistedBranding.branding) ||
      !persistedBrandingAssetsKey
    ) {
      return;
    }

    let active = true;
    void preloadPersistedBrandingAssets(
      queryClient,
      persistedBrandingAssetsKey,
      persistedBranding.branding,
    )
      .then((readyBranding) => {
        if (!active) {
          return;
        }

        queryClient.setQueryData(
          publicQueryKey,
          readyBranding,
          { updatedAt: persistedBranding.cachedAt },
        );
        markBrandingAssetsPrepared(
          queryClient,
          persistedBrandingAssetsKey,
        );
        setPersistedAssetsReady(true);
      })
      .catch(() => {
        if (active) {
          setPersistedAssetsReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, [
    persistedAssetsReady,
    persistedBranding,
    persistedBrandingAssetsKey,
    publicQueryKey,
    queryClient,
  ]);

  const query = useQuery<PublicBranding>({
    queryKey: publicQueryKey,
    queryFn: async () => {
      const previousBranding = queryClient.getQueryData<PublicBranding>(
        publicQueryKey,
      ) ?? persistedBranding?.branding;
      const branding = await brandingService.resolveForHostname(
        normalizedHostname,
      );
      if (
        isInstitutionHostname(normalizedHostname) &&
        branding.scope !== 'INSTITUTION'
      ) {
        throw new Error('A identidade visual da escola não foi encontrada.');
      }

      if (
        normalizeHostnameValue(getWindowHostname()) ===
        normalizedHostname
      ) {
        // Set the tenant title as soon as its public identity arrives. Image
        // preloads can take several seconds and must not leave the generic
        // index.html title in the browser tab while the page is resolving.
        applyDocumentTitle(branding);
      }
      const readyBranding = await preloadPublicBrandingAssets(
        branding,
        previousBranding,
      );
      persistPublicBranding(normalizedHostname, readyBranding);
      return readyBranding;
    },
    enabled: persistedAssetsReady,
    initialData: persistedBranding?.branding,
    initialDataUpdatedAt: persistedBranding?.cachedAt,
    retry: 1,
    retryDelay: 500,
    staleTime: PUBLIC_BRANDING_STALE_TIME,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (!persistedAssetsReady || !query.data || !hasBrandingAssets(query.data)) {
      return;
    }

    markBrandingAssetsPrepared(
      queryClient,
      getBrandingAssetCacheKey(normalizedHostname, query.data),
    );
  }, [
    normalizedHostname,
    persistedAssetsReady,
    query.data,
    query.dataUpdatedAt,
    queryClient,
  ]);

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
  return {
    ...query,
    isInitialBrandingLoading:
      !persistedAssetsReady || (query.isLoading && !query.data),
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
