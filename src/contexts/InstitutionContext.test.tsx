// @vitest-environment jsdom

import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import Header from '../components/Header';
import AccountPage from '../pages/Account/AccountPage';
import { accountService } from '../services/accountService';
import {
  institutionService,
} from '../services/institutionService';
import type {
  UserInstitution,
} from '../services/institutionService';
import type { User } from '../types';
import { useAuth } from './AuthContext';
import {
  InstitutionProvider,
  useInstitution,
} from './InstitutionContext';

vi.mock('./AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/institutionService', () => ({
  institutionService: {
    listForProfile: vi.fn(),
  },
}));

vi.mock('../services/accountService', () => ({
  accountService: {
    getOwnedAccount: vi.fn(),
    createInstitution: vi.fn(),
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedInstitutionService =
  vi.mocked(institutionService);
const mockedAccountService =
  vi.mocked(accountService);

const profile = {
  id: 'profile-1',
  full_name: 'Ana Admin',
  email: 'ana@escola.com',
  avatar_url: null,
  role: 'ADMIN',
  platform_role: 'USER',
} as const;

const currentUser: User = {
  id: 'profile-1',
  name: 'Ana Admin',
  email: 'ana@escola.com',
  avatar: null,
  role: 'admin',
  subtitle: 'Administrador',
};

const ownedInstitution: UserInstitution = {
  membership: null,
  institution: {
    id: 'institution-1',
    name: 'Escola Sol',
    active: true,
    account_id: 'account-1',
  },
  account: {
    id: 'account-1',
    name: 'Conta Sol',
    status: 'ACTIVE',
    institution_limit: 3,
  },
  accessSource: 'account_owner',
  effectiveRole: 'ADMIN',
};

const secondInstitution: UserInstitution = {
  membership: null,
  institution: {
    id: 'institution-2',
    name: 'Escola Lua',
    active: true,
    account_id: 'account-1',
  },
  account: {
    id: 'account-1',
    name: 'Conta Sol',
    status: 'ACTIVE',
    institution_limit: 3,
  },
  accessSource: 'account_owner',
  effectiveRole: 'ADMIN',
};

const accountSummary = {
  id: 'account-1',
  name: 'Conta Sol',
  status: 'ACTIVE' as const,
  institutionLimit: 3,
  activeInstitutionCount: 0,
  owner: {
    id: 'profile-1',
    full_name: 'Ana Admin',
    email: 'ana@escola.com',
    active: true,
  },
  institutions: [],
};

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function SelectionHarness() {
  const institutionContext = useInstitution();
  const [result, setResult] =
    useState('pending');

  return (
    <>
      <Header
        currentUser={currentUser}
        pageTitle="Instituicoes da conta"
        pageSection="Conta"
        showInstitutionSwitcher
        isSidebarCollapsed={false}
        isMobileSidebarOpen={false}
        isLoggingOut={false}
        mobileSidebarId="app-sidebar"
        onOpenMobileSidebar={vi.fn()}
        onToggleSidebar={vi.fn()}
        onLogout={vi.fn()}
      />

      <button
        type="button"
        onClick={() => {
          void institutionContext
            .setCurrentInstitutionId(
              'institution-1',
            )
            .then((selectionResult) => {
              if (selectionResult.success === true) {
                setResult(
                  `success:${selectionResult.institutionId}`,
                );
                return;
              }

              setResult(
                `failure:${selectionResult.reason}`,
              );
            });
        }}
      >
        Sincronizar instituicao
      </button>

      <output data-testid="current-id">
        {institutionContext.currentInstitutionId ??
          'none'}
      </output>

      <output data-testid="current-role">
        {institutionContext.currentRole ?? 'none'}
      </output>

      <output data-testid="selection-result">
        {result}
      </output>
    </>
  );
}

function ContextStatus() {
  const institutionContext = useInstitution();

  return (
    <output data-testid="account-current-id">
      {institutionContext.currentInstitutionId ??
        'none'}
    </output>
  );
}

function renderWithProvider(children: ReactNode) {
  const queryClient = createQueryClient();

  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <InstitutionProvider>
          {children}
        </InstitutionProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

  return queryClient;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mockedUseAuth.mockReturnValue({
    user: {
      id: profile.id,
    } as never,
    profile,
    loading: false,
    signIn: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
  });
});

afterEach(() => {
  cleanup();
});

describe('InstitutionContext', () => {
  it('refaz a lista autorizada uma vez, seleciona a primeira instituicao criada e atualiza o Header sem reload', async () => {
    mockedInstitutionService.listForProfile
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([ownedInstitution]);

    renderWithProvider(<SelectionHarness />);

    await waitFor(() => {
      expect(
        screen.getAllByText(
          /Nenhuma escola ativa/i,
        ).length,
      ).toBeGreaterThan(0);
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: /Sincronizar instituicao/i,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getAllByText('Escola Sol').length,
      ).toBeGreaterThan(0);
      expect(
        screen.getByTestId('current-id').textContent,
      ).toBe('institution-1');
      expect(
        screen.getByTestId('current-role').textContent,
      ).toBe('ADMIN');
      expect(
        screen.getByTestId(
          'selection-result',
        ).textContent,
      ).toBe('success:institution-1');
    });

    expect(
      window.localStorage.getItem(
        'edumanager.currentInstitutionId.profile-1',
      ),
    ).toBe('institution-1');
    expect(
      mockedInstitutionService.listForProfile,
    ).toHaveBeenCalledTimes(2);
  });

  it('retorna NOT_FOUND e nao persiste quando o id nao aparece apos refetch', async () => {
    mockedInstitutionService.listForProfile
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    renderWithProvider(<SelectionHarness />);

    await waitFor(() => {
      expect(
        screen.getByTestId('current-id').textContent,
      ).toBe('none');
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: /Sincronizar instituicao/i,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByTestId(
          'selection-result',
        ).textContent,
      ).toBe('failure:NOT_FOUND');
    });

    expect(
      screen.getByTestId('current-id').textContent,
    ).toBe('none');
    expect(
      window.localStorage.getItem(
        'edumanager.currentInstitutionId.profile-1',
      ),
    ).toBeNull();
    expect(
      mockedInstitutionService.listForProfile,
    ).toHaveBeenCalledTimes(2);
  });

  it('retorna REFETCH_FAILED e encerra o loading quando a lista autorizada falha', async () => {
    mockedInstitutionService.listForProfile
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(
        new Error('Falha ao sincronizar'),
      );

    renderWithProvider(<SelectionHarness />);

    await waitFor(() => {
      expect(
        screen.getByTestId('current-id').textContent,
      ).toBe('none');
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: /Sincronizar instituicao/i,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByTestId(
          'selection-result',
        ).textContent,
      ).toBe('failure:REFETCH_FAILED');
    });

    expect(
      screen.queryByText(/Carregando escola/i),
    ).toBeNull();
    expect(
      window.localStorage.getItem(
        'edumanager.currentInstitutionId.profile-1',
      ),
    ).toBeNull();
  });

  it('preserva a selecao valida quando ha multiplas instituicoes', async () => {
    window.localStorage.setItem(
      'edumanager.currentInstitutionId.profile-1',
      'institution-1',
    );
    mockedInstitutionService.listForProfile.mockResolvedValue([
      ownedInstitution,
      secondInstitution,
    ]);

    renderWithProvider(<SelectionHarness />);

    await waitFor(() => {
      expect(
        screen.getByTestId('current-id').textContent,
      ).toBe('institution-1');
      expect(
        screen.getAllByText(/Escola Sol/i).length,
      ).toBeGreaterThan(0);
    });
  });

  it('integra AccountPage, mutation e InstitutionContext antes de mostrar sucesso', async () => {
    mockedInstitutionService.listForProfile
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([ownedInstitution]);
    mockedAccountService.getOwnedAccount.mockResolvedValue(
      accountSummary,
    );
    mockedAccountService.createInstitution.mockResolvedValue({
      success: true,
      institutionId: 'institution-1',
      accountId: 'account-1',
      currentInstitutionCount: 1,
      institutionLimit: 3,
      remainingSlots: 2,
    });

    renderWithProvider(
      <>
        <ContextStatus />
        <AccountPage />
      </>,
    );

    await waitFor(() => {
      expect(
        screen.getByLabelText(
          'Nome da instituicao',
        ),
      ).toBeTruthy();
    });

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
          /Instituicao criada e selecionada com sucesso/i,
        ),
      ).toBeTruthy();
      expect(
        screen.getByTestId(
          'account-current-id',
        ).textContent,
      ).toBe('institution-1');
    });

    expect(
      mockedInstitutionService.listForProfile,
    ).toHaveBeenCalledTimes(2);
  });
});
