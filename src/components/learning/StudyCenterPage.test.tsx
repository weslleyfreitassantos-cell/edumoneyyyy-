// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  subjects: [
    { id: 'subject-math', name: 'Matemática', code: 'MAT' },
    { id: 'subject-portuguese', name: 'Língua Portuguesa', code: 'LP' },
    { id: 'subject-english', name: 'Língua Inglesa', code: 'ING' },
    { id: 'subject-project', name: 'Projeto de Vida', code: 'PV' },
    { id: 'subject-research', name: 'Iniciação Científica', code: 'ICI' },
    { id: 'subject-elective', name: 'Eletiva Interdisciplinar', code: 'ELE' },
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
  enemTemplates: {
    data: [{ id: 'enem-1', title: 'ENEM Matemática', simulation_type: 'SUBJECT', question_count: 10, duration_minutes: 20, ready_count: 10, availability_status: 'AVAILABLE', language_options: [], metadata: {} }],
    isLoading: false,
    isError: false,
  },
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
  useEnemSimulationTemplates: () => state.enemTemplates,
}));

import StudyCenterPage from './StudyCenterPage';
import StudentSubjectPage from './StudentSubjectPage';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function pageElement(initialEntry = '/student/study') {
  return <MemoryRouter initialEntries={[initialEntry]}><Routes>
    <Route path="/student/study" element={<><StudyCenterPage /><LocationProbe /></>} />
    <Route path="/student/study/subject/:subjectId" element={<StudentSubjectPage />} />
    <Route path="/student/study/guided" element={<LocationProbe />} />
    <Route path="/student/study/simulation" element={<p>Simulado ENEM aberto</p>} />
  </Routes></MemoryRouter>;
}

function renderPage(initialEntry = '/student/study') {
  return render(pageElement(initialEntry));
}

afterEach(() => {
  cleanup();
  state.subjects = [
    { id: 'subject-math', name: 'Matemática', code: 'MAT' },
    { id: 'subject-portuguese', name: 'Língua Portuguesa', code: 'LP' },
    { id: 'subject-english', name: 'Língua Inglesa', code: 'ING' },
    { id: 'subject-project', name: 'Projeto de Vida', code: 'PV' },
    { id: 'subject-research', name: 'Iniciação Científica', code: 'ICI' },
    { id: 'subject-elective', name: 'Eletiva Interdisciplinar', code: 'ELE' },
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
  state.enemTemplates = {
    data: [{ id: 'enem-1', title: 'ENEM Matemática', simulation_type: 'SUBJECT', question_count: 10, duration_minutes: 20, ready_count: 10, availability_status: 'AVAILABLE', language_options: [], metadata: {} }],
    isLoading: false,
    isError: false,
  };
});

describe('Estudo Guiado V11', () => {
  it('apresenta as matérias como entrada do estudo guiado sem botões globais ou métricas técnicas', () => {
    renderPage();

    const enemToggle = screen.getByRole('button', { name: /Práticas oficiais/ });
    const subjectsToggle = screen.getByRole('button', { name: /Matérias/ });
    expect(enemToggle.getAttribute('aria-expanded')).toBe('false');
    expect(subjectsToggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('link', { name: 'Abrir módulo' })).toBeTruthy();

    expect(screen.getByRole('heading', { name: 'O que você quer estudar?' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Continuar meu estudo|Iniciar meu estudo/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Lista de Exercícios' })).toBeNull();
    expect(screen.getByText('Escolha uma matéria para iniciar ou retomar seu estudo guiado.')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Preparação para o ENEM' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Matérias' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Matemática.*Abrir matéria/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Iniciar aula|Abrir aula guiada|Continuar aula/ })).toBeNull();
    expect(screen.queryByText(/habilidades publicadas consolidadas|Domínio da área|atividade\(s\) específica\(s\)|publicadas pela escola/i)).toBeNull();
    expect(screen.queryByText('Projeto de Vida')).toBeNull();
    expect(screen.queryByText('Iniciação Científica')).toBeNull();
    expect(screen.queryByText('Eletiva Interdisciplinar')).toBeNull();
  });

  it('does not open a non-BNCC class subject through a direct subject URL', () => {
    renderPage('/student/study/subject/subject-project');

    expect(screen.getByText('Esta matéria não está disponível para sua matrícula.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Projeto de Vida' })).toBeNull();
  });

  it('permite recolher e reabrir Matérias sem expor navegação para aulas', () => {
    renderPage();
    const toggle = screen.getByRole('button', { name: /Matérias/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('textbox', { name: 'Pesquisar matéria' })).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('link', { name: /Matemática.*Abrir matéria/ })).toBeTruthy();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('link', { name: /Matemática.*Abrir matéria/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Iniciar aula/ })).toBeNull();
  });

  it('não abre um painel automaticamente quando os dados do ENEM terminam de carregar', () => {
    state.enemTemplates = { data: [], isLoading: true, isError: false };
    const view = renderPage();
    const toggle = screen.getByRole('button', { name: /Práticas oficiais/ });

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    state.enemTemplates = {
      data: [{ id: 'enem-1', title: 'ENEM Matemática', simulation_type: 'SUBJECT', question_count: 10, duration_minutes: 20, ready_count: 10, availability_status: 'AVAILABLE', language_options: [], metadata: {} }],
      isLoading: false,
      isError: false,
    };
    view.rerender(pageElement());

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('heading', { name: 'ENEM Matemática' })).toBeNull();
  });

  it('lista ENEM 2026 com links oficiais sem modificar os anos anteriores', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Práticas oficiais/ }));

    const edition = screen.getByRole('heading', { name: 'ENEM 2026' }).closest('article');
    expect(edition).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'ENEM 2025' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'ENEM 2024' })).toBeTruthy();
    expect(within(edition as HTMLElement).getByRole('link', { name: 'Ver todos' }).getAttribute('href'))
      .toBe('https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos/2026');
    expect(within(edition as HTMLElement).getAllByRole('link', { name: 'Baixar prova' }).map((link) => link.getAttribute('href')))
      .toEqual([
        'https://download.inep.gov.br/enem/provas_e_gabaritos/2026_PV_impresso_D1_CD1.pdf',
        'https://download.inep.gov.br/enem/provas_e_gabaritos/2026_PV_impresso_D2_CD5.pdf',
      ]);
    expect(within(edition as HTMLElement).getAllByRole('link', { name: 'Baixar gabarito' }).map((link) => link.getAttribute('href')))
      .toEqual([
        'https://download.inep.gov.br/enem/provas_e_gabaritos/2026_GB_impresso_D1_CD1.pdf',
        'https://download.inep.gov.br/enem/provas_e_gabaritos/2026_GB_impresso_D2_CD5.pdf',
      ]);
    expect(within(edition as HTMLElement).queryByRole('img')).toBeNull();
  });

  it('remove a divulgação do Tec Idiomas sem alterar a jornada de Língua Inglesa', () => {
    state.overview = { ...state.overview, state: 'ACTIVE', action: 'CONTINUE', topic_title: 'Inglês em contextos globais' };
    renderPage('/student/study/subject/subject-english');

    expect(screen.getByRole('heading', { name: 'Língua Inglesa' })).toBeTruthy();
    expect(screen.getByText('Inglês em contextos globais')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuar estudo' })).toBeTruthy();
    expect(screen.queryByText('Seu curso de idiomas continua disponível separadamente.')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Abrir Tec Idiomas' })).toBeNull();
  });

  it('mantém as atividades docentes fora da lista de matérias', () => {
    state.activities = [{ id: 'teacher-activity', title: 'Lista da professora' }];
    renderPage('/student/study/subject/subject-math');

    expect(screen.queryByText('Lista da professora')).toBeNull();
  });
});
