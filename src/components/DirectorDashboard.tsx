import {
  AlertTriangle,
  BookOpen,
  GraduationCap,
  Layers3,
  School,
  UsersRound,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { useAdminOverview } from '../hooks/useAdminOverview';
import { useCurrentInstitution } from '../hooks/useCurrentInstitution';
import type { DatabaseRole } from '../lib/roles';

export function getDirectorDashboardTitle(
  role: DatabaseRole | undefined,
): string {
  if (role === 'ADMIN') {
    return 'Painel do Administrador';
  }

  if (role === 'DIRECTOR') {
    return 'Painel do Diretor';
  }

  return 'Painel acadêmico';
}

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return 'Não foi possível carregar o painel do diretor.';
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: number;
  subtitle?: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#727785]">
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold text-[#181c20]">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-[#727785]">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-[#005bbf]">
          {icon}
        </div>
      </div>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="grid min-h-[360px] place-items-center rounded-xl border border-[#dfe3e8] bg-white">
      <div className="text-center">
        <div
          className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#dfe3e8] border-t-[#005bbf]"
          aria-hidden="true"
        />
        <p className="mt-4 text-sm font-medium text-[#727785]">
          Carregando visão acadêmica...
        </p>
      </div>
    </div>
  );
}

export default function DirectorDashboard() {
  const { profile } = useAuth();

  const institutionQuery =
    useCurrentInstitution(profile?.id);

  const overviewQuery =
    useAdminOverview(
      institutionQuery.data ?? '',
    );

  if (
    institutionQuery.isLoading ||
    overviewQuery.isLoading
  ) {
    return <LoadingState />;
  }

  if (
    !profile ||
    institutionQuery.isError ||
    overviewQuery.isError
  ) {
    const error =
      institutionQuery.error ??
      overviewQuery.error;

    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <h2 className="font-bold">
          Não foi possível carregar o painel
        </h2>
        <p className="mt-2">
          {getErrorMessage(error)}
        </p>
      </div>
    );
  }

  const overview = overviewQuery.data;
  const dashboardTitle =
    getDirectorDashboardTitle(profile.role);

  if (!overview) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
        Nenhum dado acadêmico encontrado para esta instituição.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#181c20]">
          {dashboardTitle}
        </h2>
        <p className="mt-1 text-sm text-[#727785]">
          Resumo da estrutura acadêmica carregado das tabelas operacionais.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Alunos ativos"
          value={overview.metrics.activeStudents}
          subtitle={`${overview.metrics.inactiveStudents} inativos`}
          icon={
            <GraduationCap
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />

        <MetricCard
          title="Professores ativos"
          value={overview.metrics.activeTeachers}
          icon={
            <UsersRound
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />

        <MetricCard
          title="Turmas ativas"
          value={overview.metrics.activeClasses}
          subtitle={`${overview.metrics.activeEnrollments} matrículas`}
          icon={
            <School
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />

        <MetricCard
          title="Atribuições ativas"
          value={overview.metrics.activeAssignments}
          subtitle={`${overview.metrics.activeSubjects} disciplinas`}
          icon={
            <BookOpen
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Layers3
              className="h-5 w-5 text-[#005bbf]"
              aria-hidden="true"
            />
            <h3 className="text-lg font-bold text-[#181c20]">
              Período atual
            </h3>
          </div>

          <dl className="mt-5 space-y-4">
            <div>
              <dt className="text-xs font-medium text-[#727785]">
                Ano letivo
              </dt>
              <dd className="mt-1 text-sm font-semibold text-[#181c20]">
                {overview.currentAcademicYear?.name ??
                  'Nenhum ano ativo'}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-[#727785]">
                Período
              </dt>
              <dd className="mt-1 text-sm font-semibold text-[#181c20]">
                {overview.currentTerm?.name ??
                  'Nenhum período ativo'}
              </dd>
            </div>
          </dl>
        </article>

        <article className="rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <UsersRound
              className="h-5 w-5 text-[#005bbf]"
              aria-hidden="true"
            />
            <h3 className="text-lg font-bold text-[#181c20]">
              Vínculos familiares
            </h3>
          </div>

          <p className="mt-5 text-3xl font-bold text-[#181c20]">
            {overview.metrics.activeGuardians}
          </p>
          <p className="mt-1 text-sm text-[#727785]">
            Responsáveis com vínculo ativo a alunos da instituição.
          </p>
        </article>
      </section>

      <section className="rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <AlertTriangle
            className="h-5 w-5 text-amber-600"
            aria-hidden="true"
          />
          <h3 className="text-lg font-bold text-[#181c20]">
            Pontos de atenção
          </h3>
        </div>

        {overview.warnings.length === 0 ? (
          <p className="mt-4 text-sm text-[#727785]">
            Nenhum alerta acadêmico encontrado.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {overview.warnings.map((warning) => (
              <div
                key={warning.id}
                className={
                  warning.severity === 'warning'
                    ? 'rounded-lg border border-amber-200 bg-amber-50 px-4 py-3'
                    : 'rounded-lg border border-blue-200 bg-blue-50 px-4 py-3'
                }
              >
                <p className="text-sm font-semibold text-[#181c20]">
                  {warning.title}
                </p>
                <p className="mt-1 text-sm text-[#727785]">
                  {warning.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
