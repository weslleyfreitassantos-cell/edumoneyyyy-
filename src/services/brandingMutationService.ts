import { supabase } from '../lib/supabaseClient';
import {
  AllowedLogoMimeType,
  getStorageExtension,
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

interface BrandingRow {
  id?: unknown;
  name?: unknown;
  logo_url?: unknown;
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
    publicSlug: typeof row.public_slug === 'string' ? row.public_slug : null,
  };
}

async function updateInstitutionBranding(
  institutionId: string,
  logoUrl: string | null,
  publicSlug: string,
): Promise<InstitutionBranding> {
  const { data, error } = await supabase
    .from('institutions')
    .update({
      logo_url: logoUrl,
      public_slug: publicSlug,
      updated_at: new Date().toISOString(),
    })
    .eq('id', institutionId)
    .select('id, name, logo_url, public_slug')
    .single();

  if (error) {
    throw error;
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
    const logoUrl = publicUrlData.publicUrl;

    if (!logoUrl) {
      throw new Error('Nao foi possivel gerar a URL publica da logo.');
    }

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
};
