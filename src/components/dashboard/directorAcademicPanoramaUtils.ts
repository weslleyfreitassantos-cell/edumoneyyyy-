import type {
  InstitutionAttendanceSession,
  InstitutionClassDiaryEntry,
} from '../../services/attendanceService';
import type {
  InstitutionAssessmentResult,
  InstitutionStudentPerformance,
} from '../../services/gradeService';

export type PanoramaStudentSituation =
  | 'REGULAR'
  | 'ATTENTION'
  | 'CRITICAL'
  | 'NO_DATA';

export interface WeeklyAttendancePoint {
  key: string;
  label: string;
  attendanceRate: number;
  totalRecords: number;
}

export interface ClassPerformancePoint {
  classId: string;
  className: string;
  adequate: number;
  attention: number;
  critical: number;
  total: number;
  withoutPerformance: number;
}

export interface StudentSituationInput {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  attendanceRate: number | null;
  performancePercent: number | null;
}

interface StudentSignalAccumulator extends StudentSituationInput {
  present: number;
  total: number;
}

export interface StudentSituationSummary {
  situation: PanoramaStudentSituation;
  count: number;
}

export interface PanoramaClassOption {
  id: string;
  label: string;
}

export const DEFAULT_PANORAMA_PERIOD = 'year' as const;

export function mergePanoramaClassOptions(
  ...groups: readonly PanoramaClassOption[][]
): Array<[string, string]> {
  const options = new Map<string, string>();

  for (const group of groups) {
    for (const option of group) {
      const label = option.label.trim();
      if (option.id && label) {
        options.set(option.id, label);
      }
    }
  }

  return Array.from(options.entries()).sort((first, second) =>
    first[1].localeCompare(second[1], 'pt-BR'),
  );
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function localDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function weekStartKey(value: string): string {
  const date = parseDateKey(value);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return localDateKey(date);
}

function formatWeekLabel(value: string): string {
  const date = parseDateKey(value);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).replace('.', '');
}

export function classifyStudentSituation(
  attendanceRate: number | null,
  performancePercent: number | null,
): PanoramaStudentSituation {
  if (attendanceRate === null && performancePercent === null) {
    return 'NO_DATA';
  }

  if (
    (attendanceRate !== null && attendanceRate < 75) ||
    (performancePercent !== null && performancePercent < 50)
  ) {
    return 'CRITICAL';
  }

  if (
    (attendanceRate !== null && attendanceRate < 85) ||
    (performancePercent !== null && performancePercent < 70)
  ) {
    return 'ATTENTION';
  }

  return 'REGULAR';
}

export function buildWeeklyAttendanceTrend(
  sessions: readonly InstitutionAttendanceSession[],
): WeeklyAttendancePoint[] {
  const weeks = new Map<string, { present: number; total: number }>();

  for (const session of sessions) {
    const key = weekStartKey(session.sessionDate);
    const current = weeks.get(key) ?? { present: 0, total: 0 };

    for (const record of session.records) {
      current.total += 1;
      if (record.status === 'PRESENT' || record.status === 'LATE') {
        current.present += 1;
      }
    }

    weeks.set(key, current);
  }

  return Array.from(weeks.entries())
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, totals]) => ({
      key,
      label: formatWeekLabel(key),
      attendanceRate: totals.total === 0
        ? 0
        : Math.round((totals.present / totals.total) * 1000) / 10,
      totalRecords: totals.total,
    }));
}

export function buildClassPerformance(
  students: readonly InstitutionStudentPerformance[],
): ClassPerformancePoint[] {
  const classes = new Map<string, ClassPerformancePoint>();
  const studentsByClass = new Map<string, Set<string>>();

  for (const student of students) {
    const current = classes.get(student.classId) ?? {
      classId: student.classId,
      className: student.className,
      adequate: 0,
      attention: 0,
      critical: 0,
      total: 0,
      withoutPerformance: 0,
    };
    const seenStudents = studentsByClass.get(student.classId) ?? new Set<string>();

    if (seenStudents.has(student.studentId)) {
      continue;
    }
    seenStudents.add(student.studentId);
    studentsByClass.set(student.classId, seenStudents);

    if (student.performancePercent === null) {
      current.withoutPerformance += 1;
    } else if (student.performancePercent >= 70) {
      current.total += 1;
      current.adequate += 1;
    } else if (student.performancePercent >= 50) {
      current.total += 1;
      current.attention += 1;
    } else {
      current.total += 1;
      current.critical += 1;
    }
    classes.set(student.classId, current);
  }

  return Array.from(classes.values()).sort((first, second) =>
    first.className.localeCompare(second.className, 'pt-BR'),
  );
}

export function buildStudentSituationSummary(
  students: readonly StudentSituationInput[],
): StudentSituationSummary[] {
  const counts: Record<PanoramaStudentSituation, number> = {
    REGULAR: 0,
    ATTENTION: 0,
    CRITICAL: 0,
    NO_DATA: 0,
  };

  for (const student of students) {
    counts[classifyStudentSituation(
      student.attendanceRate,
      student.performancePercent,
    )] += 1;
  }

  return (Object.keys(counts) as PanoramaStudentSituation[]).map((situation) => ({
    situation,
    count: counts[situation],
  }));
}

export function mergeStudentSignals(
  attendanceSessions: readonly InstitutionAttendanceSession[],
  gradeStudents: readonly InstitutionStudentPerformance[],
): StudentSituationInput[] {
  const students = new Map<string, StudentSignalAccumulator>();

  for (const session of attendanceSessions) {
    for (const record of session.records) {
      const current: StudentSignalAccumulator = students.get(record.studentId) ?? {
        studentId: record.studentId,
        studentName: record.studentName ?? 'Aluno sem nome',
        classId: session.offering.classId,
        className: session.offering.className,
        attendanceRate: null,
        performancePercent: null,
        present: 0,
        total: 0,
      };

      current.total += 1;
      if (record.status === 'PRESENT' || record.status === 'LATE') {
        current.present += 1;
      }
      current.attendanceRate = Math.round((current.present / current.total) * 1000) / 10;
      students.set(record.studentId, current);
    }
  }

  for (const student of gradeStudents) {
    const current: StudentSignalAccumulator = students.get(student.studentId) ?? {
      studentId: student.studentId,
      studentName: student.studentName,
      classId: student.classId,
      className: student.className,
      attendanceRate: null,
      performancePercent: null,
      present: 0,
      total: 0,
    };
    current.performancePercent = student.performancePercent;
    if (!current.studentName || current.studentName === 'Aluno sem nome') {
      current.studentName = student.studentName;
    }
    if (!current.classId) {
      current.classId = student.classId;
      current.className = student.className;
    }
    students.set(student.studentId, current);
  }

  return Array.from(students.values()).map(({ present: _present, total: _total, ...student }) => student);
}

export function countPendingAcademicItems(
  diaryEntries: readonly InstitutionClassDiaryEntry[],
  assessments: readonly InstitutionAssessmentResult[],
) {
  return {
    attendancePending: diaryEntries.filter(
      (entry) => entry.diaryStatus === 'PENDING' || entry.diaryStatus === 'DRAFT',
    ).length,
    missingGrades: assessments.reduce((total, result) => total + result.missingCount, 0),
    assessmentsWithoutLaunch: assessments.filter(
      (result) => result.expectedStudentCount > 0 && result.launchedCount === 0,
    ).length,
  };
}
