import {
  getDateForWeekDay,
} from './timetableOccurrences';
import {
  getLocalDateInputValue,
  isAcademicTermDateWithinRange,
} from '../academicTermDates';

export interface StudentTimetableTermRange {
  id: string;
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  active?: boolean | null;
}

function getWeekDates(weekStartDate: string): string[] {
  return Array.from({ length: 6 }, (_, index) =>
    getDateForWeekDay(weekStartDate, index + 1),
  );
}

/** Selects the term that owns the displayed civil week without using array order. */
export function resolveStudentTimetableTerm<T extends StudentTimetableTermRange>(
  terms: readonly T[],
  weekStartDate: string,
  today = getLocalDateInputValue(),
): T | null {
  const weekDates = getWeekDates(weekStartDate);
  const candidates = terms
    .filter(
      (term) =>
        term.active !== false &&
        weekDates.some((date) =>
          isAcademicTermDateWithinRange(
            date,
            term.startDate,
            term.endDate,
          ),
        ),
    )
    .map((term) => ({
      term,
      overlap: weekDates.filter((date) =>
        isAcademicTermDateWithinRange(
          date,
          term.startDate,
          term.endDate,
        ),
      ).length,
    }));

  if (candidates.length === 0) {
    return null;
  }

  const todayCandidate = candidates.find(({ term }) =>
    isAcademicTermDateWithinRange(
      today,
      term.startDate,
      term.endDate,
    ),
  );

  if (todayCandidate) {
    return todayCandidate.term;
  }

  return [...candidates]
    .sort((left, right) => {
      if (left.overlap !== right.overlap) {
        return right.overlap - left.overlap;
      }

      return (right.term.startDate ?? '').localeCompare(
        left.term.startDate ?? '',
      );
    })[0]?.term ?? null;
}
