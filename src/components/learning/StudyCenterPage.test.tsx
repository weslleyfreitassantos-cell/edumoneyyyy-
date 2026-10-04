// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  subjects: [
    { id: 'subject-math', name: 'Matemática' },
    { id: 'subject-portuguese', name: 'Língua Portuguesa' },
  ],
  simulations: [
    { id: 'enem-area', title: 'ENEM 2025 · MATEMATICA · prática oficial', simulation_type: 'AREA', area: 'MATEMATICA', source_year: 2025, question_count: 1, duration_minutes: 90, metadata: {}, learning_simulation_questions: [] },
    { id: 'enem-mini', title: 'ENEM 2025 · diagnóstico rápido', simulation_type: 'MINI', area: null, source_year: 2025, question_count: 1, duration_minutes: 25, metadata: {}, learning_simulation_questions: [] },
  ],
  adaptiveGuidance: null as null | {
    message: string;
    steps: Array<{ id: string; title: string }>;
  },
  adaptiveTarget: null as null | {
    institutionSkillId: string;
    canonicalSkillId: string;
    target: { subjectArea: string };
  },
  guidedSessionV2: null as null | { id: string; status: string; current_step?: { position?: number } | null },
  dailyPlan: null as null | {
    learning_daily_plan_items: Array<{
      id: string;
      title: string;
      estimated_minutes: number;
      status: string;
      activity_id: string | null;
      lesson_id: string | null;
      step_id: string | null;
    }>;
  },
  reviewsDue: [] as Array<{ id: string; canonical_skill_id: string | null; skill_title?: string | null }>,
  startGuidedSession: vi.fn().mockResolvedValue({ session_id: 'session-1' }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: { id: 'profile-1', full_name: 'Ana Estudante' },
  }),
}));

vi.mock('../../contexts/InstitutionContext', () => ({
  useInstitution: () => ({ currentInstitutionId: 'institution-1' }),
}));

vi.mock('../../hooks/useLearningCenter', () => ({
  useLearningStudent: () => ({ data: { id: 'student-1', profile_id: 'profile-1' }, isLoading: false }),
  useStudentLearningSubjects: () => ({ data: state.subjects, isLoading: false, isError: false }),
  useLearningUnits: () => ({
    data: [{ id: 'unit-1', subject_id: 'subject-math', title: 'Números', description: null, sort_order: 1 }],
    isLoading: false,
  }),
  useLearningSkills: () => ({
    data: [{ id: 'skill-1', unit_id: 'unit-1', title: 'Resolver problemas', description: null, sort_order: 1 }],
    isLoading: false,
  }),
  usePublishedLearningActivities: () => ({
    data: [
      {
        id: 'activity-1',
        subject_id: 'subject-math',
        unit_id: 'unit-1',
        skill_id: 'skill-1',
        teacher_id: 'teacher-1',
        title: 'Revisão de frações',
        description: null,
        activity_type: 'PRACTICE',
        status: 'PUBLISHED',
        subjects: { name: 'Matemática' },
        learning_questions: [],
      },
      {
        id: 'activity-2',
        subject_id: 'subject-portuguese',
        unit_id: null,
        skill_id: null,
        teacher_id: 'teacher-1',
        title: 'Leitura e interpretação',
        description: null,
        activity_type: 'PRACTICE',
        status: 'PUBLISHED',
        subjects: { name: 'Língua Portuguesa' },
        learning_questions: [],
      },
    ],
    isLoading: false,
    isFetching: false,
    isError: false,
  }),
  useStudentLearningCollections: () => ({
    data: [{
      id: 'collection-1',
      subject_id: 'subject-math',
      class_id: 'class-1',
      teacher_id: 'teacher-1',
      title: 'Apoio de Matemática',
      description: 'Materiais para revisar.',
      status: 'PUBLISHED',
      learning_resources: [{
        id: 'resource-1',
        collection_id: 'collection-1',
        title: 'Abrir material',
        description: null,
        provider: 'Fonte oficial',
        resource_type: 'LINK',
        source_url: 'https://example.com/material',
        thumbnail_url: null,
      }],
    }],
    isLoading: false,
  }),
  useLearningProgress: () => ({
    data: [{ skill_id: 'skill-1', mastery_percent: 60, status: 'IN_PROGRESS' }],
    isLoading: false,
  }),
  useLearningCanonicalProgress: () => ({ data: [], isLoading: false }),
  useLearningReviewsDue: () => ({ data: state.reviewsDue, isLoading: false }),
  useCompleteLearningDailyPlanItem: () => ({ mutate: vi.fn(), isPending: false }),
  useCompleteLearningSkillReview: () => ({ mutate: vi.fn(), isPending: false }),
  useLearningDailyPlan: () => ({ data: state.dailyPlan, isLoading: false }),
  useLearningGamification: () => ({ data: null, isLoading: false }),
  useLearningErrorNotebook: () => ({ data: [], isLoading: false }),
  useLearningSimulations: () => ({ data: state.simulations, isLoading: false }),
  useLearningSimulationAttempts: () => ({ data: [], isLoading: false }),
  useStudentLearningSimulationAssignments: () => ({ data: [], isLoading: false }),
  useStudentLearningPackages: () => ({
    data: [{
      id: 'package-1',
      package_id: 'package-1',
      class_id: 'class-1',
      student_id: 'student-1',
      due_at: null,
      learning_packages: {
        id: 'package-1',
        title: 'Percurso de Matemática',
        subject_area: 'MATEMATICA',
        learning_package_steps: [{ id: 'step-1', position: 0, title: 'Frações', lesson_id: 'lesson-1', activity_id: null }],
      },
    }],
    isLoading: false,
  }),
  useStartGuidedLearningSession: () => ({ mutate: vi.fn(), isPending: false }),
  useStartGuidedLearningSessionV2: () => ({ mutateAsync: state.startGuidedSession, isPending: false }),
  useGuidedLearningSessionV2: () => ({ data: state.guidedSessionV2, isLoading: false }),
  useGuidedLearningSession: () => ({ data: null, isLoading: false }),
}));

vi.mock('../../hooks/useAdaptiveLearning', () => ({
  useStudentAdaptiveTarget: () => ({ data: state.adaptiveTarget, isLoading: false }),
  useStudentAdaptiveGuidance: () => ({ data: state.adaptiveGuidance, isLoading: false }),
  useStudentAdaptiveV3Plan: () => ({ data: null, isLoading: false }),
}));

import StudyCenterPage from './StudyCenterPage';

afterEach(() => {
  cleanup();
  state.adaptiveGuidance = null;
  state.adaptiveTarget = null;
  state.guidedSessionV2 = null;
  state.dailyPlan = null;
  state.reviewsDue = [];
  state.startGuidedSession.mockReset().mockResolvedValue({ session_id: 'session-1' });
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/student/study']}>
      <Routes>
        <Route path="/student/study" element={<StudyCenterPage />} />
        <Route path="/student/study/guided" element={<p>Jornada guiada ativa</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('StudyCenterPage', () => {
  it('starts with the student greeting instead of repeating the page header', () => {
    renderPage();

    expect(screen.getByText('Olá, Ana. O que vamos estudar hoje?')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Central de Estudos' })).toBeNull();
    expect(screen.queryByText('Aluno')).toBeNull();
  });

  it('organizes the mobile journey without legacy KPI clutter', () => {
    renderPage();

    expect(screen.getByRole('region', { name: 'Para hoje' })).toBeTruthy();
    expect(screen.getAllByText('Revisão de frações').length).toBeGreaterThan(0);
    expect(screen.getByRole('searchbox', { name: 'Pesquisar matéria ou assunto' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Conteúdo recomendado' })).toBeTruthy();
    expect(screen.getByText('Percurso de Matemática')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Práticas' }).getAttribute('href')).toBe('#study-practice');
    expect(screen.getByRole('link', { name: 'Coleções' }).getAttribute('href')).toBe('#study-resources');
    expect(screen.getAllByText('Continuamos conhecendo seu perfil de aprendizagem.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1 atividade(s) disponíveis').length).toBeGreaterThan(0);
    expect(screen.queryByText(/atividade\(s\) para começar/)).toBeNull();
    expect(screen.queryByText('práticas disponíveis')).toBeNull();
    expect(screen.queryByText('domínio médio')).toBeNull();
  });

  it('reveals the ENEM hub with honest historical availability', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Explorar' }));
    expect(screen.getByText('Preparação ENEM')).toBeTruthy();
    expect(screen.getByText('Simulado rápido')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Provas anteriores' })).toBeTruthy();
    expect(screen.getByText(/Nenhuma prova histórica completa está publicada/)).toBeTruthy();
  });

  it('selects a subject locally, filters practices and clears the search', () => {
    renderPage();

    const search = screen.getByRole('searchbox', { name: 'Pesquisar matéria ou assunto' });
    fireEvent.change(search, { target: { value: 'mat' } });
    expect(screen.getByRole('button', { name: 'Limpar pesquisa' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar pesquisa' }));
    expect((search as HTMLInputElement).value).toBe('');

    fireEvent.click(screen.getByRole('button', { name: /Matemática/ }));
    expect(screen.getByRole('button', { name: /Matemática/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Minha trilha')).toBeTruthy();
    expect(screen.getAllByText('Revisão de frações').length).toBeGreaterThan(0);
    expect(screen.queryByText('Leitura e interpretação')).toBeNull();
  });

  it('finds a subject through the title of an available practice', () => {
    renderPage();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Pesquisar matéria ou assunto' }), {
      target: { value: 'frações' },
    });

    expect(screen.getByRole('button', { name: /Matemática/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Língua Portuguesa/ })).toBeNull();
  });

  it('shows adaptive guidance only when the backend has enough mapped evidence', () => {
    state.adaptiveGuidance = {
      message: 'Reforço recomendado — vamos fortalecer Frações para facilitar Função afim.',
      steps: [
        { id: 'fractions', title: 'Frações' },
        { id: 'linear-function', title: 'Função afim' },
      ],
    };
    renderPage();

    expect(screen.getByRole('region', { name: 'Seu próximo passo' })).toBeTruthy();
    expect(screen.getByText(/fortalecer Frações/)).toBeTruthy();
    expect(screen.getByText('Função afim')).toBeTruthy();
  });

  it('starts an adaptive session before navigating to the guided journey', async () => {
    state.adaptiveTarget = {
      institutionSkillId: 'institution-skill-1',
      canonicalSkillId: 'canonical-skill-1',
      target: { subjectArea: 'MATEMATICA' },
    };

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));

    await waitFor(() => expect(state.startGuidedSession).toHaveBeenCalledWith('canonical-skill-1'));
    expect(await screen.findByText('Jornada guiada ativa')).toBeTruthy();
    expect(screen.queryByText(/Nenhuma jornada guiada está ativa/)).toBeNull();
  });

  it('starts a review session when no guided session exists', async () => {
    state.reviewsDue = [{ id: 'review-1', canonical_skill_id: 'canonical-review-1', skill_title: 'Frações' }];

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }));

    await waitFor(() => expect(state.startGuidedSession).toHaveBeenCalledWith('canonical-review-1'));
    expect(await screen.findByText('Jornada guiada ativa')).toBeTruthy();
    expect(screen.queryByText(/Nenhuma jornada guiada está ativa/)).toBeNull();
  });

  it('keeps the guided-start error visible and does not navigate on failure', async () => {
    state.adaptiveTarget = {
      institutionSkillId: 'institution-skill-1',
      canonicalSkillId: 'canonical-skill-1',
      target: { subjectArea: 'MATEMATICA' },
    };
    state.startGuidedSession.mockRejectedValueOnce(new Error('start failed'));

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível iniciar esta jornada agora.');
    expect(screen.queryByText('Jornada guiada ativa')).toBeNull();
  });

  it('does not put completed daily plan items in the next-action queue', () => {
    state.dailyPlan = {
      learning_daily_plan_items: [{
        id: 'daily-completed',
        title: 'Atividade já concluída',
        estimated_minutes: 15,
        status: 'COMPLETED',
        activity_id: 'activity-1',
        lesson_id: null,
        step_id: null,
      }],
    };

    renderPage();

    expect(screen.queryByText('Atividade já concluída')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Revisar' })).toBeNull();
  });
});
