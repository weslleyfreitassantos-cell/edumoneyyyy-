import {
  calendarDateToUtcStart,
  calendarEventDateKeys,
} from './academicCalendarDates';
import type {
  AcademicCalendarEvent,
  AcademicCalendarEventType,
} from '../services/academicCalendarService';

export const ACADEMIC_DATE_BLOCKING_EVENT_TYPES = [
  'HOLIDAY',
  'RECESS',
  'CLASS_SUSPENSION',
] as const satisfies readonly AcademicCalendarEventType[];

export type AcademicDateStatusState = 'OPEN' | 'BLOCKED';

export interface AcademicDateStatusContext {
  institutionId: string;
  academicYearId?: string | null;
  classId?: string | null;
  subjectId?: string | null;
}

export interface AcademicDateBlocker {
  event_id: string;
  event_type: AcademicCalendarEventType;
}

export interface AcademicDateStatus {
  date: string;
  state: AcademicDateStatusState;
  blocked: boolean;
  blockers: AcademicDateBlocker[];
}

const blockerOrder = new Map<AcademicCalendarEventType, number>(
  ACADEMIC_DATE_BLOCKING_EVENT_TYPES.map((eventType, index) => [eventType, index]),
);

function isBlockingEventType(
  eventType: AcademicCalendarEventType,
): eventType is (typeof ACADEMIC_DATE_BLOCKING_EVENT_TYPES)[number] {
  return ACADEMIC_DATE_BLOCKING_EVENT_TYPES.includes(eventType as never);
}

function matchesOptionalScope(
  eventValue: string | null,
  contextValue: string | null | undefined,
): boolean {
  return eventValue === null || eventValue === contextValue;
}

function validateContext(context: AcademicDateStatusContext): void {
  if (!context.institutionId.trim()) {
    throw new Error('A instituição é obrigatória para consultar o status da data.');
  }
}

function sortBlockers(blockers: AcademicDateBlocker[]): AcademicDateBlocker[] {
  return [...blockers].sort((left, right) => {
    const typeOrder = (blockerOrder.get(left.event_type) ?? Number.MAX_SAFE_INTEGER)
      - (blockerOrder.get(right.event_type) ?? Number.MAX_SAFE_INTEGER);

    return typeOrder || left.event_id.localeCompare(right.event_id);
  });
}

export function createAcademicDateStatus(
  date: string,
  blockers: AcademicDateBlocker[],
): AcademicDateStatus {
  calendarDateToUtcStart(date);
  const orderedBlockers = sortBlockers(blockers);

  return {
    date,
    state: orderedBlockers.length > 0 ? 'BLOCKED' : 'OPEN',
    blocked: orderedBlockers.length > 0,
    blockers: orderedBlockers,
  };
}

export function resolveAcademicDateStatus(
  date: string,
  events: Array<Pick<
    AcademicCalendarEvent,
    | 'id'
    | 'institution_id'
    | 'academic_year_id'
    | 'event_type'
    | 'starts_at'
    | 'ends_at'
    | 'all_day'
    | 'class_id'
    | 'subject_id'
    | 'active'
  >>,
  context: AcademicDateStatusContext,
): AcademicDateStatus {
  calendarDateToUtcStart(date);
  validateContext(context);

  const blockers = events
    .filter((event) => (
      event.institution_id === context.institutionId
      && event.active
      && event.all_day
      && isBlockingEventType(event.event_type)
      && calendarEventDateKeys({
        startsAt: event.starts_at,
        endsAt: event.ends_at,
        allDay: event.all_day,
      }).includes(date)
      && matchesOptionalScope(event.academic_year_id, context.academicYearId)
      && matchesOptionalScope(event.class_id, context.classId)
      && matchesOptionalScope(event.subject_id, context.subjectId)
    ))
    .map((event) => ({
      event_id: event.id,
      event_type: event.event_type,
    }));

  return createAcademicDateStatus(date, blockers);
}
