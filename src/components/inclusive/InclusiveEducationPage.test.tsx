// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { pedagogicalMonitoringService } from '../../services/pedagogicalMonitoringService';
import {
  listInclusiveAeePlans,
  listInclusiveAeeSessions,
  listInclusivePeiPlans,
  listInclusiveProgressStudents,
  listInclusiveStudents,
  saveInclusiveAeePlan,
  saveInclusiveAeeSession,
  saveInclusivePeiPlan,
  type InclusiveAeePlan,
  type InclusiveAeeSession,
  type InclusivePeiPlan,
} from '../../services/inclusiveEducationService';
import InclusiveEducationPage from './InclusiveEducationPage';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../contexts/InstitutionContext', () => ({ useInstitution: vi.fn(), useOptionalInstitution: () => null }));

vi.mock('../../services/inclusiveEducationService', () => ({
  INCLUSIVE_EDUCATION_DATA_ENABLED: true,
  listInclusiveAeePlans: vi.fn(),
  listInclusiveAeeSessions: vi.fn(),
  listInclusivePeiPlans: vi.fn(),
  listInclusiveProgressStudents: vi.fn(),
  listInclusiveStudents: vi.fn(),
  printInclusiveDocument: vi.fn(),
  saveInclusiveAeePlan: vi.fn(),
  saveInclusiveAeeSession: vi.fn(),
  saveInclusivePeiPlan: vi.fn(),
}));

vi.mock('../../services/pedagogicalMonitoringService', () => ({
  pedagogicalMonitoringService: {
    getInstitutionMonitoring: vi.fn(),
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseInstitution = vi.mocked(useInstitution);
const mockedListStudents = vi.mocked(listInclusiveStudents);
const mockedListProgressStudents = vi.mocked(listInclusiveProgressStudents);
const mockedListPei = vi.mocked(listInclusivePeiPlans);
const mockedListAee = vi.mocked(listInclusiveAeePlans);
const mockedListAeeSessions = vi.mocked(listInclusiveAeeSessions);
const mockedSavePei = vi.mocked(saveInclusivePeiPlan);
const mockedSaveAee = vi.mocked(saveInclusiveAeePlan);
const mockedSaveAeeSession = vi.mocked(saveInclusiveAeeSession);
const mockedGetInstitutionMonitoring = vi.mocked(pedagogicalMonitoringService.getInstitutionMonitoring);

function renderInclusivePage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <InclusiveEducationPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseAuth.mockReturnValue({
    profile: { id: 'director-1', full_name: 'Direção QA' },
  } as ReturnType<typeof useAuth>);
  mockedUseInstitution.mockReturnValue({
    currentInstitutionId: 'institution-1',
  } as ReturnType<typeof useInstitution>);
  mockedListStudents.mockResolvedValue([{ id: 'student-1', name: 'Estudante QA' }]);
  mockedListProgressStudents.mockResolvedValue([]);
  mockedListPei.mockResolvedValue([]);
  mockedListAee.mockResolvedValue([]);
  mockedListAeeSessions.mockResolvedValue([]);
  mockedSavePei.mockResolvedValue(undefined);
  mockedSaveAee.mockResolvedValue(undefined);
  mockedSaveAeeSession.mockResolvedValue(undefined);
});

afterEach(cleanup);

async function chooseAuthorizedStudent() {
  const addStudentButton = screen.getByRole('button', { name: 'Adicionar aluno autorizado' }) as HTMLButtonElement;
  await waitFor(() => expect(addStudentButton.disabled).toBe(false));
  fireEvent.click(addStudentButton);
  fireEvent.click(await screen.findByRole('option', { name: 'Estudante QA' }));
}

function makePeiPlans(count: number): InclusivePeiPlan[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `plan-${index + 1}`,
    institution_id: 'institution-1',
    student_id: `student-${index + 1}`,
    academic_year_id: null,
    class_id: null,
    status: 'ACTIVE',
    review_due_on: null,
    strengths: '',
    interests: '',
    learning_barriers: '',
    participation_barriers: '',
    pedagogical_objectives: '',
    teaching_strategies: '',
    accessibility_resources: '',
    planned_activities: '',
    monitoring_criteria: '',
    pedagogical_evaluation: '',
    updated_at: `2026-10-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
  }));
}

function makeAeePlan(): InclusiveAeePlan {
  return {
    id: 'aee-plan-1',
    institution_id: 'institution-1',
    student_id: 'student-1',
    pei_plan_id: null,
    academic_year_id: null,
    class_id: null,
    responsible_profile_id: 'director-1',
    status: 'ACTIVE',
    objectives: '',
    resources_used: '',
    pedagogical_observations: '',
    review_due_on: null,
    updated_at: '2026-10-19T12:00:00.000Z',
  };
}

function makeAeeSessions(count: number): InclusiveAeeSession[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `session-${index + 1}`,
    institution_id: 'institution-1',
    student_id: 'student-1',
    aee_plan_id: 'aee-plan-1',
    professional_profile_id: 'director-1',
    attended_on: `2026-10-${String(index + 1).padStart(2, '0')}`,
    objectives: `Objetivo ${index + 1}`,
    resources_used: '',
    observations: `Registro ${index + 1}`,
    created_at: `2026-10-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
  }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('InclusiveEducationPage PEI/AEE access', () => {
  it('uses the searchable student list to open pedagogical progress', async () => {
    mockedListStudents.mockResolvedValue([
      { id: 'student-outside', name: 'Aluno sem vínculo inclusivo' },
    ]);
    mockedListProgressStudents.mockResolvedValue([
      { id: 'student-1', name: 'Ana Souza' },
      { id: 'student-2', name: 'Davi Mendes' },
    ]);
    mockedGetInstitutionMonitoring.mockResolvedValue({
      students: [],
    } as Awaited<ReturnType<typeof pedagogicalMonitoringService.getInstitutionMonitoring>>);

    renderInclusivePage('/inclusive-education/progress');

    await waitFor(() => expect(mockedListProgressStudents).toHaveBeenCalledWith('institution-1'));
    expect(mockedListStudents).not.toHaveBeenCalled();
    expect(screen.queryByText('Aluno sem vínculo inclusivo')).toBeNull();

    const search = await screen.findByRole('textbox', {
      name: 'Pesquisar em estudantes com apoio inclusivo registrado',
    });
    expect(mockedListProgressStudents).toHaveBeenCalledWith('institution-1');
    expect(mockedListStudents).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Estudante para consultar evolução')).toBeNull();
    expect(screen.queryByRole('option', { name: 'Aluno sem apoio inclusivo' })).toBeNull();
    fireEvent.change(search, { target: { value: 'Davi' } });

    fireEvent.click(await screen.findByRole('option', { name: 'Davi Mendes' }));

    await waitFor(() => {
      expect(mockedGetInstitutionMonitoring).toHaveBeenCalledWith(
        'institution-1',
        { studentId: 'student-2' },
      );
    });
    expect(await screen.findByText('Nenhum registro de evolução disponível')).toBeTruthy();
  });

  it('paginates the student selector without an inner scrolling list', async () => {
    mockedListProgressStudents.mockResolvedValue(Array.from({ length: 9 }, (_, index) => ({
      id: `student-${index + 1}`,
      name: `Estudante ${index + 1}`,
    })));
    mockedGetInstitutionMonitoring.mockResolvedValue({ students: [] } as Awaited<ReturnType<typeof pedagogicalMonitoringService.getInstitutionMonitoring>>);

    renderInclusivePage('/inclusive-education/progress');

    const list = await screen.findByRole('listbox', { name: 'Estudantes com apoio inclusivo registrado' });
    expect(within(list).getAllByRole('option')).toHaveLength(8);
    expect(list.className).not.toContain('overflow-y-auto');
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página de estudantes com apoio inclusivo registrado' }));
    await waitFor(() => {
      const nextPageList = screen.getByRole('listbox', { name: 'Estudantes com apoio inclusivo registrado' });
      expect(within(nextPageList).getByRole('option', { name: 'Estudante 9' })).toBeTruthy();
      expect(within(nextPageList).queryByRole('option', { name: 'Estudante 1' })).toBeNull();
    });
  });

  it('paginates PEI records while keeping the total count visible', async () => {
    mockedListPei.mockResolvedValue(makePeiPlans(9));

    renderInclusivePage('/inclusive-education/pei');

    const records = screen.getByRole('heading', { name: 'Registros existentes' }).closest('section');
    expect(records).not.toBeNull();
    expect(await within(records as HTMLElement).findAllByRole('button', { name: 'Editar' })).toHaveLength(8);
    expect(within(records as HTMLElement).getByText('9')).toBeTruthy();
    fireEvent.click(within(records as HTMLElement).getByRole('button', { name: 'Próxima página de registros existentes' }));
    expect(await within(records as HTMLElement).findAllByRole('button', { name: 'Editar' })).toHaveLength(1);
  });

  it('does not label a failed PEI request as an empty record list', async () => {
    mockedListPei.mockRejectedValueOnce(new Error('network unavailable'));

    renderInclusivePage('/inclusive-education/pei');

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((alert) => alert.textContent?.includes('Não foi possível carregar os registros deste módulo.'))).toBe(true);
    expect(screen.queryByText('Nenhum registro encontrado para esta instituição.')).toBeNull();
    expect((screen.getByRole('button', { name: 'Adicionar aluno autorizado' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('reports a saved PEI accurately when refreshing the list fails', async () => {
    mockedListPei.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('network unavailable'));
    renderInclusivePage('/inclusive-education/pei');

    await chooseAuthorizedStudent();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));

    expect(await screen.findByText(
      'PEI salvo como rascunho. Não foi possível atualizar a lista agora; recarregue a página para conferir o registro.',
    )).toBeTruthy();
    expect(mockedSavePei).toHaveBeenCalledOnce();
    expect(screen.queryByText(/Não foi possível salvar\./)).toBeNull();
  });

  it('ignores PEI records returned late for the previous institution', async () => {
    const previousInstitutionRequest = deferred<InclusivePeiPlan[]>();
    mockedListPei.mockImplementation((institutionId) => institutionId === 'institution-1'
      ? previousInstitutionRequest.promise
      : Promise.resolve([{ ...makePeiPlans(1)[0], id: 'current-plan', student_id: 'student-current' }]));
    mockedListStudents.mockImplementation((institutionId) => Promise.resolve([
      { id: institutionId === 'institution-1' ? 'student-old' : 'student-current', name: institutionId === 'institution-1' ? 'Estudante antiga' : 'Estudante atual' },
    ]));

    const view = renderInclusivePage('/inclusive-education/pei');
    await waitFor(() => expect(mockedListPei).toHaveBeenCalledWith('institution-1'));
    expect(screen.getByText('Carregando registros...')).toBeTruthy();

    mockedUseInstitution.mockReturnValue({ currentInstitutionId: 'institution-2' } as ReturnType<typeof useInstitution>);
    view.rerender(
      <MemoryRouter initialEntries={['/inclusive-education/pei']}>
        <InclusiveEducationPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/Estudante antiga/)).toBeNull();
    expect(await screen.findByText(/Ativo · Atualizado em/)).toBeTruthy();
    previousInstitutionRequest.resolve([
      { ...makePeiPlans(1)[0], id: 'stale-plan', student_id: 'student-old', status: 'DRAFT' },
    ]);
    await waitFor(() => expect(screen.queryByText(/Rascunho · Atualizado em/)).toBeNull());
    expect(screen.getByText(/Ativo · Atualizado em/)).toBeTruthy();
  });

  it('hides prior-school progress immediately and ignores its late response', async () => {
    const oldProgressRequest = deferred<Awaited<ReturnType<typeof pedagogicalMonitoringService.getInstitutionMonitoring>>>();
    mockedListProgressStudents
      .mockResolvedValueOnce([{ id: 'student-old', name: 'Ana Escola Antiga' }])
      .mockResolvedValueOnce([{ id: 'student-new', name: 'Bruno Escola Atual' }]);
    mockedGetInstitutionMonitoring
      .mockReturnValueOnce(oldProgressRequest.promise)
      .mockResolvedValueOnce({ students: [] } as Awaited<ReturnType<typeof pedagogicalMonitoringService.getInstitutionMonitoring>>);

    const view = renderInclusivePage('/inclusive-education/progress');
    fireEvent.click(await screen.findByRole('option', { name: 'Ana Escola Antiga' }));

    await waitFor(() => expect(mockedGetInstitutionMonitoring).toHaveBeenCalledWith(
      'institution-1',
      { studentId: 'student-old' },
    ));

    mockedUseInstitution.mockReturnValue({ currentInstitutionId: 'institution-2' } as ReturnType<typeof useInstitution>);
    view.rerender(
      <MemoryRouter initialEntries={['/inclusive-education/progress']}>
        <InclusiveEducationPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Estudante selecionado: Ana Escola Antiga')).toBeNull();
    expect(screen.queryByText(/Evolução de Ana Escola Antiga/)).toBeNull();
    expect(await screen.findByRole('option', { name: 'Bruno Escola Atual' })).toBeTruthy();

    oldProgressRequest.resolve({
      students: [{
        studentId: 'student-old',
        fullName: 'Ana Escola Antiga',
        className: 'Turma antiga',
        dataStatus: 'OFFICIAL',
        risk: { level: 'LOW' },
        averageGrade: 80,
        attendancePercentage: 90,
        pendingItems: 0,
        subjects: [],
      }],
    } as unknown as Awaited<ReturnType<typeof pedagogicalMonitoringService.getInstitutionMonitoring>>);
    await waitFor(() => expect(screen.queryByText(/Evolução de Ana Escola Antiga/)).toBeNull());
  });

  it('paginates the AEE service history', async () => {
    mockedListAee.mockResolvedValue([makeAeePlan()]);
    mockedListAeeSessions.mockResolvedValue(makeAeeSessions(9));

    renderInclusivePage('/inclusive-education/aee-paee');
    fireEvent.click(await screen.findByRole('option', { name: 'Estudante QA' }));

    const history = screen.getByRole('heading', { name: 'Histórico de atendimentos' }).closest('section');
    expect(history).not.toBeNull();
    expect(await within(history as HTMLElement).findAllByRole('article')).toHaveLength(8);
    fireEvent.click(within(history as HTMLElement).getByRole('button', { name: 'Próxima página de histórico de atendimentos' }));
    expect(await within(history as HTMLElement).findByText('Registro 9')).toBeTruthy();
    expect(within(history as HTMLElement).queryByText('Registro 1')).toBeNull();
  });

  it('paginates inclusive activities and resets to page one when filters change', async () => {
    renderInclusivePage('/inclusive-education/activities');

    expect(screen.getAllByRole('button', { name: 'Visualizar atividade' })).toHaveLength(8);
    const categoryCarousel = screen.getByRole('group', { name: 'Categorias' });
    const literacyCategory = within(categoryCarousel).getByRole('button', { name: 'Alfabetização' });
    fireEvent.click(literacyCategory);
    expect(literacyCategory.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Descobrindo as vogais' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Minha rotina na escola' })).toBeNull();
    fireEvent.click(within(categoryCarousel).getByRole('button', { name: 'Todas' }));

    fireEvent.click(screen.getByRole('button', { name: 'Próxima página de atividades autorais' }));
    expect(screen.getByText('Página 2 de 3')).toBeTruthy();

    fireEvent.change(screen.getByRole('textbox', { name: 'Pesquisar atividade' }), {
      target: { value: 'rotina' },
    });
    expect(await screen.findByRole('heading', { name: 'Minha rotina na escola' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Paginação de atividades autorais' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Próxima página de recursos externos' }));
    expect(screen.getAllByRole('link', { name: 'Abrir material na fonte' })).toHaveLength(8);
    expect(screen.getByText('Página 2 de 3')).toBeTruthy();
  });

  it('paginates the inclusive video catalog', async () => {
    renderInclusivePage('/inclusive-education/videos');

    expect(screen.getAllByRole('link', { name: 'Assistir vídeo' })).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página de vídeos didáticos' }));
    expect(screen.getAllByRole('link', { name: 'Assistir vídeo' })).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Tradução audiovisual acessível e audiodescrição' })).toBeTruthy();
  });

  it('loads an authorized student and saves a PEI draft from the interactive form', async () => {
    renderInclusivePage('/inclusive-education/pei');

    await chooseAuthorizedStudent();
    expect(screen.queryByText(/Modo seguro de preparação/i)).toBeNull();

    const strengths = screen.getByLabelText('Pontos fortes');
    expect((strengths as HTMLTextAreaElement).disabled).toBe(false);
    fireEvent.change(strengths, { target: { value: 'Aprende com atividades visuais.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));

    await waitFor(() => {
      expect(mockedSavePei).toHaveBeenCalledWith(
        'institution-1',
        'director-1',
        expect.objectContaining({
          student_id: 'student-1',
          strengths: 'Aprende com atividades visuais.',
        }),
        undefined,
      );
    });
  });

  it('loads an authorized student and saves an AEE draft from the interactive form', async () => {
    renderInclusivePage('/inclusive-education/aee-paee');

    await chooseAuthorizedStudent();
    expect(screen.queryByText(/Modo seguro de preparação/i)).toBeNull();

    fireEvent.change(screen.getByLabelText('Objetivo do atendimento'), {
      target: { value: 'Ampliar comunicação funcional.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));

    await waitFor(() => {
      expect(mockedSaveAee).toHaveBeenCalledWith(
        'institution-1',
        'director-1',
        expect.objectContaining({
          student_id: 'student-1',
          responsible_profile_id: 'director-1',
          objectives: 'Ampliar comunicação funcional.',
        }),
        undefined,
      );
    });
  });
});
