// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  overview: { state: 'ACTIVE', action: 'CONTINUE', session_id: 'session-1', grade_label: '7º ano do Ensino Fundamental', progress_percent: 25 } as Record<string, unknown>,
  session: { data: { id: 'session-1', student_id: 'student-1', target_canonical_skill_id: 'skill-1', original_target_canonical_skill_id: 'skill-1', current_canonical_skill_id: 'skill-1', current_step_id: 'step-1', status: 'ACTIVE', planner_version: 'V4', decision_reason: 'V4_TARGET_READY', replan_count: 0, metadata: {} }, isLoading: false, isError: false },
  step: { data: { id: 'step-1', session_id: 'session-1', canonical_skill_id: 'skill-1', step_type: 'PROBE', purpose: 'PROBE', status: 'ACTIVE', position: 0, lesson_id: null, lesson: null, curriculum: { official_code: 'EF07MA01', subject_area: 'MATEMATICA', official_source_page: 300 }, questions: [{ id: 'question-1', statement: 'Qual é o resultado?', options: ['4', '7'], difficulty: 'EASY', position: 0, has_hint: false }] }, isLoading: false, isError: false, refetch: vi.fn() },
  submitData: undefined as null | Record<string, unknown>,
  start: vi.fn().mockResolvedValue({ state: 'ACTIVE', session_id: 'session-2' }),
  pause: vi.fn().mockResolvedValue({ session_id: 'session-1', status: 'PAUSED', idempotent: false }),
  submit: vi.fn(),
  advance: vi.fn().mockResolvedValue({}),
  recordHint: vi.fn().mockResolvedValue({ recorded: true, hint: 'Separe os dados antes de calcular.' }),
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ profile: { id: 'profile-1', full_name: 'Ana Estudante' } }) }));
vi.mock('../../contexts/InstitutionContext', () => ({ useInstitution: () => ({ currentInstitutionId: 'institution-1' }) }));
vi.mock('../../hooks/useLearningCenter', () => ({
  useGuidedStudyOverviewV11: () => ({ data: state.overview, isLoading: false, isError: false }),
  useLearningStudent: () => ({ data: { id: 'student-1' }, isLoading: false, isError: false }),
  useGuidedLearningSessionByIdV11: () => ({ ...state.session, isLoading: false, isError: false }),
  useGuidedLearningStepV2: () => state.step,
  useStartGuidedStudyV11: () => ({ mutateAsync: state.start, isPending: false, isError: false }),
  usePauseGuidedStudyV11: () => ({ mutateAsync: state.pause, isPending: false, isError: false }),
  useAdvanceGuidedLearningSessionV2: () => ({ mutateAsync: state.advance, isPending: false, isError: false, error: null }),
  useSubmitGuidedStepV2: () => ({ data: state.submitData, mutateAsync: state.submit, isPending: false, isError: false, error: null }),
  useRecordGuidedHintV5: () => ({ mutateAsync: state.recordHint }),
}));

import GuidedJourneyPage from './GuidedJourneyPage';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderPage(initialEntry = '/student/study/guided?session=session-1') {
  return render(<MemoryRouter initialEntries={[initialEntry]}><Routes>
    <Route path="/student/study/guided" element={<><GuidedJourneyPage /><LocationProbe /></>} />
    <Route path="/student/study" element={<p>Central da rota</p>} />
  </Routes></MemoryRouter>);
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  state.overview = { state: 'ACTIVE', action: 'CONTINUE', session_id: 'session-1', grade_label: '7º ano do Ensino Fundamental', progress_percent: 25 };
  state.session.data = { id: 'session-1', student_id: 'student-1', target_canonical_skill_id: 'skill-1', original_target_canonical_skill_id: 'skill-1', current_canonical_skill_id: 'skill-1', current_step_id: 'step-1', status: 'ACTIVE', planner_version: 'V4', decision_reason: 'V4_TARGET_READY', replan_count: 0, metadata: {} };
  state.step.data = { id: 'step-1', session_id: 'session-1', canonical_skill_id: 'skill-1', step_type: 'PROBE', purpose: 'PROBE', status: 'ACTIVE', position: 0, lesson_id: null, lesson: null, curriculum: { official_code: 'EF07MA01', subject_area: 'MATEMATICA', official_source_page: 300 }, questions: [{ id: 'question-1', statement: 'Qual é o resultado?', options: ['4', '7'], difficulty: 'EASY', position: 0, has_hint: false }] };
  state.submitData = null;
  state.start.mockReset().mockResolvedValue({ state: 'ACTIVE', session_id: 'session-2' });
  state.pause.mockReset().mockResolvedValue({ session_id: 'session-1', status: 'PAUSED', idempotent: false });
  state.submit.mockReset().mockImplementation(async () => {
    state.submitData = { score: 100, correct_count: 1, total_questions: 1, session_status: 'ACTIVE', feedback: [{ question_bank_id: 'question-1', is_correct: true, correct_answer: '4', explanation: 'Correto.' }] };
    return state.submitData;
  });
  state.advance.mockReset().mockResolvedValue({});
  state.recordHint.mockReset().mockResolvedValue({ recorded: true, hint: 'Separe os dados antes de calcular.' });
});

describe('GuidedJourneyPage V11', () => {
  it('apresenta uma questão de diagnóstico selecionada pelo servidor e permite pausar', async () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Vamos descobrir seu ponto de partida' })).toBeTruthy();
    expect(screen.getByText(/EF07MA01/)).toBeTruthy();
    expect(screen.getByText('Qual é o resultado?')).toBeTruthy();
    expect(screen.queryByText(/escolha uma aula|selecione uma matéria/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    await waitFor(() => expect(state.pause).toHaveBeenCalledWith('session-1'));
    expect(await screen.findByText('Central da rota')).toBeTruthy();
  });

  it('mantém aberta a sessão validada mesmo quando o resumo ainda contém um ID antigo', () => {
    state.overview = { ...state.overview, session_id: 'stale-session' };

    renderPage('/student/study/guided?session=session-1');

    expect(screen.getByRole('heading', { name: 'Vamos descobrir seu ponto de partida' })).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/student/study/guided?session=session-1');
  });

  it('registra a resposta, mostra feedback corrigido e segue para o passo já decidido pelo motor', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('radio', { name: '4' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar respostas' }));

    expect(await screen.findByText('Resposta corrigida')).toBeTruthy();
    expect(screen.getByText('Correto.')).toBeTruthy();
    expect(state.submit).toHaveBeenCalledWith({ stepId: 'step-1', answers: [{ question_bank_id: 'question-1', answer: '4' }], idempotencyKey: 'guided-v2:step-1' });
    expect(screen.getByRole('button', { name: 'Próxima etapa' })).toBeTruthy();
  });

  it('usa o orquestrador global ao concluir e não pede uma habilidade ao estudante', async () => {
    state.submit.mockImplementation(async () => {
      state.submitData = { score: 100, correct_count: 1, total_questions: 1, session_status: 'COMPLETED', feedback: [] };
      return state.submitData;
    });
    state.start.mockImplementation(async () => {
      state.overview = { state: 'ACTIVE', action: 'START', session_id: 'session-2', grade_label: '7º ano do Ensino Fundamental' };
      return { state: 'ACTIVE', session_id: 'session-2' };
    });
    renderPage();
    fireEvent.click(screen.getByRole('radio', { name: '4' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar respostas' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar meu estudo' }));

    await waitFor(() => expect(state.start).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/student/study/guided?session=session-2'));
  });

  it('redireciona URLs antigas de seleção manual para a Central', async () => {
    renderPage('/student/study/guided?journey=old-journey');
    expect(await screen.findByText('Central da rota')).toBeTruthy();
  });
});
