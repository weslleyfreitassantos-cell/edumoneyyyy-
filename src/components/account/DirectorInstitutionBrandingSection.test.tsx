// @vitest-environment jsdom

import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { DirectorInstitutionBrandingSection } from './DirectorInstitutionBrandingSection';

vi.mock('../../contexts/InstitutionContext', () => ({
  useInstitution: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: { id: 'director-profile-1', role: 'DIRECTOR' },
  }),
}));

vi.mock('../../hooks/useInstitutionBranding', () => ({
  useSaveInstitutionLogo: () => ({ mutateAsync: vi.fn() }),
  useRemoveInstitutionLogo: () => ({ mutateAsync: vi.fn() }),
}));

describe('DirectorInstitutionBrandingSection', () => {
  afterEach(() => {
    cleanup();
  });

  it('exibe o endereço da instituição em modo leitura e permite editar apenas logo e cores', () => {
    render(
      <DirectorInstitutionBrandingSection
        institutionId="inst-1"
        institutionName="Escola Modelo"
        currentSubdomain="escolamodelo"
        currentLogoUrl="https://example.com/logo.png"
        currentPrimaryColor="#005bbf"
        currentSecondaryColor="#ff9900"
      />
    );

    expect(screen.getByText('Identidade Visual da Instituição (Diretor)')).toBeTruthy();
    expect(screen.getByText('https://escolamodelo.grupotec.dev.br')).toBeTruthy();

    // Garante que NÃO existe campo editável ou botões para subdomínio
    expect(screen.queryByRole('button', { name: /Usar sugestão/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Salvar subdomínio/i })).toBeNull();

    // Garante que existem os botões e campos para logo e cores
    expect(screen.getByText('Logotipo da Instituição')).toBeTruthy();
    expect(screen.getByText('Cor Primária')).toBeTruthy();
    expect(screen.getByText('Cor Secundária')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Salvar identidade visual/i })).toBeTruthy();
  });

  it('exibe aviso explicativo quando a instituição ainda não possui subdomínio configurado', () => {
    render(
      <DirectorInstitutionBrandingSection
        institutionId="inst-1"
        institutionName="Escola Modelo"
        currentSubdomain={null}
        currentLogoUrl={null}
        currentPrimaryColor={null}
        currentSecondaryColor={null}
      />
    );

    expect(
      screen.getByText(/O endereço da instituição ainda não foi configurado pelo administrador/i)
    ).toBeTruthy();
  });
});
