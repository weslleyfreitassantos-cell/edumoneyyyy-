import type { AcademicYearRow } from '../services/academicStructureService';
import type { ClassRow } from '../services/classService';

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function compareLabels(left: string | null | undefined, right: string | null | undefined): number {
  return (left ?? '').localeCompare(right ?? '', 'pt-BR', {
    numeric: true,
    sensitivity: 'base',
  });
}

/** Returns the active year that is valid today, falling back to the most recent active year. */
export function getPreferredAcademicYear(
  years: AcademicYearRow[],
  today: Date = new Date(),
): AcademicYearRow | undefined {
  const activeYears = years.filter((year) => year.active);

  if (activeYears.length === 0) {
    return undefined;
  }

  const todayIso = toIsoDate(today);
  const currentYear = activeYears.find(
    (year) =>
      year.start_date <= todayIso &&
      year.end_date >= todayIso,
  );

  return currentYear ?? [...activeYears].sort(
    (left, right) => right.start_date.localeCompare(left.start_date),
  )[0];
}

/** Keeps the preferred year at the top while retaining inactive years for history screens. */
export function sortAcademicYearsForSelection(
  years: AcademicYearRow[],
): AcademicYearRow[] {
  const preferredId = getPreferredAcademicYear(years)?.id;

  return [...years].sort((left, right) => {
    if (left.id === preferredId) return -1;
    if (right.id === preferredId) return 1;
    if (left.active !== right.active) return left.active ? -1 : 1;

    return right.start_date.localeCompare(left.start_date);
  });
}

export function getActiveClassesForYear(
  classes: ClassRow[],
  academicYearId: string,
): ClassRow[] {
  return classes
    .filter(
      (classRecord) =>
        classRecord.active &&
        classRecord.academic_year_id === academicYearId,
    )
    .sort((left, right) => {
      const gradeComparison = compareLabels(left.grade_level, right.grade_level);

      if (gradeComparison !== 0) return gradeComparison;

      const nameComparison = compareLabels(left.name, right.name);

      if (nameComparison !== 0) return nameComparison;

      return compareLabels(left.shift, right.shift);
    });
}

export function isClassAtCapacity(classRecord: ClassRow): boolean {
  return (
    classRecord.capacity > 0 &&
    classRecord.active_enrollments_count >= classRecord.capacity
  );
}

/** Auto-select only when the choice is unambiguous and the class still has seats. */
export function getSuggestedClassId(classes: ClassRow[]): string {
  const availableClasses = classes.filter(
    (classRecord) => !isClassAtCapacity(classRecord),
  );

  return availableClasses.length === 1
    ? availableClasses[0].id
    : '';
}
