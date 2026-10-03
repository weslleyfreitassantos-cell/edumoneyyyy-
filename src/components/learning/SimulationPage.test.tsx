// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  attempts: [] as Array<Record<string, unknown>>,
  saveNavigation: vi.fn().mockResolvedValue({}),
  submit: vi.fn().mockResolvedValue({ score: 50, correct_count: 1, total_questions: 2, area_breakdown: {} }),
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ profile: { id: 'profile-1' } }) }));
vi.mock('../../contexts/InstitutionContext', () => ({ useInstitution: () => ({ currentInstitutionId: 'institution-1' }) }));
vi.mock('../../hooks/useLearningCenter', () => ({
  useLearningStudent: () => ({ data: { id: 'student-1' }, isLoading: false }),
  useLearningSimulations: () => ({ data: [{ id: 'simulation-1', title: 'ENEM diagnóstico', simulation_type: 'MINI', duration_minutes: 20, learning_simulation_questions: [
    { position: 1, learning_question_bank: { id: 'question-1', statement: 'Questão um', options: ['A', 'B'] } },
    { position: 2, learning_question_bank: { id: 'question-2', statement: 'Questão dois', options: ['C', 'D'] } },
  ] }], isLoading: false }),
  useLearningSimulationAttempts: () => ({ data: state.attempts, isLoading: false }),
  useStartLearningSimulation: () => ({ mutateAsync: vi.fn().mockResolvedValue('attempt-1'), isPending: false }),
  useSaveLearningSimulationAnswers: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
  useSaveLearningSimulationNavigation: () => ({ mutateAsync: state.saveNavigation, isPending: false }),
  useSubmitLearningSimulation: () => ({ mutateAsync: state.submit, isPending: false, isError: false, error: null }),
}));

import SimulationPage from './SimulationPage';

afterEach(() => {
  cleanup();
  state.attempts = [];
  state.saveNavigation.mockClear();
  state.submit.mockClear();
});

function renderPage() {
  return render(<MemoryRouter><SimulationPage /></MemoryRouter>);
}

describe('SimulationPage', () => {
  it('offers navigator, persistent flagging and final review', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Começar simulado' }));

    expect(await screen.findByRole('navigation', { name: 'Navegador do simulado' })).toBeTruthy();
    const flag = screen.getByRole('button', { name: 'Marcar questão para revisar' });
    fireEvent.click(flag);
    expect(flag.getAttribute('aria-pressed')).toBe('true');
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
    renderPage();

    expect(await screen.findByText((_, element) => element?.tagName === 'P' && element.textContent?.includes('Questão 2 de 2') === true)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remover marcação da questão' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText((_, element) => element?.tagName === 'P' && element.textContent?.includes('1 respondida(s)') === true)).toBeTruthy();
  });
});
