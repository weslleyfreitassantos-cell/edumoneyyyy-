import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  teacherService,
  type TeacherRow,
} from '../services/teacherService';

import type {
  TeacherFormData,
} from '../schemas/adminSchemas';

export const teacherKeys = {
  all: ['teachers'] as const,

  list: (institutionId: string) =>
    [
      ...teacherKeys.all,
      institutionId,
    ] as const,
};

export function useTeachers(
  institutionId: string,
) {
  return useQuery<TeacherRow[]>({
    queryKey:
      teacherKeys.list(institutionId),

    queryFn: () =>
      teacherService.list(institutionId),

    enabled: Boolean(institutionId),
  });
}

export function useCreateTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      data: TeacherFormData,
    ) => teacherService.create(data),

    onSuccess: async (
      _result,
      variables,
    ) => {
      await queryClient.invalidateQueries({
        queryKey: teacherKeys.list(
          variables.institution_id,
        ),
      });
    },
  });
}

export function useSetTeacherActive() {
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
    }) =>
      teacherService.setActive(
        id,
        institutionId,
        active,
      ),

    onSuccess: async (
      _result,
      variables,
    ) => {
      await queryClient.invalidateQueries({
        queryKey: teacherKeys.list(
          variables.institutionId,
        ),
      });
    },
  });
}
