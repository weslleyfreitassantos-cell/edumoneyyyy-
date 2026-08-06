// @vitest-environment jsdom

import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminInstitutionSubdomainSection } from './AdminInstitutionSubdomainSection';
import { updateInstitutionSubdomain } from '../../services/institutionService';

const mockRefresh = vi.fn();
let mockContextInstitution: {
  id: string;
  name: string;
  subdomain?: string | null;
  active: boolean | null;
  account_id: string | null;
} | null = {
  id: 'inst-1',
  name: 'Escola Modelo',
  subdomain: 'escola-modelo',
  active: true,
  account_id: 'acc-1',
};

vi.mock('../../contexts/InstitutionContext', () => ({
  useInstitution: () => ({
    currentInstitution: mockContextInstitution,
    refresh: mockRefresh,
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
    vi.clearAllMocks();
  });

  it('não possui select ou combobox e exibe a instituição atual do contexto em modo leitura', () => {
    render(<AdminInstitutionSubdomainSection />);

    expect(screen.getByText('Gerenciamento de Subdomínio (Administrador)')).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('select')).toBeNull();

    expect(screen.getByText('Instituição atual')).toBeTruthy();
    expect(screen.getByText('Escola Modelo')).toBeTruthy();
    expect(screen.getByText('Ativa')).toBeTruthy();
    expect(screen.getByText(/Para gerenciar outra instituição, selecione-a na seção Instituições/i)).toBeTruthy();
  });

  it('permite editar e salvar o subdomínio utilizando o ID da instituição atual do contexto', async () => {
    render(<AdminInstitutionSubdomainSection />);

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
      expect(screen.getByText(/Subdomínio atualizado com sucesso/i)).toBeTruthy();
    });
  });

  it('exibe mensagem orientativa e oculta formulário quando nenhuma instituição estiver selecionada', () => {
    render(<AdminInstitutionSubdomainSection institution={null} />);

    expect(screen.getByText('Nenhuma instituição selecionada.')).toBeTruthy();
    expect(
      screen.getByText(/Selecione uma instituição na seção Instituições para gerenciar seu subdomínio/i)
    ).toBeTruthy();

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /Salvar subdomínio/i })).toBeNull();
  });

  it('redefine o formulário e limpa mensagens ao trocar a instituição selecionada', () => {
    const { rerender } = render(
      <AdminInstitutionSubdomainSection
        institution={{
          id: 'inst-1',
          name: 'Escola Luz',
          subdomain: 'escolaluz',
          active: true,
          account_id: 'acc-1',
        }}
      />
    );

    expect(screen.getByText('Escola Luz')).toBeTruthy();
    expect(screen.getByDisplayValue('escolaluz')).toBeTruthy();

    // Rerender com a Escola TV selecionada
    rerender(
      <AdminInstitutionSubdomainSection
        institution={{
          id: 'inst-2',
          name: 'Escola TV',
          subdomain: 'escolatv',
          active: true,
          account_id: 'acc-1',
        }}
      />
    );

    expect(screen.getByText('Escola TV')).toBeTruthy();
    expect(screen.getByDisplayValue('escolatv')).toBeTruthy();
  });
});
