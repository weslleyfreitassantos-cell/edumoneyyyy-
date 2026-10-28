// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getMap: vi.fn(),
  getLearningHome: vi.fn(),
  getSkillReviewQueue: vi.fn(),
  startSkillReview: vi.fn(),
  submitSkillReview: vi.fn(),
  startLesson: vi.fn(),
  getSession: vi.fn(),
  submitAnswer: vi.fn(),
}));

vi.mock('../../contexts/InstitutionContext', () => ({ useInstitution: () => ({ currentInstitutionId: 'institution-1' }) }));
vi.mock('../../services/tecEnglishService', () => ({
  tecEnglishService: api,
  isMissingTecEnglishRpc: (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'PGRST202'),
}));

import EnglishLearningPage from './EnglishLearningPage';
import type { EnglishAnswerResult, EnglishCourseMap, EnglishLessonSession } from '../../services/tecEnglishService';

function makeMap(firstStatus: EnglishCourseMap['units'][number]['lessons'][number]['status'] = 'AVAILABLE'): EnglishCourseMap {
  return {
    course: { code: 'TEC_ENGLISH_FOUNDATIONS', title: 'Inglês para começar', description: 'Frases para usar no dia a dia.', version: 1, publication_status: 'STAGING', review_status: 'PEDAGOGICAL_REVIEW_PENDING' },
    units: Array.from({ length: 3 }, (_, unitIndex) => ({
      id: `unit-${unitIndex + 1}`, position: unitIndex + 1, title: `Unidade ${unitIndex + 1}`, description: 'Prática de inglês.',
      lessons: Array.from({ length: 4 }, (_, lessonIndex) => {
        const position = unitIndex * 4 + lessonIndex + 1;
        return { id: `lesson-${position}`, position: lessonIndex + 1, title: `Lição ${position}`, status: position === 1 ? firstStatus : 'LOCKED', exercise_count: 7, xp_reward: 30, active_session_id: position === 1 && firstStatus === 'IN_PROGRESS' ? 'session-1' : null, completed_at: null };
      }),
    })),
    stats: { xp: 0, current_streak: 0, longest_streak: 0, last_study_date: null },
    completed_lessons: 0,
    total_lessons: 12,
    continue_lesson_id: 'lesson-1',
  };
}

const exercise = { id: 'exercise-1', position: 1, type: 'MULTIPLE_CHOICE' as const, instruction: 'Escolha a frase correta.', prompt: 'Como dizer “Bom dia, turma.” em inglês?', options: ['Good morning, class.', 'Good night, class.'], word_bank: [], left_items: [], right_items: [], audio_text: null };

function makeSession(currentPosition = 1): EnglishLessonSession {
  return { session_id: 'session-1', lesson_id: 'lesson-1', lesson_title: 'Cumprimentos', lesson_intro: 'Aprenda a cumprimentar alguém.', unit_title: 'Primeiras palavras', status: 'IN_PROGRESS', current_position: currentPosition, total_exercises: 7, exercise: { ...exercise, position: currentPosition, id: `exercise-${currentPosition}`, type: currentPosition === 2 ? 'WORD_ORDER' : 'MULTIPLE_CHOICE', prompt: currentPosition === 2 ? 'Monte: “Meu nome é Ana.”' : exercise.prompt, word_bank: currentPosition === 2 ? ['Ana.', 'is', 'name', 'My'] : [] } };
}

function renderPage() {
  return render(<MemoryRouter initialEntries={['/student/study/english']}><EnglishLearningPage /></MemoryRouter>);
}

function answerResult(overrides: Partial<EnglishAnswerResult> = {}): EnglishAnswerResult {
  return { is_correct: true, feedback: 'Muito bem! Você acertou.', explanation: 'Boa resposta.', session_complete: false, next_position: 2, total_exercises: 7, xp_awarded: 0, total_xp: 0, current_streak: 0, next_exercise: null, ...overrides };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  api.getMap.mockResolvedValue(makeMap());
  api.getLearningHome.mockResolvedValue({ due_reviews: 0, due_skills: [], weak_skills: [], stats: { xp: 0, current_streak: 0, longest_streak: 0, last_study_date: null } });
  api.getSkillReviewQueue.mockResolvedValue([]);
  api.startSkillReview.mockResolvedValue({ skill_code: 'routine_time', label: 'Horários da rotina', mastery_score: 20, difficulty_level: 1, exercise: { id: 'review-1', position: 1, type: 'MULTIPLE_CHOICE', instruction: 'Escolha', prompt: 'What time is it?', options: ['Seven o’clock'], word_bank: [], left_items: [], right_items: [], audio_text: null } });
  api.submitSkillReview.mockResolvedValue({ is_correct: true, feedback: 'Muito bem! Revisão concluída.', explanation: 'A resposta está correta.', skill_code: 'routine_time', mastery_score: 28, difficulty_level: 1, next_review_at: '2026-10-27T00:00:00Z' });
  api.startLesson.mockResolvedValue(makeSession());
  api.getSession.mockResolvedValue(makeSession());
  api.submitAnswer.mockResolvedValue(answerResult());
});

describe('EnglishLearningPage', () => {
  it('mostra somente o mapa do curso de inglês e mantém o conteúdo pendente bloqueado', async () => {
    api.getMap.mockResolvedValue(makeMap('REVIEW_PENDING'));
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Lições de inglês' })).toBeTruthy();
    expect(screen.getAllByRole('heading', { name: /Unidade [123]/ })).toHaveLength(3);
    expect(screen.getAllByText(/Lição [0-9]+/)).toHaveLength(12);
    expect(screen.getByText(/em revisão pedagógica/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Aguardando revisão' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText(/Plano diário|Química|Biologia|Caderno de Erros|V9/i)).toBeNull();
  });

  it('mantém o percurso V1 disponível e informa falhas inesperadas dos RPCs adaptativos', async () => {
    api.getMap.mockResolvedValue({ ...makeMap(), additional_courses: [], additional_courses_error: true });
    api.getLearningHome.mockRejectedValue(new Error('statement timeout'));
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Lições de inglês' })).toBeTruthy();
    expect(screen.getByText(/Não foi possível verificar a disponibilidade do curso adaptativo/)).toBeTruthy();
    expect(screen.getByText(/Não foi possível atualizar suas revisões adaptativas/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Começar próxima lição' })).toBeTruthy();
  });

  it('exibe o próximo exercício de revisão e conclui a revisão por habilidade', async () => {
    api.getLearningHome.mockResolvedValue({
      due_reviews: 1,
      due_skills: [{ skill_code: 'routine_time', label: 'Horários da rotina', mastery_score: 20, difficulty_level: 1 }],
      weak_skills: [{ skill_code: 'routine_time', label: 'Horários da rotina', mastery_score: 20, difficulty_level: 1 }],
      stats: { xp: 0, current_streak: 0, longest_streak: 0, last_study_date: null },
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Começar revisão de Horários da rotina' }));
    expect(await screen.findByRole('heading', { name: 'Horários da rotina' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Seven o’clock/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Conferir resposta' }));
    expect(await screen.findByText('Muito bem! Revisão concluída.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Concluir revisão' })).toBeTruthy();
    expect(api.submitSkillReview).toHaveBeenCalledWith('institution-1', 'routine_time', { choice: 'Seven o’clock' }, expect.any(String));
  });

  it('encaminha as aulas da nova unidade ao serviço V2 sem mudar o contrato V1', async () => {
    const base = makeMap();
    const v2: EnglishCourseMap = {
      ...makeMap(),
      course: { code: 'TEC_ENGLISH_FOUNDATIONS_V2', title: 'Inglês em conversas do cotidiano', description: 'Rotina e conversas.', version: 2, publication_status: 'STAGING', review_status: 'PEDAGOGICAL_REVIEW_PENDING' },
      units: [{ id: 'v2-unit', position: 4, title: 'Minha rotina', description: 'Fale sobre sua rotina.', lessons: [{ ...makeMap().units[0].lessons[0], id: 'v2-lesson', course_code: 'TEC_ENGLISH_FOUNDATIONS_V2', position: 1, title: 'Meu dia começa', status: 'AVAILABLE' }] }],
      total_lessons: 1,
      completed_lessons: 0,
      continue_lesson_id: 'v2-lesson',
    };
    api.getMap.mockResolvedValue({ ...base, additional_courses: [v2] });
    api.startLesson.mockResolvedValue({ ...makeSession(), lesson_id: 'v2-lesson', lesson_title: 'Meu dia começa', course_code: 'TEC_ENGLISH_FOUNDATIONS_V2' });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Inglês em conversas do cotidiano' })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Começar lição' })[1]);
    await screen.findByRole('heading', { name: 'Meu dia começa' });
    expect(api.startLesson).toHaveBeenCalledWith('institution-1', 'v2-lesson', 'TEC_ENGLISH_FOUNDATIONS_V2');
  });

  it('abre uma lição disponível e mostra os desafios originais do curso', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Lições de inglês' });
    fireEvent.click(screen.getByRole('button', { name: 'Começar próxima lição' }));

    expect(await screen.findByRole('heading', { name: 'Cumprimentos' })).toBeTruthy();
    expect(screen.getByText('Aprenda a cumprimentar alguém.')).toBeTruthy();
    expect(screen.getByText('7 desafios curtos')).toBeTruthy();
    expect(api.startLesson).toHaveBeenCalledWith('institution-1', 'lesson-1');
  });

  it('gera uma chave nova após uma resposta errada e permite tentar novamente', async () => {
    const randomUUID = vi.fn().mockReturnValueOnce('wrong-attempt-key').mockReturnValueOnce('correct-attempt-key');
    vi.stubGlobal('crypto', { randomUUID });
    api.submitAnswer
      .mockResolvedValueOnce(answerResult({ is_correct: false, feedback: 'Quase! Revise a dica e tente novamente.' }))
      .mockResolvedValueOnce(answerResult());
    renderPage();
    await screen.findByRole('heading', { name: 'Lições de inglês' });
    fireEvent.click(screen.getByRole('button', { name: 'Começar próxima lição' }));
    await screen.findByRole('heading', { name: 'Cumprimentos' });
    fireEvent.click(screen.getByRole('button', { name: 'Começar os desafios' }));

    fireEvent.click(await screen.findByRole('button', { name: /Good night, class\./ }));
    fireEvent.click(screen.getByRole('button', { name: 'Conferir resposta' }));
    expect(await screen.findByText('Quase! Revise a dica e tente novamente.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    fireEvent.click(screen.getByRole('button', { name: /Good morning, class\./ }));
    fireEvent.click(screen.getByRole('button', { name: 'Conferir resposta' }));

    await waitFor(() => expect(api.submitAnswer).toHaveBeenCalledTimes(2));
    expect(api.submitAnswer.mock.calls[0][4]).toBe('wrong-attempt-key');
    expect(api.submitAnswer.mock.calls[1][4]).toBe('correct-attempt-key');
  });

  it('reutiliza a chave quando a resposta da primeira chamada falha na rede', async () => {
    const randomUUID = vi.fn().mockReturnValue('retry-safe-key');
    vi.stubGlobal('crypto', { randomUUID });
    api.submitAnswer.mockRejectedValueOnce(new Error('network timeout')).mockResolvedValueOnce(answerResult());
    renderPage();
    await screen.findByRole('heading', { name: 'Lições de inglês' });
    fireEvent.click(screen.getByRole('button', { name: 'Começar próxima lição' }));
    await screen.findByRole('heading', { name: 'Cumprimentos' });
    fireEvent.click(screen.getByRole('button', { name: 'Começar os desafios' }));

    fireEvent.click(await screen.findByRole('button', { name: /Good morning, class\./ }));
    fireEvent.click(screen.getByRole('button', { name: 'Conferir resposta' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Conferir resposta' }));

    await waitFor(() => expect(api.submitAnswer).toHaveBeenCalledTimes(2));
    expect(api.submitAnswer.mock.calls[0][4]).toBe('retry-safe-key');
    expect(api.submitAnswer.mock.calls[1][4]).toBe('retry-safe-key');
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it('retoma a posição persistida sem reiniciar a introdução', async () => {
    api.getMap.mockResolvedValue(makeMap('IN_PROGRESS'));
    api.startLesson.mockResolvedValue(makeSession(2));
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Lições de inglês' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar de onde parei' }));

    expect(await screen.findByText('Desafio 2 de 7')).toBeTruthy();
    expect(screen.getByText('Monte: “Meu nome é Ana.”')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Começar os desafios' })).toBeNull();
  });
});
