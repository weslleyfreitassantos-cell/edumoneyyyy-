// @vitest-environment jsdom

import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminInstitutionSubdomainSection } from './AdminInstitutionSubdomainSection';
import { updateInstitutionSubdomain } from '../../services/institutionService';

vi.mock('../../contexts/InstitutionContext', () => ({
  useInstitution: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: { id: 'admin-profile-1', role: 'ADMIN' },
  }),
}));

vi.mock('../../services/institutionService', () => ({
  updateInstitutionSubdomain: vi.fn().mockResolvedValue({
    id: 'inst-1',
    name: 'Escola Modelo',
    subdomain: 'escolamodelo',
  }),
}));

describe('AdminInstitutionSubdomainSection', () => {
  afterEach(() => {
    cleanup();
  });

  const mockInstitutions = [
    {
      id: 'inst-1',
      name: 'Escola Modelo',
      subdomain: 'escola-modelo',
      active: true,
      account_id: 'acc-1',
    },
    {
      id: 'inst-2',
      name: 'Colégio Alpha',
      subdomain: null,
      active: true,
      account_id: 'acc-1',
    },
  ];

  it('permite que o ADMIN selecione uma instituição da sua conta e atualize o subdomínio', async () => {
    render(<AdminInstitutionSubdomainSection institutions={mockInstitutions} />);

    expect(screen.getByText('Gerenciamento de Subdomínio (Administrador)')).toBeTruthy();
    expect(screen.getByRole('combobox')).toBeTruthy();

    const input = screen.getByDisplayValue('escola-modelo') as HTMLInputElement;
    expect(input).toBeTruthy();

    fireEvent.change(input, { target: { value: 'escolamodelo' } });

    const submitBtn = screen.getByRole('button', { name: /Salvar subdomínio/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateInstitutionSubdomain).toHaveBeenCalledWith({
        institutionId: 'inst-1',
        subdomain: 'escolamodelo',
        profileId: 'admin-profile-1',
        userRole: 'ADMIN',
      });
      expect(
        screen.getByText(/Subdomínio atualizado com sucesso/i)
      ).toBeTruthy();
    });
  });
});
