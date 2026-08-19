import {
  CheckCircle2,
  Circle,
  Settings2,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { useSchoolSetupReadiness } from '../../hooks/useSchoolSetupReadiness';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Não foi possível carregar o progresso da configuração.';
}

export default function SchoolSetupProgress({
  institutionId,
}: {
  institutionId: string;
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

  if (readiness.configured) {
    return (
      <section
        aria-label="Revisão da escola"
        className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm"
      >
        <div className="flex items-center gap-2 text-emerald-700">
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-[0.16em]">
            Revisão da escola
          </span>
        </div>
        <h2 className="mt-2 text-xl font-extrabold text-[#181c20]">
          Escola configurada
        </h2>
        <dl className="mt-4 grid gap-3 text-sm text-[#344054] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div>
            <dt className="text-xs font-semibold uppercase text-[#667085]">Ano letivo</dt>
            <dd className="mt-1 font-bold">{readiness.review.academicYearName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[#667085]">Períodos</dt>
            <dd className="mt-1 font-bold">{readiness.review.termCount}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[#667085]">Matérias</dt>
            <dd className="mt-1 font-bold">{readiness.review.subjectCount}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[#667085]">Turmas</dt>
            <dd className="mt-1 font-bold">{readiness.review.classCount}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[#667085]">Matrizes</dt>
            <dd className="mt-1 font-bold">
              {readiness.review.curriculumClassCount}/{readiness.review.classCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[#667085]">Grade horária</dt>
            <dd className="mt-1 font-bold">
              {readiness.review.timetableClassCount}/{readiness.review.classCount} turmas configuradas
            </dd>
          </div>
        </dl>
      </section>
    );
  }

  const nextStep = readiness.steps.find(
    (step) => !step.complete,
  );

  return (
    <section
      aria-label="Configuração da escola"
      className="rounded-xl border border-[#d8deea] bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#005bbf]">
            <Settings2 className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-[0.16em]">
              Configuração da escola
            </span>
          </div>
          <h2 className="mt-2 text-xl font-extrabold text-[#181c20]">
            Configuração da escola — {readiness.progress}%
          </h2>
          <p className="mt-1 text-sm text-[#667085]">
            Conclua a estrutura acadêmica antes de abrir a operação da escola.
          </p>
        </div>

        {nextStep && (
          <Link
            to={nextStep.href}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white hover:bg-[#004a9b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2"
          >
            {nextStep.id === 'timetable'
              ? 'Configurar grade'
              : 'Continuar configuração'}
          </Link>
        )}
      </div>

      <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {readiness.steps.map((step) => (
          <li key={step.id}>
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
          </li>
        ))}
      </ol>

      {nextStep && (
        <p className="mt-4 text-sm text-[#667085]">
          Próximo passo: <strong>{nextStep.label}</strong>
        </p>
      )}
    </section>
  );
}
