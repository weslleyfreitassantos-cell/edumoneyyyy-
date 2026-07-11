import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from './AuthContext';
import { useUserInstitutions } from '../hooks/useUserInstitutions';
import type {
  InstitutionSummary,
  UserInstitution,
  UserInstitutionMembership,
} from '../services/institutionService';

interface InstitutionContextType {
  institutions: UserInstitution[];
  currentInstitution: InstitutionSummary | null;
  currentMembership: UserInstitutionMembership | null;
  currentInstitutionId: string | null;
  currentRole: string | null;
  isLoading: boolean;
  error: Error | null;
  hasMultipleInstitutions: boolean;
  setCurrentInstitutionId: (institutionId: string) => void;
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

export function InstitutionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const institutionsQuery =
    useUserInstitutions(profile?.id);

  const institutions =
    institutionsQuery.data ?? [];

  const [
    currentInstitutionId,
    setCurrentInstitutionIdState,
  ] = useState<string | null>(null);

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

  const setCurrentInstitutionId = useCallback(
    (institutionId: string) => {
      if (!profile?.id) {
        return;
      }

      const nextSelection =
        findInstitutionLink(
          institutions,
          institutionId,
        );

      if (!nextSelection) {
        return;
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

      void queryClient.invalidateQueries({
        predicate: (query) =>
          queryKeyContainsInstitution(
            query.queryKey,
            institutionIds,
          ),
      });
    },
    [
      currentInstitutionId,
      institutions,
      profile?.id,
      queryClient,
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
          institutionsQuery.isLoading,
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
        institutionsQuery.isLoading,
        institutionsQuery.refetch,
        profile?.id,
        selectedInstitutionLink,
        setCurrentInstitutionId,
      ],
    );

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
