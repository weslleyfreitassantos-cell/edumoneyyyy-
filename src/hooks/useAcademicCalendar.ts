import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  academicCalendarService,
  type AcademicCalendarAudience,
  type AcademicCalendarEvent,
  type AcademicCalendarEventFilters,
  type AcademicCalendarEventInput,
} from '../services/academicCalendarService';

export const academicCalendarKeys = {
  all: ['academic-calendar'] as const,
  list: (institutionId: string, filters: AcademicCalendarEventFilters = {}) =>
    [...academicCalendarKeys.all, 'list', institutionId, filters] as const,
  upcoming: (institutionId: string, audience: AcademicCalendarAudience) =>
    [...academicCalendarKeys.all, 'upcoming', institutionId, audience] as const,
};

function invalidateAcademicCalendar(
  queryClient: ReturnType<typeof useQueryClient>,
  institutionId: string,
) {
  return queryClient.invalidateQueries({
    queryKey: [...academicCalendarKeys.all, 'list', institutionId],
  });
}

export function useAcademicCalendarEvents(
  institutionId: string,
  filters: AcademicCalendarEventFilters = {},
) {
  return useQuery<AcademicCalendarEvent[]>({
    queryKey: academicCalendarKeys.list(institutionId, filters),
    queryFn: () => academicCalendarService.listForStaff(institutionId, filters),
    enabled: Boolean(institutionId),
  });
}

export function useUpcomingAcademicCalendarEvents(
  institutionId: string | null,
  audience: AcademicCalendarAudience,
) {
  return useQuery<AcademicCalendarEvent[]>({
    queryKey: academicCalendarKeys.upcoming(institutionId ?? '', audience),
    queryFn: () => academicCalendarService.listUpcomingForAudience(institutionId as string),
    enabled: Boolean(institutionId),
    staleTime: 1000 * 60,
  });
}

export function useCreateAcademicCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AcademicCalendarEventInput) => academicCalendarService.create(input),
    onSuccess: async (_result, variables) => {
      await invalidateAcademicCalendar(queryClient, variables.institution_id);
      await queryClient.invalidateQueries({ queryKey: academicCalendarKeys.all });
    },
  });
}

export function useUpdateAcademicCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      institutionId,
      input,
    }: {
      id: string;
      institutionId: string;
      input: AcademicCalendarEventInput;
    }) => academicCalendarService.update(id, institutionId, input),
    onSuccess: async (_result, variables) => {
      await invalidateAcademicCalendar(queryClient, variables.institutionId);
      await queryClient.invalidateQueries({ queryKey: academicCalendarKeys.all });
    },
  });
}

export function useSetAcademicCalendarEventActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      institutionId,
      active,
    }: {
      id: string;
      institutionId: string;
      active: boolean;
    }) => academicCalendarService.setActive(id, institutionId, active),
    onSuccess: async (_result, variables) => {
      await invalidateAcademicCalendar(queryClient, variables.institutionId);
      await queryClient.invalidateQueries({ queryKey: academicCalendarKeys.all });
    },
  });
}
