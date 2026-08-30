import { Coffee, Utensils } from 'lucide-react';

import type { SchoolScheduleBreakRow } from '../../services/academicAutomationService';

export default function TimetableBreakMarker({
  scheduleBreak,
}: {
  scheduleBreak: Pick<
    SchoolScheduleBreakRow,
    'name' | 'start_time' | 'end_time'
  >;
}) {
  const isLunch = /almo[cç]o/i.test(scheduleBreak.name);
  const Icon = isLunch ? Utensils : Coffee;

  return (
    <div
      className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs"
      data-testid="timetable-break"
    >
      <div className="w-24 shrink-0 font-bold text-amber-800">
        <time>{scheduleBreak.start_time.slice(0, 5)}</time>
        <span className="mx-1 text-amber-500">-</span>
        <time>{scheduleBreak.end_time.slice(0, 5)}</time>
      </div>
      <div className="flex min-w-0 items-start gap-2 text-amber-900">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-bold">{scheduleBreak.name}</p>
          <p className="mt-0.5 text-amber-700">Pausa escolar</p>
        </div>
      </div>
    </div>
  );
}
