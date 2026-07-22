// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { useInstitution } from '../contexts/InstitutionContext';
import type { UserInstitution } from '../services/institutionService';
import type { User } from '../types';
import Header from './Header';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../contexts/InstitutionContext', () => ({
  useInstitution: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseInstitution =
  vi.mocked(useInstitution);

const currentUser: User = {
  id: 'user-1',
  name: 'Ana Silva',
  email: 'ana@example.com',
  avatar: null,
  role: 'admin',
  subtitle: 'Administrador',
};

const firstInstitution: UserInstitution = {
  membership: null,
  institution: {
    id: 'institution-1',
    name: 'Escola Centro',
    active: true,
    account_id: 'account-1',
  },
  account: null,
  accessSource: 'account_owner',
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
    name: 'Escola Norte',
    active: true,
    account_id: 'account-1',
  },
  account: null,
  accessSource: 'membership',
  effectiveRole: 'DIRECTOR',
};

const setCurrentInstitutionId = vi.fn(
  async (institutionId: string) => ({
    success: true as const,
    institutionId,
  }),
);

function mockInstitutionContext() {
  mockedUseInstitution.mockReturnValue({
    institutions: [
      firstInstitution,
      secondInstitution,
    ],
    currentInstitution:
      firstInstitution.institution,
    currentMembership:
      firstInstitution.membership,
    currentInstitutionId:
      firstInstitution.institution.id,
    currentRole: 'ADMIN',
    isLoading: false,
    error: null,
    hasMultipleInstitutions: true,
    setCurrentInstitutionId,
    clearCurrentInstitutionSelection: vi.fn(),
    refresh: vi.fn(async () => undefined),
  });
}

function renderHeader(
  overrides: Partial<
    Parameters<typeof Header>[0]
  > = {},
) {
  mockedUseAuth.mockReturnValue({
    user: { id: 'user-1' } as never,
    profile: {
      id: 'user-1',
      full_name: 'Ana Silva',
      email: 'ana@example.com',
      avatar_url: null,
      role: 'ADMIN',
      platform_role: 'USER',
    },
    loading: false,
    signIn: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
  });

  mockInstitutionContext();

  const props: Parameters<typeof Header>[0] = {
    currentUser,
    pageTitle: 'Gestao institucional',
    pageSection: 'Administracao',
    showInstitutionSwitcher: true,
    isSidebarCollapsed: false,
    isMobileSidebarOpen: false,
    isLoggingOut: false,
    mobileSidebarId: 'app-sidebar',
    onOpenMobileSidebar: vi.fn(),
    onToggleSidebar: vi.fn(),
    onLogout: vi.fn(),
    ...overrides,
  };

  const view = render(
    <MemoryRouter>
      <Header {...props} />
    </MemoryRouter>,
  );

  return {
    props,
    ...view,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('Header', () => {
  it('mostra titulo, usuario, papel e seletor de instituicao', () => {
    renderHeader();

    expect(
      screen.getByRole('heading', {
        name: /gestao institucional/i,
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(/administracao/i),
    ).toBeTruthy();
    expect(screen.getByText('Ana Silva')).toBeTruthy();
    expect(
      screen.getByText('Administrador'),
    ).toBeTruthy();
    expect(
      screen.getAllByLabelText(
        /selecionar escola atual/i,
      ).length,
    ).toBe(2);
  });

  it('mantem ids unicos para as instancias desktop e mobile do seletor', () => {
    const { container } = renderHeader();
    const ids = Array.from(
      container.querySelectorAll('[id]'),
    ).map((element) => element.id);
    const selectElements =
      screen.getAllByLabelText(
        /selecionar escola atual/i,
      ) as HTMLSelectElement[];
    const selectIds = selectElements.map(
      (select) => select.id,
    );

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(selectIds).size).toBe(2);

    const labels = Array.from(
      container.querySelectorAll('label'),
    );

    labels.forEach((label) => {
      const controlId =
        label.getAttribute('for');

      expect(controlId).toBeTruthy();
      expect(
        controlId
          ? document.getElementById(controlId)
          : null,
      ).toBeTruthy();
    });
  });

  it('troca instituicao pelas instancias desktop e mobile usando o mesmo contexto', () => {
    renderHeader();

    const selectElements =
      screen.getAllByLabelText(
        /selecionar escola atual/i,
      );

    fireEvent.change(selectElements[0], {
      target: {
        value: 'institution-2',
      },
    });
    fireEvent.change(selectElements[1], {
      target: {
        value: 'institution-2',
      },
    });

    expect(
      setCurrentInstitutionId,
    ).toHaveBeenCalledTimes(2);
    expect(
      setCurrentInstitutionId,
    ).toHaveBeenNthCalledWith(
      1,
      'institution-2',
    );
    expect(
      setCurrentInstitutionId,
    ).toHaveBeenNthCalledWith(
      2,
      'institution-2',
    );
  });

  it('usa iniciais quando nao ha avatar e nao cria src vazio', () => {
    renderHeader({
      currentUser: {
        ...currentUser,
        avatar: '',
      },
    });

    expect(screen.getByText('AS')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renderiza avatar valido e volta para iniciais em erro', () => {
    renderHeader({
      currentUser: {
        ...currentUser,
        avatar:
          'https://example.com/avatar.png',
      },
    });

    const image = screen.getByRole('img', {
      name: /foto de ana silva/i,
    }) as HTMLImageElement;

    expect(image.getAttribute('src')).toBe(
      'https://example.com/avatar.png',
    );

    fireEvent.error(image);

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('AS')).toBeTruthy();
  });

  it('aciona botao mobile e expoe aria-expanded', () => {
    const onOpenMobileSidebar = vi.fn();
    renderHeader({
      onOpenMobileSidebar,
      isMobileSidebarOpen: true,
    });

    const button = screen.getByRole('button', {
      name: /abrir menu de navega/i,
    });

    expect(button.getAttribute('aria-expanded')).toBe(
      'true',
    );

    fireEvent.click(button);

    expect(onOpenMobileSidebar).toHaveBeenCalledTimes(1);
  });

  it('aciona recolher e expandir sidebar no desktop', () => {
    const onToggleSidebar = vi.fn();
    renderHeader({
      onToggleSidebar,
      isSidebarCollapsed: false,
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: /recolher sidebar/i,
      }),
    );

    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it('mantem logout no menu do usuario', () => {
    const onLogout = vi.fn();
    renderHeader({ onLogout });

    fireEvent.click(
      screen.getByRole('button', {
        name: /abrir menu do usu/i,
      }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /^sair$/i,
      }),
    );

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
