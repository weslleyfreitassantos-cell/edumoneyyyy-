// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../../contexts/AuthContext';
import { useCurrentInstitution } from '../../hooks/useCurrentInstitution';
import {
  useClassCouncilDetails,
  useClassCouncils,
  useUpdateClassCouncilStudentNote,
} from '../../hooks/useClassCouncils';
import TeacherClassCouncilsPanel from './TeacherClassCouncilsPanel';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../hooks/useCurrentInstitution', () => ({ useCurrentInstitution: vi.fn() }));
vi.mock('../../hooks/useClassCouncils', () => ({
  useClassCouncilDetails: vi.fn(),
  useClassCouncils: vi.fn(),
  useUpdateClassCouncilStudentNote: vi.fn(),
}));

const note = {
  id: 'note-1',
  institutionId: 'institution-1',
  councilId: 'council-1',
  studentId: 'student-1',
  studentName: 'Ana Silva',
  registrationNumber: '20260010',
  className: '1º ano A',
  snapshotAt: '2026-09-12T10:00:00Z',
  averageGrade: 62,
  attendancePercentage: 71,
  lowPerformanceSubjects: 1,
  lowAttendanceSubjects: 1,
  pendingItems: 2,
  riskLevel: 'CRITICAL' as const,
  riskReasons: ['1 disciplina abaixo da média', '1 disciplina com frequência baixa'],
  dataStatus: 'PARTIAL' as const,
  teacherContributions: {},
  observation: null,
  resolution: null,
  followUpCategory: null,
  followUpText: null,
  updatedBy: null,
  createdAt: '2026-09-12T10:00:00Z',
  updatedAt: '2026-09-12T10:00:00Z',
};

const council = {
  id: 'council-1',
  institutionId: 'institution-1',
  academicYearId: 'year-1',
  academicYearName: '2026',
  termId: 'term-1',
  termName: '1º bimestre',
  termStartDate: '2026-01-01',
  termEndDate: '2026-04-30',
  classId: 'class-1',
  className: '1º ano A',
  gradeLevel: '1º ano',
  shift: 'MATUTINO',
  status: 'OPEN' as const,
  scheduledAt: null,
  openedAt: null,
  completedAt: null,
  canceledAt: null,
  reopenedAt: null,
  generalNotes: null,
  createdBy: 'director-1',
  openedBy: 'director-1',
  completedBy: null,
  canceledBy: null,
  reopenedBy: null,
  reopenReason: null,
  createdAt: '2026-09-12T10:00:00Z',
  updatedAt: '2026-09-12T10:00:00Z',
};

function mutation() {
  return { isPending: false, isError: false, error: null, mutateAsync: vi.fn().mockResolvedValue(undefined) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({ profile: { id: 'teacher-1', role: 'TEACHER', platform_role: 'USER', full_name: 'Professor', email: 'teacher@example.com' } } as never);
  vi.mocked(useCurrentInstitution).mockReturnValue({ data: 'institution-1', currentRole: 'TEACHER', isLoading: false, isError: false, error: null } as never);
  vi.mocked(useClassCouncils).mockReturnValue({ data: [council], isLoading: false, isError: false, error: null } as never);
  vi.mocked(useClassCouncilDetails).mockReturnValue({ data: { council, participants: [], studentNotes: [note] }, isLoading: false, isError: false, error: null } as never);
  vi.mocked(useUpdateClassCouncilStudentNote).mockReturnValue(mutation() as never);
});

afterEach(() => cleanup());

function renderPanel() {
  return render(<QueryClientProvider client={new QueryClient()}><TeacherClassCouncilsPanel /></QueryClientProvider>);
}

describe('TeacherClassCouncilsPanel', () => {
  it('shows the frozen academic context and allows the teacher contribution while open', () => {
    renderPanel();

    expect(screen.getByText('Ana Silva')).toBeTruthy();
    expect(screen.getByText('RA 20260010 • Dados parciais')).toBeTruthy();
    expect(screen.getByText('62.0%')).toBeTruthy();
    expect(screen.getByText('71.0%')).toBeTruthy();
    expect(screen.getByText('Crítico')).toBeTruthy();
    expect(screen.getByText('Pendências')).toBeTruthy();
    expect(screen.getAllByText('2')).toHaveLength(2);
    expect(screen.getByText('Motivos do risco')).toBeTruthy();
    expect(screen.getByText('1 disciplina abaixo da média')).toBeTruthy();
    expect(screen.getByRole('button', { name: /salvar contribuição/i })).toBeTruthy();
  });

  it('keeps the academic context read-only after completion', () => {
    const completedCouncil = { ...council, status: 'COMPLETED' as const };
    vi.mocked(useClassCouncils).mockReturnValue({ data: [completedCouncil], isLoading: false, isError: false, error: null } as never);
    vi.mocked(useClassCouncilDetails).mockReturnValue({ data: { council: completedCouncil, participants: [], studentNotes: [{ ...note, dataStatus: 'OFFICIAL' as const }] }, isLoading: false, isError: false, error: null } as never);

    renderPanel();

    expect(screen.getByText('RA 20260010 • Resultado oficial')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /salvar contribuição/i })).toBeNull();
  });
});
