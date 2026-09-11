import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';

import { useSchoolScheduleBreaks } from '../hooks/useAcademicTermClosing';
import {
  useTeacherTimetable,
  useTimetableCalendarStatuses,
} from '../hooks/useTimetable';
import { getLocalDateInputValue } from '../lib/academicTermDates';
import {
  getWeekStartDateKey,
  getDateForWeekDay,
  projectTimetableOccurrences,
  shiftWeekStartDate,
} from '../lib/academic/timetableOccurrences';
import { normalizeAcademicShift } from '../lib/academic/academicShifts';
import WeeklyTimetableGrid from './academic/WeeklyTimetableGrid';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return 'Não foi possível carregar a grade de horário.';
}

export default function TeacherTimetableView({
  institutionId,
  teacherProfileId,
  termId,
  termName,
  termStartDate,
  termEndDate,
  shifts,
}: {
  institutionId: string;
  teacherProfileId: string;
  termId?: string;
  termName?: string | null;
  termStartDate?: string | null;
  termEndDate?: string | null;
  shifts: readonly (string | null)[];
}) {
  const timetableQuery = useTeacherTimetable(
    institutionId,
    teacherProfileId,
    termId,
  );
  const scheduleBreaksQuery = useSchoolScheduleBreaks(institutionId);
  const [weekStartDate, setWeekStartDate] = useState(() =>
    getWeekStartDateKey(getLocalDateInputValue()),
  );
  const entries = (timetableQuery.data ?? []).filter(
    (entry) => entry.active,
  );
  const calendarStatusQuery = useTimetableCalendarStatuses(
    institutionId,
    entries,
    weekStartDate,
    termStartDate,
    termEndDate,
  );

  if (timetableQuery.isLoading) {
    return (
      <div className="grid min-h-[400px] place-items-center rounded-xl border border-[#dfe3e8] bg-white">
        <div className="text-center">
          <div
            className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#dfe3e8] border-t-[#005bbf]"
            aria-hidden="true"
          />
          <p className="mt-4 text-sm font-medium text-[#727785]">
            Carregando sua grade de horário...
          </p>
        </div>
      </div>
    );
  }

  if (timetableQuery.isError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"
      >
        <h2 className="font-bold">Não foi possível carregar sua grade</h2>
        <p className="mt-2">{getErrorMessage(timetableQuery.error)}</p>
      </div>
    );
  }

  const teacherShifts = new Set(
    shifts
      .filter((shift): shift is string => Boolean(shift?.trim()))
      .map((shift) => normalizeAcademicShift(shift)),
  );
  const scheduleBreaks = (scheduleBreaksQuery.data ?? []).filter(
    (scheduleBreak) =>
      scheduleBreak.active &&
      teacherShifts.has(normalizeAcademicShift(scheduleBreak.shift)),
  );
  const occurrences = projectTimetableOccurrences(
    entries,
    weekStartDate,
    calendarStatusQuery.data,
    termStartDate,
    termEndDate,
  );
  const formatDate = (value: string) => {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
      id="teacher-timetable-main"
    >
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#dfe3e8]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#005bbf]">
              Grade de horário
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#181c20]">
              Minha grade de aulas
            </h1>
            <p className="mt-2 text-sm text-[#727785]">
              Horários publicados das turmas e disciplinas atribuídas a você.
            </p>
            {termName && (
              <p className="mt-3 text-sm font-medium text-[#005bbf]">
                Período atual: {termName}
                {termStartDate && termEndDate && (
                  <span className="font-normal text-[#727785]">
                    {' '}
                    ({formatDate(termStartDate)} a {formatDate(termEndDate)})
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#005bbf]">
            <CalendarClock className="h-6 w-6" aria-hidden="true" />
          </div>
        </div>
      </section>

      {entries.length === 0 ? (
        <div
          role="status"
          className="rounded-xl border border-dashed border-[#c1c6d6] bg-white p-8 text-center text-sm text-[#727785]"
        >
          Nenhuma aula publicada foi encontrada para suas atribuições.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dfe3e8] bg-white px-4 py-3 text-sm shadow-sm">
            <div>
              <p className="font-semibold text-[#181c20]">Semana exibida</p>
              <p className="text-xs text-[#727785]">
                {formatDate(weekStartDate)} a {formatDate(getDateForWeekDay(weekStartDate, 6))}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWeekStartDate((current) => shiftWeekStartDate(current, -1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#cbd5e1] text-[#005bbf] transition hover:bg-[#eef5ff] focus:outline-none focus:ring-2 focus:ring-[#1769c2]"
                aria-label="Semana anterior"
                title="Semana anterior"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setWeekStartDate(getWeekStartDateKey(getLocalDateInputValue()))}
                className="rounded-lg border border-[#cbd5e1] px-3 py-2 text-xs font-semibold text-[#005bbf] transition hover:bg-[#eef5ff] focus:outline-none focus:ring-2 focus:ring-[#1769c2]"
              >
                Semana atual
              </button>
              <button
                type="button"
                onClick={() => setWeekStartDate((current) => shiftWeekStartDate(current, 1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#cbd5e1] text-[#005bbf] transition hover:bg-[#eef5ff] focus:outline-none focus:ring-2 focus:ring-[#1769c2]"
                aria-label="Próxima semana"
                title="Próxima semana"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {calendarStatusQuery.isError && (
            <p
              role="status"
              className="rounded-lg border border-[#dfe3e8] bg-white px-4 py-2 text-xs text-[#727785]"
            >
              Não foi possível verificar o calendário. As aulas continuam visíveis.
            </p>
          )}

          <WeeklyTimetableGrid
            entries={entries}
            occurrences={occurrences}
            weekStartDate={weekStartDate}
            scheduleBreaks={scheduleBreaks}
            audience="teacher"
          />
        </>
      )}
    </motion.div>
  );
}
