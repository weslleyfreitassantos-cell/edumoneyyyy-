export const PLATFORM_PRIMARY_HOSTNAME =
  'edumoneyyyy.weslleyfreitassantos.workers.dev';

export const LOGO_MAX_SIZE_BYTES = 2 * 1024 * 1024;
export const FAVICON_MAX_SIZE_BYTES = 512 * 1024;
export const DEFAULT_BRAND_PRIMARY_COLOR = '#005bbf';
export const DEFAULT_BRAND_SECONDARY_COLOR = '#6ffbbe';

export const ALLOWED_BRANDING_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export const ALLOWED_LOGO_MIME_TYPES =
  ALLOWED_BRANDING_MIME_TYPES;

export const BRANDING_IMAGE_LIMITS = {
  logo: LOGO_MAX_SIZE_BYTES,
  favicon: FAVICON_MAX_SIZE_BYTES,
} as const;

export type BrandingImageKind =
  keyof typeof BRANDING_IMAGE_LIMITS;

export type AllowedLogoMimeType =
  (typeof ALLOWED_BRANDING_MIME_TYPES)[number];

export type AllowedBrandingMimeType = AllowedLogoMimeType;

const hexColorPattern = /^#[0-9a-fA-F]{6}$/;
const hostnamePattern =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

const reservedHostnames = new Set([
  'localhost',
  '127.0.0.1',
  PLATFORM_PRIMARY_HOSTNAME,
  `www.${PLATFORM_PRIMARY_HOSTNAME}`,
  'edumoneyyyy.pages.dev',
  'edumoneyyyy-preview.pages.dev',
]);

export interface HostnameValidationResult {
  hostname: string | null;
  error: string | null;
}

export function isAllowedMimeType(
  value: string,
): value is AllowedLogoMimeType {
  return ALLOWED_BRANDING_MIME_TYPES.includes(
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

export function isValidBrandColor(
  value: string,
): boolean {
  return hexColorPattern.test(value.trim());
}

export function sanitizeBrandColor(
  value: string | null | undefined,
  fallback: string,
): string {
  const normalized = value?.trim() ?? '';

  return isValidBrandColor(normalized)
    ? normalized.toLowerCase()
    : fallback;
}

export function normalizeHostnameValue(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
}

export function isReservedHostname(
  hostname: string,
): boolean {
  const normalized = normalizeHostnameValue(hostname);

  return (
    reservedHostnames.has(normalized) ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.pages.dev')
  );
}

export function validateAccountDomainHostname(
  value: string,
): HostnameValidationResult {
  const rawValue = value.trim();

  if (!rawValue) {
    return {
      hostname: null,
      error: 'Informe um hostname.',
    };
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(rawValue)) {
    return {
      hostname: null,
      error: 'Informe o hostname sem protocolo.',
    };
  }

  if (/[/?#]/.test(rawValue)) {
    return {
      hostname: null,
      error: 'Informe o hostname sem caminho, query string ou barra final.',
    };
  }

  if (/\s/.test(rawValue) || rawValue.includes(':')) {
    return {
      hostname: null,
      error: 'O hostname nao pode conter espacos ou porta.',
    };
  }

  const hostname = normalizeHostnameValue(rawValue);

  if (!hostnamePattern.test(hostname)) {
    return {
      hostname: null,
      error: 'Informe um hostname valido.',
    };
  }

  if (isReservedHostname(hostname)) {
    return {
      hostname: null,
      error: 'Este hostname e reservado para a plataforma.',
    };
  }

  return {
    hostname,
    error: null,
  };
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

export async function validateBrandingImageFile(
  file: File,
  kind: BrandingImageKind,
): Promise<string | null> {
  if (!(file instanceof File)) {
    return 'Selecione um arquivo de imagem.';
  }

  if (file.size === 0) {
    return 'O arquivo esta vazio.';
  }

  const maxSize = BRANDING_IMAGE_LIMITS[kind];

  if (file.size > maxSize) {
    return kind === 'logo'
      ? 'A logo deve ter no maximo 2 MB.'
      : 'O favicon deve ter no maximo 512 KB.';
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

export async function validateInstitutionLogoFile(
  file: File,
): Promise<string | null> {
  return validateBrandingImageFile(file, 'logo');
}
