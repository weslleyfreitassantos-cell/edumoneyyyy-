// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { useState } from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { supabase } from '../lib/supabaseClient';
import {
  updateCurrentPassword,
  updateCurrentProfile,
} from '../services/profileService';
import {
  AuthProvider,
  useAuth,
  useAuthProfileActions,
} from './AuthContext';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  },
}));

vi.mock('../services/profileService', async () => {
  const actual = await vi.importActual<
    typeof import('../services/profileService')
  >('../services/profileService');

  return {
    ...actual,
    updateCurrentProfile: vi.fn(),
    updateCurrentPassword: vi.fn(),
  };
});

const authUser = {
  id: 'user-1',
  email: 'ana@example.com',
} as User;

function mockAuthQueries({
  profile = {
    id: 'user-1',
    full_name: 'Ana Silva',
    email: 'ana@example.com',
    role: 'ADMIN',
    platform_role: 'USER',
    avatar_url: null,
    active: true,
  },
  ownedAccounts = [
    {
      id: 'account-1',
      status: 'ACTIVE',
    },
  ],
  memberships = [],
}: {
  profile?: Record<string, unknown>;
  ownedAccounts?: Record<string, unknown>[];
  memberships?: Record<string, unknown>[];
} = {}) {
  vi.mocked(supabase.from).mockImplementation((table) => {
    if (table === 'profiles') {
      const single = vi.fn().mockResolvedValue({
        data: profile,
        error: null,
      });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });

      return { select } as never;
    }

    if (table === 'accounts') {
      const eq = vi.fn().mockResolvedValue({
        data: ownedAccounts,
        error: null,
      });
      const select = vi.fn().mockReturnValue({ eq });

      return { select } as never;
    }

    if (table === 'memberships') {
      const eq = vi.fn().mockResolvedValue({
        data: memberships,
        error: null,
      });
      const select = vi.fn().mockReturnValue({ eq });

      return { select } as never;
    }

    throw new Error(`Tabela nao mockada: ${String(table)}`);
  });
}

function ProfileProbe() {
  const { profile, signOut } = useAuth();
  const { updateProfileName, updatePassword } =
    useAuthProfileActions();

  if (!profile) {
    return <p>Carregando perfil</p>;
  }

  return (
    <div>
      <p>{profile.full_name}</p>
      <p>{profile.email}</p>
      <p>{profile.role}</p>
      <p>{profile.platform_role}</p>
      <button
        type="button"
        onClick={() =>
          void updateProfileName('  Novo Nome  ').catch(
            () => undefined,
          )
        }
      >
        Atualizar nome
      </button>
      <button
        type="button"
        onClick={() => void updatePassword('SenhaSegura123!')}
      >
        Atualizar senha
      </button>
      <button type="button" onClick={() => void signOut()}>
        Sair
      </button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: {
      session: { user: authUser },
    },
    error: null,
  } as never);
  vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
    data: {
      subscription: { unsubscribe: vi.fn() },
    },
  } as never);
  vi.mocked(supabase.auth.signOut).mockResolvedValue({
    error: null,
  } as never);

  mockAuthQueries();
});

afterEach(() => {
  cleanup();
});

describe('AuthProfileActionsContext', () => {
  it('atualiza o nome no contexto e preserva e-mail e papéis', async () => {
    vi.mocked(updateCurrentProfile).mockResolvedValue({
      id: 'user-1',
      full_name: 'Novo Nome',
    });

    render(
      <AuthProvider>
        <ProfileProbe />
      </AuthProvider>,
    );

    await screen.findByText('Ana Silva');
    fireEvent.click(
      screen.getByRole('button', { name: 'Atualizar nome' }),
    );

    await waitFor(() => {
      expect(updateCurrentProfile).toHaveBeenCalledWith({
        fullName: '  Novo Nome  ',
      });
      expect(screen.getByText('Novo Nome')).toBeTruthy();
    });

    expect(screen.getByText('ana@example.com')).toBeTruthy();
    expect(screen.getByText('ADMIN')).toBeTruthy();
    expect(screen.getByText('USER')).toBeTruthy();
  });

  it('encaminha a senha sem persistir no perfil global', async () => {
    vi.mocked(updateCurrentPassword).mockResolvedValue(undefined);

    render(
      <AuthProvider>
        <ProfileProbe />
      </AuthProvider>,
    );

    await screen.findByText('Ana Silva');
    fireEvent.click(
      screen.getByRole('button', { name: 'Atualizar senha' }),
    );

    await waitFor(() => {
      expect(updateCurrentPassword).toHaveBeenCalledWith(
        'SenhaSegura123!',
      );
    });

    expect(screen.getByText('Ana Silva')).toBeTruthy();
  });

  it('não restaura um perfil quando a atualização termina após o logout', async () => {
    let resolveProfile:
      | ((value: { id: string; full_name: string }) => void)
      | undefined;
    vi.mocked(updateCurrentProfile).mockReturnValue(
      new Promise((resolve) => {
        resolveProfile = resolve;
      }),
    );

    render(
      <AuthProvider>
        <ProfileProbe />
      </AuthProvider>,
    );

    await screen.findByText('Ana Silva');
    fireEvent.click(
      screen.getByRole('button', { name: 'Atualizar nome' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Sair' }),
    );

    await screen.findByText('Carregando perfil');
    resolveProfile?.({
      id: 'user-1',
      full_name: 'Nome Tardio',
    });

    await waitFor(() => {
      expect(screen.queryByText('Nome Tardio')).toBeNull();
      expect(screen.getByText('Carregando perfil')).toBeTruthy();
    });
  });

  it('encerra a sessao restaurada quando o perfil esta desativado', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockAuthQueries({
      profile: {
        id: 'user-1',
        full_name: 'Ana Silva',
        email: 'ana@example.com',
        role: 'ADMIN',
        platform_role: 'USER',
        avatar_url: null,
        active: false,
      },
    });

    try {
      render(
        <AuthProvider>
          <ProfileProbe />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(supabase.auth.signOut).toHaveBeenCalled();
      });

      expect(screen.getByText('Carregando perfil')).toBeTruthy();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('bloqueia login quando a conta vinculada foi excluida', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: null,
      },
      error: null,
    } as never);
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: {
        user: authUser,
        session: { user: authUser },
      },
      error: null,
    } as never);
    mockAuthQueries({
      ownedAccounts: [
        {
          id: 'account-1',
          status: 'CANCELED',
        },
      ],
    });

    function SignInProbe() {
      const { signIn, profile } = useAuth();
      const [message, setMessage] = useState('');

      return (
        <div>
          <p>{profile?.full_name ?? 'Sem perfil'}</p>
          <p>{message}</p>
          <button
            type="button"
            onClick={() =>
              void signIn('ana@example.com', 'senha').catch(
                (error: unknown) => {
                  setMessage(
                    error instanceof Error
                      ? error.message
                      : 'Falha no login',
                  );
                },
              )
            }
          >
            Entrar
          </button>
        </div>
      );
    }

    try {
      render(
        <AuthProvider>
          <SignInProbe />
        </AuthProvider>,
      );

      await screen.findByText('Sem perfil');
      fireEvent.click(
        screen.getByRole('button', { name: 'Entrar' }),
      );

      await waitFor(() => {
        expect(supabase.auth.signOut).toHaveBeenCalled();
        expect(
          screen.getByText(
            'Voce nao tem acesso a esta plataforma. Procure a administracao da sua instituicao.',
          ),
        ).toBeTruthy();
      });

      expect(screen.getByText('Sem perfil')).toBeTruthy();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
