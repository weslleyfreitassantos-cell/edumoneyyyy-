// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import {
  MemoryRouter,
} from 'react-router-dom';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { Profile } from '../contexts/AuthContext';
import type { User } from '../types';
import Sidebar, {
  getSidebarAdminModules,
  getSidebarNavigationItems,
} from './Sidebar';

const baseProfile: Profile = {
  id: 'user-1',
  full_name: 'Ana Silva',
  email: 'ana@example.com',
  avatar_url: null,
  role: 'ADMIN',
  platform_role: 'USER',
};

const baseUser: User = {
  id: 'user-1',
  name: 'Ana Silva',
  email: 'ana@example.com',
  avatar: null,
  role: 'admin',
  subtitle: 'Administrador',
};

const baseBranding = {
  scope: 'GLOBAL' as const,
  displayName: 'EduManager Pro',
  logoUrl: null,
  faviconUrl: null,
  primaryColor: '#005bbf',
  secondaryColor: '#6ffbbe',
};

function renderSidebar({
  route = '/admin?module=overview',
  profile = baseProfile,
  currentUser = baseUser,
  currentInstitutionRole = 'ADMIN',
  isCollapsed = false,
  isMobileOpen = false,
}: {
  route?: string;
  profile?: Profile;
  currentUser?: User;
  currentInstitutionRole?: string | null;
  isCollapsed?: boolean;
  isMobileOpen?: boolean;
} = {}) {
  const onCloseMobile = vi.fn();
  const onToggleCollapsed = vi.fn();
  const onLogout = vi.fn();

  render(
    <MemoryRouter initialEntries={[route]}>
      <Sidebar
        currentUser={currentUser}
        profile={profile}
        branding={baseBranding}
        currentInstitutionRole={
          currentInstitutionRole
        }
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileOpen}
        isLoggingOut={false}
        onCloseMobile={onCloseMobile}
        onToggleCollapsed={onToggleCollapsed}
        onLogout={onLogout}
      />
    </MemoryRouter>,
  );

  return {
    onCloseMobile,
    onToggleCollapsed,
    onLogout,
  };
}

function directorProfile(): Profile {
  return {
    ...baseProfile,
    role: 'DIRECTOR',
  };
}

function directorUser(): User {
  return {
    ...baseUser,
    role: 'director',
    subtitle: 'Diretor',
  };
}

afterEach(() => {
  cleanup();
});

describe('Sidebar', () => {
  it('renderiza rotas reais do ADMIN e marca administracao como area ativa', () => {
    renderSidebar();

    expect(
      screen.getByRole('link', {
        name: /conta/i,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', {
        name: /administra..o/i,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', {
        name: /vis.o geral/i,
      }).getAttribute('aria-current'),
    ).toBe('page');
    expect(
      screen.queryByRole('link', {
        name: /plataforma/i,
      }),
    ).toBeNull();
  });

  it('exibe somente Plataforma para SUPER_ADMIN em /platform', () => {
    renderSidebar({
      route: '/platform',
      profile: {
        ...baseProfile,
        platform_role: 'SUPER_ADMIN',
      },
      currentUser: {
        ...baseUser,
        role: 'super_admin',
        subtitle: 'Super Admin',
      },
      currentInstitutionRole: null,
    });

    expect(
      screen.getByRole('link', {
        name: /plataforma/i,
      }).getAttribute('aria-current'),
    ).toBe('page');
    expect(
      screen.queryByRole('link', {
        name: /administra..o/i,
      }),
    ).toBeNull();
    expect(screen.queryByText(/institui/i)).toBeNull();
    expect(
      screen.queryByText(/escola selecionada/i),
    ).toBeNull();
  });

  it('mostra modulos autorizados na Sidebar principal para DIRECTOR', () => {
    renderSidebar({
      route: '/admin?module=subjects',
      profile: directorProfile(),
      currentUser: directorUser(),
      currentInstitutionRole: 'DIRECTOR',
    });

    expect(screen.getByText(/pessoas/i)).toBeTruthy();
    expect(
      screen.getByText(/estrutura escolar/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/opera..o acad.mica/i),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', {
        name: /disciplinas/i,
      }).getAttribute('aria-current'),
    ).toBe('page');
    expect(
      screen.getByRole('link', {
        name: /pol.tica acad.mica/i,
      }),
    ).toBeTruthy();
  });

  it('nao mostra modulos sem permissao para SECRETARY', () => {
    renderSidebar({
      route: '/admin?module=enrollments',
      profile: {
        ...baseProfile,
        role: 'SECRETARY',
      },
      currentUser: {
        ...baseUser,
        role: 'secretary',
        subtitle: 'Secretário',
      },
      currentInstitutionRole: 'SECRETARY',
    });

    expect(
      screen.getByRole('link', {
        name: /matr.culas/i,
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('link', {
        name: /disciplinas/i,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('link', {
        name: /atribui..es/i,
      }),
    ).toBeNull();
  });

  it('clicar em Disciplinas aponta para /admin?module=subjects', () => {
    renderSidebar({
      route: '/admin?module=overview',
      profile: directorProfile(),
      currentUser: directorUser(),
      currentInstitutionRole: 'DIRECTOR',
    });

    expect(
      screen
        .getByRole('link', {
          name: /disciplinas/i,
        })
        .getAttribute('href'),
    ).toBe('/admin?module=subjects');
  });

  it('fecha o drawer mobile apos navegar para um modulo', () => {
    const { onCloseMobile } = renderSidebar({
      route: '/admin?module=overview',
      profile: directorProfile(),
      currentUser: directorUser(),
      currentInstitutionRole: 'DIRECTOR',
      isMobileOpen: true,
    });

    fireEvent.click(
      screen.getByRole('link', {
        name: /disciplinas/i,
      }),
    );

    expect(onCloseMobile).toHaveBeenCalled();
  });

  it('mostra modulos e Voltar para Plataforma para SUPER_ADMIN dentro de /admin', () => {
    renderSidebar({
      route: '/admin?module=subjects',
      profile: {
        ...baseProfile,
        platform_role: 'SUPER_ADMIN',
      },
      currentUser: {
        ...baseUser,
        role: 'super_admin',
        subtitle: 'Super Admin',
      },
      currentInstitutionRole: null,
    });

    expect(
      screen
        .getByRole('link', {
          name: /voltar para plataforma/i,
        })
        .getAttribute('href'),
    ).toBe('/platform');
    expect(
      screen.getByText(/escola selecionada/i),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', {
        name: /disciplinas/i,
      }).getAttribute('aria-current'),
    ).toBe('page');
    expect(
      screen.queryByRole('link', {
        name: /^administra..o$/i,
      }),
    ).toBeNull();
  });

  it('omite administracao para TEACHER', () => {
    renderSidebar({
      route: '/dashboard',
      profile: {
        ...baseProfile,
        role: 'TEACHER',
      },
      currentUser: {
        ...baseUser,
        role: 'teacher',
        subtitle: 'Professor',
      },
      currentInstitutionRole: 'TEACHER',
    });

    expect(
      screen.getByRole('link', {
        name: /dashboard/i,
      }).getAttribute('aria-current'),
    ).toBe('page');
    expect(
      screen.queryByRole('link', {
        name: /administra..o/i,
      }),
    ).toBeNull();
  });

  it('mantem nomes acessiveis e acao de expandir quando recolhida', () => {
    const { onToggleCollapsed } = renderSidebar({
      route: '/dashboard',
      profile: {
        ...baseProfile,
        role: 'STUDENT',
      },
      currentUser: {
        ...baseUser,
        role: 'student',
        subtitle: 'Aluno',
      },
      currentInstitutionRole: 'STUDENT',
      isCollapsed: true,
    });

    expect(
      screen.getByRole('link', {
        name: /dashboard/i,
      }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', {
        name: /expandir sidebar/i,
      }),
    );

    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it('chama logout real pelo rodape', () => {
    const { onLogout } = renderSidebar();

    fireEvent.click(
      screen.getByRole('button', {
        name: /^sair$/i,
      }),
    );

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});

describe('sidebar navigation helpers', () => {
  it('usa a matriz existente de permissoes para liberar modulos administrativos', () => {
    const items = getSidebarNavigationItems({
      profile: {
        ...baseProfile,
        role: 'SECRETARY',
      },
      currentInstitutionRole: 'SECRETARY',
      currentUserRole: 'secretary',
      pathname: '/admin',
    });
    const modules = getSidebarAdminModules({
      profile: {
        ...baseProfile,
        role: 'SECRETARY',
      },
      currentInstitutionRole: 'SECRETARY',
      currentUserRole: 'secretary',
      pathname: '/admin',
    });

    expect(items.map((item) => item.id)).toEqual([
      'dashboard',
    ]);
    expect(
      modules.map((module) => module.id),
    ).toContain('enrollments');
    expect(
      modules.map((module) => module.id),
    ).not.toContain('subjects');
  });
});
