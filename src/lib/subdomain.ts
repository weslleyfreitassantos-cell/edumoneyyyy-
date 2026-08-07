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
  'grupotec',
  'help',
  'login',
  'mail',
  'media',
  'platform',
  'portal',
  'privacy',
  'resend',
  'root',
  'send',
  'smtp',
  'staging',
  'static',
  'status',
  'suporte',
  'support',
  'tecescola',
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
  if (!subdomain || !subdomain.trim()) {
    return {
      valid: false,
      error: 'Informe o subdomínio.',
    };
  }

  const trimmed = subdomain.trim().toLowerCase();

  if (trimmed.length < 3 || trimmed.length > 63) {
    return {
      valid: false,
      error: 'O subdomínio deve ter entre 3 e 63 caracteres.',
    };
  }

  if (trimmed.includes('.')) {
    return {
      valid: false,
      error: 'O subdomínio não deve conter pontos.',
    };
  }

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(trimmed)) {
    return {
      valid: false,
      error: 'O subdomínio deve conter apenas letras minúsculas, números e hífens (sem hífen no início ou fim).',
    };
  }

  if (RESERVED_SUBDOMAINS.has(trimmed)) {
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
    return normalized.slice(0, 63).replace(/-+$/, '');
  }
  return 'escola';
}

export type HostResolution =
  | {
      type: 'platform';
      hostname: string;
    }
  | {
      type: 'institution';
      hostname: string;
      subdomain: string;
    }
  | {
      type: 'development';
      hostname: string;
    }
  | {
      type: 'invalid';
      hostname: string;
    };

/**
 * Classifies a hostname into platform, institution, development, or invalid.
 */
export function classifyHostname(hostname: string): HostResolution {
  if (!hostname) {
    return { type: 'invalid', hostname: '' };
  }

  const cleanHost = hostname.toLowerCase().trim().split(':')[0];

  if (
    cleanHost === 'localhost' ||
    cleanHost === '127.0.0.1' ||
    cleanHost.endsWith('.workers.dev')
  ) {
    return { type: 'development', hostname: cleanHost };
  }

  if (
    cleanHost === 'grupotec.dev.br' ||
    cleanHost === 'tecescola.grupotec.dev.br'
  ) {
    return { type: 'platform', hostname: cleanHost };
  }

  if (cleanHost.endsWith('.grupotec.dev.br')) {
    const prefix = cleanHost.slice(0, -'.grupotec.dev.br'.length);

    if (!prefix || prefix.includes('.')) {
      return { type: 'invalid', hostname: cleanHost };
    }

    const validation = validateSubdomain(prefix);
    if (!validation.valid) {
      return { type: 'invalid', hostname: cleanHost };
    }

    return {
      type: 'institution',
      hostname: cleanHost,
      subdomain: prefix,
    };
  }

  return { type: 'invalid', hostname: cleanHost };
}

/**
 * Extracts a custom institution subdomain prefix from a hostname (e.g. escolamodelo.grupotec.dev.br -> escolamodelo).
 */
export function extractSubdomainFromHostname(hostname: string): string | null {
  const resolution = classifyHostname(hostname);
  if (resolution.type === 'institution') {
    return resolution.subdomain;
  }
  return null;
}
