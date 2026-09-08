import { CalendarClock } from 'lucide-react';
import { motion } from 'motion/react';

import { useSchoolScheduleBreaks } from '../hooks/useAcademicTermClosing';
import { useTeacherTimetable } from '../hooks/useTimetable';
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
  shifts,
}: {
  institutionId: string;
  teacherProfileId: string;
  termId?: string;
  shifts: readonly (string | null)[];
}) {
  const timetableQuery = useTeacherTimetable(
    institutionId,
    teacherProfileId,
    termId,
  );
  const scheduleBreaksQuery = useSchoolScheduleBreaks(institutionId);

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

  const entries = (timetableQuery.data ?? []).filter(
    (entry) => entry.active,
  );
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
        <WeeklyTimetableGrid
          entries={entries}
          scheduleBreaks={scheduleBreaks}
          audience="teacher"
        />
      )}
    </motion.div>
  );
}
