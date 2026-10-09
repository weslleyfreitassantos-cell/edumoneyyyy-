import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { useInstitution } from '../contexts/InstitutionContext';
import { hasEffectivePermission } from '../lib/permissions';
import {
  directorCameraKeys,
  directorGatewayKeys,
} from '../hooks/useDirectorCameras';
import { cameraService } from '../services/cameraService';

const CAMERA_STALE_TIME = 1000 * 30;
const ADMIN_OVERVIEW_STALE_TIME = 5 * 60 * 1000;
const ANNOUNCEMENT_STALE_TIME = 1000 * 60;
const DASHBOARD_STALE_TIME = 1000 * 60 * 5;
const REGISTRATION_COMPLETION_STALE_TIME = 1000 * 60 * 5;
const ACADEMIC_CALENDAR_STALE_TIME = 1000 * 60;
const LEARNING_CENTER_STALE_TIME = 1000 * 60 * 5;

const adminOverviewQueryKey = (institutionId: string) =>
  ['admin-overview', institutionId] as const;

const announcementQueryKey = {
  list: (institutionId: string | undefined) =>
    ['institution-announcements', institutionId ?? 'none'] as const,
  audience: (institutionId: string | undefined, audience: string) =>
    [
      'institution-announcements',
      institutionId ?? 'none',
      audience,
    ] as const,
};

const dashboardQueryKey = (
  role: 'student' | 'teacher' | 'guardian',
  profileId: string,
  institutionId: string,
) => [`${role}-dashboard`, profileId, institutionId] as const;

const upcomingCalendarQueryKey = (institutionId: string) =>
  ['academic-calendar', 'upcoming', institutionId, 'ALL'] as const;

const learningCenterQueryKey = {
  student: (institutionId: string, profileId: string) =>
    ['learning-center', 'student', institutionId, profileId] as const,
  subjects: (institutionId: string) =>
    ['learning-center', 'subjects', 'student', institutionId] as const,
  guidedSessionV2: (institutionId: string, studentId: string) =>
    ['learning-center', 'guided-session-v2', institutionId, studentId] as const,
  enemSimulationTemplates: (institutionId: string) =>
    ['learning-center', 'enem-simulation-templates', institutionId] as const,
};

const studentRegistrationQueryKey = (
  studentId: string,
  institutionId: string,
) => ['student-registration-completion', studentId, institutionId] as const;

const guardianRegistrationQueryKey = (profileId: string) =>
  ['guardian-registration-completion', profileId] as const;

function scheduleIdle(task: () => void): () => void {
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  if (idleWindow.requestIdleCallback) {
    const handle = idleWindow.requestIdleCallback(task);
    return () => idleWindow.cancelIdleCallback?.(handle);
  }

  const handle = window.setTimeout(task, 0);
  return () => window.clearTimeout(handle);
}

export default function AuthenticatedDataPreloader() {
  const { profile } = useAuth();
  const { currentInstitutionId, currentRole, isLoading } = useInstitution();
  const queryClient = useQueryClient();

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
  const canSendSchoolEmail = hasEffectivePermission({
    platformRole: profile?.platform_role,
    membershipRole: currentRole,
    profileRole: profile?.role,
    permission: 'send_school_email',
  });
  const canViewDirectorCameras =
    currentRole === 'DIRECTOR' &&
    hasEffectivePermission({
      platformRole: profile?.platform_role,
      membershipRole: currentRole,
      profileRole: profile?.role,
      permission: 'view_live_cameras',
    });

  useEffect(() => {
    if (!profile || isLoading || !currentInstitutionId) return;

    const institutionId = currentInstitutionId;
    const profileId = profile.id;
    const effectiveDatabaseRole = currentRole ?? profile.role;
    const isStudentAcademicRoute =
      effectiveDatabaseRole === 'STUDENT' &&
      ['/student/attendance', '/student/grades', '/student/report-card'].includes(
        window.location.pathname,
      );
    const requests: Promise<unknown>[] = [];
    let studentDashboardRequest: Promise<{
      student: { id: string };
    }> | null = null;

    if (canViewOverview) {
      requests.push(
        queryClient.prefetchQuery({
          queryKey: adminOverviewQueryKey(institutionId),
          queryFn: async () => {
            const { adminOverviewService } = await import('../services/adminOverviewService');
            return adminOverviewService.getOverview(institutionId);
          },
          staleTime: ADMIN_OVERVIEW_STALE_TIME,
        }),
      );
    }

    if (canManageAnnouncements) {
      requests.push(
        queryClient.prefetchQuery({
          queryKey: announcementQueryKey.list(institutionId),
          queryFn: async () => {
            const { announcementService } = await import('../services/announcementService');
            return announcementService.listForStaff(institutionId);
          },
          staleTime: ANNOUNCEMENT_STALE_TIME,
        }),
      );
    }

    if (canSendSchoolEmail) {
      requests.push(
        import('../services/schoolEmailService').then(({ schoolEmailService }) => {
          if (schoolEmailService.getCachedRecipients(institutionId)) {
            return undefined;
          }

          return schoolEmailService.listRecipients(institutionId);
        }),
      );
    }

    if (canViewDirectorCameras) {
      requests.push(
        queryClient.prefetchQuery({
          queryKey: directorCameraKeys.list(institutionId),
          queryFn: () => cameraService.list(institutionId),
          staleTime: CAMERA_STALE_TIME,
        }),
        queryClient.prefetchQuery({
          queryKey: directorGatewayKeys.list(institutionId),
          queryFn: () => cameraService.listGateways(institutionId),
          staleTime: CAMERA_STALE_TIME,
        }),
      );
    }

    if (effectiveDatabaseRole === 'STUDENT' && !isStudentAcademicRoute) {
      studentDashboardRequest = queryClient.fetchQuery({
        queryKey: dashboardQueryKey('student', profileId, institutionId),
        queryFn: async () => {
          const { studentDashboardService } = await import('../services/studentDashboardService');
          return studentDashboardService.getDashboard(profileId, institutionId);
        },
        staleTime: DASHBOARD_STALE_TIME,
      });

      requests.push(studentDashboardRequest);
    }

    if (effectiveDatabaseRole === 'STUDENT') {
      const learningStudentRequest = queryClient.fetchQuery({
        queryKey: learningCenterQueryKey.student(institutionId, profileId),
        queryFn: async () => {
          const { learningCenterService } = await import('../services/learningCenterService');
          return learningCenterService.studentForProfile(institutionId, profileId);
        },
        staleTime: LEARNING_CENTER_STALE_TIME,
      });

      requests.push(
        learningStudentRequest,
        queryClient.prefetchQuery({
          queryKey: learningCenterQueryKey.subjects(institutionId),
          queryFn: async () => {
            const { learningCenterService } = await import('../services/learningCenterService');
            return learningCenterService.studentSubjects(institutionId, profileId);
          },
          staleTime: LEARNING_CENTER_STALE_TIME,
        }),
        queryClient.prefetchQuery({
          queryKey: learningCenterQueryKey.enemSimulationTemplates(institutionId),
          queryFn: async () => {
            const { learningCenterService } = await import('../services/learningCenterService');
            return learningCenterService.enemSimulationTemplates(institutionId);
          },
          staleTime: LEARNING_CENTER_STALE_TIME,
        }),
        import('./learning/StudyCenterPage'),
        learningStudentRequest.then((learningStudent) =>
          queryClient.prefetchQuery({
            queryKey: learningCenterQueryKey.guidedSessionV2(institutionId, learningStudent.id),
            queryFn: async () => {
              const { learningCenterService } = await import('../services/learningCenterService');
              try {
                return await learningCenterService.guidedSessionV2(institutionId, learningStudent.id);
              } catch {
                return null;
              }
            },
            staleTime: 15000,
            retry: false,
          }),
        ),
      );
    }

    if (effectiveDatabaseRole === 'TEACHER') {
      requests.push(
        queryClient.fetchQuery({
          queryKey: dashboardQueryKey('teacher', profileId, institutionId),
          queryFn: async () => {
            const { teacherDashboardService } = await import('../services/teacherDashboardService');
            return teacherDashboardService.getDashboard(profileId, institutionId);
          },
          staleTime: DASHBOARD_STALE_TIME,
        }),
        queryClient.prefetchQuery({
          queryKey: upcomingCalendarQueryKey(institutionId),
          queryFn: async () => {
            const { academicCalendarService } = await import('../services/academicCalendarService');
            return academicCalendarService.listUpcomingForAudience(institutionId);
          },
          staleTime: ACADEMIC_CALENDAR_STALE_TIME,
        }),
      );
    }

    if (effectiveDatabaseRole === 'GUARDIAN') {
      requests.push(
        queryClient.fetchQuery({
          queryKey: dashboardQueryKey('guardian', profileId, institutionId),
          queryFn: async () => {
            const { guardianDashboardService } = await import('../services/guardianDashboardService');
            return guardianDashboardService.getDashboard(profileId, institutionId);
          },
          staleTime: DASHBOARD_STALE_TIME,
        }),
        queryClient.prefetchQuery({
          queryKey: upcomingCalendarQueryKey(institutionId),
          queryFn: async () => {
            const { academicCalendarService } = await import('../services/academicCalendarService');
            return academicCalendarService.listUpcomingForAudience(institutionId);
          },
          staleTime: ACADEMIC_CALENDAR_STALE_TIME,
        }),
        queryClient.prefetchQuery({
          queryKey: announcementQueryKey.audience(institutionId, 'GUARDIANS'),
          queryFn: async () => {
            const { announcementService } = await import('../services/announcementService');
            return announcementService.listForAudience(institutionId, 'GUARDIANS');
          },
          staleTime: ANNOUNCEMENT_STALE_TIME,
        }),
        queryClient.prefetchQuery({
          queryKey: guardianRegistrationQueryKey(profileId),
          queryFn: async () => {
            const { registrationCompletionService } = await import('../services/registrationCompletionService');
            return registrationCompletionService.getGuardianCompletion(profileId);
          },
          staleTime: REGISTRATION_COMPLETION_STALE_TIME,
        }),
      );
    }

    void Promise.allSettled(requests);

    return scheduleIdle(() => {
      const idleRequests: Promise<unknown>[] = [];

      if (canViewOverview) {
        idleRequests.push(import('../pages/Admin/AdminPage'));
      }
      if (canSendSchoolEmail) {
        idleRequests.push(import('../pages/Admin/tabs/EmailTab'));
      }
      if (canViewDirectorCameras) {
        idleRequests.push(import('../pages/Cameras/CamerasPage'));
      }

      if (effectiveDatabaseRole === 'STUDENT') {
        if (!isStudentAcademicRoute) {
          idleRequests.push(import('./StudentDashboard'));
          idleRequests.push(
            queryClient.prefetchQuery({
              queryKey: upcomingCalendarQueryKey(institutionId),
              queryFn: async () => {
                const { academicCalendarService } = await import('../services/academicCalendarService');
                return academicCalendarService.listUpcomingForAudience(institutionId);
              },
              staleTime: ACADEMIC_CALENDAR_STALE_TIME,
            }),
            queryClient.prefetchQuery({
              queryKey: announcementQueryKey.audience(institutionId, 'STUDENTS'),
              queryFn: async () => {
                const { announcementService } = await import('../services/announcementService');
                return announcementService.listForAudience(institutionId, 'STUDENTS');
              },
              staleTime: ANNOUNCEMENT_STALE_TIME,
            }),
          );

          if (studentDashboardRequest) {
            idleRequests.push(
              studentDashboardRequest.then((dashboard) =>
                queryClient.prefetchQuery({
                  queryKey: studentRegistrationQueryKey(
                    dashboard.student.id,
                    institutionId,
                  ),
                  queryFn: async () => {
                    const { registrationCompletionService } = await import('../services/registrationCompletionService');
                    return registrationCompletionService.getStudentCompletion(
                      dashboard.student.id,
                      institutionId,
                    );
                  },
                  staleTime: REGISTRATION_COMPLETION_STALE_TIME,
                }),
              ),
            );
          }
        }
      }

      if (effectiveDatabaseRole === 'TEACHER') {
        idleRequests.push(import('./TeacherDashboard'));
      }

      if (effectiveDatabaseRole === 'GUARDIAN') {
        idleRequests.push(import('./ParentDashboard'));
      }

      void Promise.allSettled(idleRequests);
    });
  }, [
    canManageAnnouncements,
    canViewDirectorCameras,
    canSendSchoolEmail,
    canViewOverview,
    currentInstitutionId,
    currentRole,
    isLoading,
    profile,
    queryClient,
  ]);

  return null;
}
