import { supabase } from '../lib/supabaseClient';
import {
  PROFILE_NAME_MAX_LENGTH,
  PROFILE_PASSWORD_MIN_LENGTH,
} from '../schemas/profileSchemas';

export type ProfileServiceErrorCode =
  | 'INVALID_NAME'
  | 'PASSWORD_TOO_SHORT'
  | 'SESSION_EXPIRED'
  | 'PROFILE_UPDATE_FAILED'
  | 'PASSWORD_UPDATE_FAILED';

export class ProfileServiceError extends Error {
  constructor(
    public readonly code: ProfileServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ProfileServiceError';
  }
}

export interface UpdatedCurrentProfile {
  id: string;
  full_name: string;
}

function isExpiredSessionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error ? String(error.code) : '';

  return [
    'bad_jwt',
    'invalid_jwt',
    'refresh_token_not_found',
    'session_not_found',
  ].includes(code);
}

function normalizeFullName(fullName: string): string {
  return fullName.trim();
}

export async function updateCurrentProfile(input: {
  fullName: string;
}): Promise<UpdatedCurrentProfile> {
  const fullName = normalizeFullName(input.fullName);

  if (
    fullName.length < 2 ||
    fullName.length > PROFILE_NAME_MAX_LENGTH
  ) {
    throw new ProfileServiceError(
      'INVALID_NAME',
      'Nome inválido.',
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new ProfileServiceError(
      'SESSION_EXPIRED',
      'Sessão expirada.',
    );
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', user.id)
    .select('id, full_name')
    .single();

  if (
    error ||
    !data ||
    typeof data.id !== 'string' ||
    typeof data.full_name !== 'string'
  ) {
    throw new ProfileServiceError(
      isExpiredSessionError(error)
        ? 'SESSION_EXPIRED'
        : 'PROFILE_UPDATE_FAILED',
      'Não foi possível atualizar o perfil.',
    );
  }

  return {
    id: data.id,
    full_name: data.full_name,
  };
}

export async function updateCurrentPassword(
  newPassword: string,
): Promise<void> {
  if (newPassword.length < PROFILE_PASSWORD_MIN_LENGTH) {
    throw new ProfileServiceError(
      'PASSWORD_TOO_SHORT',
      'Senha muito curta.',
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new ProfileServiceError(
      isExpiredSessionError(error)
        ? 'SESSION_EXPIRED'
        : 'PASSWORD_UPDATE_FAILED',
      'Não foi possível alterar a senha.',
    );
  }
}
