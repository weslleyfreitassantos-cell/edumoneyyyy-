import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminOverviewKeys } from './useAdminOverview';
import { assignmentKeys } from './useAssignments';
import {
  timetableService,
  type RoomRow,
  type TimetableEntryRow,
} from '../services/timetableService';
import type {
  RoomFormData,
  RoomUpdateData,
  TimetableEntryFormData,
  TimetableEntryUpdateData,
} from '../schemas/adminSchemas';

export const timetableKeys = {
  all: ['timetable'] as const,
  rooms: (institutionId: string) => [...timetableKeys.all, 'rooms', institutionId] as const,
  entries: (institutionId: string) => [...timetableKeys.all, 'entries', institutionId] as const,
  classEntries: (institutionId: string, classId: string, termId?: string) => [...timetableKeys.entries(institutionId), 'class', classId, termId ?? 'current'] as const,
  teacherEntries: (institutionId: string, teacherProfileId: string, termId?: string) => [...timetableKeys.entries(institutionId), 'teacher', teacherProfileId, termId ?? 'current'] as const,
};

function invalidateTimetable(
  queryClient: ReturnType<typeof useQueryClient>,
  institutionId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: timetableKeys.rooms(institutionId) }),
    queryClient.invalidateQueries({ queryKey: timetableKeys.entries(institutionId) }),
    queryClient.invalidateQueries({ queryKey: assignmentKeys.list(institutionId) }),
    queryClient.invalidateQueries({ queryKey: adminOverviewKeys.detail(institutionId) }),
  ]);
}

// ==================== ROOMS ====================

export function useRooms(institutionId: string) {
  return useQuery<RoomRow[]>({
    queryKey: timetableKeys.rooms(institutionId),
    queryFn: () => timetableService.listRooms(institutionId),
    enabled: Boolean(institutionId),
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RoomFormData) => timetableService.createRoom(data),
    onSuccess: async (_result, variables) => {
      await invalidateTimetable(queryClient, variables.institution_id);
    },
  });
}

export function useUpdateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      institutionId,
      data,
    }: {
      id: string;
      institutionId: string;
      data: RoomUpdateData;
    }) => timetableService.updateRoom(id, institutionId, data),
    onSuccess: async (_result, variables) => {
      await invalidateTimetable(queryClient, variables.institutionId);
    },
  });
}

export function useSetRoomActive() {
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
    }) => timetableService.setRoomActive(id, institutionId, active),
    onSuccess: async (_result, variables) => {
      await invalidateTimetable(queryClient, variables.institutionId);
    },
  });
}

// ==================== ENTRIES ====================

export function useTimetableEntries(institutionId: string) {
  return useQuery<TimetableEntryRow[]>({
    queryKey: timetableKeys.entries(institutionId),
    queryFn: () => timetableService.listEntries(institutionId),
    enabled: Boolean(institutionId),
  });
}

export function useStudentTimetable(
  institutionId: string | undefined,
  classId: string | undefined,
  termId?: string,
) {
  return useQuery<TimetableEntryRow[]>({
    queryKey: timetableKeys.classEntries(
      institutionId ?? '',
      classId ?? '',
      termId,
    ),
    queryFn: () => {
      if (!institutionId || !classId) {
        throw new Error('A turma do aluno não foi informada.');
      }

      return timetableService.listByClass(
        institutionId,
        classId,
        termId,
      );
    },
    enabled: Boolean(institutionId && classId),
  });
}

export function useTeacherTimetable(
  institutionId: string | undefined,
  teacherProfileId: string | undefined,
  termId?: string,
) {
  return useQuery<TimetableEntryRow[]>({
    queryKey: timetableKeys.teacherEntries(
      institutionId ?? '',
      teacherProfileId ?? '',
      termId,
    ),
    queryFn: () => {
      if (!institutionId || !teacherProfileId) {
        throw new Error('O professor não foi informado.');
      }

      return timetableService.listByTeacher(
        institutionId,
        teacherProfileId,
        termId,
      );
    },
    enabled: Boolean(institutionId && teacherProfileId),
  });
}

export function useCreateTimetableEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TimetableEntryFormData) => timetableService.createEntry(data),
    onSuccess: async (_result, variables) => {
      await invalidateTimetable(queryClient, variables.institution_id);
    },
  });
}

export function useUpdateTimetableEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      institutionId,
      data,
    }: {
      id: string;
      institutionId: string;
      data: TimetableEntryUpdateData;
    }) => timetableService.updateEntry(id, institutionId, data),
    onSuccess: async (_result, variables) => {
      await invalidateTimetable(queryClient, variables.institutionId);
    },
  });
}

export function useSetTimetableEntryActive() {
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
    }) => timetableService.setEntryActive(id, institutionId, active),
    onSuccess: async (_result, variables) => {
      await invalidateTimetable(queryClient, variables.institutionId);
    },
  });
}
