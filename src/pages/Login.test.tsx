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
import { Login } from './Login';

const authMock = vi.hoisted(() => ({
  signIn: vi.fn(),
  navigate: vi.fn(),
  profile: null as unknown,
}));

const brandingMock = vi.hoisted(() => ({
  data: null as null | {
    name: string;
    logoUrl: string | null;
    publicSlug: string;
  },
  isLoading: false,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    signIn: authMock.signIn,
    profile: authMock.profile,
  }),
}));

vi.mock('../hooks/useInstitutionBranding', () => ({
  usePublicInstitutionBranding: () => ({
    data: brandingMock.data,
    isLoading: brandingMock.isLoading,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');

  return {
    ...actual,
    useNavigate: () => authMock.navigate,
  };
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function renderLogin(initialEntry = '/login') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Login />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.profile = null;
    authMock.signIn.mockResolvedValue(undefined);
    brandingMock.data = null;
    brandingMock.isLoading = false;
  });

  afterEach(() => {
    cleanup();
  });

  it('renderiza o formulario real e o link de recuperacao', () => {
    renderLogin();

    expect(
      screen.queryByText('EduManager Pro'),
    ).toBeNull();
    expect(screen.queryByText('EduManager')).toBeNull();
    expect(
      screen.queryByText(/Bem-vindo ao EduManager Pro/i),
    ).toBeNull();
    expect(
      screen.queryByText(/Bem-vindo de volta/i),
    ).toBeNull();
    expect(
      screen.queryByText(/Entre para acessar/i),
    ).toBeNull();
    expect(
      screen.getByLabelText(/E-mail institucional/i),
    ).toBeDefined();
    expect(screen.getByLabelText('Senha')).toBeDefined();
    expect(
      screen
        .getByRole('link', {
          name: /Esqueci minha senha/i,
        })
        .getAttribute('href'),
    ).toBe('/forgot-password');
  });

  it('preserva o video atual e seus atributos principais', () => {
    const { container } = renderLogin();

    const videos = Array.from(
      container.querySelectorAll('video'),
    );
    const sources = Array.from(
      container.querySelectorAll('video source'),
    );

    expect(videos).toHaveLength(2);
    expect(sources).toHaveLength(2);
    expect(
      sources.every(
        (source) =>
          source.getAttribute('src') ===
          '/media/cinema-novo.mp4',
      ),
    ).toBe(true);
    expect(
      sources.every(
        (source) =>
          source.getAttribute('type') === 'video/mp4',
      ),
    ).toBe(true);
    expect(videos[0].hasAttribute('autoplay')).toBe(true);
    expect(videos[0].muted).toBe(true);
    expect(videos[0].loop).toBe(true);
    expect(
      videos.every((video) =>
        video.hasAttribute('playsinline'),
      ),
    ).toBe(true);
    expect(
      videos.every(
        (video) =>
          video.getAttribute('preload') === 'auto',
      ),
    ).toBe(true);
  });

  it('exibe logo dinamica da instituicao quando disponivel', () => {
    brandingMock.data = {
      name: 'Colegio Azul',
      logoUrl: 'https://cdn.example.com/logo.png',
      publicSlug: 'colegio-azul',
    };

    renderLogin('/login?institution=colegio-azul');

    const logo = screen.getByRole('img', {
      name: /Logo da instituicao Colegio Azul/i,
    });

    expect(logo.getAttribute('src')).toBe(
      'https://cdn.example.com/logo.png',
    );
    expect(logo.className).toContain('object-contain');
  });

  it('mantem fallback neutro sem logo e sem marca fixa', () => {
    brandingMock.data = {
      name: 'Colegio Sem Logo',
      logoUrl: null,
      publicSlug: 'colegio-sem-logo',
    };

    renderLogin('/login?institution=colegio-sem-logo');

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText(/EduManager/i)).toBeNull();
    expect(screen.queryByText(/Logo/i)).toBeNull();
  });

  it('mantem o card de login sobreposto ao video por classe dedicada', () => {
    const { container } = renderLogin();

    const loginCard = container.querySelector('.login-card');
    const videoAside = container.querySelector('aside');

    expect(loginCard).not.toBeNull();
    expect(loginCard?.className).toContain('login-card');
    expect(videoAside?.className).toContain('h-[260px]');
    expect(videoAside?.className).toContain('lg:min-h-dvh');
  });

  it('submete o login usando o useAuth', async () => {
    renderLogin();

    fireEvent.change(
      screen.getByLabelText(/E-mail institucional/i),
      {
        target: { value: 'admin@example.com' },
      },
    );
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'StrongPass123!' },
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: /Entrar no sistema/i,
      }),
    );

    await waitFor(() => {
      expect(authMock.signIn).toHaveBeenCalledWith(
        'admin@example.com',
        'StrongPass123!',
      );
    });
  });

  it('mostra loading durante o envio', async () => {
    let resolveLogin:
      | ((value: undefined) => void)
      | undefined;
    authMock.signIn.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );

    renderLogin();

    fireEvent.change(
      screen.getByLabelText(/E-mail institucional/i),
      {
        target: { value: 'admin@example.com' },
      },
    );
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'StrongPass123!' },
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: /Entrar no sistema/i,
      }),
    );

    expect(
      screen.getByRole('button', {
        name: /Entrando/i,
      }).hasAttribute('disabled'),
    ).toBe(true);

    resolveLogin?.(undefined);

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /Entrar no sistema/i,
        }),
      ).toBeDefined();
    });
  });

  it('exibe erro de autenticacao sem quebrar o formulario', async () => {
    authMock.signIn.mockRejectedValueOnce(
      new Error('Credenciais invalidas'),
    );

    renderLogin();

    fireEvent.change(
      screen.getByLabelText(/E-mail institucional/i),
      {
        target: { value: 'admin@example.com' },
      },
    );
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'wrong-password' },
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: /Entrar no sistema/i,
      }),
    );

    expect(
      await screen.findByRole('alert'),
    ).toBeDefined();
    expect(
      screen.getByLabelText(/E-mail institucional/i),
    ).toBeDefined();
  });

  it('alterna a visibilidade da senha com botao acessivel', () => {
    renderLogin();

    const passwordInput = screen.getByLabelText(
      'Senha',
    ) as HTMLInputElement;

    expect(passwordInput.type).toBe('password');

    fireEvent.click(
      screen.getByRole('button', {
        name: /Mostrar senha/i,
      }),
    );

    expect(passwordInput.type).toBe('text');

    fireEvent.click(
      screen.getByRole('button', {
        name: /Ocultar senha/i,
      }),
    );

    expect(passwordInput.type).toBe('password');
  });

  it('nao renderiza controles ficticios de demo', () => {
    renderLogin();

    expect(screen.queryByText(/Lembrar de mim/i)).toBeNull();
    expect(screen.queryByText(/credenciais de demo/i)).toBeNull();
    expect(screen.queryByText(/Entrar como/i)).toBeNull();
  });

  it('redireciona para dashboard quando ha perfil autenticado', async () => {
    authMock.profile = {
      id: 'profile-1',
    };

    renderLogin();

    await waitFor(() => {
      expect(authMock.navigate).toHaveBeenCalledWith('/dashboard');
    });
  });
});
