import {
  CalendarDays,
  ClipboardCheck,
} from 'lucide-react';

import { useStudentAttendanceSummary } from '../../hooks/useAttendance';
import {
  ATTENDANCE_STATUS_LABELS,
  formatAttendanceDate,
  getAttendanceStatusClassName,
} from './attendanceDisplay';
import AttendanceSummaryCard from './AttendanceSummaryCard';
import { getUserFacingErrorMessage } from '../../lib/userFacingError';

export default function StudentAttendanceSummaryPanel({
  institutionId,
  studentId,
  title = 'Frequência',
}: {
  institutionId: string | undefined;
  studentId: string | undefined;
  title?: string;
}) {
  const attendanceQuery =
    useStudentAttendanceSummary(
      institutionId,
      studentId,
    );

  return (
    <section className="rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-5 flex items-center gap-3">
        <ClipboardCheck
          className="h-5 w-5 text-[#005bbf]"
          aria-hidden="true"
        />
        <h2 className="text-lg font-bold text-[#181c20] dark:text-white">
          {title}
        </h2>
      </div>

      {attendanceQuery.isLoading && (
        <div role="status" aria-label="Carregando frequência" className="rounded-lg border border-[#dfe3e8] p-5 text-sm text-[#727785] dark:border-slate-700 dark:text-slate-400">
          Carregando frequência...
        </div>
      )}

      {attendanceQuery.isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
        >
          <p>{getUserFacingErrorMessage(attendanceQuery.error, 'Não foi possível carregar a frequência. Tente novamente.')}</p>
          <button type="button" onClick={() => void attendanceQuery.refetch()} className="mt-3 min-h-11 rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2">
            Tentar novamente
          </button>
        </div>
      )}

      {attendanceQuery.data &&
        attendanceQuery.data.summary.totalRecords === 0 && (
          <div role="status" className="rounded-lg border border-dashed border-[#c1c6d6] p-6 text-center text-sm text-[#727785] dark:border-slate-700 dark:text-slate-400">
            Nenhum registro de frequência publicado.
          </div>
        )}

      {attendanceQuery.data &&
        attendanceQuery.data.summary.totalRecords > 0 && (
          <div className="space-y-5">
            <AttendanceSummaryCard
              summary={attendanceQuery.data.summary}
            />

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#005bbf] dark:text-blue-300">
                Registros recentes
              </h3>

              <div className="mt-3 divide-y divide-[#eef1f5] rounded-lg border border-[#dfe3e8] dark:divide-slate-700 dark:border-slate-700">
                {attendanceQuery.data.recentRecords.map(
                  (record) => (
                    <div
                      key={record.id}
                      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <CalendarDays
                          className="mt-0.5 h-5 w-5 shrink-0 text-[#727785] dark:text-slate-400"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-[#181c20] dark:text-slate-100">
                            {record.subjectName}
                          </p>
                          <p className="mt-1 break-words text-xs text-[#727785] dark:text-slate-400">
                            {record.className} ·{' '}
                            {formatAttendanceDate(
                              record.sessionDate,
                            )}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${getAttendanceStatusClassName(
                          record.status,
                        )}`}
                      >
                        {
                          ATTENDANCE_STATUS_LABELS[
                            record.status
                          ]
                        }
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        )}
    </section>
  );
}
