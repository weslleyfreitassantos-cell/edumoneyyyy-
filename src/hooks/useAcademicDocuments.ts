import { useQuery } from '@tanstack/react-query';

import {
  academicDocumentService,
  type AcademicDocumentStudent,
  type AcademicDocumentStudentOption,
} from '../services/academicDocumentService';

export const academicDocumentKeys = {
  all: ['academic-documents'] as const,
  students: (institutionId: string) =>
    [...academicDocumentKeys.all, 'students', institutionId] as const,
  student: (institutionId: string, studentId: string) =>
    [...academicDocumentKeys.all, 'student', institutionId, studentId] as const,
};

export function useAcademicDocumentStudents(
  institutionId: string,
) {
  return useQuery<AcademicDocumentStudentOption[]>({
    queryKey: academicDocumentKeys.students(institutionId),
    queryFn: () => academicDocumentService.listStudents(institutionId),
    enabled: Boolean(institutionId),
  });
}

export function useAcademicDocumentStudent(
  institutionId: string,
  studentId: string | null,
) {
  return useQuery<AcademicDocumentStudent>({
    queryKey: academicDocumentKeys.student(institutionId, studentId ?? ''),
    queryFn: () => academicDocumentService.getStudent(institutionId, studentId as string),
    enabled: Boolean(institutionId && studentId),
  });
}
