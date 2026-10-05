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
  useInstitutionAttendanceSummary,
  useInstitutionPendingAttendanceSummary,
} from '../../hooks/useAttendance';
import { useAcademicYears } from '../../hooks/useAcademicTermClosing';
import { useInstitutionGradeSummary } from '../../hooks/useGrades';
import { getLocalDateInputValue } from '../../lib/academicTermDates';
import type { AdminModuleId } from '../../pages/Admin/adminNavigation';
import type { AcademicYearOption } from '../../services/academicPolicyService';
import {
  buildClassPerformance,
  buildStudentSituationSummary,
  buildWeeklyAttendanceTrend,
  countPendingAcademicItems,
  DEFAULT_PANORAMA_PERIOD,
  mergeStudentSignals,
  type PanoramaStudentSituation,
} from './directorAcademicPanoramaUtils';

type PanoramaPeriod = '7d' | '30d' | 'term' | 'year';

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

  return <article className="rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">{content}</article>;
}

function EmptyChart({ children = 'Sem dados no período selecionado.' }: { children?: string }) {
  return <p className="rounded-lg border border-dashed border-[#d6dce5] px-4 py-8 text-center text-sm text-[#667085] dark:border-slate-700 dark:text-slate-400">{children}</p>;
}

function LoadingChart() {
  return <div className="h-52 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" role="status" aria-label="Carregando dados" />;
}

function AttendanceTrend({
  sessions,
  loading,
  error,
}: {
  sessions: ReturnType<typeof buildWeeklyAttendanceTrend>;
  loading: boolean;
  error: boolean;
}) {
  if (loading) return <LoadingChart />;
  if (error) return <EmptyChart>Não foi possível carregar agora.</EmptyChart>;
  if (sessions.length === 0) return <EmptyChart />;
  const width = 640;
  const height = 220;
  const chartTop = 18;
  const chartBottom = 184;
  const xStep = sessions.length === 1 ? 0 : (width - 48) / (sessions.length - 1);
  const points = sessions.map((point, index) => {
    const x = 24 + index * xStep;
    const y = chartBottom - (Math.max(0, Math.min(100, point.attendanceRate)) / 100) * (chartBottom - chartTop);
    return `${x},${y}`;
  }).join(' ');
  const referenceY = chartBottom - 0.75 * (chartBottom - chartTop);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-52 w-full" role="img" aria-label="Frequência média semanal">
        <line x1="24" x2={width - 24} y1={referenceY} y2={referenceY} stroke="#d97706" strokeDasharray="5 5" strokeWidth="1.5" />
        <polyline points={points} fill="none" stroke="#005bbf" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        {sessions.map((point, index) => {
          const x = 24 + index * xStep;
          const y = chartBottom - (Math.max(0, Math.min(100, point.attendanceRate)) / 100) * (chartBottom - chartTop);
          return <circle key={point.key} cx={x} cy={y} r="4" fill="#005bbf"><title>{`${point.label}: ${formatPercent(point.attendanceRate)}`}</title></circle>;
        })}
        <text x="24" y="211" fill="currentColor" fontSize="11">{sessions[0].label}</text>
        <text x={width - 24} y="211" fill="currentColor" fontSize="11" textAnchor="end">{sessions[sessions.length - 1].label}</text>
        <text x={width - 24} y={referenceY - 6} fill="#b45309" fontSize="11" textAnchor="end">Meta 75%</text>
      </svg>
      <p className="text-xs text-[#667085] dark:text-slate-400">Média calculada sobre registros lançados; atrasos contam como presença.</p>
    </div>
  );
}

function ClassPerformance({
  points,
  loading,
  error,
}: {
  points: ReturnType<typeof buildClassPerformance>;
  loading: boolean;
  error: boolean;
}) {
  if (loading) return <LoadingChart />;
  if (error) return <EmptyChart>Não foi possível carregar agora.</EmptyChart>;
  if (points.length === 0 || points.every((point) => point.total === 0)) {
    return <EmptyChart>Sem notas lançadas no período selecionado.</EmptyChart>;
  }
  return (
    <div className="space-y-4">
      {points.map((point) => (
        <div key={point.classId}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-semibold text-[#344054] dark:text-slate-200">{point.className}</span>
            <span className="shrink-0 text-xs text-[#667085] dark:text-slate-400">{point.total} alunos com nota{point.withoutPerformance > 0 ? ` · ${point.withoutPerformance} sem notas` : ''}</span>
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
}: {
  summaries: ReturnType<typeof buildStudentSituationSummary>;
  loading: boolean;
  error: boolean;
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
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative h-36 w-36 shrink-0 rounded-full" style={{ background: `conic-gradient(${segments})` }} role="img" aria-label={`Situação de ${total} estudantes`}>
        <div className="absolute inset-4 flex items-center justify-center rounded-full bg-white text-center dark:bg-slate-900">
          <span className="text-2xl font-extrabold text-[#181c20] dark:text-white">{total}</span>
        </div>
      </div>
      <div className="grid w-full grid-cols-2 gap-3 text-sm">
        {summaries.map((item) => (
          <div key={item.situation} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[#667085] dark:text-slate-400"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: situationColors[item.situation] }} />{situationLabels[item.situation]}</span>
            <strong className="text-[#181c20] dark:text-white">{item.count}</strong>
          </div>
        ))}
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
  const dateRange = useMemo(() => getDateRange(period, today, currentYear), [currentYear, period, today]);
  const waitingForAcademicYear = period === 'year' && !currentYear && yearsQuery.isFetching;
  const queryInstitutionId = waitingForAcademicYear ? undefined : institutionId;
  const filters = useMemo(() => ({
    fromDate: dateRange.fromDate,
    toDate: dateRange.toDate,
    ...(classId ? { classId } : {}),
  }), [classId, dateRange.fromDate, dateRange.toDate]);

  const attendanceQuery = useInstitutionAttendanceSummary(queryInstitutionId, filters);
  const pendingAttendanceQuery = useInstitutionPendingAttendanceSummary(queryInstitutionId, filters);
  const gradesQuery = useInstitutionGradeSummary(queryInstitutionId, filters);
  const classes = useMemo(() => {
    const options = new Map<string, string>();
    for (const option of attendanceQuery.data?.filters.classes ?? []) options.set(option.id, option.label);
    for (const option of gradesQuery.data?.filters.classes ?? []) options.set(option.id, option.label);
    return Array.from(options.entries()).sort((first, second) => first[1].localeCompare(second[1], 'pt-BR'));
  }, [attendanceQuery.data?.filters.classes, gradesQuery.data?.filters.classes]);
  const attendanceTrend = useMemo(() => buildWeeklyAttendanceTrend(attendanceQuery.data?.sessions ?? []), [attendanceQuery.data?.sessions]);
  const classPerformance = useMemo(() => buildClassPerformance(gradesQuery.data?.studentPerformance ?? []), [gradesQuery.data?.studentPerformance]);
  const studentSummaries = useMemo(() => buildStudentSituationSummary(mergeStudentSignals(attendanceQuery.data?.sessions ?? [], gradesQuery.data?.studentPerformance ?? [])), [attendanceQuery.data?.sessions, gradesQuery.data?.studentPerformance]);
  const pendingItems = useMemo(() => ({
    ...countPendingAcademicItems([], gradesQuery.data?.assessments ?? []),
    attendancePending: pendingAttendanceQuery.data?.pendingCount ?? 0,
  }), [gradesQuery.data?.assessments, pendingAttendanceQuery.data?.pendingCount]);
  const attentionCount = (studentSummaries.find((item) => item.situation === 'ATTENTION')?.count ?? 0) + (studentSummaries.find((item) => item.situation === 'CRITICAL')?.count ?? 0);
  const attendanceLoading = !attendanceQuery.data && attendanceQuery.isPending;
  const gradesLoading = !gradesQuery.data && gradesQuery.isPending;
  const attentionLoading = !attendanceQuery.data && !gradesQuery.data && (attendanceQuery.isPending || gradesQuery.isPending);
  const hasError = attendanceQuery.isError || pendingAttendanceQuery.isError || gradesQuery.isError || yearsQuery.isError;

  return (
    <section aria-labelledby="director-academic-panorama-heading" className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf] dark:text-blue-400">Panorama acadêmico</p>
          <h2 id="director-academic-panorama-heading" className="mt-1 text-xl font-extrabold text-[#181c20] dark:text-white">Desempenho, frequência e pontos de atenção</h2>
          <p className="mt-1 text-sm text-[#667085] dark:text-slate-400">Acompanhe o que exige atenção na escola com dados já lançados.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="text-xs font-semibold text-[#667085] dark:text-slate-400">
            Período
            <select value={period} onChange={(event) => setPeriod(event.target.value as PanoramaPeriod)} className="mt-1 block min-w-44 rounded-lg border border-[#d0d5dd] bg-white px-3 py-2 text-sm font-semibold text-[#344054] focus:border-[#005bbf] focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-[#667085] dark:text-slate-400">
            Turma
            <select value={classId} onChange={(event) => setClassId(event.target.value)} className="mt-1 block min-w-44 rounded-lg border border-[#d0d5dd] bg-white px-3 py-2 text-sm font-semibold text-[#344054] focus:border-[#005bbf] focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <option value="">Todas as turmas</option>
              {classes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
        </div>
      </div>

      <p className="text-xs text-[#667085] dark:text-slate-400">Período aplicado: <strong className="text-[#344054] dark:text-slate-200">{waitingForAcademicYear ? 'carregando ano letivo' : dateRange.label}</strong>{!waitingForAcademicYear && ` (${dateRange.fromDate} a ${dateRange.toDate}).`}</p>

      {hasError && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">Alguns indicadores não puderam ser carregados agora. Os dados disponíveis continuam visíveis.</p>}

      <div className="grid gap-3 md:grid-cols-3">
        <KpiCard label="Frequência média" value={attendanceQuery.isError && !attendanceQuery.data ? 'Não foi possível carregar agora.' : formatPercent(attendanceQuery.data?.summary.attendanceRate)} detail="Registros lançados no período" icon={CalendarCheck2} moduleId="attendance" availableModuleIds={availableModuleIds} onNavigateToModule={onNavigateToModule} loading={attendanceLoading} updating={Boolean(attendanceQuery.data && attendanceQuery.isFetching)} />
        <KpiCard label="Desempenho médio" value={gradesQuery.isError && !gradesQuery.data ? 'Não foi possível carregar agora.' : formatPercent(gradesQuery.data?.summary.averagePercent)} detail="Avaliações com nota lançada" icon={BarChart3} moduleId="grades" availableModuleIds={availableModuleIds} onNavigateToModule={onNavigateToModule} loading={gradesLoading} updating={Boolean(gradesQuery.data && gradesQuery.isFetching)} />
        <KpiCard label="Estudantes em atenção" value={formatCount(attentionCount)} detail="Frequência ou desempenho abaixo do esperado" icon={AlertTriangle} moduleId="students" availableModuleIds={availableModuleIds} onNavigateToModule={onNavigateToModule} loading={attentionLoading} updating={Boolean((attendanceQuery.data || gradesQuery.data) && (attendanceQuery.isFetching || gradesQuery.isFetching))} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(19rem,0.8fr)]">
        <article className="rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
          <div className="mb-4 flex items-start gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#005bbf] dark:bg-blue-950/40 dark:text-blue-300"><CalendarCheck2 className="h-4 w-4" aria-hidden="true" /></span><div><h3 className="font-bold text-[#181c20] dark:text-white">Frequência média ao longo do tempo</h3><p className="text-xs text-[#667085] dark:text-slate-400">Acompanhamento semanal com referência de 75%.</p></div></div>
          <AttendanceTrend sessions={attendanceTrend} loading={attendanceLoading} error={attendanceQuery.isError && !attendanceQuery.data} />
        </article>
        <article className="rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
          <div className="mb-4 flex items-start gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#005bbf] dark:bg-blue-950/40 dark:text-blue-300"><UsersRound className="h-4 w-4" aria-hidden="true" /></span><div><h3 className="font-bold text-[#181c20] dark:text-white">Situação dos estudantes</h3><p className="text-xs text-[#667085] dark:text-slate-400">Frequência e desempenho combinados.</p></div></div>
          <StudentSituation summaries={studentSummaries} loading={attentionLoading} error={Boolean((attendanceQuery.isError && !attendanceQuery.data) && (gradesQuery.isError && !gradesQuery.data))} />
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
          <div className="mb-4 flex items-start gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#005bbf] dark:bg-blue-950/40 dark:text-blue-300"><GraduationCap className="h-4 w-4" aria-hidden="true" /></span><div><h3 className="font-bold text-[#181c20] dark:text-white">Desempenho por turma</h3><p className="text-xs text-[#667085] dark:text-slate-400">Distribuição de alunos com nota lançada.</p></div></div>
          <ClassPerformance points={classPerformance} loading={gradesLoading} error={gradesQuery.isError && !gradesQuery.data} />
        </article>
        <article className="rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
          <div className="mb-4 flex items-start gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#005bbf] dark:bg-blue-950/40 dark:text-blue-300"><ClipboardList className="h-4 w-4" aria-hidden="true" /></span><div><h3 className="font-bold text-[#181c20] dark:text-white">Pendências acadêmicas</h3><p className="text-xs text-[#667085] dark:text-slate-400">Itens que ainda precisam de ação.</p></div></div>
          <div className="space-y-4">
            {[['Chamadas pendentes', pendingItems.attendancePending, 'class-diary' as AdminModuleId], ['Notas faltantes', pendingItems.missingGrades, 'grades' as AdminModuleId], ['Avaliações sem lançamento', pendingItems.assessmentsWithoutLaunch, 'grades' as AdminModuleId]].map(([label, value, moduleId]) => {
              const numericValue = value as number;
              const max = Math.max(1, pendingItems.attendancePending, pendingItems.missingGrades, pendingItems.assessmentsWithoutLaunch);
              const navigable = availableModuleIds.includes(moduleId as AdminModuleId) && Boolean(onNavigateToModule);
              return (
                <button key={label as string} type="button" disabled={!navigable} onClick={() => onNavigateToModule?.(moduleId as AdminModuleId)} className={`w-full text-left ${navigable ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf]' : 'cursor-default'}`}>
                  <div className="mb-1 flex justify-between gap-3 text-sm"><span className="font-semibold text-[#344054] dark:text-slate-200">{label as string}</span><strong className="text-[#181c20] dark:text-white">{label === 'Chamadas pendentes' && pendingAttendanceQuery.isError && !pendingAttendanceQuery.data ? 'Não foi possível carregar agora.' : formatCount(numericValue)}</strong></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><span className="block h-full rounded-full bg-[#005bbf]" style={{ width: `${(numericValue / max) * 100}%` }} /></div>
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
