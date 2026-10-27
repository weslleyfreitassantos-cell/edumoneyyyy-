// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useCurrentInstitution: vi.fn(),
  listManagementCandidates: vi.fn(),
  registerProfessional: vi.fn(),
  verifyProfessional: vi.fn(),
}));
const { useAuth, useCurrentInstitution, listManagementCandidates, registerProfessional, verifyProfessional } = mocks;

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: mocks.useAuth }));
vi.mock('../../../hooks/useCurrentInstitution', () => ({ useCurrentInstitution: mocks.useCurrentInstitution }));
vi.mock('../../../services/psychologyService', () => ({
  psychologyErrorMessage: (error: unknown) => error instanceof Error ? error.message : 'Falha',
  psychologyService: {
    listManagementCandidates: mocks.listManagementCandidates,
    registerProfessional: mocks.registerProfessional,
    verifyProfessional: mocks.verifyProfessional,
  },
}));
vi.mock('./SchoolUsersTab', () => ({
  default: ({ onInviteComplete }: { onInviteComplete?: () => void }) => (
    <button type="button" onClick={onInviteComplete}>Convite concluído de teste</button>
  ),
}));

import PsychologistsTab from './PsychologistsTab';

const institutionId = '22222222-2222-4222-8222-222222222222';
const psychologist = {
  profile_id: '11111111-1111-4111-8111-111111111111',
  full_name: 'Dra. Ana Psicóloga',
  email: 'ana@escola.com',
  registered: true,
  verification_status: 'PENDING' as const,
  crp_registration: '03/12345',
  crp_state: 'BA',
  linked: false,
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ profile: { id: 'manager-profile' } });
  useCurrentInstitution.mockReturnValue({ data: institutionId, currentRole: 'DIRECTOR' });
  listManagementCandidates.mockResolvedValue({ professionals: [psychologist], students: [], page: 1, page_size: 100, total: 0, total_pages: 1, filters: { classes: [], grades: [] } });
  registerProfessional.mockResolvedValue({ profile_id: psychologist.profile_id, verification_status: 'PENDING' });
  verifyProfessional.mockResolvedValue(undefined);
});

describe('PsychologistsTab', () => {
  it.each(['ADMIN', 'SUPER_ADMIN'])('does not expose psychologist registration or CRP actions to %s without a school staff role', async (role) => {
    useCurrentInstitution.mockReturnValue({ data: institutionId, currentRole: role });
    render(<PsychologistsTab />);

    expect((await screen.findByRole('alert')).textContent).toMatch(/somente Diretor ou Secretaria/i);
    expect(screen.queryByRole('button', { name: /convite concluído/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Confirmar verificação humana/i })).toBeNull();
    expect(listManagementCandidates).not.toHaveBeenCalled();
  });

  it('mostra CRP pendente e permite editar e confirmar a verificação humana', async () => {
    render(<PsychologistsTab />);

    const row = await screen.findByRole('row', { name: /Dra\. Ana Psicóloga/ });
    expect(within(row).getByText('Pendente de verificação humana')).toBeTruthy();

    fireEvent.change(within(row).getByLabelText('CRP de Dra. Ana Psicóloga'), { target: { value: '03/54321' } });
    fireEvent.change(within(row).getByLabelText('UF do CRP de Dra. Ana Psicóloga'), { target: { value: 'SP' } });
    fireEvent.click(within(row).getByRole('button', { name: 'Salvar CRP de Dra. Ana Psicóloga' }));

    await waitFor(() => {
      expect(registerProfessional).toHaveBeenCalledWith(institutionId, psychologist.profile_id, '03/54321', 'SP');
    });

    fireEvent.click(within(row).getByRole('button', { name: 'Confirmar verificação humana' }));
    await waitFor(() => {
      expect(verifyProfessional).toHaveBeenCalledWith(institutionId, psychologist.profile_id);
    });
  });

  it('pesquisa psicólogos por nome e atualiza o registro após convite', async () => {
    listManagementCandidates.mockResolvedValue({
      professionals: [psychologist, { ...psychologist, profile_id: '33333333-3333-4333-8333-333333333333', full_name: 'Bruno Psicólogo', email: 'bruno@escola.com' }],
      students: [], page: 1, page_size: 100, total: 0, total_pages: 1, filters: { classes: [], grades: [] },
    });
    render(<PsychologistsTab />);
    await screen.findByText('Bruno Psicólogo');
    fireEvent.change(screen.getByRole('searchbox', { name: /Pesquisar psicólogo/ }), { target: { value: 'bruno' } });
    expect(screen.getByText('Bruno Psicólogo')).toBeTruthy();
    expect(screen.queryByText('Dra. Ana Psicóloga')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Convite concluído de teste' }));
    await waitFor(() => expect(listManagementCandidates).toHaveBeenCalledTimes(2));
  });
});
