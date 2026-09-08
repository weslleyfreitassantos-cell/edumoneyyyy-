// @vitest-environment jsdom
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
import ForgotPassword from './ForgotPassword';
import { supabase } from '../lib/supabaseClient';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(),
    },
  },
}));

vi.mock('../hooks/useBranding', () => ({
  useResolvedBranding: () => ({
    data: null,
    isLoading: false,
  }),
}));

vi.mock('../contexts/ThemeContext', () => ({
  useThemePreference: () => ({
    theme: 'light',
  }),
}));

describe('ForgotPassword', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();

    delete window.location;
    // @ts-expect-error Override for tests
    window.location = {
      ...originalLocation,
      origin: 'https://app.example.com',
    };
  });

  afterEach(() => {
    cleanup();
    // @ts-expect-error Restore original
    window.location = originalLocation;
  });

  it('renderiza o formulario publico', () => {
    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', {
        name: /Recuperar senha/i,
      }),
    ).toBeDefined();
    expect(
      screen.getByRole('button', {
        name: /Enviar link de recuperação/i,
      }),
    ).toBeDefined();
    expect(
      screen.getByRole('link', {
        name: /Voltar para o login/i,
      }).getAttribute('href'),
    ).toBe('/login');
    expect(
      document.querySelector('video source'),
    ).toBeNull();
  });

  it('valida e-mail invalido antes de chamar Supabase', async () => {
    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/E-mail/i), {
      target: { value: 'email-invalido' },
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: /Enviar link de recuperação/i,
      }),
    );

    expect(
      await screen.findByText('Informe um e-mail valido.'),
    ).toBeDefined();
    expect(
      supabase.auth.resetPasswordForEmail,
    ).not.toHaveBeenCalled();
  });

  it('envia solicitacao valida com redirect da aplicacao', async () => {
    vi.mocked(
      supabase.auth.resetPasswordForEmail,
    ).mockResolvedValueOnce({
      data: {},
      error: null,
    } as never);

    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/E-mail/i), {
      target: { value: '  USUARIO@EXAMPLE.COM  ' },
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: /Enviar link de recuperação/i,
      }),
    );

    await waitFor(() => {
      expect(
        supabase.auth.resetPasswordForEmail,
      ).toHaveBeenCalledWith('usuario@example.com', {
        redirectTo:
          'https://app.example.com/auth/reset-password',
      });
      expect(
        screen.getByText(
          /Se o e-mail estiver cadastrado/i,
        ),
      ).toBeDefined();
    });
  });

  it('mostra loading e bloqueia multiplos envios', async () => {
    let resolveRequest:
      | ((value: { data: {}; error: null }) => void)
      | undefined;

    vi.mocked(
      supabase.auth.resetPasswordForEmail,
    ).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }) as never,
    );

    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/E-mail/i), {
      target: { value: 'user@example.com' },
    });
    const button = screen.getByRole('button', {
      name: /Enviar link de recuperação/i,
    });

    fireEvent.click(button);
    fireEvent.click(button);

    expect(
      supabase.auth.resetPasswordForEmail,
    ).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', {
        name: /Enviando/i,
      }).hasAttribute('disabled'),
    ).toBe(true);

    resolveRequest?.({ data: {}, error: null });

    await waitFor(() => {
      expect(
        screen.getByText(/Se o e-mail estiver cadastrado/i),
      ).toBeDefined();
    });
  });

  it('trata erro temporario sem enumerar usuario', async () => {
    vi.mocked(
      supabase.auth.resetPasswordForEmail,
    ).mockResolvedValueOnce({
      data: {},
      error: { message: 'rate limit exceeded' },
    } as never);

    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/E-mail/i), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: /Enviar link de recuperação/i,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Limite temporario de envio/i),
      ).toBeDefined();
      expect(
        screen.queryByText(/nao cadastrado/i),
      ).toBeNull();
    });
  });

  it('mantem resposta generica para conta inexistente', async () => {
    vi.mocked(
      supabase.auth.resetPasswordForEmail,
    ).mockResolvedValueOnce({
      data: {},
      error: { message: 'user not found' },
    } as never);

    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/E-mail/i), {
      target: { value: 'ausente@example.com' },
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: /Enviar link de recuperação/i,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Se o e-mail estiver cadastrado/i),
      ).toBeDefined();
      expect(screen.queryByText(/user not found/i)).toBeNull();
    });
  });
});
