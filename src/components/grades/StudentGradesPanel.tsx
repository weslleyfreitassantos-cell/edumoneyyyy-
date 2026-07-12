import {
  BookMarked,
  CalendarDays,
} from 'lucide-react';

import { useStudentGradeSummary } from '../../hooks/useGrades';
import {
  ASSESSMENT_TYPE_LABELS,
  GRADE_STATUS_LABELS,
  formatAssessmentDate,
  formatPercent,
  formatScore,
  getGradeStatusClassName,
} from './gradeDisplay';
import GradeSummaryCard from './GradeSummaryCard';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Não foi possível carregar as notas.';
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

  return (
    <section className="rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <BookMarked
          className="h-5 w-5 text-[#005bbf]"
          aria-hidden="true"
        />
        <h2 className="text-lg font-bold text-[#181c20]">
          {title}
        </h2>
      </div>

      {gradesQuery.isLoading && (
        <div className="rounded-lg border border-[#dfe3e8] p-5 text-sm text-[#727785]">
          Carregando notas...
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
        gradesQuery.data.records.length === 0 && (
          <div className="rounded-lg border border-dashed border-[#c1c6d6] p-6 text-center text-sm text-[#727785]">
            Nenhuma avaliação publicada para este aluno.
          </div>
        )}

      {gradesQuery.data &&
        gradesQuery.data.records.length > 0 && (
          <div className="space-y-5">
            <GradeSummaryCard
              summary={gradesQuery.data.summary}
            />

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#005bbf]">
                Registros recentes
              </h3>

              <div className="mt-3 divide-y divide-[#eef1f5] rounded-lg border border-[#dfe3e8]">
                {gradesQuery.data.recentRecords.map(
                  (record) => (
                    <div
                      key={record.assessmentId}
                      className="grid gap-3 p-4 lg:grid-cols-[1.3fr_0.8fr_0.7fr_0.7fr] lg:items-center"
                    >
                      <div className="flex items-start gap-3">
                        <CalendarDays
                          className="mt-0.5 h-5 w-5 text-[#727785]"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="text-sm font-semibold text-[#181c20]">
                            {record.title}
                          </p>
                          <p className="mt-1 text-xs text-[#727785]">
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

                      <p className="text-sm font-semibold text-[#181c20]">
                        {formatScore(
                          record.score,
                          record.maxScore,
                        )}
                      </p>

                      <p className="text-sm text-[#181c20]">
                        {formatPercent(record.percentage)}
                      </p>

                      <span
                        className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${getGradeStatusClassName(
                          record.status,
                        )}`}
                      >
                        {GRADE_STATUS_LABELS[record.status]}
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
