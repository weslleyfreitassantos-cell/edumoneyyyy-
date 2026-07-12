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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Não foi possível carregar a frequência.';
}

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
    <section className="rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <ClipboardCheck
          className="h-5 w-5 text-[#005bbf]"
          aria-hidden="true"
        />
        <h2 className="text-lg font-bold text-[#181c20]">
          {title}
        </h2>
      </div>

      {attendanceQuery.isLoading && (
        <div className="rounded-lg border border-[#dfe3e8] p-5 text-sm text-[#727785]">
          Carregando frequência...
        </div>
      )}

      {attendanceQuery.isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {getErrorMessage(attendanceQuery.error)}
        </div>
      )}

      {attendanceQuery.data &&
        attendanceQuery.data.summary.totalRecords === 0 && (
          <div className="rounded-lg border border-dashed border-[#c1c6d6] p-6 text-center text-sm text-[#727785]">
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
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#005bbf]">
                Registros recentes
              </h3>

              <div className="mt-3 divide-y divide-[#eef1f5] rounded-lg border border-[#dfe3e8]">
                {attendanceQuery.data.recentRecords.map(
                  (record) => (
                    <div
                      key={record.id}
                      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <CalendarDays
                          className="mt-0.5 h-5 w-5 text-[#727785]"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="text-sm font-semibold text-[#181c20]">
                            {record.subjectName}
                          </p>
                          <p className="mt-1 text-xs text-[#727785]">
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
