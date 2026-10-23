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
  discardStudentEnrollmentDraft,
  getFullStudentEditorData,
  listStudentEnrollmentDrafts,
  saveStudentEnrollmentDraft,
  updateFullStudentEnrollment,
  type FullStudentEnrollmentDraft,
} from '../services/fullStudentEnrollmentService';

export const fullStudentEditorKeys = {
  all: ['full-student-editor'] as const,
  detail: (institutionId: string, studentId: string) =>
    [...fullStudentEditorKeys.all, institutionId, studentId] as const,
};

export const studentEnrollmentDraftKeys = {
  all: ['student-enrollment-drafts'] as const,
  list: (institutionId: string) =>
    [...studentEnrollmentDraftKeys.all, institutionId] as const,
};

export function useStudentEnrollmentDrafts(institutionId: string) {
  return useQuery({
    queryKey: studentEnrollmentDraftKeys.list(institutionId),
    queryFn: () => listStudentEnrollmentDrafts(institutionId),
    enabled: Boolean(institutionId),
    staleTime: 10_000,
  });
}

export function useSaveStudentEnrollmentDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: {
      institutionId: string;
      draftId: string | null;
      expectedVersion: number | null;
      draft: FullStudentEnrollmentDraft;
      currentStep: number;
    }) => saveStudentEnrollmentDraft(
      variables.institutionId,
      variables.draftId,
      variables.expectedVersion,
      variables.draft,
      variables.currentStep,
    ),
    onSuccess: (_result, variables) => queryClient.invalidateQueries({
      queryKey: studentEnrollmentDraftKeys.list(variables.institutionId),
    }),
  });
}

export function useDiscardStudentEnrollmentDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: {
      institutionId: string;
      draftId: string;
      expectedVersion: number;
    }) => discardStudentEnrollmentDraft(
      variables.institutionId,
      variables.draftId,
      variables.expectedVersion,
    ),
    onSuccess: (_result, variables) => queryClient.invalidateQueries({
      queryKey: studentEnrollmentDraftKeys.list(variables.institutionId),
    }),
  });
}

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
      draftId,
      draftVersion,
      duplicateApprovalCandidateIds,
    }: {
      institutionId: string;
      draft: FullStudentEnrollmentDraft;
      existingStudentId?: string;
      draftId?: string;
      draftVersion?: number;
      duplicateApprovalCandidateIds?: string[];
    }) =>
      createFullStudentEnrollment(
        institutionId,
        draft,
        existingStudentId,
        draftId && draftVersion
          ? { draftId, draftVersion, duplicateApprovalCandidateIds }
          : {},
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
        queryClient.invalidateQueries({
          queryKey: studentEnrollmentDraftKeys.list(variables.institutionId),
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
