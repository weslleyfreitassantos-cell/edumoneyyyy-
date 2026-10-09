import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { useInstitution } from '../contexts/InstitutionContext';
import { hasEffectivePermission } from '../lib/permissions';
import type { DatabaseRole } from '../lib/roles';
import LoadingIndicator from './LoadingIndicator';

const ACADEMIC_WARMUP_STALE_TIME = 1000 * 60;
const DASHBOARD_WARMUP_STALE_TIME = 1000 * 60 * 5;
const ANNOUNCEMENT_WARMUP_STALE_TIME = 1000 * 60;
const CALENDAR_WARMUP_STALE_TIME = 1000 * 60;
const REGISTRATION_WARMUP_STALE_TIME = 1000 * 60 * 5;
const STUDENT_ACADEMIC_ROUTES = new Set([
  '/student/attendance',
  '/student/grades',
  '/student/report-card',
]);

const studentDashboardQueryKey = (profileId: string, institutionId: string) =>
  ['student-dashboard', profileId, institutionId] as const;

const studentAcademicContextQueryKey = (profileId: string, institutionId: string) =>
  ['student-academic-context', profileId, institutionId] as const;

const attendanceQueryKey = (institutionId: string, studentId: string) =>
  ['attendance', 'student-summary', institutionId, studentId] as const;

const gradesQueryKey = (institutionId: string, studentId: string) =>
  ['grades', 'student-summary', institutionId, studentId] as const;

const reportCardQueryKey = (institutionId: string, studentId: string) =>
  ['academic-closing', 'report-card', institutionId, studentId] as const;

const adminOverviewQueryKey = (institutionId: string) =>
  ['admin-overview', institutionId] as const;

const announcementQueryKey = (institutionId: string) =>
  ['institution-announcements', institutionId] as const;

const audienceAnnouncementQueryKey = (
  institutionId: string,
  audience: string,
) => ['institution-announcements', institutionId, audience] as const;

const dashboardQueryKey = (
  role: 'teacher' | 'guardian',
  profileId: string,
  institutionId: string,
) => [`${role}-dashboard`, profileId, institutionId] as const;

const upcomingCalendarQueryKey = (institutionId: string) =>
  ['academic-calendar', 'upcoming', institutionId, 'ALL'] as const;

const guardianRegistrationQueryKey = (profileId: string) =>
  ['guardian-registration-completion', profileId] as const;

async function warmStudentAcademicData(
  queryClient: ReturnType<typeof useQueryClient>,
  profileId: string,
  institutionId: string,
  isAcademicRoute: boolean,
) {
  let studentId: string | null = null;

  if (isAcademicRoute) {
    const context = await queryClient.fetchQuery({
      queryKey: studentAcademicContextQueryKey(profileId, institutionId),
      queryFn: async () => {
        const { studentDashboardService } = await import('../services/studentDashboardService');
        return studentDashboardService.getAcademicContext(profileId, institutionId);
      },
      staleTime: ACADEMIC_WARMUP_STALE_TIME,
    });
    studentId = context.student.id;
  } else {
    const dashboard = await queryClient.fetchQuery({
      queryKey: studentDashboardQueryKey(profileId, institutionId),
      queryFn: async () => {
        const { studentDashboardService } = await import('../services/studentDashboardService');
        return studentDashboardService.getDashboard(profileId, institutionId);
      },
      staleTime: ACADEMIC_WARMUP_STALE_TIME,
    });
    studentId = dashboard.student.id;
    queryClient.setQueryData(
      studentAcademicContextQueryKey(profileId, institutionId),
      {
        student: dashboard.student,
        activeEnrollment: dashboard.activeEnrollment,
      },
    );
  }

  if (!studentId) return;

  await Promise.allSettled([
    queryClient.fetchQuery({
      queryKey: attendanceQueryKey(institutionId, studentId),
      queryFn: async () => {
        const { attendanceService } = await import('../services/attendanceService');
        return attendanceService.getStudentAttendanceSummary(institutionId, studentId);
      },
      staleTime: ACADEMIC_WARMUP_STALE_TIME,
    }),
    queryClient.fetchQuery({
      queryKey: gradesQueryKey(institutionId, studentId),
      queryFn: async () => {
        const { gradeService } = await import('../services/gradeService');
        return gradeService.getStudentGradeSummary(institutionId, studentId);
      },
      staleTime: ACADEMIC_WARMUP_STALE_TIME,
    }),
    queryClient.fetchQuery({
      queryKey: reportCardQueryKey(institutionId, studentId),
      queryFn: async () => {
        const { reportCardService } = await import('../services/reportCardService');
        return reportCardService.getStudentReportCard(institutionId, studentId);
      },
      staleTime: ACADEMIC_WARMUP_STALE_TIME,
    }),
  ]);
}

async function warmInitialData(
  queryClient: ReturnType<typeof useQueryClient>,
  profileId: string,
  institutionId: string,
  role: DatabaseRole,
  initialPath: string,
  permissions: {
    canViewOverview: boolean;
    canManageAnnouncements: boolean;
  },
) {
  if (role === 'STUDENT') {
    await warmStudentAcademicData(
      queryClient,
      profileId,
      institutionId,
      STUDENT_ACADEMIC_ROUTES.has(initialPath),
    );
    return;
  }

  const requests: Promise<unknown>[] = [];

  if (permissions.canViewOverview) {
    requests.push(
      queryClient.fetchQuery({
        queryKey: adminOverviewQueryKey(institutionId),
        queryFn: async () => {
          const { adminOverviewService } = await import('../services/adminOverviewService');
          return adminOverviewService.getOverview(institutionId);
        },
        staleTime: DASHBOARD_WARMUP_STALE_TIME,
      }),
    );
  }

  if (permissions.canManageAnnouncements) {
    requests.push(
      queryClient.fetchQuery({
        queryKey: announcementQueryKey(institutionId),
        queryFn: async () => {
          const { announcementService } = await import('../services/announcementService');
          return announcementService.listForStaff(institutionId);
        },
        staleTime: ANNOUNCEMENT_WARMUP_STALE_TIME,
      }),
    );
  }

  if (role === 'TEACHER') {
    requests.push(
      queryClient.fetchQuery({
        queryKey: dashboardQueryKey('teacher', profileId, institutionId),
        queryFn: async () => {
          const { teacherDashboardService } = await import('../services/teacherDashboardService');
          return teacherDashboardService.getDashboard(profileId, institutionId);
        },
        staleTime: DASHBOARD_WARMUP_STALE_TIME,
      }),
      queryClient.fetchQuery({
        queryKey: upcomingCalendarQueryKey(institutionId),
        queryFn: async () => {
          const { academicCalendarService } = await import('../services/academicCalendarService');
          return academicCalendarService.listUpcomingForAudience(institutionId);
        },
        staleTime: CALENDAR_WARMUP_STALE_TIME,
      }),
    );
  }

  if (role === 'GUARDIAN') {
    requests.push(
      queryClient.fetchQuery({
        queryKey: dashboardQueryKey('guardian', profileId, institutionId),
        queryFn: async () => {
          const { guardianDashboardService } = await import('../services/guardianDashboardService');
          return guardianDashboardService.getDashboard(profileId, institutionId);
        },
        staleTime: DASHBOARD_WARMUP_STALE_TIME,
      }),
      queryClient.fetchQuery({
        queryKey: upcomingCalendarQueryKey(institutionId),
        queryFn: async () => {
          const { academicCalendarService } = await import('../services/academicCalendarService');
          return academicCalendarService.listUpcomingForAudience(institutionId);
        },
        staleTime: CALENDAR_WARMUP_STALE_TIME,
      }),
      queryClient.fetchQuery({
        queryKey: audienceAnnouncementQueryKey(institutionId, 'GUARDIANS'),
        queryFn: async () => {
          const { announcementService } = await import('../services/announcementService');
          return announcementService.listForAudience(institutionId, 'GUARDIANS');
        },
        staleTime: ANNOUNCEMENT_WARMUP_STALE_TIME,
      }),
      queryClient.fetchQuery({
        queryKey: guardianRegistrationQueryKey(profileId),
        queryFn: async () => {
          const { registrationCompletionService } = await import('../services/registrationCompletionService');
          return registrationCompletionService.getGuardianCompletion(profileId);
        },
        staleTime: REGISTRATION_WARMUP_STALE_TIME,
      }),
    );
  }

  await Promise.allSettled(requests);
}

export default function InitialLoadingGate({
  children,
}: {
  children: ReactNode;
}) {
  const { profile } = useAuth();
  const {
    currentInstitutionId,
    currentRole,
    isLoading: institutionLoading,
  } = useInstitution();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const initialPathRef = useRef(location.pathname);

  const effectiveRole = (currentRole ?? profile?.role)?.toUpperCase() as DatabaseRole | undefined;
  const isDirector = effectiveRole === 'DIRECTOR';
  const shouldWarmInitialData = Boolean(
    profile?.id &&
      currentInstitutionId &&
      effectiveRole &&
      !isDirector,
  );
  const canViewOverview = hasEffectivePermission({
    platformRole: profile?.platform_role,
    membershipRole: currentRole,
    profileRole: profile?.role,
    permission: 'view_school_dashboard',
  });
  const canManageAnnouncements = hasEffectivePermission({
    platformRole: profile?.platform_role,
    membershipRole: currentRole,
    profileRole: profile?.role,
    permission: 'manage_school_users',
  });
  const warmupKey = useMemo(
    () => shouldWarmInitialData && effectiveRole
      ? `${profile?.id}:${currentInstitutionId}:${effectiveRole}`
      : null,
    [currentInstitutionId, effectiveRole, profile?.id, shouldWarmInitialData],
  );

  useEffect(() => {
    if (
      !warmupKey ||
      !profile?.id ||
      !currentInstitutionId ||
      !effectiveRole
    ) return;

    let active = true;
    setReadyKey(null);

    void warmInitialData(
      queryClient,
      profile.id,
      currentInstitutionId,
      effectiveRole,
      initialPathRef.current,
      {
        canViewOverview,
        canManageAnnouncements,
      },
    ).finally(() => {
      if (active) setReadyKey(warmupKey);
    });

    return () => {
      active = false;
    };
  }, [
    canManageAnnouncements,
    canViewOverview,
    currentInstitutionId,
    effectiveRole,
    profile?.id,
    queryClient,
    warmupKey,
  ]);

  if (!shouldWarmInitialData) return <>{children}</>;

  if (
    institutionLoading ||
    !currentInstitutionId ||
    !warmupKey ||
    readyKey !== warmupKey
  ) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6 dark:bg-slate-950">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <LoadingIndicator label="Preparando seus dados..." />
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {effectiveRole === 'STUDENT'
              ? 'Carregando frequência, notas e boletim.'
              : 'Carregando as informações iniciais.'}
          </p>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
