import {
  calculateAttendanceSummary,
  type AttendanceStatus,
} from './attendanceService';
import {
  calculateGradeSummary,
  type AssessmentStatus,
  type GradeStatus,
} from './gradeService';

export const TERM_CLOSURE_STATUSES = [
  'OPEN',
  'SUBMITTED',
  'CLOSED',
  'REOPENED',
] as const;

export type TermClosureStatus =
  (typeof TERM_CLOSURE_STATUSES)[number];

export const TERM_RESULT_STATUSES = [
  'PENDING',
  'APPROVED',
  'FAILED_BY_GRADE',
  'FAILED_BY_ATTENDANCE',
  'FAILED_BY_GRADE_AND_ATTENDANCE',
] as const;

export type TermResultStatus =
  (typeof TERM_RESULT_STATUSES)[number];

export interface AcademicPolicyRule {
  minimumGradePercentage: number;
  minimumAttendancePercentage: number;
  decimalPlaces: number;
}

export interface TermGradeCalculationInput {
  score: number | null;
  maxScore: number;
  weight: number;
  gradeStatus: GradeStatus;
  assessmentStatus: AssessmentStatus;
}

export interface TermAttendanceCalculationInput {
  status: AttendanceStatus;
}

export interface TermResultCalculation {
  gradePercentage: number | null;
  attendancePercentage: number | null;
  resultStatus: TermResultStatus;
}

export type AcademicPolicyValidationCode =
  | 'ACADEMIC_POLICY_GRADE_INVALID'
  | 'ACADEMIC_POLICY_ATTENDANCE_INVALID'
  | 'ACADEMIC_POLICY_DECIMALS_INVALID';

export interface AcademicPolicyValidationIssue {
  code: AcademicPolicyValidationCode;
  message: string;
}

export function roundAcademicPercentage(
  value: number,
  decimalPlaces: number,
): number {
  const normalizedPlaces = Math.min(
    Math.max(Math.trunc(decimalPlaces), 0),
    4,
  );
  const factor = 10 ** normalizedPlaces;

  return Math.round(value * factor) / factor;
}

export function validateAcademicPolicyRule(
  policy: AcademicPolicyRule,
): AcademicPolicyValidationIssue[] {
  const issues: AcademicPolicyValidationIssue[] = [];

  if (
    !Number.isFinite(policy.minimumGradePercentage) ||
    policy.minimumGradePercentage < 0 ||
    policy.minimumGradePercentage > 100
  ) {
    issues.push({
      code: 'ACADEMIC_POLICY_GRADE_INVALID',
      message:
        'A media minima deve ser um percentual entre 0 e 100.',
    });
  }

  if (
    !Number.isFinite(
      policy.minimumAttendancePercentage,
    ) ||
    policy.minimumAttendancePercentage < 0 ||
    policy.minimumAttendancePercentage > 100
  ) {
    issues.push({
      code: 'ACADEMIC_POLICY_ATTENDANCE_INVALID',
      message:
        'A frequencia minima deve ser um percentual entre 0 e 100.',
    });
  }

  if (
    !Number.isInteger(policy.decimalPlaces) ||
    policy.decimalPlaces < 0 ||
    policy.decimalPlaces > 4
  ) {
    issues.push({
      code: 'ACADEMIC_POLICY_DECIMALS_INVALID',
      message:
        'As casas decimais devem estar entre 0 e 4.',
    });
  }

  return issues;
}

export function calculateTermGradePercentage(
  records: readonly TermGradeCalculationInput[],
  decimalPlaces: number,
): number | null {
  const validRecords = records.filter(
    (record) =>
      record.assessmentStatus === 'PUBLISHED' ||
      record.assessmentStatus === 'CLOSED',
  );

  const summary = calculateGradeSummary(
    validRecords.map((record) => ({
      score: record.score,
      maxScore: record.maxScore,
      weight: record.weight,
      status: record.gradeStatus,
    })),
  );

  if (summary.gradedCount === 0) {
    return null;
  }

  const weightedPercentTotal = validRecords.reduce(
    (total, record) => {
      if (
        record.gradeStatus !== 'GRADED' ||
        record.score === null ||
        record.maxScore <= 0 ||
        record.weight <= 0
      ) {
        return total;
      }

      return (
        total +
        (record.score / record.maxScore) *
          100 *
          record.weight
      );
    },
    0,
  );

  const weightTotal = validRecords.reduce(
    (total, record) => {
      if (
        record.gradeStatus !== 'GRADED' ||
        record.score === null ||
        record.maxScore <= 0 ||
        record.weight <= 0
      ) {
        return total;
      }

      return total + record.weight;
    },
    0,
  );

  if (weightTotal <= 0) {
    return summary.weightedAveragePercent;
  }

  return roundAcademicPercentage(
    weightedPercentTotal / weightTotal,
    decimalPlaces,
  );
}

export function calculateTermAttendancePercentage(
  records: readonly TermAttendanceCalculationInput[],
  decimalPlaces: number,
): number | null {
  const summary = calculateAttendanceSummary(records);

  if (summary.totalRecords === 0) {
    return null;
  }

  return roundAcademicPercentage(
    summary.attendanceRate,
    decimalPlaces,
  );
}

export function calculateTermResultStatus(
  policy: AcademicPolicyRule | null,
  gradePercentage: number | null,
  attendancePercentage: number | null,
): TermResultStatus {
  if (
    !policy ||
    gradePercentage === null ||
    attendancePercentage === null
  ) {
    return 'PENDING';
  }

  const failedByGrade =
    gradePercentage < policy.minimumGradePercentage;
  const failedByAttendance =
    attendancePercentage <
    policy.minimumAttendancePercentage;

  if (failedByGrade && failedByAttendance) {
    return 'FAILED_BY_GRADE_AND_ATTENDANCE';
  }

  if (failedByGrade) {
    return 'FAILED_BY_GRADE';
  }

  if (failedByAttendance) {
    return 'FAILED_BY_ATTENDANCE';
  }

  return 'APPROVED';
}

export function calculateTermResult(
  policy: AcademicPolicyRule | null,
  gradeRecords: readonly TermGradeCalculationInput[],
  attendanceRecords: readonly TermAttendanceCalculationInput[],
): TermResultCalculation {
  const decimalPlaces = policy?.decimalPlaces ?? 1;
  const gradePercentage =
    calculateTermGradePercentage(
      gradeRecords,
      decimalPlaces,
    );
  const attendancePercentage =
    calculateTermAttendancePercentage(
      attendanceRecords,
      decimalPlaces,
    );

  return {
    gradePercentage,
    attendancePercentage,
    resultStatus: calculateTermResultStatus(
      policy,
      gradePercentage,
      attendancePercentage,
    ),
  };
}
