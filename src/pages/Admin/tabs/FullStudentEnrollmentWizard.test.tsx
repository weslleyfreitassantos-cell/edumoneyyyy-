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
  update: vi.fn(),
  editorData: null as unknown,
  findDuplicates: vi.fn(),
  useExisting: vi.fn(),
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
  useStudentEditorData: () => ({
    data: mocks.editorData,
    isLoading: false,
    isError: false,
    error: null,
  }),
  useUpdateFullStudentEnrollment: () => ({
    mutateAsync: mocks.update,
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
      onUseExistingStudent={mocks.useExisting}
    />,
  );
}

describe('FullStudentEnrollmentWizard', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.create.mockReset();
    mocks.update.mockReset();
    mocks.editorData = null;
    mocks.findDuplicates.mockReset();
    mocks.useExisting.mockReset();
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
    fireEvent.click(screen.getByRole('button', { name: 'Usar este cadastro' }));
    expect(mocks.useExisting).toHaveBeenCalledWith('student-1');
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

  it('carrega e salva todos os dados no modo de edicao', async () => {
    mocks.editorData = {
      studentId: 'student-1',
      enrollmentId: 'enrollment-1',
      draft: {
        identity: {
          full_name: 'Aluno Completo',
          email: 'aluno@example.com',
          birth_date: '2016-01-01',
          cpf: '12345678901',
          social_name: 'Alu',
          rg: '123',
          rg_issuing_authority: 'SSP',
          rg_state: 'BA',
          birth_certificate: 'CERT-1',
          nationality: 'Brasileira',
          birthplace: 'Salvador',
          birth_state: 'BA',
          sex: 'O',
          phone: '71999999999',
        },
        address: {
          postal_code: '40000000',
          street: 'Rua A',
          number: '10',
          complement: '',
          neighborhood: 'Centro',
          city: 'Salvador',
          state: 'BA',
          rural_zone: false,
        },
        guardians: [{
          mode: 'existing',
          profile_id: 'guardian-profile',
          full_name: 'Maria Silva',
          email: 'maria@example.com',
          phone: '',
          relationship: 'Mae',
          is_primary: true,
        }],
        previous_schooling: {
          origin_school: '',
          origin_network: '',
          city: '',
          state: '',
          last_grade: '',
          origin_year: '',
          status: '',
          observations: '',
          history_delivered: false,
          transfer_declaration: false,
        },
        health: {
          allergies: '',
          health_conditions: '',
          emergency_medication: '',
          disability: '',
          autism: false,
          giftedness: false,
          needs_special_education: false,
          school_care_notes: '',
        },
        documents: [{
          document_type: 'RG',
          status: 'PENDING',
          notes: '',
        }],
        academic_year_id: 'year-1',
        class_id: 'class-1',
        enrolled_at: '2026-01-01',
      },
    };
    mocks.update.mockResolvedValue(undefined);

    render(
      <FullStudentEnrollmentWizard
        institutionId="institution-1"
        years={years}
        classes={classes}
        mode="edit"
        studentId="student-1"
        onClose={vi.fn()}
        onCompleted={vi.fn()}
        onUseExistingStudent={mocks.useExisting}
      />,
    );

    expect(await screen.findByDisplayValue('Aluno Completo')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Nome social'), {
      target: { value: 'Aluno Social' },
    });

    for (let index = 0; index < 7; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      await waitFor(() => expect(screen.getByText(`Etapa ${index + 2} de 8`)).toBeTruthy());
    }

    fireEvent.click(screen.getByRole('button', { name: 'Salvar alteracoes' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(mocks.update.mock.calls[0][0]).toMatchObject({
      institutionId: 'institution-1',
      studentId: 'student-1',
      enrollmentId: 'enrollment-1',
    });
  });
});
