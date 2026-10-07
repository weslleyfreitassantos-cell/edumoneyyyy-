import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpenCheck,
  CalendarCheck2,
  ClipboardList,
  GraduationCap,
  UsersRound,
} from 'lucide-react';

import {
  useDirectorPanorama,
} from '../../hooks/useDirectorPanorama';
import { useAcademicYears } from '../../hooks/useAcademicTermClosing';
import { useClassOptions } from '../../hooks/useClasses';
import { getLocalDateInputValue } from '../../lib/academicTermDates';
import type { AdminModuleId } from '../../pages/Admin/adminNavigation';
import type { AcademicYearOption } from '../../services/academicPolicyService';
import {
  DEFAULT_PANORAMA_PERIOD,
  getPanoramaMetricDisplay,
  getPanoramaMetricProgress,
  type ActivityPerformanceSummary,
  type ClassPerformancePoint,
  type PanoramaStudentSituation,
  type StudentSituationSummary,
  type WeeklyAttendancePoint,
} from './directorAcademicPanoramaUtils';

type PanoramaPeriod = '7d' | '30d' | '90d' | 'term' | 'year';

interface DirectorAcademicPanoramaProps {
  institutionId: string;
  availableModuleIds: readonly AdminModuleId[];
  onNavigateToModule?: (moduleId: AdminModuleId) => void;
}

interface DateRange {
  fromDate: string;
  toDate: string;
  label: string;
}

const periodOptions: Array<{ value: PanoramaPeriod; label: string }> = [
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 3 meses' },
  { value: 'term', label: 'Bimestre atual' },
  { value: 'year', label: 'Ano letivo' },
];

const situationLabels: Record<PanoramaStudentSituation, string> = {
  REGULAR: 'Regulares',
  ATTENTION: 'Em atenção',
  CRITICAL: 'Críticos',
  NO_DATA: 'Sem dados',
};

const situationColors: Record<PanoramaStudentSituation, string> = {
  REGULAR: '#159570',
  ATTENTION: '#d97706',
  CRITICAL: '#dc4b4b',
  NO_DATA: '#94a3b8',
};

function addLocalDays(value: string, amount: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);
  return getLocalDateInputValue(date);
}

function isDateWithinRange(value: string, startDate: string, endDate: string): boolean {
  return startDate <= value && value <= endDate;
}

function getCurrentAcademicYear(years: readonly AcademicYearOption[], today: string): AcademicYearOption | null {
  return years.find((year) =>
    year.active && isDateWithinRange(today, year.startDate, year.endDate),
  ) ?? years.find((year) => year.active) ?? years[0] ?? null;
}

function getDateRange(
  period: PanoramaPeriod,
  today: string,
  currentYear: AcademicYearOption | null,
): DateRange {
  if (period === '7d') {
    return { fromDate: addLocalDays(today, -6), toDate: today, label: 'últimos 7 dias' };
  }

  if (period === '30d') {
    return { fromDate: addLocalDays(today, -29), toDate: today, label: 'últimos 30 dias' };
  }

  if (period === '90d') {
    return { fromDate: addLocalDays(today, -89), toDate: today, label: 'últimos 3 meses' };
  }

  const currentTerm = currentYear?.terms.find((term) =>
    term.active && isDateWithinRange(today, term.startDate, term.endDate),
  );

  if (period === 'term' && currentTerm) {
    return {
      fromDate: currentTerm.startDate,
      toDate: currentTerm.endDate,
      label: currentTerm.name,
    };
  }

  if (period === 'year' && currentYear) {
    return {
      fromDate: currentYear.startDate,
      toDate: currentYear.endDate,
      label: currentYear.name,
    };
  }

  return {
    fromDate: addLocalDays(today, -29),
    toDate: today,
    label: 'últimos 30 dias',
  };
}

function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? 'Sem dados' : `${value.toLocaleString('pt-BR')}%`;
}

function formatCount(value: number): string {
  return value.toLocaleString('pt-BR');
}

function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  moduleId,
  availableModuleIds,
  onNavigateToModule,
  loading = false,
  updating = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof CalendarCheck2;
  moduleId?: AdminModuleId;
  availableModuleIds: readonly AdminModuleId[];
  onNavigateToModule?: (moduleId: AdminModuleId) => void;
  loading?: boolean;
  updating?: boolean;
}) {
  const navigable = Boolean(
    moduleId && onNavigateToModule && availableModuleIds.includes(moduleId),
  );
  const content = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085] dark:text-slate-400">{label}</p>
        <p className="mt-2 text-2xl font-extrabold text-[#181c20] dark:text-white">
          {loading ? <span className="inline-block h-7 w-24 animate-pulse rounded bg-slate-200 align-middle dark:bg-slate-700" aria-label="Carregando" /> : value}
        </p>
        <p className="mt-1 text-xs text-[#667085] dark:text-slate-400">{updating ? 'Atualizando...' : detail}</p>
      </div>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#005bbf] dark:bg-blue-950/40 dark:text-blue-300">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
    </div>
  );

  if (navigable) {
    return (
      <button
        type="button"
        className="w-full rounded-xl border border-[#dfe3e8] bg-white p-4 text-left shadow-sm transition hover:border-[#9ebce6] hover:bg-[#fbfdff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-700"
        onClick={() => onNavigateToModule?.(moduleId!)}
      >
        {content}
      </button>
    );
  }

  return <article className="min-w-0 rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">{content}</article>;
}

function EmptyChart({
  children = 'Sem dados no período selecionado.',
  action,
}: {
  children?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-lg border border-dashed border-[#d6dce5] px-4 py-6 text-center text-sm text-[#667085] dark:border-slate-700 dark:text-slate-400">
      <p>{children}</p>
      {action && (
        <button
          type="button"
          className="mt-3 rounded-lg border border-[#b8c7db] bg-white px-3 py-2 text-xs font-semibold text-[#005bbf] transition hover:border-[#005bbf] hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-900 dark:text-blue-300 dark:hover:border-blue-400 dark:hover:bg-slate-800"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

function LoadingChart() {
  return (
    <div
      className="flex h-56 items-center justify-center rounded-xl border border-[#e5eaf0] bg-slate-50/70 dark:border-slate-700 dark:bg-slate-950/30"
      role="status"
      aria-label="Carregando dados"
      aria-busy="true"
    >
      <span className="inline-flex items-center gap-2 text-xs text-[#667085] dark:text-slate-400">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#005bbf]" aria-hidden="true" />
        Carregando dados do gráfico...
      </span>
    </div>
  );
}

function AttendanceTrend({
  sessions,
  loading,
  error,
  onRetry,
}: {
  sessions: WeeklyAttendancePoint[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  if (loading) return <LoadingChart />;
  if (error) {
    return (
      <EmptyChart
        action={{ label: 'Tentar novamente', onClick: onRetry }}
      >
        Não foi possível carregar agora.
      </EmptyChart>
    );
  }
  if (sessions.length === 0) return <EmptyChart />;
  const latest = sessions[sessions.length - 1];
  const latestDelta = Math.round((latest.attendanceRate - 75) * 10) / 10;
  const latestStatus = latestDelta >= 0 ? 'Acima da meta' : 'Abaixo da meta';
  const latestStatusClass = latestDelta >= 0
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
  const labelStep = Math.max(1, Math.ceil(Math.max(1, sessions.length - 1) / 5));
  const labelIndexes = new Set(
    sessions
      .map((_, index) => index)
      .filter((index) => index % labelStep === 0 || index === sessions.length - 1),
  );
  const chartMinWidth = Math.max(640, sessions.length * 22);
  const guideValues = [100, 75, 50, 25, 0];
  const viewBoxWidth = 760;
  const viewBoxHeight = 300;
  const plotLeft = 54;
  const plotRight = 730;
  const plotTop = 22;
  const plotBottom = 220;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;
  const lastIndex = Math.max(1, sessions.length - 1);
  const xForIndex = (index: number) => plotLeft + (index / lastIndex) * plotWidth;
  const yForRate = (rate: number) => plotBottom - (Math.max(0, Math.min(100, rate)) / 100) * plotHeight;
  const chartPoints = sessions.map((point, index) => ({
    point,
    x: xForIndex(index),
    y: yForRate(point.attendanceRate),
  }));
  const linePath = chartPoints
    .map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ');
  const areaPath = `${linePath} L ${xForIndex(sessions.length - 1).toFixed(2)} ${plotBottom} L ${plotLeft} ${plotBottom} Z`;

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-blue-50 px-3 py-1.5 font-semibold text-[#005bbf] dark:bg-blue-950/40 dark:text-blue-300">
          Última semana: {formatPercent(latest.attendanceRate)}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-[#667085] dark:bg-slate-800 dark:text-slate-300">
          Meta: 75%
        </span>
        <span className={`rounded-full px-3 py-1.5 font-medium ${latestStatusClass}`}>
          {latestStatus}
        </span>
      </div>
      <div className="min-w-0 overflow-x-auto rounded-xl border border-[#e5eaf0] bg-slate-50/70 px-2 py-2 dark:border-slate-700 dark:bg-slate-950/30 sm:px-3">
        <svg
          className="h-72 w-full"
          style={{ minWidth: `${chartMinWidth}px` }}
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Frequência média semanal ao longo do tempo"
        >
          <rect x="0" y="0" width={viewBoxWidth} height={viewBoxHeight} rx="14" fill="transparent" />
          {guideValues.map((value) => {
            const y = yForRate(value);
            const isTarget = value === 75;
            return (
              <g key={value}>
                <line
                  x1={plotLeft}
                  y1={y}
                  x2={plotRight}
                  y2={y}
                  stroke={isTarget ? '#d99a2b' : '#dfe6ee'}
                  strokeDasharray={isTarget ? '6 5' : undefined}
                  strokeWidth={isTarget ? 1.5 : 1}
                />
                <text
                  x={plotLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fontWeight={isTarget ? 700 : 400}
                  fill={isTarget ? '#a66b06' : '#98a2b3'}
                >
                  {value}%
                </text>
              </g>
            );
          })}
          <path d={areaPath} fill="#bfdbfe" fillOpacity="0.45" />
          <path
            d={linePath}
            fill="none"
            stroke="#005bbf"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {chartPoints.map(({ point, x, y }, index) => {
            const isLatest = index === sessions.length - 1;
            return (
              <g key={point.key}>
                <title>{`${point.label}: ${formatPercent(point.attendanceRate)} (${point.totalRecords} registros)`}</title>
                <circle
                  cx={x}
                  cy={y}
                  r={isLatest ? 5 : 4}
                  fill={isLatest ? '#005bbf' : '#3b82f6'}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              </g>
            );
          })}
          {sessions.map((point, index) => {
            if (!labelIndexes.has(index)) return null;
            const isFirst = index === 0;
            const isLast = index === sessions.length - 1;
            const [day, month] = point.label.split(' de ');
            return (
              <text
                key={point.key}
                x={xForIndex(index)}
                y={plotBottom + 29}
                textAnchor={isFirst ? 'start' : isLast ? 'end' : 'middle'}
                fontSize="11"
                fill="#667085"
              >
                <tspan x={xForIndex(index)}>{day}</tspan>
                <tspan x={xForIndex(index)} dy="14">{month ?? ''}</tspan>
              </text>
            );
          })}
        </svg>
      </div>
      <p className="text-xs text-[#667085] dark:text-slate-400">Cada ponto representa uma semana; as datas aparecem a cada {labelStep} semanas. Passe o cursor sobre um ponto para ver a data exata e os registros.</p>
    </div>
  );
}

function ClassPerformance({
  points,
  loading,
  error,
}: {
  points: ClassPerformancePoint[];
  loading: boolean;
  error: boolean;
}) {
  if (loading) return <LoadingChart />;
  if (error) return <EmptyChart>Não foi possível carregar agora.</EmptyChart>;
  if (points.length === 0 || points.every((point) => point.total === 0)) {
    return <EmptyChart>Sem notas lançadas no período selecionado.</EmptyChart>;
  }
  return (
    <div className="min-w-0 space-y-4">
      {points.map((point) => (
        <div key={point.classId}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-semibold text-[#344054] dark:text-slate-200">{point.className}</span>
            <span className="shrink-0 text-right text-xs text-[#667085] dark:text-slate-400">{point.total} alunos com nota{point.withoutPerformance > 0 ? ` · ${point.withoutPerformance} sem notas` : ''}</span>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-label={`${point.className}: ${point.adequate} adequadas, ${point.attention} em atenção, ${point.critical} críticas`}>
            {point.adequate > 0 && <span className="bg-[#159570]" style={{ width: `${(point.adequate / point.total) * 100}%` }} />}
            {point.attention > 0 && <span className="bg-[#d97706]" style={{ width: `${(point.attention / point.total) * 100}%` }} />}
            {point.critical > 0 && <span className="bg-[#dc4b4b]" style={{ width: `${(point.critical / point.total) * 100}%` }} />}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-3 text-xs text-[#667085] dark:text-slate-400">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#159570]" />Adequada ≥70%</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#d97706]" />Atenção 50–69,9%</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#dc4b4b]" />Crítica &lt;50%</span>
      </div>
    </div>
  );
}

function StudentSituation({
  summaries,
  loading,
  error,
  activityPerformance,
  activityLoading,
  activityUnavailable,
}: {
  summaries: StudentSituationSummary[];
  loading: boolean;
  error: boolean;
  activityPerformance: ActivityPerformanceSummary;
  activityLoading: boolean;
  activityUnavailable: boolean;
}) {
  if (loading) return <LoadingChart />;
  if (error) return <EmptyChart>Não foi possível carregar agora.</EmptyChart>;
  const total = summaries.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) return <EmptyChart>Sem estudantes com dados no período selecionado.</EmptyChart>;
  let offset = 0;
  const segments = summaries.map((item) => {
    const start = offset;
    offset += (item.count / total) * 100;
    return `${situationColors[item.situation]} ${start}% ${offset}%`;
  }).join(', ');

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex w-full min-w-0 flex-col items-center gap-5 md:flex-row md:items-center">
        <div className="relative h-36 w-36 shrink-0 rounded-full" style={{ background: `conic-gradient(${segments})` }} role="img" aria-label={`Situação de ${total} estudantes`}>
          <div className="absolute inset-4 flex items-center justify-center rounded-full bg-white text-center dark:bg-slate-900">
            <span className="text-2xl font-extrabold text-[#181c20] dark:text-white">{total}</span>
          </div>
        </div>
        <div className="grid w-full min-w-0 grid-cols-2 gap-3 text-sm">
          {summaries.map((item) => (
            <div key={item.situation} className="flex items-center justify-between gap-2">
              <span className="min-w-0 break-words text-[#667085] dark:text-slate-400"><i className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: situationColors[item.situation] }} />{situationLabels[item.situation]}</span>
              <strong className="shrink-0 text-[#181c20] dark:text-white">{item.count}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full border-t border-[#e5eaf0] pt-4 dark:border-slate-700">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#667085] dark:text-slate-400">Desempenho nas atividades</p>
            <p className="mt-1 text-xs text-[#667085] dark:text-slate-400">Distribuição das avaliações do período.</p>
          </div>
          {!activityLoading && !activityUnavailable && activityPerformance.totalActivities > 0 && (
            <strong className="shrink-0 text-right text-xs text-[#344054] dark:text-slate-200">{formatCount(activityPerformance.totalActivities)} atividades</strong>
          )}
        </div>
        {activityLoading ? (
          <div className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-[#667085] dark:bg-slate-800/50 dark:text-slate-400">Carregando desempenho...</div>
        ) : activityUnavailable ? (
          <div className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-[#667085] dark:bg-slate-800/50 dark:text-slate-400">Não foi possível carregar o desempenho das atividades.</div>
        ) : activityPerformance.totalActivities === 0 ? (
          <div className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-[#667085] dark:bg-slate-800/50 dark:text-slate-400">Nenhuma atividade avaliada no período.</div>
        ) : (
          <>
            <div className="flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="img" aria-label="Distribuição do desempenho nas atividades">
              <span className="bg-[#159570]" style={{ width: `${(activityPerformance.aboveTarget / activityPerformance.totalActivities) * 100}%` }} />
              <span className="bg-[#d97706]" style={{ width: `${(activityPerformance.attention / activityPerformance.totalActivities) * 100}%` }} />
              <span className="bg-[#dc4b4b]" style={{ width: `${(activityPerformance.critical / activityPerformance.totalActivities) * 100}%` }} />
              <span className="bg-slate-300 dark:bg-slate-600" style={{ width: `${(activityPerformance.withoutAverage / activityPerformance.totalActivities) * 100}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs lg:grid-cols-4">
              <div><p className="flex items-center gap-1.5 text-[#667085] dark:text-slate-400"><i className="h-2 w-2 rounded-full bg-[#159570]" />70% ou mais</p><strong className="text-base text-[#181c20] dark:text-white">{formatCount(activityPerformance.aboveTarget)}</strong></div>
              <div><p className="flex items-center gap-1.5 text-[#667085] dark:text-slate-400"><i className="h-2 w-2 rounded-full bg-[#d97706]" />50% a 69%</p><strong className="text-base text-[#181c20] dark:text-white">{formatCount(activityPerformance.attention)}</strong></div>
              <div><p className="flex items-center gap-1.5 text-[#667085] dark:text-slate-400"><i className="h-2 w-2 rounded-full bg-[#dc4b4b]" />Abaixo de 50%</p><strong className="text-base text-[#181c20] dark:text-white">{formatCount(activityPerformance.critical)}</strong></div>
              <div><p className="flex items-center gap-1.5 text-[#667085] dark:text-slate-400"><i className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />Sem média</p><strong className="text-base text-[#181c20] dark:text-white">{formatCount(activityPerformance.withoutAverage)}</strong></div>
            </div>
            <p className="mt-3 text-xs text-[#667085] dark:text-slate-400">{formatCount(activityPerformance.launchedActivities)} com lançamento · {formatCount(activityPerformance.pendingGrades)} notas pendentes</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function DirectorAcademicPanorama({
  institutionId,
  availableModuleIds,
  onNavigateToModule,
}: DirectorAcademicPanoramaProps) {
  const [period, setPeriod] = useState<PanoramaPeriod>(DEFAULT_PANORAMA_PERIOD);
  const [classId, setClassId] = useState('');
  const today = getLocalDateInputValue();
  const yearsQuery = useAcademicYears(institutionId);
  const currentYear = useMemo(() => getCurrentAcademicYear(yearsQuery.data ?? [], today), [today, yearsQuery.data]);
  const currentTerm = useMemo(() => currentYear?.terms.find((term) =>
    term.active && isDateWithinRange(today, term.startDate, term.endDate),
  ) ?? null, [currentYear, today]);
  const dateRange = useMemo(() => getDateRange(period, today, currentYear), [currentYear, period, today]);
  const waitingForAcademicYear = ['term', 'year'].includes(period) && !currentYear && yearsQuery.isFetching;
  const queryInstitutionId = waitingForAcademicYear ? undefined : institutionId;
  const filters = useMemo(() => ({
    fromDate: dateRange.fromDate,
    toDate: dateRange.toDate,
    ...(classId ? { classId } : {}),
    ...(period === 'term' && currentTerm ? { termId: currentTerm.id } : {}),
    ...(period === 'year' && currentYear ? { academicYearId: currentYear.id } : {}),
  }), [classId, currentTerm, currentYear, dateRange.fromDate, dateRange.toDate, period]);

  const panoramaQuery = useDirectorPanorama(queryInstitutionId, filters);
  const classOptionsQuery = useClassOptions(institutionId);
  const classes = useMemo(() => (classOptionsQuery.data ?? [])
    .map((option) => [option.id, option.name] as [string, string])
    .sort((first, second) => first[1].localeCompare(second[1], 'pt-BR')),
  [classOptionsQuery.data]);
  const attendanceTrend = panoramaQuery.data?.attendance.weekly ?? [];
  const classPerformance = panoramaQuery.data?.classes ?? [];
  const activityPerformance: ActivityPerformanceSummary = panoramaQuery.data?.performance.activities ?? {
    totalActivities: 0,
    aboveTarget: 0,
    attention: 0,
    critical: 0,
    withoutAverage: 0,
    launchedActivities: 0,
    pendingGrades: 0,
  };
  const studentSummaries = panoramaQuery.data?.students.situations ?? [];
  const pendingItems = panoramaQuery.data?.pending ?? {
    attendancePending: 0,
    missingGrades: 0,
    assessmentsWithoutLaunch: 0,
  };
  const attentionCount = (studentSummaries.find((item) => item.situation === 'ATTENTION')?.count ?? 0) + (studentSummaries.find((item) => item.situation === 'CRITICAL')?.count ?? 0);
  const panoramaUnavailable = panoramaQuery.isError && !panoramaQuery.data;
  const attendanceUnavailable = panoramaUnavailable;
  const gradesUnavailable = panoramaUnavailable;
  const attentionUnavailable = panoramaUnavailable;
  const attendanceLoading = !panoramaQuery.data && panoramaQuery.isPending;
  const attendanceTrendLoading = waitingForAcademicYear || attendanceLoading;
  const attendanceTrendError = panoramaUnavailable;
  const gradesLoading = attendanceLoading;
  const attentionLoading = !panoramaUnavailable && attendanceLoading;
  const hasError = panoramaQuery.isError || yearsQuery.isError || classOptionsQuery.isError;
  const pendingMetrics = [
    { label: 'Chamadas pendentes', value: pendingItems.attendancePending, unavailable: panoramaUnavailable, loading: attendanceLoading, moduleId: 'class-diary' as AdminModuleId },
    { label: 'Notas pendentes', value: pendingItems.missingGrades, detail: 'Lançamentos aluno × avaliação que ainda precisam ser preenchidos.', unavailable: panoramaUnavailable, loading: gradesLoading, moduleId: 'grades' as AdminModuleId },
    { label: 'Avaliações sem lançamento', value: pendingItems.assessmentsWithoutLaunch, unavailable: panoramaUnavailable, loading: gradesLoading, moduleId: 'grades' as AdminModuleId },
  ];
  const availablePendingValues = pendingMetrics.filter((metric) => !metric.unavailable && !metric.loading).map((metric) => metric.value);
  const pendingMax = Math.max(1, ...availablePendingValues);

  return (
    <section aria-labelledby="director-academic-panorama-heading" className="w-full min-w-0 space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf] dark:text-blue-400">Panorama acadêmico</p>
          <h2 id="director-academic-panorama-heading" className="mt-1 text-xl font-extrabold text-[#181c20] dark:text-white">Desempenho, frequência e pontos de atenção</h2>
          <p className="mt-1 text-sm text-[#667085] dark:text-slate-400">Acompanhe o que exige atenção na escola com dados já lançados.</p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <label className="min-w-0 text-xs font-semibold text-[#667085] dark:text-slate-400">
            Período
            <select value={period} onChange={(event) => setPeriod(event.target.value as PanoramaPeriod)} className="mt-1 block w-full min-w-0 rounded-lg border border-[#d0d5dd] bg-white px-3 py-2 text-sm font-semibold text-[#344054] focus:border-[#005bbf] focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:w-auto sm:min-w-44">
              {periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="min-w-0 text-xs font-semibold text-[#667085] dark:text-slate-400">
            Turma
            <select value={classId} onChange={(event) => setClassId(event.target.value)} className="mt-1 block w-full min-w-0 rounded-lg border border-[#d0d5dd] bg-white px-3 py-2 text-sm font-semibold text-[#344054] focus:border-[#005bbf] focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:w-auto sm:min-w-44">
              <option value="">Todas as turmas</option>
              {classes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
        </div>
      </div>

      <p className="text-xs text-[#667085] dark:text-slate-400">Período aplicado: <strong className="text-[#344054] dark:text-slate-200">{waitingForAcademicYear ? 'carregando ano letivo' : dateRange.label}</strong>{!waitingForAcademicYear && ` (${dateRange.fromDate} a ${dateRange.toDate}).`}</p>

      {hasError && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">Alguns indicadores não puderam ser carregados agora. Os dados disponíveis continuam visíveis.</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Frequência média" value={attendanceUnavailable ? 'Não foi possível carregar agora.' : formatPercent(panoramaQuery.data?.attendance.summary.attendanceRate)} detail="Registros lançados no período" icon={CalendarCheck2} moduleId="attendance" availableModuleIds={availableModuleIds} onNavigateToModule={onNavigateToModule} loading={attendanceLoading} updating={Boolean(panoramaQuery.data && panoramaQuery.isFetching)} />
        <KpiCard label="Desempenho médio" value={gradesUnavailable ? 'Não foi possível carregar agora.' : formatPercent(panoramaQuery.data?.performance.summary.averagePercent)} detail="Avaliações com nota lançada" icon={BarChart3} moduleId="grades" availableModuleIds={availableModuleIds} onNavigateToModule={onNavigateToModule} loading={gradesLoading} updating={Boolean(panoramaQuery.data && panoramaQuery.isFetching)} />
        <KpiCard label="Estudantes em atenção" value={getPanoramaMetricDisplay(formatCount(attentionCount), attentionUnavailable)} detail="Frequência ou desempenho abaixo do esperado" icon={AlertTriangle} moduleId="students" availableModuleIds={availableModuleIds} onNavigateToModule={onNavigateToModule} loading={attentionLoading} updating={Boolean(panoramaQuery.data && panoramaQuery.isFetching)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(19rem,0.8fr)]">
        <article className="min-w-0 rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
          <div className="mb-4 flex items-start gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#005bbf] dark:bg-blue-950/40 dark:text-blue-300"><CalendarCheck2 className="h-4 w-4" aria-hidden="true" /></span><div><h3 className="font-bold text-[#181c20] dark:text-white">Frequência média ao longo do tempo</h3><p className="text-xs text-[#667085] dark:text-slate-400">Acompanhamento semanal com referência de 75%.</p></div></div>
          <AttendanceTrend
            sessions={attendanceTrend}
            loading={attendanceTrendLoading}
            error={attendanceTrendError}
            onRetry={() => void panoramaQuery.refetch()}
          />
        </article>
        <article className="min-w-0 rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
          <div className="mb-4 flex items-start gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#005bbf] dark:bg-blue-950/40 dark:text-blue-300"><UsersRound className="h-4 w-4" aria-hidden="true" /></span><div><h3 className="font-bold text-[#181c20] dark:text-white">Situação dos estudantes</h3><p className="text-xs text-[#667085] dark:text-slate-400">Frequência e desempenho combinados.</p></div></div>
          <StudentSituation
            summaries={studentSummaries}
            loading={attentionLoading}
            error={panoramaUnavailable}
            activityPerformance={activityPerformance}
            activityLoading={gradesLoading}
            activityUnavailable={gradesUnavailable}
          />
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <article className="min-w-0 rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
          <div className="mb-4 flex items-start gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#005bbf] dark:bg-blue-950/40 dark:text-blue-300"><GraduationCap className="h-4 w-4" aria-hidden="true" /></span><div><h3 className="font-bold text-[#181c20] dark:text-white">Desempenho por turma</h3><p className="text-xs text-[#667085] dark:text-slate-400">Distribuição de alunos com nota lançada.</p></div></div>
          <ClassPerformance points={classPerformance} loading={gradesLoading} error={panoramaUnavailable} />
        </article>
        <article className="min-w-0 rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
          <div className="mb-4 flex items-start gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#005bbf] dark:bg-blue-950/40 dark:text-blue-300"><ClipboardList className="h-4 w-4" aria-hidden="true" /></span><div><h3 className="font-bold text-[#181c20] dark:text-white">Pendências acadêmicas</h3><p className="text-xs text-[#667085] dark:text-slate-400">Itens que ainda precisam de ação.</p></div></div>
          <div className="space-y-4">
            {pendingMetrics.map((metric) => {
              const navigable = !metric.unavailable && !metric.loading && availableModuleIds.includes(metric.moduleId) && Boolean(onNavigateToModule);
              return (
                <button key={metric.label} type="button" disabled={!navigable} onClick={() => onNavigateToModule?.(metric.moduleId)} className={`min-h-11 w-full text-left ${navigable ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf]' : 'cursor-default'}`}>
                  <div className="mb-1 flex items-start justify-between gap-3 text-sm"><span className="min-w-0 break-words font-semibold text-[#344054] dark:text-slate-200">{metric.label}</span><strong className="shrink-0 text-right text-[#181c20] dark:text-white">{metric.loading ? 'Carregando...' : getPanoramaMetricDisplay(formatCount(metric.value), metric.unavailable)}</strong></div>
                  {metric.detail && <p className="mb-1 break-words text-xs text-[#667085] dark:text-slate-400">{metric.detail}</p>}
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><span className="block h-full rounded-full bg-[#005bbf]" style={{ width: `${getPanoramaMetricProgress(metric.value, pendingMax, metric.unavailable || metric.loading)}%` }} /></div>
                </button>
              );
            })}
          </div>
        </article>
      </div>

      <p className="flex items-center gap-2 text-xs text-[#667085] dark:text-slate-400"><BookOpenCheck className="h-4 w-4" aria-hidden="true" />A situação “sem dados” não é tratada como problema: indica apenas que ainda não há frequência nem notas lançadas para o estudante no período.</p>
    </section>
  );
}
