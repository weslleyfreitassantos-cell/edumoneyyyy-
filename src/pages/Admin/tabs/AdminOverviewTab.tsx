import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Layers3,
  School,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { useAuth } from '../../../contexts/AuthContext';
import { useAdminOverview } from '../../../hooks/useAdminOverview';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import { useSchoolSetupReadiness } from '../../../hooks/useSchoolSetupReadiness';
import SchoolSetupProgress from '../../../components/academic/SchoolSetupProgress';
import DirectorAcademicPanorama from '../../../components/dashboard/DirectorAcademicPanorama';
import ProfileHeroAvatar from '../../../components/ProfileHeroAvatar';
import type { AdminModuleId } from '../adminNavigation';
import { getUserFacingErrorMessage } from '../../../lib/userFacingError';
import { canManageAcademicStructure } from '../../../lib/permissions';

function getErrorMessage(error: unknown): string {
  return getUserFacingErrorMessage(error, 'Não foi possível carregar a visão geral.');
}

function getFirstName(fullName: string | null | undefined): string {
  return fullName?.trim().split(/\s+/).at(0) || 'Diretor';
}

function getIsMobileViewport(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 767px)').matches;
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
    ? 'min-w-0 rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5'
    : 'min-w-0 rounded-lg border border-[#e4e8f1] bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900';
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

  const [isMobileViewport, setIsMobileViewport] = useState(
    getIsMobileViewport,
  );
  const collapseDirectorSections =
    isMobileViewport && institutionQuery.currentRole === 'DIRECTOR';
  const [setupOpenOverride, setSetupOpenOverride] = useState<boolean | null>(
    () => (collapseDirectorSections ? false : null),
  );
  const [operationalOpen, setOperationalOpen] = useState(false);
  const [panoramaOpen, setPanoramaOpen] = useState(
    () => !collapseDirectorSections,
  );
  const responsiveDefaultsApplied = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleViewportChange = () => {
      setIsMobileViewport(mediaQuery.matches);
    };

    handleViewportChange();
    mediaQuery.addEventListener('change', handleViewportChange);

    return () => {
      mediaQuery.removeEventListener('change', handleViewportChange);
    };
  }, []);

  const responsiveDefaultsKey = [
    institutionQuery.data ?? '',
    institutionQuery.currentRole ?? '',
    isMobileViewport ? 'mobile' : 'desktop',
  ].join(':');

  useLayoutEffect(() => {
    if (
      institutionQuery.isLoading ||
      !institutionQuery.data ||
      !institutionQuery.currentRole ||
      responsiveDefaultsApplied.current === responsiveDefaultsKey
    ) {
      return;
    }

    if (isMobileViewport && institutionQuery.currentRole === 'DIRECTOR') {
      setSetupOpenOverride(false);
      setOperationalOpen(false);
      setPanoramaOpen(false);
    }

    responsiveDefaultsApplied.current = responsiveDefaultsKey;
  }, [
    institutionQuery.data,
    institutionQuery.currentRole,
    institutionQuery.isLoading,
    isMobileViewport,
    responsiveDefaultsKey,
  ]);

  const institutionId = institutionQuery.data ?? '';
  const setupReadinessQuery = useSchoolSetupReadiness(institutionId);
  const defaultSetupOpen = setupReadinessQuery.data?.operationalReadiness.ready !== true;
  const setupOpen = setupOpenOverride ?? defaultSetupOpen;
  const canEditAcademic = canManageAcademicStructure(
    profile?.platform_role,
    institutionQuery.currentRole as Parameters<typeof canManageAcademicStructure>[1],
  );
  const overviewQuery = useAdminOverview(institutionId);

  if (institutionQuery.isLoading) {
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

  if (institutionQuery.isError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
      >
        {getErrorMessage(institutionQuery.error)}
      </div>
    );
  }

  const metrics = overviewQuery.data?.metrics;
  const profileName = profile?.full_name?.trim() || 'Diretor';
  const firstName = getFirstName(profileName);
  const areaLabel = institutionQuery.currentRole === 'DIRECTOR'
    ? 'Área da direção'
    : 'Área administrativa';
  const primaryMetrics: Array<Omit<MetricCardProps, 'availableModuleIds' | 'onNavigateToModule' | 'emphasis'>> = metrics ? [
    {
      label: 'Estudantes ativos',
      value: metrics.activeStudents,
      icon: GraduationCap,
      moduleId: 'students',
    },
    {
      label: 'Docentes ativos',
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
  ] : [];
  const secondaryMetrics: Array<Omit<MetricCardProps, 'availableModuleIds' | 'onNavigateToModule' | 'emphasis'>> = metrics ? [
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
      label: 'Estudantes inativos',
      value: metrics.inactiveStudents,
      icon: Users,
      moduleId: 'students',
    },
  ] : [];

  const metricCardProps = {
    availableModuleIds,
    onNavigateToModule,
  };

  return (
    <div className="min-w-0 space-y-6">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#005bbf] to-[#1a73e8] p-6 text-white shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">
              {areaLabel}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Olá, {firstName}!
            </h1>
          </div>

          <ProfileHeroAvatar
            avatarUrl={profile?.avatar_url}
            fullName={profileName}
            fallback={
              <GraduationCap
                className="h-8 w-8"
                aria-hidden="true"
              />
            }
          />
        </div>
      </section>

      <section aria-labelledby="admin-overview-setup-heading" className="min-w-0">
        <button
          type="button"
          className="flex w-full min-w-0 items-center justify-between gap-4 rounded-xl border border-[#dfe3e8] bg-white p-4 text-left shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-inset dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70 sm:p-5"
          aria-expanded={setupOpen}
          aria-controls="admin-overview-setup-content"
          onClick={() => setSetupOpenOverride((open) => !(open ?? defaultSetupOpen))}
        >
          <span className="min-w-0">
            <span id="admin-overview-setup-heading" role="heading" aria-level={2} className="block text-base font-bold text-[#344054] dark:text-slate-100">
              Configuração da escola
            </span>
            <span className="mt-1 block text-xs text-[#667085] dark:text-slate-400">
              Prontidão, etapas e próximos passos da instituição.
            </span>
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-[#667085] transition-transform dark:text-slate-400 ${setupOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
        <div id="admin-overview-setup-content" hidden={!setupOpen} className="mt-3">
          <SchoolSetupProgress
            institutionId={institutionId}
            canEditAcademic={canEditAcademic}
            showFoundation={institutionQuery.currentRole !== 'DIRECTOR'}
            showOnlyFoundation={institutionQuery.currentRole === 'ADMIN'}
            configurationHref={availableModuleIds.includes('school-users') ? '/admin?module=school-users' : '/admin?module=overview'}
          />
        </div>
      </section>
      <section
        aria-labelledby="admin-overview-operational-heading"
        className="min-w-0 overflow-hidden rounded-xl border border-[#dfe3e8] bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <button
          type="button"
          className="flex w-full min-w-0 items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-inset dark:hover:bg-slate-800/70 sm:p-5"
          aria-expanded={operationalOpen}
          aria-controls="admin-overview-operational-content"
          onClick={() => setOperationalOpen((open) => !open)}
        >
          <span className="min-w-0">
            <span id="admin-overview-operational-heading" role="heading" aria-level={2} className="block text-base font-bold text-[#344054] dark:text-slate-100">
              Resumo operacional
            </span>
            <span className="mt-1 block text-xs text-[#667085] dark:text-slate-400">
              Estrutura acadêmica e vínculos ativos da instituição.
            </span>
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-[#667085] transition-transform dark:text-slate-400 ${operationalOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
        <div
          id="admin-overview-operational-content"
          hidden={!operationalOpen}
          className="space-y-4 border-t border-[#e4e8f1] p-4 dark:border-slate-700 sm:p-5"
        >
          {metrics ? (
            <>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {primaryMetrics.map((metric) => (
                  <MetricCard
                    key={metric.label}
                    {...metric}
                    {...metricCardProps}
                    emphasis="primary"
                  />
                ))}
              </div>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {secondaryMetrics.map((metric) => (
                  <MetricCard
                    key={metric.label}
                    {...metric}
                    {...metricCardProps}
                    emphasis="secondary"
                  />
                ))}
              </div>
            </>
          ) : overviewQuery.isError ? (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              <p>{getErrorMessage(overviewQuery.error)}</p>
              <button type="button" onClick={() => void overviewQuery.refetch()} className="mt-3 min-h-10 rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2">
                Tentar novamente
              </button>
            </div>
          ) : (
            <div role="status" aria-label="Carregando indicadores da escola" className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-lg border border-[#e4e8f1] bg-white motion-reduce:animate-none dark:border-slate-800 dark:bg-slate-900" />
              ))}
            </div>
          )}
        </div>
      </section>

      <section
        aria-labelledby="admin-overview-panorama-heading"
        className="min-w-0 overflow-hidden rounded-xl border border-[#dfe3e8] bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <button
          type="button"
          className="flex w-full min-w-0 items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-inset dark:hover:bg-slate-800/70 sm:p-5"
          aria-expanded={panoramaOpen}
          aria-controls="admin-overview-panorama-content"
          onClick={() => setPanoramaOpen((open) => !open)}
        >
          <span className="min-w-0">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf] dark:text-blue-400">
              Panorama acadêmico
            </span>
            <span id="admin-overview-panorama-heading" role="heading" aria-level={2} className="mt-1 block text-base font-bold text-[#344054] dark:text-slate-100">
              Desempenho, frequência e pontos de atenção
            </span>
            <span className="mt-1 block text-xs text-[#667085] dark:text-slate-400">
              Acompanhe o que exige atenção na escola com dados já lançados.
            </span>
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-[#667085] transition-transform dark:text-slate-400 ${panoramaOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
        <div
          id="admin-overview-panorama-content"
          hidden={!panoramaOpen}
          className="border-t border-[#e4e8f1] p-4 dark:border-slate-700 sm:p-5"
        >
          <DirectorAcademicPanorama
            institutionId={institutionId}
            availableModuleIds={availableModuleIds}
            onNavigateToModule={onNavigateToModule}
            showHeader={false}
          />
        </div>
      </section>
    </div>
  );
}
