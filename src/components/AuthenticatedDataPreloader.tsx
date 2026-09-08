import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { useInstitution } from '../contexts/InstitutionContext';
import { hasEffectivePermission } from '../lib/permissions';
import {
  adminOverviewKeys,
  ADMIN_OVERVIEW_STALE_TIME,
} from '../hooks/useAdminOverview';
import {
  announcementKeys,
  ANNOUNCEMENT_STALE_TIME,
} from '../hooks/useAnnouncements';
import {
  directorCameraKeys,
  directorGatewayKeys,
} from '../hooks/useDirectorCameras';
import { adminOverviewService } from '../services/adminOverviewService';
import { announcementService } from '../services/announcementService';
import { cameraService } from '../services/cameraService';
import { schoolEmailService } from '../services/schoolEmailService';

const CAMERA_STALE_TIME = 1000 * 30;

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
  const canManageCameras = hasEffectivePermission({
    platformRole: profile?.platform_role,
    membershipRole: currentRole,
    profileRole: profile?.role,
    permission: 'view_live_cameras',
  });

  useEffect(() => {
    if (!profile || isLoading || !currentInstitutionId) return;

    const institutionId = currentInstitutionId;
    const requests: Promise<unknown>[] = [];

    if (canViewOverview) {
      requests.push(
        queryClient.prefetchQuery({
          queryKey: adminOverviewKeys.detail(institutionId),
          queryFn: () => adminOverviewService.getOverview(institutionId),
          staleTime: ADMIN_OVERVIEW_STALE_TIME,
        }),
      );
    }

    if (canManageAnnouncements) {
      requests.push(
        queryClient.prefetchQuery({
          queryKey: announcementKeys.list(institutionId),
          queryFn: () => announcementService.listForStaff(institutionId),
          staleTime: ANNOUNCEMENT_STALE_TIME,
        }),
      );
    }

    if (canSendSchoolEmail && !schoolEmailService.getCachedRecipients(institutionId)) {
      requests.push(schoolEmailService.listRecipients(institutionId));
    }

    if (canManageCameras) {
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

    void Promise.allSettled(requests);

    return scheduleIdle(() => {
      const modulePreloads: Promise<unknown>[] = [];

      if (canViewOverview) {
        modulePreloads.push(import('../pages/Admin/AdminPage'));
      }
      if (canSendSchoolEmail) {
        modulePreloads.push(import('../pages/Admin/tabs/EmailTab'));
      }
      if (canManageCameras) {
        modulePreloads.push(import('../pages/Cameras/CamerasPage'));
      }

      void Promise.allSettled(modulePreloads);
    });
  }, [
    canManageAnnouncements,
    canManageCameras,
    canSendSchoolEmail,
    canViewOverview,
    currentInstitutionId,
    isLoading,
    profile,
    queryClient,
  ]);

  return null;
}
