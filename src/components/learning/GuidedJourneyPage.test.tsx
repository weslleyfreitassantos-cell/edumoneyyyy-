// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  session: {
    data: {
      id: 'session-1',
      student_id: 'student-1',
      target_canonical_skill_id: 'skill-1',
      original_target_canonical_skill_id: 'skill-1',
      current_canonical_skill_id: 'skill-1',
      current_step_id: 'step-1',
      status: 'ACTIVE',
      planner_version: 'V2',
      decision_reason: 'PREREQUISITE_UNKNOWN',
      replan_count: 0,
      metadata: {},
      current_step: null,
    },
    isLoading: false,
  },
  journeys: { data: [] as Array<Record<string, unknown>>, isLoading: false, isError: false },
  step: {
    data: {
      id: 'step-1',
      session_id: 'session-1',
      canonical_skill_id: 'skill-1',
      step_type: 'PROBE',
      purpose: 'PROBE',
      status: 'ACTIVE',
      position: 0,
      lesson_id: null,
      lesson: null,
      questions: [{ id: 'question-1', statement: 'Qual é o resultado?', options: ['4', '7'], difficulty: 'EASY', position: 0 }] as Array<{ id: string; statement: string; options: string[]; difficulty: 'EASY' | 'MEDIUM' | 'HARD' | null; position: number; hint?: string | null }>,
    },
    isLoading: false,
  },
  submit: { data: undefined as { score: number; correct_count: number; total_questions: number; feedback: Array<{ question_bank_id: string; is_correct: boolean; correct_answer: unknown; explanation: string | null }> } | undefined, mutateAsync: vi.fn().mockResolvedValue({ score: 100, correct_count: 1, total_questions: 1, feedback: [] }), isPending: false, isError: false, error: null },
  startGuided: { mutateAsync: vi.fn().mockResolvedValue({ session_id: 'session-1', created: false, current_step_id: 'step-1', engine_version: 'V4' }), isPending: false, isError: false },
  startJourney: { mutateAsync: vi.fn().mockResolvedValue({ session_id: 'session-1', created: false, current_step_id: 'step-1', target_canonical_skill_id: 'skill-1', engine_version: 'V4' }), isPending: false, isError: false, error: null },
  resumeContent: { mutateAsync: vi.fn().mockResolvedValue({ session_id: 'session-1', current_step_id: 'step-2', resumed: true, status: 'ACTIVE' }), isPending: false, isError: false, error: null },
  advance: { mutateAsync: vi.fn(), isPending: false },
  recordHint: { mutateAsync: vi.fn().mockResolvedValue({ step_id: 'step-1', question_bank_id: 'question-1', recorded: true }), isPending: false, isError: false, error: null },
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ profile: { id: 'profile-1', full_name: 'Ana Estudante' } }) }));
vi.mock('../../contexts/InstitutionContext', () => ({ useInstitution: () => ({ currentInstitutionId: 'institution-1' }) }));
vi.mock('../../hooks/useLearningCenter', () => ({
  useLearningStudent: () => ({ data: { id: 'student-1', profile_id: 'profile-1' } }),
  useGuidedLearningSessionV2: () => state.session,
  useGuidedLearningStepV2: () => state.step,
  useGuidedDisciplineJourneysV9: () => state.journeys,
  useStartGuidedLearningSessionV2: () => state.startGuided,
  useStartGuidedDisciplineJourneyV9: () => state.startJourney,
  useResumeContentExhaustedGuidedJourneyV9: () => state.resumeContent,
  useAdvanceGuidedLearningSessionV2: () => state.advance,
  useRecordGuidedHintV5: () => state.recordHint,
  useSubmitGuidedStepV2: () => state.submit,
}));

import GuidedJourneyPage from './GuidedJourneyPage';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPage(initialEntry = '/') {
  return render(<MemoryRouter initialEntries={[initialEntry]}><GuidedJourneyPage /></MemoryRouter>);
}

describe('GuidedJourneyPage', () => {
  it('shows one server-planned mission and keeps the answer key hidden before submit', () => {
    renderPage();

    expect(screen.getByText('Qual é o resultado?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar respostas' })).toHaveProperty('disabled', true);
    expect(screen.queryByText(/resposta correta/i)).toBeNull();
    expect(screen.queryByText(/resposta correta:/i)).toBeNull();

    fireEvent.click(screen.getByLabelText('7'));
    expect(screen.getByRole('button', { name: 'Enviar respostas' })).toHaveProperty('disabled', false);
    fireEvent.click(screen.getByRole('button', { name: 'Enviar respostas' }));

    expect(state.submit.mutateAsync).toHaveBeenCalledWith({
      stepId: 'step-1',
      answers: [{ question_bank_id: 'question-1', answer: '7' }],
      idempotencyKey: 'guided-v2:step-1',
    });
  });

  it('shows one challenge at a time and submits the whole legacy step only after each answer', () => {
    state.session.data = { ...state.session.data, status: 'ACTIVE', current_step_id: 'step-1', metadata: {} };
    state.submit.data = undefined;
    state.step.data = {
      ...state.step.data,
      questions: [
        { id: 'question-1', statement: 'Primeiro desafio', options: ['4', '7'], difficulty: 'EASY', position: 0 },
        { id: 'question-2', statement: 'Segundo desafio', options: ['8', '9'], difficulty: 'MEDIUM', position: 1 },
      ],
    };

    renderPage();
    expect(screen.getByText('Primeiro desafio')).toBeTruthy();
    expect(screen.queryByText('Segundo desafio')).toBeNull();
    fireEvent.click(screen.getByLabelText('4'));
    fireEvent.click(screen.getByRole('button', { name: 'Próxima questão' }));
    expect(screen.getByText('Segundo desafio')).toBeTruthy();
    expect(screen.queryByText('Primeiro desafio')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Enviar respostas' })).toBeTruthy();

    fireEvent.click(screen.getByLabelText('9'));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar respostas' }));
    expect(state.submit.mutateAsync).toHaveBeenCalledWith({
      stepId: 'step-1',
      answers: [
        { question_bank_id: 'question-1', answer: '4' },
        { question_bank_id: 'question-2', answer: '9' },
      ],
      idempotencyKey: 'guided-v2:step-1',
    });

    state.step.data = {
      ...state.step.data,
      questions: [{ id: 'question-1', statement: 'Qual é o resultado?', options: ['4', '7'], difficulty: 'EASY', position: 0 }],
    };
  });

  it('records hint exposure on the server before revealing it, without sending a client-controlled flag', async () => {
    state.session.data = { ...state.session.data, status: 'ACTIVE', current_step_id: 'step-1', planner_version: 'V4', metadata: {} };
    state.submit.data = undefined;
    state.step.data = {
      ...state.step.data,
      questions: [{ id: 'question-1', statement: 'Qual é o resultado?', options: ['4', '7'], difficulty: 'EASY', position: 0, hint: 'Pense na operação inversa.' }],
    };

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Precisa de uma pista?' }));
    expect(state.recordHint.mutateAsync).toHaveBeenCalledWith({ stepId: 'step-1', questionId: 'question-1' });
    expect(await screen.findByText('Pense na operação inversa.')).toBeTruthy();
    expect(screen.queryByText(/resposta correta/i)).toBeNull();
    fireEvent.click(screen.getByLabelText('7'));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar respostas' }));

    expect(state.submit.mutateAsync).toHaveBeenCalledWith({
      stepId: 'step-1',
      answers: [{ question_bank_id: 'question-1', answer: '7' }],
      idempotencyKey: 'guided-v2:step-1',
    });

    state.step.data = {
      ...state.step.data,
      questions: [{ id: 'question-1', statement: 'Qual é o resultado?', options: ['4', '7'], difficulty: 'EASY', position: 0 }],
    };
  });

  it('keeps the correction visible when the completed session is invalidated', async () => {
    state.session.data = { ...state.session.data, status: 'ACTIVE', current_step_id: 'step-1' };
    state.submit.data = undefined;
    const originalMutateAsync = state.submit.mutateAsync;
    state.submit.mutateAsync = vi.fn().mockImplementation(async () => {
      const result = { score: 100, correct_count: 1, total_questions: 1, feedback: [] };
      state.session.data = null;
      state.submit.data = result;
      return result;
    });

    renderPage();
    fireEvent.click(screen.getByLabelText('7'));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar respostas' }));

    await waitFor(() => expect(screen.getByText('Evidência registrada')).toBeTruthy());

    state.submit.mutateAsync = originalMutateAsync;
    state.submit.data = undefined;
  });

  it('asks the server to recover a paused session without a current step', async () => {
    state.session.data = {
      id: 'session-1',
      student_id: 'student-1',
      target_canonical_skill_id: 'skill-1',
      original_target_canonical_skill_id: 'skill-1',
      current_canonical_skill_id: 'skill-1',
      current_step_id: null,
      status: 'PAUSED',
      planner_version: 'V4',
      decision_reason: 'CONTENT_NOT_READY',
      replan_count: 0,
      metadata: { runtime_reason: 'CONTENT_NOT_READY', demo_preview: true },
      current_step: null,
    };
    state.step.data = null;

    renderPage();

    await waitFor(() => expect(state.startGuided.mutateAsync).toHaveBeenCalledWith('skill-1'));
    state.session.data = { ...state.session.data, current_step_id: 'step-1' };
    state.step.data = {
      id: 'step-1',
      session_id: 'session-1',
      canonical_skill_id: 'skill-1',
      step_type: 'PROBE',
      purpose: 'PROBE',
      status: 'ACTIVE',
      position: 0,
      lesson_id: null,
      lesson: null,
      questions: [{ id: 'question-1', statement: 'Qual é o resultado?', options: ['4', '7'], difficulty: 'EASY', position: 0 }],
    };
  });

  it('keeps a recoverable teacher-support state instead of inventing another step', () => {
    state.session.data = { ...state.session.data, status: 'NEEDS_TEACHER_SUPPORT', current_step_id: null };
    state.step.data = null;
    renderPage();

    expect(screen.getByRole('heading', { name: 'Vamos pedir apoio ao professor' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Voltar à Central' })).toBeTruthy();
    expect(screen.queryByText('Qual é o resultado?')).toBeNull();
  });

  it('explains when a remediation pool is exhausted without losing saved progress', () => {
    state.session.data = {
      ...state.session.data,
      status: 'NEEDS_TEACHER_SUPPORT',
      current_step_id: null,
      decision_reason: 'REMEDIATION_QUESTION_POOL_EXHAUSTED',
    };
    state.step.data = null;
    renderPage();

    expect(screen.getByRole('heading', { name: 'Conteúdo indisponível no momento' })).toBeTruthy();
    expect(screen.getByText(/isso não indica uma dificuldade sua/i)).toBeTruthy();
    expect(screen.getByText(/Seu progresso está salvo/i)).toBeTruthy();
  });

  it('offers a scoped retry for content exhaustion and resumes through the server', async () => {
    state.session.data = {
      ...state.session.data,
      current_step_id: null,
      status: 'NEEDS_TEACHER_SUPPORT',
      planner_version: 'V4',
      decision_reason: 'CONTENT_EXHAUSTED',
    };
    state.step.data = null;
    state.journeys.data = [{ journey_id: 'journey-1', subject_id: 'subject-1', subject_name: 'Matemática', execution_skill_id: 'skill-1' }];

    renderPage('/?journey=journey-1&skill=skill-1');
    fireEvent.click(screen.getByRole('button', { name: 'Verificar novas atividades' }));

    await waitFor(() => expect(state.resumeContent.mutateAsync).toHaveBeenCalledWith('journey-1'));
  });

  it('explains a paused V9 journey when the bridge limit leaves no active step', () => {
    state.session.data = { ...state.session.data, status: 'PAUSED', current_step_id: null, decision_reason: 'MAX_ACTIVE_BRIDGE_DEPTH_REACHED' };
    state.step.data = null;
    state.journeys.data = [{
      journey_id: 'journey-1',
      subject_id: 'subject-1',
      subject_name: 'Matemática',
      execution_skill_id: 'skill-1',
    }];

    renderPage('/?journey=journey-1&skill=skill-1');

    expect(screen.getByRole('heading', { name: 'Jornada pausada' })).toBeTruthy();
    expect(screen.getByText(/sequência automática de reforço chegou ao limite/i)).toBeTruthy();
    expect(screen.getByText(/Seu progresso está salvo/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Voltar à matéria' })).toHaveProperty('href', expect.stringContaining('/student/study/subject/subject-1'));
    expect(screen.queryByText('Retomando sua jornada...')).toBeNull();
  });

  it('does not claim prerequisite mastery when the bridge limit returns to the original target', () => {
    state.session.data = {
      ...state.session.data,
      status: 'ACTIVE',
      current_step_id: 'step-return',
      metadata: { runtime_reason: 'MAX_ACTIVE_BRIDGE_DEPTH_RETURNED_TO_TARGET', mastery_unproven: true },
    };
    state.step.data = {
      id: 'step-return',
      session_id: 'session-1',
      canonical_skill_id: 'skill-1',
      step_type: 'RETURN_TO_TARGET',
      purpose: null,
      status: 'ACTIVE',
      position: 7,
      lesson_id: null,
      lesson: null,
      questions: [],
    };

    renderPage();

    expect(screen.getByRole('heading', { name: 'Retomar o objetivo original' })).toBeTruthy();
    expect(screen.getByText(/sem marcar essas habilidades como dominadas/i)).toBeTruthy();
    expect(screen.queryByText('Você fortaleceu a base')).toBeNull();
    expect(screen.getByRole('button', { name: 'Voltar ao objetivo' })).toBeTruthy();
  });
});
