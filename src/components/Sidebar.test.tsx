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

function renderSidebar({
  route = '/admin',
  profile = baseProfile,
  currentUser = baseUser,
  currentInstitutionRole = 'ADMIN',
  isCollapsed = false,
}: {
  route?: string;
  profile?: Profile;
  currentUser?: User;
  currentInstitutionRole?: string | null;
  isCollapsed?: boolean;
} = {}) {
  const onCloseMobile = vi.fn();
  const onToggleCollapsed = vi.fn();
  const onLogout = vi.fn();

  render(
    <MemoryRouter initialEntries={[route]}>
      <Sidebar
        currentUser={currentUser}
        profile={profile}
        currentInstitutionRole={
          currentInstitutionRole
        }
        isCollapsed={isCollapsed}
        isMobileOpen={false}
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

afterEach(() => {
  cleanup();
});

describe('Sidebar', () => {
  it('renderiza rotas reais do ADMIN e marca o item ativo', () => {
    renderSidebar();

    expect(
      screen.getByRole('link', {
        name: /conta/i,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', {
        name: /administração/i,
      }).getAttribute('aria-current'),
    ).toBe('page');
    expect(
      screen.queryByRole('link', {
        name: /plataforma/i,
      }),
    ).toBeNull();
    expect(
      screen.queryByText(/alternar perfil demo/i),
    ).toBeNull();
  });

  it('exibe plataforma e administracao para SUPER_ADMIN', () => {
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
      screen.getByRole('link', {
        name: /administração/i,
      }),
    ).toBeTruthy();
  });

  it('omite administração para TEACHER', () => {
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
        name: /administração/i,
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

describe('getSidebarNavigationItems', () => {
  it('usa a matriz existente de permissões para liberar administração', () => {
    const items = getSidebarNavigationItems({
      profile: {
        ...baseProfile,
        role: 'SECRETARY',
      },
      currentInstitutionRole: 'SECRETARY',
      currentUserRole: 'secretary',
    });

    expect(items.map((item) => item.id)).toEqual([
      'dashboard',
      'admin',
    ]);
  });
});
