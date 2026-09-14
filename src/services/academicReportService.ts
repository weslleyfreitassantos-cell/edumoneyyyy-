import type { AcademicYearOption } from './academicPolicyService';
import { academicPolicyService } from './academicPolicyService';
import {
  attendanceService,
  calculateAttendanceSummary,
  type AttendanceSummary,
} from './attendanceService';
import { enrollmentService, type EnrollmentRow } from './enrollmentService';
import {
  pedagogicalMonitoringService,
  type PedagogicalMonitoringSubject,
} from './pedagogicalMonitoringService';
import {
  reportCardService,
  type ReportCardSubjectResult,
} from './reportCardService';
import { studentService, type StudentRow } from './studentService';
import { getEnrollmentStatusLabel } from '../lib/statusLabels';
import { termClosingService, type TermClosureOffering } from './termClosingService';

export type AcademicReportType =
  | 'ENROLLMENTS'
  | 'RESULTS'
  | 'ATTENDANCE';

export interface AcademicReportOption {
  id: string;
  label: string;
  academicYearId?: string;
  termId?: string;
}

export interface AcademicReportOptions {
  academicYears: AcademicYearOption[];
  classes: AcademicReportOption[];
  subjects: AcademicReportOption[];
  students: AcademicReportOption[];
}

export interface EnrollmentReportFilters {
  academicYearId?: string;
  classId?: string;
  status?: string;
  search?: string;
}

export interface EnrollmentReportRow {
  id: string;
  studentName: string;
  registrationNumber: string;
  studentStatus: string;
  academicYearName: string;
  className: string;
  gradeLevel: string | null;
  shift: string | null;
  enrollmentStatus: EnrollmentRow['status'];
  enrollmentStatusLabel: string;
  enrolledAt: string | null;
}

export interface AcademicResultsReportFilters {
  academicYearId: string;
  termId: string;
  classId: string;
  subjectId?: string;
}

export interface AcademicResultsReportRow {
  id: string;
  studentName: string;
  registrationNumber: string;
  className: string;
  subjectName: string;
  teacherName: string;
  gradePercentage: number | null;
  recoveryPercentage: number | null;
  finalGradePercentage: number | null;
  attendancePercentage: number | null;
  resultStatus: ReportCardSubjectResult['resultStatus'];
  dataStatus: 'PARTIAL' | 'OFFICIAL';
}

export interface AttendanceReportFilters {
  academicYearId: string;
  termId: string;
  classId: string;
  subjectId?: string;
  studentId?: string;
}

export interface AttendanceReportRow {
  id: string;
  studentName: string;
  registrationNumber: string;
  className: string;
  presentRecords: number;
  absentRecords: number;
  lateRecords: number;
  excusedRecords: number;
  totalRecords: number;
  attendanceRate: number | null;
}

function toOptions(values: Map<string, AcademicReportOption>): AcademicReportOption[] {
  return Array.from(values.values()).sort((first, second) =>
    first.label.localeCompare(second.label, 'pt-BR'));
}

function normalizeSearch(value: string | undefined): string {
  return value?.trim().toLocaleLowerCase('pt-BR') ?? '';
}

function isActiveEnrollment(row: EnrollmentRow): boolean {
  return row.active && row.status === 'ACTIVE' && row.student_active && row.class_active;
}

function getAcademicYear(
  years: readonly AcademicYearOption[],
  id: string,
): AcademicYearOption {
  const year = years.find((item) => item.id === id);
  if (!year) throw new Error('Ano letivo não encontrado.');
  return year;
}

function getTerm(year: AcademicYearOption, id: string) {
  const term = year.terms.find((item) => item.id === id);
  if (!term) throw new Error('Período não encontrado no ano letivo selecionado.');
  return term;
}

function preferredYear(years: readonly AcademicYearOption[]): AcademicYearOption | null {
  return years.find((year) => year.active) ?? years[0] ?? null;
}

function preferredTerm(year: AcademicYearOption | null) {
  return year?.terms.find((term) => term.active) ?? year?.terms[0] ?? null;
}

function studentName(student: StudentRow): string {
  return student.profiles?.full_name?.trim() || student.registration_number;
}

function reportCardKey(studentId: string, subjectOfferingId: string, termId: string): string {
  return `${studentId}:${subjectOfferingId}:${termId}`;
}

function resultRowFromSubjects(
  student: { studentId: string; fullName: string; registrationNumber: string },
  subject: PedagogicalMonitoringSubject,
  reportCard: ReportCardSubjectResult | undefined,
): AcademicResultsReportRow {
  const isClosed = reportCard?.isClosed ?? subject.isClosed;
  return {
    id: `${student.studentId}:${subject.subjectOfferingId}`,
    studentName: student.fullName,
    registrationNumber: student.registrationNumber,
    className: subject.className,
    subjectName: subject.subjectName,
    teacherName: subject.teacherName,
    gradePercentage: isClosed
      ? reportCard?.gradePercentage ?? null
      : subject.gradePercentage,
    recoveryPercentage: isClosed
      ? reportCard?.recoveryPercentage ?? null
      : null,
    finalGradePercentage: isClosed
      ? reportCard?.finalGradePercentage ?? null
      : null,
    attendancePercentage: isClosed
      ? reportCard?.attendancePercentage ?? subject.attendancePercentage
      : subject.attendancePercentage,
    resultStatus: reportCard?.resultStatus ?? 'PENDING',
    dataStatus: isClosed ? 'OFFICIAL' : 'PARTIAL',
  };
}

export function getPreferredAcademicReportSelection(
  years: readonly AcademicYearOption[],
): { academicYearId: string; termId: string } | null {
  const year = preferredYear(years);
  const term = preferredTerm(year);
  return year && term
    ? { academicYearId: year.id, termId: term.id }
    : null;
}

export const academicReportService = {
  async getOptions(institutionId: string): Promise<AcademicReportOptions> {
    const [academicYears, enrollments, students, offerings] = await Promise.all([
      academicPolicyService.listAcademicYears(institutionId),
      enrollmentService.list(institutionId),
      studentService.list(institutionId),
      termClosingService.listInstitutionOfferings(institutionId),
    ]);

    const classes = new Map<string, AcademicReportOption>();
    const subjects = new Map<string, AcademicReportOption>();

    for (const enrollment of enrollments) {
      classes.set(enrollment.class_id, {
        id: enrollment.class_id,
        label: enrollment.class_name,
        academicYearId: enrollment.academic_year_id,
      });
    }

    for (const offering of offerings) {
      classes.set(offering.classId, {
        id: offering.classId,
        label: offering.className,
        academicYearId: offering.academicYearId,
        termId: offering.termId,
      });
      subjects.set(`${offering.subjectId}:${offering.termId}`, {
        id: offering.subjectId,
        label: offering.subjectName,
        academicYearId: offering.academicYearId,
        termId: offering.termId,
      });
    }

    return {
      academicYears,
      classes: toOptions(classes),
      subjects: toOptions(subjects),
      students: students
        .map((student) => ({
          id: student.id,
          label: `${studentName(student)} · ${student.registration_number}`,
        }))
        .sort((first, second) => first.label.localeCompare(second.label, 'pt-BR')),
    };
  },

  async getEnrollmentReport(
    institutionId: string,
    filters: EnrollmentReportFilters,
  ): Promise<EnrollmentReportRow[]> {
    const [students, enrollments] = await Promise.all([
      studentService.list(institutionId),
      enrollmentService.list(institutionId),
    ]);
    const studentsById = new Map(students.map((student) => [student.id, student]));
    const search = normalizeSearch(filters.search);

    return enrollments
      .filter((enrollment) =>
        (!filters.academicYearId || enrollment.academic_year_id === filters.academicYearId) &&
        (!filters.classId || enrollment.class_id === filters.classId) &&
        (!filters.status || filters.status === 'ALL' || enrollment.status === filters.status),
      )
      .map((enrollment) => {
        const student = studentsById.get(enrollment.student_id);
        if (!student) return null;
        const name = studentName(student);
        return {
          id: enrollment.id,
          studentName: name,
          registrationNumber: enrollment.student_registration_number,
          studentStatus: student.active ? 'Ativo' : 'Inativo',
          academicYearName: enrollment.academic_year_name,
          className: enrollment.class_name,
          gradeLevel: enrollment.class_grade_level,
          shift: enrollment.class_shift,
          enrollmentStatus: enrollment.status,
          enrollmentStatusLabel: getEnrollmentStatusLabel(enrollment.status),
          enrolledAt: enrollment.enrolled_at ?? null,
        } satisfies EnrollmentReportRow;
      })
      .filter((row): row is EnrollmentReportRow => row !== null)
      .filter((row) => {
        if (!search) return true;
        return `${row.studentName} ${row.registrationNumber}`
          .toLocaleLowerCase('pt-BR')
          .includes(search);
      });
  },

  async getAcademicResultsReport(
    institutionId: string,
    filters: AcademicResultsReportFilters,
  ): Promise<AcademicResultsReportRow[]> {
    const students = await studentService.list(institutionId);
    const studentIds = students.filter((student) => student.active).map((student) => student.id);
    const [monitoring, reportCards] = await Promise.all([
      pedagogicalMonitoringService.getInstitutionMonitoring(institutionId, {
        academicYearId: filters.academicYearId,
        termId: filters.termId,
        classId: filters.classId,
        subjectId: filters.subjectId,
      }),
      reportCardService.getGuardianReportCards(institutionId, studentIds),
    ]);
    const reportCardsByKey = new Map<string, ReportCardSubjectResult>();

    for (const reportCard of reportCards) {
      for (const subject of reportCard.subjects) {
        if (
          subject.academicYearId === filters.academicYearId &&
          subject.termId === filters.termId
        ) {
          reportCardsByKey.set(
            reportCardKey(reportCard.studentId, subject.subjectOfferingId, subject.termId),
            subject,
          );
        }
      }
    }

    return monitoring.students
      .flatMap((student) => student.subjects.map((subject) => resultRowFromSubjects(
        student,
        subject,
        reportCardsByKey.get(reportCardKey(student.studentId, subject.subjectOfferingId, filters.termId)),
      )))
      .sort((first, second) =>
        first.studentName.localeCompare(second.studentName, 'pt-BR') ||
        first.subjectName.localeCompare(second.subjectName, 'pt-BR'),
      );
  },

  async getAttendanceReport(
    institutionId: string,
    filters: AttendanceReportFilters,
  ): Promise<AttendanceReportRow[]> {
    const [years, enrollments, students] = await Promise.all([
      academicPolicyService.listAcademicYears(institutionId),
      enrollmentService.list(institutionId),
      studentService.list(institutionId),
    ]);
    const year = getAcademicYear(years, filters.academicYearId);
    const term = getTerm(year, filters.termId);
    const attendance = await attendanceService.getInstitutionAttendanceSummary(institutionId, {
      fromDate: term.startDate,
      toDate: term.endDate,
      academicYearId: filters.academicYearId,
      termId: filters.termId,
      classId: filters.classId,
      subjectId: filters.subjectId,
      studentId: filters.studentId,
      limit: null,
    });
    const studentsById = new Map(students.map((student) => [student.id, student]));
    const recordsByStudent = new Map<string, Array<{ status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' }>>();

    for (const session of attendance.sessions) {
      for (const record of session.records) {
        const records = recordsByStudent.get(record.studentId) ?? [];
        records.push({ status: record.status });
        recordsByStudent.set(record.studentId, records);
      }
    }

    return enrollments
      .filter((enrollment) =>
        enrollment.academic_year_id === filters.academicYearId &&
        enrollment.class_id === filters.classId &&
        isActiveEnrollment(enrollment) &&
        (!filters.studentId || enrollment.student_id === filters.studentId),
      )
      .map((enrollment) => {
        const student = studentsById.get(enrollment.student_id);
        if (!student) return null;
        const summary: AttendanceSummary = calculateAttendanceSummary(
          recordsByStudent.get(enrollment.student_id) ?? [],
        );
        return {
          id: enrollment.student_id,
          studentName: studentName(student),
          registrationNumber: enrollment.student_registration_number,
          className: enrollment.class_name,
          presentRecords: summary.presentRecords,
          absentRecords: summary.absentRecords,
          lateRecords: summary.lateRecords,
          excusedRecords: summary.excusedRecords,
          totalRecords: summary.totalRecords,
          attendanceRate: summary.totalRecords > 0 ? summary.attendanceRate : null,
        } satisfies AttendanceReportRow;
      })
      .filter((row): row is AttendanceReportRow => row !== null)
      .sort((first, second) => first.studentName.localeCompare(second.studentName, 'pt-BR'));
  },
};
