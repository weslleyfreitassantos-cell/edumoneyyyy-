import { CalendarDays, Clock3 } from 'lucide-react';

import { useUpcomingAcademicCalendarEvents } from '../hooks/useAcademicCalendar';
import { formatCalendarEventDate } from '../lib/academicCalendarDates';

export default function UpcomingAcademicEvents({
  institutionId,
  role,
}: {
  institutionId: string | null;
  role: 'student' | 'guardian' | 'teacher';
}) {
  const eventsQuery = useUpcomingAcademicCalendarEvents(institutionId, 'ALL');
  const events = eventsQuery.data ?? [];

  return (
    <section aria-labelledby="upcoming-academic-events-title" className="min-w-0 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-[#005bbf]" aria-hidden="true" />
        <h2 id="upcoming-academic-events-title" className="text-lg font-bold text-[#181c20] dark:text-white">Próximos eventos</h2>
      </div>

      {eventsQuery.isLoading ? (
        <div className="rounded-xl border border-dashed border-[#c1c6d6] bg-white p-6 text-sm text-[#727785] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">Carregando eventos...</div>
      ) : eventsQuery.isError ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-[#727785] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">Os eventos do calendário estão temporariamente indisponíveis.</div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#c1c6d6] bg-white p-6 text-sm text-[#727785] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">Nenhum evento próximo cadastrado.</div>
      ) : (
        <div
          role="region"
          aria-label="Próximos eventos. No celular, deslize horizontalmente para consultar outros eventos."
          tabIndex={0}
          className="flex min-w-0 snap-x snap-mandatory items-stretch gap-3 overflow-x-auto overscroll-x-contain pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#005bbf] sm:grid sm:grid-cols-2 sm:overflow-visible sm:snap-none"
        >
          {events.map((event) => (
            <article key={event.id} className="w-[min(80vw,24rem)] min-w-0 flex-none snap-start rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:w-auto sm:min-w-0">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#005bbf]">
                  <Clock3 className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="break-words font-bold text-[#181c20] dark:text-white">{event.title}</h3>
                  <p className="mt-1 text-xs text-[#667085] dark:text-slate-400">{formatCalendarEventDate({ startsAt: event.starts_at, endsAt: event.ends_at, allDay: event.all_day })}</p>
                  {event.description && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#414754] dark:text-slate-300">{event.description}</p>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <span className="sr-only">Eventos compatíveis com o perfil de {role === 'student' ? 'aluno' : role === 'guardian' ? 'responsável' : 'professor'}.</span>
    </section>
  );
}
