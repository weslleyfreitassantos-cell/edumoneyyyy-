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
import {
  fetchInstitutionBySubdomain,
  type InstitutionSummary,
  type UserInstitution,
  type UserInstitutionMembership,
} from '../services/institutionService';
import { SubdomainNotFoundPage } from '../components/SubdomainNotFoundPage';

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
  window.localStorage.removeItem(
    getStorageKey(profileId),
  );
}

export function extractSubdomainFromHostname(hostname: string): string | null {
  if (!hostname) return null;
  const parts = hostname.toLowerCase().split(':')[0].split('.');

  if (
    hostname.includes('localhost') ||
    hostname.includes('127.0.0.1')
  ) {
    if (parts.length >= 2 && parts[0] !== 'localhost' && parts[0] !== '127') {
      const sub = parts[0];
      if (!['admin', 'app', 'api', 'www', 'localhost'].includes(sub)) {
        return sub;
      }
    }
    return null;
  }

  if (hostname.endsWith('grupotec.dev.br')) {
    if (parts.length >= 3) {
      const sub = parts[0];
      if (sub !== 'www' && sub !== 'grupotec' && sub !== 'admin' && sub !== 'app' && sub !== 'api') {
        return sub;
      }
    }
  }

  return null;
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

export function InstitutionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const institutionsQuery =
    useUserInstitutions(profile?.id, profile?.platform_role);

  const institutions =
    institutionsQuery.data ?? [];

  const [
    currentInstitutionId,
    setCurrentInstitutionIdState,
  ] = useState<string | null>(null);
  const [
    isSwitchingInstitution,
    setIsSwitchingInstitution,
  ] = useState(false);
  const selectionRequestRef = useRef(0);

  useEffect(() => {
    if (!profile?.id) {
      setCurrentInstitutionIdState(null);
      return;
    }

    if (institutionsQuery.isLoading) {
      return;
    }

    if (institutions.length === 0) {
      setCurrentInstitutionIdState(null);
      removeStoredInstitutionId(profile.id);
      return;
    }

    const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const activeSubdomain = extractSubdomainFromHostname(currentHostname);

    if (activeSubdomain) {
      const subdomainMatch = institutions.find(
        (item) => item.institution.subdomain === activeSubdomain
      );
      if (subdomainMatch) {
        setCurrentInstitutionIdState(subdomainMatch.institution.id);
        writeStoredInstitutionId(profile.id, subdomainMatch.institution.id);
        return;
      }
    }

    if (institutions.length === 1) {
      const onlyInstitutionId =
        institutions[0].institution.id;

      setCurrentInstitutionIdState(
        onlyInstitutionId,
      );
      writeStoredInstitutionId(
        profile.id,
        onlyInstitutionId,
      );
      return;
    }

    const currentSelectionStillExists =
      findInstitutionLink(
        institutions,
        currentInstitutionId,
      );

    if (currentSelectionStillExists) {
      return;
    }

    const storedInstitutionId =
      readStoredInstitutionId(profile.id);

    const storedSelectionStillExists =
      findInstitutionLink(
        institutions,
        storedInstitutionId,
      );

    const nextInstitutionId =
      storedSelectionStillExists?.institution.id ??
      institutions[0].institution.id;

    setCurrentInstitutionIdState(
      nextInstitutionId,
    );
    writeStoredInstitutionId(
      profile.id,
      nextInstitutionId,
    );
  }, [
    currentInstitutionId,
    institutions,
    institutionsQuery.isLoading,
    profile?.id,
  ]);

  const selectedInstitutionLink = useMemo(
    () =>
      findInstitutionLink(
        institutions,
        currentInstitutionId,
      ),
    [currentInstitutionId, institutions],
  );

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

      const nextSelection =
        findInstitutionLink(
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

      const previousInstitutionId =
        currentInstitutionId;

      setCurrentInstitutionIdState(
        institutionId,
      );
      writeStoredInstitutionId(
        profile.id,
        institutionId,
      );

      const institutionIds = [
        previousInstitutionId,
        institutionId,
      ].filter(
        (value): value is string =>
          Boolean(value),
      );

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
    [
      currentInstitutionId,
      profile?.id,
      queryClient,
    ],
  );

  const setCurrentInstitutionId = useCallback(
    async (institutionId: string) => {
      if (institutionId === currentInstitutionId) {
        return {
          success: true,
          institutionId,
        } as const;
      }

      const requestId =
        selectionRequestRef.current + 1;
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

        if (
          selectionRequestRef.current !== requestId
        ) {
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
        if (
          selectionRequestRef.current === requestId
        ) {
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

  const clearCurrentInstitutionSelection =
    useCallback(() => {
      if (profile?.id) {
        removeStoredInstitutionId(profile.id);
      }

      setCurrentInstitutionIdState(null);
    }, [profile?.id]);

  const value =
    useMemo<InstitutionContextType>(
      () => ({
        institutions,
        currentInstitution:
          selectedInstitutionLink?.institution ??
          null,
        currentMembership:
          selectedInstitutionLink?.membership ??
          null,
        currentInstitutionId:
          selectedInstitutionLink?.institution.id ??
          null,
        currentRole:
          selectedInstitutionLink?.effectiveRole ??
          null,
        isLoading:
          Boolean(profile?.id) &&
          (isSwitchingInstitution ||
            institutionsQuery.isLoading ||
            (institutionsQuery.isFetching &&
              !selectedInstitutionLink)),
        isSwitchingInstitution,
        error:
          institutionsQuery.error instanceof Error
            ? institutionsQuery.error
            : null,
        hasMultipleInstitutions:
          institutions.length > 1,
        setCurrentInstitutionId,
        clearCurrentInstitutionSelection,
        refresh: institutionsQuery.refetch,
      }),
      [
        clearCurrentInstitutionSelection,
        institutions,
        institutionsQuery.error,
        institutionsQuery.isFetching,
        institutionsQuery.isLoading,
        institutionsQuery.refetch,
        isSwitchingInstitution,
        profile?.id,
        selectedInstitutionLink,
        setCurrentInstitutionId,
      ],
    );

  const [subdomainNotFound, setSubdomainNotFound] = useState(false);
  const [targetSubdomain, setTargetSubdomain] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const extracted = extractSubdomainFromHostname(window.location.hostname);
    setTargetSubdomain(extracted);
  }, []);

  useEffect(() => {
    if (!targetSubdomain) {
      setSubdomainNotFound(false);
      return;
    }

    let isMounted = true;

    async function checkSubdomain() {
      const inst = await fetchInstitutionBySubdomain(targetSubdomain!);
      if (!isMounted) return;

      if (!inst || inst.active === false) {
        setSubdomainNotFound(true);
      } else {
        setSubdomainNotFound(false);
      }
    }

    void checkSubdomain();

    return () => {
      isMounted = false;
    };
  }, [targetSubdomain]);

  if (subdomainNotFound && targetSubdomain) {
    return <SubdomainNotFoundPage subdomain={targetSubdomain} />;
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
