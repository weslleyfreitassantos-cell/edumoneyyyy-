import { CalendarDays, Clock3 } from 'lucide-react';

import { useUpcomingAcademicCalendarEvents } from '../hooks/useAcademicCalendar';
import type { AcademicCalendarEvent } from '../services/academicCalendarService';

function formatEventDate(event: AcademicCalendarEvent): string {
  const starts = new Date(event.starts_at);
  const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(starts);

  if (event.all_day) return `${date} • Dia inteiro`;

  return `${date} • ${new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(starts)}`;
}

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
    <section aria-labelledby="upcoming-academic-events-title" className="space-y-4">
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
        <div className="grid gap-3 md:grid-cols-2">
          {events.map((event) => (
            <article key={event.id} className="rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#005bbf]">
                  <Clock3 className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-[#181c20] dark:text-white">{event.title}</h3>
                  <p className="mt-1 text-xs text-[#667085] dark:text-slate-400">{formatEventDate(event)}</p>
                  {event.description && <p className="mt-2 line-clamp-2 text-sm text-[#414754] dark:text-slate-300">{event.description}</p>}
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
