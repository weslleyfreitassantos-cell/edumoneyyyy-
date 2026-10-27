// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  detail: {
    data: {
      student: { id: 'student-1', full_name: 'Ana Aluna', class_id: 'class-1', class_name: '1ª Série A' },
      progress: [],
      open_errors: [],
      guided_sessions: [] as Array<Record<string, any>>,
      recent_attempts: [] as Array<Record<string, any>>,
    } as Record<string, any> | null,
    isLoading: false,
    isError: false,
    error: null as Error | null,
    refetch: vi.fn(),
  },
  knowledgeGraph: { data: [] as Array<Record<string, any>>, isLoading: false, isError: false, refetch: vi.fn() },
  guidedAttempts: { data: [] as Array<Record<string, any>>, isLoading: false, isError: false, refetch: vi.fn() },
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ profile: { id: 'teacher-1' } }) }));
vi.mock('../../contexts/InstitutionContext', () => ({ useInstitution: () => ({ currentInstitutionId: 'institution-1' }) }));
vi.mock('../../hooks/useLearningCenter', () => ({
  useTeacherLearningSubjects: () => ({ data: [{ id: 'math-1', name: 'Matemática' }] }),
  useTeacherLearningStudents: () => ({ data: [] }),
  useTeacherLearningStudentDetail: () => state.detail,
  useTeacherGuidedLearningAttempts: () => state.guidedAttempts,
}));
vi.mock('../../hooks/useAdaptiveLearning', () => ({ useTeacherStudentKnowledgeGraph: () => state.knowledgeGraph }));

import TeacherStudentDetailPage from './TeacherStudentDetailPage';

afterEach(() => cleanup());

beforeEach(() => {
  state.detail.data = {
    student: { id: 'student-1', full_name: 'Ana Aluna', class_id: 'class-1', class_name: '1ª Série A' },
    progress: [],
    open_errors: [],
    guided_sessions: [],
    recent_attempts: [],
  };
  state.detail.isLoading = false;
  state.detail.isError = false;
  state.detail.error = null;
  state.knowledgeGraph.data = [];
  state.knowledgeGraph.isLoading = false;
  state.knowledgeGraph.isError = false;
  state.guidedAttempts.data = [];
  state.guidedAttempts.isLoading = false;
  state.guidedAttempts.isError = false;
  vi.clearAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/teacher/pedagogical-center/students/student-1?class=class-1&subject=math-1']}>
      <Routes><Route path="/teacher/pedagogical-center/students/:studentId" element={<TeacherStudentDetailPage />} /></Routes>
    </MemoryRouter>,
  );
}

describe('TeacherStudentDetailPage', () => {
  it('does not turn unknown skills into a zero score or positive status', () => {
    state.knowledgeGraph.data = [{
      subjectCode: 'MATHEMATICS', subjectName: 'Matemática', skillCode: 'M1', skillTitle: 'Proporção',
      state: 'UNKNOWN', mastery: 0, confidence: 0, evidenceCount: 0, strongEvidenceCount: 0, confirmedMisconceptions: [],
    }];

    renderPage();

    expect(screen.getAllByText('Sem dados suficientes').length).toBeGreaterThan(0);
    expect(screen.queryByText('0%')).toBeNull();
    expect(screen.queryByText('Bom andamento')).toBeNull();
    expect(screen.getByText(/ainda não há evidências válidas/i)).toBeTruthy();
  });

  it('shows real guided sessions and their server-graded attempts', () => {
    state.detail.data!.guided_sessions = [{
      id: 'session-1', target_canonical_skill_id: 'skill-1', target_skill_title: 'Proporção',
      status: 'ACTIVE', started_at: '2026-10-13T12:00:00.000Z', completed_at: null,
      steps: [{ id: 'step-1', step_type: 'PRACTICE', position: 0, status: 'COMPLETED', attempts: 1, title: 'Proporção' }],
    }];
    state.guidedAttempts.data = [{
      id: 'attempt-1', source: 'GUIDED', activity_id: null, activity_title: 'Proporção · Prática',
      score: 1, total_points: 2, completed_at: '2026-10-13T12:05:00.000Z',
    }];

    renderPage();

    expect(screen.getByText('Estudo guiado')).toBeTruthy();
    expect(screen.getByText('Em andamento')).toBeTruthy();
    expect(screen.getByText('1 de 1 etapas concluídas')).toBeTruthy();
    expect(screen.getByText('Proporção · Prática')).toBeTruthy();
    expect(screen.getByText('1/2')).toBeTruthy();
  });

  it('keeps a measured zero distinct from missing evidence and highlights review', () => {
    state.knowledgeGraph.data = [{
      subjectCode: 'MATHEMATICS', subjectName: 'Matemática', skillCode: 'M1', skillTitle: 'Proporção',
      state: 'NEEDS_REVIEW', mastery: 0, confidence: 0.8, evidenceCount: 2, strongEvidenceCount: 1, confirmedMisconceptions: [],
    }];

    renderPage();

    expect(screen.getAllByText('0%').length).toBeGreaterThan(0);
    expect(screen.getByText('Vale revisar Proporção')).toBeTruthy();
  });

  it('distinguishes a temporary load failure from a scope denial and offers retry only for load errors', () => {
    state.detail.data = null;
    state.detail.isError = true;
    state.detail.error = new Error('network timeout');

    const { rerender } = renderPage();
    expect(screen.getByText('Não foi possível carregar o acompanhamento agora.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(state.detail.refetch).toHaveBeenCalledOnce();

    state.detail.error = new Error('LEARNING_TEACHER_SUBJECT_SCOPE_DENIED');
    rerender(
      <MemoryRouter initialEntries={['/teacher/pedagogical-center/students/student-1?class=class-1&subject=math-1']}>
        <Routes><Route path="/teacher/pedagogical-center/students/:studentId" element={<TeacherStudentDetailPage />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Este aluno não está no seu escopo pedagógico.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).toBeNull();
  });
});
