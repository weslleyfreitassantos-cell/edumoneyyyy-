import {
  calendarDateToUtcStart,
  nextCalendarDateKey,
  parseCalendarDate,
} from '../academicCalendarDates';
import { isAcademicTermDateWithinRange } from '../academicTermDates';
import type {
  AcademicDateBlocker,
  AcademicDateStatus,
  AcademicDateStatusContext,
} from '../academicCalendarStatus';
import type { TimetableEntryRow } from '../../services/timetableService';

export type TimetableOccurrenceState = 'SCHEDULED' | 'SUSPENDED';

export interface TimetableOccurrence {
  date: string;
  entry: TimetableEntryRow;
  state: TimetableOccurrenceState;
  calendarStatus: AcademicDateStatus;
}

export interface TimetableCalendarRequest {
  key: string;
  date: string;
  context: AcademicDateStatusContext;
}

export interface TimetableTermDateRange {
  termStartDate?: string | null;
  termEndDate?: string | null;
}

const BLOCKER_LABELS: Partial<Record<AcademicDateBlocker['event_type'], string>> = {
  HOLIDAY: 'Feriado',
  RECESS: 'Recesso',
  CLASS_SUSPENSION: 'Suspensão de aula',
};

export function getWeekStartDateKey(value: string): string {
  calendarDateToUtcStart(value);
  const date = parseCalendarDate(value);
  const dayOfWeek = date.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  for (let index = 0; index < daysSinceMonday; index += 1) {
    date.setUTCDate(date.getUTCDate() - 1);
  }

  return date.toISOString().slice(0, 10);
}

export function getDateForWeekDay(
  weekStartDate: string,
  dayOfWeek: number,
): string {
  calendarDateToUtcStart(weekStartDate);
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 6) {
    throw new Error('Informe um dia da semana válido.');
  }

  let date = weekStartDate;
  for (let day = 1; day < dayOfWeek; day += 1) {
    date = nextCalendarDateKey(date);
  }

  return date;
}

export function shiftWeekStartDate(
  weekStartDate: string,
  weeks: number,
): string {
  calendarDateToUtcStart(weekStartDate);
  const date = parseCalendarDate(weekStartDate);
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

export function getWeekDayForDate(value: string): number {
  calendarDateToUtcStart(value);
  const dayOfWeek = parseCalendarDate(value).getUTCDay();
  return dayOfWeek === 0 ? 7 : dayOfWeek;
}

export function timetableCalendarRequestKey(
  context: AcademicDateStatusContext,
  date: string,
): string {
  calendarDateToUtcStart(date);
  return [
    context.institutionId,
    date,
    context.academicYearId ?? '',
    context.classId ?? '',
    context.subjectId ?? '',
  ].join('|');
}

export function isTimetableDateWithinTerm(
  date: string,
  termStartDate?: string | null,
  termEndDate?: string | null,
): boolean {
  if (!termStartDate || !termEndDate) {
    return true;
  }

  return isAcademicTermDateWithinRange(date, termStartDate, termEndDate);
}

export function buildTimetableCalendarRequests(
  entries: readonly TimetableEntryRow[],
  weekStartDate: string,
  termStartDate?: string | null,
  termEndDate?: string | null,
): TimetableCalendarRequest[] {
  const requests = new Map<string, TimetableCalendarRequest>();

  for (const entry of entries) {
    if (!entry.active || entry.day_of_week < 1 || entry.day_of_week > 6) {
      continue;
    }

    const date = getDateForWeekDay(weekStartDate, entry.day_of_week);
    if (!isTimetableDateWithinTerm(date, termStartDate, termEndDate)) {
      continue;
    }

    const context: AcademicDateStatusContext = {
      institutionId: entry.institution_id,
      academicYearId: entry.academic_year_id,
      classId: entry.class_id,
      subjectId: entry.subject_id,
    };
    const key = timetableCalendarRequestKey(context, date);

    if (!requests.has(key)) {
      requests.set(key, { key, date, context });
    }
  }

  return Array.from(requests.values()).sort((left, right) =>
    left.key.localeCompare(right.key),
  );
}

export function projectTimetableOccurrence(
  entry: TimetableEntryRow,
  date: string,
  calendarStatus: AcademicDateStatus,
): TimetableOccurrence {
  calendarDateToUtcStart(date);

  return {
    date,
    entry,
    state: calendarStatus.blocked ? 'SUSPENDED' : 'SCHEDULED',
    calendarStatus,
  };
}

export function projectTimetableOccurrences(
  entries: readonly TimetableEntryRow[],
  weekStartDate: string,
  statuses: Readonly<Record<string, AcademicDateStatus>> = {},
  termStartDate?: string | null,
  termEndDate?: string | null,
): TimetableOccurrence[] {
  calendarDateToUtcStart(weekStartDate);

  return entries
    .filter((entry) => entry.active && entry.day_of_week >= 1 && entry.day_of_week <= 6)
    .map((entry) => {
      const date = getDateForWeekDay(weekStartDate, entry.day_of_week);
      if (!isTimetableDateWithinTerm(date, termStartDate, termEndDate)) {
        return null;
      }

      const context: AcademicDateStatusContext = {
        institutionId: entry.institution_id,
        academicYearId: entry.academic_year_id,
        classId: entry.class_id,
        subjectId: entry.subject_id,
      };
      const key = timetableCalendarRequestKey(context, date);
      const calendarStatus = statuses[key] ?? {
        date,
        state: 'OPEN' as const,
        blocked: false,
        blockers: [],
      };

      return projectTimetableOccurrence(entry, date, calendarStatus);
    })
    .filter((occurrence): occurrence is TimetableOccurrence => occurrence !== null);
}

export function getTimetableBlockerLabel(
  status: AcademicDateStatus,
): string | null {
  const labels = status.blockers
    .map((blocker) => BLOCKER_LABELS[blocker.event_type])
    .filter((label): label is string => Boolean(label));

  return labels.length > 0 ? labels.join(' • ') : null;
}
