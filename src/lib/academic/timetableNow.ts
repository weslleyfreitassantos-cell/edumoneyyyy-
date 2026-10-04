import { getLocalDateInputValue } from '../academicTermDates';

export interface TimetableNowSnapshot {
  date: string;
  dayOfWeek: number;
  minutes: number;
  timeLabel: string;
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return Number.NaN;
  }

  return hours * 60 + minutes;
}

export function getTimetableNowSnapshot(
  now: Date = new Date(),
): TimetableNowSnapshot {
  const day = now.getDay();
  const dayOfWeek = day === 0 ? 7 : day;
  const hours = now.getHours();
  const minutes = now.getMinutes();

  return {
    date: getLocalDateInputValue(now),
    dayOfWeek,
    minutes: hours * 60 + minutes,
    timeLabel: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
  };
}

export function isTimetableTimeWithinRange(
  currentMinutes: number,
  startTime: string,
  endTime: string,
): boolean {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  return Number.isFinite(currentMinutes)
    && Number.isFinite(startMinutes)
    && Number.isFinite(endMinutes)
    && startMinutes <= currentMinutes
    && currentMinutes < endMinutes;
}

export function getTimetableNowOffsetPercent(
  currentMinutes: number,
  startTime: string,
  endTime: string,
): number | null {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  if (
    !isTimetableTimeWithinRange(currentMinutes, startTime, endTime)
    || endMinutes <= startMinutes
  ) {
    return null;
  }

  return ((currentMinutes - startMinutes) / (endMinutes - startMinutes)) * 100;
}
