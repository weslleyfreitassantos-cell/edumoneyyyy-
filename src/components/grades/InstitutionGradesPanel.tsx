import {
  useMemo,
  useState,
} from 'react';
import {
  FilterX,
  GraduationCap,
} from 'lucide-react';

import { useInstitutionGradeSummary } from '../../hooks/useGrades';
import {
  formatAssessmentDate,
  formatPercent,
  getMonthStartDateInputValue,
  getTodayDateInputValue,
} from './gradeDisplay';
import GradeSummaryCard from './GradeSummaryCard';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Não foi possível carregar resultados.';
}

export default function InstitutionGradesPanel({
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
  const [termId, setTermId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherProfileId, setTeacherProfileId] =
    useState('');
  const [studentId, setStudentId] = useState('');

  const filters = useMemo(
    () => ({
      fromDate,
      toDate,
      termId: termId || undefined,
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
      termId,
      toDate,
    ],
  );

  const gradesQuery = useInstitutionGradeSummary(
    institutionId,
    filters,
  );

  const options = gradesQuery.data?.filters;

  const clearFilters = () => {
    setTermId('');
    setClassId('');
    setSubjectId('');
    setTeacherProfileId('');
    setStudentId('');
  };

  return (
    <section className="rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <GraduationCap
            className="h-5 w-5 text-[#005bbf]"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-lg font-bold text-[#181c20]">
              Resultados acadêmicos
            </h2>
            <p className="mt-1 text-sm text-[#727785]">
              Avaliações e notas lançadas no período.
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        <div>
          <label
            htmlFor="grades-from-date"
            className="text-xs font-bold uppercase tracking-wide text-[#727785]"
          >
            Início
          </label>
          <input
            id="grades-from-date"
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
            htmlFor="grades-to-date"
            className="text-xs font-bold uppercase tracking-wide text-[#727785]"
          >
            Fim
          </label>
          <input
            id="grades-to-date"
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
            htmlFor="grades-term-filter"
            className="text-xs font-bold uppercase tracking-wide text-[#727785]"
          >
            Período
          </label>
          <select
            id="grades-term-filter"
            value={termId}
            onChange={(event) =>
              setTermId(event.target.value)
            }
            className="mt-1 w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Todos</option>
            {options?.terms.map((option) => (
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
            htmlFor="grades-class-filter"
            className="text-xs font-bold uppercase tracking-wide text-[#727785]"
          >
            Turma
          </label>
          <select
            id="grades-class-filter"
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
            htmlFor="grades-subject-filter"
            className="text-xs font-bold uppercase tracking-wide text-[#727785]"
          >
            Disciplina
          </label>
          <select
            id="grades-subject-filter"
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
            htmlFor="grades-teacher-filter"
            className="text-xs font-bold uppercase tracking-wide text-[#727785]"
          >
            Professor
          </label>
          <select
            id="grades-teacher-filter"
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
            htmlFor="grades-student-filter"
            className="text-xs font-bold uppercase tracking-wide text-[#727785]"
          >
            Aluno
          </label>
          <select
            id="grades-student-filter"
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
        {gradesQuery.isLoading && (
          <div className="rounded-lg border border-[#dfe3e8] p-5 text-sm text-[#727785]">
            Carregando avaliações...
          </div>
        )}

        {gradesQuery.isError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {getErrorMessage(gradesQuery.error)}
          </div>
        )}

        {gradesQuery.data &&
          gradesQuery.data.assessments.length === 0 && (
            <div className="rounded-lg border border-dashed border-[#c1c6d6] p-6 text-center text-sm text-[#727785]">
              Nenhuma avaliação encontrada no período.
            </div>
          )}

        {gradesQuery.data &&
          gradesQuery.data.assessments.length > 0 && (
            <div className="space-y-5">
              <GradeSummaryCard
                summary={gradesQuery.data.summary}
              />

              <div className="overflow-hidden rounded-lg border border-[#dfe3e8]">
                <div className="hidden grid-cols-[0.8fr_1.3fr_0.9fr_0.7fr_0.7fr] gap-3 bg-[#f7f9fc] px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#727785] lg:grid">
                  <span>Data</span>
                  <span>Avaliação</span>
                  <span>Professor</span>
                  <span>Lançadas</span>
                  <span>Média</span>
                </div>

                <div className="divide-y divide-[#eef1f5]">
                  {gradesQuery.data.assessments.map(
                    (result) => (
                      <article
                        key={result.assessment.id}
                        className="grid gap-3 px-4 py-4 lg:grid-cols-[0.8fr_1.3fr_0.9fr_0.7fr_0.7fr] lg:items-center"
                      >
                        <p className="text-sm font-semibold text-[#181c20]">
                          {formatAssessmentDate(
                            result.assessment
                              .assessmentDate,
                          )}
                        </p>

                        <div>
                          <p className="text-sm font-semibold text-[#181c20]">
                            {result.assessment.title}
                          </p>
                          <p className="mt-1 text-xs text-[#727785]">
                            {
                              result.assessment.offering
                                ?.subjectName
                            }{' '}
                            ·{' '}
                            {
                              result.assessment.offering
                                ?.className
                            }
                          </p>
                        </div>

                        <p className="text-sm text-[#181c20]">
                          {
                            result.assessment.offering
                              ?.teacherName
                          }
                        </p>

                        <p className="text-sm text-[#181c20]">
                          {result.launchedCount}
                        </p>

                        <div>
                          <p className="text-sm font-bold text-[#181c20]">
                            {formatPercent(
                              result.averagePercent,
                            )}
                          </p>
                          <p className="mt-1 text-xs text-[#727785]">
                            {result.missingCount} pendentes
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
