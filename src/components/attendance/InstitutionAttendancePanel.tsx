import {
  useMemo,
  useState,
} from 'react';
import {
  ClipboardList,
  FilterX,
} from 'lucide-react';

import { useInstitutionAttendanceSummary } from '../../hooks/useAttendance';
import {
  formatAttendanceDate,
  formatAttendanceRate,
  getMonthStartDateInputValue,
  getTodayDateInputValue,
} from './attendanceDisplay';
import AttendanceSummaryCard from './AttendanceSummaryCard';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Não foi possível carregar a frequência institucional.';
}

export default function InstitutionAttendancePanel({
  institutionId,
}: {
  institutionId: string | undefined;
}) {
  const [fromDate, setFromDate] = useState(
    getMonthStartDateInputValue,
  );
  const [toDate, setToDate] = useState(
    getTodayDateInputValue,
  );
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherProfileId, setTeacherProfileId] =
    useState('');
  const [studentId, setStudentId] = useState('');

  const filters = useMemo(
    () => ({
      fromDate,
      toDate,
      classId: classId || undefined,
      subjectId: subjectId || undefined,
      teacherProfileId:
        teacherProfileId || undefined,
      studentId: studentId || undefined,
    }),
    [
      classId,
      fromDate,
      studentId,
      subjectId,
      teacherProfileId,
      toDate,
    ],
  );

  const attendanceQuery =
    useInstitutionAttendanceSummary(
      institutionId,
      filters,
    );

  const clearFilters = () => {
    setClassId('');
    setSubjectId('');
    setTeacherProfileId('');
    setStudentId('');
  };

  const options = attendanceQuery.data?.filters;

  return (
    <section className="rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList
            className="h-5 w-5 text-[#005bbf]"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-lg font-bold text-[#181c20]">
              Frequência institucional
            </h2>
            <p className="mt-1 text-sm text-[#727785]">
              Sessões registradas no período selecionado.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex w-fit items-center justify-center gap-2 rounded-lg border border-[#c8d4e3] px-3 py-2 text-sm font-semibold text-[#005bbf] transition-colors hover:bg-blue-50"
        >
          <FilterX
            className="h-4 w-4"
            aria-hidden="true"
          />
          Limpar filtros
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div>
          <label
            htmlFor="attendance-from-date"
            className="text-xs font-bold uppercase tracking-wide text-[#727785]"
          >
            Início
          </label>
          <input
            id="attendance-from-date"
            type="date"
            value={fromDate}
            onChange={(event) =>
              setFromDate(event.target.value)
            }
            className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label
            htmlFor="attendance-to-date"
            className="text-xs font-bold uppercase tracking-wide text-[#727785]"
          >
            Fim
          </label>
          <input
            id="attendance-to-date"
            type="date"
            value={toDate}
            onChange={(event) =>
              setToDate(event.target.value)
            }
            className="mt-1 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label
            htmlFor="attendance-class-filter"
            className="text-xs font-bold uppercase tracking-wide text-[#727785]"
          >
            Turma
          </label>
          <select
            id="attendance-class-filter"
            value={classId}
            onChange={(event) =>
              setClassId(event.target.value)
            }
            className="mt-1 w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Todas</option>
            {options?.classes.map((option) => (
              <option
                key={option.id}
                value={option.id}
              >
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="attendance-subject-filter"
            className="text-xs font-bold uppercase tracking-wide text-[#727785]"
          >
            Disciplina
          </label>
          <select
            id="attendance-subject-filter"
            value={subjectId}
            onChange={(event) =>
              setSubjectId(event.target.value)
            }
            className="mt-1 w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Todas</option>
            {options?.subjects.map((option) => (
              <option
                key={option.id}
                value={option.id}
              >
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="attendance-teacher-filter"
            className="text-xs font-bold uppercase tracking-wide text-[#727785]"
          >
            Professor
          </label>
          <select
            id="attendance-teacher-filter"
            value={teacherProfileId}
            onChange={(event) =>
              setTeacherProfileId(
                event.target.value,
              )
            }
            className="mt-1 w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Todos</option>
            {options?.teachers.map((option) => (
              <option
                key={option.id}
                value={option.id}
              >
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="attendance-student-filter"
            className="text-xs font-bold uppercase tracking-wide text-[#727785]"
          >
            Aluno
          </label>
          <select
            id="attendance-student-filter"
            value={studentId}
            onChange={(event) =>
              setStudentId(event.target.value)
            }
            className="mt-1 w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Todos</option>
            {options?.students.map((option) => (
              <option
                key={option.id}
                value={option.id}
              >
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5">
        {attendanceQuery.isLoading && (
          <div className="rounded-lg border border-[#dfe3e8] p-5 text-sm text-[#727785]">
            Carregando sessões...
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
          attendanceQuery.data.sessions.length === 0 && (
            <div className="rounded-lg border border-dashed border-[#c1c6d6] p-6 text-center text-sm text-[#727785]">
              Nenhuma sessão de frequência encontrada.
            </div>
          )}

        {attendanceQuery.data &&
          attendanceQuery.data.sessions.length > 0 && (
            <div className="space-y-5">
              <AttendanceSummaryCard
                summary={attendanceQuery.data.summary}
              />

              <div className="overflow-hidden rounded-lg border border-[#dfe3e8]">
                <div className="hidden grid-cols-[0.8fr_1.3fr_0.9fr_0.7fr_0.7fr] gap-3 bg-[#f7f9fc] px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#727785] lg:grid">
                  <span>Data</span>
                  <span>Atribuição</span>
                  <span>Professor</span>
                  <span>Registros</span>
                  <span>Presença</span>
                </div>

                <div className="divide-y divide-[#eef1f5]">
                  {attendanceQuery.data.sessions.map(
                    (session) => (
                      <article
                        key={session.id}
                        className="grid gap-3 px-4 py-4 lg:grid-cols-[0.8fr_1.3fr_0.9fr_0.7fr_0.7fr] lg:items-center"
                      >
                        <p className="text-sm font-semibold text-[#181c20]">
                          {formatAttendanceDate(
                            session.sessionDate,
                          )}
                        </p>

                        <div>
                          <p className="text-sm font-semibold text-[#181c20]">
                            {
                              session.offering
                                .subjectName
                            }
                          </p>
                          <p className="mt-1 text-xs text-[#727785]">
                            {session.offering.className}
                          </p>
                        </div>

                        <p className="text-sm text-[#181c20]">
                          {session.offering.teacherName}
                        </p>

                        <p className="text-sm text-[#181c20]">
                          {session.summary.totalRecords}
                        </p>

                        <div>
                          <p className="text-sm font-bold text-[#181c20]">
                            {formatAttendanceRate(
                              session.summary,
                            )}
                          </p>
                          <p className="mt-1 text-xs text-[#727785]">
                            {session.summary.presentRecords}{' '}
                            presentes ·{' '}
                            {session.summary.absentRecords}{' '}
                            ausentes
                          </p>
                        </div>
                      </article>
                    ),
                  )}
                </div>
              </div>
            </div>
          )}
      </div>
    </section>
  );
}
