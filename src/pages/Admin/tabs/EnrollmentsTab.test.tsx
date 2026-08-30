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

import EnrollmentsTab from './EnrollmentsTab';
import type { EnrollmentRow } from '../../../services/enrollmentService';

const mocks = vi.hoisted(() => ({
  createEnrollment: vi.fn(),
  updateEnrollment: vi.fn(),
  manageSchoolUser: vi.fn(),
  updateFullStudentEnrollment: vi.fn(),
  enrollments: [] as EnrollmentRow[],
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: {
      id: 'admin-profile',
      full_name: 'Admin',
      email: 'admin@example.com',
      role: 'ADMIN',
      platform_role: 'USER',
      avatar_url: null,
    },
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

vi.mock('../../../hooks/useAcademicStructure', () => ({
  useAcademicYears: () => ({
    data: [
      {
        id: '00000000-0000-0000-0000-000000000002',
        institution_id: '00000000-0000-0000-0000-000000000001',
        name: '2026',
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        active: true,
      },
    ],
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

vi.mock('../../../hooks/useClasses', () => ({
  useClasses: () => ({
    data: [
      {
        id: '00000000-0000-0000-0000-000000000003',
        institution_id: '00000000-0000-0000-0000-000000000001',
        academic_year_id: '00000000-0000-0000-0000-000000000002',
        name: 'Sala 1',
        grade_level: '4º',
        shift: 'Matutino',
        capacity: 30,
        active_enrollments_count: 0,
        active: true,
      },
    ],
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
          avatar_url: null,
        },
      },
    ],
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

vi.mock('../../../hooks/useEnrollments', () => ({
  useEnrollments: () => ({
    data: mocks.enrollments,
    isLoading: false,
    isError: false,
    error: null,
  }),
  useCreateEnrollment: () => ({
    mutateAsync: mocks.createEnrollment,
    isPending: false,
  }),
  useTransferEnrollment: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    variables: undefined,
  }),
  useUpdateEnrollment: () => ({
    mutateAsync: mocks.updateEnrollment,
    isPending: false,
    variables: undefined,
  }),
  useUpdateEnrollmentStatus: () => ({
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
      {
        id: 'membership-inactive-guardian',
        profile_id: 'inactive-guardian-profile',
        institution_id: '00000000-0000-0000-0000-000000000001',
        role: 'GUARDIAN',
        active: false,
        profile: {
          full_name: 'Responsável inativo',
          email: 'inactive@example.com',
          active: false,
        },
      },
      {
        id: 'membership-teacher',
        profile_id: 'teacher-profile',
        institution_id: '00000000-0000-0000-0000-000000000001',
        role: 'TEACHER',
        active: true,
        profile: {
          full_name: 'Professor',
          email: 'teacher@example.com',
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
    mutateAsync: mocks.manageSchoolUser,
    isPending: false,
  }),
}));

vi.mock('../../../hooks/useFullStudentEnrollment', () => ({
  useCreateFullStudentEnrollment: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useStudentEditorData: () => ({
    data: null,
    isLoading: false,
    isError: false,
    error: null,
  }),
  useUpdateFullStudentEnrollment: () => ({
    mutateAsync: mocks.updateFullStudentEnrollment,
    isPending: false,
  }),
}));

function openEnrollmentModal(): void {
  fireEvent.click(
    screen.getByRole('button', {
      name: '+ Nova matrícula',
    }),
  );
  fireEvent.click(
    screen.getByRole('button', {
      name: /Aluno ja cadastrado/,
    }),
  );
}

async function createEnrollment(): Promise<void> {
  openEnrollmentModal();

  fireEvent.change(
    screen.getByLabelText('Aluno'),
    { target: { value: '00000000-0000-0000-0000-000000000004' } },
  );
  fireEvent.change(
    document.getElementById('enrollment-year') as HTMLSelectElement,
    { target: { value: '00000000-0000-0000-0000-000000000002' } },
  );
  fireEvent.change(
    document.getElementById('enrollment-class') as HTMLSelectElement,
    { target: { value: '00000000-0000-0000-0000-000000000003' } },
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Salvar' }),
  );

  await waitFor(() => {
    expect(mocks.createEnrollment).toHaveBeenCalledTimes(1);
  });
}

function clickGuardianLinkButton(): void {
  const buttons = screen.getAllByRole('button', {
    name: 'Vincular responsável',
  });
  fireEvent.click(buttons[buttons.length - 1]);
}

describe('EnrollmentsTab - vínculo de responsável após matrícula', () => {
  beforeEach(() => {
    mocks.enrollments = [];
    mocks.createEnrollment.mockResolvedValue({
      id: 'enrollment-1',
    });
    mocks.manageSchoolUser.mockResolvedValue({
      success: true,
      action: 'link_guardian',
      membershipId: 'membership-guardian',
      profileId: '00000000-0000-0000-0000-000000000005',
      guardianshipId: 'guardianship-1',
      message: 'Responsável vinculado ao aluno com sucesso.',
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('oferece a escolha entre aluno existente e aluno novo', () => {
    render(<EnrollmentsTab />);
    fireEvent.click(
      screen.getByRole('button', {
        name: /Nova matr/,
      }),
    );

    expect(screen.getByRole('button', { name: /Aluno ja cadastrado/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Aluno novo/ }));
    expect(screen.getByRole('dialog', { name: 'Matricula completa de aluno' })).toBeTruthy();
  });

  it('permite selecionar e vincular responsavel na mesma janela da matricula', async () => {
    render(<EnrollmentsTab />);
    openEnrollmentModal();

    fireEvent.change(
      screen.getByLabelText('Aluno'),
      { target: { value: '00000000-0000-0000-0000-000000000004' } },
    );
    fireEvent.change(
      screen.getByLabelText('Responsável'),
      { target: { value: '00000000-0000-0000-0000-000000000005' } },
    );
    fireEvent.change(
      screen.getByLabelText('Parentesco'),
      { target: { value: 'Mãe' } },
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Salvar' }),
    );

    await waitFor(() => {
      expect(mocks.manageSchoolUser).toHaveBeenCalledWith({
        action: 'link_guardian',
        institutionId: '00000000-0000-0000-0000-000000000001',
        guardianProfileId: '00000000-0000-0000-0000-000000000005',
        studentId: '00000000-0000-0000-0000-000000000004',
        relationship: 'Mãe',
        isPrimary: false,
      });
    });
    expect(
      screen.getByText(
        'Matrícula e responsável vinculados com sucesso.',
      ),
    ).toBeTruthy();
  });

  it('permite vincular responsavel em uma matricula ja existente', async () => {
    mocks.enrollments = [
      {
        id: 'enrollment-existing',
        student_id: '00000000-0000-0000-0000-000000000004',
        class_id: '00000000-0000-0000-0000-000000000003',
        academic_year_id: '00000000-0000-0000-0000-000000000002',
        status: 'ACTIVE',
        status_label: 'Ativa',
        active: true,
        student_name: 'Ieti',
        student_registration_number: '20260001',
        student_active: true,
        class_name: 'Sala 1',
        class_grade_level: '4º',
        class_shift: 'Matutino',
        class_capacity: 30,
        class_active: true,
        academic_year_name: '2026',
        active_enrollments_in_class: 1,
        has_capacity_available: true,
      },
    ];

    render(<EnrollmentsTab />);
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
      { target: { value: 'Pai' } },
    );
    fireEvent.click(
      screen
        .getByRole('dialog', {
          name: 'Vincular responsável',
        })
        .querySelector('button[type="submit"]') as HTMLButtonElement,
    );

    await waitFor(() => {
      expect(mocks.manageSchoolUser).toHaveBeenCalledWith({
        action: 'link_guardian',
        institutionId: '00000000-0000-0000-0000-000000000001',
        guardianProfileId: '00000000-0000-0000-0000-000000000005',
        studentId: '00000000-0000-0000-0000-000000000004',
        relationship: 'Pai',
        isPrimary: false,
      });
    });
  });

  it('abre o editor completo do aluno a partir da matrícula ativa', async () => {
    mocks.enrollments = [
      {
        id: 'enrollment-existing',
        student_id: '00000000-0000-0000-0000-000000000004',
        class_id: '00000000-0000-0000-0000-000000000003',
        academic_year_id: '00000000-0000-0000-0000-000000000002',
        status: 'ACTIVE',
        status_label: 'Ativa',
        active: true,
        student_name: 'Ieti',
        student_registration_number: '20260001',
        student_active: true,
        class_name: 'Sala 1',
        class_grade_level: '4º',
        class_shift: 'Matutino',
        class_capacity: 30,
        class_active: true,
        academic_year_name: '2026',
        active_enrollments_in_class: 1,
        has_capacity_available: true,
      },
    ];
    mocks.updateEnrollment.mockResolvedValueOnce(undefined);

    render(<EnrollmentsTab />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Editar' }),
    );

    expect(
      screen.getByRole('heading', {
        name: 'Editar cadastro completo',
      }),
    ).toBeTruthy();
    expect(mocks.updateEnrollment).not.toHaveBeenCalled();
  });

  it('cria a matrícula sem inserir dados de responsável', async () => {
    render(<EnrollmentsTab />);

    await createEnrollment();

    expect(mocks.createEnrollment).toHaveBeenCalledWith({
      institution_id: '00000000-0000-0000-0000-000000000001',
      student_id: '00000000-0000-0000-0000-000000000004',
      academic_year_id: '00000000-0000-0000-0000-000000000002',
      class_id: '00000000-0000-0000-0000-000000000003',
      status: 'ACTIVE',
      active: true,
    });
    expect(
      screen.getByText('Matrícula criada com sucesso.'),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Vincular responsável',
      }),
    ).toBeTruthy();
  });

  it('abre o vínculo com o aluno recém-matriculado e lista apenas responsáveis ativos', async () => {
    render(<EnrollmentsTab />);
    await createEnrollment();

    clickGuardianLinkButton();

    expect(
      screen.getByRole('dialog', {
        name: 'Vincular responsável',
      }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole('dialog', {
          name: 'Vincular responsável',
        })
        .textContent,
    ).toContain('Aluno: Ieti');
    expect(screen.getByRole('option', { name: /Maria Silva/ })).toBeTruthy();
    expect(
      screen.queryByRole('option', {
        name: /Responsável inativo/,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('option', { name: /Professor/ }),
    ).toBeNull();
  });

  it('exige parentesco antes de chamar a operação de vínculo', async () => {
    render(<EnrollmentsTab />);
    await createEnrollment();

    clickGuardianLinkButton();
    fireEvent.change(
      screen.getByLabelText('Responsável existente'),
      { target: { value: '00000000-0000-0000-0000-000000000005' } },
    );
    fireEvent.submit(
      screen.getByRole('dialog', {
        name: 'Vincular responsável',
      }).querySelector('form') as HTMLFormElement,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('alert', {
          name: '',
        }).textContent,
      ).toContain('Parentesco é obrigatório');
    });
    expect(mocks.manageSchoolUser).not.toHaveBeenCalled();
  });

  it('envia o vínculo pelo fluxo de gestão e atualiza a tela sem recarregar', async () => {
    render(<EnrollmentsTab />);
    await createEnrollment();

    clickGuardianLinkButton();
    fireEvent.change(
      screen.getByLabelText('Responsável existente'),
      { target: { value: '00000000-0000-0000-0000-000000000005' } },
    );
    fireEvent.change(
      screen.getByLabelText('Parentesco'),
      { target: { value: 'Mãe' } },
    );
    fireEvent.click(
      screen.getByLabelText('Responsável principal'),
    );
    clickGuardianLinkButton();

    await waitFor(() => {
      expect(mocks.manageSchoolUser).toHaveBeenCalledWith({
        action: 'link_guardian',
        institutionId: '00000000-0000-0000-0000-000000000001',
        guardianProfileId: '00000000-0000-0000-0000-000000000005',
        studentId: '00000000-0000-0000-0000-000000000004',
        relationship: 'Mãe',
        isPrimary: true,
      });
    });
    expect(
      screen.getByText(
        'Responsável vinculado ao aluno com sucesso.',
      ),
    ).toBeTruthy();
    expect(
      screen.queryByRole('dialog', {
        name: 'Vincular responsável',
      }),
    ).toBeNull();
  });

  it('preserva a matrícula e permite tentar novamente quando o vínculo falha', async () => {
    mocks.manageSchoolUser.mockRejectedValueOnce(
      new Error('Este responsável já está vinculado a este aluno.'),
    );
    render(<EnrollmentsTab />);
    await createEnrollment();

    clickGuardianLinkButton();
    fireEvent.change(
      screen.getByLabelText('Responsável existente'),
      { target: { value: '00000000-0000-0000-0000-000000000005' } },
    );
    fireEvent.change(
      screen.getByLabelText('Parentesco'),
      { target: { value: 'Pai' } },
    );
    clickGuardianLinkButton();

    await waitFor(() => {
      expect(
        screen.getByText(
          'Este responsável já está vinculado a este aluno.',
        ),
      ).toBeTruthy();
    });
    expect(
      screen.getByText('Matrícula criada com sucesso.'),
    ).toBeTruthy();
    expect(
      screen.getByRole('dialog', {
        name: 'Vincular responsável',
      }),
    ).toBeTruthy();
    expect(mocks.createEnrollment).toHaveBeenCalledTimes(1);
  });

  it('permite concluir sem criar vínculo', async () => {
    render(<EnrollmentsTab />);
    await createEnrollment();

    fireEvent.click(
      screen.getByRole('button', { name: 'Concluir' }),
    );

    expect(
      screen.queryByText('Matrícula criada com sucesso.'),
    ).toBeNull();
    expect(mocks.manageSchoolUser).not.toHaveBeenCalled();
  });
});
