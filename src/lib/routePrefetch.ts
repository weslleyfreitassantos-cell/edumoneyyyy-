import type { QueryClient } from '@tanstack/react-query';

import type { UserRole } from '../types';
import type { BookRecommendationFilters } from '../services/bookRecommendationService';

const DASHBOARD_STALE_TIME = 1000 * 60 * 5;
const ROUTE_STALE_TIME = 1000 * 60;
const LEARNING_CENTER_STALE_TIME = 1000 * 60 * 5;

const inFlightPrefetches = new Map<string, Promise<void>>();

type PrefetchInput = {
  path: string;
  role: UserRole;
  institutionId: string | null | undefined;
  profileId: string | null | undefined;
  queryClient: QueryClient;
};

type StudentDashboard = {
  student: { id: string };
};

type StudentAcademicContext = {
  student: { id: string };
};

const learningPostFilters = {
  search: '',
  subjectId: '',
  classId: '',
  postType: 'ALL',
  status: 'active',
  page: 1,
  pageSize: 20,
} as const;

function prefetchQuery(
  queryClient: QueryClient,
  options: Parameters<QueryClient['prefetchQuery']>[0],
): Promise<unknown> {
  return queryClient.prefetchQuery(options);
}

async function prefetchStudentDashboard(
  queryClient: QueryClient,
  institutionId: string,
  profileId: string,
): Promise<StudentDashboard> {
  return queryClient.fetchQuery({
    queryKey: ['student-dashboard', profileId, institutionId],
    queryFn: async () => {
      const { studentDashboardService } = await import('../services/studentDashboardService');
      return studentDashboardService.getDashboard(profileId, institutionId);
    },
    staleTime: DASHBOARD_STALE_TIME,
  });
}

async function prefetchStudentAcademicRoute(
  path: string,
  queryClient: QueryClient,
  institutionId: string,
  profileId: string,
): Promise<void> {
  const [context] = await Promise.all([
    queryClient.fetchQuery<StudentAcademicContext>({
      queryKey: ['student-academic-context', profileId, institutionId],
      queryFn: async () => {
        const { studentDashboardService } = await import('../services/studentDashboardService');
        return studentDashboardService.getAcademicContext(profileId, institutionId);
      },
      staleTime: DASHBOARD_STALE_TIME,
    }),
    import('../components/StudentAcademicResultsPage'),
  ]);
  const studentId = context.student.id;

  if (path === '/student/attendance') {
    await prefetchQuery(queryClient, {
      queryKey: ['attendance', 'student-summary', institutionId, studentId],
      queryFn: async () => {
        const { attendanceService } = await import('../services/attendanceService');
        return attendanceService.getStudentAttendanceSummary(institutionId, studentId);
      },
      staleTime: ROUTE_STALE_TIME,
    });
    return;
  }

  if (path === '/student/grades') {
    await prefetchQuery(queryClient, {
      queryKey: ['grades', 'student-summary', institutionId, studentId],
      queryFn: async () => {
        const { gradeService } = await import('../services/gradeService');
        return gradeService.getStudentGradeSummary(institutionId, studentId);
      },
      staleTime: ROUTE_STALE_TIME,
    });
    return;
  }

  await prefetchQuery(queryClient, {
    queryKey: ['academic-closing', 'report-card', institutionId, studentId],
    queryFn: async () => {
      const { reportCardService } = await import('../services/reportCardService');
      return reportCardService.getStudentReportCard(institutionId, studentId);
    },
    staleTime: ROUTE_STALE_TIME,
  });
}

async function prefetchStudyCenter(
  queryClient: QueryClient,
  institutionId: string,
  profileId: string,
): Promise<void> {
  await Promise.all([
    import('../components/learning/StudyCenterPage'),
    prefetchQuery(queryClient, {
      queryKey: ['learning-center', 'student', institutionId, profileId],
      queryFn: async () => {
        const { learningCenterService } = await import('../services/learningCenterService');
        return learningCenterService.studentForProfile(institutionId, profileId);
      },
      staleTime: LEARNING_CENTER_STALE_TIME,
    }),
    prefetchQuery(queryClient, {
      queryKey: ['learning-center', 'subjects', 'student', institutionId],
      queryFn: async () => {
        const { learningCenterService } = await import('../services/learningCenterService');
        return learningCenterService.studentSubjects(institutionId, profileId);
      },
      staleTime: LEARNING_CENTER_STALE_TIME,
    }),
    prefetchQuery(queryClient, {
      queryKey: ['learning-center', 'enem-simulation-templates', institutionId],
      queryFn: async () => {
        const { learningCenterService } = await import('../services/learningCenterService');
        return learningCenterService.enemSimulationTemplates(institutionId);
      },
      staleTime: ROUTE_STALE_TIME,
    }),
  ]);
}

async function prefetchLearningMaterials(
  queryClient: QueryClient,
  institutionId: string,
  profileId: string,
  role: Extract<UserRole, 'student' | 'teacher'>,
): Promise<void> {
  await Promise.all([
    import('../components/learning/LearningContentPage'),
    prefetchQuery(queryClient, {
      queryKey: [
        'learning-content',
        'posts',
        institutionId,
        profileId,
        learningPostFilters,
        role === 'student',
      ],
      queryFn: async () => {
        const { learningContentService } = await import('../services/learningContentService');
        return learningContentService.listPosts(
          institutionId,
          profileId,
          learningPostFilters,
          { includeReadState: role === 'student' },
        );
      },
      staleTime: ROUTE_STALE_TIME,
    }),
    prefetchQuery(queryClient, {
      queryKey: role === 'student'
        ? ['learning-content', 'student-targets', institutionId]
        : ['learning-content', 'targets', institutionId],
      queryFn: async () => {
        const { learningContentService } = await import('../services/learningContentService');
        return role === 'student'
          ? learningContentService.listStudentTargets(institutionId)
          : learningContentService.listTeacherTargets(institutionId);
      },
      staleTime: ROUTE_STALE_TIME,
    }),
  ]);
}

async function prefetchBookLibrary(
  queryClient: QueryClient,
  institutionId: string,
  profileId: string,
  role: Extract<UserRole, 'student' | 'teacher'>,
): Promise<void> {
  const filters: BookRecommendationFilters = role === 'student'
    ? {}
    : { search: '', subjectOfferingId: '', status: 'all' };

  await Promise.all([
    import('../components/learning/LibraryPage'),
    prefetchQuery(queryClient, {
      queryKey: role === 'student'
        ? ['book-recommendations', 'student', institutionId, filters]
        : ['book-recommendations', 'teacher', institutionId, profileId, filters],
      queryFn: async () => {
        const { bookRecommendationService } = await import('../services/bookRecommendationService');
        return role === 'student'
          ? bookRecommendationService.listForStudent(institutionId, filters)
          : bookRecommendationService.listForTeacher(institutionId, profileId, filters);
      },
      staleTime: ROUTE_STALE_TIME,
    }),
    role === 'teacher'
      ? prefetchQuery(queryClient, {
          queryKey: ['book-recommendations', 'offerings', institutionId, profileId],
          queryFn: async () => {
            const { bookRecommendationService } = await import('../services/bookRecommendationService');
            return bookRecommendationService.listTeacherOfferings(institutionId, profileId);
          },
          staleTime: ROUTE_STALE_TIME,
        })
      : Promise.resolve(),
  ]);
}

async function runPrefetch({
  path,
  role,
  institutionId,
  profileId,
  queryClient,
}: PrefetchInput): Promise<void> {
  if (
    role === 'student' &&
    ['/student/attendance', '/student/grades', '/student/report-card'].includes(path)
  ) {
    await prefetchStudentAcademicRoute(path, queryClient, institutionId!, profileId!);
    return;
  }

  if (role === 'student' && path === '/student/study') {
    await prefetchStudyCenter(queryClient, institutionId!, profileId!);
    return;
  }

  if (role === 'student' && path === '/student/calendar') {
    await Promise.all([
      import('../components/StudentCalendarPage'),
      prefetchQuery(queryClient, {
        queryKey: ['academic-calendar', 'student', institutionId],
        queryFn: async () => {
          const { academicCalendarService } = await import('../services/academicCalendarService');
          return academicCalendarService.listForStudent(institutionId!);
        },
        staleTime: ROUTE_STALE_TIME,
      }),
    ]);
    return;
  }

  if (path === '/dashboard/materials' && (role === 'student' || role === 'teacher')) {
    await prefetchLearningMaterials(queryClient, institutionId!, profileId!, role);
    return;
  }

  if (path === '/dashboard/library' && (role === 'student' || role === 'teacher')) {
    await prefetchBookLibrary(queryClient, institutionId!, profileId!, role);
    return;
  }

  if (role === 'teacher' && path.startsWith('/dashboard/')) {
    await Promise.all([
      import('../components/TeacherDashboard'),
      prefetchQuery(queryClient, {
        queryKey: ['teacher-dashboard', profileId, institutionId],
        queryFn: async () => {
          const { teacherDashboardService } = await import('../services/teacherDashboardService');
          return teacherDashboardService.getDashboard(profileId!, institutionId!);
        },
        staleTime: DASHBOARD_STALE_TIME,
      }),
    ]);
  }
}

export function prefetchUserRoute(input: PrefetchInput): void {
  if (!input.institutionId || !input.profileId) return;

  const key = `${input.role}:${input.institutionId}:${input.profileId}:${input.path}`;
  const existing = inFlightPrefetches.get(key);
  if (existing) return;

  const request = runPrefetch(input)
    .catch(() => undefined)
    .finally(() => {
      inFlightPrefetches.delete(key);
    });

  inFlightPrefetches.set(key, request);
}
