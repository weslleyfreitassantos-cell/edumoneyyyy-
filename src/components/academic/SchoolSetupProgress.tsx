import {
  CheckCircle2,
  Circle,
  Settings2,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { useSchoolSetupReadiness } from '../../hooks/useSchoolSetupReadiness';
import { getUserFacingErrorMessage } from '../../lib/userFacingError';

function getErrorMessage(error: unknown): string {
  return getUserFacingErrorMessage(
    error,
    'Não foi possível carregar o progresso da configuração.',
  );
}

export default function SchoolSetupProgress({
  institutionId,
  canEditAcademic = true,
  configurationHref = '/admin?module=directors',
}: {
  institutionId: string;
  canEditAcademic?: boolean;
  configurationHref?: string;
}) {
  const readinessQuery = useSchoolSetupReadiness(institutionId);

  if (readinessQuery.isLoading) {
    return (
      <section className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm">
        <p className="text-sm text-[#667085]">
          Carregando configuração da escola...
        </p>
      </section>
    );
  }

  if (readinessQuery.isError || !readinessQuery.data) {
    return (
      <section
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
      >
        {getErrorMessage(readinessQuery.error)}
      </section>
    );
  }

  const readiness = readinessQuery.data;

  const nextStep = readiness.steps.find(
    (step) => !step.complete,
  );
  const operation = readiness.operationalReadiness;

  return (
    <section aria-label="Prontidão da escola" className="space-y-5">
      <div className="rounded-xl border border-[#d8deea] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#005bbf]">
            <Settings2 className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-[0.16em]">
              Configuração da escola
            </span>
          </div>
          <h2 className="mt-2 text-xl font-extrabold text-[#181c20]">
            Configuração acadêmica — {readiness.progress}%
          </h2>
          <p className="mt-1 text-sm text-[#667085]">
            A grade publicada encerra esta etapa. A operação possui pendências próprias.
          </p>
        </div>

        {nextStep && canEditAcademic && (
          <Link
            to={nextStep.href}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white hover:bg-[#004a9b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2"
          >
            {nextStep.id === 'timetable' ? 'Configurar grade' : 'Continuar configuração'}
          </Link>
        )}
        {nextStep && !canEditAcademic && (
          <Link
            to={configurationHref}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white hover:bg-[#004a9b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2"
          >
            Gerenciar Diretor ou Secretaria
          </Link>
        )}
      </div>

      <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {readiness.steps.map((step) => (
          <li key={step.id}>
            {canEditAcademic ? (
              <Link
                to={step.href}
                className="flex min-h-11 items-center gap-3 rounded-lg border border-[#e4e8f1] px-3 py-2 text-sm outline-none hover:bg-[#f8faff] focus-visible:ring-2 focus-visible:ring-[#005bbf]"
              >
              {step.complete ? (
                <CheckCircle2
                  className="h-5 w-5 shrink-0 text-emerald-600"
                  aria-hidden="true"
                />
              ) : (
                <Circle
                  className="h-5 w-5 shrink-0 text-[#98a2b3]"
                  aria-hidden="true"
                />
              )}
              <span
                className={
                  step.complete
                    ? 'font-semibold text-[#344054]'
                    : 'font-semibold text-[#667085]'
                }
              >
                {step.label}
              </span>
              </Link>
            ) : (
              <div className="flex min-h-11 items-center gap-3 rounded-lg border border-[#e4e8f1] px-3 py-2 text-sm">
                {step.complete ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" /> : <Circle className="h-5 w-5 shrink-0 text-[#98a2b3]" aria-hidden="true" />}
                <span className={step.complete ? 'font-semibold text-[#344054]' : 'font-semibold text-[#667085]'}>{step.label}</span>
              </div>
            )}
          </li>
        ))}
      </ol>

      {nextStep && (
        <p className="mt-4 text-sm text-[#667085]">
          Próximo passo: <strong>{nextStep.label}</strong>
        </p>
      )}
      </div>

      <div className={`rounded-xl border p-5 shadow-sm ${operation.ready ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex items-center gap-2">
          {operation.ready ? <CheckCircle2 className="h-5 w-5 text-emerald-700" aria-hidden="true" /> : <Circle className="h-5 w-5 text-amber-700" aria-hidden="true" />}
          <h2 className="text-lg font-extrabold text-[#181c20]">Prontidão operacional — {operation.progress}%</h2>
        </div>
        <p className="mt-1 text-sm text-[#667085]">
          {operation.ready ? 'A escola está pronta para operar.' : `${operation.totalCount - operation.completedCount} item(ns) pendente(s) antes da operação.`}
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {operation.blockers.map((blocker) => (
            <li key={blocker.id} className="rounded-lg border border-white/80 bg-white/80 p-3">
              <div className="flex items-start gap-2">
                {blocker.complete ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />}
                <div>
                  <p className="text-sm font-semibold text-[#344054]">{blocker.label}</p>
                  <p className="mt-1 text-xs text-[#667085]">{blocker.description}</p>
                  {!blocker.complete && canEditAcademic && <Link to={blocker.href} className="mt-2 inline-flex text-xs font-bold text-[#005bbf] hover:underline">Resolver pendência</Link>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-[#d8deea] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-[#667085]">
          <Circle className="h-5 w-5" aria-hidden="true" />
          <h2 className="text-lg font-extrabold text-[#181c20]">Personalização</h2>
        </div>
        <p className="mt-2 text-sm text-[#667085]">Personalizar login é opcional e não bloqueia a operação.</p>
        <Link to="/personalizar-login" className="mt-3 inline-flex text-sm font-bold text-[#005bbf] hover:underline">
          {readiness.optionalSetup.brandingConfigured ? 'Revisar personalização' : 'Personalizar login'}
        </Link>
      </div>
    </section>
  );
}
