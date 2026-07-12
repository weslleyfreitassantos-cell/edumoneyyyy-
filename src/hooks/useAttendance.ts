import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  attendanceService,
  type AttendanceInstitutionFilters,
  type AttendanceRollCall,
  type AttendanceOffering,
  type InstitutionAttendanceSummary,
  type SaveAttendanceRollCallInput,
  type StudentAttendanceSummary,
} from '../services/attendanceService';

export const attendanceKeys = {
  all: ['attendance'] as const,
  teacherOfferings: (
    profileId: string | undefined,
    institutionId: string | undefined,
  ) =>
    [
      ...attendanceKeys.all,
      'teacher-offerings',
      profileId,
      institutionId,
    ] as const,
  rollCall: (
    institutionId: string | undefined,
    subjectOfferingId: string | undefined,
    sessionDate: string | undefined,
  ) =>
    [
      ...attendanceKeys.all,
      'roll-call',
      institutionId,
      subjectOfferingId,
      sessionDate,
    ] as const,
  studentSummary: (
    institutionId: string | undefined,
    studentId: string | undefined,
  ) =>
    [
      ...attendanceKeys.all,
      'student-summary',
      institutionId,
      studentId,
    ] as const,
  institutionSummary: (
    institutionId: string | undefined,
    filters: AttendanceInstitutionFilters,
  ) =>
    [
      ...attendanceKeys.all,
      'institution-summary',
      institutionId,
      filters,
    ] as const,
};

export function useTeacherAttendanceOfferings(
  profileId: string | undefined,
  institutionId: string | undefined,
) {
  return useQuery<AttendanceOffering[]>({
    queryKey: attendanceKeys.teacherOfferings(
      profileId,
      institutionId,
    ),
    queryFn: () => {
      if (!profileId || !institutionId) {
        throw new Error(
          'Perfil e instituição são obrigatórios para carregar atribuições.',
        );
      }

      return attendanceService.listTeacherOfferings(
        profileId,
        institutionId,
      );
    },
    enabled: Boolean(profileId && institutionId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useAttendanceRollCall(
  institutionId: string | undefined,
  subjectOfferingId: string | undefined,
  sessionDate: string | undefined,
) {
  return useQuery<AttendanceRollCall>({
    queryKey: attendanceKeys.rollCall(
      institutionId,
      subjectOfferingId,
      sessionDate,
    ),
    queryFn: () => {
      if (
        !institutionId ||
        !subjectOfferingId ||
        !sessionDate
      ) {
        throw new Error(
          'Instituição, atribuição e data são obrigatórias para carregar a chamada.',
        );
      }

      return attendanceService.loadRollCall(
        institutionId,
        subjectOfferingId,
        sessionDate,
      );
    },
    enabled: Boolean(
      institutionId &&
        subjectOfferingId &&
        sessionDate,
    ),
    staleTime: 1000 * 30,
  });
}

export function useSaveAttendanceRollCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      input: SaveAttendanceRollCallInput,
    ) => attendanceService.saveRollCall(input),
    onSuccess: (rollCall, input) => {
      queryClient.setQueryData(
        attendanceKeys.rollCall(
          input.institutionId,
          input.subjectOfferingId,
          input.sessionDate,
        ),
        rollCall,
      );

      void queryClient.invalidateQueries({
        queryKey: attendanceKeys.all,
      });
    },
  });
}

export function useStudentAttendanceSummary(
  institutionId: string | undefined,
  studentId: string | undefined,
) {
  return useQuery<StudentAttendanceSummary>({
    queryKey: attendanceKeys.studentSummary(
      institutionId,
      studentId,
    ),
    queryFn: () => {
      if (!institutionId || !studentId) {
        throw new Error(
          'Instituição e aluno são obrigatórios para carregar frequência.',
        );
      }

      return attendanceService
        .getStudentAttendanceSummary(
          institutionId,
          studentId,
        );
    },
    enabled: Boolean(institutionId && studentId),
    staleTime: 1000 * 60,
  });
}

export function useInstitutionAttendanceSummary(
  institutionId: string | undefined,
  filters: AttendanceInstitutionFilters,
) {
  return useQuery<InstitutionAttendanceSummary>({
    queryKey: attendanceKeys.institutionSummary(
      institutionId,
      filters,
    ),
    queryFn: () => {
      if (!institutionId) {
        throw new Error(
          'Instituição é obrigatória para carregar frequência institucional.',
        );
      }

      return attendanceService
        .getInstitutionAttendanceSummary(
          institutionId,
          filters,
        );
    },
    enabled: Boolean(institutionId),
    staleTime: 1000 * 60,
  });
}
