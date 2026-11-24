import type { PublicBranding } from './brandingService';
import { sanitizeBrandColor } from './brandingValidation';

export interface InstitutionBrandingSource {
  name: string;
  login_display_name?: string | null;
  logo_url?: string | null;
  favicon_url?: string | null;
  login_background_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
}

export function resolveAppBranding({
  hostBranding,
  isAuthenticated,
  platformRole,
  institution,
  institutionLoading,
}: {
  hostBranding: PublicBranding;
  isAuthenticated: boolean;
  platformRole: string | null;
  institution: InstitutionBrandingSource | null;
  institutionLoading: boolean;
}): PublicBranding {
  const isSchoolUser = isAuthenticated && platformRole !== 'SUPER_ADMIN';

  // The public institution branding is the canonical tenant identity. The
  // user's institution membership can remain cached after a director changes
  // the colors, so do not let that stale snapshot override the subdomain RPC.
  if (isSchoolUser && hostBranding.scope === 'INSTITUTION') {
    return hostBranding;
  }

  if (isSchoolUser && institution) {
    return {
      scope: 'INSTITUTION',
      documentTitle: institution.name,
      displayName:
        institution.login_display_name?.trim() || institution.name,
      logoUrl: institution.logo_url ?? null,
      faviconUrl: institution.favicon_url ?? null,
      loginBackgroundUrl: institution.login_background_url ?? null,
      primaryColor: sanitizeBrandColor(
        institution.primary_color,
        hostBranding.primaryColor,
      ),
      secondaryColor: sanitizeBrandColor(
        institution.secondary_color,
        hostBranding.secondaryColor,
      ),
    };
  }

  if (
    isSchoolUser &&
    institutionLoading &&
    hostBranding.scope !== 'INSTITUTION'
  ) {
    return {
      ...hostBranding,
      scope: 'INSTITUTION',
      displayName: null,
      logoUrl: null,
      faviconUrl: null,
      loginBackgroundUrl: null,
    };
  }

  return hostBranding;
}
