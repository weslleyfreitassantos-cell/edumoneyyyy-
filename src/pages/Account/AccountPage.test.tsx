// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import {
  MemoryRouter,
} from 'react-router-dom';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import {
  useCreateInstitution,
  useDeleteInstitution,
  useOwnedAccount,
  useUpdateInstitutionName,
  useUpdateInstitutionStatus,
} from '../../hooks/useAccounts';
import { AccountServiceError } from '../../services/accountService';
import AccountPage from './AccountPage';

const routerMock = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>(
      'react-router-dom',
    );

  return {
    ...actual,
    useNavigate: () => routerMock.navigate,
  };
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../contexts/InstitutionContext', () => ({
  useInstitution: vi.fn(),
}));

vi.mock('../../hooks/useAccounts', () => ({
  useOwnedAccount: vi.fn(),
  useCreateInstitution: vi.fn(),
  useUpdateInstitutionName: vi.fn(),
  useUpdateInstitutionStatus: vi.fn(),
  useDeleteInstitution: vi.fn(),
}));

const brandingHookMock = vi.hoisted(() => ({
  accountBrandingQuery: {} as any,
  saveAccountBranding: {} as any,
  accountDomainsQuery: {} as any,
  requestAccountDomain: {} as any,
  saveAccountBrandingMutateAsync: vi.fn(),
  requestAccountDomainMutateAsync: vi.fn(),
}));

vi.mock('../../hooks/useBranding', () => ({
  useAccountBranding: () =>
    brandingHookMock.accountBrandingQuery,
  useSaveAccountBranding: () =>
    brandingHookMock.saveAccountBranding,
  useAccountDomains: () =>
    brandingHookMock.accountDomainsQuery,
  useRequestAccountDomain: () =>
    brandingHookMock.requestAccountDomain,
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseInstitution =
  vi.mocked(useInstitution);
const mockedUseOwnedAccount =
  vi.mocked(useOwnedAccount);
const mockedUseCreateInstitution =
  vi.mocked(useCreateInstitution);
const mockedUseUpdateInstitutionName = vi.mocked(
  useUpdateInstitutionName,
);
const mockedUseUpdateInstitutionStatus = vi.mocked(
  useUpdateInstitutionStatus,
);
const mockedUseDeleteInstitution = vi.mocked(
  useDeleteInstitution,
);

const createInstitution = vi.fn();
const updateInstitutionName = vi.fn();
const updateInstitutionStatus = vi.fn();
const deleteInstitution = vi.fn();
const setCurrentInstitutionId = vi.fn();
const clearCurrentInstitutionSelection = vi.fn();

function renderPage() {
  render(
    <MemoryRouter>
      <AccountPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  routerMock.navigate.mockReset();

  mockedUseAuth.mockReturnValue({
    user: null,
    profile: {
      id: 'profile-1',
      full_name: 'Ana Admin',
      email: 'ana@escola.com',
      role: 'ADMIN',
      platform_role: 'USER',
      avatar_url: null,
    },
    loading: false,
    signIn: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
  });

  mockedUseInstitution.mockReturnValue({
    institutions: [],
    currentInstitution: null,
    currentMembership: null,
    currentInstitutionId: null,
    currentRole: null,
    isLoading: false,
    isSwitchingInstitution: false,
    error: null,
    hasMultipleInstitutions: false,
    setCurrentInstitutionId,
    clearCurrentInstitutionSelection,
    refresh: vi.fn(async () => undefined),
  });

  mockedUseOwnedAccount.mockReturnValue({
    data: {
      id: 'account-1',
      name: 'Conta Sol',
      status: 'ACTIVE',
      institutionLimit: 3,
      activeInstitutionCount: 0,
      owner: {
        id: 'profile-1',
        full_name: 'Ana Admin',
        email: 'ana@escola.com',
        role: 'ADMIN',
        platform_role: 'USER',
        active: true,
      },
      institutions: [],
    },
    isLoading: false,
    isError: false,
    error: null,
  } as ReturnType<typeof useOwnedAccount>);

  createInstitution.mockResolvedValue({
    success: true,
    institutionId: 'institution-1',
    accountId: 'account-1',
    currentInstitutionCount: 1,
    institutionLimit: 3,
    remainingSlots: 2,
  });
  setCurrentInstitutionId.mockResolvedValue({
    success: true,
    institutionId: 'institution-1',
  });

  mockedUseCreateInstitution.mockReturnValue({
    mutateAsync: createInstitution,
    isPending: false,
  } as unknown as ReturnType<
    typeof useCreateInstitution
  >);

  updateInstitutionName.mockResolvedValue({
    success: true,
    institutionId: 'institution-1',
    name: 'Colegio Sol',
  });
  mockedUseUpdateInstitutionName.mockReturnValue({
    mutateAsync: updateInstitutionName,
    isPending: false,
  } as unknown as ReturnType<
    typeof useUpdateInstitutionName
  >);

  updateInstitutionStatus.mockResolvedValue({
    success: true,
    institutionId: 'institution-1',
    active: false,
    currentInstitutionCount: 1,
    institutionLimit: 3,
    remainingSlots: 1,
    suspendedByScope: 'ACCOUNT',
  });
  mockedUseUpdateInstitutionStatus.mockReturnValue({
    mutateAsync: updateInstitutionStatus,
    isPending: false,
  } as unknown as ReturnType<
    typeof useUpdateInstitutionStatus
  >);

  deleteInstitution.mockResolvedValue({
    success: true,
    institutionId: 'institution-1',
  });
  mockedUseDeleteInstitution.mockReturnValue({
    mutateAsync: deleteInstitution,
    isPending: false,
  } as unknown as ReturnType<
    typeof useDeleteInstitution
  >);

  brandingHookMock.accountBrandingQuery = {
    data: {
      id: 'branding-account-1',
      scope: 'ACCOUNT',
      accountId: 'account-1',
      displayName: 'Conta Sol',
      logoUrl: null,
      logoPath: null,
      faviconUrl: null,
      faviconPath: null,
      primaryColor: '#005bbf',
      secondaryColor: '#6ffbbe',
    },
    isLoading: false,
  };
  brandingHookMock.saveAccountBranding = {
    mutateAsync:
      brandingHookMock.saveAccountBrandingMutateAsync,
    isPending: false,
  };
  brandingHookMock.accountDomainsQuery = {
    data: [
      {
        id: 'domain-1',
        accountId: 'account-1',
        accountName: 'Conta Sol',
        hostname: 'sol.example.com',
        status: 'PENDING',
        isPrimary: false,
        createdAt: '2026-07-22T00:00:00.000Z',
      },
    ],
    isLoading: false,
  };
  brandingHookMock.requestAccountDomain = {
    mutateAsync:
      brandingHookMock.requestAccountDomainMutateAsync,
    isPending: false,
  };
});

afterEach(() => {
  cleanup();
});

describe('AccountPage', () => {
  it('remove o link redundante e preserva informações da conta e instituição', () => {
    mockedUseOwnedAccount.mockReturnValueOnce({
      data: {
        id: 'account-1',
        name: 'Conta Sol',
        status: 'ACTIVE',
        institutionLimit: 3,
        activeInstitutionCount: 1,
        owner: {
          id: 'profile-1',
          full_name: 'Ana Admin',
          email: 'ana@escola.com',
          role: 'ADMIN',
          platform_role: 'USER',
          active: true,
        },
        institutions: [
          {
            id: 'institution-1',
            name: 'Escola Sol',
            active: true,
            account_id: 'account-1',
            logoUrl: null,
            publicSlug: null,
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useOwnedAccount>);

    renderPage();

    expect(
      screen.queryByText('Painel institucional'),
    ).toBeNull();
    expect(
      screen.getAllByText('Conta Sol').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Escola Sol')).toBeTruthy();
    expect(screen.getAllByText('Ativa')).toHaveLength(2);
    expect(screen.getByText('Licenças restantes')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Selecionar' }),
    ).toBeNull();
    expect(
      screen.getByRole('button', {
        name: /Entrar em Escola Sol/i,
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('heading', {
        name: /Identidade da conta/i,
      }),
    ).toBeNull();
    expect(screen.queryByText('sol.example.com')).toBeNull();
  });

  it('suspender nao libera licenca e excluir remove a instituicao', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    mockedUseOwnedAccount.mockReturnValue({
      data: {
        id: 'account-1',
        name: 'Conta Sol',
        status: 'ACTIVE',
        institutionLimit: 2,
        activeInstitutionCount: 1,
        owner: {
          id: 'profile-1',
          full_name: 'Ana Admin',
          email: 'ana@escola.com',
          role: 'ADMIN',
          platform_role: 'USER',
          active: true,
        },
        institutions: [
          {
            id: 'institution-1',
            name: 'Escola Sol',
            active: true,
            account_id: 'account-1',
            logoUrl: null,
            publicSlug: null,
            suspendedByScope: null,
          },
          {
            id: 'institution-2',
            name: 'Escola Luz',
            active: false,
            account_id: 'account-1',
            logoUrl: null,
            publicSlug: null,
            suspendedByScope: 'ACCOUNT',
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useOwnedAccount>);

    renderPage();

    expect(screen.getByText('Licenças restantes')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', {
        name: /Suspender Escola Sol/i,
      }),
    );

    await waitFor(() => {
      expect(updateInstitutionStatus).toHaveBeenCalledWith({
        institutionId: 'institution-1',
        active: false,
      });
      expect(
        screen.getByText(
          /A licença continua ocupada/i,
        ),
      ).toBeTruthy();
    });

    fireEvent.click(
      await screen.findByRole('button', {
        name: /Excluir Escola Sol/i,
      }),
    );

    await waitFor(() => {
      expect(deleteInstitution).toHaveBeenCalledWith({
        accountId: 'account-1',
        institutionId: 'institution-1',
      });
      expect(
        screen.getByText(/A licença foi liberada/i),
      ).toBeTruthy();
    });
  });

  it('bloqueia reativacao de instituicao suspensa pela plataforma', async () => {
    updateInstitutionStatus.mockRejectedValue(
      new AccountServiceError(
        'Esta instituicao foi suspensa pela plataforma.',
        'INSTITUTION_SUSPENDED_BY_PLATFORM',
      ),
    );

    mockedUseOwnedAccount.mockReturnValue({
      data: {
        id: 'account-1',
        name: 'Conta Sol',
        status: 'ACTIVE',
        institutionLimit: 2,
        activeInstitutionCount: 1,
        owner: {
          id: 'profile-1',
          full_name: 'Ana Admin',
          email: 'ana@escola.com',
          role: 'ADMIN',
          platform_role: 'USER',
          active: true,
        },
        institutions: [
          {
            id: 'institution-1',
            name: 'Escola Sol',
            active: false,
            account_id: 'account-1',
            logoUrl: null,
            publicSlug: null,
            suspendedByScope: 'PLATFORM',
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useOwnedAccount>);

    renderPage();

    fireEvent.click(
      screen.getByRole('button', {
        name: /Reativar Escola Sol/i,
      }),
    );

    await waitFor(() => {
      expect(updateInstitutionStatus).toHaveBeenCalledWith({
        institutionId: 'institution-1',
        active: true,
      });
      expect(
        screen.getByText(
          /Esta instituição foi suspensa pela plataforma/i,
        ),
      ).toBeTruthy();
    });
  });

  it('entrar seleciona a instituicao e navega para o admin', async () => {
    mockedUseOwnedAccount.mockReturnValueOnce({
      data: {
        id: 'account-1',
        name: 'Conta Sol',
        status: 'ACTIVE',
        institutionLimit: 3,
        activeInstitutionCount: 1,
        owner: {
          id: 'profile-1',
          full_name: 'Ana Admin',
          email: 'ana@escola.com',
          role: 'ADMIN',
          platform_role: 'USER',
          active: true,
        },
        institutions: [
          {
            id: 'institution-1',
            name: 'Escola Sol',
            active: true,
            account_id: 'account-1',
            logoUrl: null,
            publicSlug: null,
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useOwnedAccount>);

    renderPage();

    fireEvent.click(
      screen.getByRole('button', {
        name: /Entrar em Escola Sol/i,
      }),
    );

    await waitFor(() => {
      expect(setCurrentInstitutionId).toHaveBeenCalledWith(
        'institution-1',
      );
      expect(routerMock.navigate).toHaveBeenCalledWith(
        '/admin',
      );
    });
  });

  it('ADMIN edita o nome da instituicao usando o institution.id e preserva a selecao', async () => {
    mockedUseInstitution.mockReturnValue({
      institutions: [],
      currentInstitution: {
        id: 'institution-2',
        name: 'Escola TV',
        active: true,
        account_id: 'account-1',
      },
      currentMembership: null,
      currentInstitutionId: 'institution-2',
      currentRole: 'ADMIN',
      isLoading: false,
      isSwitchingInstitution: false,
      error: null,
      hasMultipleInstitutions: true,
      setCurrentInstitutionId,
      clearCurrentInstitutionSelection,
      refresh: vi.fn(async () => undefined),
    });

    mockedUseOwnedAccount.mockReturnValue({
      data: {
        id: 'account-1',
        name: 'Conta Sol',
        status: 'ACTIVE',
        institutionLimit: 3,
        activeInstitutionCount: 2,
        owner: {
          id: 'profile-1',
          full_name: 'Ana Admin',
          email: 'ana@escola.com',
          role: 'ADMIN',
          platform_role: 'USER',
          active: true,
        },
        institutions: [
          {
            id: 'institution-1',
            name: 'Escola Sol',
            active: true,
            account_id: 'account-1',
            logoUrl: null,
            publicSlug: 'sol',
          },
          {
            id: 'institution-2',
            name: 'Escola TV',
            active: true,
            account_id: 'account-1',
            logoUrl: null,
            publicSlug: 'tv',
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useOwnedAccount>);

    renderPage();

    expect(
      screen.getByRole('button', {
        name: /Editar instituicao Escola Sol/i,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: /Editar instituicao Escola TV/i,
      }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', {
        name: /Editar instituicao Escola TV/i,
      }),
    );

    const editForm = screen.getByRole('form', {
      name: /Editar instituicao/i,
    });

    expect(editForm).toBeTruthy();

    const nameInput = within(editForm).getByLabelText(
      /Nome da instituicao/i,
    );

    expect(nameInput).toHaveProperty('value', 'Escola TV');

    fireEvent.change(nameInput, {
      target: { value: '   Colegio TV   ' },
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: /Salvar alteracoes/i,
      }),
    );

    await waitFor(() => {
      expect(updateInstitutionName).toHaveBeenCalledWith({
        institutionId: 'institution-2',
        name: 'Colegio TV',
      });
      expect(screen.getByText('Colegio TV')).toBeTruthy();
      expect(
        screen.getAllByText('Selecionada').length,
      ).toBeGreaterThan(0);
      expect(
        screen.queryByRole('form', {
          name: /Editar instituicao/i,
        }),
      ).toBeNull();
    });

    const savedPayload =
      updateInstitutionName.mock.calls[0]?.[0];
    expect(savedPayload).not.toHaveProperty('subdomain');
    expect(savedPayload).not.toHaveProperty('active');
    expect(savedPayload).not.toHaveProperty('account_id');
  });

  it('rejeita nome vazio sem chamar backend', async () => {
    mockedUseOwnedAccount.mockReturnValueOnce({
      data: {
        id: 'account-1',
        name: 'Conta Sol',
        status: 'ACTIVE',
        institutionLimit: 3,
        activeInstitutionCount: 1,
        owner: {
          id: 'profile-1',
          full_name: 'Ana Admin',
          email: 'ana@escola.com',
          role: 'ADMIN',
          platform_role: 'USER',
          active: true,
        },
        institutions: [
          {
            id: 'institution-1',
            name: 'Escola Sol',
            active: true,
            account_id: 'account-1',
            logoUrl: null,
            publicSlug: null,
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useOwnedAccount>);

    renderPage();

    fireEvent.click(
      screen.getByRole('button', {
        name: /Editar instituicao Escola Sol/i,
      }),
    );
    const editForm = screen.getByRole('form', {
      name: /Editar instituicao/i,
    });
    fireEvent.change(
      within(editForm).getByLabelText(/Nome da instituicao/i),
      { target: { value: '     ' } },
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /Salvar alteracoes/i,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Informe o nome da instituicao/i),
      ).toBeTruthy();
      expect(updateInstitutionName).not.toHaveBeenCalled();
    });
  });

  it('mantem modal aberto quando o backend falha', async () => {
    updateInstitutionName.mockRejectedValueOnce(
      new Error('Falha ao atualizar.'),
    );

    mockedUseOwnedAccount.mockReturnValueOnce({
      data: {
        id: 'account-1',
        name: 'Conta Sol',
        status: 'ACTIVE',
        institutionLimit: 3,
        activeInstitutionCount: 1,
        owner: {
          id: 'profile-1',
          full_name: 'Ana Admin',
          email: 'ana@escola.com',
          role: 'ADMIN',
          platform_role: 'USER',
          active: true,
        },
        institutions: [
          {
            id: 'institution-1',
            name: 'Escola Sol',
            active: true,
            account_id: 'account-1',
            logoUrl: null,
            publicSlug: null,
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useOwnedAccount>);

    renderPage();

    fireEvent.click(
      screen.getByRole('button', {
        name: /Editar instituicao Escola Sol/i,
      }),
    );
    const editForm = screen.getByRole('form', {
      name: /Editar instituicao/i,
    });
    fireEvent.change(
      within(editForm).getByLabelText(/Nome da instituicao/i),
      { target: { value: 'Colegio Sol' } },
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /Salvar alteracoes/i,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Operação não concluída/i),
      ).toBeTruthy();
      expect(
        screen.getByRole('form', {
          name: /Editar instituicao/i,
        }),
      ).toBeTruthy();
    });
  });

  it('usa o id da instituicao clicada ao editar outra escola', async () => {
    mockedUseOwnedAccount.mockReturnValueOnce({
      data: {
        id: 'account-1',
        name: 'Conta Sol',
        status: 'ACTIVE',
        institutionLimit: 3,
        activeInstitutionCount: 2,
        owner: {
          id: 'profile-1',
          full_name: 'Ana Admin',
          email: 'ana@escola.com',
          role: 'ADMIN',
          platform_role: 'USER',
          active: true,
        },
        institutions: [
          {
            id: 'institution-1',
            name: 'Escola Sol',
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
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useOwnedAccount>);

    renderPage();

    fireEvent.click(
      screen.getByRole('button', {
        name: /Editar instituicao Escola Luz/i,
      }),
    );
    const editForm = screen.getByRole('form', {
      name: /Editar instituicao/i,
    });
    fireEvent.change(
      within(editForm).getByLabelText(/Nome da instituicao/i),
      { target: { value: 'Colegio Luz' } },
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /Salvar alteracoes/i,
      }),
    );

    await waitFor(() => {
      expect(updateInstitutionName).toHaveBeenCalledWith({
        institutionId: 'institution-2',
        name: 'Colegio Luz',
      });
    });
  });

  it('nao mostra o controle de editar para outro papel', () => {
    mockedUseAuth.mockReturnValueOnce({
      user: null,
      profile: {
        id: 'profile-2',
        full_name: 'Dina Diretora',
        email: 'diretora@escola.com',
        role: 'DIRECTOR',
        platform_role: 'USER',
        avatar_url: null,
      },
      loading: false,
      signIn: vi.fn(async () => undefined),
      signOut: vi.fn(async () => undefined),
    });

    mockedUseOwnedAccount.mockReturnValueOnce({
      data: {
        id: 'account-1',
        name: 'Conta Sol',
        status: 'ACTIVE',
        institutionLimit: 3,
        activeInstitutionCount: 1,
        owner: {
          id: 'profile-1',
          full_name: 'Ana Admin',
          email: 'ana@escola.com',
          role: 'ADMIN',
          platform_role: 'USER',
          active: true,
        },
        institutions: [
          {
            id: 'institution-1',
            name: 'Escola Sol',
            active: true,
            account_id: 'account-1',
            logoUrl: null,
            publicSlug: null,
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useOwnedAccount>);

    renderPage();

    expect(
      screen.queryByRole('button', {
        name: /Editar instituicao/i,
      }),
    ).toBeNull();
  });

  it('seleciona a instituicao criada usando o id retornado antes de mostrar sucesso', async () => {
    const order: string[] = [];

    createInstitution.mockImplementation(async () => {
      order.push('create');

      return {
        success: true,
        institutionId: 'institution-1',
        accountId: 'account-1',
        currentInstitutionCount: 1,
        institutionLimit: 3,
        remainingSlots: 2,
      };
    });

    setCurrentInstitutionId.mockImplementation(
      async (institutionId: string) => {
        order.push(`select:${institutionId}`);

        return {
          success: true,
          institutionId,
        };
      },
    );

    renderPage();

    fireEvent.change(
      screen.getByLabelText('Nome da instituicao'),
      {
        target: {
          value: 'Escola Sol',
        },
      },
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /Criar instituicao/i,
      }),
    );

    await waitFor(() => {
      expect(createInstitution).toHaveBeenCalledWith({
        accountId: 'account-1',
        name: 'Escola Sol',
        cnpj: undefined,
        email: undefined,
        phone: undefined,
        address: undefined,
      });
      expect(setCurrentInstitutionId).toHaveBeenCalledWith(
        'institution-1',
      );
      expect(order).toEqual([
        'create',
        'select:institution-1',
      ]);
      expect(
        screen.getByText(
          /Instituicao criada e selecionada com sucesso/i,
        ),
      ).toBeTruthy();
    });
  });

  it('mostra mensagem honesta quando a instituicao criada nao e selecionada', async () => {
    setCurrentInstitutionId.mockResolvedValueOnce({
      success: false,
      reason: 'NOT_FOUND',
      message:
        'A instituicao solicitada ainda nao aparece na lista autorizada.',
    });

    renderPage();

    fireEvent.change(
      screen.getByLabelText('Nome da instituicao'),
      {
        target: {
          value: 'Escola Sol',
        },
      },
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /Criar instituicao/i,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          /a instituicao solicitada ainda nao aparece na lista autorizada/i,
        ),
      ).toBeTruthy();
      expect(
        screen.queryByText(
          /Instituicao criada e selecionada com sucesso/i,
        ),
      ).toBeNull();
    });
  });
});
