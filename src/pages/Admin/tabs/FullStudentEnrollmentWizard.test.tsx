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

import FullStudentEnrollmentWizard from './FullStudentEnrollmentWizard';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findDuplicates: vi.fn(),
}));

vi.mock('../../../hooks/useSchoolUsers', () => ({
  useSchoolUsers: () => ({
    data: [
      {
        id: 'guardian-membership',
        profile_id: 'guardian-profile',
        institution_id: 'institution-1',
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
  }),
}));

vi.mock('../../../hooks/useFullStudentEnrollment', () => ({
  useCreateFullStudentEnrollment: () => ({
    mutateAsync: mocks.create,
    isPending: false,
  }),
}));

vi.mock('../../../services/fullStudentEnrollmentService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/fullStudentEnrollmentService')>(
    '../../../services/fullStudentEnrollmentService',
  );
  return {
    ...actual,
    findDuplicateStudentCandidates: mocks.findDuplicates,
  };
});

const years = [
  {
    id: 'year-1',
    institution_id: 'institution-1',
    name: '2026',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    active: true,
    terms: [],
  },
];

const classes = [
  {
    id: 'class-1',
    institution_id: 'institution-1',
    academic_year_id: 'year-1',
    academic_year_name: '2026',
    name: 'Sala 1',
    grade_level: '4o',
    shift: 'Matutino',
    capacity: 30,
    active: true,
    active_enrollments_count: 0,
    active_offerings_count: 0,
    active_curriculum_items_count: 0,
  },
];

function renderWizard() {
  return render(
    <FullStudentEnrollmentWizard
      institutionId="institution-1"
      years={years}
      classes={classes}
      onClose={vi.fn()}
      onCompleted={vi.fn()}
    />,
  );
}

describe('FullStudentEnrollmentWizard', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.create.mockReset();
    mocks.findDuplicates.mockReset();
    mocks.findDuplicates.mockResolvedValue([]);
  });

  it('detecta possivel duplicidade antes de avancar', async () => {
    mocks.findDuplicates.mockResolvedValue([
      {
        id: 'student-1',
        full_name: 'Aluno Existente',
        email: 'aluno@example.com',
        birth_date: '2016-01-01',
        cpf: null,
        registration_number: '20260001',
      },
    ]);
    renderWizard();

    fireEvent.change(screen.getByLabelText('Nome completo *'), {
      target: { value: 'Aluno Novo' },
    });
    fireEvent.change(screen.getByLabelText('E-mail *'), {
      target: { value: 'novo@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Data de nascimento *'), {
      target: { value: '2016-01-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    await waitFor(() => {
      expect(screen.getByText('Possiveis duplicidades')).toBeTruthy();
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('percorre as oito etapas e confirma a matricula', async () => {
    mocks.findDuplicates.mockResolvedValue([]);
    mocks.create.mockResolvedValue({
      student_id: 'student-1',
      enrollment_id: 'enrollment-1',
      guardian_profile_ids: ['guardian-profile'],
      documents_pending: 9,
    });
    renderWizard();

    fireEvent.change(screen.getByLabelText('Nome completo *'), {
      target: { value: 'Aluno Novo' },
    });
    fireEvent.change(screen.getByLabelText('E-mail *'), {
      target: { value: 'novo@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Data de nascimento *'), {
      target: { value: '2016-01-01' },
    });
    for (let index = 0; index < 2; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      await waitFor(() => expect(screen.getByText(`Etapa ${index + 2} de 8`)).toBeTruthy());
    }

    fireEvent.change(screen.getByLabelText('Responsavel'), {
      target: { value: 'guardian-profile' },
    });
    fireEvent.change(screen.getByLabelText('Parentesco *'), {
      target: { value: 'Mae' },
    });
    for (let index = 2; index < 7; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      await waitFor(() => expect(screen.getByText(`Etapa ${index + 2} de 8`)).toBeTruthy());
    }

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar matricula' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(mocks.create.mock.calls[0][0].institutionId).toBe('institution-1');
  });
});
