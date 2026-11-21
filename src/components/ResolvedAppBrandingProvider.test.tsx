// @vitest-environment jsdom

import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LoadingIndicator from './LoadingIndicator';
import ResolvedAppBrandingProvider from './ResolvedAppBrandingProvider';

const mocks = vi.hoisted(() => ({
  auth: { profile: null as null | { platform_role: string } },
  institution: {
    currentInstitution: null as null | {
      id: string;
      name: string;
      logo_url: string | null;
      primary_color?: string | null;
    },
    isLoading: false,
  },
  hostBranding: {
    scope: 'GLOBAL' as const,
    displayName: 'Tec Escola',
    logoUrl: 'https://cdn.example.com/tec.png',
    faviconUrl: null,
    loginBackgroundUrl: null,
    primaryColor: '#005bbf',
    secondaryColor: '#6ffbbe',
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../contexts/InstitutionContext', () => ({
  useInstitution: () => mocks.institution,
}));

vi.mock('../hooks/useBranding', () => ({
  getHostBrandingFallback: () => ({
    scope: 'GLOBAL',
    displayName: null,
    logoUrl: null,
    faviconUrl: null,
    loginBackgroundUrl: null,
    primaryColor: '#005bbf',
    secondaryColor: '#6ffbbe',
  }),
  useResolvedBranding: () => ({ data: mocks.hostBranding }),
}));

describe('ResolvedAppBrandingProvider', () => {
  beforeEach(() => {
    mocks.auth = { profile: { platform_role: 'STUDENT' } };
    mocks.institution = {
      currentInstitution: {
        id: 'helita',
        name: 'Colégio Helita Vieira',
        logo_url: 'https://cdn.example.com/helita.png',
        primary_color: '#cf2626',
      },
      isLoading: false,
    };
  });

  it('passes the active institution logo to loading screens on shared host', () => {
    const { container } = render(
      <ResolvedAppBrandingProvider>
        <LoadingIndicator label="Carregando instituição" />
      </ResolvedAppBrandingProvider>,
    );

    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://cdn.example.com/helita.png',
    );
    expect(container.querySelector('img')?.getAttribute('alt')).toBe(
      'Logo de Colégio Helita Vieira',
    );
  });

  it('does not expose the platform logo while the school selection is loading', () => {
    mocks.institution = {
      currentInstitution: null,
      isLoading: true,
    };

    const { container } = render(
      <ResolvedAppBrandingProvider>
        <LoadingIndicator label="Carregando instituição" />
      </ResolvedAppBrandingProvider>,
    );

    expect(container.querySelector('img')).toBeNull();
  });
});
