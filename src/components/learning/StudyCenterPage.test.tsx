// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  subjects: [
    { id: 'subject-math', name: 'Matemática' },
    { id: 'subject-portuguese', name: 'Língua Portuguesa' },
  ],
  activities: [] as Array<{ id: string; subject_id: string; unit_id: string | null; skill_id: string | null; title: string }>,
  simulations: [{ id: 'simulation-1', title: 'Matemática', simulation_type: 'SUBJECT', area: null, subject: 'MATEMATICA', subject_code: 'MATEMATICA', question_count: 10, duration_minutes: 20, available_count: 10, ready_count: 10, availability_status: 'AVAILABLE', language_options: [], metadata: {} }],
  adaptiveTarget: null as null | { canonicalSkillId: string; target: { subjectArea: string } },
  guidedSession: null as null | { id: string; status: string },
  guidedTargets: [] as Array<{ target_canonical_skill_id: string; subject_id: string | null; catalog_id: string; catalog_code: string; official_code: string; title: string; subject_area: string; stage: string; grade_level: number; availability_status: string; progress: number; has_lesson: boolean; question_count: number; active_session_id: string | null; active_session_status: string | null; reason: string }>,
  startGuidedSession: vi.fn().mockResolvedValue({ session_id: 'session-1' }),
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
  useStudentGuidedLearningTargets: () => ({ data: state.guidedTargets, isLoading: false, isError: false }),
  useStartGuidedLearningSessionV2: () => ({ mutateAsync: state.startGuidedSession, isPending: false }),
}));

vi.mock('../../hooks/useAdaptiveLearning', () => ({
  useStudentAdaptiveTarget: () => ({ data: state.adaptiveTarget, isLoading: false }),
}));

import StudyCenterPage from './StudyCenterPage';
import StudentSubjectPage from './StudentSubjectPage';

afterEach(() => {
  cleanup();
  state.activities = [];
  state.adaptiveTarget = null;
  state.guidedSession = null;
  state.guidedTargets = [];
  state.startGuidedSession.mockReset().mockResolvedValue({ session_id: 'session-1' });
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/student/study']}>
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
  it('mantém a home enxuta, com ENEM antes das matérias', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'O que você quer estudar?' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Matérias' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Matemática.*Abrir matéria/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Língua Portuguesa/ })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Módulo de redação' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Abrir módulo' }).getAttribute('href')).toBe('/student/study/writing');
    expect(screen.getByRole('link', { name: /Praticar/ }).getAttribute('href')).toBe('/student/study/simulation?simulation=simulation-1');
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

  it('permite recolher e reabrir a preparação para o ENEM', () => {
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

  it('permite recolher e reabrir a seção de matérias', () => {
    renderPage();

    const toggle = screen.getByRole('button', { name: /Matérias/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('link', { name: /Matemática.*Abrir matéria/ })).toBeTruthy();

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('link', { name: /Matemática.*Abrir matéria/ })).toBeNull();

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('link', { name: /Matemática.*Abrir matéria/ })).toBeTruthy();
  });

  it('abre a área própria da matéria ao clicar no card', () => {
    renderPage();

    fireEvent.click(screen.getAllByRole('link', { name: /Matemática/ }).find((link) => link.getAttribute('href') === '/student/study/subject/subject-math')!);

    expect(screen.getByRole('region', { name: 'Estudo de Matemática' })).toBeTruthy();
    expect(screen.getByText('Números')).toBeTruthy();
    expect(screen.queryByText('O que você quer estudar?')).toBeNull();
  });

  it('permite iniciar uma jornada BNCC global sem vínculo com matéria institucional', async () => {
    state.guidedTargets = [{
      target_canonical_skill_id: 'skill-history',
      subject_id: null,
      catalog_id: 'catalog-bncc',
      catalog_code: 'BNCC_2018',
      official_code: 'EF06HI01',
      title: 'Povos e culturas na Antiguidade',
      subject_area: 'História',
      stage: 'ENSINO_FUNDAMENTAL',
      grade_level: 6,
      availability_status: 'NO_ACTIVE_SESSION',
      progress: 0,
      has_lesson: true,
      question_count: 5,
      active_session_id: null,
      active_session_status: null,
      reason: 'Conteúdo disponível',
    }];

    renderPage();

    expect(screen.getByText(/EF06HI01/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Começar estudo' }));
    await waitFor(() => expect(state.startGuidedSession).toHaveBeenCalledWith('skill-history'));
  });

  it('mantém o alvo da jornada ao retomar um card ativo', () => {
    state.guidedTargets = [{
      target_canonical_skill_id: 'skill-nature',
      subject_id: null,
      catalog_id: 'catalog-bncc',
      catalog_code: 'BNCC_2018',
      official_code: 'EM13CNT101',
      title: 'Transformações e conservações',
      subject_area: 'CIENCIAS_DA_NATUREZA',
      stage: 'ENSINO_MEDIO',
      grade_level: 1,
      availability_status: 'DEMO_PREVIEW',
      progress: 20,
      has_lesson: true,
      question_count: 5,
      active_session_id: 'session-nature',
      active_session_status: 'ACTIVE',
      reason: 'Prévia demonstrativa',
    }];

    renderPage();

    expect(screen.getByRole('link', { name: 'Continuar' }).getAttribute('href')).toBe('/student/study/guided?skill=skill-nature');
  });
});
