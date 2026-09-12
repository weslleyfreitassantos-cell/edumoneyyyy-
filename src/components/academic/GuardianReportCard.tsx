import { useGuardianReportCards } from '../../hooks/useAcademicTermClosing';
import ReportCardView from './ReportCardView';

interface GuardianReportCardProps {
  institutionId: string | undefined;
  studentIds: string[];
  selectedStudentId: string | undefined;
  studentName?: string;
  className?: string;
}

export default function GuardianReportCard({
  institutionId,
  studentIds,
  selectedStudentId,
  studentName,
  className,
}: GuardianReportCardProps) {
  const query = useGuardianReportCards(institutionId, studentIds);
  const reportCards = query.data ?? [];

  const selectedReportCard = reportCards.find(rc => rc.studentId === selectedStudentId);

  return (
    <div className="space-y-6">
      {query.isLoading && (
        <div role="status" className="rounded-lg border border-dashed border-[#c1c6d6] p-6 text-sm text-[#727785] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          Carregando boletins...
        </div>
      )}

      {query.isError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
          Não foi possível carregar os boletins.
        </div>
      )}

      {!query.isLoading && !query.isError && selectedReportCard && selectedStudentId && (
        selectedReportCard.subjects.length > 0 ? (
          <ReportCardView
            reportCard={selectedReportCard}
            studentName={studentName}
            className={className}
          />
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            Nenhum resultado acadêmico disponível para este estudante.
          </div>
        )
      )}
      
      {!query.isLoading && !query.isError && !selectedReportCard && selectedStudentId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          Nenhum resultado acadêmico disponível para este estudante.
        </div>
      )}
    </div>
  );
}
