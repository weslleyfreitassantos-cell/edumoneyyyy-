import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  academicPolicyService,
  type AcademicPolicy,
  type AcademicYearOption,
  type SaveAcademicPolicyInput,
} from '../services/academicPolicyService';
import {
  academicShiftSettingsService,
} from '../services/academicShiftSettingsService';
import {
  academicAutomationService,
  type SchoolScheduleBreakDraft,
  type SchoolScheduleBreakRow,
} from '../services/academicAutomationService';
import type { AcademicShift } from '../lib/academic/academicShifts';
import {
  reportCardService,
  type StudentReportCard,
} from '../services/reportCardService';
import {
  termClosingService,
  type ListTermClosureOfferingsFilters,
  type ReopenTermClosureInput,
  type SubmitTermClosureInput,
  type TermClosureOffering,
  type TermClosurePreview,
} from '../services/termClosingService';

export const academicKeys = {
  all: ['academic-closing'] as const,
  years: (institutionId: string | undefined) =>
    [
      ...academicKeys.all,
      'years',
      institutionId,
    ] as const,
  policy: (
    institutionId: string | undefined,
    academicYearId: string | undefined,
  ) =>
    [
      ...academicKeys.all,
      'policy',
      institutionId,
      academicYearId,
    ] as const,
  shiftSettings: (institutionId: string | undefined) =>
    [...academicKeys.all, 'shift-settings', institutionId] as const,
  scheduleBreaks: (institutionId: string | undefined) =>
    [...academicKeys.all, 'schedule-breaks', institutionId] as const,
  teacherOfferings: (
    profileId: string | undefined,
    institutionId: string | undefined,
  ) =>
    [
      ...academicKeys.all,
      'teacher-offerings',
      profileId,
      institutionId,
    ] as const,
  institutionOfferings: (
    institutionId: string | undefined,
    filters: ListTermClosureOfferingsFilters,
  ) =>
    [
      ...academicKeys.all,
      'institution-offerings',
      institutionId,
      filters,
    ] as const,
  preview: (
    institutionId: string | undefined,
    subjectOfferingId: string | undefined,
  ) =>
    [
      ...academicKeys.all,
      'preview',
      institutionId,
      subjectOfferingId,
    ] as const,
  reportCard: (
    institutionId: string | undefined,
    studentId: string | undefined,
  ) =>
    [
      ...academicKeys.all,
      'report-card',
      institutionId,
      studentId,
    ] as const,
  guardianReportCards: (
    institutionId: string | undefined,
    studentIds: string[],
  ) =>
    [
      ...academicKeys.all,
      'guardian-report-cards',
      institutionId,
      ...studentIds,
    ] as const,
};

export function useAcademicYears(
  institutionId: string | undefined,
) {
  return useQuery<AcademicYearOption[]>({
    queryKey: academicKeys.years(institutionId),
    queryFn: () => {
      if (!institutionId) {
        throw new Error(
          'Instituicao obrigatoria para carregar anos letivos.',
        );
      }

      return academicPolicyService.listAcademicYears(
        institutionId,
      );
    },
    enabled: Boolean(institutionId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useAcademicPolicy(
  institutionId: string | undefined,
  academicYearId: string | undefined,
) {
  return useQuery<AcademicPolicy | null>({
    queryKey: academicKeys.policy(
      institutionId,
      academicYearId,
    ),
    queryFn: () => {
      if (!institutionId || !academicYearId) {
        throw new Error(
          'Instituicao e ano letivo sao obrigatorios para politica academica.',
        );
      }

      return academicPolicyService.getActivePolicy(
        institutionId,
        academicYearId,
      );
    },
    enabled: Boolean(institutionId && academicYearId),
    staleTime: 1000 * 60,
  });
}

export function useSaveAcademicPolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveAcademicPolicyInput) =>
      academicPolicyService.savePolicy(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: academicKeys.all,
      });
    },
  });
}

export function useAcademicShiftSettings(
  institutionId: string | undefined,
) {
  return useQuery<AcademicShift[]>({
    queryKey: academicKeys.shiftSettings(institutionId),
    queryFn: () => {
      if (!institutionId) {
        throw new Error(
          'Instituicao obrigatoria para carregar os turnos.',
        );
      }

      return academicShiftSettingsService.getEnabledShifts(
        institutionId,
      );
    },
    enabled: Boolean(institutionId),
    staleTime: 1000 * 60,
  });
}

export function useSaveAcademicShiftSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      institutionId: string;
      enabledShifts: readonly AcademicShift[];
    }) =>
      academicShiftSettingsService.saveEnabledShifts(
        input.institutionId,
        input.enabledShifts,
      ),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({
        queryKey: academicKeys.shiftSettings(
          variables.institutionId,
        ),
      });
      void queryClient.invalidateQueries({
        queryKey: ['classes', variables.institutionId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['school-setup-readiness', variables.institutionId],
      });
    },
  });
}

export function useSchoolScheduleBreaks(
  institutionId: string | undefined,
) {
  return useQuery<SchoolScheduleBreakRow[]>({
    queryKey: academicKeys.scheduleBreaks(institutionId),
    queryFn: () => {
      if (!institutionId) {
        throw new Error(
          'Instituicao obrigatoria para carregar os intervalos.',
        );
      }

      return academicAutomationService.listScheduleBreaks(institutionId);
    },
    enabled: Boolean(institutionId),
    staleTime: 1000 * 60,
  });
}

export function useSaveSchoolScheduleBreaks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      institution_id: string;
      shift: string;
      breaks: SchoolScheduleBreakDraft[];
    }) => academicAutomationService.replaceScheduleBreaks(input),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: academicKeys.scheduleBreaks(variables.institution_id),
        }),
        queryClient.invalidateQueries({
          queryKey: ['academic-automation', 'time-slots', variables.institution_id],
        }),
      ]);
    },
  });
}

export function useTeacherTermClosureOfferings(
  profileId: string | undefined,
  institutionId: string | undefined,
) {
  return useQuery<TermClosureOffering[]>({
    queryKey: academicKeys.teacherOfferings(
      profileId,
      institutionId,
    ),
    queryFn: () => {
      if (!profileId || !institutionId) {
        throw new Error(
          'Perfil e instituicao sao obrigatorios para carregar fechamentos.',
        );
      }

      return termClosingService.listTeacherOfferings(
        profileId,
        institutionId,
      );
    },
    enabled: Boolean(profileId && institutionId),
    staleTime: 1000 * 60,
  });
}

export function useInstitutionTermClosureOfferings(
  institutionId: string | undefined,
  filters: ListTermClosureOfferingsFilters,
) {
  return useQuery<TermClosureOffering[]>({
    queryKey: academicKeys.institutionOfferings(
      institutionId,
      filters,
    ),
    queryFn: () => {
      if (!institutionId) {
        throw new Error(
          'Instituicao obrigatoria para carregar fechamentos.',
        );
      }

      return termClosingService.listInstitutionOfferings(
        institutionId,
        filters,
      );
    },
    enabled: Boolean(institutionId),
    staleTime: 1000 * 60,
  });
}

export function useTermClosurePreview(
  institutionId: string | undefined,
  subjectOfferingId: string | undefined,
) {
  return useQuery<TermClosurePreview>({
    queryKey: academicKeys.preview(
      institutionId,
      subjectOfferingId,
    ),
    queryFn: () => {
      if (!institutionId || !subjectOfferingId) {
        throw new Error(
          'Instituicao e oferta sao obrigatorias para carregar a previa.',
        );
      }

      return termClosingService.getPreview(
        institutionId,
        subjectOfferingId,
      );
    },
    enabled: Boolean(institutionId && subjectOfferingId),
    staleTime: 1000 * 30,
  });
}

export function useSubmitTermClosure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitTermClosureInput) =>
      termClosingService.submitForReview(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: academicKeys.all,
      });
    },
  });
}

export function useCloseTermClosure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitTermClosureInput) =>
      termClosingService.closeOffering(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: academicKeys.all,
      });
    },
  });
}

export function useReopenTermClosure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReopenTermClosureInput) =>
      termClosingService.reopenClosure(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: academicKeys.all,
      });
    },
  });
}

export function useStudentReportCard(
  institutionId: string | undefined,
  studentId: string | undefined,
) {
  return useQuery<StudentReportCard>({
    queryKey: academicKeys.reportCard(
      institutionId,
      studentId,
    ),
    queryFn: () => {
      if (!institutionId || !studentId) {
        throw new Error(
          'Instituicao e aluno sao obrigatorios para carregar boletim.',
        );
      }

      return reportCardService.getStudentReportCard(
        institutionId,
        studentId,
      );
    },
    enabled: Boolean(institutionId && studentId),
    staleTime: 1000 * 60,
  });
}

export function useGuardianReportCards(
  institutionId: string | undefined,
  studentIds: string[],
) {
  return useQuery<StudentReportCard[]>({
    queryKey: academicKeys.guardianReportCards(
      institutionId,
      studentIds,
    ),
    queryFn: () => {
      if (!institutionId) {
        throw new Error(
          'Instituicao obrigatoria para carregar boletins.',
        );
      }
      
      if (studentIds.length === 0) {
        return [];
      }

      return reportCardService.getGuardianReportCards(
        institutionId,
        studentIds,
      );
    },
    enabled: Boolean(institutionId && studentIds.length > 0),
    staleTime: 1000 * 60,
  });
}
