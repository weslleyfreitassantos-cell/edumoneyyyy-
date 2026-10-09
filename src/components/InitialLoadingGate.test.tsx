// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../contexts/AuthContext';
import { useInstitution } from '../contexts/InstitutionContext';
import { academicCalendarService } from '../services/academicCalendarService';
import { adminOverviewService } from '../services/adminOverviewService';
import { attendanceService } from '../services/attendanceService';
import { announcementService } from '../services/announcementService';
import { gradeService } from '../services/gradeService';
import { guardianDashboardService } from '../services/guardianDashboardService';
import { registrationCompletionService } from '../services/registrationCompletionService';
import { reportCardService } from '../services/reportCardService';
import { studentDashboardService } from '../services/studentDashboardService';
import { teacherDashboardService } from '../services/teacherDashboardService';
import InitialLoadingGate from './InitialLoadingGate';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../contexts/InstitutionContext', () => ({ useInstitution: vi.fn() }));
vi.mock('../services/academicCalendarService', () => ({ academicCalendarService: { listUpcomingForAudience: vi.fn() } }));
vi.mock('../services/adminOverviewService', () => ({ adminOverviewService: { getOverview: vi.fn() } }));
vi.mock('../services/attendanceService', () => ({ attendanceService: { getStudentAttendanceSummary: vi.fn() } }));
vi.mock('../services/announcementService', () => ({ announcementService: { listForAudience: vi.fn(), listForStaff: vi.fn() } }));
vi.mock('../services/gradeService', () => ({ gradeService: { getStudentGradeSummary: vi.fn() } }));
vi.mock('../services/guardianDashboardService', () => ({ guardianDashboardService: { getDashboard: vi.fn() } }));
vi.mock('../services/registrationCompletionService', () => ({ registrationCompletionService: { getGuardianCompletion: vi.fn() } }));
vi.mock('../services/reportCardService', () => ({ reportCardService: { getStudentReportCard: vi.fn() } }));
vi.mock('../services/studentDashboardService', () => ({ studentDashboardService: { getDashboard: vi.fn(), getAcademicContext: vi.fn() } }));
vi.mock('../services/teacherDashboardService', () => ({ teacherDashboardService: { getDashboard: vi.fn() } }));

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
  sessionStorage.clear();
  mockedUseAuth.mockReturnValue({ profile: { id: 'profile-1', role: 'STUDENT' } } as never);
  mockedUseInstitution.mockReturnValue({ currentInstitutionId: 'institution-1', currentRole: 'STUDENT', isLoading: false } as never);
  vi.mocked(studentDashboardService.getDashboard).mockResolvedValue(dashboard as never);
  vi.mocked(studentDashboardService.getAcademicContext).mockResolvedValue({ student: dashboard.student, activeEnrollment: null } as never);
  vi.mocked(attendanceService.getStudentAttendanceSummary).mockResolvedValue({} as never);
  vi.mocked(gradeService.getStudentGradeSummary).mockResolvedValue({} as never);
  vi.mocked(reportCardService.getStudentReportCard).mockResolvedValue({} as never);
  vi.mocked(academicCalendarService.listUpcomingForAudience).mockResolvedValue([] as never);
  vi.mocked(adminOverviewService.getOverview).mockResolvedValue({} as never);
  vi.mocked(announcementService.listForAudience).mockResolvedValue([] as never);
  vi.mocked(announcementService.listForStaff).mockResolvedValue([] as never);
  vi.mocked(guardianDashboardService.getDashboard).mockResolvedValue({} as never);
  vi.mocked(registrationCompletionService.getGuardianCompletion).mockResolvedValue({} as never);
  vi.mocked(teacherDashboardService.getDashboard).mockResolvedValue({} as never);
});

afterEach(() => cleanup());

function renderGate(initialEntry = '/dashboard') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
      <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <InitialLoadingGate>
          <div>Área pronta</div>
        </InitialLoadingGate>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function setRole(role: string) {
  mockedUseAuth.mockReturnValue({ profile: { id: 'profile-1', role } } as never);
  mockedUseInstitution.mockReturnValue({ currentInstitutionId: 'institution-1', currentRole: role, isLoading: false } as never);
}

describe('InitialLoadingGate', () => {
  it('shows only the loading ball and warms academic panels without blocking the shell', async () => {
    renderGate();

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByText('Preparando seus dados...')).toBeNull();
    expect(screen.queryByText('Carregando frequência, notas e boletim.')).toBeNull();

    await waitFor(() => expect(screen.getByText('Área pronta')).toBeTruthy());
    expect(studentDashboardService.getDashboard).toHaveBeenCalledWith('profile-1', 'institution-1');
    expect(attendanceService.getStudentAttendanceSummary).toHaveBeenCalledWith('institution-1', 'student-1');
    expect(gradeService.getStudentGradeSummary).toHaveBeenCalledWith('institution-1', 'student-1');
    expect(reportCardService.getStudentReportCard).toHaveBeenCalledWith('institution-1', 'student-1');
  });

  it('releases the shell while a slow academic panel continues warming the cache', async () => {
    let resolveAttendance: (() => void) | undefined;
    const attendanceWarmup = new Promise<void>((resolve) => {
      resolveAttendance = resolve;
    });
    vi.mocked(attendanceService.getStudentAttendanceSummary).mockImplementation(
      () => attendanceWarmup as never,
    );

    renderGate();

    await waitFor(() => expect(screen.getByText('Área pronta')).toBeTruthy());
    expect(screen.queryByText('Carregando frequência, notas e boletim.')).toBeNull();
    expect(attendanceService.getStudentAttendanceSummary).toHaveBeenCalledWith(
      'institution-1',
      'student-1',
    );

    resolveAttendance?.();
  });

  it('uses the academic context without loading the full dashboard on academic routes', async () => {
    renderGate('/student/grades');

    await waitFor(() => expect(screen.getByText('Área pronta')).toBeTruthy());
    expect(studentDashboardService.getAcademicContext).toHaveBeenCalledWith('profile-1', 'institution-1');
    expect(studentDashboardService.getDashboard).not.toHaveBeenCalled();
  });

  it.each(['ADMIN', 'SECRETARY'])('warms the administrative overview and announcements for %s before release', async (role) => {
    setRole(role);
    renderGate();

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByText('Carregando as informações iniciais.')).toBeNull();
    await waitFor(() => expect(screen.getByText('Área pronta')).toBeTruthy());
    expect(adminOverviewService.getOverview).toHaveBeenCalledWith('institution-1');
    expect(announcementService.listForStaff).toHaveBeenCalledWith('institution-1');
  });

  it('warms the teacher dashboard and calendar before release', async () => {
    setRole('TEACHER');
    renderGate();

    await waitFor(() => expect(screen.getByText('Área pronta')).toBeTruthy());
    expect(teacherDashboardService.getDashboard).toHaveBeenCalledWith('profile-1', 'institution-1');
    expect(academicCalendarService.listUpcomingForAudience).toHaveBeenCalledWith('institution-1');
  });

  it('warms the guardian dashboard, calendar, announcements and registration before release', async () => {
    setRole('GUARDIAN');
    renderGate();

    await waitFor(() => expect(screen.getByText('Área pronta')).toBeTruthy());
    expect(guardianDashboardService.getDashboard).toHaveBeenCalledWith('profile-1', 'institution-1');
    expect(academicCalendarService.listUpcomingForAudience).toHaveBeenCalledWith('institution-1');
    expect(announcementService.listForAudience).toHaveBeenCalledWith('institution-1', 'GUARDIANS');
    expect(registrationCompletionService.getGuardianCompletion).toHaveBeenCalledWith('profile-1');
  });

  it('does not block directors with the initial loading gate', () => {
    setRole('DIRECTOR');
    renderGate();

    expect(screen.getByText('Área pronta')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expect(adminOverviewService.getOverview).not.toHaveBeenCalled();
    expect(teacherDashboardService.getDashboard).not.toHaveBeenCalled();
    expect(guardianDashboardService.getDashboard).not.toHaveBeenCalled();
  });
});
