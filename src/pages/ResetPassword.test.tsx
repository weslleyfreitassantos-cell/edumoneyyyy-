// @vitest-environment jsdom
import { StrictMode } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import ResetPassword from './ResetPassword';
import { supabase } from '../lib/supabaseClient';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(),
      signOut: vi.fn(),
      setSession: vi.fn(),
      verifyOtp: vi.fn(),
      getUser: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}));

const recoveryUser = {
  id: 'user-123',
  email: 'user@example.com',
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ResetPassword />
    </MemoryRouter>,
  );
}

function renderStrictPage() {
  return render(
    <StrictMode>
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    </StrictMode>,
  );
}

function mockValidUser(): void {
  vi.mocked(supabase.auth.getUser).mockResolvedValue({
    data: { user: recoveryUser },
    error: null,
  } as never);
}

function seedRecoveryContext(): void {
  sessionStorage.setItem(
    'password_recovery_context',
    JSON.stringify({
      userId: recoveryUser.id,
      email: recoveryUser.email,
      verifiedAt: Date.now(),
      purpose: 'recovery',
    }),
  );
}

describe('ResetPassword', () => {
  const originalLocation = window.location;
  const unsubscribe = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    unsubscribe.mockReset();

    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        ...originalLocation,
        hash: '',
        pathname: '/auth/reset-password',
        search: '',
      },
    });
    window.history.replaceState = vi.fn();

    vi.mocked(
      supabase.auth.onAuthStateChange,
    ).mockImplementation(() => ({
      data: {
        subscription: {
          unsubscribe,
        },
      },
    }) as never);
    vi.mocked(supabase.auth.signOut).mockResolvedValue({} as never);
    vi.mocked(supabase.auth.setSession).mockResolvedValue({
      error: null,
    } as never);
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
      error: null,
    } as never);
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      error: null,
    } as never);
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('valida token_hash com type recovery', async () => {
    window.location.search =
      '?token_hash=recovery-token&type=recovery';
    mockValidUser();

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: /Definir nova senha/i,
        }),
      ).toBeDefined();
      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
        token_hash: 'recovery-token',
        type: 'recovery',
      });
      expect(supabase.auth.setSession).not.toHaveBeenCalled();
      expect(window.history.replaceState).toHaveBeenCalledWith(
        null,
        '',
        '/auth/reset-password',
      );
      expect(
        sessionStorage.getItem('password_recovery_context'),
      ).toBeTruthy();
    });
  });

  it('valida token_hash uma unica vez em Strict Mode', async () => {
    window.location.search =
      '?token_hash=recovery-token&type=recovery';
    mockValidUser();

    renderStrictPage();

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: /Definir nova senha/i,
        }),
      ).toBeDefined();
      expect(supabase.auth.verifyOtp).toHaveBeenCalledTimes(1);
    });
  });

  it('valida hash legado com access e refresh token', async () => {
    window.location.hash =
      '#access_token=access&refresh_token=refresh&type=recovery';
    mockValidUser();

    renderPage();

    await waitFor(() => {
      expect(supabase.auth.setSession).toHaveBeenCalledWith({
        access_token: 'access',
        refresh_token: 'refresh',
      });
      expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
      expect(
        screen.getByRole('heading', {
          name: /Definir nova senha/i,
        }),
      ).toBeDefined();
    });
  });

  it('limpa a URL quando setSession falha no hash legado', async () => {
    window.location.hash =
      '#access_token=access&refresh_token=refresh&type=recovery';
    vi.mocked(supabase.auth.setSession).mockResolvedValueOnce({
      error: { message: 'expired token' },
    } as never);

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(
          /Link de recuperacao invalido, expirado ou ja utilizado/i,
        ),
      ).toBeDefined();
      expect(window.history.replaceState).toHaveBeenCalledWith(
        null,
        '',
        '/auth/reset-password',
      );
    });
  });

  it('aceita evento PASSWORD_RECOVERY quando emitido pelo cliente', async () => {
    mockValidUser();
    vi.mocked(
      supabase.auth.onAuthStateChange,
    ).mockImplementation((callback) => {
      callback('PASSWORD_RECOVERY' as never, {
        user: recoveryUser,
      } as never);

      return {
        data: {
          subscription: {
            unsubscribe,
          },
        },
      } as never;
    });

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: /Definir nova senha/i,
        }),
      ).toBeDefined();
      expect(
        sessionStorage.getItem('password_recovery_context'),
      ).toBeTruthy();
    });
  });

  it('ignora evento de sessao comum sem recuperacao', async () => {
    vi.mocked(
      supabase.auth.onAuthStateChange,
    ).mockImplementation((callback) => {
      callback('SIGNED_IN' as never, {
        user: recoveryUser,
      } as never);

      return {
        data: {
          subscription: {
            unsubscribe,
          },
        },
      } as never;
    });

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(/Sessao de recuperacao ausente/i),
      ).toBeDefined();
      expect(
        sessionStorage.getItem('password_recovery_context'),
      ).toBeNull();
    });
  });

  it('remove listener de autenticacao no cleanup', () => {
    const { unmount } = renderPage();

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('rejeita token_hash invalido ou expirado', async () => {
    window.location.search =
      '?token_hash=recovery-token&type=recovery';
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValueOnce({
      error: { message: 'expired token' },
    } as never);

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(
          /Link de recuperacao invalido, expirado ou ja utilizado/i,
        ),
      ).toBeDefined();
      expect(window.history.replaceState).toHaveBeenCalledWith(
        null,
        '',
        '/auth/reset-password',
      );
    });
  });

  it('rejeita token_hash sem type recovery', async () => {
    window.location.search = '?token_hash=recovery-token';

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(/Tipo de link de recuperacao incorreto/i),
      ).toBeDefined();
      expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
      expect(window.history.replaceState).toHaveBeenCalledWith(
        null,
        '',
        '/auth/reset-password',
      );
    });
  });

  it('rejeita tipo invite na rota de recuperacao', async () => {
    window.location.search =
      '?token_hash=invite-token&type=invite';

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(/Tipo de link de recuperacao incorreto/i),
      ).toBeDefined();
      expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
    });
  });

  it('rejeita token parcial no hash legado', async () => {
    window.location.hash = '#access_token=access&type=recovery';

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(/invalido ou incompleto/i),
      ).toBeDefined();
      expect(supabase.auth.setSession).not.toHaveBeenCalled();
    });
  });

  it('rejeita refresh token sem access token no hash legado', async () => {
    window.location.hash = '#refresh_token=refresh&type=recovery';

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(/invalido ou incompleto/i),
      ).toBeDefined();
      expect(supabase.auth.setSession).not.toHaveBeenCalled();
      expect(window.history.replaceState).toHaveBeenCalledWith(
        null,
        '',
        '/auth/reset-password',
      );
    });
  });

  it('bloqueia acesso sem tokens ou contexto', async () => {
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(/Sessao de recuperacao ausente/i),
      ).toBeDefined();
    });
  });

  it('rejeita sessao autenticada comum sem recovery', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: recoveryUser },
      error: null,
    } as never);

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(/Sessao de recuperacao ausente/i),
      ).toBeDefined();
      expect(
        screen.queryByRole('heading', {
          name: /Definir nova senha/i,
        }),
      ).toBeNull();
      expect(supabase.auth.getUser).not.toHaveBeenCalled();
      expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    });
  });

  it('mantem formulario apos refresh com contexto valido', async () => {
    seedRecoveryContext();
    mockValidUser();

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: /Definir nova senha/i,
        }),
      ).toBeDefined();
    });
  });

  it('valida senha fraca e confirmacao diferente', async () => {
    seedRecoveryContext();
    mockValidUser();

    renderPage();

    await screen.findByRole('heading', {
      name: /Definir nova senha/i,
    });

    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: '123' },
    });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
      target: { value: '123' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Atualizar senha/i }),
    );

    expect(
      await screen.findByRole('alert'),
    ).toBeDefined();

    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'StrongPass123!' },
    });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
      target: { value: 'OutraSenha123!' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Atualizar senha/i }),
    );

    expect(
      await screen.findByText(/nao sao iguais/i),
    ).toBeDefined();
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it('atualiza senha com sucesso e encerra sessao temporaria', async () => {
    seedRecoveryContext();
    mockValidUser();

    renderPage();

    await screen.findByRole('heading', {
      name: /Definir nova senha/i,
    });

    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'StrongPass123!' },
    });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
      target: { value: 'StrongPass123!' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Atualizar senha/i }),
    );

    await waitFor(() => {
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'StrongPass123!',
      });
      expect(supabase.auth.signOut).toHaveBeenCalledWith({
        scope: 'local',
      });
      expect(
        sessionStorage.getItem('password_recovery_context'),
      ).toBeNull();
      expect(
        screen.getByText(/Agora voce pode entrar/i),
      ).toBeDefined();
      expect(
        screen
          .getByRole('link', { name: /Ir para o login/i })
          .getAttribute('href'),
      ).toBe('/login');
    });
  });

  it('mantem sucesso quando signOut local falha apos updateUser', async () => {
    seedRecoveryContext();
    mockValidUser();
    vi.mocked(supabase.auth.signOut).mockRejectedValueOnce(
      new Error('network'),
    );

    renderPage();

    await screen.findByRole('heading', {
      name: /Definir nova senha/i,
    });

    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'StrongPass123!' },
    });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
      target: { value: 'StrongPass123!' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Atualizar senha/i }),
    );

    await waitFor(() => {
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'StrongPass123!',
      });
      expect(
        screen.getByText(/Agora voce pode entrar/i),
      ).toBeDefined();
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('trata falha de updateUser sem expor erro interno', async () => {
    seedRecoveryContext();
    mockValidUser();
    vi.mocked(supabase.auth.updateUser).mockResolvedValueOnce({
      error: { message: 'weak password from server' },
    } as never);

    renderPage();

    await screen.findByRole('heading', {
      name: /Definir nova senha/i,
    });

    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'StrongPass123!' },
    });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
      target: { value: 'StrongPass123!' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Atualizar senha/i }),
    );

    expect(
      (await screen.findByRole('alert')).textContent,
    ).toMatch(/criterios minimos/i);
    expect(screen.queryByText(/from server/i)).toBeNull();
  });

  it('bloqueia envio duplicado durante atualizacao', async () => {
    seedRecoveryContext();
    mockValidUser();
    let resolveUpdate:
      | ((value: { error: null }) => void)
      | undefined;
    vi.mocked(supabase.auth.updateUser).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }) as never,
    );

    renderPage();

    await screen.findByRole('heading', {
      name: /Definir nova senha/i,
    });

    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'StrongPass123!' },
    });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
      target: { value: 'StrongPass123!' },
    });

    const button = screen.getByRole('button', {
      name: /Atualizar senha/i,
    });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => {
      expect(supabase.auth.updateUser).toHaveBeenCalledTimes(1);
    });

    resolveUpdate?.({ error: null });

    await waitFor(() => {
      expect(
        screen.getByText(/Senha atualizada com sucesso/i),
      ).toBeDefined();
    });
  });

  it('trata sessao expirada durante preenchimento', async () => {
    seedRecoveryContext();
    vi.mocked(supabase.auth.getUser)
      .mockResolvedValueOnce({
        data: { user: recoveryUser },
        error: null,
      } as never)
      .mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'session expired' },
      } as never);

    renderPage();

    await screen.findByRole('heading', {
      name: /Definir nova senha/i,
    });

    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'StrongPass123!' },
    });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
      target: { value: 'StrongPass123!' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Atualizar senha/i }),
    );

    expect(
      await screen.findByText(/Sessao de recuperacao expirada/i),
    ).toBeDefined();
  });
});
