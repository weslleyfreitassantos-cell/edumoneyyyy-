import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  announcementService,
  type AnnouncementAudience,
  type AnnouncementInput,
} from '../services/announcementService';

export const announcementKeys = {
  all: ['institution-announcements'] as const,
  list: (institutionId: string | undefined) => [...announcementKeys.all, institutionId ?? 'none'] as const,
  audience: (institutionId: string | undefined, audience: string) => [...announcementKeys.list(institutionId), audience] as const,
};

export function useInstitutionAnnouncements(institutionId: string) {
  return useQuery({
    queryKey: announcementKeys.list(institutionId),
    queryFn: () => announcementService.listForStaff(institutionId),
    enabled: Boolean(institutionId),
  });
}

export function useAudienceAnnouncements(
  institutionId: string | null,
  audience: Exclude<AnnouncementAudience, 'ALL'>,
) {
  return useQuery({
    queryKey: announcementKeys.audience(institutionId ?? undefined, audience),
    queryFn: () => announcementService.listForAudience(institutionId as string, audience),
    enabled: Boolean(institutionId),
    staleTime: 1000 * 60,
  });
}

export function useCreateAnnouncement(institutionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AnnouncementInput) => announcementService.create(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: announcementKeys.list(institutionId) });
      await queryClient.invalidateQueries({ queryKey: announcementKeys.all });
    },
  });
}

export function useSetAnnouncementActive(institutionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => announcementService.setActive(id, institutionId, active),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: announcementKeys.list(institutionId) });
      await queryClient.invalidateQueries({ queryKey: announcementKeys.all });
    },
  });
}

export function useDeleteAnnouncement(institutionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => announcementService.remove(id, institutionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: announcementKeys.list(institutionId) });
      await queryClient.invalidateQueries({ queryKey: announcementKeys.all });
    },
  });
}
