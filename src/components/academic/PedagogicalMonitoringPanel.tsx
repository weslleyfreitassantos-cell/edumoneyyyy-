import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FilterX,
  Gauge,
  GraduationCap,
  Search,
  SlidersHorizontal,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';

import { usePedagogicalMonitoring } from '../../hooks/usePedagogicalMonitoring';
import type { PedagogicalRiskLevel, PedagogicalStudentSummary } from '../../services/pedagogicalMonitoringService';

const riskLabels: Record<PedagogicalRiskLevel, string> = { NORMAL: 'Normal', ATTENTION: 'Atenção', CRITICAL: 'Crítico' };
const riskClasses: Record<PedagogicalRiskLevel, string> = {
  NORMAL: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  ATTENTION: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
  CRITICAL: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300',
};

function getErrorMessage(error: unknown): string { return error instanceof Error ? error.message : 'Não foi possível carregar o acompanhamento pedagógico.'; }
function formatPercentage(value: number | null): string { return value === null ? '—' : `${value.toLocaleString('pt-BR')}%`; }

function RiskBadge({ level }: { level: PedagogicalRiskLevel }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${riskClasses[level]}`}>{riskLabels[level]}</span>;
}

function MetricCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string | number; detail: string; icon: LucideIcon; tone: string }) {
  return <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">{value}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p></div><span className={`rounded-lg p-2 ${tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></span></div></article>;
}

function Pagination({ page, pageCount, pageSize, total, onPageChange, onPageSizeChange }: { page: number; pageCount: number; pageSize: number; total: number; onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void }) {
  if (total === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800"><span className="text-xs text-slate-500 dark:text-slate-400">Mostrando {first}–{last} de {total}</span><div className="flex items-center gap-2"><label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">Por página<select aria-label="Alunos por página" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">{[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}</select></label><button type="button" aria-label="Página anterior" disabled={page === 1} onClick={() => onPageChange(page - 1)} className="rounded-lg border border-slate-300 p-1.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button><span className="min-w-16 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">{page} / {pageCount}</span><button type="button" aria-label="Próxima página" disabled={page === pageCount} onClick={() => onPageChange(page + 1)} className="rounded-lg border border-slate-300 p-1.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button></div></div>;
}

function StudentDetails({ student, onClose, detailRef }: { student: PedagogicalStudentSummary; onClose: () => void; detailRef: RefObject<HTMLElement> }) {
  return <section ref={detailRef} tabIndex={-1} className="rounded-xl border border-blue-200 bg-blue-50/60 p-5 outline-none dark:border-blue-900/60 dark:bg-blue-950/20" aria-label={`Detalhes de ${student.fullName}`}>
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">Detalhes do aluno</p><h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{student.fullName}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">RA {student.registrationNumber} · {student.className}</p></div><button type="button" aria-label="Fechar detalhes" onClick={onClose} className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><X className="h-4 w-4" aria-hidden="true" /></button></div>
    <div className="mt-4 flex flex-wrap items-center gap-2"><RiskBadge level={student.risk.level} /><span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">{student.dataStatus === 'OFFICIAL' ? 'Resultado oficial' : 'Dados parciais'}</span></div>
    <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><div><dt className="text-xs text-slate-500 dark:text-slate-400">Média</dt><dd className="font-bold text-slate-900 dark:text-white">{formatPercentage(student.averageGrade)}</dd></div><div><dt className="text-xs text-slate-500 dark:text-slate-400">Frequência</dt><dd className="font-bold text-slate-900 dark:text-white">{formatPercentage(student.attendancePercentage)}</dd></div><div><dt className="text-xs text-slate-500 dark:text-slate-400">Pendências</dt><dd className="font-bold text-slate-900 dark:text-white">{student.pendingItems}</dd></div><div><dt className="text-xs text-slate-500 dark:text-slate-400">Disciplinas</dt><dd className="font-bold text-slate-900 dark:text-white">{student.subjects.length}</dd></div></dl>
    <div className="mt-5"><h3 className="text-sm font-bold text-slate-900 dark:text-white">Motivos do risco</h3>{student.risk.reasons.length > 0 ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">{student.risk.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Nenhum sinal de atenção.</p>}</div>
    <div className="mt-5"><h3 className="text-sm font-bold text-slate-900 dark:text-white">Resumo por disciplina</h3><div className="mt-2 space-y-2">{student.subjects.map((subject) => <article key={subject.subjectOfferingId} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold text-slate-900 dark:text-white">{subject.subjectName}</p><p className="text-xs text-slate-500 dark:text-slate-400">{subject.teacherName}</p></div><span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{subject.isClosed ? 'Oficial' : 'Parcial'}</span></div><p className="mt-2 text-xs text-slate-600 dark:text-slate-300">Média {formatPercentage(subject.gradePercentage)} · Frequência {formatPercentage(subject.attendancePercentage)} · {subject.pendingItems} pendência(s)</p></article>)}</div></div>
  </section>;
}

function isCompactViewport(): boolean {
  return typeof window === 'undefined' || !window.matchMedia || window.matchMedia('(max-width: 1279px)').matches;
}

export default function PedagogicalMonitoringPanel({ institutionId: providedInstitutionId }: { institutionId?: string }) {
  const [academicYearId, setAcademicYearId] = useState('');
  const [termId, setTermId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherProfileId, setTeacherProfileId] = useState('');
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<'ALL' | PedagogicalRiskLevel>('ALL');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  const detailOriginRef = useRef<HTMLElement | null>(null);
  const filters = useMemo(() => ({ academicYearId: academicYearId || undefined, termId: termId || undefined, classId: classId || undefined, subjectId: subjectId || undefined, teacherProfileId: teacherProfileId || undefined }), [academicYearId, classId, subjectId, teacherProfileId, termId]);
  const query = usePedagogicalMonitoring(providedInstitutionId, filters);
  const data = query.data;
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
  const filteredStudents = useMemo(() => (data?.students ?? []).filter((student) => { const matchesSearch = !normalizedSearch || `${student.fullName} ${student.registrationNumber}`.toLocaleLowerCase('pt-BR').includes(normalizedSearch); return matchesSearch && (riskFilter === 'ALL' || student.risk.level === riskFilter); }), [data?.students, normalizedSearch, riskFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const visibleStudents = filteredStudents.slice((page - 1) * pageSize, page * pageSize);
  const selectedStudent = visibleStudents.find((student) => student.studentId === selectedStudentId) ?? null;

  useEffect(() => { setPage(1); }, [normalizedSearch, riskFilter, pageSize, academicYearId, termId, classId, subjectId, teacherProfileId]);
  useEffect(() => {
    if (selectedStudentId && !visibleStudents.some((student) => student.studentId === selectedStudentId)) {
      setSelectedStudentId(null);
    }
  }, [selectedStudentId, visibleStudents]);
  useEffect(() => {
    if (!selectedStudentId) return;
    const compactViewport = isCompactViewport();
    const previousOverflow = document.body.style.overflow;
    const focusOrigin = detailOriginRef.current;
    const focusDetail = () => {
      const closeButton = detailRef.current?.querySelector<HTMLElement>('[aria-label="Fechar detalhes"]');
      (closeButton ?? detailRef.current)?.focus();
    };
    const animationFrame = window.requestAnimationFrame(focusDetail);
    const getFocusableElements = () => (Array.from(detailRef.current?.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []) as HTMLElement[]).filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSelectedStudentId(null);
        return;
      }
      if (!compactViewport || event.key !== 'Tab') return;
      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    if (compactViewport) document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      if (compactViewport) {
        document.body.style.overflow = previousOverflow;
      }
      if (focusOrigin && focusOrigin.isConnected) focusOrigin.focus();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedStudentId]);
  const advancedFilterCount = [academicYearId, termId, classId, subjectId, teacherProfileId].filter(Boolean).length;
  const advancedFiltersLabel = advancedFilterCount > 0 ? `Filtros +${advancedFilterCount}` : 'Filtros avançados';
  const clearFilters = () => { setAcademicYearId(''); setTermId(''); setClassId(''); setSubjectId(''); setTeacherProfileId(''); setSearch(''); setRiskFilter('ALL'); setSelectedStudentId(null); };

  return <section className="min-w-0 space-y-5">
    <header className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 items-start gap-3"><span className="rounded-lg bg-blue-100 p-2 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><BarChart3 className="h-5 w-5" aria-hidden="true" /></span><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-400">Acompanhamento pedagógico</p><h1 className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">Desempenho e atenção acadêmica</h1><p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">Revise alunos por risco, identifique sinais e abra o detalhe apenas quando necessário.</p></div></div><button type="button" onClick={clearFilters} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><FilterX className="h-4 w-4" aria-hidden="true" />Limpar filtros</button></header>
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-col gap-3 lg:flex-row lg:items-end"><label className="min-w-0 flex-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Buscar aluno por nome ou RA<input aria-label="Buscar aluno por nome ou RA" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou número de matrícula" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label><div className="flex min-w-0 flex-1 flex-wrap gap-2" role="group" aria-label="Filtrar por risco">{(['ALL', 'CRITICAL', 'ATTENTION', 'NORMAL'] as const).map((level) => <button key={level} type="button" onClick={() => setRiskFilter(level)} className={`rounded-full border px-3 py-2 text-xs font-bold ${riskFilter === level ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{level === 'ALL' ? 'Todos os riscos' : riskLabels[level]}</button>)}</div><button type="button" onClick={() => setAdvancedOpen((open) => !open)} aria-expanded={advancedOpen} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" />{advancedFiltersLabel}</button></div>{advancedOpen && <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800"><label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ano letivo<select aria-label="Ano letivo" value={academicYearId} onChange={(event) => { setAcademicYearId(event.target.value); setTermId(''); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">Atual</option>{data?.filters.years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></label><label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Período<select aria-label="Período" value={termId} onChange={(event) => setTermId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">Atual</option>{data?.filters.terms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</select></label><label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Turma<select aria-label="Turma" value={classId} onChange={(event) => setClassId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">Todas</option>{data?.filters.classes.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Disciplina<select aria-label="Disciplina" value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">Todas</option>{data?.filters.subjects.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:col-span-2">Professor<select aria-label="Professor" value={teacherProfileId} onChange={(event) => setTeacherProfileId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">Todos</option>{data?.filters.teachers.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label></div>}</section>
    {query.isLoading && <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">Carregando acompanhamento pedagógico...</div>}{query.isError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{getErrorMessage(query.error)}</div>}
    {data && <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MetricCard label="Alunos monitorados" value={data.metrics.monitoredStudents} detail={`${data.metrics.officialStudents} oficiais · ${data.metrics.partialStudents} parciais`} icon={Users} tone="bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" /><MetricCard label="Críticos" value={data.metrics.criticalStudents} detail="Prioridade de acompanhamento" icon={AlertTriangle} tone="bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300" /><MetricCard label="Atenção" value={data.metrics.attentionStudents} detail={`${data.metrics.lowAttendanceStudents} com baixa frequência`} icon={Gauge} tone="bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300" /><MetricCard label="Fechamentos" value={`${data.metrics.closedOfferings}/${data.metrics.totalOfferings}`} detail={`${data.metrics.pendingStudents} aluno(s) pendente(s)`} icon={ClipboardCheck} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" /></div><div className="flex flex-wrap gap-x-5 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300"><span><GraduationCap className="mr-1 inline h-4 w-4" aria-hidden="true" />Baixo desempenho: {data.metrics.lowPerformanceStudents}</span><span>Dados oficiais: {data.metrics.officialStudents}</span><span>Dados parciais: {data.metrics.partialStudents}</span></div>
    <div className={selectedStudent ? 'grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]' : ''}>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800"><div><h2 className="text-lg font-bold text-slate-900 dark:text-white">Alunos monitorados</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Use a busca para localizar rapidamente um aluno e abra o detalhe para investigar os motivos.</p></div><span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{data.academicYear?.name ?? 'Ano letivo'} · {data.term?.name ?? 'Período'}</span></div>{filteredStudents.length === 0 ? <div className="flex flex-col items-center gap-2 p-10 text-center"><Search className="h-8 w-8 text-slate-400" aria-hidden="true" /><p className="font-semibold text-slate-800 dark:text-slate-200">Nenhum aluno encontrado</p><p className="text-sm text-slate-500 dark:text-slate-400">Ajuste a busca ou os filtros de risco.</p></div> : <><div className="overflow-x-auto"><table className="min-w-[720px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400"><tr><th className="px-4 py-3">Aluno</th><th className="px-4 py-3">Turma</th><th className="px-4 py-3">Média</th><th className="px-4 py-3">Frequência</th><th className="px-4 py-3">Pendências</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3"><span className="sr-only">Detalhes</span></th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-800">{visibleStudents.map((student) => <tr key={student.studentId} className={`align-middle hover:bg-slate-50 dark:hover:bg-slate-800/50 ${selectedStudentId === student.studentId ? 'bg-blue-50/70 dark:bg-blue-950/20' : ''}`}><td className="px-4 py-3"><p className="font-semibold text-slate-900 dark:text-white">{student.fullName}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">RA {student.registrationNumber}</p></td><td className="px-4 py-3 text-slate-700 dark:text-slate-300">{student.className}</td><td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{formatPercentage(student.averageGrade)}</td><td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{formatPercentage(student.attendancePercentage)}</td><td className="px-4 py-3 text-slate-700 dark:text-slate-300">{student.pendingItems || 'Nenhuma'}</td><td className="px-4 py-3"><RiskBadge level={student.risk.level} /></td><td className="px-4 py-3 text-right"><button type="button" onClick={(event) => { detailOriginRef.current = event.currentTarget; setSelectedStudentId((current) => current === student.studentId ? null : student.studentId); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 dark:border-slate-700 dark:text-blue-300 dark:hover:bg-blue-950/40">{selectedStudentId === student.studentId ? 'Fechar' : 'Detalhes'}</button></td></tr>)}</tbody></table></div><Pagination page={page} pageCount={pageCount} pageSize={pageSize} total={filteredStudents.length} onPageChange={(nextPage) => { setPage(nextPage); setSelectedStudentId(null); }} onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setSelectedStudentId(null); }} /></>}</section>
      {selectedStudent && <><div className="fixed inset-0 z-30 bg-slate-950/40 xl:hidden" aria-hidden="true" onClick={() => setSelectedStudentId(null)} /><div className="fixed inset-y-0 right-0 z-40 w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl dark:bg-slate-950 xl:sticky xl:top-5 xl:z-auto xl:max-h-[calc(100vh-2.5rem)] xl:overflow-y-auto xl:bg-transparent xl:p-0 xl:shadow-none" role="dialog" aria-label={`Detalhes de ${selectedStudent.fullName}`}><StudentDetails student={selectedStudent} detailRef={detailRef} onClose={() => setSelectedStudentId(null)} /></div></>}
    </div>
    <div className="grid gap-5 xl:grid-cols-2"><section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-bold text-slate-900 dark:text-white">Resumo por turma</h2><div className="mt-4 space-y-3">{data.classes.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma turma encontrada.</p> : data.classes.map((item) => <article key={item.classId} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"><div className="flex items-center justify-between gap-3"><h3 className="font-bold text-slate-900 dark:text-white">{item.className}</h3><span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{item.students} aluno(s)</span></div><p className="mt-2 text-xs text-slate-600 dark:text-slate-400">{item.critical} crítico(s) · {item.attention} em atenção · {item.normal} normal(is)</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Média {formatPercentage(item.averageGrade)} · Frequência {formatPercentage(item.attendancePercentage)}</p></article>)}</div></section><section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-bold text-slate-900 dark:text-white">Pendências e fechamento</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-950/30"><p className="text-xs font-bold uppercase text-amber-800 dark:text-amber-300">Alunos pendentes</p><p className="mt-1 text-xl font-extrabold text-amber-900 dark:text-amber-200">{data.metrics.pendingStudents}</p></div><div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30"><p className="text-xs font-bold uppercase text-emerald-800 dark:text-emerald-300">Oficiais</p><p className="mt-1 text-xl font-extrabold text-emerald-900 dark:text-emerald-200">{data.metrics.officialStudents}</p></div><div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950/30"><p className="text-xs font-bold uppercase text-blue-800 dark:text-blue-200">Parciais</p><p className="mt-1 text-xl font-extrabold text-blue-900 dark:text-blue-200">{data.metrics.partialStudents}</p></div></div><p className="mt-4 text-sm text-slate-600 dark:text-slate-300"><CheckCircle2 className="mr-2 inline h-4 w-4 text-emerald-600" aria-hidden="true" />{data.metrics.closedOfferings} de {data.metrics.totalOfferings} atribuição(ões) encerrada(s).</p></section></div>
    </>}
  </section>;
}
