// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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
    isSidebarHidden: false,
    isMobileSidebarOpen: false,
    isLoggingOut: false,
    mobileSidebarId: 'app-sidebar',
    onOpenMobileSidebar: vi.fn(),
    onToggleSidebar: vi.fn(),
    onLogout: vi.fn(),
    onUpdateProfileName: vi.fn(async () => undefined),
    onUpdatePassword: vi.fn(async () => undefined),
    theme: 'light',
    onToggleTheme: vi.fn(),
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
  it('oferece alternancia de tema para qualquer usuario autenticado', () => {
    const onToggleTheme = vi.fn();

    renderHeader({
      theme: 'light',
      onToggleTheme,
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ativar tema escuro',
      }),
    );

    expect(onToggleTheme).toHaveBeenCalledTimes(1);
  });

  it('mostra titulo, usuario e papel sem seletor de instituicao', () => {
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
      screen.queryByLabelText(
        /selecionar escola atual/i,
      ),
    ).toBeNull();
  });

  it('nao mostra escola estatica ou dropdown no topo', () => {
    renderHeader();

    expect(
      screen.queryByText('Escola do Saber'),
    ).toBeNull();
    expect(
      screen.queryByText('Escola selecionada'),
    ).toBeNull();
    expect(
      screen.queryByLabelText(
        /selecionar escola atual/i,
      ),
    ).toBeNull();
    expect(
      document.querySelector('select'),
    ).toBeNull();
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

  it('mantem um unico botao desktop de alternancia da Sidebar visivel', () => {
    const onToggleSidebar = vi.fn();
    renderHeader({
      onToggleSidebar,
      isSidebarHidden: false,
    });

    const buttons = screen.getAllByRole('button', {
      name: /ocultar menu lateral/i,
    });
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute('aria-expanded')).toBe(
      'true',
    );

    fireEvent.click(buttons[0]);

    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it('atualiza acessibilidade do toggle desktop quando a Sidebar esta oculta', () => {
    const onToggleSidebar = vi.fn();
    renderHeader({
      onToggleSidebar,
      isSidebarHidden: true,
    });

    const button = screen.getByRole('button', {
      name: /mostrar menu lateral/i,
    });

    expect(button.getAttribute('aria-expanded')).toBe(
      'false',
    );

    fireEvent.click(button);

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

  it('mostra Minha conta acima de Sair e abre o modal', () => {
    renderHeader();

    fireEvent.click(
      screen.getByRole('button', {
        name: /abrir menu do usu/i,
      }),
    );

    expect(
      screen.getByRole('button', { name: 'Minha conta' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Sair' }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Minha conta' }),
    );

    expect(
      screen.getByRole('dialog', { name: 'Minha conta' }),
    ).toBeTruthy();
    expect(
      (screen.getByLabelText('Nome') as HTMLInputElement).value,
    ).toBe('Ana Silva');

    const email = screen.getByLabelText(
      'E-mail',
    ) as HTMLInputElement;

    expect(email.value).toBe('ana@example.com');
    expect(email.readOnly).toBe(true);
  });

  it.each([
    'super_admin',
    'admin',
    'director',
    'secretary',
    'teacher',
    'student',
    'parent',
  ] as const)('disponibiliza Minha conta para %s', (role) => {
    renderHeader({
      currentUser: {
        ...currentUser,
        role,
      },
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: /abrir menu do usu/i,
      }),
    );

    expect(
      screen.getByRole('button', { name: 'Minha conta' }),
    ).toBeTruthy();
  });

  it('fecha Minha conta por Cancelar, X e Escape sem salvar', () => {
    const onUpdateProfileName = vi.fn(async () => undefined);
    const onUpdatePassword = vi.fn(async () => undefined);
    renderHeader({
      onUpdateProfileName,
      onUpdatePassword,
    });

    const openModal = () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: /abrir menu do usu/i,
        }),
      );
      fireEvent.click(
        screen.getByRole('button', { name: 'Minha conta' }),
      );
    };

    openModal();
    fireEvent.click(
      screen.getByRole('button', { name: 'Cancelar' }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();

    openModal();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Fechar Minha conta',
      }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();

    openModal();
    fireEvent.keyDown(
      screen.getByRole('dialog', { name: 'Minha conta' }),
      { key: 'Escape' },
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onUpdateProfileName).not.toHaveBeenCalled();
    expect(onUpdatePassword).not.toHaveBeenCalled();
  });

  it('normaliza e salva somente o nome quando a senha fica vazia', async () => {
    const onUpdateProfileName = vi.fn(async () => undefined);
    const onUpdatePassword = vi.fn(async () => undefined);
    renderHeader({
      onUpdateProfileName,
      onUpdatePassword,
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: /abrir menu do usu/i,
      }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Minha conta' }),
    );
    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: '  Novo Nome  ' },
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Salvar alterações',
      }),
    );

    await waitFor(() => {
      expect(onUpdateProfileName).toHaveBeenCalledWith(
        'Novo Nome',
      );
      expect(onUpdatePassword).not.toHaveBeenCalled();
      expect(
        screen.getByText('Nome atualizado com sucesso.'),
      ).toBeTruthy();
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('rejeita senha curta e confirmação diferente', async () => {
    const onUpdatePassword = vi.fn(async () => undefined);
    renderHeader({ onUpdatePassword });

    fireEvent.click(
      screen.getByRole('button', {
        name: /abrir menu do usu/i,
      }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Minha conta' }),
    );
    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'curta' },
    });
    fireEvent.change(
      screen.getByLabelText('Confirmar nova senha'),
      { target: { value: 'curta' } },
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Salvar alterações',
      }),
    );

    expect(
      await screen.findByText(
        'A nova senha deve ter pelo menos 8 caracteres.',
      ),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'SenhaSegura123!' },
    });
    fireEvent.change(
      screen.getByLabelText('Confirmar nova senha'),
      { target: { value: 'OutraSenha123!' } },
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Salvar alterações',
      }),
    );

    expect(
      await screen.findByText('As senhas não coincidem.'),
    ).toBeTruthy();
    expect(onUpdatePassword).not.toHaveBeenCalled();
  });

  it('altera a senha, limpa os campos e não expõe erro interno', async () => {
    const onUpdatePassword = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(
        new Error('internal password details'),
      );
    renderHeader({ onUpdatePassword });

    const openModal = () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: /abrir menu do usu/i,
        }),
      );
      fireEvent.click(
        screen.getByRole('button', { name: 'Minha conta' }),
      );
    };

    openModal();
    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'SenhaSegura123!' },
    });
    fireEvent.change(
      screen.getByLabelText('Confirmar nova senha'),
      { target: { value: 'SenhaSegura123!' } },
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Salvar alterações',
      }),
    );

    await waitFor(() => {
      expect(onUpdatePassword).toHaveBeenCalledWith(
        'SenhaSegura123!',
      );
      expect(
        screen.getByText('Senha alterada com sucesso.'),
      ).toBeTruthy();
    });

    openModal();
    expect(
      (screen.getByLabelText('Nova senha') as HTMLInputElement)
        .value,
    ).toBe('');
    expect(
      (
        screen.getByLabelText(
          'Confirmar nova senha',
        ) as HTMLInputElement
      ).value,
    ).toBe('');

    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'OutraSenha123!' },
    });
    fireEvent.change(
      screen.getByLabelText('Confirmar nova senha'),
      { target: { value: 'OutraSenha123!' } },
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Salvar alterações',
      }),
    );

    expect(
      await screen.findByText(
        'Não foi possível alterar sua senha.',
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(/internal password details/i),
    ).toBeNull();
  });

  it('reflete novo nome e novas iniciais ao receber o perfil atualizado', () => {
    const { props, rerender } = renderHeader();

    rerender(
      <MemoryRouter>
        <Header
          {...props}
          currentUser={{
            ...currentUser,
            name: 'Novo Nome',
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Novo Nome')).toBeTruthy();
    expect(screen.getByText('NN')).toBeTruthy();
    expect(screen.getByText('Administrador')).toBeTruthy();
  });

  it('bloqueia envios duplicados enquanto salva', async () => {
    let resolveUpdate: (() => void) | undefined;
    const onUpdateProfileName = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveUpdate = resolve;
        }),
    );
    renderHeader({ onUpdateProfileName });

    fireEvent.click(
      screen.getByRole('button', {
        name: /abrir menu do usu/i,
      }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Minha conta' }),
    );
    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: 'Nome Pendente' },
    });

    const saveButton = screen.getByRole('button', {
      name: 'Salvar alterações',
    });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(onUpdateProfileName).toHaveBeenCalledTimes(1);
      expect(
        screen.getByRole('button', { name: 'Salvando...' }),
      ).toBeTruthy();
    });

    resolveUpdate?.();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('salva nome e senha juntos com a mensagem combinada', async () => {
    const onUpdateProfileName = vi.fn(async () => undefined);
    const onUpdatePassword = vi.fn(async () => undefined);
    renderHeader({
      onUpdateProfileName,
      onUpdatePassword,
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: /abrir menu do usu/i,
      }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Minha conta' }),
    );
    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: 'Nome Completo' },
    });
    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'SenhaSegura123!' },
    });
    fireEvent.change(
      screen.getByLabelText('Confirmar nova senha'),
      { target: { value: 'SenhaSegura123!' } },
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Salvar alterações',
      }),
    );

    expect(
      await screen.findByText(
        'Dados da conta atualizados com sucesso.',
      ),
    ).toBeTruthy();
    expect(onUpdateProfileName).toHaveBeenCalledWith(
      'Nome Completo',
    );
    expect(onUpdatePassword).toHaveBeenCalledWith(
      'SenhaSegura123!',
    );
  });
});
