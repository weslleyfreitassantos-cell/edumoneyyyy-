import {
  AlertTriangle,
  CalendarDays,
  Coffee,
  MapPin,
  UsersRound,
  Utensils,
} from 'lucide-react';

import type { TimetableEntryRow } from '../../services/timetableService';
import type { SchoolScheduleBreakRow } from '../../services/academicAutomationService';
import {
  getDateForWeekDay,
  getTimetableBlockerLabel,
  getWeekDayForDate,
  type TimetableOccurrence,
} from '../../lib/academic/timetableOccurrences';

type ScheduleBreak = Pick<
  SchoolScheduleBreakRow,
  'id' | 'name' | 'day_of_week' | 'start_time' | 'end_time'
>;

type TimetableItem =
  | { kind: 'lesson'; entry: TimetableEntryRow; occurrence?: TimetableOccurrence }
  | { kind: 'break'; scheduleBreak: ScheduleBreak };

const DAY_HEADER_CLASSES: Record<number, string> = {
  1: 'border-t-[#1769c2] bg-[#eef5ff] dark:border-t-[#60a5fa] dark:bg-[#1e3a5f]',
  2: 'border-t-[#087f72] bg-[#effbf8] dark:border-t-[#2dd4bf] dark:bg-[#123d3a]',
  3: 'border-t-[#b45309] bg-[#fff8eb] dark:border-t-[#f59e0b] dark:bg-[#452a0a]',
  4: 'border-t-[#6941c6] bg-[#f5f1ff] dark:border-t-[#a78bfa] dark:bg-[#34245c]',
  5: 'border-t-[#b4236d] bg-[#fff1f7] dark:border-t-[#f472b6] dark:bg-[#4a1d3a]',
  6: 'border-t-[#475569] bg-[#f1f5f9] dark:border-t-[#94a3b8] dark:bg-[#243244]',
};

const WEEK_DAYS = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
] as const;

function formatTime(value: string): string {
  return value.slice(0, 5);
}

function compareTime(left: string, right: string): number {
  return left.localeCompare(right);
}

function slotKey(day: number, startTime: string, endTime: string): string {
  return `${day}-${formatTime(startTime)}-${formatTime(endTime)}`;
}

function isLunch(scheduleBreak: ScheduleBreak): boolean {
  return /almo[cç]o/i.test(scheduleBreak.name);
}

function buildTimeSlots(
  entries: TimetableEntryRow[],
  scheduleBreaks: ScheduleBreak[],
): Array<{ startTime: string; endTime: string }> {
  const slots = new Map<string, { startTime: string; endTime: string }>();

  for (const item of [...entries, ...scheduleBreaks]) {
    const startTime = formatTime(item.start_time);
    const endTime = formatTime(item.end_time);
    slots.set(`${startTime}-${endTime}`, { startTime, endTime });
  }

  return Array.from(slots.values()).sort((left, right) =>
    compareTime(left.startTime, right.startTime) ||
    compareTime(left.endTime, right.endTime),
  );
}

function TimetableLessonCard({
  entry,
  occurrence,
  audience,
}: {
  entry: TimetableEntryRow;
  occurrence?: TimetableOccurrence;
  audience: 'student' | 'teacher';
}) {
  const secondaryLabel = audience === 'student' ? 'Professor' : 'Turma';
  const secondaryValue =
    audience === 'student'
      ? entry.teacher_name || 'Professor não informado'
      : entry.class_name || 'Turma não informada';

  return (
    <article className={`rounded-lg border bg-white p-2.5 shadow-sm transition hover:border-[#1769c2] hover:shadow-md dark:bg-[#18212f] dark:hover:border-[#60a5fa] ${
      occurrence?.state === 'SUSPENDED'
        ? 'border-[#f2c46d] dark:border-[#b45309]'
        : 'border-[#d8e0ec] dark:border-[#334155]'
    }`}>
      <div className="min-w-0">
        <h3
          className="break-words text-xs font-bold leading-4 text-[#181c20]"
          title={entry.subject_name || 'Disciplina não informada'}
        >
          {entry.subject_name || 'Disciplina não informada'}
        </h3>
        <p className="mt-1 break-words text-[11px] leading-4 text-[#667085]">
          <span>{secondaryLabel}: </span>
          <span>{secondaryValue}</span>
        </p>
      </div>

      {occurrence?.state === 'SUSPENDED' && (
        <div className="mt-2 rounded-md bg-[#fff8e7] px-2 py-1.5 text-[11px] font-bold text-[#8a4b08] dark:bg-[#451a03] dark:text-[#fcd34d]">
          <p>Aula suspensa</p>
          {getTimetableBlockerLabel(occurrence.calendarStatus) && (
            <p className="mt-0.5 font-medium">
              {getTimetableBlockerLabel(occurrence.calendarStatus)}
            </p>
          )}
        </div>
      )}

      {entry.room_name && (
        <p className="mt-2 flex min-w-0 items-center gap-1 text-[11px] leading-4 text-[#667085]">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="break-words">{entry.room_name}</span>
        </p>
      )}
    </article>
  );
}

function TimetableBreakCard({ scheduleBreak }: { scheduleBreak: ScheduleBreak }) {
  const Icon = isLunch(scheduleBreak) ? Utensils : Coffee;

  return (
    <article
      className="rounded-lg border border-[#f2c46d] bg-[#fff8e7] p-2.5 text-[#8a4b08] dark:border-[#b45309] dark:bg-[#451a03] dark:text-[#fcd34d]"
      data-testid="timetable-break"
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="break-words text-xs font-bold leading-4">
            {scheduleBreak.name}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-[#a15c0a] dark:text-[#fbbf24]">
            Pausa escolar
          </p>
        </div>
      </div>
    </article>
  );
}

export default function WeeklyTimetableGrid({
  entries,
  scheduleBreaks,
  audience,
  occurrences,
  weekStartDate,
}: {
  entries: TimetableEntryRow[];
  scheduleBreaks: ScheduleBreak[];
  audience: 'student' | 'teacher';
  occurrences?: TimetableOccurrence[];
  weekStartDate?: string;
}) {
  const lessonEntries = occurrences?.map((occurrence) => occurrence.entry) ?? entries;
  const timeSlots = buildTimeSlots(lessonEntries, scheduleBreaks);
  const lessonDays = occurrences
    ? occurrences.map((occurrence) => getWeekDayForDate(occurrence.date))
    : entries.map((entry) => entry.day_of_week);
  const dayCounts = new Map(
    WEEK_DAYS.map(({ value }) => [
      value,
      lessonDays.filter((day) => day === value).length,
    ]),
  );
  const itemsBySlot = new Map<string, TimetableItem[]>();

  for (const occurrence of occurrences ?? []) {
    const entry = occurrence.entry;
    const dayOfWeek = getWeekDayForDate(occurrence.date);
    const key = slotKey(dayOfWeek, entry.start_time, entry.end_time);
    const items = itemsBySlot.get(key) ?? [];
    items.push({ kind: 'lesson', entry, occurrence });
    itemsBySlot.set(key, items);
  }

  if (!occurrences) {
    for (const entry of entries) {
      const key = slotKey(entry.day_of_week, entry.start_time, entry.end_time);
      const items = itemsBySlot.get(key) ?? [];
      items.push({ kind: 'lesson', entry });
      itemsBySlot.set(key, items);
    }
  }

  for (const scheduleBreak of scheduleBreaks) {
    const key = slotKey(
      scheduleBreak.day_of_week,
      scheduleBreak.start_time,
      scheduleBreak.end_time,
    );
    const items = itemsBySlot.get(key) ?? [];
    items.push({ kind: 'break', scheduleBreak });
    itemsBySlot.set(key, items);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#d8e0ec] bg-white shadow-sm dark:border-[#334155] dark:bg-[#18212f]">
      <header className="flex flex-col gap-3 border-b border-[#e4e8f1] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-[#334155]">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1769c2]">
            Semana letiva
          </p>
          <h2 className="mt-1 text-base font-bold text-[#181c20]">
            Segunda a sábado
          </h2>
        </div>

        <div className="flex items-center gap-3 text-xs font-medium text-[#667085]">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-[#1769c2]" aria-hidden="true" />
            {entries.length} {entries.length === 1 ? 'aula' : 'aulas'}
          </span>
          <span className="hidden h-4 w-px bg-[#d8e0ec] sm:block" aria-hidden="true" />
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <UsersRound className="h-4 w-4 text-[#667085]" aria-hidden="true" />
            {audience === 'student' ? 'Sua turma' : 'Suas turmas'}
          </span>
        </div>
      </header>

      <div className="overflow-x-auto" aria-label="Grade semanal de horários">
        <div className="min-w-[1144px]">
          <div
            className="grid border-b border-[#d8e0ec] bg-[#f8faff] dark:border-[#334155] dark:bg-[#111827]"
            style={{ gridTemplateColumns: '88px repeat(6, minmax(176px, 1fr))' }}
            role="row"
            >
            <div
              className="flex items-center border-r border-[#d8e0ec] px-3 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#667085] dark:border-[#334155]"
              role="columnheader"
            >
              Horário
            </div>

            {WEEK_DAYS.map(({ value, label }) => (
              <div
                key={value}
                className={`border-t-4 border-r border-[#d8e0ec] px-3 py-2.5 last:border-r-0 dark:border-r-[#334155] ${DAY_HEADER_CLASSES[value]}`}
                role="columnheader"
              >
                <p className="text-sm font-bold text-[#181c20]">{label}</p>
                {weekStartDate && (
                  <p className="mt-0.5 text-[11px] font-medium text-[#667085]">
                    {new Intl.DateTimeFormat('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      timeZone: 'UTC',
                    }).format(new Date(`${getDateForWeekDay(weekStartDate, value)}T00:00:00.000Z`))}
                  </p>
                )}
                <p className="mt-0.5 text-[11px] text-[#667085]">
                  {dayCounts.get(value) ?? 0}{' '}
                  {(dayCounts.get(value) ?? 0) === 1 ? 'aula' : 'aulas'}
                </p>
              </div>
            ))}
          </div>

          {timeSlots.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-[#667085]">
              Nenhum horário publicado foi encontrado.
            </div>
          ) : (
            timeSlots.map((slot) => (
              <div
                key={`${slot.startTime}-${slot.endTime}`}
                className="grid min-h-[122px] border-b border-[#e4e8f1] last:border-b-0 dark:border-[#334155]"
                style={{ gridTemplateColumns: '88px repeat(6, minmax(176px, 1fr))' }}
                role="row"
              >
                <div
                  className="border-r border-[#d8e0ec] bg-[#fbfcfe] px-2 py-3 text-center dark:border-[#334155] dark:bg-[#111827]"
                  role="rowheader"
                >
                  <time className="block text-xs font-bold text-[#1769c2]">
                    {formatTime(slot.startTime)}
                  </time>
                  <span className="my-1 block text-[10px] text-[#98a2b3]">até</span>
                  <time className="block text-xs font-bold text-[#1769c2]">
                    {formatTime(slot.endTime)}
                  </time>
                </div>

                {WEEK_DAYS.map(({ value }) => {
                  const key = slotKey(value, slot.startTime, slot.endTime);
                  const items = itemsBySlot.get(key) ?? [];

                  return (
                    <div
                      key={key}
                      className="border-r border-[#e4e8f1] bg-white p-2 last:border-r-0 dark:border-[#334155] dark:bg-[#18212f]"
                      role="cell"
                    >
                      {items.length === 0 ? (
                        <span className="flex min-h-[96px] items-center justify-center text-xs text-[#c0c7d4] dark:text-[#64748b]">
                          —
                        </span>
                      ) : (
                        <div className="space-y-2">
                          {items.length > 1 && (
                            <p className="flex items-center gap-1 text-[10px] font-bold text-[#a15c0a] dark:text-[#fbbf24]">
                              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                              {items.length} itens no mesmo horário
                            </p>
                          )}
                          {items.map((item) =>
                            <div
                              key={
                                item.kind === 'break'
                                  ? `break-${item.scheduleBreak.id}`
                                  : item.entry.id
                              }
                            >
                              {item.kind === 'break' ? (
                                <TimetableBreakCard
                                  scheduleBreak={item.scheduleBreak}
                                />
                              ) : (
                                <TimetableLessonCard
                                  entry={item.entry}
                                  occurrence={item.occurrence}
                                  audience={audience}
                                />
                              )}
                            </div>,
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      <footer className="flex items-center gap-2 border-t border-[#e4e8f1] bg-[#fbfcfe] px-4 py-3 text-[11px] text-[#667085] sm:px-5 dark:border-[#334155] dark:bg-[#111827]">
        <Coffee className="h-3.5 w-3.5 text-[#a15c0a] dark:text-[#fbbf24]" aria-hidden="true" />
        Pausas e almoço aparecem na mesma linha do horário correspondente.
      </footer>
    </section>
  );
}
