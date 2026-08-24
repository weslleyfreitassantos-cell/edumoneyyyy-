import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { academicAutomationService, type PeriodDraft } from '../services/academicAutomationService';
import { classAutomationService } from '../services/classAutomationService';
import { timetableAutomationService, type TimetableVersionEntryRow, type TimetableVersionRow } from '../services/timetableAutomationService';

export const academicAutomationKeys = {
  all: ['academic-automation'] as const,
  teacherSubjects: (institutionId: string, teacherProfileId: string) => [...academicAutomationKeys.all, 'teacher-subjects', institutionId, teacherProfileId] as const,
  teacherAvailability: (institutionId: string, teacherProfileId: string) => [...academicAutomationKeys.all, 'teacher-availability', institutionId, teacherProfileId] as const,
  timeSlots: (institutionId: string, shift?: string) => [...academicAutomationKeys.all, 'time-slots', institutionId, shift ?? 'all'] as const,
  timetableVersions: (institutionId: string, academicYearId?: string) => [...academicAutomationKeys.all, 'timetable-versions', institutionId, academicYearId ?? 'all'] as const,
  timetableVersionEntries: (institutionId: string, versionId: string) => [...academicAutomationKeys.all, 'timetable-version-entries', institutionId, versionId] as const,
};

export function useTeacherSubjects(institutionId: string, teacherProfileId: string) {
  return useQuery({
    queryKey: academicAutomationKeys.teacherSubjects(institutionId, teacherProfileId),
    queryFn: () => academicAutomationService.listTeacherSubjects(institutionId, teacherProfileId),
    enabled: Boolean(institutionId && teacherProfileId),
  });
}

export function useTeacherAvailability(institutionId: string, teacherProfileId: string) {
  return useQuery({
    queryKey: academicAutomationKeys.teacherAvailability(institutionId, teacherProfileId),
    queryFn: () => academicAutomationService.listTeacherAvailability(institutionId, teacherProfileId),
    enabled: Boolean(institutionId && teacherProfileId),
  });
}

export function useSaveTeacherAcademicSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { institution_id: string; teacher_profile_id: string; subject_ids: string[]; primary_subject_id?: string; availability: Array<{ day_of_week: number; start_time: string; end_time: string }> }) => {
      await academicAutomationService.replaceTeacherSubjects(input);
      await academicAutomationService.replaceTeacherAvailability(input);
    },
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: academicAutomationKeys.teacherSubjects(variables.institution_id, variables.teacher_profile_id) }),
        queryClient.invalidateQueries({ queryKey: academicAutomationKeys.teacherAvailability(variables.institution_id, variables.teacher_profile_id) }),
      ]);
    },
  });
}

export function useCreateAcademicYearWithTerms() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: academicAutomationService.createAcademicYearWithTerms,
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['academic-structure', 'years', variables.institution_id] });
    },
  });
}

export function useCopyPreviousYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: academicAutomationService.copyPreviousYear,
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['academic-structure', 'years', variables.institution_id] }),
        queryClient.invalidateQueries({ queryKey: ['classes', variables.institution_id] }),
        queryClient.invalidateQueries({ queryKey: ['curriculum', variables.institution_id] }),
        queryClient.invalidateQueries({ queryKey: ['assignments', variables.institution_id] }),
      ]);
    },
  });
}

export function useCreateWholeYearAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: academicAutomationService.createWholeYearAssignment,
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['assignments', variables.institution_id] });
    },
  });
}

export function useSchoolTimeSlots(institutionId: string, shift?: string) {
  return useQuery({
    queryKey: academicAutomationKeys.timeSlots(institutionId, shift),
    queryFn: () => academicAutomationService.listTimeSlots(institutionId, shift),
    enabled: Boolean(institutionId),
  });
}

export function useCurriculumTemplates(institutionId: string) {
  return useQuery({
    queryKey: [...academicAutomationKeys.all, 'curriculum-templates', institutionId] as const,
    queryFn: () => academicAutomationService.listCurriculumTemplates(institutionId),
    enabled: Boolean(institutionId),
  });
}

export function useCreateCurriculumTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: academicAutomationService.createCurriculumTemplate,
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: [...academicAutomationKeys.all, 'curriculum-templates', variables.institution_id] });
    },
  });
}

export function useApplyCurriculumTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: academicAutomationService.applyCurriculumTemplate,
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['curriculum', variables.institution_id] });
    },
  });
}

export function useCreateClassBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: classAutomationService.createBatch,
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['classes', variables.institutionId] }),
        queryClient.invalidateQueries({ queryKey: ['curriculum', variables.institutionId] }),
        queryClient.invalidateQueries({ queryKey: ['assignments', variables.institutionId] }),
        queryClient.invalidateQueries({ queryKey: ['admin-overview', variables.institutionId] }),
      ]);
    },
  });
}

export function useSaveSchoolTimeSlots() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: academicAutomationService.upsertTimeSlots,
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: academicAutomationKeys.timeSlots(variables.institution_id, variables.shift) }),
        queryClient.invalidateQueries({ queryKey: ['school-setup-readiness', variables.institution_id] }),
      ]);
    },
  });
}

export function useTimetableVersions(institutionId: string, academicYearId?: string) {
  return useQuery<TimetableVersionRow[]>({
    queryKey: academicAutomationKeys.timetableVersions(institutionId, academicYearId),
    queryFn: () => timetableAutomationService.listVersions(institutionId, academicYearId),
    enabled: Boolean(institutionId),
  });
}

export function useGenerateTimetableDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: timetableAutomationService.generateDraft,
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: academicAutomationKeys.timetableVersions(variables.institutionId, variables.academicYearId) }),
        queryClient.invalidateQueries({ queryKey: ['school-setup-readiness', variables.institutionId] }),
      ]);
    },
  });
}

export function usePublishTimetableVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ versionId, institutionId, academicYearId }: { versionId: string; institutionId: string; academicYearId: string }) => timetableAutomationService.publishVersion(versionId),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: academicAutomationKeys.timetableVersions(variables.institutionId, variables.academicYearId) }),
        queryClient.invalidateQueries({ queryKey: ['timetable', 'entries', variables.institutionId] }),
        queryClient.invalidateQueries({ queryKey: ['school-setup-readiness', variables.institutionId] }),
      ]);
    },
  });
}

export function useTimetableVersionEntries(
  institutionId: string,
  versionId: string,
) {
  return useQuery<TimetableVersionEntryRow[]>({
    queryKey: academicAutomationKeys.timetableVersionEntries(institutionId, versionId),
    queryFn: () => timetableAutomationService.listVersionEntries(versionId, institutionId),
    enabled: Boolean(institutionId && versionId),
  });
}

export function useUpdateTimetableVersionEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: timetableAutomationService.updateVersionEntry,
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({
        queryKey: academicAutomationKeys.timetableVersionEntries(
          variables.institutionId,
          variables.versionId,
        ),
      });
    },
  });
}

export type { PeriodDraft };
