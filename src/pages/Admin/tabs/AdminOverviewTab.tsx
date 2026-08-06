import type { ReactNode } from 'react';

import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Circle,
  GraduationCap,
  Layers3,
  School,
  UserRoundCheck,
  Users,
} from 'lucide-react';

import { useAuth } from '../../../contexts/AuthContext';

import { useAdminOverview } from '../../../hooks/useAdminOverview';

import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';

import type {
  AdminModuleId,
} from '../adminNavigation';

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

  return 'Não foi possível carregar a visão geral.';
}

function formatDate(
  value: string | undefined,
): string {
  if (!value) {
    return 'Não informado';
  }

  const [year, month, day] = value.split('-');

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#727785]">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold text-[#181c20]">
            {value}
          </p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-[#005bbf]">
          {icon}
        </div>
      </div>
    </article>
  );
}

interface SetupChecklistItem {
  id: string;
  label: string;
  complete: boolean;
  targetModuleId?: AdminModuleId;
}

interface SetupChecklistProps {
  items: SetupChecklistItem[];
  availableModuleIds: readonly AdminModuleId[];
  onNavigateToModule?: (
    moduleId: AdminModuleId,
  ) => void;
}

function SetupChecklist({
  items,
  availableModuleIds,
  onNavigateToModule,
}: SetupChecklistProps) {
  const availableModules = new Set(
    availableModuleIds,
  );

  return (
    <article className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm dark:border-[#334155] dark:bg-[#182235]">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-[#005bbf] dark:text-[#93c5fd]">
          Configuração inicial da escola
        </p>

        <h3 className="mt-2 text-lg font-bold text-[#181c20] dark:text-[#f8fafc]">
          Primeiros passos
        </h3>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {items.map((item) => {
          const canNavigate =
            !item.complete &&
            item.targetModuleId &&
            availableModules.has(
              item.targetModuleId,
            ) &&
            onNavigateToModule;

          const content = (
            <>
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  item.complete
                    ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300'
                    : 'bg-gray-100 text-gray-500 dark:bg-[#0f172a] dark:text-[#94a3b8]'
                }`}
              >
                {item.complete ? (
                  <CheckCircle2
                    className="h-4 w-4"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle
                    className="h-4 w-4"
                    aria-hidden="true"
                  />
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#181c20] dark:text-[#f8fafc]">
                  {item.label}
                </span>

                <span className="mt-0.5 block text-xs text-[#727785] dark:text-[#94a3b8]">
                  {item.complete
                    ? 'Concluído'
                    : 'Pendente'}
                </span>
              </span>
            </>
          );

          if (canNavigate) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  onNavigateToModule(
                    item.targetModuleId!,
                  )
                }
                className="flex items-center gap-3 rounded-lg border border-[#dfe3e8] bg-white p-3 text-left outline-none transition hover:border-[#005bbf] hover:bg-[#f3f7ff] focus-visible:ring-2 focus-visible:ring-[#005bbf] dark:border-[#334155] dark:bg-[#0f172a] dark:hover:border-[#60a5fa] dark:hover:bg-[#1e293b]"
              >
                {content}
              </button>
            );
          }

          return (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-[#dfe3e8] bg-white p-3 dark:border-[#334155] dark:bg-[#0f172a]"
            >
              {content}
            </div>
          );
        })}
      </div>
    </article>
  );
}

interface AdminOverviewTabProps {
  availableModuleIds?: readonly AdminModuleId[];
  onNavigateToModule?: (
    moduleId: AdminModuleId,
  ) => void;
}

export default function AdminOverviewTab({
  availableModuleIds = [],
  onNavigateToModule,
}: AdminOverviewTabProps) {
  const { profile } = useAuth();

  const institutionQuery =
    useCurrentInstitution(profile?.id);

  const institutionId =
    institutionQuery.data ?? '';

  const overviewQuery =
    useAdminOverview(institutionId);

  if (
    institutionQuery.isLoading ||
    overviewQuery.isLoading
  ) {
    return (
      <div className="rounded-xl border border-[#dfe3e8] bg-white p-6 text-sm text-gray-500">
        Carregando visão geral...
      </div>
    );
  }

  if (
    institutionQuery.isError ||
    overviewQuery.isError ||
    !overviewQuery.data
  ) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"
      >
        {getErrorMessage(
          institutionQuery.error ??
            overviewQuery.error,
        )}
      </div>
    );
  }

  const { metrics, warnings } =
    overviewQuery.data;

  const currentAcademicYear =
    overviewQuery.data.currentAcademicYear;

  const currentTerm =
    overviewQuery.data.currentTerm;

  const setupItems: SetupChecklistItem[] = [
    {
      id: 'institution',
      label: 'Instituição selecionada',
      complete: Boolean(
        institutionQuery.currentInstitution ??
          institutionId,
      ),
    },
    {
      id: 'academic-year',
      label: 'Criar ano letivo',
      complete: Boolean(currentAcademicYear),
      targetModuleId: 'academic-years',
    },
    {
      id: 'subjects',
      label: 'Adicionar disciplinas',
      complete: metrics.activeSubjects > 0,
      targetModuleId: 'subjects',
    },
    {
      id: 'classes',
      label: 'Criar turmas',
      complete: metrics.activeClasses > 0,
      targetModuleId: 'classes',
    },
    {
      id: 'teachers',
      label: 'Cadastrar professores',
      complete: metrics.activeTeachers > 0,
      targetModuleId: 'teachers',
    },
    {
      id: 'assignments',
      label: 'Vincular professores às turmas',
      complete: metrics.activeAssignments > 0,
      targetModuleId: 'assignments',
    },
    {
      id: 'curriculum',
      label: 'Configurar matriz curricular',
      complete:
        metrics.activeCurriculumItems > 0 &&
        metrics.curriculumItemsNeedingReview === 0,
      targetModuleId: 'curriculum',
    },
    {
      id: 'enrollments',
      label: 'Matricular alunos',
      complete: metrics.activeEnrollments > 0,
      targetModuleId: 'enrollments',
    },
  ];

  return (
    <div className="space-y-6">

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Alunos ativos"
          value={metrics.activeStudents}
          icon={
            <GraduationCap
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />

        <MetricCard
          label="Alunos inativos"
          value={metrics.inactiveStudents}
          icon={
            <Users
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />

        <MetricCard
          label="Professores ativos"
          value={metrics.activeTeachers}
          icon={
            <UserRoundCheck
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />

        <MetricCard
          label="Responsáveis ativos"
          value={metrics.activeGuardians}
          icon={
            <Users
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />

        <MetricCard
          label="Turmas ativas"
          value={metrics.activeClasses}
          icon={
            <School
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />

        <MetricCard
          label="Disciplinas ativas"
          value={metrics.activeSubjects}
          icon={
            <BookOpen
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />

        <MetricCard
          label="Matrículas ativas"
          value={metrics.activeEnrollments}
          icon={
            <Layers3
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />

        <MetricCard
          label="Atribuições ativas"
          value={metrics.activeAssignments}
          icon={
            <CalendarDays
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />

        <MetricCard
          label="Itens na matriz"
          value={metrics.activeCurriculumItems}
          icon={
            <BookOpen
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-[#005bbf]">
            Ano letivo atual
          </p>

          <h3 className="mt-2 text-lg font-bold text-[#181c20]">
            {currentAcademicYear?.name ??
              'Nenhum ano ativo'}
          </h3>

          <p className="mt-2 text-sm text-[#727785]">
            {currentAcademicYear
              ? `${formatDate(
                  currentAcademicYear.start_date,
                )} a ${formatDate(
                  currentAcademicYear.end_date,
                )}`
              : 'Cadastre um ano letivo para iniciar a operação acadêmica.'}
          </p>
        </article>

        <article className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-[#005bbf]">
            Período atual
          </p>

          <h3 className="mt-2 text-lg font-bold text-[#181c20]">
            {currentTerm?.name ??
              'Nenhum período ativo'}
          </h3>

          <p className="mt-2 text-sm text-[#727785]">
            {currentTerm
              ? `${formatDate(
                  currentTerm.start_date,
                )} a ${formatDate(
                  currentTerm.end_date,
                )}`
              : 'Crie períodos dentro do ano letivo ativo.'}
          </p>
        </article>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle
            className="h-5 w-5 text-amber-600"
            aria-hidden="true"
          />

          <h3 className="text-lg font-bold text-[#181c20]">
            Pendências acadêmicas
          </h3>
        </div>

        {warnings.length === 0 ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-700">
            Nenhuma pendência acadêmica encontrada.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {warnings.map((warning) => (
              <article
                key={warning.id}
                className={
                  warning.severity === 'warning'
                    ? 'rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800'
                    : 'rounded-xl border border-[#dfe3e8] bg-white p-4 text-[#414754]'
                }
              >
                <h4 className="text-sm font-bold">
                  {warning.title}
                </h4>

                <p className="mt-1 text-xs leading-relaxed">
                  {warning.description}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
