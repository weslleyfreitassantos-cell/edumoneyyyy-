export const LOGO_MAX_SIZE_BYTES = 2 * 1024 * 1024;

export const ALLOWED_LOGO_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export type AllowedLogoMimeType =
  (typeof ALLOWED_LOGO_MIME_TYPES)[number];

export function isAllowedMimeType(
  value: string,
): value is AllowedLogoMimeType {
  return ALLOWED_LOGO_MIME_TYPES.includes(
    value as AllowedLogoMimeType,
  );
}

export function getFileExtension(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match?.[1]?.toLowerCase() ?? '';
}

export function isAllowedExtension(
  extension: string,
  mimeType: AllowedLogoMimeType,
): boolean {
  if (mimeType === 'image/jpeg') {
    return extension === 'jpg' || extension === 'jpeg';
  }

  if (mimeType === 'image/png') {
    return extension === 'png';
  }

  return extension === 'webp';
}

export function getStorageExtension(
  mimeType: AllowedLogoMimeType,
): string {
  return mimeType === 'image/jpeg'
    ? 'jpg'
    : mimeType.replace('image/', '');
}

export function hasValidSignature(
  bytes: Uint8Array,
  mimeType: AllowedLogoMimeType,
): boolean {
  if (mimeType === 'image/png') {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  if (mimeType === 'image/jpeg') {
    return (
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }

  return (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

export async function validateInstitutionLogoFile(
  file: File,
): Promise<string | null> {
  if (!(file instanceof File)) {
    return 'Selecione um arquivo de imagem.';
  }

  if (file.size === 0) {
    return 'O arquivo esta vazio.';
  }

  if (file.size > LOGO_MAX_SIZE_BYTES) {
    return 'A logo deve ter no maximo 2 MB.';
  }

  if (!isAllowedMimeType(file.type)) {
    return 'Use PNG, JPEG ou WebP.';
  }

  const extension = getFileExtension(file.name);

  if (!isAllowedExtension(extension, file.type)) {
    return 'A extensao do arquivo nao corresponde aos formatos permitidos.';
  }

  try {
    const bytes = new Uint8Array(
      await file.slice(0, 12).arrayBuffer(),
    );

    if (!hasValidSignature(bytes, file.type)) {
      return 'A imagem selecionada e invalida.';
    }
  } catch {
    return 'Nao foi possivel validar a imagem.';
  }

  return null;
}
