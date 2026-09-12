import { Printer } from 'lucide-react';

import type {
  ReportCardSubjectResult,
  StudentReportCard,
} from '../../services/reportCardService';
import {
  formatPercent,
  getResultBadgeClass,
  getResultStatusLabel,
} from './academicDisplay';

interface ReportCardViewProps {
  reportCard: StudentReportCard;
  studentName?: string;
  className?: string;
}

function groupSubjects(
  subjects: readonly ReportCardSubjectResult[],
) {
  return subjects.reduce(
    (groups, subject) => {
      const year = groups[subject.academicYearName] ?? {};
      const term = year[subject.termName] ?? [];

      groups[subject.academicYearName] = {
        ...year,
        [subject.termName]: [...term, subject],
      };

      return groups;
    },
    {} as Record<string, Record<string, ReportCardSubjectResult[]>>,
  );
}

export default function ReportCardView({
  reportCard,
  studentName,
  className,
}: ReportCardViewProps) {
  const groupedByYearAndTerm = groupSubjects(reportCard.subjects);

  return (
    <section
      className="report-card-printable space-y-6 rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      aria-label="Boletim acadêmico"
    >
      <header className="flex flex-col gap-4 border-b border-[#dfe3e8] pb-5 dark:border-slate-700 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#005bbf]">
            Resultados acadêmicos
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[#181c20] dark:text-white">
            Boletim escolar
          </h2>
          <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-[#727785] dark:text-slate-400">
                Aluno
              </dt>
              <dd className="font-semibold text-[#181c20] dark:text-slate-100">
                {studentName ?? 'Aluno'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-[#727785] dark:text-slate-400">
                Turma
              </dt>
              <dd className="font-semibold text-[#181c20] dark:text-slate-100">
                {className ?? 'Não informada'}
              </dd>
            </div>
          </dl>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-[#cfd6e2] px-3 py-2 text-sm font-semibold text-[#005bbf] transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-[#005bbf] focus:ring-offset-2 dark:border-slate-600 dark:text-blue-300 dark:hover:bg-slate-800 print:hidden"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          Imprimir boletim
        </button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900/60 dark:bg-blue-950/30">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">
            Resultados em acompanhamento
          </p>
          <p className="mt-1 text-lg font-bold text-blue-900 dark:text-blue-100">
            {reportCard.openCount}
          </p>
          <p className="text-xs text-blue-800 dark:text-blue-200">
            Resultado parcial, sujeito ao fechamento do período.
          </p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Resultados oficiais
          </p>
          <p className="mt-1 text-lg font-bold text-emerald-900 dark:text-emerald-100">
            {reportCard.closedCount}
          </p>
          <p className="text-xs text-emerald-800 dark:text-emerald-200">
            Resultado consolidado no fechamento acadêmico.
          </p>
        </div>
      </div>

      {Object.entries(groupedByYearAndTerm).map(
        ([yearName, terms]) => (
          <div key={yearName} className="space-y-5">
            <h3 className="text-xl font-bold text-[#181c20] dark:text-white">
              Ano letivo: {yearName}
            </h3>

            {Object.entries(terms).map(
              ([termName, subjects]) => {
                const isOfficial = subjects.every(
                  (subject) => subject.isClosed,
                );

                return (
                  <article
                    key={termName}
                    className="rounded-xl border border-[#dfe3e8] dark:border-slate-700"
                  >
                    <div className="flex flex-col gap-2 border-b border-[#dfe3e8] p-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
                      <h4 className="text-lg font-semibold text-[#181c20] dark:text-slate-100">
                        {termName}
                      </h4>
                      <span
                        className={
                          isOfficial
                            ? 'inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300'
                            : 'inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300'
                        }
                      >
                        {isOfficial ? 'Resultado oficial' : 'Resultado parcial'}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-[700px] divide-y divide-[#dfe3e8] text-sm dark:divide-slate-700">
                        <thead className="bg-[#f7f9fc] text-left text-xs font-semibold uppercase tracking-wide text-[#727785] dark:bg-slate-800 dark:text-slate-400">
                          <tr>
                            <th className="px-4 py-3">Disciplina</th>
                            <th className="px-4 py-3">Professor</th>
                            <th className="px-4 py-3">Média</th>
                            <th className="px-4 py-3">Frequência</th>
                            <th className="px-4 py-3">Situação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#edf0f3] dark:divide-slate-800">
                          {subjects.map((subject) => (
                            <tr key={subject.key}>
                              <td className="px-4 py-3 font-semibold text-[#181c20] dark:text-slate-100">
                                {subject.subjectName}
                              </td>
                              <td className="px-4 py-3 text-[#727785] dark:text-slate-400">
                                {subject.teacherName}
                              </td>
                              <td className="px-4 py-3 font-medium text-[#181c20] dark:text-slate-100">
                                {subject.isClosed
                                  ? formatPercent(subject.gradePercentage)
                                  : 'Parcial'}
                              </td>
                              <td className="px-4 py-3 font-medium text-[#181c20] dark:text-slate-100">
                                {subject.isClosed
                                  ? formatPercent(subject.attendancePercentage)
                                  : 'Parcial'}
                              </td>
                              <td className="px-4 py-3">
                                {!subject.isClosed ||
                                subject.resultStatus === 'PENDING' ? (
                                  <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                                    Resultado ainda não fechado
                                  </span>
                                ) : (
                                  <span
                                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getResultBadgeClass(subject.resultStatus)}`}
                                  >
                                    {getResultStatusLabel(subject.resultStatus)}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        ),
      )}
    </section>
  );
}
