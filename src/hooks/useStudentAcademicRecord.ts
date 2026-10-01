import { useQuery } from '@tanstack/react-query';

import {
  studentAcademicRecordService,
  type StudentAcademicRecord,
  type StudentAcademicRecordFilters,
} from '../services/studentAcademicRecordService';

export const studentAcademicRecordKeys = {
  all: ['student-academic-record'] as const,
  detail: (
    institutionId: string | undefined,
    studentId: string | null,
    filters: StudentAcademicRecordFilters,
  ) => [
    ...studentAcademicRecordKeys.all,
    institutionId,
    studentId,
    filters,
  ] as const,
};

export function useStudentAcademicRecord(
  institutionId: string | undefined,
  studentId: string | null,
  filters: StudentAcademicRecordFilters = {},
) {
  return useQuery<StudentAcademicRecord>({
    queryKey: studentAcademicRecordKeys.detail(
      institutionId,
      studentId,
      filters,
    ),
    queryFn: () => {
      if (!institutionId || !studentId) {
        throw new Error('Instituição e aluno são obrigatórios para o prontuário acadêmico.');
      }

      return studentAcademicRecordService.getStudentAcademicRecord(
        institutionId,
        studentId,
        filters,
      );
    },
    enabled: Boolean(institutionId && studentId),
    staleTime: 1000 * 60,
  });
}
