import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';

import { supabase } from '../lib/supabaseClient';
import {
  isDatabaseRole,
  isPlatformRole,
  type DatabaseRole,
  type PlatformRole,
} from '../lib/roles';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: DatabaseRole;
  platform_role: PlatformRole;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

interface ProfileRequest {
  userId: string;
  promise: Promise<Profile>;
}

const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

async function loadProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, platform_role, avatar_url')
    .eq('id', userId)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Perfil academico nao encontrado.');
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

  return {
    id: data.id,
    full_name: data.full_name,
    email: data.email,
    role: data.role,
    platform_role: platformRole,
    avatar_url: data.avatar_url ?? null,
  };
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
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
    async (nextUser: User | null): Promise<void> => {
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

      if (
        userRef.current?.id === nextUser.id &&
        profileRef.current?.id === nextUser.id
      ) {
        setUserState(nextUser);
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
          setProfileState(null);
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

    await synchronizeSession(data.session?.user ?? data.user ?? null);
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
      {children}
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
