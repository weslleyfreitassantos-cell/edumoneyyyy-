// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  subjects: [
    { id: 'subject-math', name: 'Matemática' },
    { id: 'subject-portuguese', name: 'Língua Portuguesa' },
  ],
  activities: [] as Array<{ id: string; subject_id: string; unit_id: string | null; skill_id: string | null; title: string }>,
  simulations: [
    { id: 'simulation-1', title: 'Matemática', simulation_type: 'SUBJECT', area: null, subject: 'MATEMATICA', subject_code: 'MATEMATICA', question_count: 10, duration_minutes: 20, available_count: 10, ready_count: 10, availability_status: 'AVAILABLE', language_options: [], metadata: {} },
    { id: 'simulation-english', title: 'Inglês', simulation_type: 'SUBJECT', area: null, subject: 'INGLES', subject_code: 'INGLES', question_count: 3, duration_minutes: 20, available_count: 3, ready_count: 3, language_options: [], metadata: { planned_question_count: 10, reduced_practice: true } },
  ],
  adaptiveTarget: null as null | { canonicalSkillId: string; target: { subjectArea: string } },
  guidedSession: null as null | { id: string; status: string },
  guidedTargets: [] as Array<{ target_canonical_skill_id: string; subject_id: string | null; catalog_id: string; catalog_code: string; official_code: string; title: string; subject_area: string; stage: string; grade_level: number; availability_status: string; progress: number; has_lesson: boolean; question_count: number; active_session_id: string | null; active_session_status: string | null; reason: string }>,
  guidedJourneys: [] as Array<Record<string, unknown> & { journey_id: string; subject_id: string; subject_name: string }>,
  guidedRecommendation: null as null | Record<string, unknown> & { state: string },
  startGuidedSession: vi.fn().mockResolvedValue({ session_id: 'session-1' }),
  startGuidedJourney: vi.fn().mockResolvedValue({ session_id: 'session-1', target_canonical_skill_id: 'skill-math' }),
  startRecommendedStudy: vi.fn().mockResolvedValue({ state: 'ACTIVE', journey_id: 'journey-math', execution_skill_id: 'skill-math' }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { id: 'profile-1', full_name: 'Ana Estudante' } }),
}));

vi.mock('../../contexts/InstitutionContext', () => ({
  useInstitution: () => ({ currentInstitutionId: 'institution-1' }),
}));

vi.mock('../../hooks/useLearningCenter', () => ({
  useLearningStudent: () => ({ data: { id: 'student-1', profile_id: 'profile-1' }, isLoading: false }),
  useStudentLearningSubjects: () => ({ data: state.subjects, isLoading: false, isError: false }),
  usePublishedLearningActivities: () => ({ data: state.activities, isLoading: false, isError: false }),
  useEnemSimulationTemplates: () => ({ data: state.simulations, isLoading: false }),
  useLearningUnits: () => ({ data: [{ id: 'unit-1', subject_id: 'subject-math', title: 'Números', description: 'Conteúdos essenciais', sort_order: 1 }], isLoading: false }),
  useLearningSkills: () => ({ data: [{ id: 'skill-1', unit_id: 'unit-1', title: 'Resolver problemas', description: null, sort_order: 1 }], isLoading: false }),
  useGuidedLearningSessionV2: () => ({ data: state.guidedSession, isLoading: false }),
  useGuidedDisciplineJourneysV9: () => ({ data: state.guidedJourneys, isLoading: false, isError: false }),
  useRecommendedGuidedStudyV10: () => ({ data: state.guidedRecommendation, isLoading: false, isError: false }),
  useStudentGuidedLearningTargets: () => ({ data: state.guidedTargets, isLoading: false, isError: false }),
  useStartGuidedLearningSessionV2: () => ({ mutateAsync: state.startGuidedSession, isPending: false }),
  useStartGuidedDisciplineJourneyV9: () => ({ mutateAsync: state.startGuidedJourney, isPending: false, isError: false, error: null }),
  useStartRecommendedGuidedStudyV10: () => ({ mutateAsync: state.startRecommendedStudy, isPending: false, isError: false, error: null }),
}));

vi.mock('../../hooks/useAdaptiveLearning', () => ({
  useStudentAdaptiveTarget: () => ({ data: state.adaptiveTarget, isLoading: false }),
}));

import StudyCenterPage from './StudyCenterPage';
import StudentSubjectPage from './StudentSubjectPage';

afterEach(() => {
  cleanup();
  state.subjects = [
    { id: 'subject-math', name: 'Matemática' },
    { id: 'subject-portuguese', name: 'Língua Portuguesa' },
  ];
  state.activities = [];
  state.adaptiveTarget = null;
  state.guidedSession = null;
  state.guidedTargets = [];
  state.guidedJourneys = [];
  state.guidedRecommendation = null;
  state.startGuidedSession.mockReset().mockResolvedValue({ session_id: 'session-1' });
  state.startGuidedJourney.mockReset().mockResolvedValue({ session_id: 'session-1', target_canonical_skill_id: 'skill-math' });
  state.startRecommendedStudy.mockReset().mockResolvedValue({ state: 'ACTIVE', journey_id: 'journey-math', execution_skill_id: 'skill-math' });
});

function renderPage(initialEntry = '/student/study') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/student/study" element={<StudyCenterPage />} />
        <Route path="/student/study/subject/:subjectId" element={<StudentSubjectPage />} />
        <Route path="/student/study/activity/:activityId" element={<p>Atividade aberta</p>} />
        <Route path="/student/study/guided" element={<p>Jornada guiada aberta</p>} />
        <Route path="/student/study/simulation" element={<p>Simulado ENEM aberto</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('StudyCenterPage', () => {
  it('inicia ENEM e Matérias expandidas, com ENEM antes das matérias', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'O que você quer estudar?' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Pratique inglês no seu ritmo' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Pratique inglês no seu ritmo' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Explorar inglês' })).toBeNull();
    const enemToggle = screen.getByRole('button', { name: /Práticas oficiais/ });
    const subjectsToggle = screen.getByRole('button', { name: /Matérias/ });
    expect(enemToggle.getAttribute('aria-expanded')).toBe('true');
    expect(subjectsToggle.getAttribute('aria-expanded')).toBe('true');

    expect(screen.getByRole('region', { name: 'Matérias' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Matemática.*Abrir matéria/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Língua Portuguesa/ })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Módulo de redação' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Abrir módulo' }).getAttribute('href')).toBe('/student/study/writing');
    expect(screen.getByRole('link', { name: /Matemática.*Praticar/ }).getAttribute('href')).toBe('/student/study/simulation?simulation=simulation-1');
    expect(screen.getByRole('link', { name: /Inglês.*3 questões oficiais disponíveis \(10 previstas\) · prática reduzida/ }).getAttribute('href')).toBe('/student/study/simulation?simulation=simulation-english');
    expect(screen.getByRole('heading', { name: 'Provas e gabaritos oficiais' })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Baixar prova' }).find((link) => link.getAttribute('href')?.includes('2025_PV_impresso_D1_CD1.pdf'))).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Baixar gabarito' }).find((link) => link.getAttribute('href')?.includes('2025_GB_impresso_D1_CD1.pdf'))).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Capa 1º dia · Caderno azul do ENEM 2025' }).getAttribute('src')).toBe('/assets/enem-covers/2025-d1-cd1.png');
    expect(screen.getAllByRole('img')).toHaveLength(4);
    expect(screen.queryByText('Central de Estudos')).toBeNull();
    expect(screen.queryByText('Seu próximo passo')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Práticas oficiais' }).compareDocumentPosition(screen.getByRole('region', { name: 'Matérias' }))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('filtra as matérias sem misturar outros conteúdos', () => {
    renderPage();

    fireEvent.change(screen.getByRole('textbox', { name: 'Pesquisar matéria' }), { target: { value: 'mat' } });

    expect(screen.getAllByRole('link', { name: /Matemática/ }).some((link) => link.getAttribute('href') === '/student/study/subject/subject-math')).toBe(true);
    expect(screen.queryByRole('link', { name: /Língua Portuguesa/ })).toBeNull();
  });

  it('exibe somente componentes padrão da BNCC nos cartões', () => {
    state.subjects = [
      { id: 'subject-math', name: 'Matemática' },
      { id: 'subject-portuguese', name: 'Língua Portuguesa' },
      { id: 'subject-life-project', name: 'Projeto de Vida' },
      { id: 'subject-writing', name: 'Redação' },
      { id: 'subject-digital-culture', name: 'Cultura Digital' },
    ];

    renderPage();

    const subjectRegion = screen.getByRole('region', { name: 'Matérias' });
    const subjectLinks = Array.from(subjectRegion.querySelectorAll('a[href^="/student/study/subject/"]'));
    expect(subjectLinks.map((link) => link.getAttribute('href')).sort()).toEqual([
      '/student/study/subject/subject-math',
      '/student/study/subject/subject-portuguese',
    ]);
    expect(screen.getByText('2 matérias disponíveis')).toBeTruthy();
  });

  it('bloqueia links antigos para matérias fora do currículo padrão', () => {
    state.subjects = [
      { id: 'subject-life-project', name: 'Projeto de Vida' },
      { id: 'subject-math', name: 'Matemática' },
    ];

    renderPage('/student/study/subject/subject-life-project');

    expect(screen.getByText('Esta matéria não está disponível para você.')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Estudo de Projeto de Vida' })).toBeNull();
  });

  it('inicia a preparação para o ENEM expandida e permite recolher e reabrir', () => {
    renderPage();

    const toggle = screen.getByRole('button', { name: /Práticas oficiais/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Provas e gabaritos oficiais' })).toBeTruthy();

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('heading', { name: 'Provas e gabaritos oficiais' })).toBeNull();

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Provas e gabaritos oficiais' })).toBeTruthy();
  });

  it('inicia Matérias expandida e permite recolher e reabrir', () => {
    renderPage();

    const toggle = screen.getByRole('button', { name: /Matérias/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('link', { name: /Matemática.*Abrir matéria/ })).toBeTruthy();

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('textbox', { name: 'Pesquisar matéria' })).toBeNull();
    expect(screen.queryByRole('link', { name: /Matemática.*Abrir matéria/ })).toBeNull();

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('textbox', { name: 'Pesquisar matéria' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Matemática.*Abrir matéria/ })).toBeTruthy();
  });

  it('preserva o estado escolhido ao restaurar a página do cache do navegador', () => {
    renderPage();

    const enemToggle = screen.getByRole('button', { name: /Práticas oficiais/ });
    const subjectsToggle = screen.getByRole('button', { name: /Matérias/ });
    expect(enemToggle.getAttribute('aria-expanded')).toBe('true');
    expect(subjectsToggle.getAttribute('aria-expanded')).toBe('true');

    const restoreEvent = new Event('pageshow') as PageTransitionEvent;
    Object.defineProperty(restoreEvent, 'persisted', { value: true });
    act(() => window.dispatchEvent(restoreEvent));

    expect(enemToggle.getAttribute('aria-expanded')).toBe('true');
    expect(subjectsToggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(enemToggle);
    fireEvent.click(subjectsToggle);
    const collapsedRestoreEvent = new Event('pageshow') as PageTransitionEvent;
    Object.defineProperty(collapsedRestoreEvent, 'persisted', { value: true });
    act(() => window.dispatchEvent(collapsedRestoreEvent));

    expect(enemToggle.getAttribute('aria-expanded')).toBe('false');
    expect(subjectsToggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('abre a área própria da matéria ao clicar no card', () => {
    renderPage();

    fireEvent.click(screen.getAllByRole('link', { name: /Matemática/ }).find((link) => link.getAttribute('href') === '/student/study/subject/subject-math')!);

    expect(screen.getByRole('region', { name: 'Estudo de Matemática' })).toBeTruthy();
    expect(screen.getByText('Números')).toBeTruthy();
    expect(screen.queryByText('O que você quer estudar?')).toBeNull();
  });

  it('integra a descoberta da matéria sem expor a lista de jornadas ao aluno', () => {
    state.guidedJourneys = [
      makeJourney('journey-math', 'subject-math', 'Matemática', 'skill-math', 'session-math'),
      makeJourney('journey-physics', 'subject-physics', 'Física', 'skill-physics'),
    ];

    renderPage();

    expect(screen.queryByRole('region', { name: 'Estudo guiado pela BNCC' })).toBeNull();
    expect(screen.getAllByRole('link', { name: /Matemática/ }).filter((link) => link.getAttribute('href') === '/student/study/subject/subject-math')).toHaveLength(1);
    expect(screen.getByRole('link', { name: /Física.*1 jornada em revisão pedagógica/ }).getAttribute('href')).toBe('/student/study/subject/subject-physics');

    fireEvent.click(screen.getByRole('link', { name: /Matemática.*jornada em revisão/ }));
    expect(screen.queryByText('Prévia demonstrativa · revisão pedagógica pendente')).toBeNull();
    expect(screen.queryByText('Relação curricular candidata, não validada:')).toBeNull();
    expect(screen.queryByText('EM13MAT303')).toBeNull();
    expect(screen.queryByRole('button', { name: /Começar estudo/ })).toBeNull();
  });

  it('mostra uma recomendação única e inicia pelo identificador da matéria, não por jornada do cliente', async () => {
    state.guidedJourneys = [makeJourney('journey-math', 'subject-math', 'Matemática', 'skill-math')];
    state.guidedRecommendation = {
      state: 'READY',
      stage: 'ENSINO_MEDIO',
      grade_level: 1,
      title: 'Equações e modelagem',
      unit_title: 'Unidade inicial',
      journey_id: 'journey-math',
      execution_skill_id: 'skill-math',
      demonstration_only: true,
      pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING',
    };

    renderPage();
    fireEvent.click(screen.getByRole('link', { name: /Matemática.*jornada em revisão/ }));
    expect(screen.getByText('1º ano do Ensino Médio')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Equações e modelagem' })).toBeTruthy();
    expect(screen.getByText('Prévia demonstrativa · revisão pedagógica pendente')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Iniciar estudo' })).toHaveLength(1);
    expect(screen.queryByText('CODE_journey-math')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar estudo' }));

    await waitFor(() => expect(state.startRecommendedStudy).toHaveBeenCalledWith('subject-math'));
    expect(await screen.findByText('Jornada guiada aberta')).toBeTruthy();
  });

  it('retoma sessão ativa sem criar outra e mantém um único botão', () => {
    state.guidedJourneys = [makeJourney('journey-math', 'subject-math', 'Matemática', 'skill-math', 'session-math')];
    state.guidedRecommendation = {
      state: 'ACTIVE',
      session_status: 'PAUSED',
      journey_id: 'journey-math',
      execution_skill_id: 'skill-math',
      progress: 24,
      demonstration_only: true,
      pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING',
    };

    renderPage();
    fireEvent.click(screen.getByRole('link', { name: /Matemática.*jornada em revisão/ }));

    expect(screen.getAllByRole('link', { name: 'Continuar estudo' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Continuar estudo' }).getAttribute('href')).toContain('journey=journey-math');
    expect(state.startRecommendedStudy).not.toHaveBeenCalled();
  });

  it('retoma uma sessão histórica sem jornada V9 usando apenas a habilidade persistida', () => {
    state.guidedRecommendation = {
      state: 'ACTIVE',
      session_status: 'PAUSED',
      execution_skill_id: 'skill-math',
      progress: 18,
    };

    renderPage();
    fireEvent.click(screen.getAllByRole('link', { name: /Matemática/ }).find((link) => link.getAttribute('href') === '/student/study/subject/subject-math')!);

    expect(screen.getByRole('link', { name: 'Continuar estudo' }).getAttribute('href')).toBe('/student/study/guided?skill=skill-math');
  });

  it('explica quando a série não tem conteúdo e não oferece início falso', () => {
    state.guidedRecommendation = {
      state: 'GRADE_NOT_SUPPORTED',
      stage: 'ENSINO_MEDIO',
      grade_level: 2,
    };

    renderPage();
    fireEvent.click(screen.getAllByRole('link', { name: /Matemática/ }).find((link) => link.getAttribute('href') === '/student/study/subject/subject-math')!);

    expect(screen.getByRole('status').textContent).toContain('Ainda não há conteúdo demonstrativo disponível para sua série');
    expect(screen.queryByRole('button', { name: /Iniciar estudo|Retomar revisão/ })).toBeNull();
  });

  it('apresenta a prévia indisponível sem erro técnico e sem oferecer início', () => {
    state.guidedRecommendation = { state: 'DEMO_PREVIEW_UNAVAILABLE' };

    renderPage();
    fireEvent.click(screen.getAllByRole('link', { name: /Matemática/ }).find((link) => link.getAttribute('href') === '/student/study/subject/subject-math')!);

    expect(screen.getByRole('status').textContent).toContain('ainda não foi liberado para esta instituição');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: /Iniciar estudo|Retomar revisão/ })).toBeNull();
  });
});

function makeJourney(journeyId: string, subjectId: string, subjectName: string, skillId: string, activeSessionId: string | null = null) {
  return {
    journey_id: journeyId,
    journey_code: `CODE_${journeyId}`,
    subject_id: subjectId,
    subject_code: subjectId,
    subject_name: subjectName,
    canonical_subject_code: subjectId,
    unit_code: 'UNIT_1',
    unit_title: 'Unidade inicial',
    title: 'Interpretar conceitos',
    execution_skill_id: skillId,
    official_codes: ['EM13MAT303'],
    official_areas: ['MATEMATICA'],
    mapping_status: 'MAPPING_PENDING',
    mapping_reason: 'Vínculo candidato, ainda não validado.',
    learning_role: 'INTRODUCTORY_CONTENT',
    availability_status: 'DEMO_PREVIEW',
    question_count: 8,
    missing_purposes: [],
    progress: activeSessionId ? 20 : 0,
    active_session_id: activeSessionId,
    active_session_status: activeSessionId ? 'ACTIVE' : null,
    pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING',
    reason: 'Prévia demonstrativa.',
  };
}
