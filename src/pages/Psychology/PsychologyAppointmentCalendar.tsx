import { useEffect, useState } from 'react';

type AvailableDate = {
  date: string;
  slotCount: number;
};

type PsychologyAppointmentCalendarProps = {
  availableDates: AvailableDate[];
  selectedDate: string;
  initialMonth: string;
  minDate: string;
  maxDate: string;
  onSelectDate: (date: string) => void;
};

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function monthKeyFromDate(dateKey: string): string {
  return dateKey.slice(0, 7);
}

function shiftMonth(monthKey: string, offset: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatMonth(monthKey: string): string {
  const date = new Date(`${monthKey}-15T12:00:00Z`);
  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
  return label.charAt(0).toLocaleUpperCase('pt-BR') + label.slice(1);
}

function formatDate(dateKey: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

export default function PsychologyAppointmentCalendar({
  availableDates,
  selectedDate,
  initialMonth,
  minDate,
  maxDate,
  onSelectDate,
}: PsychologyAppointmentCalendarProps) {
  const [visibleMonth, setVisibleMonth] = useState(initialMonth);
  useEffect(() => setVisibleMonth(initialMonth), [initialMonth]);
  const firstMonth = monthKeyFromDate(minDate);
  const lastMonth = monthKeyFromDate(maxDate);
  const slotCountByDate = new Map(availableDates.map(({ date, slotCount }) => [date, slotCount]));

  const [year, month] = visibleMonth.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingDays = (firstDay.getUTCDay() + 6) % 7;
  const cells = [
    ...Array.from({ length: leadingDays }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  return (
    <section
      aria-label="Calendário de horários disponíveis"
      className="max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="Mês anterior"
          disabled={visibleMonth <= firstMonth}
          onClick={() => setVisibleMonth((current) => shiftMonth(current, -1))}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-300 text-lg font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <span aria-hidden="true">‹</span>
        </button>
        <h3 aria-live="polite" className="text-center text-base font-bold text-slate-900 dark:text-white">
          {formatMonth(visibleMonth)}
        </h3>
        <button
          type="button"
          aria-label="Próximo mês"
          disabled={visibleMonth >= lastMonth}
          onClick={() => setVisibleMonth((current) => shiftMonth(current, 1))}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-300 text-lg font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1" aria-hidden="true">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
            {weekday}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1" role="group" aria-label={formatMonth(visibleMonth)}>
        {cells.map((day, index) => {
          if (day === null) return <span key={`empty-${index}`} aria-hidden="true" />;

          const date = `${visibleMonth}-${String(day).padStart(2, '0')}`;
          const slotCount = slotCountByDate.get(date) ?? 0;
          const inRange = date >= minDate && date <= maxDate;
          const selected = date === selectedDate;
          const today = date === minDate;

          return (
            <button
              key={date}
              type="button"
              disabled={!inRange || slotCount === 0}
              aria-label={`${formatDate(date)}, ${slotCount ? `${slotCount} ${slotCount === 1 ? 'horário disponível' : 'horários disponíveis'}` : 'sem horários disponíveis'}`}
              aria-pressed={selected}
              aria-current={today ? 'date' : undefined}
              onClick={() => onSelectDate(date)}
              className={`flex aspect-square min-h-10 flex-col items-center justify-center rounded-xl text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                selected
                  ? 'bg-blue-700 font-bold text-white shadow-sm'
                  : slotCount > 0 && inRange
                    ? 'font-semibold text-blue-900 hover:bg-blue-50 dark:text-blue-100 dark:hover:bg-blue-950/60'
                    : 'cursor-not-allowed text-slate-300 dark:text-slate-700'
              }`}
            >
              <span>{day}</span>
              {slotCount > 0 && inRange ? (
                <span className={`text-[10px] leading-3 ${selected ? 'text-blue-100' : 'text-emerald-700 dark:text-emerald-300'}`}>
                  {slotCount} {slotCount === 1 ? 'horário' : 'horários'}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-slate-600 dark:text-slate-400">
        Os dias destacados têm horários livres. Selecione um dia para ver os horários.
      </p>
    </section>
  );
}
