// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { MemoryRouter } from 'react-router-dom';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  useAuth,
  useAuthProfileActions,
  type Profile,
} from '../contexts/AuthContext';
import {
  useInstitution,
} from '../contexts/InstitutionContext';
import AppShell, {
  getRouteVisualContext,
} from './AppShell';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  useAuthProfileActions: vi.fn(),
}));

vi.mock('../contexts/InstitutionContext', () => ({
  useInstitution: vi.fn(),
}));

vi.mock('./InstitutionSwitcher', () => ({
  default: () => <div>Seletor global</div>,
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseAuthProfileActions = vi.mocked(
  useAuthProfileActions,
);
const mockedUseInstitution =
  vi.mocked(useInstitution);

const profile: Profile = {
  id: 'user-1',
  full_name: 'Ana Silva',
  email: 'ana@example.com',
  avatar_url: null,
  role: 'ADMIN',
  platform_role: 'USER',
};

const signOut = vi.fn(async () => undefined);
const updateProfileName = vi.fn(async () => undefined);
const updatePassword = vi.fn(async () => undefined);

function mockContexts(
  overrides: {
    profile?: Profile;
    currentRole?: string | null;
    signOut?: () => Promise<void>;
  } = {},
) {
  mockedUseAuth.mockReturnValue({
    user: {
      id: overrides.profile?.id ?? profile.id,
    } as SupabaseUser,
    profile: overrides.profile ?? profile,
    loading: false,
    signIn: vi.fn(async () => undefined),
    signOut: overrides.signOut ?? signOut,
  });

  mockedUseAuthProfileActions.mockReturnValue({
    updateProfileName,
    updatePassword,
  });

  mockedUseInstitution.mockReturnValue({
    institutions: [],
    currentInstitution: null,
    currentMembership: null,
    currentInstitutionId: null,
    currentRole:
      overrides.currentRole ?? 'ADMIN',
    isLoading: false,
    error: null,
    hasMultipleInstitutions: false,
    setCurrentInstitutionId: vi.fn(
      async (institutionId: string) => ({
        success: true as const,
        institutionId,
      }),
    ),
    clearCurrentInstitutionSelection: vi.fn(),
    refresh: vi.fn(async () => undefined),
  });
}

function renderShell(route = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AppShell>
        <div>Conteudo da rota</div>
      </AppShell>
    </MemoryRouter>,
  );
}

function getMobileMenuButton() {
  return screen.getByRole('button', {
    name: 'Abrir menu de navegação',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  document.body.style.overflow = '';
  mockContexts();
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('getRouteVisualContext', () => {
  it('deriva titulo e secao de rotas reais', () => {
    expect(
      getRouteVisualContext('/platform', 'super_admin'),
    ).toEqual({
      section: 'Plataforma',
      title: 'Instituições',
    });
    expect(
      getRouteVisualContext('/admin', 'director'),
    ).toEqual({
      section: 'Administração',
      title: 'Gestão institucional',
    });
    expect(
      getRouteVisualContext('/dashboard', 'parent'),
    ).toEqual({
      section: 'Família',
      title: 'Dependentes e boletins',
    });
  });
});

describe('AppShell', () => {
  it('restaura e persiste a preferencia de tema do usuario', async () => {
    window.localStorage.setItem(
      'edumanager.theme',
      'dark',
    );

    renderShell();

    await waitFor(() => {
      expect(
        document.documentElement.classList.contains('dark'),
      ).toBe(true);
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ativar tema claro',
      }),
    );

    await waitFor(() => {
      expect(
        document.documentElement.classList.contains('dark'),
      ).toBe(false);
      expect(
        window.localStorage.getItem('edumanager.theme'),
      ).toBe('light');
    });
  });

  it('renderiza contexto da rota e conteudo principal', () => {
    renderShell('/admin');

    expect(
      screen.getByRole('heading', {
        name: /gest/i,
      }),
    ).toBeTruthy();
    expect(
      screen.getByText('Conteudo da rota'),
    ).toBeTruthy();
    expect(
      screen.getAllByText(/seletor global/i).length,
    ).toBeGreaterThan(0);
  });

  it('abre e fecha o drawer mobile pelo botao com foco restaurado', async () => {
    renderShell('/dashboard');

    const openButton = getMobileMenuButton();

    openButton.focus();
    fireEvent.click(openButton);

    expect(
      getMobileMenuButton().getAttribute(
        'aria-expanded',
      ),
    ).toBe('true');

    const drawer = screen.getByRole('dialog', {
      name: /edumanager pro/i,
    });
    const main = screen.getByRole('main');
    const contentWrapper =
      main.parentElement as HTMLElement & {
        inert?: boolean;
      };
    const closeButton = screen.getByRole(
      'button',
      {
        name: /fechar menu de navega/i,
      },
    );

    expect(
      drawer.getAttribute('aria-modal'),
    ).toBe('true');
    expect(contentWrapper.inert).toBe(true);

    await waitFor(() => {
      expect(document.activeElement).toBe(
        closeButton,
      );
    });

    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(
        getMobileMenuButton().getAttribute(
          'aria-expanded',
        ),
      ).toBe('false');
      expect(document.activeElement).toBe(
        openButton,
      );
      expect(contentWrapper.inert).toBe(false);
    });
  });

  it('mantem foco dentro do drawer com Tab e Shift Tab', async () => {
    renderShell('/dashboard');

    fireEvent.click(getMobileMenuButton());

    const drawer = screen.getByRole('dialog', {
      name: /edumanager pro/i,
    });
    const focusableElements = Array.from(
      drawer.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const firstElement = focusableElements[0];
    const lastElement =
      focusableElements[
        focusableElements.length - 1
      ];

    await waitFor(() => {
      expect(
        document.activeElement,
      ).toBe(
        screen.getByRole('button', {
          name: /fechar menu de navega/i,
        }),
      );
    });

    lastElement.focus();
    fireEvent.keyDown(document, {
      key: 'Tab',
    });

    expect(document.activeElement).toBe(
      firstElement,
    );

    firstElement.focus();
    fireEvent.keyDown(document, {
      key: 'Tab',
      shiftKey: true,
    });

    expect(document.activeElement).toBe(
      lastElement,
    );
  });

  it('fecha o drawer mobile por Escape', async () => {
    renderShell('/dashboard');

    fireEvent.click(getMobileMenuButton());

    fireEvent.keyDown(document, {
      key: 'Escape',
    });

    await waitFor(() => {
      expect(
        getMobileMenuButton().getAttribute(
          'aria-expanded',
        ),
      ).toBe('false');
    });
  });

  it('fecha o drawer mobile pelo overlay', async () => {
    renderShell('/dashboard');

    fireEvent.click(getMobileMenuButton());

    fireEvent.click(
      screen.getByRole('button', {
        name: /fechar menu pelo fundo/i,
      }),
    );

    await waitFor(() => {
      expect(
        getMobileMenuButton().getAttribute(
          'aria-expanded',
        ),
      ).toBe('false');
    });
  });

  it('fecha o drawer mobile ao navegar', async () => {
    renderShell('/dashboard');

    fireEvent.click(getMobileMenuButton());
    fireEvent.click(
      screen.getByRole('link', {
        name: /administra/i,
      }),
    );

    await waitFor(() => {
      expect(
        getMobileMenuButton().getAttribute(
          'aria-expanded',
        ),
      ).toBe('false');
    });
  });

  it('restaura inert e scroll ao desmontar com drawer aberto', async () => {
    const { unmount } = renderShell('/dashboard');

    fireEvent.click(getMobileMenuButton());

    const main = screen.getByRole('main');
    const contentWrapper =
      main.parentElement as HTMLElement & {
        inert?: boolean;
      };

    await waitFor(() => {
      expect(contentWrapper.inert).toBe(true);
      expect(document.body.style.overflow).toBe(
        'hidden',
      );
    });

    unmount();

    expect(contentWrapper.inert).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('mantem logout conectado ao AuthContext', async () => {
    renderShell('/dashboard');

    fireEvent.click(
      screen.getByRole('button', {
        name: /^sair$/i,
      }),
    );

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1);
    });
  });

  it('mantem Administracao na navegacao lateral', () => {
    renderShell('/account');

    expect(
      screen.getByRole('link', { name: /administra/i }),
    ).toBeTruthy();
  });

  it('conecta Minha conta às ações do perfil autenticado', async () => {
    renderShell('/dashboard');

    fireEvent.click(
      screen.getByRole('button', {
        name: /abrir menu do usu/i,
      }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Minha conta' }),
    );
    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: 'Novo Nome' },
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Salvar alterações',
      }),
    );

    await waitFor(() => {
      expect(updateProfileName).toHaveBeenCalledWith(
        'Novo Nome',
      );
    });
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it('torna o shell inerte enquanto Minha conta está aberta', () => {
    renderShell('/dashboard');
    const shell = document.getElementById(
      'app-authenticated-container',
    ) as HTMLElement & { inert: boolean };

    fireEvent.click(
      screen.getByRole('button', {
        name: /abrir menu do usu/i,
      }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Minha conta' }),
    );

    expect(shell.inert).toBe(true);

    fireEvent.click(
      screen.getByRole('button', { name: 'Cancelar' }),
    );

    expect(shell.inert).toBe(false);
  });
});
