import { supabase } from '../lib/supabaseClient';
import {
  AllowedLogoMimeType,
  getStorageExtension,
  validateInstitutionFaviconFile,
  validateInstitutionLogoFile,
} from './brandingValidation';
import {
  buildPublicSlugFromName,
  normalizePublicSlug,
} from './brandingPublicService';

export const INSTITUTION_BRANDING_BUCKET = 'institution-branding';

export interface InstitutionBranding {
  id: string;
  name: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  publicSlug: string | null;
}

export interface SaveInstitutionLogoInput {
  institutionId: string;
  institutionName: string;
  currentPublicSlug: string | null;
  file: File;
}

export interface RemoveInstitutionLogoInput {
  institutionId: string;
  institutionName: string;
  currentPublicSlug: string | null;
}

export interface SaveInstitutionLogoResponse extends InstitutionBranding {
  logoPath: string;
}

export interface SaveInstitutionFaviconInput {
  institutionId: string;
  institutionName: string;
  currentPublicSlug: string | null;
  file: File;
}

export interface RemoveInstitutionFaviconInput {
  institutionId: string;
  institutionName: string;
  currentPublicSlug: string | null;
}

export interface SaveInstitutionFaviconResponse extends InstitutionBranding {
  faviconPath: string;
}

interface BrandingRow {
  id?: unknown;
  name?: unknown;
  logo_url?: unknown;
  favicon_url?: unknown;
  public_slug?: unknown;
}

function normalizeBrandingRow(row: BrandingRow): InstitutionBranding {
  if (typeof row.id !== 'string' || typeof row.name !== 'string') {
    throw new Error('A identidade visual retornou em formato invalido.');
  }

  return {
    id: row.id,
    name: row.name,
    logoUrl: typeof row.logo_url === 'string' ? row.logo_url : null,
    faviconUrl: typeof row.favicon_url === 'string' ? row.favicon_url : null,
    publicSlug: typeof row.public_slug === 'string' ? row.public_slug : null,
  };
}

async function updateInstitutionBranding(
  institutionId: string,
  logoUrl: string | null | undefined,
  publicSlug: string,
  faviconUrl?: string | null,
): Promise<InstitutionBranding> {
  const updatePayload: Record<string, unknown> = {
    public_slug: publicSlug,
    updated_at: new Date().toISOString(),
  };

  if (logoUrl !== undefined) {
    updatePayload.logo_url = logoUrl;
  }

  if (faviconUrl !== undefined) {
    updatePayload.favicon_url = faviconUrl;
  }

  const { data, error } = await supabase
    .from('institutions')
    .update(updatePayload)
    .eq('id', institutionId)
    .select('id, name, logo_url, favicon_url, public_slug')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      'Nenhum registro de identidade visual foi atualizado. Verifique suas permissoes.',
    );
  }

  return normalizeBrandingRow(data as BrandingRow);
}

function resolvePublicSlug(
  institutionName: string,
  currentPublicSlug: string | null,
): string {
  return (
    normalizePublicSlug(currentPublicSlug) ??
    buildPublicSlugFromName(institutionName)
  );
}

function buildVersionedPublicUrl(publicUrl: string): string {
  const separator = publicUrl.includes('?') ? '&' : '?';

  return `${publicUrl}${separator}v=${Date.now()}`;
}

async function removeKnownLogoFiles(institutionId: string): Promise<void> {
  const { error } = await supabase.storage
    .from(INSTITUTION_BRANDING_BUCKET)
    .remove([
      `${institutionId}/logo.png`,
      `${institutionId}/logo.jpg`,
      `${institutionId}/logo.jpeg`,
      `${institutionId}/logo.webp`,
    ]);

  if (error) {
    throw error;
  }
}

async function removeKnownFaviconFiles(
  institutionId: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(INSTITUTION_BRANDING_BUCKET)
    .remove([
      `${institutionId}/favicon.png`,
      `${institutionId}/favicon.jpg`,
      `${institutionId}/favicon.jpeg`,
      `${institutionId}/favicon.webp`,
    ]);

  if (error) {
    throw error;
  }
}

export const brandingMutationService = {
  async saveLogo(
    input: SaveInstitutionLogoInput,
  ): Promise<SaveInstitutionLogoResponse> {
    const validationError = await validateInstitutionLogoFile(input.file);

    if (validationError) {
      throw new Error(validationError);
    }

    const mimeType = input.file.type as AllowedLogoMimeType;
    const extension = getStorageExtension(mimeType);
    const logoPath = `${input.institutionId}/logo.${extension}`;
    const storage = supabase.storage.from(INSTITUTION_BRANDING_BUCKET);

    const { error: uploadError } = await storage.upload(logoPath, input.file, {
      cacheControl: '3600',
      contentType: mimeType,
      upsert: true,
    });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = storage.getPublicUrl(logoPath);
    const publicLogoUrl = publicUrlData.publicUrl;

    if (!publicLogoUrl) {
      throw new Error('Nao foi possivel gerar a URL publica da logo.');
    }

    const logoUrl = buildVersionedPublicUrl(publicLogoUrl);

    const publicSlug = resolvePublicSlug(
      input.institutionName,
      input.currentPublicSlug,
    );
    const branding = await updateInstitutionBranding(
      input.institutionId,
      logoUrl,
      publicSlug,
    );

    return {
      ...branding,
      logoPath,
    };
  },

  async removeLogo(
    input: RemoveInstitutionLogoInput,
  ): Promise<InstitutionBranding> {
    const publicSlug = resolvePublicSlug(
      input.institutionName,
      input.currentPublicSlug,
    );
    
    const branding = await updateInstitutionBranding(
      input.institutionId,
      null,
      publicSlug,
    );

    await removeKnownLogoFiles(input.institutionId);

    return branding;
  },

  async saveFavicon(
    input: SaveInstitutionFaviconInput,
  ): Promise<SaveInstitutionFaviconResponse> {
    const validationError = await validateInstitutionFaviconFile(input.file);

    if (validationError) {
      throw new Error(validationError);
    }

    const mimeType = input.file.type as AllowedLogoMimeType;
    const extension = getStorageExtension(mimeType);
    const faviconPath = `${input.institutionId}/favicon.${extension}`;
    const storage = supabase.storage.from(INSTITUTION_BRANDING_BUCKET);

    const { error: uploadError } = await storage.upload(faviconPath, input.file, {
      cacheControl: '3600',
      contentType: mimeType,
      upsert: true,
    });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = storage.getPublicUrl(faviconPath);
    const publicFaviconUrl = publicUrlData.publicUrl;

    if (!publicFaviconUrl) {
      throw new Error('Nao foi possivel gerar a URL publica do favicon.');
    }

    const faviconUrl = buildVersionedPublicUrl(publicFaviconUrl);

    const publicSlug = resolvePublicSlug(
      input.institutionName,
      input.currentPublicSlug,
    );
    const branding = await updateInstitutionBranding(
      input.institutionId,
      undefined,
      publicSlug,
      faviconUrl,
    );

    return {
      ...branding,
      faviconUrl,
      faviconPath,
    };
  },

  async removeFavicon(
    input: RemoveInstitutionFaviconInput,
  ): Promise<InstitutionBranding> {
    const publicSlug = resolvePublicSlug(
      input.institutionName,
      input.currentPublicSlug,
    );

    const branding = await updateInstitutionBranding(
      input.institutionId,
      undefined,
      publicSlug,
      null,
    );

    await removeKnownFaviconFiles(input.institutionId);

    return branding;
  },
};
