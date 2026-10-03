import { useStudentReportCard } from '../../hooks/useAcademicTermClosing';
import ReportCardView from './ReportCardView';

interface StudentReportCardProps {
  institutionId: string | undefined;
  studentId: string | undefined;
  studentName?: string;
  className?: string;
}

export default function StudentReportCard({
  institutionId,
  studentId,
  studentName,
  className,
}: StudentReportCardProps) {
  const query = useStudentReportCard(institutionId, studentId);
  const reportCard = query.data;

  if (query.isLoading) {
    return <div role="status" className="rounded-lg border border-dashed border-[#c1c6d6] p-6 text-sm text-[#727785] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">Carregando boletim escolar...</div>;
  }

  if (query.isError) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
        <p>Não foi possível carregar o boletim agora.</p>
        <button type="button" onClick={() => void query.refetch()} className="mt-3 min-h-11 rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2">
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!reportCard || reportCard.subjects.length === 0) {
    return <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">Nenhum resultado acadêmico disponível no momento.</div>;
  }

  return (
    <ReportCardView
      reportCard={reportCard}
      studentName={studentName}
      className={className}
    />
  );
}
