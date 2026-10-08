import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { useInstitution } from '../contexts/InstitutionContext';
import { useStudentAcademicCalendar } from '../hooks/useAcademicCalendar';
import {
  calendarEventDateKeys,
  formatCalendarEventDate,
} from '../lib/academicCalendarDates';
import type {
  AcademicCalendarAudience,
  AcademicCalendarEvent,
  AcademicCalendarEventType,
} from '../services/academicCalendarService';

const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const eventTypeLabels: Record<AcademicCalendarEventType, string> = {
  HOLIDAY: 'Feriado',
  RECESS: 'Recesso',
  SCHOOL_EVENT: 'Evento escolar',
  MEETING: 'Reunião',
  ASSESSMENT: 'Avaliação / prova',
  CLASS_SUSPENSION: 'Suspensão de aula',
  OTHER: 'Outro evento',
};

const audienceLabels: Record<AcademicCalendarAudience, string> = {
  ALL: 'Todos',
  STUDENTS: 'Alunos',
  GUARDIANS: 'Responsáveis',
  TEACHERS: 'Professores',
  STAFF: 'Equipe escolar',
  CLASS: 'Sua turma',
};

const eventTypeStyles: Record<AcademicCalendarEventType, string> = {
  HOLIDAY: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200',
  RECESS: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/70 dark:bg-violet-950/40 dark:text-violet-200',
  SCHOOL_EVENT: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-200',
  MEETING: 'border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900/70 dark:bg-cyan-950/40 dark:text-cyan-200',
  ASSESSMENT: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/70 dark:bg-orange-950/40 dark:text-orange-200',
  CLASS_SUSPENSION: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-200',
  OTHER: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
};

const eventTypeDotStyles: Record<AcademicCalendarEventType, string> = {
  HOLIDAY: 'bg-amber-500',
  RECESS: 'bg-violet-500',
  SCHOOL_EVENT: 'bg-blue-500',
  MEETING: 'bg-cyan-500',
  ASSESSMENT: 'bg-orange-500',
  CLASS_SUSPENSION: 'bg-rose-500',
  OTHER: 'bg-slate-400',
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function fullDateLabel(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function monthCells(date: Date): Array<Date | null> {
  const firstDayOffset = (new Date(date.getFullYear(), date.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = Array.from({ length: firstDayOffset }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(date.getFullYear(), date.getMonth(), day));
  }

  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function sortEvents(events: AcademicCalendarEvent[]): AcademicCalendarEvent[] {
  return [...events].sort((left, right) => left.starts_at.localeCompare(right.starts_at));
}

function EventDetails({ event }: { event: AcademicCalendarEvent }) {
  return (
    <article className={`rounded-xl border p-4 ${eventTypeStyles[event.event_type]}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${eventTypeDotStyles[event.event_type]}`} aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="font-bold">{event.title}</h3>
          <p className="mt-1 flex items-start gap-1.5 text-xs font-semibold opacity-90">
            <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{formatCalendarEventDate({ startsAt: event.starts_at, endsAt: event.ends_at, allDay: event.all_day })}</span>
          </p>
          <p className="mt-1 text-xs opacity-80">
            {eventTypeLabels[event.event_type]} · {audienceLabels[event.audience]}
            {event.class_name ? ` · ${event.class_name}` : ''}
            {event.subject_name ? ` · ${event.subject_name}` : ''}
          </p>
          {event.description ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 opacity-90">{event.description}</p> : null}
        </div>
      </div>
    </article>
  );
}

export default function StudentCalendarPage() {
  const { currentInstitutionId } = useInstitution();
  const eventsQuery = useStudentAcademicCalendar(currentInstitutionId);
  const today = new Date();
  const todayKey = dateKey(today);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayKey);

  const events = useMemo(() => sortEvents(eventsQuery.data ?? []), [eventsQuery.data]);
  const cells = useMemo(() => monthCells(month), [month]);
  const eventsByDate = useMemo(() => {
    const result = new Map<string, AcademicCalendarEvent[]>();

    for (const event of events) {
      for (const key of calendarEventDateKeys({
        startsAt: event.starts_at,
        endsAt: event.ends_at,
        allDay: event.all_day,
      })) {
        result.set(key, sortEvents([...(result.get(key) ?? []), event]));
      }
    }

    return result;
  }, [events]);
  const selectedEvents = eventsByDate.get(selectedDate) ?? [];
  const currentMonthEvents = useMemo(() => {
    const ids = new Set<string>();

    for (const [key, dayEvents] of eventsByDate) {
      if (key.startsWith(monthKey(month))) {
        for (const event of dayEvents) ids.add(event.id);
      }
    }

    return ids.size;
  }, [eventsByDate, month]);

  function changeMonth(offset: number): void {
    setMonth((current) => {
      const next = new Date(current.getFullYear(), current.getMonth() + offset, 1);
      setSelectedDate(dateKey(next));
      return next;
    });
  }

  function goToToday(): void {
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(todayKey);
  }

  return (
    <div className="w-full min-w-0 space-y-6 overflow-x-hidden">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#005bbf]">Acadêmico</p>
          <h1 className="mt-2 text-2xl font-extrabold text-[#181c20] dark:text-white sm:text-3xl">Calendário escolar</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085] dark:text-slate-400">Consulte todos os eventos disponíveis para você, incluindo compromissos de outros meses.</p>
        </div>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#005bbf] dark:bg-blue-950/50 dark:text-blue-200">
          <CalendarDays className="h-6 w-6" aria-hidden="true" />
        </div>
      </header>

      {eventsQuery.isLoading ? (
        <div className="grid min-h-72 place-items-center rounded-2xl border border-[#dfe3e8] bg-white p-8 text-sm text-[#667085] shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">Carregando calendário escolar...</div>
      ) : eventsQuery.isError ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">Não foi possível carregar o calendário escolar agora.</div>
      ) : (
        <>
          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.75fr)]">
            <section aria-labelledby="student-calendar-month-title" className="min-w-0 rounded-2xl border border-[#dfe3e8] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 id="student-calendar-month-title" className="capitalize font-extrabold text-[#181c20] dark:text-white">{monthLabel(month)}</h2>
                  <p className="mt-1 text-sm text-[#667085] dark:text-slate-400">{currentMonthEvents} {currentMonthEvents === 1 ? 'evento neste mês' : 'eventos neste mês'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => changeMonth(-1)} aria-label="Mês anterior" className="rounded-lg border border-[#cfd6e2] p-2 text-[#414754] transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button>
                  <button type="button" onClick={goToToday} className="rounded-lg border border-[#cfd6e2] px-3 py-2 text-sm font-bold text-[#005bbf] transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] dark:border-slate-600 dark:hover:bg-blue-950/40">Hoje</button>
                  <button type="button" onClick={() => changeMonth(1)} aria-label="Próximo mês" className="rounded-lg border border-[#cfd6e2] p-2 text-[#414754] transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"><ChevronRight className="h-5 w-5" aria-hidden="true" /></button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-7 overflow-hidden rounded-xl border border-[#dfe3e8] dark:border-slate-700" role="grid" aria-label={`Calendário de ${monthLabel(month)}`}>
                {weekdays.map((weekday) => <div key={weekday} role="columnheader" className="border-b border-[#dfe3e8] bg-slate-50 p-2 text-center text-[11px] font-bold uppercase text-[#667085] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">{weekday}</div>)}
                {cells.map((date, index) => {
                  if (!date) return <div key={`empty-${index}`} className="min-h-24 border-b border-r border-[#dfe3e8] bg-slate-50/40 dark:border-slate-700 dark:bg-slate-950/20 sm:min-h-28" aria-hidden="true" />;

                  const key = dateKey(date);
                  const dayEvents = eventsByDate.get(key) ?? [];
                  const isSelected = key === selectedDate;
                  const isToday = key === todayKey;

                  return (
                    <button
                      key={key}
                      type="button"
                      role="gridcell"
                      aria-label={`${date.getDate()} de ${monthLabel(date)}${dayEvents.length ? `, ${dayEvents.length} evento(s)` : ''}`}
                      aria-pressed={isSelected}
                      onClick={() => setSelectedDate(key)}
                      className={`min-h-24 min-w-0 border-b border-r border-[#dfe3e8] p-1.5 text-left align-top transition hover:bg-blue-50/60 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#005bbf] dark:border-slate-700 dark:hover:bg-blue-950/30 sm:min-h-28 sm:p-2 ${isSelected ? 'bg-blue-50/70 dark:bg-blue-950/30' : 'bg-white dark:bg-slate-900'}`}
                    >
                      <span className={`inline-grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${isToday ? 'bg-[#005bbf] text-white' : 'text-[#667085] dark:text-slate-400'}`}>{date.getDate()}</span>
                      <span className="mt-1 block space-y-1">
                        {dayEvents.slice(0, 2).map((event) => <span key={event.id} className={`block truncate rounded border px-1 py-1 text-[10px] font-semibold leading-tight ${eventTypeStyles[event.event_type]}`}>{event.title}</span>)}
                        {dayEvents.length > 2 ? <span className="block px-1 text-[10px] font-semibold text-[#667085] dark:text-slate-400">+{dayEvents.length - 2} evento(s)</span> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="student-calendar-day-title" className="min-w-0 rounded-2xl border border-[#dfe3e8] bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="border-b border-[#dfe3e8] pb-4 dark:border-slate-700">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">Agenda do dia</p>
                <h2 id="student-calendar-day-title" className="mt-2 capitalize font-extrabold text-[#181c20] dark:text-white">{fullDateLabel(selectedDate)}</h2>
              </div>
              <div className="mt-4 space-y-3">
                {selectedEvents.length ? selectedEvents.map((event) => <div key={event.id}><EventDetails event={event} /></div>) : <div className="rounded-xl border border-dashed border-[#cfd6e2] p-6 text-center text-sm text-[#667085] dark:border-slate-600 dark:text-slate-400">Nenhum evento neste dia.</div>}
              </div>
            </section>
          </div>

          <section aria-labelledby="student-calendar-all-events-title" className="rounded-2xl border border-[#dfe3e8] bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#dfe3e8] p-5 dark:border-slate-700">
              <div>
                <h2 id="student-calendar-all-events-title" className="font-extrabold text-[#181c20] dark:text-white">Todos os eventos</h2>
                <p className="mt-1 text-sm text-[#667085] dark:text-slate-400">Eventos publicados para você, sem limitar ao mês atual.</p>
              </div>
              <span className="text-sm font-bold text-[#005bbf] dark:text-blue-300">{events.length} {events.length === 1 ? 'evento' : 'eventos'}</span>
            </div>
            {events.length ? <div className="grid gap-3 p-5 md:grid-cols-2">{events.map((event) => <div key={event.id}><EventDetails event={event} /></div>)}</div> : <p className="p-8 text-center text-sm text-[#667085] dark:text-slate-400">Nenhum evento escolar publicado para você.</p>}
          </section>
        </>
      )}
    </div>
  );
}
