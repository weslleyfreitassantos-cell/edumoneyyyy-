import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  studentService,
  type StudentRow,
  type AvailableStudentProfile,
} from '../services/studentService';

import type {
  StudentFormData,
  StudentUpdateData,
} from '../schemas/adminSchemas';

const studentKeys = {
  all: ['students'] as const,

  list: (institutionId: string) =>
    [
      ...studentKeys.all,
      institutionId,
    ] as const,

  availableProfiles: (
    institutionId: string,
  ) =>
    [
      ...studentKeys.all,
      institutionId,
      'available-profiles',
    ] as const,
};

export function useStudents(
  institutionId: string,
) {
  return useQuery<StudentRow[]>({
    queryKey:
      studentKeys.list(institutionId),

    queryFn: () =>
      studentService.list(institutionId),

    enabled: Boolean(institutionId),
  });
}

export function useAvailableStudentProfiles(
  institutionId: string,
  enabled: boolean,
) {
  return useQuery<
    AvailableStudentProfile[]
  >({
    queryKey:
      studentKeys.availableProfiles(
        institutionId,
      ),

    queryFn: () =>
      studentService.listAvailableProfiles(
        institutionId,
      ),

    enabled:
      Boolean(institutionId) && enabled,
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      data: StudentFormData,
    ) => studentService.create(data),

    onSuccess: async (
      _result,
      variables,
    ) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: studentKeys.list(
            variables.institution_id,
          ),
        }),

        queryClient.invalidateQueries({
          queryKey:
            studentKeys.availableProfiles(
              variables.institution_id,
            ),
        }),
      ]);
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      institutionId,
      data,
    }: {
      id: string;
      institutionId: string;
      data: StudentUpdateData;
    }) =>
      studentService.update(
        id,
        institutionId,
        data,
      ),

    onSuccess: async (
      _result,
      variables,
    ) => {
      await queryClient.invalidateQueries({
        queryKey: studentKeys.list(
          variables.institutionId,
        ),
      });
    },
  });
}

export function useSetStudentActive() {
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
      studentService.setActive(
        id,
        institutionId,
        active,
      ),

    onSuccess: async (
      _result,
      variables,
    ) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: studentKeys.list(
            variables.institutionId,
          ),
        }),

        queryClient.invalidateQueries({
          queryKey:
            studentKeys.availableProfiles(
              variables.institutionId,
            ),
        }),
      ]);
    },
  });
}