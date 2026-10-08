import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { useInstitution } from '../contexts/InstitutionContext';
import LoadingIndicator from './LoadingIndicator';

const ACADEMIC_WARMUP_STALE_TIME = 1000 * 60;
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

export default function StudentInitialLoadingGate({
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

  const isStudent = (currentRole ?? profile?.role)?.toUpperCase() === 'STUDENT';
  const warmupKey = useMemo(
    () => profile?.id && currentInstitutionId && isStudent
      ? `${profile.id}:${currentInstitutionId}`
      : null,
    [currentInstitutionId, isStudent, profile?.id],
  );

  useEffect(() => {
    if (!warmupKey || !profile?.id || !currentInstitutionId) return;

    let active = true;
    setReadyKey(null);

    void warmStudentAcademicData(
      queryClient,
      profile.id,
      currentInstitutionId,
      STUDENT_ACADEMIC_ROUTES.has(initialPathRef.current),
    ).finally(() => {
      if (active) setReadyKey(warmupKey);
    });

    return () => {
      active = false;
    };
  }, [currentInstitutionId, profile?.id, queryClient, warmupKey]);

  if (!isStudent) return <>{children}</>;

  if (
    institutionLoading ||
    !currentInstitutionId ||
    !warmupKey ||
    readyKey !== warmupKey
  ) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6 dark:bg-slate-950">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <LoadingIndicator label="Preparando seus dados acadêmicos..." />
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Carregando frequência, notas e boletim.
          </p>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
