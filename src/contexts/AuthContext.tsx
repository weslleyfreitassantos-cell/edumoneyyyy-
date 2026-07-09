import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';

import { supabase } from '../lib/supabaseClient';
import {
  isDatabaseRole,
  type DatabaseRole,
} from '../lib/roles';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: DatabaseRole;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

async function loadProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, avatar_url')
    .eq('id', userId)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Perfil acadêmico não encontrado.');
  }

  if (
    typeof data.role !== 'string' ||
    !isDatabaseRole(data.role)
  ) {
    throw new Error(
      `Papel inválido recebido do banco: ${String(data.role)}`,
    );
  }

  return {
    id: data.id,
    full_name: data.full_name,
    email: data.email,
    role: data.role,
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

  useEffect(() => {
    let active = true;

    async function synchronizeSession(
      nextUser: User | null,
    ): Promise<void> {
      if (!active) {
        return;
      }

      setLoading(true);
      setUser(nextUser);
      setProfile(null);

      if (!nextUser) {
        setLoading(false);
        return;
      }

      try {
        const nextProfile = await loadProfile(nextUser.id);

        if (active) {
          setProfile(nextProfile);
        }
      } catch (error) {
        console.error('Erro ao carregar perfil:', error);

        if (active) {
          setProfile(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    async function restoreSession(): Promise<void> {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error('Erro ao recuperar sessão:', error);

        if (active) {
          setUser(null);
          setProfile(null);
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
      void synchronizeSession(session?.user ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn(
    email: string,
    password: string,
  ): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      throw error;
    }
  }

  async function signOut(): Promise<void> {
    setLoading(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setLoading(false);
      throw error;
    }

    setUser(null);
    setProfile(null);
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