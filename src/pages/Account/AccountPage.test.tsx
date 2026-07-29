// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
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
  useOwnedAccount,
} from '../../hooks/useAccounts';
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

const createInstitution = vi.fn();
const setCurrentInstitutionId = vi.fn();

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
    error: null,
    hasMultipleInstitutions: false,
    setCurrentInstitutionId,
    clearCurrentInstitutionSelection: vi.fn(),
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
    expect(screen.getByText('Slots restantes')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Selecionar' }),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Entrar' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', {
        name: /Identidade da conta/i,
      }),
    ).toBeTruthy();
    expect(screen.getByText('sol.example.com')).toBeTruthy();
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
      screen.getByRole('button', { name: 'Entrar' }),
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
