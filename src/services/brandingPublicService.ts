import { supabase } from '../lib/supabaseClient';

export interface PublicInstitutionBranding {
  name: string;
  logoUrl: string | null;
  publicSlug: string;
}

interface BrandingRow {
  name?: unknown;
  logo_url?: unknown;
  public_slug?: unknown;
}

const publicSlugPattern =
  /^[a-z0-9](?:[a-z0-9-]{1,78}[a-z0-9])$/;

function normalizePublicBrandingRow(
  row: BrandingRow,
): PublicInstitutionBranding | null {
  if (
    typeof row.name !== 'string' ||
    typeof row.public_slug !== 'string'
  ) {
    return null;
  }

  return {
    name: row.name,
    logoUrl:
      typeof row.logo_url === 'string'
        ? row.logo_url
        : null,
    publicSlug: row.public_slug,
  };
}

export function normalizePublicSlug(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim().toLowerCase() ?? '';

  if (!publicSlugPattern.test(normalized)) {
    return null;
  }

  return normalized;
}

export function buildPublicSlugFromName(
  name: string,
): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 72)
    .replace(/-+$/g, '');

  return slug.length >= 3 ? slug : 'instituicao';
}

export function buildInstitutionLoginUrl(
  publicSlug: string,
): string {
  const path = `/login?institution=${encodeURIComponent(
    publicSlug,
  )}`;

  if (
    typeof window === 'undefined' ||
    !window.location?.origin
  ) {
    return path;
  }

  return `${window.location.origin}${path}`;
}

export const brandingPublicService = {
  async getPublicBranding(
    publicSlug: string,
  ): Promise<PublicInstitutionBranding | null> {
    const normalizedSlug = normalizePublicSlug(publicSlug);

    if (!normalizedSlug) {
      return null;
    }

    try {
      const { data, error } = await supabase.rpc(
        'get_public_institution_branding',
        {
          lookup_slug: normalizedSlug,
        },
      );

      // If the RPC fails, we return null to allow graceful fallback
      // since the infrastructure might not be deployed yet.
      if (error) {
        return null;
      }

      const row = Array.isArray(data) ? data[0] : data;

      return row
        ? normalizePublicBrandingRow(row as BrandingRow)
        : null;
    } catch {
      return null;
    }
  },
};
