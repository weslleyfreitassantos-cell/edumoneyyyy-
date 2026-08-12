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
  logoUrl: string | null;
  publicSlug: string | null;
  suspendedByProfileId?: string | null;
  suspendedByScope?: 'PLATFORM' | 'ACCOUNT' | null;
  suspendedAt?: string | null;
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
  reason?: string;
}

export interface UpdateClientAccountResponse {
  success: true;
  accountId: string;
  institutionLimit: number;
  previousStatus: AccountStatus;
  status: AccountStatus;
  auditEventId: string | null;
  statusChanged: boolean;
}

export interface CloseClientAccountInput {
  accountId: string;
  reason: string;
}

export type CloseClientAccountResponse =
  UpdateClientAccountResponse;

export interface AccountStatusEvent {
  id: string;
  accountId: string;
  actorProfileId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  previousStatus: AccountStatus;
  newStatus: AccountStatus;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface RestoreClientAccountInput {
  accountId: string;
  reason: string;
}

export type RestoreClientAccountResponse =
  UpdateClientAccountResponse;

export interface DeleteClientAccountInput {
  accountId: string;
  reason: string;
  confirmationEmail: string;
  confirmationText: string;
  acknowledgement: true;
}

export interface DeleteClientAccountResponse {
  success: true;
  accountId: string;
  accountName: string;
  auditId: string;
  summary: Record<string, number>;
  ownerPreserved: boolean;
  exclusiveProfileIds: string[];
  sharedProfileIds: string[];
  deletedAuthUsers: number;
  authDeletionFailed: number;
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

export interface UpdateInstitutionStatusInput {
  institutionId: string;
  active: boolean;
}

export interface UpdateInstitutionNameInput {
  institutionId: string;
  name: string;
}

export interface UpdateInstitutionNameResponse {
  success: true;
  institutionId: string;
  name: string;
}

export interface UpdateInstitutionStatusResponse {
  success: true;
  institutionId: string;
  active: boolean;
  suspendedByScope: 'PLATFORM' | 'ACCOUNT' | null;
  currentInstitutionCount: number;
  institutionLimit: number;
  remainingSlots: number;
}

export interface DeleteInstitutionInput {
  accountId: string;
  institutionId: string;
}

export interface DeleteInstitutionResponse {
  success: true;
  institutionId: string;
  accountId: string;
  currentInstitutionCount: number;
  institutionLimit: number;
  remainingSlots: number;
  summary: Record<string, number>;
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
    | (AccountInstitutionSummary & {
        logo_url: string | null;
        public_slug: string | null;
        suspended_by_profile_id: string | null;
        suspended_by_scope: string | null;
        suspended_at: string | null;
      })
    | (AccountInstitutionSummary & {
        logo_url: string | null;
        public_slug: string | null;
        suspended_by_profile_id: string | null;
        suspended_by_scope: string | null;
        suspended_at: string | null;
      })[]
    | null;
}

interface FunctionErrorBody {
  success: false;
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
}

interface AccountStatusEventQueryRow {
  id: string;
  account_id: string;
  actor_profile_id: string | null;
  previous_status: string;
  new_status: string;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  profiles:
    | Pick<AccountOwnerSummary, 'full_name' | 'email'>
    | Pick<AccountOwnerSummary, 'full_name' | 'email'>[]
    | null;
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
  const institutions = normalizeRelationList(row.institutions).map((inst) => {
    const suspendedByScope: AccountInstitutionSummary['suspendedByScope'] =
      inst.suspended_by_scope === 'PLATFORM' ||
      inst.suspended_by_scope === 'ACCOUNT'
        ? inst.suspended_by_scope
        : null;

    return {
      id: inst.id,
      name: inst.name,
      active: inst.active,
      account_id: inst.account_id,
      logoUrl: inst.logo_url ?? null,
      publicSlug: inst.public_slug ?? null,
      suspendedByProfileId: inst.suspended_by_profile_id ?? null,
      suspendedByScope,
      suspendedAt: inst.suspended_at ?? null,
    };
  }).sort((first, second) =>
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
    const status = normalizeStatus(value.status);
    const previousStatus =
      typeof value.previousStatus === 'string'
        ? normalizeStatus(value.previousStatus)
        : status;

    return {
      success: true,
      accountId: value.accountId,
      institutionLimit: value.institutionLimit,
      previousStatus,
      status,
      auditEventId:
        typeof value.auditEventId === 'string'
          ? value.auditEventId
          : null,
      statusChanged:
        typeof value.statusChanged === 'boolean'
          ? value.statusChanged
          : previousStatus !== status,
    };
  }

  throw new AccountServiceError(
    'A funcao respondeu em um formato invalido.',
    'INVALID_FUNCTION_RESPONSE',
  );
}

function normalizeStatusEventRow(
  row: AccountStatusEventQueryRow,
): AccountStatusEvent {
  const actor = normalizeRelation(row.profiles);

  return {
    id: row.id,
    accountId: row.account_id,
    actorProfileId: row.actor_profile_id,
    actorName: actor?.full_name ?? null,
    actorEmail: actor?.email ?? null,
    previousStatus: normalizeStatus(row.previous_status),
    newStatus: normalizeStatus(row.new_status),
    reason: row.reason,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
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

function assertUpdateInstitutionStatusResponse(
  value: unknown,
): UpdateInstitutionStatusResponse {
  if (!isRecord(value)) {
    throw new AccountServiceError(
      'A funcao respondeu em um formato invalido.',
      'INVALID_FUNCTION_RESPONSE',
    );
  }

  return {
    success: requireTrue(value, 'success'),
    institutionId: requireString(value, 'institutionId'),
    active: requireBoolean(value, 'active'),
    suspendedByScope:
      value.suspendedByScope === 'PLATFORM' ||
      value.suspendedByScope === 'ACCOUNT'
        ? value.suspendedByScope
        : null,
    currentInstitutionCount: requireNumber(
      value,
      'currentInstitutionCount',
    ),
    institutionLimit: requireNumber(value, 'institutionLimit'),
    remainingSlots: requireNumber(value, 'remainingSlots'),
  };
}

function assertDeleteInstitutionResponse(
  value: unknown,
): DeleteInstitutionResponse {
  if (!isRecord(value)) {
    throw new AccountServiceError(
      'A funcao respondeu em um formato invalido.',
      'INVALID_FUNCTION_RESPONSE',
    );
  }

  const rawSummary = value.summary;
  const summary =
    typeof rawSummary === 'object' &&
    rawSummary !== null &&
    !Array.isArray(rawSummary)
      ? (rawSummary as Record<string, number>)
      : {};

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
    summary,
  };
}

function assertRestoreAccountResponse(
  value: unknown,
): RestoreClientAccountResponse {
  if (
    isRecord(value) &&
    value.success === true &&
    typeof value.accountId === 'string' &&
    typeof value.institutionLimit === 'number' &&
    typeof value.status === 'string'
  ) {
    const status = normalizeStatus(value.status);
    const previousStatus =
      typeof value.previousStatus === 'string'
        ? normalizeStatus(value.previousStatus)
        : status;

    return {
      success: true,
      accountId: value.accountId,
      institutionLimit: value.institutionLimit,
      previousStatus,
      status,
      auditEventId:
        typeof value.auditEventId === 'string'
          ? value.auditEventId
          : null,
      statusChanged:
        typeof value.statusChanged === 'boolean'
          ? value.statusChanged
          : previousStatus !== status,
    };
  }

  throw new AccountServiceError(
    'A funcao respondeu em um formato invalido.',
    'INVALID_FUNCTION_RESPONSE',
  );
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
    accountName: requireString(value, 'accountName'),
    auditId: requireString(value, 'auditId'),
    summary: (() => {
      const raw = value.summary;
      if (
        typeof raw === 'object' &&
        raw !== null &&
        !Array.isArray(raw)
      ) {
        return raw as Record<string, number>;
      }
      throw new AccountServiceError(
        'A funcao respondeu em um formato invalido.',
        'INVALID_FUNCTION_RESPONSE',
      );
    })(),
    ownerPreserved: requireBoolean(value, 'ownerPreserved'),
    exclusiveProfileIds: (() => {
      const raw = value.exclusiveProfileIds;
      if (Array.isArray(raw)) {
        return raw.map(String);
      }
      return [];
    })(),
    sharedProfileIds: (() => {
      const raw = value.sharedProfileIds;
      if (Array.isArray(raw)) {
        return raw.map(String);
      }
      return [];
    })(),
    deletedAuthUsers: requireNumber(value, 'deletedAuthUsers'),
    authDeletionFailed: requireNumber(value, 'authDeletionFailed'),
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
          account_id,
          logo_url,
          public_slug,
          suspended_by_profile_id,
          suspended_by_scope,
          suspended_at
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
          account_id,
          logo_url,
          public_slug,
          suspended_by_profile_id,
          suspended_by_scope,
          suspended_at
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

  async closeAccount(
    input: CloseClientAccountInput,
  ): Promise<CloseClientAccountResponse> {
    return accountService.updateAccount({
      accountId: input.accountId,
      status: 'CANCELED',
      reason: input.reason,
    });
  },

  async restoreAccount(
    input: RestoreClientAccountInput,
  ): Promise<RestoreClientAccountResponse> {
    const { data, error } =
      await supabase.functions.invoke(
        'restore-client-account',
        { body: input },
      );

    if (error) {
      throw await getFunctionError(error);
    }

    return assertRestoreAccountResponse(data);
  },

  async listAccountStatusEvents(
    accountId: string,
  ): Promise<AccountStatusEvent[]> {
    const { data, error } = await supabase
      .from('account_status_events')
      .select(
        `
        id,
        account_id,
        actor_profile_id,
        previous_status,
        new_status,
        reason,
        metadata,
        created_at,
        profiles:actor_profile_id (
          full_name,
          email
        )
      `,
      )
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (
      (data ?? []) as unknown as AccountStatusEventQueryRow[]
    ).map(normalizeStatusEventRow);
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

  async updateInstitutionStatus(
    input: UpdateInstitutionStatusInput,
  ): Promise<UpdateInstitutionStatusResponse> {
    const { data, error } =
      await supabase.functions.invoke(
        'update-institution-status',
        { body: input },
      );

    if (error) {
      throw await getFunctionError(error);
    }

    return assertUpdateInstitutionStatusResponse(data);
  },

  async updateInstitutionName(
    input: UpdateInstitutionNameInput,
  ): Promise<UpdateInstitutionNameResponse> {
    const normalizedName = input.name.trim();

    if (!normalizedName) {
      throw new AccountServiceError(
        'Informe o nome da instituicao.',
        'INVALID_INSTITUTION_NAME',
      );
    }

    const { data, error } = await supabase.rpc(
      'update_admin_institution_name',
      {
        target_institution_id: input.institutionId,
        new_name: normalizedName,
      },
    );

    if (error) {
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : null;

    if (
      !isRecord(row) ||
      typeof row.id !== 'string' ||
      typeof row.name !== 'string'
    ) {
      throw new AccountServiceError(
        'Instituicao nao encontrada ou sem permissao para alterar.',
        'INSTITUTION_NOT_FOUND',
      );
    }

    return {
      success: true,
      institutionId: row.id,
      name: row.name,
    };
  },

  async deleteInstitution(
    input: DeleteInstitutionInput,
  ): Promise<DeleteInstitutionResponse> {
    const { data, error } =
      await supabase.functions.invoke(
        'delete-institution',
        { body: input },
      );

    if (error) {
      throw await getFunctionError(error);
    }

    return assertDeleteInstitutionResponse(data);
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

  async restoreAccountOld(
    input: RestoreClientAccountInput,
  ): Promise<RestoreClientAccountResponse> {
    return accountService.updateAccount({
      accountId: input.accountId,
      status: 'ACTIVE',
      reason: input.reason,
    });
  },
};
