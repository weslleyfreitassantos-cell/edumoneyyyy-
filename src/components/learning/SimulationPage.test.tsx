// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  attempts: [] as Array<Record<string, unknown>>,
  attemptDetail: null as Record<string, unknown> | null,
  saveNavigation: vi.fn().mockResolvedValue({}),
  submit: vi.fn().mockResolvedValue({ score: 50, correct_count: 1, total_questions: 2, area_breakdown: {} }),
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ profile: { id: 'profile-1' } }) }));
vi.mock('../../contexts/InstitutionContext', () => ({ useInstitution: () => ({ currentInstitutionId: 'institution-1' }) }));
vi.mock('../../hooks/useLearningCenter', () => ({
  useLearningStudent: () => ({ data: { id: 'student-1' }, isLoading: false }),
  useEnemSimulationTemplates: () => ({ data: [{ id: 'simulation-1', title: 'Matemática', simulation_type: 'SUBJECT', area: null, subject: 'MATEMATICA', question_count: 2, duration_minutes: 20, available_count: 2, language_options: [], metadata: {} }], isLoading: false }),
  useEnemSimulationAttempt: (attemptId: string | null) => ({ data: attemptId ? (state.attemptDetail ?? { attempt_id: attemptId, simulation_id: 'simulation-1', status: 'IN_PROGRESS', started_at: new Date().toISOString(), questions: [{ position: 1, question_bank_id: 'question-1', options: ['Uma', 'Duas'], statement_assets: [] }, { position: 2, question_bank_id: 'question-2', options: ['Três', 'Quatro'], statement_assets: [] }], answers: {}, navigation_state: null }) : undefined, isLoading: false, isError: false }),
  useLearningSimulationAttempts: () => ({ data: state.attempts, isLoading: false }),
  useStartEnemSimulation: () => ({ mutateAsync: vi.fn().mockResolvedValue({ attempt_id: 'attempt-1', created: true, question_count: 2, language_choice: null }), isPending: false }),
  useSaveEnemSimulationAnswers: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
  useSaveLearningSimulationNavigation: () => ({ mutateAsync: state.saveNavigation, isPending: false }),
  useSubmitEnemSimulation: () => ({ mutateAsync: state.submit, isPending: false, isError: false, error: null }),
}));

import SimulationPage from './SimulationPage';

afterEach(() => {
  cleanup();
  state.attempts = [];
  state.attemptDetail = null;
  state.saveNavigation.mockClear();
  state.submit.mockClear();
});

function renderPage() {
  return render(<MemoryRouter><SimulationPage /></MemoryRouter>);
}

describe('SimulationPage', () => {
  it('offers navigator, persistent flagging and final review', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Começar prática' }));

    expect(await screen.findByRole('navigation', { name: 'Navegador da prática' })).toBeTruthy();
    const flag = screen.getByRole('button', { name: 'Marcar questão para revisar' });
    fireEvent.click(flag);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remover marcação da questão' }).getAttribute('aria-pressed')).toBe('true'));
    await waitFor(() => expect(state.saveNavigation).toHaveBeenCalledWith({ attemptId: 'attempt-1', navigation: { current_index: 0, flagged: ['question-1'] } }));

    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(screen.getByText((_, element) => element?.tagName === 'P' && element.textContent?.includes('Questão 2 de 2') === true)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Revisar e finalizar' }));
    expect(screen.getByRole('region', { name: 'Revisão final' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Revisão final' }).textContent).toContain('não respondidas');
  });

  it('restores answers and flags from an open attempt', async () => {
    state.attempts = [{
      id: 'attempt-1',
      simulation_id: 'simulation-1',
      status: 'IN_PROGRESS',
      started_at: new Date(Date.now() - 60_000).toISOString(),
      navigation_state: { current_index: 1, flagged: ['question-2'] },
      answers: { 'question-1': { answer: 'A' } },
    }];
    state.attemptDetail = {
      attempt_id: 'attempt-1', simulation_id: 'simulation-1', status: 'IN_PROGRESS', started_at: new Date(Date.now() - 60_000).toISOString(),
      navigation_state: { current_index: 1, flagged: ['question-2'] }, answers: { 'question-1': { answer: 'A' } },
      questions: [{ position: 1, question_bank_id: 'question-1', options: ['Uma', 'Duas'], statement_assets: [] }, { position: 2, question_bank_id: 'question-2', options: ['Três', 'Quatro'], statement_assets: [] }],
    };
    renderPage();

    expect(await screen.findByText((_, element) => element?.tagName === 'P' && element.textContent?.includes('Questão 2 de 2') === true)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remover marcação da questão' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText((_, element) => element?.tagName === 'P' && element.textContent?.includes('1 respondida(s)') === true)).toBeTruthy();
  });
});
