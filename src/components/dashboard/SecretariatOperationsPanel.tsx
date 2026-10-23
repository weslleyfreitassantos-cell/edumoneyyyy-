import { useQuery } from '@tanstack/react-query';
import { Building2, FileText, GraduationCap, RefreshCw, Users } from 'lucide-react';

import { academicReportService } from '../../services/academicReportService';
import type { AdminModuleId } from '../../pages/Admin/adminNavigation';

const secretariatOperationsKey = (
  institutionId: string,
  academicYearId: string,
) => ['secretariat-operations-summary', institutionId, academicYearId] as const;

interface SecretariatOperationsPanelProps {
  institutionId: string;
  academicYearId?: string | null;
  academicYearLoading?: boolean;
  academicYearError?: boolean;
  availableModuleIds: readonly AdminModuleId[];
  onNavigateToModule?: (moduleId: AdminModuleId) => void;
}

interface OperationCardProps {
  label: string;
  detail: string;
  value: number;
  moduleId: AdminModuleId;
  icon: typeof GraduationCap;
  availableModuleIds: readonly AdminModuleId[];
  onNavigateToModule?: (moduleId: AdminModuleId) => void;
}

function OperationCard({
  label,
  detail,
  value,
  moduleId,
  icon: Icon,
  availableModuleIds,
  onNavigateToModule,
}: OperationCardProps) {
  const canNavigate = Boolean(
    onNavigateToModule && availableModuleIds.includes(moduleId),
  );
  const className = 'flex min-h-28 w-full items-start justify-between gap-4 rounded-xl border border-[#dfe6f1] bg-white p-4 text-left transition-colors dark:border-slate-700 dark:bg-slate-900';
  const content = (
    <>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[#344054] dark:text-slate-100">
          {label}
        </span>
        <span className="mt-1 block text-xs text-[#667085] dark:text-slate-400">
          {detail}
        </span>
        <span className="mt-3 block text-2xl font-bold text-[#005bbf] dark:text-blue-300">
          {value}
        </span>
      </span>
      <Icon className="mt-1 h-5 w-5 shrink-0 text-[#005bbf] dark:text-blue-300" aria-hidden="true" />
    </>
  );

  if (canNavigate) {
    return (
      <button
        type="button"
        className={`${className} hover:border-[#9ebce6] hover:bg-[#fbfdff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2 dark:hover:border-blue-700 dark:hover:bg-slate-800/80`}
        onClick={() => onNavigateToModule?.(moduleId)}
        aria-label={`${label}: ${value}. Abrir módulo`}
      >
        {content}
      </button>
    );
  }

  return <article className={className}>{content}</article>;
}

export default function SecretariatOperationsPanel({
  institutionId,
  academicYearId,
  academicYearLoading = false,
  academicYearError = false,
  availableModuleIds,
  onNavigateToModule,
}: SecretariatOperationsPanelProps) {
  const summaryQuery = useQuery({
    queryKey: secretariatOperationsKey(institutionId, academicYearId ?? ''),
    queryFn: () => academicReportService.getSecretariatOperationsSummary(
      institutionId,
      academicYearId as string,
    ),
    enabled: Boolean(institutionId && academicYearId),
    staleTime: 3 * 60 * 1000,
  });

  return (
    <section
      aria-labelledby="secretariat-operations-heading"
      className="min-w-0 rounded-xl border border-[#dfe3e8] bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/70 sm:p-5"
    >
      <div>
        <h2 id="secretariat-operations-heading" className="text-lg font-bold text-[#181c20] dark:text-white">
          Pendências da Secretaria
        </h2>
        <p className="mt-1 text-sm text-[#667085] dark:text-slate-400">
          Indicadores do ano letivo ativo para ajudar a localizar o próximo atendimento.
        </p>
      </div>

      {academicYearLoading ? (
        <div role="status" aria-label="Carregando o ano letivo ativo" className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl border border-[#dfe6f1] bg-white motion-reduce:animate-none dark:border-slate-700 dark:bg-slate-900" />
          ))}
        </div>
      ) : academicYearError ? (
        <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          Não foi possível identificar o ano letivo ativo para calcular os indicadores.
        </div>
      ) : !academicYearId ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          Não há ano letivo ativo selecionado; os indicadores não podem ser calculados.
          {availableModuleIds.includes('academic-years') && onNavigateToModule && (
            <button
              type="button"
              className="ml-2 font-bold underline underline-offset-2"
              onClick={() => onNavigateToModule('academic-years')}
            >
              Configurar ano letivo
            </button>
          )}
        </div>
      ) : summaryQuery.isError ? (
        <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          <p>Não foi possível carregar os indicadores operacionais.</p>
          <button
            type="button"
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 font-semibold text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
            onClick={() => void summaryQuery.refetch()}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Tentar novamente
          </button>
        </div>
      ) : summaryQuery.isPending ? (
        <div role="status" aria-label="Carregando pendências da Secretaria" className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl border border-[#dfe6f1] bg-white motion-reduce:animate-none dark:border-slate-700 dark:bg-slate-900" />
          ))}
        </div>
      ) : summaryQuery.data ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <OperationCard
              label="Alunos ativos sem turma"
              detail="Sem vínculo ativo no ano letivo"
              value={summaryQuery.data.studentsWithoutClass}
              moduleId="enrollments"
              icon={GraduationCap}
              availableModuleIds={availableModuleIds}
              onNavigateToModule={onNavigateToModule}
            />
            <OperationCard
              label="Documentos para revisar"
              detail="Registros que ainda exigem providência"
              value={summaryQuery.data.pendingDocuments}
              moduleId="academic-documents"
              icon={FileText}
              availableModuleIds={availableModuleIds}
              onNavigateToModule={onNavigateToModule}
            />
            <OperationCard
              label="Turmas com vagas"
              detail="Turmas com capacidade informada disponível"
              value={summaryQuery.data.classesWithVacancies}
              moduleId="classes"
              icon={Building2}
              availableModuleIds={availableModuleIds}
              onNavigateToModule={onNavigateToModule}
            />
            <OperationCard
              label="Vagas disponíveis"
              detail="Soma das vagas nas turmas com capacidade definida"
              value={summaryQuery.data.availableSeats}
              moduleId="classes"
              icon={Users}
              availableModuleIds={availableModuleIds}
              onNavigateToModule={onNavigateToModule}
            />
          </div>
          <p className="mt-3 text-xs text-[#667085] dark:text-slate-400">
            O sistema conta somente documentos já registrados como pendentes de ação; ausência de cadastro documental não é tratada como pendência automática.
          </p>
        </>
      ) : null}
    </section>
  );
}
