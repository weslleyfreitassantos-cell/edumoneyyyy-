import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  GraduationCap,
  Layers3,
  School,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { useAuth } from '../../../contexts/AuthContext';
import { useAdminOverview } from '../../../hooks/useAdminOverview';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import SchoolSetupProgress from '../../../components/academic/SchoolSetupProgress';
import type { AdminModuleId } from '../adminNavigation';
import { getUserFacingErrorMessage } from '../../../lib/userFacingError';
import { canManageAcademicStructure } from '../../../lib/permissions';

function getErrorMessage(error: unknown): string {
  return getUserFacingErrorMessage(error, 'Não foi possível carregar a visão geral.');
}

interface MetricCardProps {
  key?: string;
  label: string;
  value: number;
  icon: LucideIcon;
  moduleId: AdminModuleId;
  availableModuleIds: readonly AdminModuleId[];
  onNavigateToModule?: (moduleId: AdminModuleId) => void;
  emphasis: 'primary' | 'secondary';
}

function MetricCard({
  label,
  value,
  icon: Icon,
  moduleId,
  availableModuleIds,
  onNavigateToModule,
  emphasis,
}: MetricCardProps) {
  const isNavigable = Boolean(
    onNavigateToModule && availableModuleIds.includes(moduleId),
  );
  const cardClassName = emphasis === 'primary'
    ? 'rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5'
    : 'rounded-lg border border-[#e4e8f1] bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900';
  const iconClassName = emphasis === 'primary'
    ? 'bg-blue-50 text-[#005bbf] dark:bg-blue-950/40 dark:text-blue-300'
    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';

  const content = (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="min-w-0">
        <p className={`truncate text-xs font-semibold ${emphasis === 'primary' ? 'text-[#727785] dark:text-slate-400' : 'text-[#667085] dark:text-slate-400'}`}>
          {label}
        </p>
        <p className={`mt-1 font-bold text-[#181c20] dark:text-white ${emphasis === 'primary' ? 'text-2xl' : 'text-xl'}`}>
          {value}
        </p>
      </div>

      <div className={`flex shrink-0 items-center gap-2 ${isNavigable ? 'text-[#005bbf] dark:text-blue-300' : ''}`}>
        <div className={`flex items-center justify-center rounded-lg ${emphasis === 'primary' ? 'h-10 w-10' : 'h-9 w-9'} ${iconClassName}`}>
          <Icon className={emphasis === 'primary' ? 'h-5 w-5' : 'h-4 w-4'} aria-hidden="true" />
        </div>
        {isNavigable && (
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        )}
      </div>
    </div>
  );

  if (isNavigable) {
    return (
      <button
        type="button"
        className={`${cardClassName} w-full text-left transition-colors hover:border-[#9ebce6] hover:bg-[#fbfdff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2 dark:hover:border-blue-700 dark:hover:bg-slate-800/80`}
        onClick={() => onNavigateToModule?.(moduleId)}
        aria-label={`${label}: ${value}. Ver módulo`}
      >
        {content}
      </button>
    );
  }

  return <article className={cardClassName}>{content}</article>;
}

interface AdminOverviewTabProps {
  availableModuleIds?: readonly AdminModuleId[];
  onNavigateToModule?: (moduleId: AdminModuleId) => void;
}

export default function AdminOverviewTab({
  availableModuleIds = [],
  onNavigateToModule,
}: AdminOverviewTabProps) {
  const { profile } = useAuth();

  const institutionQuery = useCurrentInstitution(profile?.id);

  const institutionId = institutionQuery.data ?? '';
  const canEditAcademic = canManageAcademicStructure(
    profile?.platform_role,
    institutionQuery.currentRole as Parameters<typeof canManageAcademicStructure>[1],
  );
  const overviewQuery = useAdminOverview(institutionId);

  if (
    institutionQuery.isLoading ||
    (overviewQuery.isLoading && !overviewQuery.data)
  ) {
    return (
      <section aria-label="Carregando visão geral" data-testid="admin-overview-loading" className="space-y-5">
        <div className="space-y-2">
          <div className="h-3 w-32 animate-pulse rounded bg-slate-200 motion-reduce:animate-none dark:bg-slate-700" />
          <div className="h-7 w-56 animate-pulse rounded bg-slate-200 motion-reduce:animate-none dark:bg-slate-700" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded bg-slate-100 motion-reduce:animate-none dark:bg-slate-800" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={`primary-${index}`} className="h-24 animate-pulse rounded-xl border border-[#e4e8f1] bg-white motion-reduce:animate-none dark:border-slate-800 dark:bg-slate-900" />
          ))}
        </div>
        <div className="space-y-3">
          <div className="h-4 w-40 animate-pulse rounded bg-slate-100 motion-reduce:animate-none dark:bg-slate-800" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={`secondary-${index}`} className="h-16 animate-pulse rounded-lg border border-[#e4e8f1] bg-white motion-reduce:animate-none dark:border-slate-800 dark:bg-slate-900" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!institutionId) {
    return (
      <section className="rounded-xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-900/60 dark:bg-blue-950/30">
        <h2 className="text-lg font-extrabold text-[#181c20] dark:text-white">Crie a primeira escola</h2>
        <p className="mt-2 max-w-2xl text-sm text-[#475467] dark:text-slate-300">
          Nenhuma instituição está selecionada. Crie ou selecione uma escola para acompanhar a configuração acadêmica.
        </p>
        <a href="/account" className="mt-4 inline-flex rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white hover:bg-[#004a9b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2">
          Gerenciar instituições
        </a>
      </section>
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
        className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
      >
        {getErrorMessage(
          institutionQuery.error ?? overviewQuery.error,
        )}
      </div>
    );
  }

  const { metrics } = overviewQuery.data;
  const primaryMetrics: Array<Omit<MetricCardProps, 'availableModuleIds' | 'onNavigateToModule' | 'emphasis'>> = [
    {
      label: 'Alunos ativos',
      value: metrics.activeStudents,
      icon: GraduationCap,
      moduleId: 'students',
    },
    {
      label: 'Professores ativos',
      value: metrics.activeTeachers,
      icon: UserRoundCheck,
      moduleId: 'teachers',
    },
    {
      label: 'Turmas ativas',
      value: metrics.activeClasses,
      icon: School,
      moduleId: 'classes',
    },
  ];
  const secondaryMetrics: Array<Omit<MetricCardProps, 'availableModuleIds' | 'onNavigateToModule' | 'emphasis'>> = [
    {
      label: 'Responsáveis ativos',
      value: metrics.activeGuardians,
      icon: Users,
      moduleId: 'guardians',
    },
    {
      label: 'Matrículas ativas',
      value: metrics.activeEnrollments,
      icon: Layers3,
      moduleId: 'enrollments',
    },
    {
      label: 'Disciplinas ativas',
      value: metrics.activeSubjects,
      icon: BookOpen,
      moduleId: 'subjects',
    },
    {
      label: 'Atribuições ativas',
      value: metrics.activeAssignments,
      icon: CalendarDays,
      moduleId: 'assignments',
    },
    {
      label: 'Itens na matriz',
      value: metrics.activeCurriculumItems,
      icon: BookOpen,
      moduleId: 'curriculum',
    },
    {
      label: 'Alunos inativos',
      value: metrics.inactiveStudents,
      icon: Users,
      moduleId: 'students',
    },
  ];

  const metricCardProps = {
    availableModuleIds,
    onNavigateToModule,
  };

  return (
    <div className="space-y-6">
      <SchoolSetupProgress
        institutionId={institutionId}
        canEditAcademic={canEditAcademic}
        showFoundation={institutionQuery.currentRole !== 'DIRECTOR'}
        showOnlyFoundation={institutionQuery.currentRole === 'ADMIN'}
        configurationHref={availableModuleIds.includes('school-users') ? '/admin?module=school-users' : '/admin?module=overview'}
      />
      <section aria-labelledby="admin-overview-heading" className="space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf] dark:text-blue-400">
            Resumo institucional
          </p>
          <h2 id="admin-overview-heading" className="mt-1 text-xl font-extrabold text-[#181c20] dark:text-white">
            Resumo da escola
          </h2>
          <p className="mt-1 text-sm text-[#667085] dark:text-slate-400">
            Visão rápida da estrutura e da comunidade escolar.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {primaryMetrics.map((metric) => (
            <MetricCard
              key={metric.label}
              {...metric}
              {...metricCardProps}
              emphasis="primary"
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="admin-overview-operational-heading" className="space-y-3">
        <div>
          <h3 id="admin-overview-operational-heading" className="text-sm font-bold text-[#344054] dark:text-slate-100">
            Resumo operacional
          </h3>
          <p className="mt-1 text-xs text-[#667085] dark:text-slate-400">
            Estrutura acadêmica e vínculos ativos da instituição.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {secondaryMetrics.map((metric) => (
            <MetricCard
              key={metric.label}
              {...metric}
              {...metricCardProps}
              emphasis="secondary"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
