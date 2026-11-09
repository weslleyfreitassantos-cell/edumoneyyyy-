// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  subjects: [
    { id: 'subject-math', name: 'Matemática', code: 'MAT' },
    { id: 'subject-portuguese', name: 'Língua Portuguesa', code: 'LP' },
    { id: 'subject-project', name: 'Projeto de Vida', code: 'PV' },
  ],
  overview: { state: 'READY', action: 'START', grade_label: '1º ano do Ensino Fundamental', has_progress: false, skills_total: 12, skills_mastered: 0, progress_percent: 0, reason: null } as Record<string, unknown>,
  start: vi.fn().mockResolvedValue({ state: 'ACTIVE', session_id: 'server-session-1' }),
  journeys: [] as Array<Record<string, unknown>>,
  links: [] as Array<Record<string, unknown>>,
  targets: [] as Array<Record<string, unknown>>,
  canonicalProgress: [] as Array<Record<string, unknown>>,
  activities: [] as Array<Record<string, unknown>>,
  activityProgress: [] as Array<Record<string, unknown>>,
  targetError: false,
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ profile: { id: 'profile-1', full_name: 'Ana Estudante' } }) }));
vi.mock('../../contexts/InstitutionContext', () => ({ useInstitution: () => ({ currentInstitutionId: 'institution-1' }) }));
vi.mock('../../hooks/useLearningCenter', () => ({
  useStudentLearningSubjects: () => ({ data: state.subjects, isLoading: false, isError: false }),
  useLearningStudent: () => ({ data: { id: 'student-1' }, isLoading: false, isError: false }),
  useGuidedDisciplineJourneysV9: () => ({ data: state.journeys, isLoading: false, isError: false }),
  useLearningCurriculumSubjectLinks: () => ({ data: state.links, isLoading: false, isError: false }),
  useStudentGuidedLearningTargets: () => ({ data: state.targets, isLoading: false, isError: state.targetError }),
  useLearningCanonicalProgress: () => ({ data: state.canonicalProgress, isLoading: false, isError: false }),
  usePublishedLearningActivities: () => ({ data: state.activities, isLoading: false, isError: false }),
  useLearningProgress: () => ({ data: state.activityProgress, isLoading: false, isError: false }),
  useGuidedStudyOverviewV11: () => ({ data: state.overview, isLoading: false, isError: false }),
  useStartGuidedStudyV11: () => ({ mutateAsync: state.start, isPending: false, isError: false }),
  useEnemSimulationTemplates: () => ({ data: [{ id: 'enem-1', title: 'ENEM Matemática', simulation_type: 'SUBJECT', question_count: 10, duration_minutes: 20, ready_count: 10, availability_status: 'AVAILABLE', language_options: [], metadata: {} }], isLoading: false, isError: false }),
}));

import StudyCenterPage from './StudyCenterPage';
import StudentSubjectPage from './StudentSubjectPage';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderPage(initialEntry = '/student/study') {
  return render(<MemoryRouter initialEntries={[initialEntry]}><Routes>
    <Route path="/student/study" element={<><StudyCenterPage /><LocationProbe /></>} />
    <Route path="/student/study/subject/:subjectId" element={<StudentSubjectPage />} />
    <Route path="/student/study/guided" element={<LocationProbe />} />
    <Route path="/student/study/simulation" element={<p>Simulado ENEM aberto</p>} />
  </Routes></MemoryRouter>);
}

afterEach(() => {
  cleanup();
  state.subjects = [
    { id: 'subject-math', name: 'Matemática', code: 'MAT' },
    { id: 'subject-portuguese', name: 'Língua Portuguesa', code: 'LP' },
    { id: 'subject-project', name: 'Projeto de Vida', code: 'PV' },
  ];
  state.overview = { state: 'READY', action: 'START', grade_label: '1º ano do Ensino Fundamental', has_progress: false, skills_total: 12, skills_mastered: 0, progress_percent: 0, reason: null };
  state.start.mockReset().mockResolvedValue({ state: 'ACTIVE', session_id: 'server-session-1' });
  state.journeys = [];
  state.links = [];
  state.targets = [];
  state.canonicalProgress = [];
  state.activities = [];
  state.activityProgress = [];
  state.targetError = false;
});

describe('Estudo Guiado V11', () => {
  it('apresenta uma única ação de estudo, detecta série e mantém ENEM e Lista de Exercícios separados', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'O que você quer estudar?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Iniciar meu estudo' })).toBeTruthy();
    expect(screen.getByText('1º ano do Ensino Fundamental')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Preparação para o ENEM' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Lista de Exercícios' }).getAttribute('href')).toBe('/student/activities');
    expect(screen.getByRole('region', { name: 'Matérias' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Matemática.*Acompanhar progresso/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Iniciar aula|Abrir aula guiada|Continuar aula/ })).toBeNull();
    expect(screen.queryByText('Projeto de Vida')).toBeNull();
  });

  it('inicia pelo servidor e navega para a sessão emitida, sem escolher matéria', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar meu estudo' }));

    await waitFor(() => expect(state.start).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/student/study/guided?session=server-session-1'));
  });

  it('oferece continuar quando existe progresso e mantém a mensagem específica de matrícula ambígua', () => {
    state.overview = { state: 'AMBIGUOUS_ENROLLMENT', has_progress: true, reason: 'A secretaria precisa confirmar sua turma.' };
    renderPage();

    expect((screen.getByRole('button', { name: 'Continuar meu estudo' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('A secretaria precisa confirmar sua turma.').getAttribute('role')).toBe('status');
  });

  it('permite recolher e reabrir Matérias sem expor navegação para aulas', () => {
    renderPage();
    const toggle = screen.getByRole('button', { name: /Matérias/ });
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('textbox', { name: 'Pesquisar matéria' })).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByRole('link', { name: /Iniciar aula/ })).toBeNull();
  });

  it('shows availability and mastery on cards from published V11 content', () => {
    state.links = [{ subject_id: 'subject-math', subject_area: 'MATEMATICA' }];
    state.targets = [{
      target_canonical_skill_id: 'skill-math', subject_area: 'MATEMATICA', availability_status: 'READY',
      has_lesson: true, question_count: 5, progress: 60,
    }];
    state.canonicalProgress = [{ canonical_skill_id: 'skill-math', state: 'LEARNING', mastery_estimate: 60, evidence_count: 2 }];
    renderPage();

    expect(screen.getByText(/1 habilidade\(s\) da área Matemática/)).toBeTruthy();
    expect(screen.getByText('Domínio da área: 60%')).toBeTruthy();
  });

  it('does not present a query failure as an empty subject catalog', () => {
    state.targetError = true;
    renderPage();

    expect(screen.getAllByText('Disponibilidade não consultada')).toHaveLength(2);
    expect(screen.getByRole('alert').textContent).toContain('não pôde ser consultada');
    expect(screen.queryByText('Nenhum conteúdo publicado no momento')).toBeNull();
  });

  it('usa a página de matéria somente para acompanhar progresso', () => {
    state.journeys = [{
      journey_id: 'journey-1', source: 'CENTRAL_STUDIES_V2', subject_id: 'subject-math', subject_name: 'Matemática',
      unit_title: 'Números', title: 'Resolver situações-problema', publication_status: 'PUBLISHED',
      availability_status: 'AVAILABLE', mapping_status: 'MAPPED', pedagogical_review_status: 'PEDAGOGICAL_REVIEWED',
      question_count: 4, progress: 50,
    }];
    renderPage('/student/study/subject/subject-math');

    expect(screen.getByText('Acompanhamento de aprendizagem')).toBeTruthy();
    expect(screen.getByText('Resolver situações-problema')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Iniciar aula guiada|Abrir aula/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Ir para Lista de Exercícios' })).toBeTruthy();
  });
});
