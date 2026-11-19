// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ResolvedBrandingProvider } from '../contexts/ResolvedBrandingContext';
import type { PublicBranding } from '../services/brandingService';
import LoadingIndicator from './LoadingIndicator';

describe('LoadingIndicator', () => {
  it('não mostra o ícone genérico enquanto a identidade do subdomínio carrega', () => {
    const { container } = render(
      <ResolvedBrandingProvider branding={null}>
        <LoadingIndicator label="Carregando identidade visual" size="screen" />
      </ResolvedBrandingProvider>,
    );

    expect(screen.getByRole('status', { name: 'Carregando identidade visual' })).toBeTruthy();
    expect(container.querySelector('.school-logo-loading__fallback')).toBeNull();
  });

  it('mostra a logo própria assim que a identidade da escola está disponível', () => {
    const branding = {
      scope: 'INSTITUTION',
      displayName: 'Escola Horizonte',
      logoUrl: 'https://cdn.example.com/escola-logo.png',
      faviconUrl: null,
      primaryColor: '#CF2626',
      secondaryColor: '#1A73E8',
    } satisfies PublicBranding;

    render(
      <ResolvedBrandingProvider branding={branding}>
        <LoadingIndicator label="Carregando identidade visual" size="screen" />
      </ResolvedBrandingProvider>,
    );

    expect(screen.getByAltText('Logo de Escola Horizonte')).toBeTruthy();
  });
});
