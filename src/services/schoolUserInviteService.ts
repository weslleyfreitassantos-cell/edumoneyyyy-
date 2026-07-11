import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';

import { supabase } from '../lib/supabaseClient';

import type {
  UnifiedUserInviteFieldErrors,
  UnifiedUserInvitePayload,
  UnifiedUserInviteRole,
} from '../pages/Admin/tabs/school-users/unifiedUserInviteModel';

export interface SchoolUserInviteResponse {
  success: true;
  userId: string;
  profileId: string;
  membershipId?: string;
  role: UnifiedUserInviteRole;
  email: string;
  invitationSent: boolean;
  reusedExistingUser: boolean;
  message: string;
}

interface SchoolUserInviteErrorBody {
  success: false;
  code: string;
  message: string;
  fieldErrors?: UnifiedUserInviteFieldErrors;
}

export class SchoolUserInviteServiceError extends Error {
  code: string;
  fieldErrors?: UnifiedUserInviteFieldErrors;

  constructor(
    message: string,
    code = 'UNKNOWN_ERROR',
    fieldErrors?: UnifiedUserInviteFieldErrors,
  ) {
    super(message);
    this.name = 'SchoolUserInviteServiceError';
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null
  );
}

function isFieldErrors(
  value: unknown,
): value is UnifiedUserInviteFieldErrors {
  if (!isRecord(value)) {
    return false;
  }

  return Object.values(value).every(
    (entry) => typeof entry === 'string',
  );
}

function isInviteResponse(
  value: unknown,
): value is SchoolUserInviteResponse {
  return (
    isRecord(value) &&
    value.success === true &&
    typeof value.userId === 'string' &&
    typeof value.profileId === 'string' &&
    typeof value.role === 'string' &&
    typeof value.email === 'string' &&
    typeof value.invitationSent === 'boolean' &&
    typeof value.reusedExistingUser === 'boolean' &&
    typeof value.message === 'string'
  );
}

function isInviteErrorBody(
  value: unknown,
): value is SchoolUserInviteErrorBody {
  return (
    isRecord(value) &&
    value.success === false &&
    typeof value.code === 'string' &&
    typeof value.message === 'string' &&
    (value.fieldErrors === undefined ||
      isFieldErrors(value.fieldErrors))
  );
}

async function getFunctionError(
  error: unknown,
): Promise<SchoolUserInviteServiceError> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body: unknown =
        await error.context.json();

      if (isInviteErrorBody(body)) {
        return new SchoolUserInviteServiceError(
          body.message,
          body.code,
          body.fieldErrors,
        );
      }

      if (
        isRecord(body) &&
        typeof body.error === 'string'
      ) {
        return new SchoolUserInviteServiceError(
          body.error,
          'FUNCTION_HTTP_ERROR',
        );
      }
    } catch {
      return new SchoolUserInviteServiceError(
        error.message,
        'FUNCTION_HTTP_ERROR',
      );
    }
  }

  if (error instanceof FunctionsRelayError) {
    return new SchoolUserInviteServiceError(
      'A funcao de convite esta temporariamente indisponivel.',
      'FUNCTION_RELAY_ERROR',
    );
  }

  if (error instanceof FunctionsFetchError) {
    return new SchoolUserInviteServiceError(
      'Nao foi possivel conectar a funcao de convite.',
      'FUNCTION_FETCH_ERROR',
    );
  }

  if (error instanceof Error) {
    return new SchoolUserInviteServiceError(
      error.message,
      'UNKNOWN_ERROR',
    );
  }

  return new SchoolUserInviteServiceError(
    'Nao foi possivel enviar o convite.',
    'UNKNOWN_ERROR',
  );
}

export const schoolUserInviteService = {
  async invite(
    payload: UnifiedUserInvitePayload,
  ): Promise<SchoolUserInviteResponse> {
    const { data, error } =
      await supabase.functions.invoke(
        'invite-school-user',
        {
          body: payload,
        },
      );

    if (error) {
      throw await getFunctionError(error);
    }

    if (isInviteResponse(data)) {
      return data;
    }

    if (isInviteErrorBody(data)) {
      throw new SchoolUserInviteServiceError(
        data.message,
        data.code,
        data.fieldErrors,
      );
    }

    throw new SchoolUserInviteServiceError(
      'A funcao respondeu em um formato invalido.',
      'INVALID_FUNCTION_RESPONSE',
    );
  },
};
