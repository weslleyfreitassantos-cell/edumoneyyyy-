const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type CalendarEventDateInput = {
  startsAt: string;
  endsAt?: string | null;
  allDay: boolean;
};

function isCalendarDate(value: string): boolean {
  return CALENDAR_DATE_PATTERN.test(value);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function localDateKey(value: string, timeZone?: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);

  if (timeZone) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone,
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseCalendarDate(value: string): Date {
  if (isCalendarDate(value)) {
    return new Date(`${value}T00:00:00.000Z`);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Informe uma data válida para o evento.');
  }

  return date;
}

export function calendarDateKey(
  value: string,
  allDay = false,
  timeZone?: string,
): string {
  if (allDay || isCalendarDate(value)) return value.slice(0, 10);
  return localDateKey(value, timeZone);
}

export function calendarDateToUtcStart(value: string): string {
  if (!isCalendarDate(value)) {
    throw new Error('Informe uma data civil válida.');
  }

  return `${value}T00:00:00.000Z`;
}

export function nextCalendarDateKey(value: string): string {
  const date = parseCalendarDate(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function calendarEventDateKeys({
  startsAt,
  endsAt,
  allDay,
}: CalendarEventDateInput): string[] {
  const startKey = calendarDateKey(startsAt, allDay);
  const endKey = endsAt ? calendarDateKey(endsAt, allDay) : startKey;
  const keys: string[] = [];
  let current = startKey;

  while (current <= endKey) {
    keys.push(current);
    const next = nextCalendarDateKey(current);
    if (next === current) break;
    current = next;
  }

  return keys;
}

function formatDateKey(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parseCalendarDate(value));
}

function formatLocalDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parseCalendarDate(value));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeStyle: 'short',
  }).format(parseCalendarDate(value));
}

export function formatCalendarEventDate({
  startsAt,
  endsAt,
  allDay,
}: CalendarEventDateInput): string {
  if (allDay) {
    const starts = calendarDateKey(startsAt, true);
    const ends = endsAt ? calendarDateKey(endsAt, true) : starts;
    const dateRange = starts === ends
      ? formatDateKey(starts)
      : `${formatDateKey(starts)}–${formatDateKey(ends)}`;

    return `${dateRange} • Dia inteiro`;
  }

  const startDate = formatLocalDate(startsAt);
  const startTime = formatTime(startsAt);
  if (!endsAt) return `${startDate} • ${startTime}`;

  const endDate = formatLocalDate(endsAt);
  const endTime = formatTime(endsAt);
  if (startDate === endDate) {
    return `${startDate} • ${startTime}–${endTime}`;
  }

  return `${startDate} ${startTime} → ${endDate} ${endTime}`;
}

export function isCalendarEventUpcoming(
  event: Pick<CalendarEventDateInput, 'startsAt' | 'endsAt' | 'allDay'>,
  now = Date.now(),
): boolean {
  if (event.allDay) {
    const todayKey = calendarDateKey(new Date(now).toISOString());
    const startKey = calendarDateKey(event.startsAt, true);
    const endKey = event.endsAt
      ? calendarDateKey(event.endsAt, true)
      : startKey;

    return endKey >= todayKey;
  }

  const startsAt = parseCalendarDate(event.startsAt).getTime();
  const endsAt = event.endsAt ? parseCalendarDate(event.endsAt).getTime() : null;

  return startsAt >= now || (endsAt !== null && endsAt >= now);
}
