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
  useCreateInstitution,
} from './useAccounts';

vi.mock('../services/accountService', () => ({
  accountService: {
    createInstitution: vi.fn(),
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
