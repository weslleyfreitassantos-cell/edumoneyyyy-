import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { adminOverviewKeys } from './useAdminOverview';
import { classKeys } from './useClasses';
import { enrollmentKeys } from './useEnrollments';
import { schoolUserKeys } from './useSchoolUsers';
import { studentKeys } from './useStudents';
import { invalidateSchoolSetupReadiness } from './useSchoolSetupReadiness';

import {
  createFullStudentEnrollment,
  getFullStudentEditorData,
  updateFullStudentEnrollment,
  type FullStudentEnrollmentDraft,
} from '../services/fullStudentEnrollmentService';

export const fullStudentEditorKeys = {
  all: ['full-student-editor'] as const,
  detail: (institutionId: string, studentId: string) =>
    [...fullStudentEditorKeys.all, institutionId, studentId] as const,
};

export function useStudentEditorData(
  institutionId: string,
  studentId: string | null,
) {
  return useQuery({
    queryKey: fullStudentEditorKeys.detail(
      institutionId,
      studentId ?? 'none',
    ),
    queryFn: () =>
      getFullStudentEditorData(
        institutionId,
        studentId as string,
      ),
    enabled: Boolean(institutionId && studentId),
  });
}

export function useCreateFullStudentEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      institutionId,
      draft,
      existingStudentId,
    }: {
      institutionId: string;
      draft: FullStudentEnrollmentDraft;
      existingStudentId?: string;
    }) =>
      createFullStudentEnrollment(
        institutionId,
        draft,
        existingStudentId,
      ),

    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: studentKeys.list(variables.institutionId),
        }),
        queryClient.invalidateQueries({
          queryKey: enrollmentKeys.list(variables.institutionId),
        }),
        invalidateSchoolSetupReadiness(queryClient, variables.institutionId),
        queryClient.invalidateQueries({
          queryKey: schoolUserKeys.list(variables.institutionId),
        }),
        queryClient.invalidateQueries({
          queryKey: classKeys.list(variables.institutionId),
        }),
        queryClient.invalidateQueries({
          queryKey: adminOverviewKeys.detail(variables.institutionId),
        }),
      ]);
    },
  });
}

export function useUpdateFullStudentEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      institutionId,
      studentId,
      enrollmentId,
      draft,
    }: {
      institutionId: string;
      studentId: string;
      enrollmentId: string | null;
      draft: FullStudentEnrollmentDraft;
    }) =>
      updateFullStudentEnrollment(
        institutionId,
        studentId,
        enrollmentId,
        draft,
      ),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: studentKeys.list(variables.institutionId),
        }),
        queryClient.invalidateQueries({
          queryKey: enrollmentKeys.list(variables.institutionId),
        }),
        queryClient.invalidateQueries({
          queryKey: schoolUserKeys.list(variables.institutionId),
        }),
        queryClient.invalidateQueries({
          queryKey: classKeys.list(variables.institutionId),
        }),
        queryClient.invalidateQueries({
          queryKey: adminOverviewKeys.detail(variables.institutionId),
        }),
        queryClient.invalidateQueries({
          queryKey: fullStudentEditorKeys.detail(
            variables.institutionId,
            variables.studentId,
          ),
        }),
      ]);
    },
  });
}
