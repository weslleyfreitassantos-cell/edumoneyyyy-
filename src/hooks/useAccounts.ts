import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  accountService,
  type AccountSummaryRow,
  type AccountStatusEvent,
  type CloseClientAccountInput,
  type CloseClientAccountResponse,
  type CreateClientAccountInput,
  type CreateClientAccountResponse,
  type CreateInstitutionInput,
  type CreateInstitutionResponse,
  type DeleteClientAccountInput,
  type DeleteClientAccountResponse,
  type UpdateInstitutionStatusInput,
  type UpdateInstitutionStatusResponse,
  type UpdateClientAccountInput,
  type UpdateClientAccountResponse,
} from '../services/accountService';
import {
  userInstitutionKeys,
} from './useUserInstitutions';

export const accountKeys = {
  all: ['accounts'] as const,
  lists: () => [...accountKeys.all, 'list'] as const,
  owned: (profileId: string | undefined) =>
    [
      ...accountKeys.all,
      'owned',
      profileId ?? 'anonymous',
    ] as const,
  statusEvents: (accountId: string | undefined) =>
    [
      ...accountKeys.all,
      'status-events',
      accountId ?? 'none',
    ] as const,
};

export function useAccounts() {
  return useQuery<AccountSummaryRow[]>({
    queryKey: accountKeys.lists(),
    queryFn: () => accountService.listAccounts(),
  });
}

export function useOwnedAccount(
  profileId: string | undefined,
) {
  return useQuery<AccountSummaryRow | null>({
    queryKey: accountKeys.owned(profileId),
    queryFn: () => {
      if (!profileId) {
        return Promise.resolve(null);
      }

      return accountService.getOwnedAccount(profileId);
    },
    enabled: Boolean(profileId),
  });
}

export function useCreateClientAccount() {
  const queryClient = useQueryClient();

  return useMutation<
    CreateClientAccountResponse,
    Error,
    CreateClientAccountInput
  >({
    mutationFn: (input) =>
      accountService.createAccount(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: accountKeys.all,
      });
    },
  });
}

export function useUpdateClientAccount() {
  const queryClient = useQueryClient();

  return useMutation<
    UpdateClientAccountResponse,
    Error,
    UpdateClientAccountInput
  >({
    mutationFn: (input) =>
      accountService.updateAccount(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: accountKeys.all,
      });
    },
  });
}

export function useCloseClientAccount() {
  const queryClient = useQueryClient();

  return useMutation<
    CloseClientAccountResponse,
    Error,
    CloseClientAccountInput
  >({
    mutationFn: (input) =>
      accountService.closeAccount(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: accountKeys.all,
        }),
        queryClient.invalidateQueries({
          queryKey: userInstitutionKeys.all,
        }),
      ]);
    },
  });
}

export function useDeleteClientAccount() {
  const queryClient = useQueryClient();

  return useMutation<
    DeleteClientAccountResponse,
    Error,
    DeleteClientAccountInput
  >({
    mutationFn: (input) =>
      accountService.deleteAccount(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: accountKeys.all,
      });
    },
  });
}

export function useAccountStatusEvents(
  accountId: string | undefined,
  enabled: boolean,
) {
  return useQuery<AccountStatusEvent[]>({
    queryKey: accountKeys.statusEvents(accountId),
    queryFn: () => {
      if (!accountId) {
        return Promise.resolve([]);
      }

      return accountService.listAccountStatusEvents(accountId);
    },
    enabled: enabled && Boolean(accountId),
  });
}

export function useCreateInstitution(
  _profileId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation<
    CreateInstitutionResponse,
    Error,
    CreateInstitutionInput
  >({
    mutationFn: (input) =>
      accountService.createInstitution(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: accountKeys.all,
      });
    },
  });
}

export function useUpdateInstitutionStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    UpdateInstitutionStatusResponse,
    Error,
    UpdateInstitutionStatusInput
  >({
    mutationFn: (input) =>
      accountService.updateInstitutionStatus(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: accountKeys.all,
        }),
        queryClient.invalidateQueries({
          queryKey: userInstitutionKeys.all,
        }),
      ]);
    },
  });
}
