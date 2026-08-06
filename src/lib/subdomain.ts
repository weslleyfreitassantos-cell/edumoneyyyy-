export const RESERVED_SUBDOMAINS = new Set([
  'admin',
  'api',
  'app',
  'assets',
  'auth',
  'blog',
  'cdn',
  'dashboard',
  'dev',
  'docs',
  'help',
  'login',
  'mail',
  'media',
  'platform',
  'portal',
  'privacy',
  'root',
  'staging',
  'status',
  'support',
  'terms',
  'test',
  'www',
]);

/**
 * Normalizes an input string into a valid subdomain prefix:
 * - Lowercase
 * - Removes diacritics / accents
 * - Replaces non-alphanumeric characters with hyphens
 * - Collapses repeated hyphens and trims leading/trailing hyphens
 */
export function normalizeSubdomain(input: string): string {
  if (!input) return '';

  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface SubdomainValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a subdomain string against length, format, and reserved names rules.
 */
export function validateSubdomain(subdomain: string): SubdomainValidationResult {
  const normalized = normalizeSubdomain(subdomain);

  if (!normalized) {
    return {
      valid: false,
      error: 'Informe o subdomínio.',
    };
  }

  if (normalized.length < 3 || normalized.length > 63) {
    return {
      valid: false,
      error: 'O subdomínio deve ter entre 3 e 63 caracteres.',
    };
  }

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(normalized)) {
    return {
      valid: false,
      error: 'O subdomínio deve conter apenas letras minúsculas, números e hífens (sem hífen no início ou fim).',
    };
  }

  if (RESERVED_SUBDOMAINS.has(normalized)) {
    return {
      valid: false,
      error: 'Este subdomínio é reservado pelo sistema e não pode ser utilizado.',
    };
  }

  return { valid: true };
}

/**
 * Suggests an initial subdomain prefix based on an institution's name.
 */
export function suggestSubdomain(institutionName: string): string {
  const normalized = normalizeSubdomain(institutionName);
  if (normalized.length >= 3) {
    // Return up to 63 chars
    return normalized.slice(0, 63).replace(/-+$/, '');
  }
  return 'escola';
}
