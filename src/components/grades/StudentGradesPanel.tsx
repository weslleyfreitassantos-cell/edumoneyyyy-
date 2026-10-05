import {
  BookMarked,
  CalendarDays,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { ListPagination, ListSearch, normalizeListSearch } from '../ListControls';
import { useStudentGradeSummary } from '../../hooks/useGrades';
import {
  ASSESSMENT_TYPE_LABELS,
  GRADE_STATUS_LABELS,
  formatAssessmentDate,
  formatScore,
  getGradeStatusClassName,
} from './gradeDisplay';
import GradeSummaryCard from './GradeSummaryCard';
import { getUserFacingErrorMessage } from '../../lib/userFacingError';

const PAGE_SIZE = 6;

function normalizeGradeSearch(value: string): string {
  return normalizeListSearch(value).replace(/\s+/g, ' ');
}

export default function StudentGradesPanel({
  institutionId,
  studentId,
  title = 'Avaliações e notas',
}: {
  institutionId: string | undefined;
  studentId: string | undefined;
  title?: string;
}) {
  const gradesQuery = useStudentGradeSummary(
    institutionId,
    studentId,
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setSearchTerm('');
    setCurrentPage(1);
  }, [studentId]);

  const records = gradesQuery.data?.records ?? [];
  const normalizedSearch = normalizeGradeSearch(searchTerm);
  const filteredRecords = useMemo(
    () => records.filter((record) => {
      if (!normalizedSearch) return true;
      const searchableText = normalizeGradeSearch(
        `${record.title} ${record.subjectName}`,
      );
      return searchableText.includes(normalizedSearch);
    }),
    [normalizedSearch, records],
  );
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const pageRecords = filteredRecords.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const setSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  return (
    <section className="rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-5 flex items-center gap-3">
        <BookMarked
          className="h-5 w-5 text-[#005bbf]"
          aria-hidden="true"
        />
        <h2 className="text-lg font-bold text-[#181c20] dark:text-white">
          {title}
        </h2>
      </div>

      {gradesQuery.isLoading && (
        <div role="status" aria-label="Carregando notas" className="rounded-lg border border-[#dfe3e8] p-5 text-sm text-[#727785] dark:border-slate-700 dark:text-slate-400">
          Carregando notas...
        </div>
      )}

      {gradesQuery.isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
        >
          <p>{getUserFacingErrorMessage(gradesQuery.error, 'Não foi possível carregar as notas. Tente novamente.')}</p>
          <button type="button" onClick={() => void gradesQuery.refetch()} className="mt-3 min-h-11 rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2">
            Tentar novamente
          </button>
        </div>
      )}

      {gradesQuery.data &&
        gradesQuery.data.records.length === 0 && (
          <div role="status" className="rounded-lg border border-dashed border-[#c1c6d6] p-6 text-center text-sm text-[#727785] dark:border-slate-700 dark:text-slate-400">
            Nenhuma avaliação publicada para este aluno.
          </div>
        )}

      {gradesQuery.data &&
        gradesQuery.data.records.length > 0 && (
          <div className="space-y-5">
            <GradeSummaryCard
              summary={gradesQuery.data.summary}
              variant="student"
            />

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#005bbf] dark:text-blue-300">
                Todas as avaliações
              </h3>

              <ListSearch
                id="student-grades-search"
                label="Buscar avaliação"
                placeholder="Nome da avaliação ou disciplina"
                value={searchTerm}
                onChange={setSearch}
              />

              {filteredRecords.length === 0 ? (
                <div role="status" className="mt-3 rounded-lg border border-dashed border-[#c1c6d6] p-6 text-center text-sm text-[#727785] dark:border-slate-700 dark:text-slate-400">
                  Nenhuma avaliação encontrada.
                </div>
              ) : (
                <div className="mt-3 divide-y divide-[#eef1f5] rounded-lg border border-[#dfe3e8] dark:divide-slate-700 dark:border-slate-700">
                  {pageRecords.map((record) => (
                    <div
                      key={record.assessmentId}
                      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-3 sm:flex-1">
                        <CalendarDays
                          className="mt-0.5 h-5 w-5 shrink-0 text-[#727785] dark:text-slate-400"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-[#181c20] dark:text-slate-100">
                            {record.title}
                          </p>
                          <p className="mt-1 break-words text-xs text-[#727785] dark:text-slate-400">
                            {record.subjectName} ·{' '}
                            {
                              ASSESSMENT_TYPE_LABELS[
                                record.assessmentType
                              ]
                            }{' '}
                            ·{' '}
                            {formatAssessmentDate(
                              record.assessmentDate,
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4 sm:min-w-[12rem] sm:justify-between">
                        <div>
                          <p className="text-xs font-medium text-[#727785] dark:text-slate-400">
                            Nota
                          </p>
                          <p className="text-sm font-semibold text-[#181c20] dark:text-slate-100">
                            {formatScore(record.score, record.maxScore)}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-xs font-medium text-[#727785] dark:text-slate-400">
                            Situação
                          </p>
                          <span
                            className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${getGradeStatusClassName(
                              record.status,
                            )}`}
                          >
                            {GRADE_STATUS_LABELS[record.status]}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {filteredRecords.length > 0 ? (
                <div className="mt-3">
                  <ListPagination
                    page={currentPage}
                    pageSize={PAGE_SIZE}
                    totalItems={filteredRecords.length}
                    onPageChange={setCurrentPage}
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}
    </section>
  );
}
