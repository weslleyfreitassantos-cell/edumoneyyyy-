import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from './AuthContext';
import { useUserInstitutions } from '../hooks/useUserInstitutions';
import { classifyHostname, type HostResolution } from '../lib/subdomain';
import { SubdomainNotFoundPage } from '../components/SubdomainNotFoundPage';
import { SubdomainForbiddenPage } from '../components/SubdomainForbiddenPage';
import { SubdomainErrorPage } from '../components/SubdomainErrorPage';
import {
  resolveInstitutionBySubdomain,
  type InstitutionSummary,
  type UserInstitution,
  type UserInstitutionMembership,
} from '../services/institutionService';

export type InstitutionResolutionState =
  | 'loading'
  | 'platform'
  | 'resolved'
  | 'not-found'
  | 'forbidden'
  | 'error';

export type SelectInstitutionResult =
  | {
      success: true;
      institutionId: string;
    }
  | {
      success: false;
      reason:
        | 'NOT_FOUND'
        | 'NOT_AUTHORIZED'
        | 'REFETCH_FAILED';
      message?: string;
    };

interface InstitutionContextType {
  institutions: UserInstitution[];
  currentInstitution: InstitutionSummary | null;
  currentMembership: UserInstitutionMembership | null;
  currentInstitutionId: string | null;
  currentRole: string | null;
  resolutionState?: InstitutionResolutionState;
  isLoading: boolean;
  isSwitchingInstitution: boolean;
  error: Error | null;
  hasMultipleInstitutions: boolean;
  setCurrentInstitutionId: (
    institutionId: string,
  ) => Promise<SelectInstitutionResult>;
  clearCurrentInstitutionSelection: () => void;
  refresh: () => Promise<unknown>;
}

const InstitutionContext =
  createContext<InstitutionContextType | undefined>(
    undefined,
  );

function getStorageKey(
  profileId: string,
): string {
  return `edumanager.currentInstitutionId.${profileId}`;
}

function readStoredInstitutionId(
  profileId: string,
): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(
    getStorageKey(profileId),
  );
}

function writeStoredInstitutionId(
  profileId: string,
  institutionId: string,
): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    getStorageKey(profileId),
    institutionId,
  );
}

function removeStoredInstitutionId(
  profileId: string,
): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(
    getStorageKey(profileId),
  );
}

function findInstitutionLink(
  institutions: UserInstitution[],
  institutionId: string | null,
): UserInstitution | null {
  if (!institutionId) {
    return null;
  }

  return (
    institutions.find(
      (item) =>
        item.institution.id === institutionId,
    ) ?? null
  );
}

function queryKeyContainsInstitution(
  queryKey: readonly unknown[],
  institutionIds: string[],
): boolean {
  return queryKey.some(
    (part) =>
      typeof part === 'string' &&
      institutionIds.includes(part),
  );
}

export interface InstitutionProviderProps {
  children: ReactNode;
  hostnameOverride?: string;
}

export function InstitutionProvider({
  children,
  hostnameOverride,
}: InstitutionProviderProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const hostname =
    hostnameOverride ??
    (typeof window !== 'undefined' ? window.location.hostname : '');

  const hostResolution: HostResolution = useMemo(
    () => classifyHostname(hostname),
    [hostname],
  );

  const [subdomainInstitution, setSubdomainInstitution] =
    useState<InstitutionSummary | null>(null);
  const [subdomainStatus, setSubdomainStatus] = useState<
    'idle' | 'loading' | 'resolved' | 'not-found' | 'error'
  >('idle');
  const [subdomainError, setSubdomainError] = useState<Error | null>(null);

  useEffect(() => {
    if (hostResolution.type !== 'institution') {
      setSubdomainInstitution(null);
      setSubdomainError(null);
      if (hostResolution.type === 'invalid') {
        setSubdomainStatus('not-found');
      } else {
        setSubdomainStatus('idle');
      }
      return;
    }

    let isMounted = true;
    setSubdomainStatus('loading');
    setSubdomainError(null);

    resolveInstitutionBySubdomain(hostResolution.subdomain)
      .then((res) => {
        if (!isMounted) return;
        if (res.error) {
          setSubdomainError(res.error);
          setSubdomainStatus('error');
          setSubdomainInstitution(null);
        } else if (!res.institution) {
          setSubdomainStatus('not-found');
          setSubdomainInstitution(null);
        } else {
          setSubdomainInstitution(res.institution);
          setSubdomainStatus('resolved');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setSubdomainError(
          err instanceof Error ? err : new Error('Falha na resolução do subdomínio.'),
        );
        setSubdomainStatus('error');
        setSubdomainInstitution(null);
      });

    return () => {
      isMounted = false;
    };
  }, [hostResolution]);

  const institutionsQuery = useUserInstitutions(
    profile?.id,
    profile?.platform_role,
  );

  const institutions = institutionsQuery.data ?? [];

  const [platformInstitutionId, setPlatformInstitutionId] = useState<string | null>(null);
  const [isSwitchingInstitution, setIsSwitchingInstitution] = useState(false);
  const selectionRequestRef = useRef(0);

  const resolutionState: InstitutionResolutionState = useMemo(() => {
    if (hostResolution.type === 'invalid') return 'not-found';

    if (hostResolution.type === 'institution') {
      if (subdomainStatus === 'loading') return 'loading';
      if (subdomainStatus === 'error') return 'error';
      if (subdomainStatus === 'not-found' || !subdomainInstitution)
        return 'not-found';

      if (profile?.id) {
        if (institutionsQuery.isLoading) return 'loading';
        const matched = institutions.find(
          (link) => link.institution.id === subdomainInstitution.id,
        );
        if (!matched) return 'forbidden';
        return 'resolved';
      }

      return 'resolved';
    }

    return 'platform';
  }, [
    hostResolution.type,
    subdomainStatus,
    subdomainInstitution,
    profile?.id,
    institutionsQuery.isLoading,
    institutions,
  ]);

  useEffect(() => {
    if (
      hostResolution.type === 'institution' ||
      hostResolution.type === 'invalid'
    ) {
      return;
    }

    if (!profile?.id) {
      setPlatformInstitutionId(null);
      return;
    }

    if (institutionsQuery.isLoading) {
      return;
    }

    if (institutions.length === 0) {
      setPlatformInstitutionId(null);
      removeStoredInstitutionId(profile.id);
      return;
    }

    if (profile.role === 'DIRECTOR') {
      const directorLink =
        institutions.find(
          (link) =>
            link.membership?.role === 'DIRECTOR' &&
            link.membership?.active === true,
        ) ?? institutions[0];

      if (directorLink) {
        if (platformInstitutionId !== directorLink.institution.id) {
          setPlatformInstitutionId(directorLink.institution.id);
          writeStoredInstitutionId(
            profile.id,
            directorLink.institution.id,
          );
        }
        return;
      }
    }

    if (institutions.length === 1) {
      const onlyInstitutionId =
        institutions[0].institution.id;

      setPlatformInstitutionId(onlyInstitutionId);
      writeStoredInstitutionId(profile.id, onlyInstitutionId);
      return;
    }

    const currentSelectionStillExists = findInstitutionLink(
      institutions,
      platformInstitutionId,
    );

    if (currentSelectionStillExists) {
      return;
    }

    const storedInstitutionId = readStoredInstitutionId(profile.id);
    const storedSelectionStillExists = findInstitutionLink(
      institutions,
      storedInstitutionId,
    );

    const nextInstitutionId =
      storedSelectionStillExists?.institution.id ??
      institutions[0].institution.id;

    setPlatformInstitutionId(nextInstitutionId);
    writeStoredInstitutionId(profile.id, nextInstitutionId);
  }, [
    hostResolution.type,
    platformInstitutionId,
    institutions,
    institutionsQuery.isLoading,
    profile?.id,
    profile?.role,
  ]);

  const activeLink = useMemo(() => {
    if (hostResolution.type === 'institution') {
      if (!subdomainInstitution) return null;
      return (
        institutions.find(
          (link) => link.institution.id === subdomainInstitution.id,
        ) ?? null
      );
    }

    return findInstitutionLink(institutions, platformInstitutionId);
  }, [
    hostResolution.type,
    subdomainInstitution,
    institutions,
    platformInstitutionId,
  ]);

  const currentInstitution = useMemo(() => {
    if (hostResolution.type === 'institution') {
      if (activeLink) return activeLink.institution;
      return subdomainInstitution;
    }
    return activeLink?.institution ?? null;
  }, [hostResolution.type, activeLink, subdomainInstitution]);

  const currentMembership = activeLink?.membership ?? null;

  const currentInstitutionId = useMemo(() => {
    if (hostResolution.type === 'institution') {
      if (activeLink) return activeLink.institution.id;
      if (resolutionState === 'resolved' && subdomainInstitution) {
        return subdomainInstitution.id;
      }
      return null;
    }
    return activeLink?.institution.id ?? null;
  }, [hostResolution.type, activeLink, resolutionState, subdomainInstitution]);

  const currentRole = activeLink?.effectiveRole ?? null;

  const selectAuthorizedInstitution = useCallback(
    async (
      institutionId: string,
      authorizedInstitutions: UserInstitution[],
    ): Promise<SelectInstitutionResult> => {
      if (!profile?.id) {
        return {
          success: false,
          reason: 'NOT_AUTHORIZED',
          message:
            'Nao foi possivel confirmar o usuario atual.',
        };
      }

      const nextSelection = findInstitutionLink(
        authorizedInstitutions,
        institutionId,
      );

      if (!nextSelection) {
        return {
          success: false,
          reason: 'NOT_FOUND',
          message:
            'A instituicao solicitada ainda nao aparece na lista autorizada.',
        };
      }

      const previousInstitutionId = currentInstitutionId;

      setPlatformInstitutionId(institutionId);
      writeStoredInstitutionId(profile.id, institutionId);

      const institutionIds = [
        previousInstitutionId,
        institutionId,
      ].filter((value): value is string => Boolean(value));

      await queryClient.cancelQueries({
        predicate: (query) =>
          queryKeyContainsInstitution(
            query.queryKey,
            institutionIds,
          ),
      });

      if (
        previousInstitutionId &&
        previousInstitutionId !== institutionId
      ) {
        queryClient.removeQueries({
          predicate: (query) =>
            queryKeyContainsInstitution(
              query.queryKey,
              [previousInstitutionId],
            ),
        });
      }

      await queryClient.invalidateQueries({
        predicate: (query) =>
          queryKeyContainsInstitution(
            query.queryKey,
            [institutionId],
          ),
      });

      return {
        success: true,
        institutionId,
      };
    },
    [currentInstitutionId, profile?.id, queryClient],
  );

  const setCurrentInstitutionId = useCallback(
    async (institutionId: string) => {
      if (institutionId === currentInstitutionId) {
        return {
          success: true,
          institutionId,
        } as const;
      }

      const requestId = selectionRequestRef.current + 1;
      selectionRequestRef.current = requestId;
      setIsSwitchingInstitution(true);

      try {
        const selectedFromCurrentList =
          await selectAuthorizedInstitution(
            institutionId,
            institutions,
          );

        if (selectedFromCurrentList.success) {
          return selectedFromCurrentList;
        }

        if (
          selectedFromCurrentList.reason ===
          'NOT_AUTHORIZED'
        ) {
          return selectedFromCurrentList;
        }

        let refreshedInstitutions:
          | Awaited<
              ReturnType<
                typeof institutionsQuery.refetch
              >
            >
          | null = null;

        try {
          refreshedInstitutions =
            await institutionsQuery.refetch();
        } catch (error) {
          return {
            success: false,
            reason: 'REFETCH_FAILED',
            message:
              error instanceof Error
                ? error.message
                : 'Nao foi possivel atualizar a lista de instituicoes.',
          };
        }

        if (selectionRequestRef.current !== requestId) {
          return {
            success: false,
            reason: 'NOT_FOUND',
            message:
              'A selecao foi substituida por uma tentativa mais recente.',
          };
        }

        if (refreshedInstitutions.error) {
          return {
            success: false,
            reason: 'REFETCH_FAILED',
            message:
              refreshedInstitutions.error instanceof Error
                ? refreshedInstitutions.error.message
                : 'Nao foi possivel atualizar a lista de instituicoes.',
          };
        }

        return selectAuthorizedInstitution(
          institutionId,
          refreshedInstitutions.data ?? [],
        );
      } finally {
        if (selectionRequestRef.current === requestId) {
          setIsSwitchingInstitution(false);
        }
      }
    },
    [
      currentInstitutionId,
      institutions,
      institutionsQuery.refetch,
      selectAuthorizedInstitution,
    ],
  );

  const clearCurrentInstitutionSelection = useCallback(() => {
    if (profile?.id) {
      removeStoredInstitutionId(profile.id);
    }
    setPlatformInstitutionId(null);
  }, [profile?.id]);

  const value = useMemo<InstitutionContextType>(
    () => ({
      institutions,
      currentInstitution,
      currentMembership,
      currentInstitutionId,
      currentRole,
      resolutionState,
      isLoading:
        resolutionState === 'loading' ||
        (Boolean(profile?.id) &&
          (isSwitchingInstitution ||
            institutionsQuery.isLoading ||
            (institutionsQuery.isFetching && !activeLink))),
      isSwitchingInstitution,
      error:
        subdomainError ??
        (institutionsQuery.error instanceof Error
          ? institutionsQuery.error
          : null),
      hasMultipleInstitutions: institutions.length > 1,
      setCurrentInstitutionId,
      clearCurrentInstitutionSelection,
      refresh: institutionsQuery.refetch,
    }),
    [
      activeLink,
      clearCurrentInstitutionSelection,
      currentInstitution,
      currentInstitutionId,
      currentMembership,
      currentRole,
      institutions,
      institutionsQuery.error,
      institutionsQuery.isFetching,
      institutionsQuery.isLoading,
      institutionsQuery.refetch,
      isSwitchingInstitution,
      profile?.id,
      resolutionState,
      setCurrentInstitutionId,
      subdomainError,
    ],
  );

  if (resolutionState === 'loading') {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 dark:bg-slate-900">
        <div role="status" className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600 dark:border-slate-800 dark:border-t-blue-400" />
          <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-400">
            Carregando instituição...
          </p>
        </div>
      </main>
    );
  }

  if (resolutionState === 'not-found') {
    return <SubdomainNotFoundPage />;
  }

  if (resolutionState === 'forbidden') {
    return <SubdomainForbiddenPage />;
  }

  if (resolutionState === 'error') {
    return <SubdomainErrorPage />;
  }

  return (
    <InstitutionContext.Provider value={value}>
      {children}
    </InstitutionContext.Provider>
  );
}

export function useInstitution(): InstitutionContextType {
  const context = useContext(InstitutionContext);

  if (!context) {
    throw new Error(
      'useInstitution deve ser usado dentro de InstitutionProvider.',
    );
  }

  return context;
}
