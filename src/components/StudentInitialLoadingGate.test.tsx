// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../contexts/AuthContext';
import { useInstitution } from '../contexts/InstitutionContext';
import { attendanceService } from '../services/attendanceService';
import { gradeService } from '../services/gradeService';
import { reportCardService } from '../services/reportCardService';
import { studentDashboardService } from '../services/studentDashboardService';
import StudentInitialLoadingGate from './StudentInitialLoadingGate';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../contexts/InstitutionContext', () => ({ useInstitution: vi.fn() }));
vi.mock('../services/attendanceService', () => ({ attendanceService: { getStudentAttendanceSummary: vi.fn() } }));
vi.mock('../services/gradeService', () => ({ gradeService: { getStudentGradeSummary: vi.fn() } }));
vi.mock('../services/reportCardService', () => ({ reportCardService: { getStudentReportCard: vi.fn() } }));
vi.mock('../services/studentDashboardService', () => ({ studentDashboardService: { getDashboard: vi.fn(), getAcademicContext: vi.fn() } }));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseInstitution = vi.mocked(useInstitution);

const dashboard = {
  student: { id: 'student-1', profile_id: 'profile-1' },
  activeEnrollment: null,
  offerings: [],
  academicYearTerms: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseAuth.mockReturnValue({ profile: { id: 'profile-1', role: 'STUDENT' } } as never);
  mockedUseInstitution.mockReturnValue({ currentInstitutionId: 'institution-1', currentRole: 'STUDENT', isLoading: false } as never);
  vi.mocked(studentDashboardService.getDashboard).mockResolvedValue(dashboard as never);
  vi.mocked(studentDashboardService.getAcademicContext).mockResolvedValue({ student: dashboard.student, activeEnrollment: null } as never);
  vi.mocked(attendanceService.getStudentAttendanceSummary).mockResolvedValue({} as never);
  vi.mocked(gradeService.getStudentGradeSummary).mockResolvedValue({} as never);
  vi.mocked(reportCardService.getStudentReportCard).mockResolvedValue({} as never);
});

afterEach(() => cleanup());

function renderGate(initialEntry = '/dashboard') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <StudentInitialLoadingGate>
          <div>Área do aluno pronta</div>
        </StudentInitialLoadingGate>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('StudentInitialLoadingGate', () => {
  it('shows the initial loading ball and warms all academic panels before release', async () => {
    renderGate();

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('Carregando frequência, notas e boletim.')).toBeTruthy();

    await waitFor(() => expect(screen.getByText('Área do aluno pronta')).toBeTruthy());
    expect(studentDashboardService.getDashboard).toHaveBeenCalledWith('profile-1', 'institution-1');
    expect(attendanceService.getStudentAttendanceSummary).toHaveBeenCalledWith('institution-1', 'student-1');
    expect(gradeService.getStudentGradeSummary).toHaveBeenCalledWith('institution-1', 'student-1');
    expect(reportCardService.getStudentReportCard).toHaveBeenCalledWith('institution-1', 'student-1');
  });

  it('uses the academic context without loading the full dashboard on academic routes', async () => {
    renderGate('/student/grades');

    await waitFor(() => expect(screen.getByText('Área do aluno pronta')).toBeTruthy());
    expect(studentDashboardService.getAcademicContext).toHaveBeenCalledWith('profile-1', 'institution-1');
    expect(studentDashboardService.getDashboard).not.toHaveBeenCalled();
  });
});
