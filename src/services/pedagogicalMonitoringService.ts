import {
  academicPolicyService,
  type AcademicPolicy,
  type AcademicYearOption,
} from './academicPolicyService';
import {
  calculateAttendanceSummary,
  type AttendanceStatus,
  attendanceService,
} from './attendanceService';
import {
  enrollmentService,
  type EnrollmentRow,
} from './enrollmentService';
import {
  reportCardService,
  type ReportCardSubjectResult,
} from './reportCardService';
import { studentService } from './studentService';
import {
  termClosingService,
  type TermClosureOffering,
} from './termClosingService';

export type PedagogicalRiskLevel =
  | 'NORMAL'
  | 'ATTENTION'
  | 'CRITICAL';

export type PedagogicalDataStatus =
  | 'PARTIAL'
  | 'OFFICIAL';

export interface PedagogicalRiskInput {
  lowPerformanceSubjects: number;
  lowAttendanceSubjects: number;
  pendingItems: number;
  policyConfigured: boolean;
}

export interface PedagogicalRiskResult {
  level: PedagogicalRiskLevel;
  reasons: string[];
}

export function classifyPedagogicalRisk(
  input: PedagogicalRiskInput,
): PedagogicalRiskResult {
  const reasons: string[] = [];

  if (!input.policyConfigured) {
    reasons.push('Política acadêmica ainda não configurada.');
  }

  if (input.lowPerformanceSubjects > 0) {
    reasons.push(
      `${input.lowPerformanceSubjects} disciplina(s) abaixo da média.`,
    );
  }

  if (input.lowAttendanceSubjects > 0) {
    reasons.push(
      `${input.lowAttendanceSubjects} disciplina(s) com frequência baixa.`,
    );
  }

  if (input.pendingItems > 0) {
    reasons.push(`${input.pendingItems} pendência(s) acadêmica(s).`);
  }

  const signalCount =
    Number(input.lowPerformanceSubjects > 0) +
    Number(input.lowAttendanceSubjects > 0) +
    Number(input.pendingItems > 0);
  const critical =
    input.lowPerformanceSubjects > 0 &&
      input.lowAttendanceSubjects > 0 ||
    input.lowPerformanceSubjects >= 2 ||
    signalCount >= 3;

  return {
    level: critical
      ? 'CRITICAL'
      : reasons.length > 0
        ? 'ATTENTION'
        : 'NORMAL',
    reasons,
  };
}

export interface PedagogicalMonitoringFilters {
  academicYearId?: string;
  termId?: string;
  classId?: string;
  subjectId?: string;
  teacherProfileId?: string;
}

export interface PedagogicalMonitoringSubject {
  subjectOfferingId: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  teacherProfileId: string;
  teacherName: string;
  gradePercentage: number | null;
  attendancePercentage: number | null;
  pendingItems: number;
  isClosed: boolean;
  dataStatus: PedagogicalDataStatus;
}

export interface PedagogicalStudentSummary {
  studentId: string;
  fullName: string;
  registrationNumber: string;
  classId: string;
  className: string;
  averageGrade: number | null;
  attendancePercentage: number | null;
  pendingItems: number;
  lowPerformanceSubjects: number;
  lowAttendanceSubjects: number;
  dataStatus: PedagogicalDataStatus;
  risk: PedagogicalRiskResult;
  subjects: PedagogicalMonitoringSubject[];
}

export interface PedagogicalClassSummary {
  classId: string;
  className: string;
  students: number;
  normal: number;
  attention: number;
  critical: number;
  averageGrade: number | null;
  attendancePercentage: number | null;
}

export interface PedagogicalSubjectSummary {
  subjectId: string;
  subjectName: string;
  students: number;
  lowPerformance: number;
  lowAttendance: number;
  averageGrade: number | null;
  attendancePercentage: number | null;
}

export interface PedagogicalMonitoringData {
  academicYear: AcademicYearOption | null;
  term: AcademicYearOption['terms'][number] | null;
  policy: AcademicPolicy | null;
  filters: {
    years: AcademicYearOption[];
    terms: AcademicYearOption['terms'];
    classes: Array<{ id: string; label: string }>;
    subjects: Array<{ id: string; label: string }>;
    teachers: Array<{ id: string; label: string }>;
  };
  students: PedagogicalStudentSummary[];
  classes: PedagogicalClassSummary[];
  subjects: PedagogicalSubjectSummary[];
  metrics: {
    monitoredStudents: number;
    attentionStudents: number;
    criticalStudents: number;
    lowAttendanceStudents: number;
    lowPerformanceStudents: number;
    pendingStudents: number;
    officialStudents: number;
    partialStudents: number;
    closedOfferings: number;
    totalOfferings: number;
  };
}

function numberOrNull(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : value;
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return Math.round(
    (values.reduce((sum, value) => sum + value, 0) / values.length) * 10,
  ) / 10;
}

function sortOptions(
  values: Map<string, string>,
): Array<{ id: string; label: string }> {
  return Array.from(values.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((first, second) =>
      first.label.localeCompare(second.label, 'pt-BR'),
    );
}

function isActiveEnrollment(enrollment: EnrollmentRow): boolean {
  return enrollment.active &&
    enrollment.status === 'ACTIVE' &&
    enrollment.student_active &&
    enrollment.class_active;
}

function subjectAttendance(
  offeringId: string,
  studentId: string,
  attendance: Awaited<
    ReturnType<typeof attendanceService.getInstitutionAttendanceSummary>
  >,
): number | null {
  const records = attendance.sessions
    .filter((session) => session.offering.id === offeringId)
    .flatMap((session) =>
      session.records
        .filter((record) => record.studentId === studentId)
        .map((record) => ({ status: record.status })),
    );

  if (records.length === 0) {
    return null;
  }

  return calculateAttendanceSummary(
    records as Array<{ status: AttendanceStatus }>,
  ).attendanceRate;
}

function subjectFromOffering(
  offering: TermClosureOffering,
  result: ReportCardSubjectResult | undefined,
  attendancePercentage: number | null,
): PedagogicalMonitoringSubject {
  const assessments = result?.assessments ?? [];
  const pendingItems = assessments.filter(
    (assessment) => assessment.status === 'PENDING',
  ).length;
  const isClosed = result?.isClosed ?? false;

  return {
    subjectOfferingId: offering.id,
    subjectId: offering.subjectId,
    subjectName: offering.subjectName,
    classId: offering.classId,
    className: offering.className,
    teacherProfileId: offering.teacherProfileId,
    teacherName: offering.teacherName,
    gradePercentage: numberOrNull(result?.gradePercentage ?? null),
    attendancePercentage: numberOrNull(
      result?.attendancePercentage ?? attendancePercentage,
    ),
    pendingItems,
    isClosed,
    dataStatus: isClosed ? 'OFFICIAL' : 'PARTIAL',
  };
}

function buildClassSummaries(
  students: readonly PedagogicalStudentSummary[],
): PedagogicalClassSummary[] {
  const grouped = new Map<string, PedagogicalStudentSummary[]>();

  for (const student of students) {
    const current = grouped.get(student.classId) ?? [];
    current.push(student);
    grouped.set(student.classId, current);
  }

  return Array.from(grouped.entries())
    .map(([classId, rows]) => ({
      classId,
      className: rows[0]?.className ?? 'Turma',
      students: rows.length,
      normal: rows.filter((row) => row.risk.level === 'NORMAL').length,
      attention: rows.filter((row) => row.risk.level === 'ATTENTION').length,
      critical: rows.filter((row) => row.risk.level === 'CRITICAL').length,
      averageGrade: average(
        rows
          .map((row) => row.averageGrade)
          .filter((value): value is number => value !== null),
      ),
      attendancePercentage: average(
        rows
          .map((row) => row.attendancePercentage)
          .filter((value): value is number => value !== null),
      ),
    }))
    .sort((first, second) =>
      first.className.localeCompare(second.className, 'pt-BR'),
    );
}

function buildSubjectSummaries(
  students: readonly PedagogicalStudentSummary[],
  policy: AcademicPolicy | null,
): PedagogicalSubjectSummary[] {
  const grouped = new Map<string, PedagogicalMonitoringSubject[]>();

  for (const student of students) {
    for (const subject of student.subjects) {
      const current = grouped.get(subject.subjectId) ?? [];
      current.push(subject);
      grouped.set(subject.subjectId, current);
    }
  }

  return Array.from(grouped.entries())
    .map(([subjectId, rows]) => ({
      subjectId,
      subjectName: rows[0]?.subjectName ?? 'Disciplina',
      students: rows.length,
      lowPerformance: rows.filter(
        (row) =>
          policy !== null &&
          row.gradePercentage !== null &&
          row.gradePercentage < policy.minimumGradePercentage,
      ).length,
      lowAttendance: rows.filter(
        (row) =>
          policy !== null &&
          row.attendancePercentage !== null &&
          row.attendancePercentage < policy.minimumAttendancePercentage,
      ).length,
      averageGrade: average(
        rows
          .map((row) => row.gradePercentage)
          .filter((value): value is number => value !== null),
      ),
      attendancePercentage: average(
        rows
          .map((row) => row.attendancePercentage)
          .filter((value): value is number => value !== null),
      ),
    }))
    .sort((first, second) =>
      first.subjectName.localeCompare(second.subjectName, 'pt-BR'),
    );
}

function emptyData(
  years: AcademicYearOption[],
): PedagogicalMonitoringData {
  return {
    academicYear: null,
    term: null,
    policy: null,
    filters: {
      years,
      terms: [],
      classes: [],
      subjects: [],
      teachers: [],
    },
    students: [],
    classes: [],
    subjects: [],
    metrics: {
      monitoredStudents: 0,
      attentionStudents: 0,
      criticalStudents: 0,
      lowAttendanceStudents: 0,
      lowPerformanceStudents: 0,
      pendingStudents: 0,
      officialStudents: 0,
      partialStudents: 0,
      closedOfferings: 0,
      totalOfferings: 0,
    },
  };
}

export const pedagogicalMonitoringService = {
  async getInstitutionMonitoring(
    institutionId: string,
    filters: PedagogicalMonitoringFilters = {},
  ): Promise<PedagogicalMonitoringData> {
    const years = await academicPolicyService.listAcademicYears(
      institutionId,
    );
    const academicYear =
      years.find((year) => year.id === filters.academicYearId) ??
      years.find((year) => year.active) ??
      years[0] ??
      null;

    if (!academicYear) {
      return emptyData(years);
    }

    const term =
      academicYear.terms.find((item) => item.id === filters.termId) ??
      academicYear.terms.find((item) => item.active) ??
      academicYear.terms[0] ??
      null;

    if (!term) {
      return {
        ...emptyData(years),
        academicYear,
        filters: {
          ...emptyData(years).filters,
          terms: academicYear.terms,
        },
      };
    }

    const students = await studentService.list(institutionId);
    const activeStudents = students.filter((student) => student.active);
    const studentIds = activeStudents.map((student) => student.id);
    const selectedFilters = {
      academicYearId: academicYear.id,
      termId: term.id,
      classId: filters.classId,
      subjectId: filters.subjectId,
      teacherProfileId: filters.teacherProfileId,
    };

    const [
      enrollments,
      policy,
      offerings,
      reportCards,
      attendance,
    ] = await Promise.all([
      enrollmentService.list(institutionId),
      academicPolicyService.getActivePolicy(
        institutionId,
        academicYear.id,
      ),
      termClosingService.listInstitutionOfferings(
        institutionId,
        selectedFilters,
      ),
      reportCardService.getGuardianReportCards(
        institutionId,
        studentIds,
      ),
      attendanceService.getInstitutionAttendanceSummary(
        institutionId,
        {
          fromDate: term.startDate,
          toDate: term.endDate,
          classId: filters.classId,
          subjectId: filters.subjectId,
          teacherProfileId: filters.teacherProfileId,
        },
      ),
    ]);

    const activeEnrollments = enrollments.filter(
      (enrollment) =>
        enrollment.academic_year_id === academicYear.id &&
        isActiveEnrollment(enrollment) &&
        (!filters.classId || enrollment.class_id === filters.classId),
    );
    const enrollmentByStudent = new Map<string, EnrollmentRow>();
    for (const enrollment of activeEnrollments) {
      if (!enrollmentByStudent.has(enrollment.student_id)) {
        enrollmentByStudent.set(enrollment.student_id, enrollment);
      }
    }

    const filteredStudents = activeStudents.filter((student) =>
      enrollmentByStudent.has(student.id),
    );
    const reportCardByStudent = new Map(
      reportCards.map((reportCard) => [reportCard.studentId, reportCard]),
    );
    const offeringsByClass = new Map<string, TermClosureOffering[]>();
    for (const offering of offerings) {
      const current = offeringsByClass.get(offering.classId) ?? [];
      current.push(offering);
      offeringsByClass.set(offering.classId, current);
    }

    const studentRows = filteredStudents
      .map((student) => {
        const enrollment = enrollmentByStudent.get(student.id);
        if (!enrollment) {
          return null;
        }

        const studentReportCard = reportCardByStudent.get(student.id);
        const resultsByOffering = new Map(
          (studentReportCard?.subjects ?? [])
            .filter(
              (result) =>
                result.academicYearId === academicYear.id &&
                result.termId === term.id,
            )
            .map((result) => [result.subjectOfferingId, result]),
        );
        const subjects = (offeringsByClass.get(enrollment.class_id) ?? [])
          .map((offering) =>
            subjectFromOffering(
              offering,
              resultsByOffering.get(offering.id),
              subjectAttendance(offering.id, student.id, attendance),
            ),
          );
        const lowPerformanceSubjects = policy
          ? subjects.filter(
              (subject) =>
                subject.gradePercentage !== null &&
                subject.gradePercentage < policy.minimumGradePercentage,
            ).length
          : 0;
        const lowAttendanceSubjects = policy
          ? subjects.filter(
              (subject) =>
                subject.attendancePercentage !== null &&
                subject.attendancePercentage < policy.minimumAttendancePercentage,
            ).length
          : 0;
        const pendingItems = subjects.length === 0
          ? 1
          : subjects.reduce(
              (total, subject) =>
                total + subject.pendingItems +
                Number(
                  subject.gradePercentage === null ||
                  subject.attendancePercentage === null,
                ),
              0,
            );
        const official = subjects.length > 0 && subjects.every(
          (subject) => subject.isClosed,
        );
        const gradeValues = subjects
          .map((subject) => subject.gradePercentage)
          .filter((value): value is number => value !== null);
        const attendanceValues = subjects
          .map((subject) => subject.attendancePercentage)
          .filter((value): value is number => value !== null);
        const profile = student.profiles;
        const risk = classifyPedagogicalRisk({
          lowPerformanceSubjects,
          lowAttendanceSubjects,
          pendingItems,
          policyConfigured: policy !== null,
        });

        return {
          studentId: student.id,
          fullName: profile?.full_name ?? 'Aluno sem nome',
          registrationNumber: student.registration_number,
          classId: enrollment.class_id,
          className: enrollment.class_name,
          averageGrade: average(gradeValues),
          attendancePercentage: average(attendanceValues),
          pendingItems,
          lowPerformanceSubjects,
          lowAttendanceSubjects,
          dataStatus: official ? 'OFFICIAL' : 'PARTIAL',
          risk,
          subjects,
        } satisfies PedagogicalStudentSummary;
      })
      .filter((student): student is PedagogicalStudentSummary => student !== null)
      .sort((first, second) => {
        const rank = { CRITICAL: 0, ATTENTION: 1, NORMAL: 2 };
        return rank[first.risk.level] - rank[second.risk.level] ||
          first.fullName.localeCompare(second.fullName, 'pt-BR');
      });

    const classOptions = new Map<string, string>();
    const subjectOptions = new Map<string, string>();
    const teacherOptions = new Map<string, string>();
    for (const offering of offerings) {
      classOptions.set(offering.classId, offering.className);
      subjectOptions.set(offering.subjectId, offering.subjectName);
      teacherOptions.set(offering.teacherProfileId, offering.teacherName);
    }

    return {
      academicYear,
      term,
      policy,
      filters: {
        years,
        terms: academicYear.terms,
        classes: sortOptions(classOptions),
        subjects: sortOptions(subjectOptions),
        teachers: sortOptions(teacherOptions),
      },
      students: studentRows,
      classes: buildClassSummaries(studentRows),
      subjects: buildSubjectSummaries(studentRows, policy),
      metrics: {
        monitoredStudents: studentRows.length,
        attentionStudents: studentRows.filter((student) => student.risk.level === 'ATTENTION').length,
        criticalStudents: studentRows.filter((student) => student.risk.level === 'CRITICAL').length,
        lowAttendanceStudents: studentRows.filter((student) => student.lowAttendanceSubjects > 0).length,
        lowPerformanceStudents: studentRows.filter((student) => student.lowPerformanceSubjects > 0).length,
        pendingStudents: studentRows.filter((student) => student.pendingItems > 0).length,
        officialStudents: studentRows.filter((student) => student.dataStatus === 'OFFICIAL').length,
        partialStudents: studentRows.filter((student) => student.dataStatus === 'PARTIAL').length,
        closedOfferings: offerings.filter((offering) => offering.closure?.status === 'CLOSED').length,
        totalOfferings: offerings.length,
      },
    };
  },
};
