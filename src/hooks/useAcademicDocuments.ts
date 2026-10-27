import { useQuery } from '@tanstack/react-query';

import {
  academicDocumentService,
  type AcademicDocumentStudent,
  type AcademicDocumentStudentOption,
} from '../services/academicDocumentService';
import { academicDocumentIssuanceService } from '../services/academicDocumentIssuanceService';
import { reportCardService, type StudentReportCard } from '../services/reportCardService';

export const academicDocumentKeys = {
  all: ['academic-documents'] as const,
  students: (institutionId: string) =>
    [...academicDocumentKeys.all, 'students', institutionId] as const,
  student: (institutionId: string, studentId: string) =>
    [...academicDocumentKeys.all, 'student', institutionId, studentId] as const,
  expectedSubjectTerms: (institutionId: string, studentId: string, enrollmentId: string) =>
    [...academicDocumentKeys.all, 'expected-subject-terms', institutionId, studentId, enrollmentId] as const,
  reportCard: (institutionId: string, studentId: string) =>
    [...academicDocumentKeys.all, 'report-card', institutionId, studentId] as const,
  issuances: (institutionId: string, studentId: string) =>
    [...academicDocumentKeys.all, 'issuances', institutionId, studentId] as const,
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

export function useAcademicDocumentExpectedSubjectTerms(
  institutionId: string,
  studentId: string | null,
  enrollment: AcademicDocumentStudent['currentEnrollment'],
) {
  return useQuery({
    queryKey: academicDocumentKeys.expectedSubjectTerms(
      institutionId,
      studentId ?? '',
      enrollment?.id ?? '',
    ),
    queryFn: () => {
      if (!studentId || !enrollment) throw new Error('Matrícula ativa indisponível.');
      return academicDocumentService.getExpectedSubjectTerms(institutionId, studentId, enrollment);
    },
    enabled: Boolean(institutionId && studentId && enrollment),
    staleTime: 30_000,
  });
}

export function useAcademicDocumentReportCard(
  institutionId: string,
  studentId: string | null,
) {
  return useQuery<StudentReportCard>({
    queryKey: academicDocumentKeys.reportCard(institutionId, studentId ?? ''),
    queryFn: () => {
      if (!studentId) throw new Error('Aluno obrigatório.');
      return reportCardService.getStudentReportCard(institutionId, studentId);
    },
    enabled: Boolean(institutionId && studentId),
    staleTime: 30_000,
  });
}

export function useAcademicDocumentIssuances(
  institutionId: string,
  studentId: string | null,
) {
  return useQuery({
    queryKey: academicDocumentKeys.issuances(institutionId, studentId ?? ''),
    queryFn: () => {
      if (!studentId) throw new Error('Aluno obrigatório.');
      return academicDocumentIssuanceService.listRecent(institutionId, studentId);
    },
    enabled: Boolean(institutionId && studentId),
  });
}
