import { supabase } from '../lib/supabaseClient';

const PROFILE_AVATAR_BUCKET = 'profile-avatars';
const PROFILE_AVATAR_SIZE = 512;
const PROFILE_AVATAR_SIGNED_URL_TTL = 60 * 60;
const PROFILE_AVATAR_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export type ProfileAvatarErrorCode =
  | 'INVALID_FILE_TYPE'
  | 'IMAGE_PROCESSING_FAILED'
  | 'SESSION_EXPIRED'
  | 'AVATAR_STORAGE_FAILED'
  | 'AVATAR_PROFILE_UPDATE_FAILED'
  | 'AVATAR_SIGNED_URL_FAILED';

export class ProfileAvatarError extends Error {
  constructor(
    public readonly code: ProfileAvatarErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ProfileAvatarError';
  }
}

export interface UpdatedProfileAvatar {
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

function getCurrentUserId(): Promise<string> {
  return supabase.auth.getUser().then(({ data, error }) => {
    if (error || !data.user) {
      throw new ProfileAvatarError(
        'SESSION_EXPIRED',
        'Sessão expirada.',
      );
    }

    return data.user.id;
  });
}

export function profileAvatarPath(profileId: string): string {
  return `${profileId}/avatar.webp`;
}

export function getProfileAvatarPath(
  value: string | null | undefined,
  profileId: string,
): string | null {
  const path = value?.trim() ?? '';
  return path === profileAvatarPath(profileId) ? path : null;
}

export function validateProfileAvatarFile(file: File): void {
  if (!PROFILE_AVATAR_TYPES.has(file.type.toLowerCase())) {
    throw new ProfileAvatarError(
      'INVALID_FILE_TYPE',
      'Escolha uma imagem JPG, PNG ou WebP.',
    );
  }
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = PROFILE_AVATAR_SIZE;
  canvas.height = PROFILE_AVATAR_SIZE;
  return canvas;
}

function drawContained(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
): void {
  if (width <= 0 || height <= 0) {
    throw new ProfileAvatarError(
      'IMAGE_PROCESSING_FAILED',
      'Não foi possível preparar a imagem para o upload.',
    );
  }

  const scale = Math.min(
    PROFILE_AVATAR_SIZE / width,
    PROFILE_AVATAR_SIZE / height,
  );
  const drawnWidth = width * scale;
  const drawnHeight = height * scale;

  context.clearRect(0, 0, PROFILE_AVATAR_SIZE, PROFILE_AVATAR_SIZE);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    source,
    (PROFILE_AVATAR_SIZE - drawnWidth) / 2,
    (PROFILE_AVATAR_SIZE - drawnHeight) / 2,
    drawnWidth,
    drawnHeight,
  );
}

function canvasToWebp(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== 'image/webp') {
        reject(
          new ProfileAvatarError(
            'IMAGE_PROCESSING_FAILED',
            'Não foi possível preparar a imagem para o upload.',
          ),
        );
        return;
      }

      resolve(blob);
    }, 'image/webp', 0.86);
  });
}

async function prepareWithImageBitmap(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  });

  try {
    const canvas = createCanvas();
    const context = canvas.getContext('2d');

    if (!context) {
      throw new ProfileAvatarError(
        'IMAGE_PROCESSING_FAILED',
        'Não foi possível preparar a imagem para o upload.',
      );
    }

    drawContained(context, bitmap, bitmap.width, bitmap.height);
    return await canvasToWebp(canvas);
  } finally {
    bitmap.close();
  }
}

async function prepareWithImageElement(file: File): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('image-load-failed'));
      element.src = objectUrl;
    });
    const canvas = createCanvas();
    const context = canvas.getContext('2d');

    if (!context) {
      throw new ProfileAvatarError(
        'IMAGE_PROCESSING_FAILED',
        'Não foi possível preparar a imagem para o upload.',
      );
    }

    drawContained(
      context,
      image,
      image.naturalWidth,
      image.naturalHeight,
    );
    return await canvasToWebp(canvas);
  } catch (error) {
    if (error instanceof ProfileAvatarError) {
      throw error;
    }

    throw new ProfileAvatarError(
      'IMAGE_PROCESSING_FAILED',
      'Não foi possível ler a imagem selecionada.',
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function prepareProfileAvatar(file: File): Promise<Blob> {
  validateProfileAvatarFile(file);

  try {
    return typeof createImageBitmap === 'function'
      ? await prepareWithImageBitmap(file)
      : await prepareWithImageElement(file);
  } catch (error) {
    if (error instanceof ProfileAvatarError) {
      throw error;
    }

    throw new ProfileAvatarError(
      'IMAGE_PROCESSING_FAILED',
      'Não foi possível preparar a imagem para o upload.',
    );
  }
}

async function createSignedAvatarUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(PROFILE_AVATAR_BUCKET)
    .createSignedUrl(path, PROFILE_AVATAR_SIGNED_URL_TTL);

  if (error || !data?.signedUrl) {
    throw new ProfileAvatarError(
      'AVATAR_SIGNED_URL_FAILED',
      'Não foi possível carregar sua foto de perfil.',
    );
  }

  return data.signedUrl;
}

export async function resolveProfileAvatarUrl(
  value: string | null | undefined,
  profileId: string,
): Promise<string | null> {
  const avatarValue = value?.trim() ?? '';

  if (!avatarValue) {
    return null;
  }

  if (/^https:\/\//i.test(avatarValue)) {
    return avatarValue;
  }

  const path = getProfileAvatarPath(avatarValue, profileId);
  if (!path) {
    return null;
  }

  try {
    return await createSignedAvatarUrl(path);
  } catch {
    return null;
  }
}

export async function updateCurrentProfileAvatar(
  file: File,
): Promise<UpdatedProfileAvatar> {
  const profileId = await getCurrentUserId();
  const path = profileAvatarPath(profileId);
  const preparedImage = await prepareProfileAvatar(file);
  const storage = supabase.storage.from(PROFILE_AVATAR_BUCKET);
  const { error: uploadError } = await storage.upload(path, preparedImage, {
    cacheControl: '3600',
    contentType: 'image/webp',
    upsert: true,
  });

  if (uploadError) {
    throw new ProfileAvatarError(
      isExpiredSessionError(uploadError)
        ? 'SESSION_EXPIRED'
        : 'AVATAR_STORAGE_FAILED',
      'Não foi possível enviar sua foto de perfil.',
    );
  }

  const { error: profileError } = await supabase.rpc(
    'set_current_profile_avatar',
    { p_avatar_path: path },
  );

  if (profileError) {
    await storage.remove([path]).catch(() => undefined);
    throw new ProfileAvatarError(
      isExpiredSessionError(profileError)
        ? 'SESSION_EXPIRED'
        : 'AVATAR_PROFILE_UPDATE_FAILED',
      'Não foi possível atualizar sua foto de perfil.',
    );
  }

  try {
    return {
      path,
      avatar_url: await createSignedAvatarUrl(path),
    };
  } catch (error) {
    try {
      await supabase.rpc('set_current_profile_avatar', {
        p_avatar_path: null,
      });
    } catch {
      // Keep the original signed URL error as the actionable failure.
    }
    await storage.remove([path]).catch(() => undefined);
    throw error;
  }
}

export async function removeCurrentProfileAvatar(): Promise<void> {
  const profileId = await getCurrentUserId();
  const path = profileAvatarPath(profileId);
  const storage = supabase.storage.from(PROFILE_AVATAR_BUCKET);
  const { error: profileError } = await supabase.rpc(
    'set_current_profile_avatar',
    { p_avatar_path: null },
  );

  if (profileError) {
    throw new ProfileAvatarError(
      isExpiredSessionError(profileError)
        ? 'SESSION_EXPIRED'
        : 'AVATAR_PROFILE_UPDATE_FAILED',
      'Não foi possível remover sua foto de perfil.',
    );
  }

  const { error: removeError } = await storage.remove([path]);
  if (removeError) {
    try {
      await supabase.rpc('set_current_profile_avatar', {
        p_avatar_path: path,
      });
    } catch {
      // The storage error remains the primary failure reported to the user.
    }
    throw new ProfileAvatarError(
      isExpiredSessionError(removeError)
        ? 'SESSION_EXPIRED'
        : 'AVATAR_STORAGE_FAILED',
      'Não foi possível remover sua foto de perfil.',
    );
  }
}
