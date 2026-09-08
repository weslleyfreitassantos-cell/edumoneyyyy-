import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';

import { supabase } from '../lib/supabaseClient';
import {
  isDatabaseRole,
  isPlatformRole,
  type DatabaseRole,
  type PlatformRole,
} from '../lib/roles';
import {
  ProfileServiceError,
  updateCurrentPassword,
  updateCurrentProfile,
} from '../services/profileService';
import {
  selfRegistrationService,
  type SelfRegistrationUpdate,
} from '../services/selfRegistrationService';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: DatabaseRole;
  platform_role: PlatformRole;
  avatar_url: string | null;
  phone?: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

interface AuthProfileActionsContextType {
  updateProfileName: (fullName: string) => Promise<void>;
  updateSelfRegistration: (input: SelfRegistrationUpdate) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
}

interface ProfileRequest {
  userId: string;
  promise: Promise<Profile>;
}

interface SynchronizeSessionOptions {
  throwOnProfileError?: boolean;
}

class InactiveProfileError extends Error {
  constructor() {
    super(
      'Seu acesso foi desativado. Entre em contato com a administração.',
    );
    this.name = 'InactiveProfileError';
  }
}

class AccountAccessBlockedError extends Error {
  constructor() {
    super(
      'Voce nao tem acesso a esta plataforma. Procure a administracao da sua instituicao.',
    );
    this.name = 'AccountAccessBlockedError';
  }
}

const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);
const AuthProfileActionsContext = createContext<
  AuthProfileActionsContextType | undefined
>(undefined);

async function loadProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, platform_role, avatar_url, phone, active')
    .eq('id', userId)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Perfil academico nao encontrado.');
  }

  if (data.active !== true) {
    throw new InactiveProfileError();
  }

  if (
    typeof data.role !== 'string' ||
    !isDatabaseRole(data.role)
  ) {
    throw new Error(
      `Papel invalido recebido do banco: ${String(data.role)}`,
    );
  }

  const platformRole =
    typeof data.platform_role === 'string' &&
    isPlatformRole(data.platform_role)
      ? data.platform_role
      : 'USER';

  if (platformRole !== 'SUPER_ADMIN') {
    await assertActiveAccountAccess(userId);
  }

  return {
    id: data.id,
    full_name: data.full_name,
    email: data.email,
    role: data.role,
    platform_role: platformRole,
    avatar_url: data.avatar_url ?? null,
    phone: data.phone ?? null,
  };
}

function getAccountStatusFromRelation(
  relation: unknown,
): string | null {
  if (
    typeof relation === 'object' &&
    relation !== null &&
    'status' in relation &&
    typeof relation.status === 'string'
  ) {
    return relation.status;
  }

  return null;
}

async function assertActiveAccountAccess(
  userId: string,
): Promise<void> {
  const { data: ownedAccounts, error: ownedAccountsError } =
    await supabase
      .from('accounts')
      .select('id, status')
      .eq('owner_profile_id', userId);

  if (ownedAccountsError) {
    throw ownedAccountsError;
  }

  const { data: memberships, error: membershipsError } =
    await supabase
      .from('memberships')
      .select(
        `
        id,
        active,
        institutions:institution_id (
          id,
          active,
          account_id,
          accounts:account_id (
            id,
            status
          )
        )
      `,
      )
      .eq('profile_id', userId);

  if (membershipsError) {
    throw membershipsError;
  }

  const ownedStatuses = (ownedAccounts ?? [])
    .map((account) => getAccountStatusFromRelation(account))
    .filter((status): status is string => Boolean(status));

  const membershipStatuses = (memberships ?? [])
    .filter((membership) => membership.active === true)
    .map((membership) => {
      const institution = Array.isArray(membership.institutions)
        ? membership.institutions[0]
        : membership.institutions;

      if (!institution || institution.active !== true) {
        return null;
      }

      if (institution.account_id === null) {
        return 'ACTIVE';
      }

      const account = Array.isArray(institution.accounts)
        ? institution.accounts[0]
        : institution.accounts;

      const status = getAccountStatusFromRelation(account);
      return status ?? 'ACTIVE';
    })
    .filter((status): status is string => Boolean(status));

  const accountStatuses = [
    ...ownedStatuses,
    ...membershipStatuses,
  ];

  if (accountStatuses.length === 0) {
    throw new AccountAccessBlockedError();
  }

  if (!accountStatuses.includes('ACTIVE')) {
    throw new AccountAccessBlockedError();
  }
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const userRef = useRef<User | null>(null);
  const profileRef = useRef<Profile | null>(null);
  const profileRequestRef = useRef<ProfileRequest | null>(null);
  const syncVersionRef = useRef(0);

  const setUserState = useCallback((nextUser: User | null) => {
    userRef.current = nextUser;
    setUser(nextUser);
  }, []);

  const setProfileState = useCallback((nextProfile: Profile | null) => {
    profileRef.current = nextProfile;
    setProfile(nextProfile);
  }, []);

  const getProfileForUser = useCallback((userId: string) => {
    const currentRequest = profileRequestRef.current;

    if (currentRequest?.userId === userId) {
      return currentRequest.promise;
    }

    const promise = loadProfile(userId).finally(() => {
      if (profileRequestRef.current?.promise === promise) {
        profileRequestRef.current = null;
      }
    });

    profileRequestRef.current = {
      userId,
      promise,
    };

    return promise;
  }, []);

  const synchronizeSession = useCallback(
    async (
      nextUser: User | null,
      options: SynchronizeSessionOptions = {},
    ): Promise<void> => {
      if (!mountedRef.current) {
        return;
      }

      const syncVersion = syncVersionRef.current + 1;
      syncVersionRef.current = syncVersion;

      if (!nextUser) {
        profileRequestRef.current = null;
        setUserState(null);
        setProfileState(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setUserState(nextUser);

      if (profileRef.current?.id !== nextUser.id) {
        setProfileState(null);
      }

      try {
        const nextProfile = await getProfileForUser(nextUser.id);

        if (
          mountedRef.current &&
          syncVersionRef.current === syncVersion
        ) {
          setProfileState(nextProfile);
        }
      } catch (error) {
        console.error('Erro ao carregar perfil:', error);

        if (
          mountedRef.current &&
          syncVersionRef.current === syncVersion
        ) {
          profileRequestRef.current = null;
          setProfileState(null);

          if (
            error instanceof InactiveProfileError ||
            error instanceof AccountAccessBlockedError
          ) {
            setUserState(null);

            try {
              const { error: signOutError } =
                await supabase.auth.signOut();

              if (signOutError) {
                console.error(
                  'Erro ao encerrar sessao de perfil desativado:',
                  signOutError,
                );
              }
            } catch (signOutError) {
              console.error(
                'Erro ao encerrar sessao de perfil desativado:',
                signOutError,
              );
            }
          }
        }

        if (options.throwOnProfileError) {
          throw error;
        }
      } finally {
        if (
          mountedRef.current &&
          syncVersionRef.current === syncVersion
        ) {
          setLoading(false);
        }
      }
    },
    [
      getProfileForUser,
      setProfileState,
      setUserState,
    ],
  );

  useEffect(() => {
    mountedRef.current = true;
    const authEventTimers = new Set<number>();

    async function restoreSession(): Promise<void> {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error('Erro ao recuperar sessao:', error);

        if (mountedRef.current) {
          setUserState(null);
          setProfileState(null);
          setLoading(false);
        }

        return;
      }

      await synchronizeSession(session?.user ?? null);
    }

    void restoreSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const timerId = window.setTimeout(() => {
        authEventTimers.delete(timerId);
        void synchronizeSession(session?.user ?? null);
      }, 0);

      authEventTimers.add(timerId);
    });

    return () => {
      mountedRef.current = false;
      authEventTimers.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      subscription.unsubscribe();
    };
  }, [
    setProfileState,
    setUserState,
    synchronizeSession,
  ]);

  async function signIn(
    email: string,
    password: string,
  ): Promise<void> {
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

    if (error) {
      throw error;
    }

    await synchronizeSession(
      data.session?.user ?? data.user ?? null,
      {
        throwOnProfileError: true,
      },
    );
  }

  async function signOut(): Promise<void> {
    setLoading(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setLoading(false);
      throw error;
    }

    profileRequestRef.current = null;
    setUserState(null);
    setProfileState(null);
    setLoading(false);
  }

  const updateProfileName = useCallback(
    async (fullName: string): Promise<void> => {
      const currentProfile = profileRef.current;

      if (!currentProfile) {
        throw new ProfileServiceError(
          'SESSION_EXPIRED',
          'Sessão expirada.',
        );
      }

      const updatedProfile = await updateCurrentProfile({
        fullName,
      });

      const latestProfile = profileRef.current;

      if (
        updatedProfile.id !== currentProfile.id ||
        latestProfile?.id !== updatedProfile.id ||
        userRef.current?.id !== updatedProfile.id
      ) {
        throw new ProfileServiceError(
          'PROFILE_UPDATE_FAILED',
          'Perfil atualizado não corresponde ao usuário atual.',
        );
      }

      setProfileState({
        ...latestProfile,
        full_name: updatedProfile.full_name,
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['profile'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['account'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['user-institutions'],
        }),
      ]);
    },
    [queryClient, setProfileState],
  );

  const updatePassword = useCallback(
    async (newPassword: string): Promise<void> => {
      await updateCurrentPassword(newPassword);
    },
    [],
  );

  const updateSelfRegistration = useCallback(
    async (input: SelfRegistrationUpdate): Promise<void> => {
      const currentProfile = profileRef.current;

      if (!currentProfile) {
        throw new ProfileServiceError(
          'SESSION_EXPIRED',
          'Sessão expirada.',
        );
      }

      if (
        (input.role === 'STUDENT' && currentProfile.role !== 'STUDENT') ||
        (input.role === 'GUARDIAN' && currentProfile.role !== 'GUARDIAN')
      ) {
        throw new ProfileServiceError(
          'PROFILE_UPDATE_FAILED',
          'Perfil incompatível com a atualização.',
        );
      }

      const updated = await selfRegistrationService.update(input);
      const latestProfile = profileRef.current;

      if (
        !latestProfile ||
        updated.profile.email !== latestProfile.email ||
        updated.profile.fullName.length === 0
      ) {
        throw new ProfileServiceError(
          'PROFILE_UPDATE_FAILED',
          'Perfil atualizado não corresponde ao usuário atual.',
        );
      }

      setProfileState({
        ...latestProfile,
        full_name: updated.profile.fullName,
        phone: updated.profile.phone,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        queryClient.invalidateQueries({ queryKey: ['student-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['guardian-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['student-registration-completion'] }),
        queryClient.invalidateQueries({ queryKey: ['guardian-registration-completion'] }),
      ]);
    },
    [queryClient, setProfileState],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signOut,
      }}
    >
      <AuthProfileActionsContext.Provider
        value={{
          updateProfileName,
          updateSelfRegistration,
          updatePassword,
        }}
      >
        {children}
      </AuthProfileActionsContext.Provider>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth deve ser usado dentro de AuthProvider.',
    );
  }

  return context;
}

export function useAuthProfileActions(): AuthProfileActionsContextType {
  const context = useContext(AuthProfileActionsContext);

  if (!context) {
    throw new Error(
      'useAuthProfileActions deve ser usado dentro de AuthProvider.',
    );
  }

  return context;
}
