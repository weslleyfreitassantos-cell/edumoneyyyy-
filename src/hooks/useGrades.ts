import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  gradeService,
  type AssessmentRecord,
  type CreateAssessmentInput,
  type GradeEntry,
  type GradeOffering,
  type InstitutionGradeFilters,
  type InstitutionGradeSummary,
  type SaveGradesInput,
  type StudentGradeSummary,
  type UpdateAssessmentInput,
} from '../services/gradeService';

export const gradeKeys = {
  all: ['grades'] as const,
  teacherOfferings: (
    profileId: string | undefined,
    institutionId: string | undefined,
  ) =>
    [
      ...gradeKeys.all,
      'teacher-offerings',
      profileId,
      institutionId,
    ] as const,
  assessments: (
    institutionId: string | undefined,
    subjectOfferingId: string | undefined,
  ) =>
    [
      ...gradeKeys.all,
      'assessments',
      institutionId,
      subjectOfferingId,
    ] as const,
  gradeEntry: (
    institutionId: string | undefined,
    assessmentId: string | undefined,
  ) =>
    [
      ...gradeKeys.all,
      'grade-entry',
      institutionId,
      assessmentId,
    ] as const,
  studentSummary: (
    institutionId: string | undefined,
    studentId: string | undefined,
  ) =>
    [
      ...gradeKeys.all,
      'student-summary',
      institutionId,
      studentId,
    ] as const,
  institutionSummary: (
    institutionId: string | undefined,
    filters: InstitutionGradeFilters,
  ) =>
    [
      ...gradeKeys.all,
      'institution-summary',
      institutionId,
      filters,
    ] as const,
};

export function useTeacherGradeOfferings(
  profileId: string | undefined,
  institutionId: string | undefined,
) {
  return useQuery<GradeOffering[]>({
    queryKey: gradeKeys.teacherOfferings(
      profileId,
      institutionId,
    ),
    queryFn: () => {
      if (!profileId || !institutionId) {
        throw new Error(
          'Perfil e instituição são obrigatórios para carregar atribuições.',
        );
      }

      return gradeService.listTeacherOfferings(
        profileId,
        institutionId,
      );
    },
    enabled: Boolean(profileId && institutionId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useAssessments(
  institutionId: string | undefined,
  subjectOfferingId: string | undefined,
) {
  return useQuery<AssessmentRecord[]>({
    queryKey: gradeKeys.assessments(
      institutionId,
      subjectOfferingId,
    ),
    queryFn: () => {
      if (!institutionId || !subjectOfferingId) {
        throw new Error(
          'Instituição e atribuição são obrigatórias para carregar avaliações.',
        );
      }

      return gradeService.listAssessments(
        institutionId,
        {
          subjectOfferingId,
        },
      );
    },
    enabled: Boolean(institutionId && subjectOfferingId),
    staleTime: 1000 * 60,
  });
}

export function useGradeEntry(
  institutionId: string | undefined,
  assessmentId: string | undefined,
) {
  return useQuery<GradeEntry>({
    queryKey: gradeKeys.gradeEntry(
      institutionId,
      assessmentId,
    ),
    queryFn: () => {
      if (!institutionId || !assessmentId) {
        throw new Error(
          'Instituição e avaliação são obrigatórias para carregar notas.',
        );
      }

      return gradeService.loadGradeEntry(
        institutionId,
        assessmentId,
      );
    },
    enabled: Boolean(institutionId && assessmentId),
    staleTime: 1000 * 30,
  });
}

export function useCreateAssessment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAssessmentInput) =>
      gradeService.createAssessment(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: gradeKeys.all,
      });
    },
  });
}

export function useUpdateAssessment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateAssessmentInput) =>
      gradeService.updateAssessment(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: gradeKeys.all,
      });
    },
  });
}

export function useSaveGrades() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveGradesInput) =>
      gradeService.saveGrades(input),
    onSuccess: (gradeEntry, input) => {
      queryClient.setQueryData(
        gradeKeys.gradeEntry(
          input.institutionId,
          input.assessmentId,
        ),
        gradeEntry,
      );

      void queryClient.invalidateQueries({
        queryKey: gradeKeys.all,
      });
    },
  });
}

export function useStudentGradeSummary(
  institutionId: string | undefined,
  studentId: string | undefined,
) {
  return useQuery<StudentGradeSummary>({
    queryKey: gradeKeys.studentSummary(
      institutionId,
      studentId,
    ),
    queryFn: () => {
      if (!institutionId || !studentId) {
        throw new Error(
          'Instituição e aluno são obrigatórios para carregar notas.',
        );
      }

      return gradeService.getStudentGradeSummary(
        institutionId,
        studentId,
      );
    },
    enabled: Boolean(institutionId && studentId),
    staleTime: 1000 * 60,
  });
}

export function useInstitutionGradeSummary(
  institutionId: string | undefined,
  filters: InstitutionGradeFilters,
) {
  return useQuery<InstitutionGradeSummary>({
    queryKey: gradeKeys.institutionSummary(
      institutionId,
      filters,
    ),
    queryFn: () => {
      if (!institutionId) {
        throw new Error(
          'Instituição é obrigatória para carregar resultados.',
        );
      }

      return gradeService.getInstitutionGradeSummary(
        institutionId,
        filters,
      );
    },
    enabled: Boolean(institutionId),
    staleTime: 1000 * 60,
  });
}
