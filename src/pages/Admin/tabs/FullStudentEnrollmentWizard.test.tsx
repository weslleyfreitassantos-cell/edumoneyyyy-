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
import { FullStudentEnrollmentError } from '../../../services/fullStudentEnrollmentService';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  editorData: null as unknown,
  findDuplicates: vi.fn(),
  registerInclusive: vi.fn(),
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

vi.mock('../../../services/inclusiveEducationService', () => ({
  registerStudentForInclusiveEducation: mocks.registerInclusive,
}));

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

async function advanceToReview() {
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

  fireEvent.change(screen.getByLabelText('Origem'), {
    target: { value: 'new' },
  });
  await waitFor(() => expect(screen.getByLabelText('Nome completo *')).toBeTruthy());
  fireEvent.change(screen.getByLabelText('Nome completo *'), {
    target: { value: 'Responsável Novo' },
  });
  fireEvent.change(screen.getByLabelText('E-mail *'), {
    target: { value: 'responsavel@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Parentesco *'), {
    target: { value: 'Mãe' },
  });

  for (let index = 2; index < 7; index += 1) {
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(screen.getByText(`Etapa ${index + 2} de 8`)).toBeTruthy());
  }
}

async function advanceToDocuments() {
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
  fireEvent.change(screen.getByLabelText('Responsável'), {
    target: { value: 'guardian-profile' },
  });
  fireEvent.change(screen.getByLabelText('Parentesco *'), {
    target: { value: 'Mãe' },
  });
  for (let index = 2; index < 5; index += 1) {
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(screen.getByText(`Etapa ${index + 2} de 8`)).toBeTruthy());
  }
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
    mocks.registerInclusive.mockReset();
    mocks.registerInclusive.mockResolvedValue({ registered: true, created: true, plan_id: 'pei-1' });
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
      expect(screen.getByText('Possíveis duplicidades')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Usar este cadastro' }));
    expect(mocks.useExisting).toHaveBeenCalledWith('student-1');
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('deixa documentos não solicitados por padrão e exige justificativa para rejeição/dispensa', async () => {
    renderWizard();
    await advanceToDocuments();

    const status = screen.getByLabelText('Status de Certidao de nascimento') as HTMLSelectElement;
    expect(status.value).toBe('NOT_REQUESTED');
    fireEvent.change(status, { target: { value: 'REJECTED' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Informe uma justificativa para o documento “Certidao de nascimento”.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Observação de Certidao de nascimento'), {
      target: { value: 'Documento ilegível; solicitar nova cópia.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Etapa 7 de 8')).toBeTruthy();
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

    fireEvent.change(screen.getByLabelText('Responsável'), {
      target: { value: 'guardian-profile' },
    });
    fireEvent.change(screen.getByLabelText('Parentesco *'), {
      target: { value: 'Mãe' },
    });
    for (let index = 2; index < 4; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      await waitFor(() => expect(screen.getByText(`Etapa ${index + 2} de 8`)).toBeTruthy());
    }

    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar aluno na Educação Inclusiva' }));
    for (let index = 4; index < 7; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      await waitFor(() => expect(screen.getByText(`Etapa ${index + 2} de 8`)).toBeTruthy());
    }

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar matrícula' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(mocks.create.mock.calls[0][0].institutionId).toBe('institution-1');
    await waitFor(() => expect(mocks.registerInclusive).toHaveBeenCalledWith('institution-1', 'student-1'));
  });

  it('mostra a causa da falha e reutiliza os registros preservados ao tentar novamente', async () => {
    mocks.findDuplicates.mockResolvedValue([]);
    mocks.create
      .mockRejectedValueOnce(new FullStudentEnrollmentError(
        'A turma selecionada atingiu a capacidade.',
        {
          studentId: 'student-created',
          guardianProfileIds: { 0: 'guardian-created' },
        },
      ))
      .mockResolvedValueOnce({
        student_id: 'student-created',
        enrollment_id: 'enrollment-created',
        guardian_profile_ids: ['guardian-created'],
        documents_pending: 10,
        email_pending: false,
      });

    renderWizard();
    await advanceToReview();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar matrícula' }));
    expect(await screen.findByText(/A turma selecionada atingiu a capacidade\./)).toBeTruthy();
    expect(screen.getByText(/registros já criados foram preservados/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar matrícula' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.create.mock.calls[1][0]).toMatchObject({
      existingStudentId: 'student-created',
      draft: { guardians: [{ profile_id: 'guardian-created' }] },
    });
  });

  it('nao afirma que houve cadastro parcial quando nenhum registro foi preservado', async () => {
    mocks.findDuplicates.mockResolvedValue([]);
    mocks.create.mockRejectedValue(new FullStudentEnrollmentError(
      'Ja existe um usuario cadastrado com este e-mail.',
    ));

    renderWizard();
    await advanceToReview();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar matrícula' }));

    expect(await screen.findByText('Ja existe um usuario cadastrado com este e-mail.')).toBeTruthy();
    expect(screen.queryByText(/registros já criados foram preservados/)).toBeNull();
  });

  it('permite matricular aluno existente sem e-mail e não cria nem altera seu acesso', async () => {
    mocks.editorData = {
      studentId: 'student-existing',
      enrollmentId: null,
      draft: {
        identity: {
          full_name: 'Aluno sem e-mail',
          email: '',
          birth_date: '2016-01-01',
          cpf: '',
          social_name: '',
          rg: '',
          rg_issuing_authority: '',
          rg_state: '',
          birth_certificate: '',
          nationality: 'Brasileira',
          birthplace: '',
          birth_state: '',
          sex: '',
          phone: '',
        },
        address: { postal_code: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', rural_zone: false },
        guardians: [{ mode: 'existing', profile_id: 'guardian-profile', full_name: 'Maria Silva', email: 'maria@example.com', phone: '', relationship: 'Mãe', is_primary: true }],
        previous_schooling: { origin_school: '', origin_network: '', city: '', state: '', last_grade: '', origin_year: '', status: '', observations: '', history_delivered: false, transfer_declaration: false },
        health: { allergies: '', health_conditions: '', emergency_medication: '', disability: '', autism: false, giftedness: false, needs_special_education: false, school_care_notes: '' },
        documents: [],
        academic_year_id: 'year-1',
        class_id: 'class-1',
        enrolled_at: '2026-01-01',
      },
    };
    mocks.create.mockResolvedValue({
      student_id: 'student-existing',
      enrollment_id: 'enrollment-new',
      guardian_profile_ids: ['guardian-profile'],
      documents_pending: 0,
      email_pending: false,
    });

    render(
      <FullStudentEnrollmentWizard
        institutionId="institution-1"
        years={years}
        classes={classes}
        mode="enroll"
        studentId="student-existing"
        onClose={vi.fn()}
        onCompleted={vi.fn()}
      />,
    );

    expect(await screen.findByDisplayValue('Aluno sem e-mail')).toBeTruthy();
    expect(screen.getByLabelText(/^E-mail do aluno \(opcional\)/)).toBeTruthy();
    for (let index = 0; index < 7; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      await waitFor(() => expect(screen.getByText(`Etapa ${index + 2} de 8`)).toBeTruthy());
    }

    expect(screen.getByText(/Nenhum acesso será criado nem alterado/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar matrícula' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      institutionId: 'institution-1',
      existingStudentId: 'student-existing',
      draft: expect.objectContaining({ identity: expect.objectContaining({ email: '' }) }),
    })));
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
          relationship: 'Mãe',
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

    for (let index = 0; index < 4; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      await waitFor(() => expect(screen.getByText(`Etapa ${index + 2} de 8`)).toBeTruthy());
    }

    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar aluno na Educação Inclusiva' }));
    for (let index = 4; index < 7; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      await waitFor(() => expect(screen.getByText(`Etapa ${index + 2} de 8`)).toBeTruthy());
    }

    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.registerInclusive).toHaveBeenCalledWith('institution-1', 'student-1'));
    expect(mocks.update.mock.calls[0][0]).toMatchObject({
      institutionId: 'institution-1',
      studentId: 'student-1',
      enrollmentId: 'enrollment-1',
    });
  });
});
