// @vitest-environment jsdom

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ResolvedBrandingProvider } from '../contexts/ResolvedBrandingContext';
import type { PublicBranding } from '../services/brandingService';
import LoadingIndicator from './LoadingIndicator';

const brandingDefaults: PublicBranding = {
  scope: 'FALLBACK',
  displayName: null,
  logoUrl: null,
  faviconUrl: null,
  primaryColor: '#005bbf',
  secondaryColor: '#6ffbbe',
};

describe('LoadingIndicator', () => {
  it('shows the institution logo once its identity is resolved', () => {
    const branding = {
      ...brandingDefaults,
      scope: 'INSTITUTION' as const,
      displayName: 'Escola Luz',
      logoUrl: 'https://assets.example.test/escola-luz.png',
    };
    const { container } = render(
      <ResolvedBrandingProvider branding={branding}>
        <LoadingIndicator label="Carregando" />
      </ResolvedBrandingProvider>,
    );

    expect(container.querySelector('img')?.getAttribute('src')).toBe(branding.logoUrl);
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Logo de Escola Luz');
    expect(container.querySelector('.school-logo-loading__fallback')).toBeNull();
  });

  it('uses Tec Escola branding on the global platform and no generic school icon while unresolved', () => {
    const globalBranding = { ...brandingDefaults, scope: 'GLOBAL' as const };
    const global = render(
      <ResolvedBrandingProvider branding={globalBranding}>
        <LoadingIndicator label="Carregando" />
      </ResolvedBrandingProvider>,
    );
    expect(global.container.querySelector('img')?.getAttribute('src')).toBe('/icons/tecescola-512.png');
    global.unmount();

    const unresolved = render(<LoadingIndicator label="Carregando" />);
    expect(unresolved.container.querySelector('img')).toBeNull();
    expect(unresolved.container.querySelector('.school-logo-loading__fallback')).toBeNull();
    expect(unresolved.container.querySelector('.school-logo-loading__shell')).toBeNull();
  });
});
