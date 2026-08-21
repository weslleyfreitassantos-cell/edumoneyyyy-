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
import { ThemeProvider } from '../contexts/ThemeContext';
import type { UserInstitution } from '../services/institutionService';
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

vi.mock('../hooks/useBranding', () => ({
  useHostBranding: () => ({
    scope: 'GLOBAL',
    displayName: 'EduManager Pro',
    logoUrl: null,
    faviconUrl: null,
    primaryColor: '#005bbf',
    secondaryColor: '#6ffbbe',
  }),
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
const firstInstitution: UserInstitution = {
  membership: {
    id: 'membership-1',
    institution_id: 'institution-1',
    role: 'ADMIN',
    active: true,
  },
  institution: {
    id: 'institution-1',
    name: 'Escola do Saber',
    active: true,
    account_id: 'account-1',
  },
  account: null,
  accessSource: 'membership',
  effectiveRole: 'ADMIN',
};

const secondInstitution: UserInstitution = {
  membership: {
    id: 'membership-2',
    institution_id: 'institution-2',
    role: 'DIRECTOR',
    active: true,
  },
  institution: {
    id: 'institution-2',
    name: 'Escola Luz',
    active: true,
    account_id: 'account-1',
  },
  account: null,
  accessSource: 'membership',
  effectiveRole: 'DIRECTOR',
};

function mockContexts(
  overrides: {
    profile?: Profile;
    currentRole?: string | null;
    signOut?: () => Promise<void>;
    institutionContext?: Partial<
      ReturnType<typeof useInstitution>
    >;
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
    isSwitchingInstitution: false,
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
    ...overrides.institutionContext,
  });
}

function renderShell(route = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ThemeProvider>
        <AppShell>
          <div>Conteudo da rota</div>
        </AppShell>
      </ThemeProvider>
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
      section: '',
      title: '',
    });
    expect(
      getRouteVisualContext('/admin', 'director'),
    ).toEqual({
      section: '',
      title: '',
    });
    expect(
      getRouteVisualContext('/dashboard', 'parent'),
    ).toEqual({
      section: 'Família',
      title: 'Dependentes e boletins',
    });
    expect(
      getRouteVisualContext('/terminais', 'director'),
    ).toEqual({
      section: '',
      title: '',
    });
    expect(
      getRouteVisualContext('/email', 'director'),
    ).toEqual({
      section: 'Comunicação',
      title: 'E-mail',
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
      screen.queryByRole('heading', {
        name: /gestão institucional/i,
      }),
    ).toBeNull();
    expect(
      screen.getByText('Conteudo da rota'),
    ).toBeTruthy();
    expect(
      screen.queryByText(/seletor global/i),
    ).toBeNull();
  });

  it('inicia com Sidebar desktop aberta e oculta completamente pelo Header', () => {
    renderShell('/dashboard');

    const sidebar = document.getElementById('app-sidebar');

    expect(sidebar?.getAttribute('data-desktop-hidden')).toBe(
      'false',
    );
    expect(sidebar?.className).toContain('lg:w-[280px]');
    expect(sidebar?.className).not.toContain('lg:w-20');
    expect(sidebar?.className).not.toContain('lg:hidden');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ocultar menu lateral',
      }),
    );

    expect(sidebar?.getAttribute('data-desktop-hidden')).toBe(
      'true',
    );
    expect(sidebar?.className).toContain('lg:hidden');
    expect(
      window.localStorage.getItem(
        'edumanager.sidebarCollapsed',
      ),
    ).toBe('true');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Mostrar menu lateral',
      }),
    );

    expect(sidebar?.getAttribute('data-desktop-hidden')).toBe(
      'false',
    );
    expect(sidebar?.className).not.toContain('lg:hidden');
    expect(
      window.localStorage.getItem(
        'edumanager.sidebarCollapsed',
      ),
    ).toBe('false');
  });

  it('restaura preferencia de Sidebar desktop oculta', () => {
    window.localStorage.setItem(
      'edumanager.sidebarCollapsed',
      'true',
    );

    renderShell('/dashboard');

    const sidebar = document.getElementById('app-sidebar');

    expect(sidebar?.getAttribute('data-desktop-hidden')).toBe(
      'true',
    );
    expect(sidebar?.className).toContain('lg:hidden');
    expect(
      screen.getByRole('button', {
        name: 'Mostrar menu lateral',
      }).getAttribute('aria-expanded'),
    ).toBe('false');
    expect(
      screen.queryByRole('button', {
        name: /recolher sidebar/i,
      }),
    ).toBeNull();
  });

  it('abre drawer mobile mesmo com preferencia desktop oculta', () => {
    window.localStorage.setItem(
      'edumanager.sidebarCollapsed',
      'true',
    );

    renderShell('/dashboard');

    fireEvent.click(getMobileMenuButton());

    expect(
      getMobileMenuButton().getAttribute(
        'aria-expanded',
      ),
    ).toBe('true');
    expect(
      screen.getByRole('dialog', {
        name: /edumanager pro/i,
      }),
    ).toBeTruthy();
  });

  it('nao mostra seletor de instituicao para SUPER_ADMIN em /platform', () => {
    mockContexts({
      profile: {
        ...profile,
        full_name: 'Super Administrador',
        role: 'ADMIN',
        platform_role: 'SUPER_ADMIN',
      },
      currentRole: null,
      institutionContext: {
        institutions: [
          firstInstitution,
          secondInstitution,
        ],
        currentInstitution:
          firstInstitution.institution,
        currentInstitutionId:
          firstInstitution.institution.id,
        hasMultipleInstitutions: true,
      },
    });

    renderShell('/platform');

    expect(
      screen.queryByText(/seletor global/i),
    ).toBeNull();
    expect(
      screen.queryByText('Escola do Saber'),
    ).toBeNull();
    expect(
      screen.getAllByText('Super Administrador')
        .length,
    ).toBeGreaterThan(0);
  });

  it('oculta escola estatica e volta para Plataforma para SUPER_ADMIN em /admin', () => {
    mockContexts({
      profile: {
        ...profile,
        full_name: 'Super Administrador',
        role: 'ADMIN',
        platform_role: 'SUPER_ADMIN',
      },
      currentRole: null,
      institutionContext: {
        institutions: [
          firstInstitution,
          secondInstitution,
        ],
        currentInstitution:
          firstInstitution.institution,
        currentInstitutionId:
          firstInstitution.institution.id,
        hasMultipleInstitutions: true,
      },
    });

    renderShell('/admin?module=subjects');

    expect(
      screen.getByRole('heading', {
        name: 'Escola do Saber',
      }),
    ).toBeTruthy();
    expect(
      screen.queryByText('Escola selecionada'),
    ).toBeNull();
    expect(
      screen.queryByText(/seletor global/i),
    ).toBeNull();

    const backLink = screen.getByRole('link', {
      name: /Voltar para Plataforma/i,
    });

    expect(backLink.getAttribute('href')).toBe(
      '/platform',
    );
  });

  it('oculta seletor para ADMIN institucional', () => {
    mockContexts({
      profile,
      currentRole: 'ADMIN',
      institutionContext: {
        institutions: [
          firstInstitution,
          secondInstitution,
        ],
        currentInstitution:
          firstInstitution.institution,
        currentInstitutionId:
          firstInstitution.institution.id,
        hasMultipleInstitutions: true,
      },
    });

    renderShell('/admin');

    expect(
      screen.queryByText(/seletor global/i),
    ).toBeNull();
  });

  it('oculta seletor para DIRECTOR institucional', () => {
    mockContexts({
      profile: {
        ...profile,
        role: 'DIRECTOR',
      },
      currentRole: 'DIRECTOR',
      institutionContext: {
        institutions: [
          firstInstitution,
          secondInstitution,
        ],
        currentInstitution:
          secondInstitution.institution,
        currentInstitutionId:
          secondInstitution.institution.id,
        hasMultipleInstitutions: true,
      },
    });

    renderShell('/admin');

    expect(
      screen.queryByText(/seletor global/i),
    ).toBeNull();
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
        name: /vis.o geral/i,
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

  it('mantem visao geral na navegacao lateral sem item administracao duplicado', () => {
    renderShell('/account');

    expect(
      screen.getByRole('link', { name: /vis.o geral/i }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('link', { name: /administra/i }),
    ).toBeNull();
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
