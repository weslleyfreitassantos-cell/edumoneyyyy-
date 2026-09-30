// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
      questions: [{ id: 'question-1', statement: 'Qual é o resultado?', options: ['4', '7'], difficulty: 'EASY', position: 0 }],
    },
    isLoading: false,
  },
  submit: { mutateAsync: vi.fn().mockResolvedValue({ score: 100, correct_count: 1, total_questions: 1, feedback: [] }), isPending: false, isError: false, error: null },
  advance: { mutateAsync: vi.fn(), isPending: false },
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ profile: { id: 'profile-1', full_name: 'Ana Estudante' } }) }));
vi.mock('../../contexts/InstitutionContext', () => ({ useInstitution: () => ({ currentInstitutionId: 'institution-1' }) }));
vi.mock('../../hooks/useLearningCenter', () => ({
  useLearningStudent: () => ({ data: { id: 'student-1', profile_id: 'profile-1' } }),
  useGuidedLearningSessionV2: () => state.session,
  useGuidedLearningStepV2: () => state.step,
  useAdvanceGuidedLearningSessionV2: () => state.advance,
  useSubmitGuidedStepV2: () => state.submit,
}));

import GuidedJourneyPage from './GuidedJourneyPage';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPage() {
  return render(<MemoryRouter><GuidedJourneyPage /></MemoryRouter>);
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

  it('keeps a recoverable teacher-support state instead of inventing another step', () => {
    state.session.data = { ...state.session.data, status: 'NEEDS_TEACHER_SUPPORT' };
    renderPage();

    expect(screen.getByRole('heading', { name: 'Vamos pedir apoio ao professor' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Voltar à Central' })).toBeTruthy();
    expect(screen.queryByText('Qual é o resultado?')).toBeNull();
  });
});
