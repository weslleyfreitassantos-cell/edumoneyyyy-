// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  it('apresenta as matérias como entrada do estudo guiado sem botões globais ou métricas técnicas', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'O que você quer estudar?' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Continuar meu estudo|Iniciar meu estudo/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Lista de Exercícios' })).toBeNull();
    expect(screen.getByText('Escolha uma matéria para iniciar ou retomar seu estudo guiado.')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Preparação para o ENEM' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Matérias' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Matemática.*Abrir matéria/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Iniciar aula|Abrir aula guiada|Continuar aula/ })).toBeNull();
    expect(screen.queryByText(/habilidades publicadas consolidadas|Domínio da área|atividade\(s\) específica\(s\)|publicadas pela escola/i)).toBeNull();
    expect(screen.getByText('Projeto de Vida')).toBeTruthy();
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

  it('mantém as atividades docentes fora da lista de matérias', () => {
    state.activities = [{ id: 'teacher-activity', title: 'Lista da professora' }];
    renderPage('/student/study/subject/subject-math');

    expect(screen.queryByText('Lista da professora')).toBeNull();
  });
});
