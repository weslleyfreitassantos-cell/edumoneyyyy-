// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getMap: vi.fn(),
  startLesson: vi.fn(),
  getSession: vi.fn(),
  submitAnswer: vi.fn(),
}));

const identity = vi.hoisted(() => ({ profileId: 'student-1', institutionId: 'institution-1' }));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ profile: { id: identity.profileId } }) }));
vi.mock('../../contexts/InstitutionContext', () => ({ useInstitution: () => ({ currentInstitutionId: identity.institutionId }) }));
vi.mock('../../services/tecEnglishService', () => ({
  tecEnglishService: api,
  tecLanguageDisplayName: (code?: string) => code?.includes('SPANISH') ? 'Espanhol' : code?.includes('KOREAN') ? 'Coreano' : 'Inglês',
  tecLanguageLocale: (code?: string) => code?.includes('SPANISH') ? 'es-ES' : code?.includes('KOREAN') ? 'ko-KR' : 'en-US',
}));

import EnglishLearningPage from './EnglishLearningPage';
import type { EnglishAnswerResult, EnglishCourseMap, EnglishLessonSession } from '../../services/tecEnglishService';

const COURSE_CODES = {
  english: 'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION',
  spanish: 'TEC_SPANISH_FOUNDATIONS_V1',
  korean: 'TEC_KOREAN_FOUNDATIONS_V1',
} as const;

function makeMap(
  courseCode: string = COURSE_CODES.english,
  firstStatus: EnglishCourseMap['units'][number]['lessons'][number]['status'] = 'AVAILABLE',
  metrics: { completedLessons?: number; xp?: number } = {},
): EnglishCourseMap {
  const isEnglish = courseCode === COURSE_CODES.english;
  const title = courseCode === COURSE_CODES.spanish ? 'Espanhol para começar'
    : courseCode === COURSE_CODES.korean ? 'Coreano para começar' : 'Inglês para começar';
  const unitCount = isEnglish ? 4 : 2;
  const lessonsPerUnit = 4;
  return {
    course: { code: courseCode, title, description: 'Frases para usar no dia a dia.', version: 1, publication_status: 'STAGING', review_status: 'PEDAGOGICAL_REVIEW_PENDING' },
    units: Array.from({ length: unitCount }, (_, unitIndex) => ({
      id: `${courseCode}-unit-${unitIndex + 1}`, position: unitIndex + 1, title: `Unidade ${unitIndex + 1}`, description: 'Prática de idiomas.',
      lessons: Array.from({ length: lessonsPerUnit }, (_, lessonIndex) => {
        const position = unitIndex * lessonsPerUnit + lessonIndex + 1;
        const status = position <= (metrics.completedLessons ?? 0)
          ? 'COMPLETED'
          : position === (metrics.completedLessons ?? 0) + 1 ? firstStatus : 'LOCKED';
        return {
          id: `${courseCode}-lesson-${position}`, course_code: courseCode,
          position: lessonIndex + 1, title: `Lição ${position}`,
          status, exercise_count: 7, xp_reward: 30,
          active_session_id: status === 'IN_PROGRESS' ? 'session-1' : null,
          completed_at: status === 'COMPLETED' ? '2026-10-27T12:00:00Z' : null,
        };
      }),
    })),
    stats: { xp: metrics.xp ?? 0, current_streak: 0, longest_streak: 0, last_study_date: null },
    completed_lessons: metrics.completedLessons ?? 0,
    total_lessons: unitCount * lessonsPerUnit,
    continue_lesson_id: `${courseCode}-lesson-1`,
  };
}

const exercise = { id: 'exercise-1', position: 1, type: 'MULTIPLE_CHOICE' as const, instruction: 'Escolha a frase correta.', prompt: 'Como dizer “Bom dia, turma.” em inglês?', options: ['Good morning, class.', 'Good night, class.'], word_bank: [], left_items: [], right_items: [], audio_text: null };

function makeSession(currentPosition = 1): EnglishLessonSession {
  return {
    session_id: 'session-1', lesson_id: `${COURSE_CODES.english}-lesson-1`, course_code: COURSE_CODES.english,
    lesson_title: 'Cumprimentos', lesson_intro: 'Aprenda a cumprimentar alguém.', unit_title: 'Primeiras palavras',
    status: 'IN_PROGRESS', current_position: currentPosition, total_exercises: 7,
    exercise: { ...exercise, position: currentPosition, id: `exercise-${currentPosition}`, type: currentPosition === 2 ? 'WORD_ORDER' : 'MULTIPLE_CHOICE', prompt: currentPosition === 2 ? 'Monte: “Meu nome é Ana.”' : exercise.prompt, word_bank: currentPosition === 2 ? ['Ana.', 'is', 'name', 'My'] : [] },
  };
}

function renderPage() {
  return render(<MemoryRouter initialEntries={['/student/study/idiomas']}><EnglishLearningPage /></MemoryRouter>);
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
  identity.profileId = 'student-1';
  identity.institutionId = 'institution-1';
  window.localStorage.clear();
  api.getMap.mockResolvedValue(makeMap());
  api.startLesson.mockResolvedValue(makeSession());
  api.getSession.mockResolvedValue(makeSession());
  api.submitAnswer.mockResolvedValue(answerResult());
});

describe('EnglishLearningPage · Tec Idiomas estudante', () => {
  it('mostra Tec Idiomas sem exigir aprovação/release e mantém o conteúdo íntegro em STAGING', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Inglês' })).toBeTruthy();
    const trigger = screen.getByRole('button', { name: 'Escolher idioma: Inglês' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Escolher idioma: Espanhol' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Escolher idioma: Coreano' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Começar' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Inglês para começar' })).toBeNull();
    expect(screen.queryByText('Frases para usar no dia a dia.')).toBeNull();
    expect(screen.queryByText(/revisão pedagógica|aprovação pedagógica|liberado quando o conteúdo/i)).toBeNull();
    expect(screen.queryByText(/Plano diário|Química|Biologia|Caderno de Erros|V9/i)).toBeNull();
  });

  it('troca o mapa e as métricas quando o estudante escolhe espanhol ou coreano', async () => {
    api.getMap.mockResolvedValue({
      ...makeMap(COURSE_CODES.english, 'AVAILABLE', { completedLessons: 2, xp: 35 }),
      additional_courses: [
        makeMap(COURSE_CODES.spanish, 'AVAILABLE', { completedLessons: 1, xp: 45 }),
        makeMap(COURSE_CODES.korean, 'IN_PROGRESS', { completedLessons: 2, xp: 90 }),
      ],
    });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Inglês' })).toBeTruthy();
    const trigger = screen.getByRole('button', { name: 'Escolher idioma: Inglês' });
    fireEvent.click(trigger);
    expect(screen.getByRole('option', { name: 'Espanhol, 8 lições · 1 concluídas · 45 XP' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Coreano, 8 lições · 2 concluídas · 90 XP' })).toBeTruthy();
    fireEvent.click(screen.getByRole('option', { name: 'Espanhol, 8 lições · 1 concluídas · 45 XP' }));
    expect(await screen.findByRole('heading', { name: 'Espanhol' })).toBeTruthy();
    expect(screen.getByText('1 de 8 lições · 45 XP')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Unidade 2' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Unidade 4' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Escolher idioma: Espanhol' }));
    fireEvent.click(screen.getByRole('option', { name: 'Coreano, 8 lições · 2 concluídas · 90 XP' }));
    expect(await screen.findByRole('heading', { name: 'Coreano' })).toBeTruthy();
    expect(screen.getByText('2 de 8 lições · 90 XP')).toBeTruthy();
  });

  it('não apresenta a aprovação pedagógica como motivo de bloqueio quando a API marca a lição indisponível', async () => {
    api.getMap.mockResolvedValue(makeMap(COURSE_CODES.english, 'REVIEW_PENDING'));
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Inglês' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Indisponível' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText(/em revisão pedagógica|aguardando revisão/i)).toBeNull();
  });

  it('abre uma lição e mostra seus exercícios originais', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Inglês' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));

    expect(await screen.findByRole('heading', { name: 'Cumprimentos' })).toBeTruthy();
    expect(screen.getByText('Aprenda a cumprimentar alguém.')).toBeTruthy();
    expect(screen.getByText('7 desafios curtos')).toBeTruthy();
    expect(api.startLesson).toHaveBeenCalledWith('institution-1', `${COURSE_CODES.english}-lesson-1`, COURSE_CODES.english);
  });

  it('mantém idempotência por resposta, permite corrigir erro e concluir o percurso', async () => {
    const randomUUID = vi.fn().mockReturnValueOnce('wrong-attempt-key').mockReturnValueOnce('correct-attempt-key');
    vi.stubGlobal('crypto', { randomUUID });
    api.submitAnswer
      .mockResolvedValueOnce(answerResult({ is_correct: false, feedback: 'Quase! Revise a dica e tente novamente.' }))
      .mockResolvedValueOnce(answerResult({ session_complete: true, xp_awarded: 30, total_xp: 30 }));
    renderPage();
    await screen.findByRole('heading', { name: 'Inglês' });
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
    await screen.findByRole('heading', { name: 'Cumprimentos' });
    fireEvent.click(screen.getByRole('button', { name: 'Começar os desafios' }));

    fireEvent.click(await screen.findByRole('button', { name: /Good night, class\./ }));
    fireEvent.click(screen.getByRole('button', { name: 'Conferir resposta' }));
    expect(await screen.findByText('Quase! Revise a dica e tente novamente.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    fireEvent.click(screen.getByRole('button', { name: /Good morning, class\./ }));
    fireEvent.click(screen.getByRole('button', { name: 'Conferir resposta' }));

    await waitFor(() => expect(api.submitAnswer).toHaveBeenCalledTimes(2));
    expect(api.submitAnswer.mock.calls.map((call) => call[4])).toEqual(['wrong-attempt-key', 'correct-attempt-key']);
    expect(await screen.findByText('+30 XP')).toBeTruthy();
  });

  it('reutiliza a chave idempotente quando a primeira resposta falha na rede', async () => {
    const randomUUID = vi.fn().mockReturnValue('retry-safe-key');
    vi.stubGlobal('crypto', { randomUUID });
    api.submitAnswer.mockRejectedValueOnce(new Error('network timeout')).mockResolvedValueOnce(answerResult());
    renderPage();
    await screen.findByRole('heading', { name: 'Inglês' });
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
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

  it('retoma a posição persistida da lição sem reiniciar a introdução', async () => {
    api.getMap.mockResolvedValue(makeMap(COURSE_CODES.english, 'IN_PROGRESS'));
    api.startLesson.mockResolvedValue(makeSession(2));
    renderPage();
    await screen.findByRole('heading', { name: 'Inglês' });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByText('Desafio 2 de 7')).toBeTruthy();
    expect(screen.getByText('Monte: “Meu nome é Ana.”')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Começar os desafios' })).toBeNull();
  });

  it('abre por teclado, percorre opções, fecha com Escape e clique externo', async () => {
    api.getMap.mockResolvedValue({
      ...makeMap(), additional_courses: [makeMap(COURSE_CODES.spanish), makeMap(COURSE_CODES.korean)],
    });
    renderPage();
    await screen.findByRole('heading', { name: 'Inglês' });

    const trigger = screen.getByRole('button', { name: 'Escolher idioma: Inglês' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const englishOption = screen.getByRole('option', { name: /Inglês, 16 lições/ });
    await waitFor(() => expect(document.activeElement).toBe(englishOption));
    fireEvent.keyDown(englishOption, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('option', { name: /Espanhol, 8 lições/ }));

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    expect(screen.queryByRole('listbox', { name: 'Meus idiomas' })).toBeNull();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    expect(await screen.findByRole('listbox', { name: 'Meus idiomas' })).toBeTruthy();
    fireEvent.click(trigger);
    expect(screen.queryByRole('listbox', { name: 'Meus idiomas' })).toBeNull();

    fireEvent.click(trigger);
    expect(await screen.findByRole('listbox', { name: 'Meus idiomas' })).toBeTruthy();
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(screen.queryByRole('listbox', { name: 'Meus idiomas' })).toBeNull());
  });

  it('persiste idioma por estudante e instituição sem vazar a preferência entre contas', async () => {
    api.getMap.mockResolvedValue({
      ...makeMap(), additional_courses: [makeMap(COURSE_CODES.spanish), makeMap(COURSE_CODES.korean)],
    });
    window.localStorage.setItem('tec-escola:tec-idiomas:language:student-1:institution-1', 'es-ES');
    const firstRender = renderPage();
    expect(await screen.findByRole('heading', { name: 'Espanhol' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Escolher idioma: Espanhol' }));
    fireEvent.click(screen.getByRole('option', { name: /Coreano, 8 lições/ }));
    await waitFor(() => expect(window.localStorage.getItem('tec-escola:tec-idiomas:language:student-1:institution-1')).toBe('ko-KR'));

    firstRender.unmount();
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Coreano' })).toBeTruthy();

    cleanup();
    identity.profileId = 'student-2';
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Inglês' })).toBeTruthy();
  });
});
