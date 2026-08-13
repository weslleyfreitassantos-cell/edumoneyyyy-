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
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import StudentsTab from './StudentsTab';

const manageSchoolUser = vi.fn();

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: { id: 'admin-profile' },
  }),
}));

vi.mock('../../../hooks/useCurrentInstitution', () => ({
  useCurrentInstitution: () => ({
    data: '00000000-0000-0000-0000-000000000001',
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

vi.mock('../../../hooks/useStudents', () => ({
  useStudents: () => ({
    data: [
      {
        id: '00000000-0000-0000-0000-000000000004',
        profile_id: 'student-profile',
        institution_id: '00000000-0000-0000-0000-000000000001',
        registration_number: '20260001',
        birth_date: '2016-01-01',
        cpf: null,
        active: true,
        profiles: {
          full_name: 'Ieti',
          email: 'ieti@example.com',
          active: true,
          avatar_url: null,
        },
      },
    ],
    isLoading: false,
    isError: false,
    error: null,
  }),
  useCreateStudent: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUpdateStudent: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useSetStudentActive: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    variables: undefined,
  }),
}));

vi.mock('../../../hooks/useSchoolUsers', () => ({
  useSchoolUsers: () => ({
    data: [
      {
        id: 'membership-guardian',
        profile_id: '00000000-0000-0000-0000-000000000005',
        institution_id: '00000000-0000-0000-0000-000000000001',
        role: 'GUARDIAN',
        active: true,
        profile: {
          full_name: 'Maria Silva',
          email: 'maria@example.com',
          active: true,
        },
      },
    ],
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

vi.mock('../../../hooks/useSchoolUserManagement', () => ({
  useManageSchoolUser: () => ({
    mutateAsync: manageSchoolUser,
    isPending: false,
  }),
}));

describe('StudentsTab - vínculo de responsável', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('permite associar um responsável a um aluno já cadastrado', async () => {
    manageSchoolUser.mockResolvedValueOnce({
      success: true,
      action: 'link_guardian',
      membershipId: 'membership-guardian',
      profileId: '00000000-0000-0000-0000-000000000005',
      guardianshipId: 'guardianship-1',
      message: 'Responsável vinculado ao aluno com sucesso.',
    });

    render(<StudentsTab />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Vincular responsável',
      }),
    );
    fireEvent.change(
      screen.getByLabelText('Responsável existente'),
      { target: { value: '00000000-0000-0000-0000-000000000005' } },
    );
    fireEvent.change(
      screen.getByLabelText('Parentesco'),
      { target: { value: 'Mãe' } },
    );
    fireEvent.click(
      screen.getByRole('dialog').querySelector(
        'button[type="submit"]',
      ) as HTMLButtonElement,
    );

    await waitFor(() => {
      expect(manageSchoolUser).toHaveBeenCalledWith({
        action: 'link_guardian',
        institutionId:
          '00000000-0000-0000-0000-000000000001',
        guardianProfileId:
          '00000000-0000-0000-0000-000000000005',
        studentId:
          '00000000-0000-0000-0000-000000000004',
        relationship: 'Mãe',
        isPrimary: false,
      });
    });

    expect(
      screen.getByText(
        'Responsável vinculado ao aluno com sucesso.',
      ),
    ).toBeTruthy();
  });
});
