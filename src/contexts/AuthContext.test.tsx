// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
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

  const single = vi.fn().mockResolvedValue({
    data: {
      id: 'user-1',
      full_name: 'Ana Silva',
      email: 'ana@example.com',
      role: 'ADMIN',
      platform_role: 'USER',
      avatar_url: null,
      active: true,
    },
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  vi.mocked(supabase.from).mockReturnValue({ select } as never);
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
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'user-1',
        full_name: 'Ana Silva',
        email: 'ana@example.com',
        role: 'ADMIN',
        platform_role: 'USER',
        avatar_url: null,
        active: false,
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    vi.mocked(supabase.from).mockReturnValue({ select } as never);

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
});
