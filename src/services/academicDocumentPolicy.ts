import type {
  AcademicDocumentEnrollment,
  AcademicDocumentExpectedSubjectTerm,
} from './academicDocumentService';
import type { ReportCardSubjectResult } from './reportCardService';

export interface AttendanceDeclarationRow {
  subjectName: string;
  termName: string;
  attendancePercentage: number;
}

function resultKey(subjectOfferingId: string, termId: string): string {
  return `${subjectOfferingId}:${termId}`;
}

export function buildCompleteAttendanceDeclaration(
  expected: readonly AcademicDocumentExpectedSubjectTerm[],
  results: readonly ReportCardSubjectResult[],
  academicYearId: string,
): { complete: boolean; rows: AttendanceDeclarationRow[]; missingCount: number } {
  if (expected.length === 0) return { complete: false, rows: [], missingCount: 0 };

  const resultsByKey = new Map(
    results
      .filter((result) => result.academicYearId === academicYearId)
      .map((result) => [resultKey(result.subjectOfferingId, result.termId), result]),
  );
  const rows: AttendanceDeclarationRow[] = [];
  let missingCount = 0;

  for (const subjectTerm of expected) {
    const result = resultsByKey.get(resultKey(subjectTerm.subjectOfferingId, subjectTerm.termId));
    if (!result?.isClosed || result.attendancePercentage === null) {
      missingCount += 1;
      continue;
    }
    rows.push({
      subjectName: subjectTerm.subjectName,
      termName: subjectTerm.termName,
      attendancePercentage: result.attendancePercentage,
    });
  }

  return {
    complete: missingCount === 0 && rows.length === expected.length,
    rows,
    missingCount,
  };
}

function academicYearNumber(name: string): number | null {
  const match = name.match(/(?:19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

export function findPreviousAcademicEnrollment(
  current: AcademicDocumentEnrollment | null,
  enrollments: readonly AcademicDocumentEnrollment[],
): AcademicDocumentEnrollment | null {
  if (!current) return null;
  const currentYear = academicYearNumber(current.academicYearName);
  const currentStartDate = current.academicYearStartDate ?? null;
  if (currentStartDate === null && currentYear === null) return null;

  return enrollments
    .filter((enrollment) => enrollment.id !== current.id && enrollment.academicYearId !== current.academicYearId)
    .map((enrollment) => ({
      enrollment,
      year: academicYearNumber(enrollment.academicYearName),
      endDate: enrollment.academicYearEndDate ?? null,
    }))
    .filter((entry) => {
      if (currentStartDate && entry.endDate) return entry.endDate < currentStartDate;
      return entry.year !== null && currentYear !== null && entry.year < currentYear;
    })
    .sort((left, right) => {
      if (left.endDate && right.endDate) return right.endDate.localeCompare(left.endDate);
      return (right.year ?? 0) - (left.year ?? 0);
    })[0]?.enrollment ?? null;
}
