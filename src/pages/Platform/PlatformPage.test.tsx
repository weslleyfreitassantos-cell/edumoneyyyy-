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
import { AccountServiceError } from '../../services/accountService';

const hookMock = vi.hoisted(() => ({
  accountsQuery: {} as any,
  createAccount: {} as any,
  updateAccount: {} as any,
  updateInstitutionStatus: {} as any,
  deleteAccount: {} as any,
  globalBrandingQuery: {} as any,
  saveGlobalBranding: {} as any,
  domainRequestsQuery: {} as any,
  activateDomain: {} as any,
  disableDomain: {} as any,
  createMutateAsync: vi.fn(),
  updateMutateAsync: vi.fn(),
  updateInstitutionStatusMutateAsync: vi.fn(),
  deleteMutateAsync: vi.fn(),
  saveGlobalBrandingMutateAsync: vi.fn(),
  activateDomainMutateAsync: vi.fn(),
  disableDomainMutateAsync: vi.fn(),
  setCurrentInstitutionId: vi.fn(),
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
  useDeleteClientAccount: () => hookMock.deleteAccount,
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

const accounts = [
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
      role: 'ADMIN',
      platform_role: 'USER',
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
        name: 'Escola Luz',
        active: true,
        account_id: 'account-1',
      },
      {
        id: 'institution-3',
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
] as const;

function renderPage() {
  return render(<PlatformPage />);
}

function openInstitutionAccessDialog() {
  renderPage();

  fireEvent.click(
    screen.getByRole('button', {
      name: /Acessar escolas de Ana Admin/i,
    }),
  );

  return screen.getByRole('dialog', {
    name: /Acessar escola da conta/i,
  });
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
    hookMock.deleteAccount = {
      isPending: false,
      mutateAsync: hookMock.deleteMutateAsync,
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
      status: 'ACTIVE',
    });
    hookMock.updateInstitutionStatusMutateAsync.mockResolvedValue({
      success: true,
      institutionId: 'institution-1',
      active: false,
      currentInstitutionCount: 1,
      institutionLimit: 3,
      remainingSlots: 2,
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
    expect(
      screen.getAllByText('Conta Alfa').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Ana Admin')).toBeDefined();
    expect(
      screen.getByText('Escola Alpha'),
    ).toBeDefined();
    expect(screen.getByText('Escola Luz')).toBeDefined();
    expect(screen.getByText('Escola Pausada')).toBeDefined();
    expect(screen.getAllByText('Ativa').length).toBeGreaterThan(0);
    expect(screen.getByText('Suspensa')).toBeDefined();
    expect(
      screen.getByRole('button', {
        name: /Suspender Escola Alpha/i,
      }),
    ).toBeDefined();
    expect(
      screen.getByRole('button', {
        name: /Reativar Escola Pausada/i,
      }),
    ).toBeDefined();
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
      within(dialog).getByText('2 escolas encontradas'),
    ).toBeDefined();
    expect(within(dialog).getByText('Escola Alpha')).toBeDefined();
    expect(within(dialog).getByText('Escola Luz')).toBeDefined();
    expect(within(dialog).queryByText('Escola Pausada')).toBeNull();
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
      within(dialog).getByText('2 escolas encontradas'),
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

  it('acessa diretamente conta com uma escola mesmo suspensa', async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole('button', {
        name: /Acessar escolas de Bia Admin/i,
      }),
    );

    await waitFor(() => {
      expect(
        hookMock.setCurrentInstitutionId,
      ).toHaveBeenCalledWith('institution-4');
      expect(hookMock.navigate).toHaveBeenCalledWith('/admin');
    });

    expect(
      screen.queryByRole('dialog', {
        name: /Acessar escola da conta/i,
      }),
    ).toBeNull();
  });

  it('mostra mensagem quando a conta nao possui escolas ativas', async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole('button', {
        name: /Acessar escolas de Caio Admin/i,
      }),
    );

    expect(
      (
        await screen.findByRole('alert')
      ).textContent,
    ).toMatch(
      /Esta conta n.o possui escolas ativas para acessar/i,
    );
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

    fireEvent.click(
      within(alfaRow).getByRole('button', {
        name: /^Suspender$/i,
      }),
    );

    await waitFor(() => {
      expect(hookMock.updateMutateAsync).toHaveBeenCalledWith({
        accountId: 'account-1',
        status: 'SUSPENDED',
      });
    });
  });

  it('bloqueia limite abaixo das instituicoes ativas', () => {
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
      /limite m.nimo.*2.*institui..es ativas/i,
    );
  });

  it('suspende e reativa instituicao preservando historico', async () => {
    renderPage();

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
        screen.getByText(/Hist.rico acad.mico preservado/i),
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

    expect(
      screen.getAllByText('Conta Alfa').length,
    ).toBeGreaterThan(0);
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
});
