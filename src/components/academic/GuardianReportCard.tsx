import { useState, useMemo } from 'react';
import { useGuardianReportCards } from '../../hooks/useAcademicTermClosing';
import { getResultBadgeClass, getResultStatusLabel, formatPercent } from './academicDisplay';
import type { StudentReportCard } from '../../services/reportCardService';

interface GuardianReportCardProps {
  institutionId: string | undefined;
  studentIds: string[];
  selectedStudentId: string | undefined;
}

export default function GuardianReportCard({ institutionId, studentIds, selectedStudentId }: GuardianReportCardProps) {
  const query = useGuardianReportCards(institutionId, studentIds);
  const reportCards = query.data ?? [];

  const selectedReportCard = reportCards.find(rc => rc.studentId === selectedStudentId);

  return (
    <div className="space-y-6">
      {query.isLoading && (
        <div className="rounded-lg border border-dashed border-[#c1c6d6] p-6 text-sm text-[#727785]">
          Carregando boletins...
        </div>
      )}

      {query.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Não foi possível carregar os boletins.
        </div>
      )}

      {!query.isLoading && !query.isError && selectedReportCard && selectedStudentId && (
        <ReportCardDisplay reportCard={selectedReportCard} />
      )}
      
      {!query.isLoading && !query.isError && !selectedReportCard && selectedStudentId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Nenhum resultado acadêmico disponível para este estudante.
        </div>
      )}
    </div>
  );
}

function ReportCardDisplay({ reportCard }: { reportCard: StudentReportCard }) {
  if (reportCard.subjects.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        Nenhum resultado acadêmico disponível no momento.
      </div>
    );
  }

  // Agrupar por ano letivo e depois por período
  const groupedByYearAndTerm = reportCard.subjects.reduce((acc, subject) => {
    const yearKey = subject.academicYearName;
    const termKey = subject.termName;
    if (!acc[yearKey]) acc[yearKey] = {};
    if (!acc[yearKey][termKey]) acc[yearKey][termKey] = [];
    acc[yearKey][termKey].push(subject);
    return acc;
  }, {} as Record<string, Record<string, typeof reportCard.subjects>>);

  return (
    <div className="space-y-8">
      {Object.entries(groupedByYearAndTerm).map(([yearName, terms]) => (
        <div key={yearName} className="space-y-6">
          <h2 className="text-xl font-bold text-[#181c20]">{yearName}</h2>
          
          {Object.entries(terms).map(([termName, subjects]) => (
            <div key={termName} className="rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-[#181c20]">{termName}</h3>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#dfe3e8] text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-[#727785]">
                    <tr>
                      <th className="px-4 py-3">Disciplina</th>
                      <th className="px-4 py-3">Professor</th>
                      <th className="px-4 py-3">Média</th>
                      <th className="px-4 py-3">Frequência</th>
                      <th className="px-4 py-3">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf0f3] bg-white">
                    {subjects.map((subject) => (
                      <tr key={subject.key}>
                        <td className="px-4 py-3 font-semibold text-[#181c20]">
                          {subject.subjectName}
                        </td>
                        <td className="px-4 py-3 text-[#727785]">
                          {subject.teacherName}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#181c20]">
                          {subject.isClosed ? formatPercent(subject.gradePercentage) : '-'}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#181c20]">
                          {subject.isClosed ? formatPercent(subject.attendancePercentage) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          {!subject.isClosed || subject.resultStatus === 'PENDING' ? (
                            <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600">
                              Resultado ainda não fechado
                            </span>
                          ) : (
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getResultBadgeClass(subject.resultStatus)}`}>
                              {getResultStatusLabel(subject.resultStatus)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
