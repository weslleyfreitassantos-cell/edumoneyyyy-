import type { QueryClient } from '@tanstack/react-query';

const CACHE_VERSION = 1;
const CACHE_MAX_AGE = 1000 * 60 * 15;
const CACHE_KEY_PREFIX = 'tecescola:student-academic-cache:v1';

type PersistedQuery = {
  queryKey: unknown[];
  data: unknown;
  updatedAt: number;
};

type PersistedCache = {
  version: number;
  savedAt: number;
  queries: PersistedQuery[];
};

function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function getStorageKey(profileId: string, institutionId: string): string {
  return `${CACHE_KEY_PREFIX}:${profileId}:${institutionId}`;
}

function isPersistableQueryKey(
  queryKey: readonly unknown[],
  profileId: string,
  institutionId: string,
): boolean {
  if (
    (queryKey[0] === 'student-dashboard' ||
      queryKey[0] === 'student-academic-context') &&
    queryKey[1] === profileId &&
    queryKey[2] === institutionId
  ) {
    return true;
  }

  if (
    (queryKey[0] === 'attendance' || queryKey[0] === 'grades') &&
    queryKey[1] === 'student-summary' &&
    queryKey[2] === institutionId
  ) {
    return true;
  }

  return (
    queryKey[0] === 'academic-closing' &&
    queryKey[1] === 'report-card' &&
    queryKey[2] === institutionId
  );
}

function readCache(storageKey: string): PersistedCache | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PersistedCache>;
    if (
      parsed.version !== CACHE_VERSION ||
      typeof parsed.savedAt !== 'number' ||
      !Array.isArray(parsed.queries) ||
      Date.now() - parsed.savedAt > CACHE_MAX_AGE
    ) {
      storage.removeItem(storageKey);
      return null;
    }

    return {
      version: CACHE_VERSION,
      savedAt: parsed.savedAt,
      queries: parsed.queries.filter(
        (query): query is PersistedQuery =>
          Boolean(query) &&
          Array.isArray(query.queryKey) &&
          typeof query.updatedAt === 'number' &&
          'data' in query,
      ),
    };
  } catch {
    storage.removeItem(storageKey);
    return null;
  }
}

function writeQuery(
  storageKey: string,
  query: PersistedQuery,
): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    const current = readCache(storageKey);
    const queries = current?.queries ?? [];
    const queryIndex = queries.findIndex(
      (item) => JSON.stringify(item.queryKey) === JSON.stringify(query.queryKey),
    );

    if (queryIndex >= 0) {
      queries[queryIndex] = query;
    } else {
      queries.push(query);
    }

    storage.setItem(
      storageKey,
      JSON.stringify({
        version: CACHE_VERSION,
        savedAt: Date.now(),
        queries,
      } satisfies PersistedCache),
    );
  } catch {
    // Session storage may be unavailable or full. Memory cache remains usable.
  }
}

export function hydrateStudentAcademicCache(
  queryClient: QueryClient,
  profileId: string,
  institutionId: string,
): void {
  const storageKey = getStorageKey(profileId, institutionId);
  const cache = readCache(storageKey);
  if (!cache) return;

  for (const query of cache.queries) {
    if (
      isPersistableQueryKey(query.queryKey, profileId, institutionId)
    ) {
      queryClient.setQueryData(query.queryKey, query.data, {
        updatedAt: query.updatedAt,
      });
    }
  }
}

export function subscribeToStudentAcademicCache(
  queryClient: QueryClient,
  profileId: string,
  institutionId: string,
): () => void {
  const storageKey = getStorageKey(profileId, institutionId);

  return queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated') return;

    const query = event.query;
    if (
      query.state.status !== 'success' ||
      query.state.data === undefined ||
      !isPersistableQueryKey(query.queryKey, profileId, institutionId)
    ) {
      return;
    }

    writeQuery(storageKey, {
      queryKey: [...query.queryKey],
      data: query.state.data,
      updatedAt: query.state.dataUpdatedAt || Date.now(),
    });
  });
}
