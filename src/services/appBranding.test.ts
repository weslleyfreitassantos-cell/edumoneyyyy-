import { describe, expect, it } from 'vitest';

import { resolveAppBranding } from './appBranding';
import type { PublicBranding } from './brandingService';

const platformBranding: PublicBranding = {
  scope: 'GLOBAL',
  displayName: 'Tec Escola',
  logoUrl: 'https://cdn.example.com/tec.png',
  faviconUrl: null,
  loginBackgroundUrl: null,
  primaryColor: '#005bbf',
  secondaryColor: '#6ffbbe',
};

const helita = {
  id: 'helita',
  name: 'Colégio Helita Vieira',
  logo_url: 'https://cdn.example.com/helita.png',
  primary_color: '#cf2626',
};

describe('resolveAppBranding', () => {
  it('uses the active school identity on a shared platform host', () => {
    expect(resolveAppBranding({
      hostBranding: platformBranding,
      isAuthenticated: true,
      platformRole: 'STUDENT',
      institution: helita,
      institutionLoading: false,
    })).toMatchObject({
      scope: 'INSTITUTION',
      displayName: 'Colégio Helita Vieira',
      logoUrl: helita.logo_url,
      primaryColor: '#cf2626',
    });
  });

  it('hides the platform identity while a school context is loading on shared host', () => {
    expect(resolveAppBranding({
      hostBranding: platformBranding,
      isAuthenticated: true,
      platformRole: 'STUDENT',
      institution: null,
      institutionLoading: true,
    })).toMatchObject({
      scope: 'INSTITUTION',
      displayName: null,
      logoUrl: null,
    });
  });

  it('keeps same-host school branding while authenticated context resolves', () => {
    const tenantBranding = {
      ...platformBranding,
      scope: 'INSTITUTION' as const,
      displayName: 'Colégio Helita Vieira',
      logoUrl: helita.logo_url,
    };

    expect(resolveAppBranding({
      hostBranding: tenantBranding,
      isAuthenticated: true,
      platformRole: 'STUDENT',
      institution: null,
      institutionLoading: true,
    })).toBe(tenantBranding);
  });

  it('keeps global branding for anonymous and super-admin sessions', () => {
    expect(resolveAppBranding({
      hostBranding: platformBranding,
      isAuthenticated: false,
      platformRole: null,
      institution: helita,
      institutionLoading: false,
    })).toBe(platformBranding);
    expect(resolveAppBranding({
      hostBranding: platformBranding,
      isAuthenticated: true,
      platformRole: 'SUPER_ADMIN',
      institution: helita,
      institutionLoading: false,
    })).toBe(platformBranding);
  });
});
