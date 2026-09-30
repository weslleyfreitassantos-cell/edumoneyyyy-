import { supabase } from '../lib/supabaseClient';
import {
  PROFILE_NAME_MAX_LENGTH,
  PROFILE_PASSWORD_MIN_LENGTH,
} from '../schemas/profileSchemas';
import { prepareAvatarImage } from './avatarImageService';

export const PROFILE_AVATARS_BUCKET = 'profile-avatars';
export const PROFILE_AVATAR_SIGNED_URL_TTL = 60 * 60;

export type ProfileServiceErrorCode =
  | 'INVALID_NAME'
  | 'PASSWORD_TOO_SHORT'
  | 'PASSWORD_REUSED'
  | 'PASSWORD_POLICY_FAILED'
  | 'SESSION_EXPIRED'
  | 'PROFILE_UPDATE_FAILED'
  | 'PASSWORD_UPDATE_FAILED'
  | 'AVATAR_STORAGE_FAILED'
  | 'AVATAR_PROFILE_UPDATE_FAILED'
  | 'AVATAR_SIGNED_URL_FAILED';

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

export interface UpdatedCurrentProfileAvatar {
  path: string;
  avatar_url: string;
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

function getAuthErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return '';
  }

  return 'code' in error ? String(error.code).toLowerCase() : '';
}

function getAuthErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return '';
  }

  return 'message' in error ? String(error.message).toLowerCase() : '';
}

function isPasswordReuseError(error: unknown): boolean {
  const code = getAuthErrorCode(error);
  const message = getAuthErrorMessage(error);

  return code === 'same_password' ||
    /different from (the )?(old|current) password/.test(message) ||
    /same password/.test(message);
}

function isPasswordPolicyError(error: unknown): boolean {
  const code = getAuthErrorCode(error);
  const message = getAuthErrorMessage(error);
  const status = error && typeof error === 'object' && 'status' in error
    ? Number(error.status)
    : null;

  return code === 'weak_password' ||
    code === 'password_too_short' ||
    code === 'password_strength' ||
    status === 422 ||
    /password.*(at least|characters|weak|common|security)/.test(message);
}

function normalizeFullName(fullName: string): string {
  return fullName.trim();
}

async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new ProfileServiceError(
      'SESSION_EXPIRED',
      'Sessão expirada.',
    );
  }

  return user.id;
}

function isHttpsUrl(value: string): boolean {
  return /^https:\/\//i.test(value);
}

function isCanonicalAvatarPath(
  value: string,
  userId: string,
): boolean {
  return value === `${userId}/avatar.webp`;
}

async function createCurrentAvatarSignedUrl(
  path: string,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(PROFILE_AVATARS_BUCKET)
    .createSignedUrl(path, PROFILE_AVATAR_SIGNED_URL_TTL);

  if (error || !data?.signedUrl) {
    throw new ProfileServiceError(
      'AVATAR_SIGNED_URL_FAILED',
      'Não foi possível carregar sua foto de perfil.',
    );
  }

  return data.signedUrl;
}

function getAvatarUploadError(error: unknown): ProfileServiceError {
  return new ProfileServiceError(
    isExpiredSessionError(error)
      ? 'SESSION_EXPIRED'
      : 'AVATAR_STORAGE_FAILED',
    'Não foi possível enviar sua foto de perfil.',
  );
}

export async function resolveCurrentProfileAvatar(
  avatarReference: string | null | undefined,
  expectedUserId?: string,
): Promise<string | null> {
  const reference = avatarReference?.trim();

  if (!reference) {
    return null;
  }

  if (isHttpsUrl(reference)) {
    return reference;
  }

  const userId = expectedUserId ?? await getCurrentUserId();

  if (!isCanonicalAvatarPath(reference, userId)) {
    return null;
  }

  try {
    return await createCurrentAvatarSignedUrl(reference);
  } catch {
    // A temporary Storage failure must fall back to initials in the UI.
    return null;
  }
}

export async function updateCurrentProfileAvatar(
  file: File,
): Promise<UpdatedCurrentProfileAvatar> {
  const userId = await getCurrentUserId();
  const path = `${userId}/avatar.webp`;
  const processedImage = await prepareAvatarImage(file);
  const storage = supabase.storage.from(PROFILE_AVATARS_BUCKET);

  const { error: uploadError } = await storage.upload(
    path,
    processedImage,
    {
      cacheControl: '3600',
      contentType: 'image/webp',
      upsert: true,
    },
  );

  if (uploadError) {
    throw getAvatarUploadError(uploadError);
  }

  const { error: profileError } = await supabase.rpc(
    'set_current_profile_avatar',
    { p_avatar_path: path },
  );

  if (profileError) {
    await storage.remove([path]).catch(() => undefined);
    throw new ProfileServiceError(
      isExpiredSessionError(profileError)
        ? 'SESSION_EXPIRED'
        : 'AVATAR_PROFILE_UPDATE_FAILED',
      'Não foi possível atualizar sua foto de perfil.',
    );
  }

  try {
    return {
      path,
      avatar_url: await createCurrentAvatarSignedUrl(path),
    };
  } catch (error) {
    try {
      await supabase.rpc('set_current_profile_avatar', {
        p_avatar_path: null,
      });
    } catch {
      // Best-effort rollback; the original error is more useful to the caller.
    }
    await storage.remove([path]).catch(() => undefined);
    throw error;
  }
}

export async function removeCurrentProfileAvatar(): Promise<void> {
  const userId = await getCurrentUserId();
  const path = `${userId}/avatar.webp`;
  const storage = supabase.storage.from(PROFILE_AVATARS_BUCKET);

  const { error: profileError } = await supabase.rpc(
    'set_current_profile_avatar',
    { p_avatar_path: null },
  );

  if (profileError) {
    throw new ProfileServiceError(
      isExpiredSessionError(profileError)
        ? 'SESSION_EXPIRED'
        : 'AVATAR_PROFILE_UPDATE_FAILED',
      'Não foi possível remover sua foto de perfil.',
    );
  }

  const { error: storageError } = await storage.remove([path]);

  if (storageError) {
    try {
      await supabase.rpc('set_current_profile_avatar', {
        p_avatar_path: path,
      });
    } catch {
      // Keep the profile cleared if the compensating update also fails.
    }
    throw getAvatarUploadError(storageError);
  }
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
    if (isPasswordReuseError(error)) {
      throw new ProfileServiceError(
        'PASSWORD_REUSED',
        'A nova senha deve ser diferente da senha atual.',
      );
    }

    if (isPasswordPolicyError(error)) {
      throw new ProfileServiceError(
        'PASSWORD_POLICY_FAILED',
        'A nova senha não atende aos requisitos de segurança configurados.',
      );
    }

    throw new ProfileServiceError(
      isExpiredSessionError(error)
        ? 'SESSION_EXPIRED'
        : 'PASSWORD_UPDATE_FAILED',
      'Não foi possível alterar a senha.',
    );
  }
}
