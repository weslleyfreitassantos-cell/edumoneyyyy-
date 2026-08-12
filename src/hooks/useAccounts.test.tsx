// @vitest-environment jsdom

import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  act,
  cleanup,
  renderHook,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  accountService,
} from '../services/accountService';
import {
  userInstitutionKeys,
} from './useUserInstitutions';
import {
  accountKeys,
  useCloseClientAccount,
  useCreateClientAccount,
  useCreateInstitution,
  useUpdateClientAccount,
  useUpdateInstitutionName,
  useUpdateInstitutionStatus,
} from './useAccounts';

vi.mock('../services/accountService', () => ({
  accountService: {
    createAccount: vi.fn(),
    closeAccount: vi.fn(),
    updateAccount: vi.fn(),
    updateInstitutionStatus: vi.fn(),
    deleteAccount: vi.fn(),
    createInstitution: vi.fn(),
    updateInstitutionName: vi.fn(),
  },
}));

const mockedAccountService =
  vi.mocked(accountService);

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

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('useCreateInstitution', () => {
  it('invalida contas e preserva o id criado sem refazer instituicoes autorizadas', async () => {
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(
      queryClient,
      'invalidateQueries',
    );
    const refetchSpy = vi.spyOn(
      queryClient,
      'refetchQueries',
    );

    mockedAccountService.createInstitution.mockResolvedValue({
      success: true,
      institutionId: 'institution-1',
      accountId: 'account-1',
      currentInstitutionCount: 1,
      institutionLimit: 3,
      remainingSlots: 2,
    });

    const wrapper = ({
      children,
    }: {
      children: ReactNode;
    }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(
      () => useCreateInstitution('profile-1'),
      { wrapper },
    );

    let response:
      | Awaited<
          ReturnType<
            typeof result.current.mutateAsync
          >
        >
      | null = null;

    await act(async () => {
      response =
        await result.current.mutateAsync({
          accountId: 'account-1',
          name: 'Escola Sol',
        });
    });

    expect(response?.institutionId).toBe(
      'institution-1',
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: accountKeys.all,
    });
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(
      refetchSpy.mock.calls.some(
        ([options]) =>
          JSON.stringify(options?.queryKey) ===
          JSON.stringify(
            userInstitutionKeys.list('profile-1'),
          ),
      ),
    ).toBe(false);
  });
});

describe('account mutations', () => {
  it('invalida contas apos criar conta cliente', async () => {
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(
      queryClient,
      'invalidateQueries',
    );

    mockedAccountService.createAccount.mockResolvedValue({
      success: true,
      accountId: 'account-1',
      ownerProfileId: 'owner-1',
      ownerEmail: 'admin@example.com',
      institutionLimit: 2,
      invitationSent: true,
      reusedExistingUser: false,
    });

    const wrapper = ({
      children,
    }: {
      children: ReactNode;
    }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(
      () => useCreateClientAccount(),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({
        accountName: 'Conta',
        adminFullName: 'Admin',
        adminEmail: 'admin@example.com',
        institutionLimit: 2,
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: accountKeys.all,
    });
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it('invalida contas apos atualizar limite ou status', async () => {
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(
      queryClient,
      'invalidateQueries',
    );

    mockedAccountService.updateAccount.mockResolvedValue({
      success: true,
      accountId: 'account-1',
      institutionLimit: 4,
      previousStatus: 'ACTIVE',
      status: 'ACTIVE',
      auditEventId: null,
      statusChanged: false,
    });

    const wrapper = ({
      children,
    }: {
      children: ReactNode;
    }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(
      () => useUpdateClientAccount(),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({
        accountId: 'account-1',
        institutionLimit: 4,
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: accountKeys.all,
    });
    expect(invalidateSpy).toHaveBeenCalledTimes(2);
  });

  it('invalida contas e instituicoes autorizadas apos alterar instituicao', async () => {
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(
      queryClient,
      'invalidateQueries',
    );

    mockedAccountService.updateInstitutionStatus.mockResolvedValue({
      success: true,
      institutionId: 'institution-1',
      active: false,
      suspendedByScope: 'ACCOUNT',
      currentInstitutionCount: 1,
      institutionLimit: 3,
      remainingSlots: 2,
    });

    const wrapper = ({
      children,
    }: {
      children: ReactNode;
    }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(
      () => useUpdateInstitutionStatus(),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({
        institutionId: 'institution-1',
        active: false,
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: accountKeys.all,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: userInstitutionKeys.all,
    });
    expect(invalidateSpy).toHaveBeenCalledTimes(2);
  });

  it('invalida contas e instituicoes autorizadas apos renomear instituicao', async () => {
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(
      queryClient,
      'invalidateQueries',
    );

    mockedAccountService.updateInstitutionName.mockResolvedValue({
      success: true,
      institutionId: 'institution-1',
      name: 'Colegio Sol',
    });

    const wrapper = ({
      children,
    }: {
      children: ReactNode;
    }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(
      () => useUpdateInstitutionName(),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({
        institutionId: 'institution-1',
        name: 'Colegio Sol',
      });
    });

    expect(
      mockedAccountService.updateInstitutionName,
    ).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      name: 'Colegio Sol',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: accountKeys.all,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: userInstitutionKeys.all,
    });
    expect(invalidateSpy).toHaveBeenCalledTimes(2);
  });

  it('invalida contas e instituicoes apos encerrar conta', async () => {
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(
      queryClient,
      'invalidateQueries',
    );

    mockedAccountService.closeAccount.mockResolvedValue({
      success: true,
      accountId: 'account-1',
      institutionLimit: 3,
      previousStatus: 'ACTIVE',
      status: 'CANCELED',
      auditEventId: 'event-1',
      statusChanged: true,
    });

    const wrapper = ({
      children,
    }: {
      children: ReactNode;
    }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(
      () => useCloseClientAccount(),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({
        accountId: 'account-1',
        reason: 'Encerramento comercial solicitado.',
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: accountKeys.all,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: userInstitutionKeys.all,
    });
    expect(invalidateSpy).toHaveBeenCalledTimes(2);
  });
});
