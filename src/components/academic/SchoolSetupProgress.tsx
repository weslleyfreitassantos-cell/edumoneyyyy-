import {
  CheckCircle2,
  Circle,
  CircleHelp,
  LockKeyhole,
  Settings2,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useSchoolSetupReadiness } from '../../hooks/useSchoolSetupReadiness';
import { getUserFacingErrorMessage } from '../../lib/userFacingError';
import {
  buildSchoolSetupFlow,
  getSchoolSetupFlowStatusLabel,
  type SchoolSetupFlow,
  type SchoolSetupFlowSection,
  type SchoolSetupFlowStatus,
  type SchoolSetupFlowStep,
} from '../../lib/schoolSetupFlow';

function getErrorMessage(error: unknown): string {
  return getUserFacingErrorMessage(
    error,
    'Não foi possível carregar o progresso da configuração.',
  );
}

function StatusIcon({ status }: { status: SchoolSetupFlowStatus }) {
  if (status === 'COMPLETED') {
    return <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />;
  }
  if (status === 'BLOCKED') {
    return <LockKeyhole className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />;
  }
  if (status === 'OPTIONAL') {
    return <CircleHelp className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />;
  }
  return <Circle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />;
}

function StatusPill({ status }: { status: SchoolSetupFlowStatus }) {
  const colors: Record<SchoolSetupFlowStatus, string> = {
    COMPLETED: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    PENDING: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    BLOCKED: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
    OPTIONAL: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  };

  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${colors[status]}`}>
      {getSchoolSetupFlowStatusLabel(status)}
    </span>
  );
}

function FlowStepRow({
  step,
  canEditAcademic,
  isRecommended,
  showStatus = true,
}: {
  key?: string;
  step: SchoolSetupFlowStep;
  canEditAcademic: boolean;
  isRecommended: boolean;
  showStatus?: boolean;
}) {
  const canOpen = canEditAcademic || step.id === 'responsible-user';
  const action = canOpen
      ? (
        <Link
          to={step.href}
          className="mt-3 inline-flex min-h-9 items-center rounded-lg border border-[#b8c7df] px-3 py-1.5 text-xs font-bold text-[#005bbf] hover:bg-[#f3f7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/40"
        >
          {step.status === 'COMPLETED' ? 'Revisar' : step.actionLabel}
        </Link>
      )
      : step.status === 'COMPLETED'
        ? null
        : (
        <span
          aria-disabled="true"
          className="mt-3 inline-flex min-h-9 items-center text-xs font-semibold text-[#667085]"
        >
          Somente Diretor ou Secretaria
        </span>
        );

  return (
    <li
      className={`rounded-lg border p-4 ${
        isRecommended
          ? 'border-[#7ca8e8] bg-[#f7faff] dark:border-blue-700 dark:bg-blue-950/30'
          : 'border-[#e4e8f1] bg-white dark:border-slate-700 dark:bg-slate-900'
      }`}
      aria-current={isRecommended ? 'step' : undefined}
    >
      <div className="flex items-start gap-3">
        <StatusIcon status={step.status} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-bold text-[#344054] dark:text-slate-100">{step.label}</p>
            {showStatus && <StatusPill status={step.status} />}
          </div>
          <p className="mt-1 text-sm leading-5 text-[#667085] dark:text-slate-400">{step.description}</p>
          {step.reason && (
            <p className="mt-2 text-xs font-semibold text-[#667085] dark:text-slate-400">{step.reason}</p>
          )}
          {step.progress && step.progress.total > 0 && (
            <div className="mt-3" data-testid={`${step.id}-progress`}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold text-[#667085] dark:text-slate-400">
                <span>Disponibilidade cadastrada</span>
                <span>{step.progress.current} de {step.progress.total}</span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-[#e4e8f1] dark:bg-slate-700"
                role="progressbar"
                aria-label={`Disponibilidade dos professores: ${step.progress.current} de ${step.progress.total}`}
                aria-valuemin={0}
                aria-valuemax={step.progress.total}
                aria-valuenow={step.progress.current}
              >
                <div
                  className="h-full rounded-full bg-[#005bbf] transition-[width] duration-300 ease-out dark:bg-blue-400"
                  style={{
                    width: `${Math.min(100, Math.max(0, (step.progress.current / step.progress.total) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}
          {action}
        </div>
      </div>
    </li>
  );
}

function FlowSection({
  section,
  canEditAcademic,
  recommendedStepId,
}: {
  key?: string;
  section: SchoolSetupFlowSection;
  canEditAcademic: boolean;
  recommendedStepId: string | null;
}) {
  const requiredCount = section.totalCount;
  const sectionProgress = requiredCount > 0
    ? Math.round((section.completedCount / requiredCount) * 100)
    : 0;
  const showStatus = section.id !== 'personalization';

  return (
    <section
      aria-labelledby={`school-setup-section-${section.id}`}
      className="rounded-xl border border-[#d8deea] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3
              id={`school-setup-section-${section.id}`}
              className="text-base font-extrabold text-[#181c20] dark:text-white"
            >
              {section.label}
            </h3>
            {showStatus && <StatusPill status={section.status} />}
          </div>
          <p className="mt-1 text-sm text-[#667085] dark:text-slate-400">{section.description}</p>
        </div>
        {showStatus && (
          <p className="shrink-0 text-sm font-bold text-[#005bbf] dark:text-blue-300">
            {section.completedCount} de {requiredCount} ({sectionProgress}%)
          </p>
        )}
      </div>

      <ol className="mt-4 grid gap-3 lg:grid-cols-2">
        {section.steps.map((step) => (
          <FlowStepRow
            key={step.id}
            step={step}
            canEditAcademic={canEditAcademic}
            isRecommended={step.id === recommendedStepId}
            showStatus={showStatus}
          />
        ))}
      </ol>
    </section>
  );
}

function FlowDetails({
  flow,
  canEditAcademic,
  showOnlyFoundation = false,
}: {
  flow: SchoolSetupFlow;
  canEditAcademic: boolean;
  showOnlyFoundation?: boolean;
}) {
  const requiredSections = flow.sections.filter(
    (section) => section.id !== 'personalization' &&
      (!showOnlyFoundation || section.id === 'foundation'),
  );
  const personalization = showOnlyFoundation
    ? null
    : flow.sections.find((section) => section.id === 'personalization');

  return (
    <div id="school-setup-flow" className="space-y-4">
      {requiredSections.map((section) => (
        <FlowSection
          key={section.id}
          section={section}
          canEditAcademic={canEditAcademic}
          recommendedStepId={flow.recommendedNextStep?.id ?? null}
        />
      ))}

      {personalization && (
        <FlowSection
          section={personalization}
          canEditAcademic={canEditAcademic}
          recommendedStepId={null}
        />
      )}
    </div>
  );
}

export default function SchoolSetupProgress({
  institutionId,
  canEditAcademic = true,
  showFoundation = true,
  showOnlyFoundation = false,
  configurationHref = '/admin?module=school-users',
}: {
  institutionId: string;
  canEditAcademic?: boolean;
  showFoundation?: boolean;
  showOnlyFoundation?: boolean;
  configurationHref?: string;
}) {
  const readinessQuery = useSchoolSetupReadiness(institutionId);
  const [showCompletedDetails, setShowCompletedDetails] = useState(false);

  if (readinessQuery.isLoading) {
    return (
      <section aria-label="Configuração da escola" className="space-y-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-24 animate-pulse rounded-xl border border-[#e4e8f1] bg-white"
          />
        ))}
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
  const flow = buildSchoolSetupFlow(readiness, {
    canEditAcademic,
    includeFoundation: showFoundation,
    responsibleUserHref: configurationHref,
  });

  if (showOnlyFoundation) {
    return (
      <section aria-label="Acesso de configuração">
        <FlowDetails
          flow={flow}
          canEditAcademic={canEditAcademic}
          showOnlyFoundation
        />
      </section>
    );
  }

  const recommendedStep = flow.recommendedNextStep;
  const showDetails = !flow.operationalReady || showCompletedDetails;

  if (!showDetails) {
    return (
      <section
        aria-label="Configuração da escola"
        className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/30"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
                Configuração da escola
              </p>
              <h2 className="mt-1 text-xl font-extrabold text-[#181c20] dark:text-white">
                Escola pronta para operar
              </h2>
              <p className="mt-1 text-sm text-[#475467] dark:text-slate-300">
                A estrutura principal da escola está configurada e os módulos acadêmicos já podem ser utilizados.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-expanded={showCompletedDetails}
            aria-controls="school-setup-flow"
            onClick={() => setShowCompletedDetails(true)}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:border-emerald-700 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
          >
            Ver configuração
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Configuração da escola" className="space-y-4">
      <div className="rounded-xl border border-[#d8deea] bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#005bbf]">
              <Settings2 className="h-5 w-5" aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-[0.16em]">
                Configuração da escola
              </span>
            </div>
            <h2 className="mt-2 text-xl font-extrabold text-[#181c20] dark:text-white">
              {flow.completedCount} de {flow.totalCount} etapas concluídas
            </h2>
            <p className="mt-1 text-sm text-[#667085] dark:text-slate-400">
              Conclua as etapas abaixo para liberar a operação da escola.
            </p>
          </div>

          {recommendedStep && (
            canEditAcademic ? (
              <Link
                to={recommendedStep.href}
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white hover:bg-[#004a9b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2"
              >
                {recommendedStep.id === 'responsible-user' || recommendedStep.id === 'manage-users'
                  ? 'Gerenciar acesso'
                  : 'Continuar'}
              </Link>
            ) : (
              <Link
                to={configurationHref}
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white hover:bg-[#004a9b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2"
              >
                Gerenciar acesso
              </Link>
            )
          )}
        </div>

        {recommendedStep && (
          <p className="mt-4 rounded-lg border border-[#e4e8f1] bg-[#f8faff] px-3 py-2 text-sm text-[#475467] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
            Próximo: <strong>{recommendedStep.label}</strong>
            {recommendedStep.reason && ` — ${recommendedStep.reason}`}
          </p>
        )}
      </div>

      <div className={`rounded-xl border p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${
        readiness.operationalReadiness.ready
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
          : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-[#344054] dark:text-slate-100">Prontidão da escola</p>
            <p className="mt-1 text-sm text-[#667085] dark:text-slate-400">
              {readiness.operationalReadiness.ready
                ? 'Escola pronta para operar.'
                : `Faltam ${readiness.operationalReadiness.totalCount - readiness.operationalReadiness.completedCount} requisito(s) para operar.`}
            </p>
          </div>
          <span className="text-lg font-extrabold text-[#005bbf] dark:text-blue-300">
            {readiness.operationalReadiness.progress}%
          </span>
        </div>
      </div>

      <FlowDetails flow={flow} canEditAcademic={canEditAcademic} />
    </section>
  );
}
