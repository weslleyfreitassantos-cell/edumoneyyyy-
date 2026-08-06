// @vitest-environment jsdom

import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { InstitutionSubdomainSection } from './InstitutionSubdomainSection';

vi.mock('../../contexts/InstitutionContext', () => ({
  useInstitution: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock('../../services/institutionService', () => ({
  updateInstitutionSubdomain: vi.fn().mockResolvedValue({ id: 'inst-1' }),
}));

describe('InstitutionSubdomainSection', () => {
  afterEach(() => {
    cleanup();
  });

  it('permite que o DIRETOR veja a sugestão e edite o subdomínio', async () => {
    render(
      <InstitutionSubdomainSection
        institutionId="inst-1"
        institutionName="Escola Modelo"
        currentSubdomain="escola-modelo"
        userRole="DIRECTOR"
      />
    );

    expect(screen.getByText('Endereço Web da Instituição (Subdomínio)')).toBeTruthy();
    expect(screen.getByDisplayValue('escola-modelo')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Usar sugestão/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Salvar subdomínio/i })).toBeTruthy();
  });

  it('bloqueia edição do subdomínio para usuários com perfil ADMIN', () => {
    render(
      <InstitutionSubdomainSection
        institutionId="inst-1"
        institutionName="Escola Modelo"
        currentSubdomain="escola-modelo"
        userRole="ADMIN"
      />
    );

    const input = screen.getByDisplayValue('escola-modelo') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /Usar sugestão/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Salvar subdomínio/i })).toBeNull();
    expect(
      screen.getByText(/Apenas o Diretor da instituição possui permissão/i)
    ).toBeTruthy();
  });
});
