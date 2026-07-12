import {
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

import type { TermClosurePreview } from '../../services/termClosingService';
import {
  formatPercent,
  getResultBadgeClass,
  getResultStatusLabel,
} from './academicDisplay';

interface TermClosurePreviewTableProps {
  preview: TermClosurePreview;
}

export default function TermClosurePreviewTable({
  preview,
}: TermClosurePreviewTableProps) {
  const visibleIssues = preview.issues.slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[#dfe3e8] p-4">
          <p className="text-xs font-medium text-[#727785]">
            Alunos
          </p>
          <p className="mt-1 text-xl font-bold text-[#181c20]">
            {preview.students.length}
          </p>
        </div>

        <div className="rounded-lg border border-[#dfe3e8] p-4">
          <p className="text-xs font-medium text-[#727785]">
            Avaliacoes
          </p>
          <p className="mt-1 text-xl font-bold text-[#181c20]">
            {preview.assessments.length}
          </p>
        </div>

        <div className="rounded-lg border border-[#dfe3e8] p-4">
          <p className="text-xs font-medium text-[#727785]">
            Pendencias
          </p>
          <p className="mt-1 text-xl font-bold text-[#181c20]">
            {preview.issues.length}
          </p>
        </div>
      </div>

      {preview.issues.length === 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2
            className="mt-0.5 h-4 w-4"
            aria-hidden="true"
          />
          A oferta esta pronta para o proximo passo do fechamento.
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="flex items-start gap-2 font-semibold">
            <AlertTriangle
              className="mt-0.5 h-4 w-4"
              aria-hidden="true"
            />
            Pendencias encontradas
          </div>
          <ul className="mt-3 space-y-2">
            {visibleIssues.map((issue) => (
              <li
                key={`${issue.code}-${issue.studentId ?? 'global'}-${issue.assessmentId ?? issue.message}`}
              >
                {issue.message}
              </li>
            ))}
          </ul>
          {preview.issues.length > visibleIssues.length && (
            <p className="mt-3 text-xs">
              Mais {preview.issues.length - visibleIssues.length}{' '}
              pendencias ocultas nesta visualizacao.
            </p>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-[#dfe3e8]">
        <table className="min-w-full divide-y divide-[#dfe3e8] text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-[#727785]">
            <tr>
              <th className="px-4 py-3">Aluno</th>
              <th className="px-4 py-3">Media</th>
              <th className="px-4 py-3">Frequencia</th>
              <th className="px-4 py-3">Resultado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf0f3] bg-white">
            {preview.students.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-[#727785]"
                >
                  Nenhum aluno elegivel para esta oferta.
                </td>
              </tr>
            ) : (
              preview.students.map((item) => (
                <tr key={item.student.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#181c20]">
                      {item.student.fullName}
                    </p>
                    <p className="text-xs text-[#727785]">
                      Registro {item.student.registrationNumber}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-medium text-[#181c20]">
                    {formatPercent(item.gradePercentage)}
                  </td>
                  <td className="px-4 py-3 font-medium text-[#181c20]">
                    {formatPercent(item.attendancePercentage)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getResultBadgeClass(
                        item.resultStatus,
                      )}`}
                    >
                      {getResultStatusLabel(item.resultStatus)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
