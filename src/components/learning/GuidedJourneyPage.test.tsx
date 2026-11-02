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
      questions: [{ id: 'question-1', statement: 'Qual é o resultado?', options: ['4', '7'], difficulty: 'EASY', position: 0, has_hint: false }],
    },
    isLoading: false,
  },
  submit: { data: undefined as { score: number; correct_count: number; total_questions: number; feedback: Array<{ question_bank_id: string; is_correct: boolean; correct_answer: unknown; explanation: string | null }> } | undefined, mutateAsync: vi.fn().mockResolvedValue({ score: 100, correct_count: 1, total_questions: 1, feedback: [] }), isPending: false, isError: false, error: null },
  recordHint: { mutateAsync: vi.fn().mockResolvedValue({ step_id: 'step-1', question_bank_id: 'question-1', hint: 'Separe os dados antes de calcular.', recorded: true }) },
  startGuided: { mutateAsync: vi.fn().mockResolvedValue({ session_id: 'session-1', created: false, current_step_id: 'step-1', engine_version: 'V4' }), isPending: false, isError: false },
  startJourney: { mutateAsync: vi.fn().mockResolvedValue({ session_id: 'session-1', created: false, current_step_id: 'step-1', target_canonical_skill_id: 'skill-1', engine_version: 'V4' }), isPending: false, isError: false, error: null },
  startJourneyV2: { mutateAsync: vi.fn().mockResolvedValue({ session_id: 'session-1', created: true, current_step_id: 'step-1', target_canonical_skill_id: 'skill-1', engine_version: 'V4' }), isPending: false, isError: false, error: null },
  resumeContent: { mutateAsync: vi.fn().mockResolvedValue({ session_id: 'session-1', current_step_id: 'step-2', resumed: true, status: 'ACTIVE' }), isPending: false, isError: false, error: null },
  advance: { mutateAsync: vi.fn(), isPending: false },
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
  useStartCentralStudiesV2Journey: () => state.startJourneyV2,
  useResumeContentExhaustedGuidedJourneyV9: () => state.resumeContent,
  useAdvanceGuidedLearningSessionV2: () => state.advance,
  useSubmitGuidedStepV2: () => state.submit,
  useRecordGuidedHintV5: () => state.recordHint,
}));

import GuidedJourneyPage from './GuidedJourneyPage';

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.clearAllMocks();
  state.session.data = {
    id: 'session-1', student_id: 'student-1', target_canonical_skill_id: 'skill-1',
    original_target_canonical_skill_id: 'skill-1', current_canonical_skill_id: 'skill-1',
    current_step_id: 'step-1', status: 'ACTIVE', planner_version: 'V2',
    decision_reason: 'PREREQUISITE_UNKNOWN', replan_count: 0, metadata: {}, current_step: null,
  };
  state.session.isLoading = false;
  state.journeys.data = [];
  state.journeys.isLoading = false;
  state.journeys.isError = false;
  state.step.data = {
    id: 'step-1', session_id: 'session-1', canonical_skill_id: 'skill-1', step_type: 'PROBE',
    purpose: 'PROBE', status: 'ACTIVE', position: 0, lesson_id: null, lesson: null,
    questions: [{ id: 'question-1', statement: 'Qual é o resultado?', options: ['4', '7'], difficulty: 'EASY', position: 0, has_hint: false }],
  };
  state.step.isLoading = false;
  state.submit.data = undefined;
  state.submit.mutateAsync.mockReset().mockResolvedValue({ score: 100, correct_count: 1, total_questions: 1, feedback: [] });
  state.recordHint.mutateAsync.mockReset().mockResolvedValue({ step_id: 'step-1', question_bank_id: 'question-1', hint: 'Separe os dados antes de calcular.', recorded: true });
  state.startGuided.mutateAsync.mockReset().mockResolvedValue({ session_id: 'session-1', created: false, current_step_id: 'step-1', engine_version: 'V4' });
  state.startJourney.mutateAsync.mockReset().mockResolvedValue({ session_id: 'session-1', created: false, current_step_id: 'step-1', target_canonical_skill_id: 'skill-1', engine_version: 'V4' });
  state.startJourneyV2.mutateAsync.mockReset().mockResolvedValue({ session_id: 'session-1', created: true, current_step_id: 'step-1', target_canonical_skill_id: 'skill-1', engine_version: 'V4' });
  state.resumeContent.mutateAsync.mockReset().mockResolvedValue({ session_id: 'session-1', current_step_id: 'step-2', resumed: true, status: 'ACTIVE' });
});

function renderPage(initialEntry = '/') {
  return render(<MemoryRouter initialEntries={[initialEntry]}><GuidedJourneyPage /></MemoryRouter>);
}

describe('GuidedJourneyPage', () => {
  it('reveals a hint only after the server records its use for the active question', async () => {
    const originalQuestions = state.step.data.questions;
    state.step.data.questions = [{ id: 'question-1', statement: 'Qual é o resultado?', options: ['4', '7'], difficulty: 'EASY', position: 0, has_hint: true }];
    let resolveHint!: (value: { step_id: string; question_bank_id: string; hint: string; recorded: boolean }) => void;
    state.recordHint.mutateAsync = vi.fn(() => new Promise((resolve) => { resolveHint = resolve; }));

    renderPage();
    expect(screen.queryByText(/separe os dados/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver dica' }));
    await waitFor(() => expect(state.recordHint.mutateAsync).toHaveBeenCalledWith({ stepId: 'step-1', questionId: 'question-1' }));
    expect(screen.queryByText(/separe os dados/i)).toBeNull();
    resolveHint({ step_id: 'step-1', question_bank_id: 'question-1', hint: 'Separe os dados antes de calcular.', recorded: true });
    expect(await screen.findByText('Dica: Separe os dados antes de calcular.')).toBeTruthy();

    state.step.data.questions = originalQuestions;
  });

  it('does not reveal a hint when the server refuses to record it', async () => {
    const originalQuestions = state.step.data.questions;
    state.step.data.questions = [{ id: 'question-1', statement: 'Qual é o resultado?', options: ['4', '7'], difficulty: 'EASY', position: 0, has_hint: true }];
    state.recordHint.mutateAsync = vi.fn().mockRejectedValue(new Error('LEARNING_STEP_SCOPE_DENIED'));

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Ver dica' }));

    expect((await screen.findByRole('alert')).textContent).toContain('LEARNING_STEP_SCOPE_DENIED');
    expect(screen.queryByText(/dica: separe/i)).toBeNull();
    state.step.data.questions = originalQuestions;
  });

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

  it('shows one question at a time and submits saved answers together', () => {
    const originalQuestions = state.step.data.questions;
    state.step.data.questions = [
      { id: 'question-1', statement: 'Primeira questão?', options: ['4', '7'], difficulty: 'EASY', position: 0, has_hint: false },
      { id: 'question-2', statement: 'Segunda questão?', options: ['8', '9'], difficulty: 'MEDIUM', position: 1, has_hint: false },
    ];

    renderPage();

    expect(screen.getByText('Primeira questão?')).toBeTruthy();
    expect(screen.queryByText('Segunda questão?')).toBeNull();
    fireEvent.click(screen.getByLabelText('7'));
    fireEvent.click(screen.getByRole('button', { name: 'Próxima questão' }));

    expect(screen.queryByText('Primeira questão?')).toBeNull();
    expect(screen.getByText('Segunda questão?')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('9'));
    fireEvent.click(screen.getByRole('button', { name: 'Questão anterior' }));
    expect(screen.getByLabelText('7')).toHaveProperty('checked', true);
    fireEvent.click(screen.getByRole('button', { name: 'Próxima questão' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar respostas' }));

    expect(state.submit.mutateAsync).toHaveBeenCalledWith({
      stepId: 'step-1',
      answers: [
        { question_bank_id: 'question-1', answer: '7' },
        { question_bank_id: 'question-2', answer: '9' },
      ],
      idempotencyKey: 'guided-v2:step-1',
    });
    state.step.data.questions = originalQuestions;
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

  it('keeps an unreviewed preview out of the student flow and does not request another step', () => {
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

    expect(screen.getByRole('heading', { name: 'Novas atividades desta matéria estão sendo preparadas.' })).toBeTruthy();
    expect(screen.queryByText('Qual é o resultado?')).toBeNull();
    expect(state.startGuided.mutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByText(/demo_preview|demonstrativa|MAPPING_PENDING/i)).toBeNull();
  });

  it('does not start an unpublished journey from a direct link', () => {
    state.session.data = null;
    state.journeys.data = [{
      journey_id: 'journey-preview', subject_id: 'subject-1', subject_name: 'Matemática',
      canonical_subject_code: 'MATHEMATICS', execution_skill_id: 'skill-1',
      publication_status: 'DEMO_PREVIEW', availability_status: 'DEMO_PREVIEW',
      mapping_status: 'MAPPING_PENDING', pedagogical_review_status: 'PEDAGOGICAL_REVIEW_PENDING',
    }];
    state.step.data = null;

    renderPage('/?journey=journey-preview&skill=skill-1');

    expect(screen.getByRole('heading', { name: 'Novas atividades desta matéria estão sendo preparadas.' })).toBeTruthy();
    expect(state.startJourney.mutateAsync).not.toHaveBeenCalled();
    expect(state.startGuided.mutateAsync).not.toHaveBeenCalled();
  });

  it('starts a released Central Studies V2 journey through its V4-backed server entry point', async () => {
    state.session.data = null;
    state.journeys.data = [{
      journey_id: 'central-v2-journey', source: 'CENTRAL_STUDIES_V2', subject_id: 'subject-1',
      subject_name: 'Matemática', unit_title: 'Números', title: 'Estratégias com números naturais',
      canonical_subject_code: 'MATHEMATICS', execution_skill_id: 'skill-1', publication_status: 'PUBLISHED',
      availability_status: 'AVAILABLE', mapping_status: 'MAPPED', pedagogical_review_status: 'PEDAGOGICAL_REVIEWED',
    }];
    state.step.data = null;

    renderPage('/?journey=central-v2-journey');

    await waitFor(() => expect(state.startJourneyV2.mutateAsync).toHaveBeenCalledWith('central-v2-journey'));
    expect(state.startJourney.mutateAsync).not.toHaveBeenCalled();
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
    state.journeys.data = [{ journey_id: 'journey-1', subject_id: 'subject-1', subject_name: 'Matemática', canonical_subject_code: 'MATHEMATICS', execution_skill_id: 'skill-1', publication_status: 'PUBLISHED', availability_status: 'AVAILABLE', mapping_status: 'MAPPED', pedagogical_review_status: 'PEDAGOGICAL_REVIEWED' }];

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
      canonical_subject_code: 'MATHEMATICS',
      execution_skill_id: 'skill-1',
      publication_status: 'PUBLISHED',
      availability_status: 'AVAILABLE',
      mapping_status: 'MAPPED',
      pedagogical_review_status: 'PEDAGOGICAL_REVIEWED',
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
