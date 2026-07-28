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
import PlatformPage from './PlatformPage';
import type { AccountSummaryRow } from '../../services/accountService';
import { AccountServiceError } from '../../services/accountService';

const hookMock = vi.hoisted(() => ({
  accountsQuery: {} as any,
  createAccount: {} as any,
  updateAccount: {} as any,
  deleteAccount: {} as any,
  createMutateAsync: vi.fn(),
  updateMutateAsync: vi.fn(),
  deleteMutateAsync: vi.fn(),
}));

vi.mock('../../hooks/useAccounts', () => ({
  useAccounts: () => hookMock.accountsQuery,
  useCreateClientAccount: () => hookMock.createAccount,
  useUpdateClientAccount: () => hookMock.updateAccount,
  useDeleteClientAccount: () => hookMock.deleteAccount,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: {
      id: 'super-admin-1',
      full_name: 'Super Admin',
      email: 'superadmin@admin.com',
      role: 'ADMIN',
      platform_role: 'SUPER_ADMIN',
      avatar_url: null,
    },
  }),
}));

const accounts: AccountSummaryRow[] = [
  {
    id: 'account-1',
    name: 'Conta Alfa',
    status: 'ACTIVE',
    institutionLimit: 3,
    activeInstitutionCount: 1,
    owner: {
      id: 'owner-1',
      full_name: 'Ana Admin',
      email: 'ana@example.com',
      role: 'ADMIN' as const,
      platform_role: 'USER' as const,
      active: true,
    },
    institutions: [
      {
        id: 'institution-1',
        name: 'Escola Alpha',
        active: true,
        account_id: 'account-1',
        logoUrl: null,
        publicSlug: null,
      },
      {
        id: 'institution-2',
        name: 'Escola Pausada',
        active: false,
        account_id: 'account-1',
        logoUrl: null,
        publicSlug: null,
      },
    ],
  },
  {
    id: 'account-2',
    name: 'Conta Beta',
    status: 'SUSPENDED',
    institutionLimit: 2,
    activeInstitutionCount: 0,
    owner: null,
    institutions: [],
  },
  {
    id: 'account-3',
    name: 'Conta Cancelada',
    status: 'CANCELED',
    institutionLimit: 1,
    activeInstitutionCount: 0,
    owner: {
      id: 'owner-3',
      full_name: 'Carlos Cancelado',
      email: 'carlos@example.com',
      role: 'ADMIN' as const,
      platform_role: 'USER' as const,
      active: false,
    },
    institutions: [],
  } as AccountSummaryRow,
];

function renderPage() {
  return render(<PlatformPage />);
}

describe('PlatformPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    hookMock.accountsQuery = {
      data: accounts,
      isLoading: false,
      isError: false,
      error: null,
    };
    hookMock.createAccount = {
      isPending: false,
      mutateAsync: hookMock.createMutateAsync,
    };
    hookMock.updateAccount = {
      isPending: false,
      mutateAsync: hookMock.updateMutateAsync,
    };
    hookMock.deleteAccount = {
      isPending: false,
      mutateAsync: hookMock.deleteMutateAsync,
    };
    hookMock.createMutateAsync.mockResolvedValue({
      success: true,
      accountId: 'account-3',
      ownerProfileId: 'owner-3',
      ownerEmail: 'new@example.com',
      institutionLimit: 2,
      invitationSent: true,
      reusedExistingUser: false,
    });
    hookMock.updateMutateAsync.mockResolvedValue({
      success: true,
      accountId: 'account-1',
      institutionLimit: 4,
      status: 'ACTIVE',
    });
    hookMock.deleteMutateAsync.mockResolvedValue({
      success: true,
      accountId: 'account-1',
      ownerProfileId: 'owner-1',
      ownerPreserved: false,
      deletedAuthUser: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renderiza loading acessivel', () => {
    hookMock.accountsQuery = {
      ...hookMock.accountsQuery,
      data: undefined,
      isLoading: true,
    };

    renderPage();

    expect(
      screen.getByRole('status').textContent,
    ).toMatch(/Carregando instituições/i);
  });

  it('renderiza dados reais de contas e instituicoes', () => {
    renderPage();

    expect(
      screen.getByRole('heading', {
        name: /Instituições/i,
        level: 1,
      }),
    ).toBeDefined();
    expect(screen.getByText('Conta Alfa')).toBeDefined();
    expect(screen.getByText('Ana Admin')).toBeDefined();
    expect(
      screen.getByText(/Escola Alpha, Escola Pausada/i),
    ).toBeDefined();
    expect(screen.getByText('Ativa')).toBeDefined();
    expect(screen.getByText('Suspensa')).toBeDefined();
  });

  it('renderiza estado vazio', () => {
    hookMock.accountsQuery = {
      ...hookMock.accountsQuery,
      data: [],
    };

    renderPage();

    expect(
      screen.getByText(/Nenhuma conta ou instituição cadastrada/i),
    ).toBeDefined();
  });

  it('renderiza erro de carregamento', () => {
    hookMock.accountsQuery = {
      ...hookMock.accountsQuery,
      data: undefined,
      isError: true,
      error: new Error('Falha ao carregar contas'),
    };

    renderPage();

    expect(screen.getByRole('alert').textContent).toMatch(
      /Falha ao carregar contas/i,
    );
  });

  it('mantem a acao real de criar conta', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Nome da conta'), {
      target: { value: 'Conta Nova' },
    });
    fireEvent.change(screen.getByLabelText('Nome do ADMIN'), {
      target: { value: 'Novo Admin' },
    });
    fireEvent.change(screen.getByLabelText('Email do ADMIN'), {
      target: { value: 'novo@example.com' },
    });
    fireEvent.change(
      screen.getByLabelText('Limite de instituições'),
      {
        target: { value: '2' },
      },
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /Criar conta/i,
      }),
    );

    await waitFor(() => {
      expect(hookMock.createMutateAsync).toHaveBeenCalledWith({
        accountName: 'Conta Nova',
        adminFullName: 'Novo Admin',
        adminEmail: 'novo@example.com',
        institutionLimit: 2,
      });
      expect(
        screen.getByText(/Conta criada e convite enviado/i),
      ).toBeDefined();
    });
  });

  it('mostra conflito de adminEmail sem limpar os demais campos', async () => {
    hookMock.createMutateAsync.mockRejectedValueOnce(
      new AccountServiceError(
        'Já existe um usuário cadastrado com este e-mail.',
        'EMAIL_ALREADY_REGISTERED',
        {
          adminEmail: 'Este e-mail já está cadastrado.',
        },
      ),
    );

    renderPage();

    fireEvent.change(screen.getByLabelText('Nome da conta'), {
      target: { value: 'Conta Nova' },
    });
    fireEvent.change(screen.getByLabelText('Nome do ADMIN'), {
      target: { value: 'Novo Admin' },
    });
    fireEvent.change(screen.getByLabelText('Email do ADMIN'), {
      target: { value: 'existente@example.com' },
    });
    fireEvent.change(
      screen.getByLabelText('Limite de instituições'),
      {
        target: { value: '2' },
      },
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /Criar conta/i,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText('Este e-mail já está cadastrado.'),
      ).toBeDefined();
      expect(
        screen.getByDisplayValue('Conta Nova'),
      ).toBeDefined();
      expect(
        screen.getByDisplayValue('Novo Admin'),
      ).toBeDefined();
      expect(
        screen.getByDisplayValue('existente@example.com'),
      ).toBeDefined();
    });
  });

  it('mantem as acoes reais de limite e status', async () => {
    renderPage();

    fireEvent.change(
      screen.getByLabelText('Limite de Conta Alfa'),
      {
        target: { value: '4' },
      },
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /Salvar limite de Conta Alfa/i,
      }),
    );

    await waitFor(() => {
      expect(hookMock.updateMutateAsync).toHaveBeenCalledWith({
        accountId: 'account-1',
        institutionLimit: 4,
      });
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: /Suspender/i,
      }),
    );

    await waitFor(() => {
      expect(hookMock.updateMutateAsync).toHaveBeenCalledWith({
        accountId: 'account-1',
        status: 'SUSPENDED',
      });
    });
  });

  it('remove acoes superiores redundantes e mantem somente a criacao real', () => {
    renderPage();

    expect(
      screen.queryByRole('button', {
        name: /Atualizar/i,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: /Nova conta/i,
      }),
    ).toBeNull();
    expect(
      screen.getAllByRole('button', {
        name: /Criar conta/i,
      }),
    ).toHaveLength(1);
  });

  it('exige confirmacao por e-mail para excluir administrador', async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole('button', {
        name: /Excluir administrador de Conta Alfa/i,
      }),
    );

    expect(
      screen.getByRole('dialog', {
        name: /Excluir conta e administrador/i,
      }),
    ).toBeDefined();
    expect(screen.getAllByText('Conta Alfa').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Ana Admin').length).toBeGreaterThan(1);
    expect(screen.getAllByText('ana@example.com').length).toBeGreaterThan(1);

    const confirmButton = screen.getByRole('button', {
      name: /^Excluir$/i,
    }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);

    fireEvent.change(
      screen.getByLabelText(
        /Digite o e-mail do administrador para confirmar/i,
      ),
      {
        target: { value: 'ana@example.com' },
      },
    );

    expect(confirmButton.disabled).toBe(false);
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(hookMock.deleteMutateAsync).toHaveBeenCalledWith({
        accountId: 'account-1',
      });
      expect(
        screen.getByText(/Conta vazia e administrador exclu/i),
      ).toBeDefined();
    });
  });

  it('mostra ACCOUNT_NOT_EMPTY sem remover item da interface', async () => {
    hookMock.deleteMutateAsync.mockRejectedValueOnce(
      new AccountServiceError(
        'Esta conta possui instituições ou vínculos e não pode ser excluída.',
        'ACCOUNT_NOT_EMPTY',
      ),
    );

    renderPage();

    fireEvent.click(
      screen.getByRole('button', {
        name: /Excluir administrador de Conta Alfa/i,
      }),
    );
    fireEvent.change(
      screen.getByLabelText(
        /Digite o e-mail do administrador para confirmar/i,
      ),
      {
        target: { value: 'ana@example.com' },
      },
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /^Excluir$/i,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          /Esta conta possui instituições ou vínculos e não pode ser excluída/i,
        ),
      ).toBeDefined();
      expect(screen.getAllByText('Conta Alfa').length).toBeGreaterThan(1);
    });
  });

  it('filtra contas e instituicoes com dados reais', () => {
    renderPage();

    fireEvent.change(
      screen.getByLabelText('Buscar conta ou instituição'),
      {
        target: { value: 'Escola Alpha' },
      },
    );

    expect(screen.getByText('Conta Alfa')).toBeDefined();
    expect(screen.queryByText('Conta Beta')).toBeNull();
    expect(
      screen.queryByText('Conta Cancelada'),
    ).toBeNull();

    fireEvent.change(
      screen.getByLabelText('Buscar conta ou instituição'),
      {
        target: { value: '' },
      },
    );
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'SUSPENDED' },
    });

    expect(screen.getByText('Conta Beta')).toBeDefined();
    expect(screen.queryByText('Conta Alfa')).toBeNull();
    expect(
      screen.queryByText('Conta Cancelada'),
    ).toBeNull();
  });

  it('nao renderiza elementos ficticios do prototipo', () => {
    renderPage();

    expect(
      screen.queryByText(/Distribuição Geográfica/i),
    ).toBeNull();
    expect(screen.queryByText(/Acessar como suporte/i)).toBeNull();
    expect(screen.queryByText(/485,2 mil alunos/i)).toBeNull();
    expect(screen.queryByText(/24 estados/i)).toBeNull();
  });

  it('Todos nao exibe conta CANCELED', () => {
    renderPage();

    expect(screen.getByText('Conta Alfa')).toBeDefined();
    expect(screen.getByText('Conta Beta')).toBeDefined();
    expect(
      screen.queryByText('Conta Cancelada'),
    ).toBeNull();
  });

  it('filtro CANCELED exibe somente canceladas', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'CANCELED' },
    });

    expect(
      screen.getByText('Conta Cancelada'),
    ).toBeDefined();
    expect(screen.queryByText('Conta Alfa')).toBeNull();
    expect(screen.queryByText('Conta Beta')).toBeNull();
  });

  it('busca em Todos nao recupera cancelada', () => {
    renderPage();

    fireEvent.change(
      screen.getByLabelText('Buscar conta ou instituição'),
      {
        target: { value: 'Cancelada' },
      },
    );

    expect(
      screen.queryByText('Conta Cancelada'),
    ).toBeNull();
  });

  it('busca em CANCELED encontra cancelada', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'CANCELED' },
    });
    fireEvent.change(
      screen.getByLabelText('Buscar conta ou instituição'),
      {
        target: { value: 'Cancelada' },
      },
    );

    expect(
      screen.getByText('Conta Cancelada'),
    ).toBeDefined();
  });

  it('conta cancelada mantem botao Ver historico', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'CANCELED' },
    });

    expect(
      screen.getByText('Ver histórico'),
    ).toBeDefined();
    expect(
      screen.getByText('Dados preservados para auditoria'),
    ).toBeDefined();
  });

  it('nenhuma exclusao fisica e executada', () => {
    renderPage();

    expect(
      hookMock.deleteMutateAsync,
    ).not.toHaveBeenCalled();
  });

  it('filtros Ativas e Suspensas continuam funcionando', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'ACTIVE' },
    });

    expect(screen.getByText('Conta Alfa')).toBeDefined();
    expect(screen.queryByText('Conta Beta')).toBeNull();
    expect(
      screen.queryByText('Conta Cancelada'),
    ).toBeNull();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'SUSPENDED' },
    });

    expect(screen.getByText('Conta Beta')).toBeDefined();
    expect(screen.queryByText('Conta Alfa')).toBeNull();
    expect(
      screen.queryByText('Conta Cancelada'),
    ).toBeNull();
  });

  it('mostra mensagem para filtro sem resultados', () => {
    renderPage();

    fireEvent.change(
      screen.getByLabelText('Buscar conta ou instituição'),
      {
        target: { value: 'naoexiste' },
      },
    );

    expect(
      screen.getByText(
        /Nenhuma conta encontrada para os filtros informados/i,
      ),
    ).toBeDefined();
  });
});
