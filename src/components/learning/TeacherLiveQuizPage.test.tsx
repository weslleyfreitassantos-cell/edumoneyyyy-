// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
});
