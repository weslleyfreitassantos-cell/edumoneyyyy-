// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const state = vi.hoisted(() => ({
  data: [] as Array<{
    id: string;
    subject_id: string;
    title: string;
    skill_id: string | null;
    description: string | null;
    created_at: string;
    subjects: { name: string };
    learning_questions: Array<{ id: string; sort_order: number }>;
  }>,
  isLoading: false,
  isError: false,
  progress: [] as Array<{ skill_id: string; mastery_percent: number; status: 'NOT_STARTED' | 'IN_PROGRESS' | 'MASTERED'; last_activity_at: string | null }>,
  refetch: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ profile: { id: 'student-profile' } }) }));
vi.mock('../../contexts/InstitutionContext', () => ({ useInstitution: () => ({ currentInstitutionId: 'institution-1' }) }));
vi.mock('../../hooks/useLearningCenter', () => ({
  useLearningStudent: () => ({ data: { id: 'student-1' } }),
  useLearningProgress: () => ({ data: state.progress }),
  usePublishedLearningActivities: () => ({ data: state.data, isLoading: state.isLoading, isError: state.isError, refetch: state.refetch }),
}));

import StudentPublishedActivitiesPage from './StudentPublishedActivitiesPage';

function renderPage() {
  return render(<MemoryRouter><StudentPublishedActivitiesPage /></MemoryRouter>);
}

afterEach(() => {
  cleanup();
  state.data = [];
  state.isLoading = false;
  state.isError = false;
  state.progress = [];
  state.refetch.mockClear();
});

describe('StudentPublishedActivitiesPage', () => {
  it('lists teacher-published exercises outside guided study', () => {
    state.data = [{
      id: 'activity-fractions',
      subject_id: 'subject-math',
      skill_id: 'skill-fractions',
      title: 'Frações no cotidiano',
      description: 'Resolva os exercícios publicados pela professora.',
      created_at: '2026-11-04T12:00:00.000Z',
      subjects: { name: 'Matemática' },
      learning_questions: [{ id: 'question-1', sort_order: 0 }, { id: 'question-2', sort_order: 1 }],
    }];
    state.progress = [{ skill_id: 'skill-fractions', mastery_percent: 80, status: 'MASTERED', last_activity_at: '2026-11-03T12:00:00.000Z' }];

    renderPage();

    expect(screen.getByRole('heading', { name: 'Atividades dos professores' })).toBeTruthy();
    expect(screen.getByText('Frações no cotidiano')).toBeTruthy();
    expect(screen.getByText('2 questões · Publicada em 4 de nov. de 2026')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Seu progresso nas atividades dos professores' }).textContent).toContain('Domínio registrado: 80% em 1 habilidade (1 consolidada)');
    expect(screen.getByRole('link', { name: 'Responder' }).getAttribute('href')).toBe('/student/study/activity/activity-fractions');
  });

  it('searches by activity or subject and filters by subject', () => {
    state.data = [
      { id: 'activity-fractions', subject_id: 'subject-math', title: 'Frações', skill_id: null, description: null, created_at: '2026-11-04T12:00:00.000Z', subjects: { name: 'Matemática' }, learning_questions: [] },
      { id: 'activity-grammar', subject_id: 'subject-portuguese', title: 'Leitura e interpretação', skill_id: null, description: null, created_at: '2026-11-04T12:00:00.000Z', subjects: { name: 'Língua Portuguesa' }, learning_questions: [] },
    ];

    renderPage();

    fireEvent.change(screen.getByRole('textbox', { name: 'Pesquisar atividades' }), { target: { value: 'interpretação' } });
    expect(screen.getByText('Leitura e interpretação')).toBeTruthy();
    expect(screen.queryByText('Frações')).toBeNull();

    fireEvent.change(screen.getByRole('textbox', { name: 'Pesquisar atividades' }), { target: { value: '' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por matéria' }), { target: { value: 'subject-math' } });
    expect(screen.getByText('Frações')).toBeTruthy();
    expect(screen.queryByText('Leitura e interpretação')).toBeNull();
  });

  it('shows separate empty, loading, and retryable error states', () => {
    renderPage();
    expect(screen.getByText('Nenhuma atividade publicada')).toBeTruthy();

    cleanup();
    state.isLoading = true;
    renderPage();
    expect(screen.getByRole('status').textContent).toContain('Carregando atividades...');

    cleanup();
    state.isLoading = false;
    state.isError = true;
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(state.refetch).toHaveBeenCalledOnce();
  });
});
