// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import TeacherLiveQuizPage from './TeacherLiveQuizPage';

const quizMock = vi.hoisted(() => ({
  teacherOptions: vi.fn(),
  state: vi.fn(),
  subscribe: vi.fn(),
  createGame: vi.fn(),
  start: vi.fn(),
  advance: vi.fn(),
  controlReveal: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { id: 'teacher-1' } }),
}));

vi.mock('../../contexts/InstitutionContext', () => ({
  useInstitution: () => ({ currentInstitutionId: 'school-1' }),
}));

vi.mock('../../services/tecQuizLiveService', () => ({
  humanizeTecQuizError: () => 'Falha no Tec Quiz.',
  tecQuizLiveService: quizMock,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/teacher/classroom/live-quiz']}>
        <TeacherLiveQuizPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TeacherLiveQuizPage', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    quizMock.teacherOptions.mockResolvedValue([{
      activity_id: 'activity-1',
      activity_title: 'Revisão de frações',
      subject_name: 'Matemática',
      class_id: 'class-1',
      class_name: '7º A',
      question_count: 3,
    }]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('exibe atividades publicadas elegíveis e a turma vinculada', async () => {
    renderPage();

    expect(await screen.findByRole('option', {
      name: 'Matemática · Revisão de frações (3 questões)',
    })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Atividade publicada'), {
      target: { value: 'activity-1' },
    });
    expect(screen.getByRole('option', { name: '7º A' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Criar sala e gerar PIN/i })).toBeTruthy();
  });

  it('permite pausar a revelação e avançar diretamente para a próxima pergunta', async () => {
    window.sessionStorage.setItem('tec-quiz-teacher-game-v1', 'game-1');
    quizMock.subscribe.mockReturnValue(() => {});
    quizMock.state.mockResolvedValue({
      game_id: 'game-1',
      pin: '123456',
      status: 'INTERMISSION',
      viewer_role: 'TEACHER',
      activity_title: 'Revisão de frações',
      question_index: 1,
      total_questions: 3,
      time_per_question_seconds: 20,
      round_deadline_at: new Date(Date.now() + 15_000).toISOString(),
      server_now: new Date().toISOString(),
      reveal_paused_at: null,
      round_response_count: 2,
      participant_count: 2,
      can_advance: false,
      participants: [{ alias: 'Aluno 01' }],
      question: {
        index: 1,
        total: 3,
        text: 'Quanto é 2 + 2?',
        type: 'MULTIPLE_CHOICE',
        options: ['3', '4'],
        deadline_at: null,
        correct_option_index: 1,
        explanation: 'Somamos duas unidades a duas unidades.',
      },
      my_answer: null,
      leaderboard: [],
      report: null,
    });
    quizMock.controlReveal.mockResolvedValue({
      game_id: 'game-1',
      status: 'INTERMISSION',
      question_index: 1,
      round_deadline_at: new Date(Date.now() + 15_000).toISOString(),
      reveal_paused_at: new Date().toISOString(),
    });

    renderPage();

    expect(await screen.findByRole('timer')).toBeTruthy();
    expect(screen.queryByText('PIN de entrada')).toBeNull();
    expect(screen.queryByText('123456')).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Pausar' }));
    await waitFor(() => expect(quizMock.controlReveal).toHaveBeenCalledWith('game-1', 'PAUSE'));
    fireEvent.click(screen.getByRole('button', { name: 'Avançar agora' }));
    await waitFor(() => expect(quizMock.controlReveal).toHaveBeenCalledWith('game-1', 'ADVANCE'));
  });
});
