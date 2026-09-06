// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
  updateInstitutionStatus: {} as any,
  deleteInstitution: {} as any,
  closeAccount: {} as any,
  restoreAccount: {} as any,
  permanentlyDeleteAccount: {} as any,
  statusEventsQuery: {} as any,
  globalBrandingQuery: {} as any,
  saveGlobalBranding: {} as any,
  domainRequestsQuery: {} as any,
  activateDomain: {} as any,
  disableDomain: {} as any,
  createMutateAsync: vi.fn(),
  updateMutateAsync: vi.fn(),
  updateInstitutionStatusMutateAsync: vi.fn(),
  deleteInstitutionMutateAsync: vi.fn(),
  closeMutateAsync: vi.fn(),
  restoreMutateAsync: vi.fn(),
  permanentlyDeleteMutateAsync: vi.fn(),
  saveGlobalBrandingMutateAsync: vi.fn(),
  activateDomainMutateAsync: vi.fn(),
  disableDomainMutateAsync: vi.fn(),
  setCurrentInstitutionId: vi.fn(),
  clearCurrentInstitutionSelection: vi.fn(),
  currentInstitutionId: 'institution-1',
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => hookMock.navigate,
}));

vi.mock('../../hooks/useAccounts', () => ({
  useAccounts: () => hookMock.accountsQuery,
  useCreateClientAccount: () => hookMock.createAccount,
  useUpdateClientAccount: () => hookMock.updateAccount,
  useUpdateInstitutionStatus: () =>
    hookMock.updateInstitutionStatus,
  useDeleteInstitution: () => hookMock.deleteInstitution,
  useCloseClientAccount: () => hookMock.closeAccount,
  useRestoreClientAccount: () => hookMock.restoreAccount,
  useDeleteClientAccount: () =>
    hookMock.permanentlyDeleteAccount,
  useAccountStatusEvents: () => hookMock.statusEventsQuery,
}));

vi.mock('../../hooks/useBranding', () => ({
  useGlobalBranding: () => hookMock.globalBrandingQuery,
  useSaveGlobalBranding: () => hookMock.saveGlobalBranding,
  useDomainRequests: () => hookMock.domainRequestsQuery,
  useActivateDomain: () => hookMock.activateDomain,
  useDisableDomain: () => hookMock.disableDomain,
}));

vi.mock('../../contexts/InstitutionContext', () => ({
  useInstitution: () => ({
    setCurrentInstitutionId:
      hookMock.setCurrentInstitutionId,
    clearCurrentInstitutionSelection:
      hookMock.clearCurrentInstitutionSelection,
    currentInstitutionId:
      hookMock.currentInstitutionId,
  }),
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
    activeInstitutionCount: 2,
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
        name: 'Escola Luz',
        active: true,
        account_id: 'account-1',
        logoUrl: null,
        publicSlug: null,
      },
      {
        id: 'institution-3',
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
    activeInstitutionCount: 1,
    owner: {
      id: 'owner-2',
      full_name: 'Bia Admin',
      email: 'bia@example.com',
      role: 'ADMIN',
      platform_role: 'USER',
      active: true,
    },
    institutions: [
      {
        id: 'institution-4',
        name: 'Escola Beta',
        active: true,
        account_id: 'account-2',
        logoUrl: null,
        publicSlug: null,
      },
    ],
  },
  {
    id: 'account-3',
    name: 'Conta Gama',
    status: 'ACTIVE',
    institutionLimit: 1,
    activeInstitutionCount: 0,
    owner: {
      id: 'owner-3',
      full_name: 'Caio Admin',
      email: 'caio@example.com',
      role: 'ADMIN',
      platform_role: 'USER',
      active: true,
    },
    institutions: [],
  },
  {
    id: 'account-4',
    name: 'Conta Encerrada',
    status: 'CANCELED',
    institutionLimit: 1,
    activeInstitutionCount: 1,
    owner: {
      id: 'owner-4',
      full_name: 'Dora Admin',
      email: 'dora@example.com',
      role: 'ADMIN',
      platform_role: 'USER',
      active: true,
    },
    institutions: [
      {
        id: 'institution-5',
        name: 'Escola Histórica',
        active: true,
        account_id: 'account-4',
        logoUrl: null,
        publicSlug: null,
      },
    ],
  },
] as const;

function renderPage() {
  return render(<PlatformPage />);
}

function renderPageWithAccounts(
  data: AccountSummaryRow[],
) {
  hookMock.accountsQuery = {
    ...hookMock.accountsQuery,
    data,
  };

  return renderPage();
}

function getAccountsTable() {
  return screen.getByRole('table', {
    name: /Contas e instituições da plataforma/i,
  });
}

function openAccountManagementDialog(accountName = 'Conta Alfa') {
  fireEvent.click(
    screen.getByRole('button', {
      name: new RegExp(
        `Gerenciar escolas e ações de ${accountName}`,
        'i',
      ),
    }),
  );

  return screen.getByRole('dialog', {
    name: /Escolas e ações/i,
  });
}

function openInstitutionAccessDialog() {
  renderPage();
  return openAccountManagementDialog();
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
    hookMock.updateInstitutionStatus = {
      isPending: false,
      mutateAsync:
        hookMock.updateInstitutionStatusMutateAsync,
    };
    hookMock.deleteInstitution = {
      isPending: false,
      mutateAsync: hookMock.deleteInstitutionMutateAsync,
    };
    hookMock.closeAccount = {
      isPending: false,
      mutateAsync: hookMock.closeMutateAsync,
    };
    hookMock.restoreAccount = {
      isPending: false,
      mutateAsync: hookMock.restoreMutateAsync,
    };
    hookMock.permanentlyDeleteAccount = {
      isPending: false,
      mutateAsync: hookMock.permanentlyDeleteMutateAsync,
    };
    hookMock.statusEventsQuery = {
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    };
    hookMock.globalBrandingQuery = {
      data: {
        id: 'global-branding',
        scope: 'GLOBAL',
        accountId: null,
        displayName: 'EduManager Pro',
        logoUrl: null,
        logoPath: null,
        faviconUrl: null,
        faviconPath: null,
        primaryColor: '#005bbf',
        secondaryColor: '#6ffbbe',
      },
      isLoading: false,
    };
    hookMock.saveGlobalBranding = {
      isPending: false,
      mutateAsync: hookMock.saveGlobalBrandingMutateAsync,
    };
    hookMock.domainRequestsQuery = {
      data: [
        {
          id: 'domain-1',
          accountId: 'account-1',
          accountName: 'Conta Alfa',
          hostname: 'alfa.example.com',
          status: 'PENDING',
          isPrimary: false,
          createdAt: '2026-07-22T00:00:00.000Z',
        },
      ],
      isLoading: false,
    };
    hookMock.activateDomain = {
      isPending: false,
      mutateAsync: hookMock.activateDomainMutateAsync,
    };
    hookMock.disableDomain = {
      isPending: false,
      mutateAsync: hookMock.disableDomainMutateAsync,
    };
    hookMock.setCurrentInstitutionId.mockResolvedValue({
      success: true,
      institutionId: 'institution-1',
    });
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
      previousStatus: 'ACTIVE',
      status: 'ACTIVE',
      auditEventId: null,
      statusChanged: false,
    });
    hookMock.updateInstitutionStatusMutateAsync.mockResolvedValue({
      success: true,
      institutionId: 'institution-1',
      active: false,
      currentInstitutionCount: 1,
      institutionLimit: 3,
      remainingSlots: 2,
      suspendedByScope: 'PLATFORM',
    });
    hookMock.deleteInstitutionMutateAsync.mockResolvedValue({
      success: true,
      institutionId: 'institution-1',
      accountId: 'account-1',
      currentInstitutionCount: 2,
      institutionLimit: 3,
      remainingSlots: 1,
      summary: {},
    });
    hookMock.closeMutateAsync.mockResolvedValue({
      success: true,
      accountId: 'account-1',
      institutionLimit: 3,
      previousStatus: 'ACTIVE',
      status: 'CANCELED',
      auditEventId: 'event-1',
      statusChanged: true,
    });
    hookMock.restoreMutateAsync.mockResolvedValue({
      success: true,
      accountId: 'account-4',
      institutionLimit: 1,
      previousStatus: 'CANCELED',
      status: 'ACTIVE',
      auditEventId: 'event-2',
      statusChanged: true,
    });
    hookMock.permanentlyDeleteMutateAsync.mockResolvedValue(
      {
        success: true,
        accountId: 'account-4',
        ownerProfileId: 'owner-4',
        ownerPreserved: false,
        deletedAuthUser: true,
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
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
    expect(
      screen.getAllByText('Conta Alfa').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Ana Admin')).toBeDefined();
    expect(screen.getAllByText('Ativa').length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('columnheader', {
        name: /^Instituições$/i,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('columnheader', {
        name: /^Ações$/i,
      }),
    ).toBeNull();
    expect(
      screen.getByRole('columnheader', {
        name: /^Gerenciar$/i,
      }),
    ).toBeDefined();
    expect(
      screen.getByRole('button', {
        name: /Gerenciar escolas e ações de Conta Alfa/i,
      }),
    ).toBeDefined();
    expect(screen.queryByText('Escola Alpha')).toBeNull();
    expect(screen.queryByText('Escola Luz')).toBeNull();
    expect(screen.queryByText('Escola Pausada')).toBeNull();
  });

  it('exibe busca, quantidade e somente escolas da conta do ADMIN', () => {
    const dialog = openInstitutionAccessDialog();

    expect(screen.getAllByText('Ana Admin').length).toBeGreaterThan(1);
    expect(screen.getAllByText('ana@example.com').length).toBeGreaterThan(1);
    expect(
      within(dialog).getByLabelText('Buscar escola'),
    ).toBe(document.activeElement);
    expect(
      within(dialog).getByPlaceholderText(
        'Digite o nome da escola...',
      ),
    ).toBeDefined();
    expect(
      within(dialog).getByText('3 escolas encontradas'),
    ).toBeDefined();
    expect(within(dialog).getByText('Escola Alpha')).toBeDefined();
    expect(within(dialog).getByText('Escola Luz')).toBeDefined();
    expect(within(dialog).getByText('Escola Pausada')).toBeDefined();
    expect(within(dialog).queryByText('Escola Beta')).toBeNull();
  });

  it('filtra escolas localmente ignorando maiusculas e espacos extras', () => {
    const dialog = openInstitutionAccessDialog();

    fireEvent.change(
      within(dialog).getByLabelText('Buscar escola'),
      {
        target: { value: '  escola   lUz  ' },
      },
    );

    expect(
      within(dialog).getByText('1 escola encontrada'),
    ).toBeDefined();
    expect(within(dialog).getByText('Escola Luz')).toBeDefined();
    expect(within(dialog).queryByText('Escola Alpha')).toBeNull();
  });

  it('mostra estado vazio e limpa a busca', () => {
    const dialog = openInstitutionAccessDialog();
    const searchInput =
      within(dialog).getByLabelText('Buscar escola');

    fireEvent.change(searchInput, {
      target: { value: 'inexistente' },
    });

    expect(
      within(dialog).getByText('0 escolas encontradas'),
    ).toBeDefined();
    expect(
      within(dialog).getByText(
        'Nenhuma escola encontrada para “inexistente”.',
      ),
    ).toBeDefined();

    fireEvent.click(
      within(dialog).getByRole('button', {
        name: /Limpar busca/i,
      }),
    );

    expect(
      (within(dialog).getByLabelText(
        'Buscar escola',
      ) as HTMLInputElement).value,
    ).toBe('');
    expect(
      within(dialog).getByText('3 escolas encontradas'),
    ).toBeDefined();
  });

  it('seleciona uma escola por vez e habilita o acesso somente apos selecao', async () => {
    const dialog = openInstitutionAccessDialog();
    const accessButton = within(dialog).getByRole(
      'button',
      {
        name: /^Acessar escola$/i,
      },
    ) as HTMLButtonElement;

    expect(accessButton.disabled).toBe(true);
    expect(
      within(dialog)
        .getByRole('option', { name: /Escola Alpha/i })
        .getAttribute('aria-selected'),
    ).toBe('false');

    fireEvent.click(
      within(dialog).getByRole('option', {
        name: /Escola Alpha/i,
      }),
    );

    expect(accessButton.disabled).toBe(false);
    expect(
      within(dialog)
        .getByRole('option', { name: /Escola Alpha/i })
        .getAttribute('aria-selected'),
    ).toBe('true');
    expect(
      within(dialog)
        .getByRole('option', { name: /Escola Luz/i })
        .getAttribute('aria-selected'),
    ).toBe('false');

    fireEvent.click(
      within(dialog).getByRole('option', {
        name: /Escola Luz/i,
      }),
    );

    expect(
      within(dialog)
        .getByRole('option', { name: /Escola Alpha/i })
        .getAttribute('aria-selected'),
    ).toBe('false');
    expect(
      within(dialog)
        .getByRole('option', { name: /Escola Luz/i })
        .getAttribute('aria-selected'),
    ).toBe('true');

    fireEvent.click(accessButton);

    await waitFor(() => {
      expect(
        hookMock.setCurrentInstitutionId,
      ).toHaveBeenCalledWith('institution-2');
      expect(hookMock.navigate).toHaveBeenCalledWith('/admin');
    });
  });

  it('bloqueia acesso direto a escolas de conta suspensa', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'SUSPENDED' },
    });

    const suspendedRow = screen
      .getByText('Bia Admin')
      .closest('tr');

    expect(suspendedRow).not.toBeNull();
    expect(
      within(suspendedRow!).getByText('Suspensa'),
    ).toBeDefined();
    fireEvent.click(
      within(suspendedRow!).getByRole('button', {
        name: /Gerenciar escolas e ações de Conta Beta/i,
      }),
    );

    const dialog = screen.getByRole('dialog', {
      name: /Escolas e ações/i,
    });
    const accessButton = within(dialog).getByRole('button', {
      name: /^Acessar escola$/i,
    }) as HTMLButtonElement;

    fireEvent.click(
      within(dialog).getByRole('option', {
        name: /Escola Beta/i,
      }),
    );

    expect(accessButton.disabled).toBe(true);
    expect(
      within(dialog).getByRole('button', {
        name: /Reativar Conta Beta/i,
      }),
    ).toBeDefined();
  });

  it('mostra mensagem quando a conta nao possui escolas cadastradas', () => {
    renderPage();

    fireEvent.click(
      screen.getByRole('button', {
        name: /Gerenciar escolas e ações de Conta Gama/i,
      }),
    );

    expect(
      screen.getByRole('status').textContent,
    ).toMatch(/Nenhuma escola cadastrada nesta conta/i);
    expect(
      hookMock.setCurrentInstitutionId,
    ).not.toHaveBeenCalled();
  });

  it('mostra identidade da plataforma e solicitacoes de dominio para SUPER_ADMIN', () => {
    renderPage();

    expect(
      screen.getByRole('heading', {
        name: /Identidade da plataforma/i,
      }),
    ).toBeDefined();
    expect(
      screen.getByText(/serve como padrao para contas sem marca propria/i),
    ).toBeDefined();
    expect(
      screen.getByRole('heading', {
        name: /Solicitacoes de dominio/i,
      }),
    ).toBeDefined();
    expect(screen.getByText('alfa.example.com')).toBeDefined();
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

  it('renderiza formulario simplificado de novo cliente', () => {
    renderPage();

    expect(
      screen.getByRole('heading', {
        name: /Novo cliente/i,
      }),
    ).toBeDefined();
    expect(
      screen.queryByLabelText('Nome da conta'),
    ).toBeNull();
    expect(
      screen.getByLabelText('Nome do ADMIN'),
    ).toBeDefined();
    expect(
      screen.getByLabelText('Email do ADMIN'),
    ).toBeDefined();
    expect(
      screen.getByLabelText('Limite de instituições'),
    ).toBeDefined();
  });

  it('mantem a acao real de criar conta usando o nome do ADMIN como accountName', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Nome do ADMIN'), {
      target: { value: '  Samuel Araújo  ' },
    });
    fireEvent.change(screen.getByLabelText('Email do ADMIN'), {
      target: { value: 'Samuel@Email.COM' },
    });
    fireEvent.change(
      screen.getByLabelText('Limite de instituições'),
      {
        target: { value: '5' },
      },
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /Criar conta/i,
      }),
    );

    await waitFor(() => {
      expect(hookMock.createMutateAsync).toHaveBeenCalledWith({
        accountName: 'Samuel Araújo',
        adminFullName: 'Samuel Araújo',
        adminEmail: 'samuel@email.com',
        institutionLimit: 5,
      });
      expect(
        screen.getByText(/Conta criada e convite enviado/i),
      ).toBeDefined();
    });
  });

  it('bloqueia criacao com nome do ADMIN vazio', () => {
    renderPage();

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

    expect(hookMock.createMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(
      /Informe ADMIN, e-mail e limite/i,
    );
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
      expect(hookMock.createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          accountName: 'Novo Admin',
          adminFullName: 'Novo Admin',
          adminEmail: 'existente@example.com',
          institutionLimit: 2,
        }),
      );
      expect(
        screen.getByDisplayValue('Novo Admin'),
      ).toBeDefined();
      expect(
        screen.getByDisplayValue('existente@example.com'),
      ).toBeDefined();
    });
  });

  it('mostra o conflito de uma conta excluida dentro do bloco Novo cliente', async () => {
    const canceledMessage =
      'Este e-mail pertence ao administrador de uma conta em Excluídos. Restaure essa conta ou exclua-a definitivamente antes de reutilizar este e-mail.';

    hookMock.createMutateAsync.mockRejectedValueOnce(
      new AccountServiceError(
        'Este usuário já administra outra conta.',
        'EMAIL_BELONGS_TO_ACCOUNT_OWNER',
        {
          adminEmail: 'Este usuário já administra outra conta.',
        },
      ),
    );

    renderPage();

    fireEvent.change(screen.getByLabelText('Nome do ADMIN'), {
      target: { value: 'Novo Admin' },
    });
    fireEvent.change(screen.getByLabelText('Email do ADMIN'), {
      target: { value: ' DORA@EXAMPLE.COM ' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Criar conta/i }),
    );

    await waitFor(() => {
      const alert = screen.getByRole('alert');

      expect(alert.textContent).toContain(canceledMessage);
      expect(alert.closest('form')).not.toBeNull();
      expect(
        screen.getByLabelText('Email do ADMIN').getAttribute(
          'aria-invalid',
        ),
      ).toBe('true');
      expect(screen.getAllByText(canceledMessage)).toHaveLength(1);
      expect(
        screen.queryByText('Este usuário já administra outra conta.'),
      ).toBeNull();
    });
  });

  it('mantem a mensagem generica para owner de conta ativa', async () => {
    hookMock.createMutateAsync.mockRejectedValueOnce(
      new AccountServiceError(
        'Este usuário já administra outra conta.',
        'EMAIL_BELONGS_TO_ACCOUNT_OWNER',
      ),
    );

    renderPage();

    fireEvent.change(screen.getByLabelText('Nome do ADMIN'), {
      target: { value: 'Novo Admin' },
    });
    fireEvent.change(screen.getByLabelText('Email do ADMIN'), {
      target: { value: 'ANA@EXAMPLE.COM' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Criar conta/i }),
    );

    await waitFor(() => {
      const alert = screen.getByRole('alert');

      expect(alert.textContent).toContain(
        'Este usuário já administra outra conta.',
      );
      expect(alert.textContent).not.toMatch(/Restaure essa conta/);
      expect(screen.getAllByText('Este usuário já administra outra conta.')).toHaveLength(1);
    });
  });

  it('mantem a mensagem generica para owner de conta suspensa', async () => {
    hookMock.createMutateAsync.mockRejectedValueOnce(
      new AccountServiceError(
        'Este usuário já administra outra conta.',
        'EMAIL_BELONGS_TO_ACCOUNT_OWNER',
      ),
    );

    renderPage();

    fireEvent.change(screen.getByLabelText('Nome do ADMIN'), {
      target: { value: 'Novo Admin' },
    });
    fireEvent.change(screen.getByLabelText('Email do ADMIN'), {
      target: { value: 'bia@example.com' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Criar conta/i }),
    );

    await waitFor(() => {
      const alert = screen.getByRole('alert');

      expect(alert.textContent).toContain(
        'Este usuário já administra outra conta.',
      );
      expect(alert.textContent).not.toMatch(/Restaure essa conta/);
      expect(screen.getAllByText('Este usuário já administra outra conta.')).toHaveLength(1);
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

    const alfaRow =
      screen
        .getByLabelText('Limite de Conta Alfa')
        .closest('tr')!;

    vi.spyOn(window, 'prompt').mockReturnValue(
      'Motivo valido da suspensao',
    );

    fireEvent.click(
      within(alfaRow).getByRole('button', {
        name: /Gerenciar escolas e ações de Conta Alfa/i,
      }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /Suspender Conta Alfa/i,
      }),
    );

    await waitFor(() => {
      expect(hookMock.updateMutateAsync).toHaveBeenCalledWith({
        accountId: 'account-1',
        status: 'SUSPENDED',
        reason: 'Motivo valido da suspensao',
      });
    });
  });

  it('bloqueia limite abaixo das licencas em uso', () => {
    renderPage();

    fireEvent.change(
      screen.getByLabelText('Limite de Conta Alfa'),
      {
        target: { value: '1' },
      },
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /Salvar limite de Conta Alfa/i,
      }),
    );

    expect(hookMock.updateMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(
      /limite m.nimo.*2.*licen.as em uso/i,
    );
  });

  it('suspende e reativa instituicao atualizando o modal', async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole('button', {
        name: /Gerenciar escolas e ações de Conta Alfa/i,
      }),
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /Suspender Escola Alpha/i,
      }),
    );

    await waitFor(() => {
      expect(
        hookMock.updateInstitutionStatusMutateAsync,
      ).toHaveBeenCalledWith({
        institutionId: 'institution-1',
        active: false,
      });
      expect(
        screen.getByRole('button', {
          name: /Reativar Escola Alpha/i,
        }),
      ).toBeDefined();
      expect(
        screen.getByText(/licen.a continua ocupada/i),
      ).toBeDefined();
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: /Reativar Escola Pausada/i,
      }),
    );

    await waitFor(() => {
      expect(
        hookMock.updateInstitutionStatusMutateAsync,
      ).toHaveBeenCalledWith({
        institutionId: 'institution-3',
        active: true,
      });
    });

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    fireEvent.click(
      screen.getByRole('button', {
        name: /Excluir Escola Alpha/i,
      }),
    );

    await waitFor(() => {
      expect(
        hookMock.deleteInstitutionMutateAsync,
      ).toHaveBeenCalledWith({
        accountId: 'account-1',
        institutionId: 'institution-1',
      });
      expect(
        screen.getByText(/licen.a foi liberada/i),
      ).toBeDefined();
      expect(screen.queryByText('Escola Alpha')).toBeNull();
    });
  });

  it('atualiza o modal de escolas quando os dados da conta sao recarregados', async () => {
    const { rerender } = renderPage();

    openAccountManagementDialog();

    expect(
      screen.getByRole('button', {
        name: /Suspender Escola Alpha/i,
      }),
    ).toBeDefined();

    hookMock.accountsQuery = {
      ...hookMock.accountsQuery,
      data: accounts.map((account) =>
        account.id === 'account-1'
          ? {
              ...account,
              institutions: account.institutions.map(
                (institution) =>
                  institution.id === 'institution-1'
                    ? {
                        ...institution,
                        active: false,
                      }
                    : institution,
              ),
            }
          : account,
      ),
    };

    rerender(<PlatformPage />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /Reativar Escola Alpha/i,
        }),
      ).toBeDefined();
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

  it('conta excluida mostra botoes Restaurar e Excluir permanentemente habilitados', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'DELETED' },
    });

    expect(
      screen.getByText('Conta Encerrada'),
    ).toBeDefined();
    expect(
      screen.getAllByText('Excluída').length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.queryByRole('button', {
        name: /Acessar escolas/i,
      }),
    ).toBeNull();
    const dialog = openAccountManagementDialog(
      'Conta Encerrada',
    );
    expect(
      within(dialog).getByRole('button', {
        name: /Restaurar/i,
      }),
    ).toBeDefined();
    expect(
      within(dialog).getByRole('button', {
        name: /Excluir permanentemente/i,
      }),
    ).toBeDefined();
    expect(
      screen.queryByRole('button', {
        name: /^Reativar$/i,
      }),
    ).toBeNull();
  });

  it('carrega historico de status sob demanda', async () => {
    hookMock.statusEventsQuery = {
      data: [
        {
          id: 'event-1',
          accountId: 'account-1',
          actorProfileId: 'super-admin-1',
          actorName: 'Super Admin',
          actorEmail: 'superadmin@admin.com',
          previousStatus: 'ACTIVE',
          newStatus: 'CANCELED',
          reason: 'Encerramento comercial solicitado.',
          metadata: {},
          createdAt: '2026-07-26T12:00:00.000Z',
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
    };

    renderPage();

    const alfaRow =
      screen
        .getByLabelText('Limite de Conta Alfa')
        .closest('tr')!;

    fireEvent.click(
      within(alfaRow).getByRole('button', {
        name: /Gerenciar escolas e ações de Conta Alfa/i,
      }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /Ver histórico de Conta Alfa/i,
      }),
    );

    expect(
      screen.getByRole('dialog', {
        name: /Histórico da conta/i,
      }),
    ).toBeDefined();
    expect(
      screen.getByText('Encerramento comercial solicitado.'),
    ).toBeDefined();
  });

  it('exige motivo e confirmacao por e-mail para excluir conta', async () => {
    renderPage();

    openAccountManagementDialog();
    fireEvent.click(
      screen.getByRole('button', {
        name: /Excluir conta Conta Alfa/i,
      }),
    );

    expect(
      screen.getByRole('dialog', {
        name: /Excluir conta/i,
      }),
    ).toBeDefined();
    expect(screen.getAllByText('Conta Alfa').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Ana Admin').length).toBeGreaterThan(1);
    expect(screen.getAllByText('ana@example.com').length).toBeGreaterThan(1);

    const confirmButton = screen.getByRole('button', {
      name: /^Excluir conta$/i,
    }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);

    fireEvent.change(
      screen.getByLabelText(/Motivo da exclusão/i),
      {
        target: {
          value: 'Exclusao solicitada.',
        },
      },
    );
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
      expect(hookMock.closeMutateAsync).toHaveBeenCalledWith({
        accountId: 'account-1',
        reason: 'Exclusao solicitada.',
      });
      expect(
        hookMock.clearCurrentInstitutionSelection,
      ).toHaveBeenCalled();
      expect(hookMock.navigate).toHaveBeenCalledWith(
        '/platform',
      );
      expect(
        screen.getAllByText(
          /Conta movida para Excluídos/i,
        ).length,
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it('mostra erro de exclusao sem remover item da interface', async () => {
    hookMock.closeMutateAsync.mockRejectedValueOnce(
      new AccountServiceError(
        'Não foi possível excluir a conta.',
        'ACCOUNT_STATUS_TRANSITION_INVALID',
      ),
    );

    renderPage();

    openAccountManagementDialog();
    fireEvent.click(
      screen.getByRole('button', {
        name: /Excluir conta Conta Alfa/i,
      }),
    );
    fireEvent.change(
      screen.getByLabelText(/Motivo da exclusão/i),
      {
        target: {
          value: 'Exclusao solicitada.',
        },
      },
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
        name: /^Excluir conta$/i,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          /Não foi possível excluir a conta/i,
        ),
      ).toBeDefined();
      expect(screen.getAllByText('Conta Alfa').length).toBeGreaterThan(1);
      expect(
        hookMock.clearCurrentInstitutionSelection,
      ).not.toHaveBeenCalled();
      expect(hookMock.navigate).not.toHaveBeenCalled();
    });
  });

  it('exclui conta sem instituicoes sem limpar selecao de outra conta', async () => {
    renderPage();

    openAccountManagementDialog('Conta Gama');
    fireEvent.click(
      screen.getByRole('button', {
        name: /Excluir conta Conta Gama/i,
      }),
    );

    expect(
      screen.getByRole('dialog', {
        name: /Excluir conta/i,
      }),
    ).toBeDefined();
    expect(screen.getAllByText('Conta Gama').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Caio Admin').length).toBeGreaterThan(1);
    expect(screen.getAllByText('caio@example.com').length).toBeGreaterThan(1);

    fireEvent.change(
      screen.getByLabelText(/Motivo da exclusão/i),
      {
        target: { value: 'Exclusao solicitada pelo cliente.' },
      },
    );
    fireEvent.change(
      screen.getByLabelText(
        /Digite o e-mail do administrador para confirmar/i,
      ),
      {
        target: { value: 'caio@example.com' },
      },
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /^Excluir conta$/i,
      }),
    );

    await waitFor(() => {
      expect(hookMock.closeMutateAsync).toHaveBeenCalledWith({
        accountId: 'account-3',
        reason: 'Exclusao solicitada pelo cliente.',
      });
      expect(
        hookMock.clearCurrentInstitutionSelection,
      ).not.toHaveBeenCalled();
      expect(hookMock.navigate).toHaveBeenCalledWith('/platform');
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

    expect(
      screen.getAllByText('Conta Alfa').length,
    ).toBeGreaterThan(0);
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
    expect(
      screen.queryByRole('button', {
        name: /Salvar limite de Conta Alfa/i,
      }),
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

  it('abre por padrao mostrando somente contas ativas', () => {
    renderPage();

    expect(
      screen.getAllByText('Conta Alfa').length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Conta Beta')).toBeNull();
    expect(
      screen.queryByText('Conta Encerrada'),
    ).toBeNull();
  });

  it('Todos exibe ativas, suspensas e excluidas', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'ALL' },
    });

    expect(
      screen.getAllByText('Conta Alfa').length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Conta Beta')).toBeDefined();
    expect(screen.getByText('Conta Encerrada')).toBeDefined();
  });

  it('filtro Excluidos exibe somente excluidas', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'DELETED' },
    });

    expect(
      screen.getByText('Conta Encerrada'),
    ).toBeDefined();
    expect(screen.queryByText('Conta Beta')).toBeNull();
  });

  it('busca em Todos encontra conta excluida', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'ALL' },
    });
    fireEvent.change(
      screen.getByLabelText('Buscar conta ou instituição'),
      {
        target: { value: 'Encerrada' },
      },
    );

    expect(
      screen.getByText('Conta Encerrada'),
    ).toBeDefined();
  });

  it('busca em Excluidos encontra conta excluida', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'DELETED' },
    });
    fireEvent.change(
      screen.getByLabelText('Buscar conta ou instituição'),
      {
        target: { value: 'Encerrada' },
      },
    );

    expect(
      screen.getByText('Conta Encerrada'),
    ).toBeDefined();
  });

  it('mantem Excluidos ao limpar somente a busca', () => {
    renderPage();

    const statusFilter = screen.getByLabelText('Status') as HTMLSelectElement;
    const search = screen.getByLabelText(
      'Buscar conta ou instituição',
    ) as HTMLInputElement;

    fireEvent.change(statusFilter, {
      target: { value: 'DELETED' },
    });
    fireEvent.change(search, {
      target: { value: 'dora@example.com' },
    });

    expect(screen.getByText('Conta Encerrada')).toBeDefined();

    fireEvent.change(search, { target: { value: '' } });

    expect(statusFilter.value).toBe('DELETED');
    expect(
      within(getAccountsTable()).getByText('Conta Encerrada'),
    ).toBeDefined();
    expect(
      within(getAccountsTable()).queryByText('Conta Alfa'),
    ).toBeNull();
  });

  it('conta excluida mantem botao Ver historico e exibe acoes pendentes no modal', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'DELETED' },
    });

    const dialog = openAccountManagementDialog(
      'Conta Encerrada',
    );

    expect(
      within(dialog).getByRole('button', {
        name: /Ver histórico de Conta Encerrada/i,
      }),
    ).toBeDefined();
    expect(
      screen.getAllByText('Excluída').length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      within(dialog).getByRole('button', {
        name: /Restaurar Conta Encerrada/i,
      }),
    ).toBeDefined();
    expect(
      within(dialog).getByRole('button', {
        name: /Excluir permanentemente Conta Encerrada/i,
      }),
    ).toBeDefined();
  });

  it('restauracao exibe botao Restaurar como botao habilitado', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'DELETED' },
    });

    const dialog = openAccountManagementDialog(
      'Conta Encerrada',
    );
    const restoreButton = within(dialog).getByRole('button', {
      name: /Restaurar/i,
    });
    expect(restoreButton).toBeDefined();
    expect(
      restoreButton.tagName,
    ).toBe('BUTTON');
  });

  it('exclusao permanente exibe botao Excluir permanentemente habilitado', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'DELETED' },
    });

    const dialog = openAccountManagementDialog(
      'Conta Encerrada',
    );
    const deleteButton = within(dialog).getByRole('button', {
      name: /Excluir permanentemente/i,
    });
    expect(deleteButton).toBeDefined();
    expect(
      deleteButton.tagName,
    ).toBe('BUTTON');
  });

  it('nenhuma exclusao fisica e executada sem acao', () => {
    renderPage();

    expect(
      hookMock.closeMutateAsync,
    ).not.toHaveBeenCalled();
  });

  it('filtros Ativas e Suspensas continuam funcionando', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'ACTIVE' },
    });

    expect(
      screen.getAllByText('Conta Alfa').length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Conta Beta')).toBeNull();
    expect(
      screen.queryByText('Conta Encerrada'),
    ).toBeNull();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'SUSPENDED' },
    });

    expect(screen.getByText('Conta Beta')).toBeDefined();
    expect(
      screen.queryByText('Conta Encerrada'),
    ).toBeNull();
  });

  it('mantem o total de Todos consistente com as contas existentes', () => {
    const filterFixture = accounts.filter(
      (account) => account.id !== 'account-3',
    );

    renderPageWithAccounts(filterFixture);

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'ALL' },
    });

    expect(screen.getByText('3 contas no total')).toBeDefined();
    expect(
      getAccountsTable().querySelectorAll('tbody tr'),
    ).toHaveLength(3);
    expect(
      within(getAccountsTable()).getByText('Conta Alfa'),
    ).toBeDefined();
    expect(
      within(getAccountsTable()).getByText('Conta Beta'),
    ).toBeDefined();
    expect(
      within(getAccountsTable()).getByText('Conta Encerrada'),
    ).toBeDefined();
  });

  it('mostra a transicao ACTIVE para CANCELED conforme o refetch', async () => {
    const { rerender } = renderPage();

    openAccountManagementDialog('Conta Alfa');
    fireEvent.click(
      screen.getByRole('button', {
        name: /Excluir conta Conta Alfa/i,
      }),
    );
    fireEvent.change(
      screen.getByLabelText(/Motivo da exclusão/i),
      { target: { value: 'Encerramento comercial QA.' } },
    );
    fireEvent.change(
      screen.getByLabelText(
        /Digite o e-mail do administrador para confirmar/i,
      ),
      { target: { value: 'ana@example.com' } },
    );
    fireEvent.click(
      screen.getByRole('button', { name: /^Excluir conta$/i }),
    );

    await waitFor(() => {
      expect(hookMock.closeMutateAsync).toHaveBeenCalledWith({
        accountId: 'account-1',
        reason: 'Encerramento comercial QA.',
      });
    });

    const refetchedAccounts = accounts.map((account) =>
      account.id === 'account-1'
        ? { ...account, status: 'CANCELED' as const }
        : account,
    );
    hookMock.accountsQuery = {
      ...hookMock.accountsQuery,
      data: refetchedAccounts,
    };
    rerender(<PlatformPage />);

    expect(
      within(getAccountsTable()).queryByText('Conta Alfa'),
    ).toBeNull();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'DELETED' },
    });
    expect(
      within(getAccountsTable()).getByText('Conta Alfa'),
    ).toBeDefined();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'ALL' },
    });
    expect(
      within(getAccountsTable()).getByText('Conta Alfa'),
    ).toBeDefined();
  });

  it('restauracao move CANCELED para Ativas apos o refetch', async () => {
    const { rerender } = renderPage();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'DELETED' },
    });
    const dialog = openAccountManagementDialog('Conta Encerrada');
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: /Restaurar Conta Encerrada/i,
      }),
    );
    const restoreDialog = screen.getByRole('dialog', {
      name: /Restaurar conta/i,
    });
    fireEvent.click(
      within(restoreDialog).getByRole('button', {
        name: /^Restaurar$/i,
      }),
    );

    await waitFor(() => {
      expect(hookMock.restoreMutateAsync).toHaveBeenCalledWith({
        accountId: 'account-4',
        reason: 'Restauracao pelo super admin.',
      });
    });

    hookMock.accountsQuery = {
      ...hookMock.accountsQuery,
      data: accounts.map((account) =>
        account.id === 'account-4'
          ? { ...account, status: 'ACTIVE' as const }
          : account,
      ),
    };
    rerender(<PlatformPage />);

    expect(screen.queryByText('Conta Encerrada')).toBeNull();
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'ACTIVE' },
    });
    expect(
      within(getAccountsTable()).getByText('Conta Encerrada'),
    ).toBeDefined();
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'ALL' },
    });
    expect(
      within(getAccountsTable()).getByText('Conta Encerrada'),
    ).toBeDefined();
  });

  it('hard delete remove a conta de todos os filtros', async () => {
    const { rerender } = renderPage();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'DELETED' },
    });
    openAccountManagementDialog('Conta Encerrada');
    fireEvent.click(
      screen.getByRole('button', {
        name: /Excluir permanentemente Conta Encerrada/i,
      }),
    );
    fireEvent.change(
      screen.getByLabelText(/Motivo da exclusão permanente/i),
      { target: { value: 'Remocao definitiva QA.' } },
    );
    fireEvent.change(
      screen.getByLabelText(
        /Digite o e-mail do administrador para confirmar/i,
      ),
      { target: { value: 'dora@example.com' } },
    );
    fireEvent.change(
      screen.getByLabelText(/EXCLUIR DEFINITIVAMENTE/i),
      { target: { value: 'EXCLUIR DEFINITIVAMENTE' } },
    );
    fireEvent.click(
      screen.getByRole('checkbox'),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /Excluir permanentemente/i,
      }),
    );

    await waitFor(() => {
      expect(
        hookMock.permanentlyDeleteMutateAsync,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: 'account-4' }),
      );
    });

    hookMock.accountsQuery = {
      ...hookMock.accountsQuery,
      data: accounts.filter((account) => account.id !== 'account-4'),
    };
    rerender(<PlatformPage />);

    for (const status of ['ALL', 'ACTIVE', 'SUSPENDED', 'DELETED']) {
      fireEvent.change(screen.getByLabelText('Status'), {
        target: { value: status },
      });
      expect(screen.queryByText('Conta Encerrada')).toBeNull();
    }
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
