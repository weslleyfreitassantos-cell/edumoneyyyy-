// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useStudentGradeSummary } from '../../hooks/useGrades';
import StudentGradesPanel from './StudentGradesPanel';

vi.mock('../../hooks/useGrades', () => ({
  useStudentGradeSummary: vi.fn(),
}));

const summary = {
  totalAssessments: 1,
  gradedCount: 1,
  pendingCount: 0,
  excusedCount: 0,
  averageScore: 8.5,
  averagePercent: 85,
  weightedAveragePercent: 70,
};

const record = {
  assessmentId: 'assessment-1',
  gradeId: 'grade-1',
  subjectOfferingId: 'offering-1',
  studentId: 'student-1',
  title: 'Prova de álgebra',
  subjectName: 'Matemática',
  subjectCode: 'MAT',
  className: '1º A',
  teacherName: 'Prof. Ana',
  termName: '1º Bimestre',
  assessmentDate: '2026-09-10',
  assessmentType: 'EXAM' as const,
  maxScore: 10,
  weight: 1,
  score: 8.5,
  status: 'GRADED' as const,
  feedback: null,
  percentage: 85,
  recordedAt: '2026-09-10T10:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('StudentGradesPanel', () => {
  it('mostra os indicadores úteis e apenas a nota acadêmica da avaliação', () => {
    vi.mocked(useStudentGradeSummary).mockReturnValue({
      data: { summary, records: [record], recentRecords: [record] },
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    render(
      <StudentGradesPanel
        institutionId="institution-1"
        studentId="student-1"
        title="Avaliações publicadas"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Avaliações publicadas' })).toBeTruthy();
    expect(screen.getByText('Avaliações recentes')).toBeTruthy();
    expect(screen.getByText('Prova de álgebra')).toBeTruthy();
    expect(screen.getByText('Nota')).toBeTruthy();
    expect(screen.getByText('Situação')).toBeTruthy();
    expect(screen.getByText('Lançada')).toBeTruthy();
    expect(screen.getByText('Média ponderada')).toBeTruthy();
    expect(screen.queryByText('Média simples')).toBeNull();
    expect(screen.queryByText('Avaliações registradas')).toBeNull();
    expect(screen.getByText('Avaliações pendentes')).toBeTruthy();
    expect(screen.getByText('70%')).toBeTruthy();
    expect(screen.getByText('8,5/10')).toBeTruthy();
    expect(screen.queryByText('85%')).toBeNull();
  });

  it('mostra loading, erro de forma segura com recuperação e estado vazio', () => {
    vi.mocked(useStudentGradeSummary).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as never);

    const view = render(
      <StudentGradesPanel institutionId="institution-1" studentId="student-1" />,
    );
    expect(screen.getByText('Carregando notas...')).toBeTruthy();
    view.unmount();

    const refetch = vi.fn();
    vi.mocked(useStudentGradeSummary).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('PGRST116 PostgREST Supabase: internal database failure'),
      refetch,
    } as never);
    render(
      <StudentGradesPanel institutionId="institution-1" studentId="student-1" />,
    );
    expect(screen.getByRole('alert').textContent).toContain('Não foi possível carregar as notas. Tente novamente.');
    expect(screen.getByRole('alert').textContent).not.toContain('PGRST116');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(refetch).toHaveBeenCalled();
    cleanup();

    vi.mocked(useStudentGradeSummary).mockReturnValue({
      data: { summary, records: [], recentRecords: [] },
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    render(
      <StudentGradesPanel institutionId="institution-1" studentId="student-1" />,
    );
    expect(screen.getByText('Nenhuma avaliação publicada para este aluno.')).toBeTruthy();
  });
});
