// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useStudentAttendanceSummary } from '../../hooks/useAttendance';
import StudentAttendanceSummaryPanel from './StudentAttendanceSummaryPanel';

vi.mock('../../hooks/useAttendance', () => ({
  useStudentAttendanceSummary: vi.fn(),
}));

const summary = {
  totalRecords: 2,
  presentRecords: 1,
  absentRecords: 0,
  lateRecords: 1,
  excusedRecords: 0,
  attendanceRate: 75,
};

const record = {
  id: 'attendance-1',
  sessionId: 'session-1',
  subjectOfferingId: 'offering-1',
  studentId: 'student-1',
  studentName: 'Aluno Teste',
  registrationNumber: 'RA-1',
  status: 'PRESENT' as const,
  notes: null,
  recordedAt: '2026-09-10T10:00:00Z',
  sessionDate: '2026-09-10',
  subjectName: 'Matemática',
  subjectCode: 'MAT',
  className: '1º A',
  teacherName: 'Prof. Ana',
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('StudentAttendanceSummaryPanel', () => {
  it('mostra resumo e registros recentes', () => {
    vi.mocked(useStudentAttendanceSummary).mockReturnValue({
      data: { summary, records: [record], recentRecords: [record] },
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    render(
      <StudentAttendanceSummaryPanel
        institutionId="institution-1"
        studentId="student-1"
        title="Resumo de frequência"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Resumo de frequência' })).toBeTruthy();
    expect(screen.getByText('Presença')).toBeTruthy();
    expect(screen.getByText('Registros recentes')).toBeTruthy();
    expect(screen.getByText('Matemática')).toBeTruthy();
    expect(screen.getByText('Presente')).toBeTruthy();
  });

  it('mostra loading, erro e estado vazio', () => {
    vi.mocked(useStudentAttendanceSummary).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as never);

    const view = render(
      <StudentAttendanceSummaryPanel institutionId="institution-1" studentId="student-1" />,
    );
    expect(screen.getByText('Carregando frequência...')).toBeTruthy();
    view.unmount();

    vi.mocked(useStudentAttendanceSummary).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Falha controlada'),
    } as never);
    render(
      <StudentAttendanceSummaryPanel institutionId="institution-1" studentId="student-1" />,
    );
    expect(screen.getByRole('alert').textContent).toContain('Falha controlada');
    cleanup();

    vi.mocked(useStudentAttendanceSummary).mockReturnValue({
      data: { summary: { ...summary, totalRecords: 0 }, records: [], recentRecords: [] },
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    render(
      <StudentAttendanceSummaryPanel institutionId="institution-1" studentId="student-1" />,
    );
    expect(screen.getByText('Nenhum registro de frequência publicado.')).toBeTruthy();
  });
});
