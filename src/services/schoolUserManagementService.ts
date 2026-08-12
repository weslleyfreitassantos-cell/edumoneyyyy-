import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';

import { supabase } from '../lib/supabaseClient';
import type { CurrentDatabaseRole } from '../lib/permissions';

export interface UpdateSchoolUserPayload {
  action: 'update';
  institutionId: string;
  membershipId: string;
  fullName?: string;
  role?: CurrentDatabaseRole;
  password?: string;
}

export interface DeleteSchoolUserPayload {
  action: 'delete';
  institutionId: string;
  membershipId: string;
  confirmation: 'EXCLUIR USUARIO';
}

export interface LinkGuardianPayload {
  action: 'link_guardian';
  institutionId: string;
  guardianProfileId: string;
  studentId: string;
  relationship: string;
  isPrimary: boolean;
}

export type ManageSchoolUserPayload =
  | UpdateSchoolUserPayload
  | DeleteSchoolUserPayload
  | LinkGuardianPayload;

export interface ManageSchoolUserResponse {
  success: true;
  action: 'update' | 'delete' | 'link_guardian';
  membershipId: string;
  profileId: string;
  guardianshipId?: string;
  authUserDeleted?: boolean;
  message: string;
}

interface ManageSchoolUserErrorBody {
  success: false;
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
}

export class SchoolUserManagementServiceError extends Error {
  code: string;
  fieldErrors?: Record<string, string>;

  constructor(
    message: string,
    code = 'UNKNOWN_ERROR',
    fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'SchoolUserManagementServiceError';
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

function isErrorBody(
  value: unknown,
): value is ManageSchoolUserErrorBody {
  return (
    isRecord(value) &&
    value.success === false &&
    typeof value.code === 'string' &&
    typeof value.message === 'string'
  );
}

function isSuccessBody(
  value: unknown,
): value is ManageSchoolUserResponse {
  return (
    isRecord(value) &&
    value.success === true &&
    typeof value.action === 'string' &&
    typeof value.membershipId === 'string' &&
    typeof value.profileId === 'string' &&
    typeof value.message === 'string'
  );
}

async function toServiceError(
  error: unknown,
): Promise<SchoolUserManagementServiceError> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body: unknown =
        await error.context.json();
      if (isErrorBody(body)) {
        return new SchoolUserManagementServiceError(
          body.message,
          body.code,
          body.fieldErrors,
        );
      }
    } catch {
      return new SchoolUserManagementServiceError(
        error.message,
        'FUNCTION_HTTP_ERROR',
      );
    }
  }

  if (error instanceof FunctionsRelayError) {
    return new SchoolUserManagementServiceError(
      'A funcao de usuarios esta temporariamente indisponivel.',
      'FUNCTION_RELAY_ERROR',
    );
  }

  if (error instanceof FunctionsFetchError) {
    return new SchoolUserManagementServiceError(
      'Nao foi possivel conectar a funcao de usuarios.',
      'FUNCTION_FETCH_ERROR',
    );
  }

  if (error instanceof Error) {
    return new SchoolUserManagementServiceError(
      error.message,
      'UNKNOWN_ERROR',
    );
  }

  return new SchoolUserManagementServiceError(
    'Nao foi possivel gerenciar o usuario.',
    'UNKNOWN_ERROR',
  );
}

export const schoolUserManagementService = {
  async manage(
    payload: ManageSchoolUserPayload,
  ): Promise<ManageSchoolUserResponse> {
    const { data, error } =
      await supabase.functions.invoke(
        'manage-school-user',
        {
          body: payload,
        },
      );

    if (error) {
      throw await toServiceError(error);
    }

    if (isSuccessBody(data)) {
      return data;
    }

    if (isErrorBody(data)) {
      throw new SchoolUserManagementServiceError(
        data.message,
        data.code,
        data.fieldErrors,
      );
    }

    throw new SchoolUserManagementServiceError(
      'A funcao respondeu em formato invalido.',
      'INVALID_FUNCTION_RESPONSE',
    );
  },
};
