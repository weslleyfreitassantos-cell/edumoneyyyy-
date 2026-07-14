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

const hookMock = vi.hoisted(() => ({
  accountsQuery: {} as any,
  createAccount: {} as any,
  updateAccount: {} as any,
  refetch: vi.fn(),
  createMutateAsync: vi.fn(),
  updateMutateAsync: vi.fn(),
}));

vi.mock('../../hooks/useAccounts', () => ({
  useAccounts: () => hookMock.accountsQuery,
  useCreateClientAccount: () => hookMock.createAccount,
  useUpdateClientAccount: () => hookMock.updateAccount,
}));

const accounts = [
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
      active: true,
    },
    institutions: [
      {
        id: 'institution-1',
        name: 'Escola Alpha',
        active: true,
        account_id: 'account-1',
      },
      {
        id: 'institution-2',
        name: 'Escola Pausada',
        active: false,
        account_id: 'account-1',
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
] as const;

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
      refetch: hookMock.refetch,
    };
    hookMock.createAccount = {
      isPending: false,
      mutateAsync: hookMock.createMutateAsync,
    };
    hookMock.updateAccount = {
      isPending: false,
      mutateAsync: hookMock.updateMutateAsync,
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

  it('permite atualizar a lista real', () => {
    renderPage();

    fireEvent.click(
      screen.getByRole('button', {
        name: /Atualizar/i,
      }),
    );

    expect(hookMock.refetch).toHaveBeenCalledTimes(1);
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
});
