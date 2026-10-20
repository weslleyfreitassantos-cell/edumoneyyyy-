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
  signOut: vi.fn(),
  navigate: vi.fn(),
  profile: null as unknown,
}));

const brandingMock = vi.hoisted(() => ({
  data: null as null | {
    scope: 'GLOBAL' | 'ACCOUNT' | 'INSTITUTION' | 'FALLBACK';
    displayName: string | null;
    documentTitle?: string | null;
    logoUrl: string | null;
    faviconUrl: string | null;
    loginBackgroundUrl?: string | null;
    primaryColor: string;
    secondaryColor: string;
  },
  isLoading: false,
  isInitialBrandingLoading: false,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    signIn: authMock.signIn,
    signOut: authMock.signOut,
    profile: authMock.profile,
  }),
}));

vi.mock('../hooks/useBranding', () => ({
  useResolvedBranding: () => ({
    data: brandingMock.data,
    isLoading: brandingMock.isLoading,
    isInitialBrandingLoading: brandingMock.isInitialBrandingLoading,
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
    authMock.signOut.mockResolvedValue(undefined);
    brandingMock.data = null;
    brandingMock.isLoading = false;
    brandingMock.isInitialBrandingLoading = false;
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
      screen.getByText(/Seja bem-vindo!/i),
    ).toBeDefined();
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

  it('aplica o background publico da instituicao na tela inteira', () => {
    brandingMock.data = {
      scope: 'ACCOUNT',
      displayName: 'Colegio Azul',
      logoUrl: null,
      faviconUrl: null,
      loginBackgroundUrl: 'https://cdn.example.com/background.jpg?v=1',
      primaryColor: '#112233',
      secondaryColor: '#445566',
    };

    const { container } = renderLogin();
    const loginShell = container.firstElementChild;

    expect(loginShell?.getAttribute('style')).toContain(
      'background-image: url("https://cdn.example.com/background.jpg?v=1"), url("/media/ff2-optimized.webp")',
    );
    expect(loginShell?.getAttribute('style')).toContain('background-size: cover');
    expect(loginShell?.getAttribute('style')).toContain('background-position: center');
  });

  it('oculta o login inteiro e mostra a bolinha durante o carregamento inicial do branding', () => {
    brandingMock.isLoading = true;
    brandingMock.isInitialBrandingLoading = true;

    renderLogin();

    expect(
      screen.getByRole('status', { name: /carregando identidade visual/i }),
    ).toBeTruthy();
    expect(screen.queryByLabelText(/E-mail institucional/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /Entrar no sistema/i })).toBeNull();
  });

  it('mantem o login oculto enquanto os assets do cache ainda estao carregando', () => {
    brandingMock.data = {
      scope: 'INSTITUTION',
      displayName: 'Colégio Azul',
      logoUrl: 'https://cdn.example.com/logo.png',
      faviconUrl: null,
      loginBackgroundUrl: 'https://cdn.example.com/background.png',
      primaryColor: '#112233',
      secondaryColor: '#445566',
    };
    brandingMock.isInitialBrandingLoading = true;

    renderLogin();

    expect(
      screen.getByRole('status', { name: /carregando identidade visual/i }),
    ).toBeTruthy();
    expect(screen.queryByLabelText(/E-mail institucional/i)).toBeNull();
    expect(screen.queryByRole('img', { name: /Logo de Colégio Azul/i })).toBeNull();
  });

  it('continua permitindo login se a consulta inicial de branding falhar', () => {
    brandingMock.isLoading = false;

    renderLogin();

    expect(screen.getByLabelText(/E-mail institucional/i)).toBeTruthy();
    expect(screen.queryByRole('status', { name: /carregando identidade visual/i })).toBeNull();
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

  it('usa o nome da escola do subdomínio no título da aba', () => {
    brandingMock.data = {
      scope: 'INSTITUTION',
      displayName: 'Portal Acadêmico',
      documentTitle: 'Colégio Helita Vieira',
      logoUrl: null,
      faviconUrl: null,
      primaryColor: '#123456',
      secondaryColor: '#abcdef',
    };

    renderLogin();

    expect(document.title).toBe('Colégio Helita Vieira');
    expect(screen.getAllByText('Portal Acadêmico').length).toBeGreaterThan(0);
  });

  it('renderiza o formulario centralizado sem hero', () => {
    const { container } = renderLogin();

    expect(container.querySelector('aside')).toBeNull();
    expect(container.querySelector('form')).not.toBeNull();
    expect(screen.getByText('Seja bem-vindo!')).toBeDefined();
  });

  it('suporta renderizacao em modo dark e light via ThemeProvider', () => {
    localStorage.setItem('edumanager.theme', 'dark');
    const { container } = renderLogin();

    const heading = container.querySelector('h1');
    expect(heading?.className).toContain('dark:text-white');
    expect(heading?.textContent).toBe('Seja bem-vindo!');

    localStorage.removeItem('edumanager.theme');
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
      new Error('Invalid login credentials'),
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
      screen.getByText('E-mail ou senha incorretos.'),
    ).toBeDefined();
    expect(
      screen.queryByText(/Invalid login credentials/i),
    ).toBeNull();
    expect(
      screen.getByLabelText(/E-mail institucional/i),
    ).toBeDefined();
  });

  it('exibe bloqueio de acesso institucional no login', async () => {
    authMock.signIn.mockRejectedValueOnce(
      new Error(
        'Voce nao tem acesso a esta plataforma. Procure a administracao da sua instituicao.',
      ),
    );

    renderLogin();

    fireEvent.change(
      screen.getByLabelText(/E-mail institucional/i),
      {
        target: { value: 'sem-acesso@example.com' },
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
      await screen.findByText(
        /Voce nao tem acesso a esta plataforma/i,
      ),
    ).toBeDefined();
    expect(
      screen.queryByText(/Nao foi possivel entrar/i),
    ).toBeNull();
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

  it('mostra erro generico de credenciais sem revelar o subdominio', () => {
    authMock.profile = { id: 'profile-1' };

    renderLogin('/login?subdomainMismatch=1');

    expect(screen.getByRole('alert').textContent).toContain(
      'E-mail ou senha incorretos.',
    );
    expect(screen.queryByText(/sua conta não possui|não é o subdomínio/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Trocar de usuário' })).toBeTruthy();
    expect(authMock.navigate).not.toHaveBeenCalledWith('/dashboard');
  });

  it('permite trocar de usuario no aviso de subdominio', async () => {
    authMock.profile = { id: 'profile-1' };

    renderLogin('/login?subdomainMismatch=1');
    fireEvent.click(screen.getByRole('button', { name: 'Trocar de usuário' }));

    await waitFor(() => {
      expect(authMock.signOut).toHaveBeenCalledOnce();
      expect(authMock.navigate).toHaveBeenCalledWith(
        '/login?subdomainMismatch=1',
        { replace: true },
      );
    });
  });
});
