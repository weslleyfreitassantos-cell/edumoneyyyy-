// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const quizMock = vi.hoisted(() => ({
  myCurrentGame: vi.fn(),
  state: vi.fn(),
  subscribe: vi.fn(),
  answer: vi.fn(),
  join: vi.fn(),
  tick: vi.fn(),
  onChange: null as null | (() => void),
}));

vi.mock('../../services/tecQuizLiveService', () => ({
  humanizeTecQuizError: () => 'Falha no Tec Quiz.',
  tecQuizLiveService: {
    myCurrentGame: quizMock.myCurrentGame,
    state: quizMock.state,
    subscribe: quizMock.subscribe,
    answer: quizMock.answer,
    join: quizMock.join,
    tick: quizMock.tick,
  },
}));

import StudentLiveQuizPage from './StudentLiveQuizPage';

function gameState(questionIndex: number) {
  const serverNow = new Date().toISOString();
  return {
    game_id: 'game-1',
    pin: null,
    status: 'IN_PROGRESS',
    viewer_role: 'STUDENT',
    activity_title: 'Revisão de matemática',
    question_index: questionIndex,
    total_questions: 3,
    time_per_question_seconds: 20,
    round_deadline_at: new Date(Date.now() + 60_000).toISOString(),
    server_now: serverNow,
    reveal_paused_at: null,
    round_response_count: null,
    participant_count: 2,
    can_advance: false,
    participants: [{ alias: 'Aluno 01' }, { alias: 'Aluno 02' }],
    question: {
      index: questionIndex,
      total: 3,
      text: `Pergunta de teste ${questionIndex}`,
      type: 'MULTIPLE_CHOICE',
      options: ['Opção A', 'Opção B'],
      deadline_at: new Date(Date.now() + 60_000).toISOString(),
    },
    my_answer: null,
    leaderboard: [],
    report: null,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <StudentLiveQuizPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

describe('StudentLiveQuizPage', () => {
  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.clearAllMocks();
    quizMock.onChange = null;
  });

  it('submits the answer with the exact question shown to the student', async () => {
    window.sessionStorage.setItem('tec-quiz-student-game-v1', 'game-1');
    quizMock.state.mockResolvedValue(gameState(2));
    quizMock.subscribe.mockImplementation((_gameId: string, onChange: () => void) => {
      quizMock.onChange = onChange;
      return () => {};
    });
    quizMock.answer.mockResolvedValue({ accepted: true, already_submitted: false });

    renderPage();

    await screen.findByText('Pergunta de teste 2');
    fireEvent.click(screen.getByRole('button', { name: /Opção A/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar resposta/i }));

    await waitFor(() => expect(quizMock.answer).toHaveBeenCalledWith('game-1', 2, 0));
  });

  it('clears an unsubmitted choice when the server moves to the next question', async () => {
    window.sessionStorage.setItem('tec-quiz-student-game-v1', 'game-1');
    quizMock.state.mockResolvedValueOnce(gameState(1)).mockResolvedValueOnce(gameState(2));
    quizMock.subscribe.mockImplementation((_gameId: string, onChange: () => void) => {
      quizMock.onChange = onChange;
      return () => {};
    });

    const { queryClient } = renderPage();
    await screen.findByText('Pergunta de teste 1');
    fireEvent.click(screen.getByRole('button', { name: /Opção B/i }));
    expect(screen.getByRole('button', { name: /Opção B/i }).getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      quizMock.onChange?.();
      await queryClient.invalidateQueries({ queryKey: ['tec-quiz-live', 'state', 'game-1'] });
    });

    await screen.findByText('Pergunta de teste 2');
    expect(screen.getByRole('button', { name: /Opção B/i }).getAttribute('aria-pressed')).toBe('false');
  });
});
