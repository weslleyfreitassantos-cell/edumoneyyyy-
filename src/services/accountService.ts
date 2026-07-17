import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';

import { supabase } from '../lib/supabaseClient';

import type { AccountStatus } from '../lib/permissions';

export interface AccountOwnerSummary {
  id: string;
  full_name: string;
  email: string;
  role: string;
  platform_role: string;
  active: boolean | null;
}

export interface AccountInstitutionSummary {
  id: string;
  name: string;
  active: boolean | null;
  account_id: string | null;
}

export interface AccountSummaryRow {
  id: string;
  name: string;
  status: AccountStatus;
  institutionLimit: number;
  activeInstitutionCount: number;
  owner: AccountOwnerSummary | null;
  institutions: AccountInstitutionSummary[];
}

export interface CreateClientAccountInput {
  accountName: string;
  adminFullName: string;
  adminEmail: string;
  institutionLimit: number;
}

export interface CreateClientAccountResponse {
  success: true;
  accountId: string;
  ownerProfileId: string;
  ownerEmail: string;
  institutionLimit: number;
  invitationSent: boolean;
  reusedExistingUser: boolean;
}

export interface UpdateClientAccountInput {
  accountId: string;
  institutionLimit?: number;
  status?: AccountStatus;
}

export interface UpdateClientAccountResponse {
  success: true;
  accountId: string;
  institutionLimit: number;
  status: AccountStatus;
}

export interface DeleteClientAccountInput {
  accountId: string;
}

export interface DeleteClientAccountResponse {
  success: true;
  accountId: string;
  ownerProfileId: string;
  ownerPreserved: boolean;
  deletedAuthUser: boolean;
}

export interface CreateInstitutionInput {
  accountId: string;
  name: string;
  cnpj?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
}

export interface CreateInstitutionResponse {
  success: true;
  institutionId: string;
  accountId: string;
  currentInstitutionCount: number;
  institutionLimit: number;
  remainingSlots: number;
}

interface AccountQueryRow {
  id: string;
  name: string;
  status: string;
  institution_limit: number | null;
  profiles:
    | AccountOwnerSummary
    | AccountOwnerSummary[]
    | null;
  institutions:
    | AccountInstitutionSummary
    | AccountInstitutionSummary[]
    | null;
}

interface FunctionErrorBody {
  success: false;
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
}

export class AccountServiceError extends Error {
  code: string;
  fieldErrors?: Record<string, string>;

  constructor(
    message: string,
    code = 'UNKNOWN_ERROR',
    fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AccountServiceError';
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

function normalizeRelation<T>(
  relation: T | T[] | null,
): T | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

function normalizeRelationList<T>(
  relation: T | T[] | null,
): T[] {
  if (!relation) {
    return [];
  }

  return Array.isArray(relation)
    ? relation
    : [relation];
}

function normalizeStatus(
  value: string,
): AccountStatus {
  if (
    value === 'ACTIVE' ||
    value === 'SUSPENDED' ||
    value === 'CANCELED'
  ) {
    return value;
  }

  return 'ACTIVE';
}

function normalizeAccountRow(
  row: AccountQueryRow,
): AccountSummaryRow {
  const institutions = normalizeRelationList(
    row.institutions,
  ).sort((first, second) =>
    first.name.localeCompare(second.name, 'pt-BR'),
  );

  return {
    id: row.id,
    name: row.name,
    status: normalizeStatus(row.status),
    institutionLimit: row.institution_limit ?? 1,
    activeInstitutionCount: institutions.filter(
      (institution) => institution.active !== false,
    ).length,
    owner: normalizeRelation(row.profiles),
    institutions,
  };
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null
  );
}

function requireString(
  value: Record<string, unknown>,
  key: string,
): string {
  const data = value[key];
  if (typeof data === 'string') {
    return data;
  }
  throw new AccountServiceError(
    'A funcao respondeu em um formato invalido.',
    'INVALID_FUNCTION_RESPONSE',
  );
}

function requireNumber(
  value: Record<string, unknown>,
  key: string,
): number {
  const data = value[key];
  if (typeof data === 'number') {
    return data;
  }
  throw new AccountServiceError(
    'A funcao respondeu em um formato invalido.',
    'INVALID_FUNCTION_RESPONSE',
  );
}

function requireBoolean(
  value: Record<string, unknown>,
  key: string,
): boolean {
  const data = value[key];
  if (typeof data === 'boolean') {
    return data;
  }
  throw new AccountServiceError(
    'A funcao respondeu em um formato invalido.',
    'INVALID_FUNCTION_RESPONSE',
  );
}

function requireTrue(
  value: Record<string, unknown>,
  key: string,
): true {
  if (value[key] !== true) {
    throw new AccountServiceError(
      `Resposta invalida: ${key}`,
      'INVALID_FUNCTION_RESPONSE',
    );
  }
  return true;
}

function isFunctionErrorBody(
  value: unknown,
): value is FunctionErrorBody {
  return (
    isRecord(value) &&
    value.success === false &&
    typeof value.code === 'string' &&
    typeof value.message === 'string'
  );
}

async function getFunctionError(
  error: unknown,
): Promise<AccountServiceError> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body: unknown =
        await error.context.json();

      if (isFunctionErrorBody(body)) {
        return new AccountServiceError(
          body.message,
          body.code,
          body.fieldErrors,
        );
      }
    } catch {
      return new AccountServiceError(
        error.message,
        'FUNCTION_HTTP_ERROR',
      );
    }
  }

  if (error instanceof FunctionsRelayError) {
    return new AccountServiceError(
      'A funcao esta temporariamente indisponivel.',
      'FUNCTION_RELAY_ERROR',
    );
  }

  if (error instanceof FunctionsFetchError) {
    return new AccountServiceError(
      'Nao foi possivel conectar a funcao.',
      'FUNCTION_FETCH_ERROR',
    );
  }

  if (error instanceof Error) {
    return new AccountServiceError(
      error.message,
      'UNKNOWN_ERROR',
    );
  }

  return new AccountServiceError(
    'Operacao nao concluida.',
    'UNKNOWN_ERROR',
  );
}

function assertCreateAccountResponse(
  value: unknown,
): CreateClientAccountResponse {
  if (!isRecord(value)) {
    throw new AccountServiceError(
      'A funcao respondeu em um formato invalido.',
      'INVALID_FUNCTION_RESPONSE',
    );
  }

  return {
    success: requireTrue(value, 'success'),
    accountId: requireString(value, 'accountId'),
    ownerProfileId: requireString(value, 'ownerProfileId'),
    ownerEmail: requireString(value, 'ownerEmail'),
    institutionLimit: requireNumber(value, 'institutionLimit'),
    invitationSent: requireBoolean(value, 'invitationSent'),
    reusedExistingUser: requireBoolean(value, 'reusedExistingUser'),
  };
}

function assertUpdateAccountResponse(
  value: unknown,
): UpdateClientAccountResponse {
  if (
    isRecord(value) &&
    value.success === true &&
    typeof value.accountId === 'string' &&
    typeof value.institutionLimit === 'number' &&
    typeof value.status === 'string'
  ) {
    return {
      success: true,
      accountId: value.accountId,
      institutionLimit: value.institutionLimit,
      status: normalizeStatus(value.status),
    };
  }

  throw new AccountServiceError(
    'A funcao respondeu em um formato invalido.',
    'INVALID_FUNCTION_RESPONSE',
  );
}

function assertCreateInstitutionResponse(
  value: unknown,
): CreateInstitutionResponse {
  if (!isRecord(value)) {
    throw new AccountServiceError(
      'A funcao respondeu em um formato invalido.',
      'INVALID_FUNCTION_RESPONSE',
    );
  }

  return {
    success: requireTrue(value, 'success'),
    institutionId: requireString(value, 'institutionId'),
    accountId: requireString(value, 'accountId'),
    currentInstitutionCount: requireNumber(
      value,
      'currentInstitutionCount',
    ),
    institutionLimit: requireNumber(value, 'institutionLimit'),
    remainingSlots: requireNumber(value, 'remainingSlots'),
  };
}

function assertDeleteAccountResponse(
  value: unknown,
): DeleteClientAccountResponse {
  if (!isRecord(value)) {
    throw new AccountServiceError(
      'A funcao respondeu em um formato invalido.',
      'INVALID_FUNCTION_RESPONSE',
    );
  }

  return {
    success: requireTrue(value, 'success'),
    accountId: requireString(value, 'accountId'),
    ownerProfileId: requireString(value, 'ownerProfileId'),
    ownerPreserved: requireBoolean(value, 'ownerPreserved'),
    deletedAuthUser: requireBoolean(value, 'deletedAuthUser'),
  };
}

export const accountService = {
  async listAccounts(): Promise<AccountSummaryRow[]> {
    const { data, error } = await supabase
      .from('accounts')
      .select(
        `
        id,
        name,
        status,
        institution_limit,
        profiles:owner_profile_id (
          id,
          full_name,
          email,
          role,
          platform_role,
          active
        ),
        institutions (
          id,
          name,
          active,
          account_id
        )
      `,
      )
      .order('created_at', {
        ascending: false,
      });

    if (error) {
      throw error;
    }

    return ((data ?? []) as unknown as AccountQueryRow[])
      .map(normalizeAccountRow);
  },

  async getOwnedAccount(
    profileId: string,
  ): Promise<AccountSummaryRow | null> {
    const { data, error } = await supabase
      .from('accounts')
      .select(
        `
        id,
        name,
        status,
        institution_limit,
        profiles:owner_profile_id (
          id,
          full_name,
          email,
          role,
          platform_role,
          active
        ),
        institutions (
          id,
          name,
          active,
          account_id
        )
      `,
      )
      .eq('owner_profile_id', profileId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data
      ? normalizeAccountRow(
          data as unknown as AccountQueryRow,
        )
      : null;
  },

  async createAccount(
    input: CreateClientAccountInput,
  ): Promise<CreateClientAccountResponse> {
    const { data, error } =
      await supabase.functions.invoke(
        'create-client-account',
        { body: input },
      );

    if (error) {
      throw await getFunctionError(error);
    }

    return assertCreateAccountResponse(data);
  },

  async updateAccount(
    input: UpdateClientAccountInput,
  ): Promise<UpdateClientAccountResponse> {
    const { data, error } =
      await supabase.functions.invoke(
        'update-client-account',
        { body: input },
      );

    if (error) {
      throw await getFunctionError(error);
    }

    return assertUpdateAccountResponse(data);
  },

  async createInstitution(
    input: CreateInstitutionInput,
  ): Promise<CreateInstitutionResponse> {
    const { data, error } =
      await supabase.functions.invoke(
        'create-institution',
        { body: input },
      );

    if (error) {
      throw await getFunctionError(error);
    }

    return assertCreateInstitutionResponse(data);
  },

  async deleteAccount(
    input: DeleteClientAccountInput,
  ): Promise<DeleteClientAccountResponse> {
    const { data, error } =
      await supabase.functions.invoke(
        'delete-client-account',
        { body: input },
      );

    if (error) {
      throw await getFunctionError(error);
    }

    return assertDeleteAccountResponse(data);
  },
};
