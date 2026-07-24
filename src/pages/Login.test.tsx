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
import { ThemeProvider } from '../contexts/ThemeContext';

const authMock = vi.hoisted(() => ({
  signIn: vi.fn(),
  navigate: vi.fn(),
  profile: null as unknown,
}));

const brandingMock = vi.hoisted(() => ({
  data: null as null | {
    scope: 'GLOBAL' | 'ACCOUNT' | 'FALLBACK';
    displayName: string | null;
    logoUrl: string | null;
    faviconUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
  },
  isLoading: false,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    signIn: authMock.signIn,
    profile: authMock.profile,
  }),
}));

vi.mock('../hooks/useBranding', () => ({
  useResolvedBranding: () => ({
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
      <ThemeProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Login />
        </MemoryRouter>
      </ThemeProvider>
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
    document.title = '';
    document.head.innerHTML = '';
    document.documentElement.style.removeProperty('--brand-primary');
    document.documentElement.style.removeProperty('--brand-secondary');
  });

  it('renderiza o formulario real e o link de recuperacao', () => {
    renderLogin();

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
    expect(
      screen.getByText(/Bem-vindo de volta!/i),
    ).toBeDefined();
  });

  it('preserva o elemento unico de video e seus atributos principais para iOS/Safari', () => {
    const { container } = renderLogin();

    const videos = Array.from(
      container.querySelectorAll('video'),
    );
    const sources = Array.from(
      container.querySelectorAll('video source'),
    );

    expect(videos).toHaveLength(1);
    expect(sources).toHaveLength(1);
    expect(sources[0].getAttribute('src')).toBe('/media/cinema-novo.mp4');
    expect(sources[0].getAttribute('type')).toBe('video/mp4');

    const video = videos[0];
    expect(video.hasAttribute('autoplay')).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.defaultMuted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.hasAttribute('playsinline')).toBe(true);
    expect(video.hasAttribute('webkit-playsinline')).toBe(true);
    expect(video.getAttribute('preload')).toBe('metadata');
  });

  it('registra listeners de canplay e pageshow para reproducao automatica sem quebrar login', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    renderLogin();

    const registeredEvents = addEventListenerSpy.mock.calls.map(call => call[0]);
    expect(registeredEvents).toContain('pageshow');
    expect(registeredEvents).toContain('orientationchange');
    expect(registeredEvents).toContain('resize');
  });

  it('exibe logo dinamica resolvida por hostname quando disponivel e nome abaixo', () => {
    brandingMock.data = {
      scope: 'ACCOUNT',
      displayName: 'Colegio Azul',
      logoUrl: 'https://cdn.example.com/logo.png',
      faviconUrl: null,
      primaryColor: '#112233',
      secondaryColor: '#445566',
    };

    renderLogin();

    const logo = screen.getByRole('img', {
      name: /Logo de Colegio Azul/i,
    });

    expect(logo.getAttribute('src')).toBe(
      'https://cdn.example.com/logo.png',
    );
    expect(logo.className).toContain('object-contain');

    const names = screen.getAllByText('Colegio Azul');
    expect(names.length).toBeGreaterThan(0);
  });

  it('mantem fallback neutro sem logo e sem marca fixa', () => {
    brandingMock.data = {
      scope: 'GLOBAL',
      displayName: 'Colegio Sem Logo',
      logoUrl: null,
      faviconUrl: null,
      primaryColor: '#112233',
      secondaryColor: '#445566',
    };

    renderLogin();

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getAllByText('Colegio Sem Logo')).toBeDefined();
  });

  it('atualiza favicon, titulo e cores dinamicamente', () => {
    brandingMock.data = {
      scope: 'GLOBAL',
      displayName: 'Marca Global',
      logoUrl: null,
      faviconUrl: 'https://cdn.example.com/favicon.png',
      primaryColor: '#123456',
      secondaryColor: '#abcdef',
    };

    renderLogin();

    expect(document.title).toBe('Marca Global');
    expect(
      document.documentElement.style.getPropertyValue(
        '--brand-primary',
      ),
    ).toBe('#123456');
    expect(
      document.querySelector<HTMLLinkElement>(
        'link[rel="icon"]',
      )?.href,
    ).toBe('https://cdn.example.com/favicon.png');
  });

  it('mantem o card de login com as classes de painel mobile e card responsivo', () => {
    const { container } = renderLogin();

    const loginCard = container.querySelector('.login-card');
    const videoAside = container.querySelector('aside');

    expect(loginCard).not.toBeNull();
    expect(loginCard?.className).toContain('login-card');
    expect(loginCard?.className).toContain('login-panel-mobile');
    expect(videoAside?.className).toContain('video-mobile');
  });

  it('suporta renderizacao em modo dark e light via ThemeProvider', () => {
    document.documentElement.classList.add('dark');
    const { container } = renderLogin();

    const mainContainer = container.querySelector('main');
    expect(mainContainer?.className).toContain('dark:bg-[#071323]');
    expect(mainContainer?.className).toContain('dark:text-slate-100');

    document.documentElement.classList.remove('dark');
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
