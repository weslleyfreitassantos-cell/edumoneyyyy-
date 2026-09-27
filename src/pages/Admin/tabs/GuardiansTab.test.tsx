// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import GuardiansTab from './GuardiansTab';

const mocks = vi.hoisted(() => ({
  mutateGuardian: vi.fn(),
  guardians: [] as Array<Record<string, unknown>>,
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { id: 'director-profile' } }),
}));

vi.mock('../../../hooks/useCurrentInstitution', () => ({
  useCurrentInstitution: () => ({ data: 'institution-1', isLoading: false, isError: false }),
}));

vi.mock('../../../hooks/useGuardians', () => ({
  useCreateGuardian: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useGuardians: () => ({ data: mocks.guardians, isLoading: false, isError: false }),
  useSetGuardianshipActive: () => ({
    mutateAsync: mocks.mutateGuardian,
    isPending: false,
    variables: undefined,
  }),
}));

vi.mock('../../../hooks/useStudents', () => ({
  useStudents: () => ({ data: [], isLoading: false, isError: false }),
}));

const guardian = {
  id: 'guardian-profile-1',
  guardian_profile_id: 'guardian-profile-1',
  full_name: 'Responsável QA',
  email: 'guardian.qa@example.test',
  profile_active: true,
  active_links_count: 1,
  links: [{
    id: 'guardianship-1',
    student_id: 'student-1',
    student_name: 'Aluno QA',
    registration_number: 'QA-001',
    relationship: 'Responsável legal',
    is_primary: true,
    active: true,
  }],
};

describe('GuardiansTab', () => {
  beforeEach(() => {
    mocks.guardians = [guardian];
    mocks.mutateGuardian.mockReset().mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it('confirma e executa a desativação com a instituição e o vínculo corretos', async () => {
    render(<GuardiansTab />);

    fireEvent.click(screen.getByRole('button', { name: 'Desativar vínculo' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar desativação' }));

    await waitFor(() => {
      expect(mocks.mutateGuardian).toHaveBeenCalledWith({
        id: 'guardianship-1',
        institutionId: 'institution-1',
        active: false,
      });
    });
    expect((await screen.findByRole('status')).textContent).toContain('Vínculo desativado.');
  });

  it('confirma reativação de um vínculo inativo', async () => {
    mocks.guardians = [{
      ...guardian,
      active_links_count: 0,
      links: guardian.links.map((link) => ({ ...link, active: false })),
    }];
    render(<GuardiansTab />);

    fireEvent.click(screen.getByRole('button', { name: 'Reativar vínculo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reativação' }));

    await waitFor(() => {
      expect(mocks.mutateGuardian).toHaveBeenCalledWith({
        id: 'guardianship-1',
        institutionId: 'institution-1',
        active: true,
      });
    });
    expect((await screen.findByRole('status')).textContent).toContain('Vínculo reativado.');
  });

  it('não chama a mutation quando a confirmação é cancelada', () => {
    render(<GuardiansTab />);

    fireEvent.click(screen.getByRole('button', { name: 'Desativar vínculo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(mocks.mutateGuardian).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('mostra erro em vez de feedback de sucesso quando a persistência falha', async () => {
    mocks.mutateGuardian.mockRejectedValueOnce(
      new Error('O vínculo não foi atualizado. Verifique sua permissão e tente novamente.'),
    );
    render(<GuardiansTab />);

    fireEvent.click(screen.getByRole('button', { name: 'Desativar vínculo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar desativação' }));

    expect((await screen.findByRole('alert')).textContent).toContain('O vínculo não foi atualizado.');
    expect(screen.queryByText('Vínculo desativado.')).toBeNull();
  });
});
