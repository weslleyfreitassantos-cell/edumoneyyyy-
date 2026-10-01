import {
  BarChart3,
  Download,
  FileText,
  Loader2,
  Printer,
  Search,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useAuth } from '../../../contexts/AuthContext';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import { useAcademicReportOptions } from '../../../hooks/useAcademicReports';
import { getLocalDateInputValue } from '../../../lib/academicTermDates';
import { buildCsv, downloadCsv, sanitizeDownloadFileName, type CsvColumn } from '../../../lib/csvExport';
import { getUserFacingErrorMessage } from '../../../lib/userFacingError';
import {
  academicReportService,
  getPreferredAcademicReportSelection,
  type AcademicReportType,
  type AcademicResultsReportRow,
  type AttendanceReportRow,
  type EnrollmentReportRow,
} from '../../../services/academicReportService';
import { getResultStatusLabel } from '../../../components/academic/academicDisplay';

type ReportState =
  | { type: 'ENROLLMENTS'; rows: EnrollmentReportRow[] }
  | { type: 'RESULTS'; rows: AcademicResultsReportRow[] }
  | { type: 'ATTENDANCE'; rows: AttendanceReportRow[] };

const reportLabels: Record<AcademicReportType, string> = {
  ENROLLMENTS: 'Alunos e matrículas',
  RESULTS: 'Resultados acadêmicos',
  ATTENDANCE: 'Frequência',
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${value.toLocaleString('pt-BR')}%`;
}

function selectedLabel(
  options: readonly { id: string; label: string }[],
  id: string,
  fallback: string,
): string {
  return options.find((option) => option.id === id)?.label ?? fallback;
}

function localIssueDate(): string {
  return formatDate(getLocalDateInputValue());
}

function ReportTable<T extends { id: string }>({
  rows,
  columns,
  emptyMessage,
}: {
  rows: readonly T[];
  columns: readonly { label: string; render: (row: T) => ReactNode }[];
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return <p className="p-6 text-center text-sm text-slate-600 dark:text-slate-400">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 dark:bg-slate-950/70">
          <tr>
            {columns.map((column) => <th key={column.label} scope="col" className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">{column.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              {columns.map((column) => <td key={column.label} className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-200">{column.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AcademicReportsTab() {
  const { profile } = useAuth();
  const institutionQuery = useCurrentInstitution(profile?.id);
  const optionsQuery = useAcademicReportOptions(institutionQuery.data ?? undefined);
  const [reportType, setReportType] = useState<AcademicReportType>('RESULTS');
  const [academicYearId, setAcademicYearId] = useState('');
  const [termId, setTermId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [enrollmentStatus, setEnrollmentStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [report, setReport] = useState<ReportState | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const options = optionsQuery.data;
  const preferred = useMemo(
    () => getPreferredAcademicReportSelection(options?.academicYears ?? []),
    [options?.academicYears],
  );
  const selectedYearId = academicYearId || preferred?.academicYearId || '';
  const selectedYear = options?.academicYears.find((year) => year.id === selectedYearId) ?? null;
  const selectedTermId = termId || selectedYear?.terms.find((term) => term.active)?.id || selectedYear?.terms[0]?.id || '';
  const classOptions = (options?.classes ?? []).filter((option) => option.academicYearId === selectedYearId);
  const subjectOptions = (options?.subjects ?? []).filter((option) =>
    option.academicYearId === selectedYearId && option.termId === selectedTermId,
  );
  const selectedClassLabel = selectedLabel(classOptions, classId, 'Turma');
  const selectedTermLabel = selectedYear?.terms.find((term) => term.id === selectedTermId)?.name ?? 'Período';
  const canGenerate = Boolean(
    institutionQuery.data &&
    selectedYearId &&
    (reportType === 'ENROLLMENTS' || (selectedTermId && classId)),
  );

  function resetReportFilters(nextType: AcademicReportType): void {
    setReportType(nextType);
    setReport(null);
    setError(null);
    setClassId('');
    setSubjectId('');
    setStudentId('');
    setEnrollmentStatus('ALL');
    setSearch('');
    setTermId('');
  }

  async function generateReport(): Promise<void> {
    if (!institutionQuery.data || !selectedYearId) return;
    setIsGenerating(true);
    setError(null);

    try {
      if (reportType === 'ENROLLMENTS') {
        const rows = await academicReportService.getEnrollmentReport(institutionQuery.data, {
          academicYearId: selectedYearId,
          classId: classId || undefined,
          status: enrollmentStatus,
          search,
        });
        setReport({ type: reportType, rows });
      } else if (reportType === 'RESULTS') {
        const rows = await academicReportService.getAcademicResultsReport(institutionQuery.data, {
          academicYearId: selectedYearId,
          termId: selectedTermId,
          classId,
          subjectId: subjectId || undefined,
        });
        setReport({ type: reportType, rows });
      } else {
        const rows = await academicReportService.getAttendanceReport(institutionQuery.data, {
          academicYearId: selectedYearId,
          termId: selectedTermId,
          classId,
          subjectId: subjectId || undefined,
          studentId: studentId || undefined,
        });
        setReport({ type: reportType, rows });
      }
    } catch (nextError) {
      setError(nextError);
      setReport(null);
    } finally {
      setIsGenerating(false);
    }
  }

  function exportReport(): void {
    if (!report) return;
    const contextName = report.type === 'ENROLLMENTS'
      ? selectedYearId
      : `${selectedClassLabel}-${selectedTermLabel}-${selectedYearId}`;
    const fileBase = sanitizeDownloadFileName(`${reportLabels[report.type]}-${contextName}`);

    if (report.type === 'ENROLLMENTS') {
      const columns: CsvColumn<EnrollmentReportRow>[] = [
        { header: 'Aluno', value: (row) => row.studentName },
        { header: 'RA', value: (row) => row.registrationNumber },
        { header: 'Status do aluno', value: (row) => row.studentStatus },
        { header: 'Ano letivo', value: (row) => row.academicYearName },
        { header: 'Turma', value: (row) => row.className },
        { header: 'Série/Nível', value: (row) => row.gradeLevel ?? '' },
        { header: 'Turno', value: (row) => row.shift ?? '' },
        { header: 'Status da matrícula', value: (row) => row.enrollmentStatusLabel },
        { header: 'Data da matrícula', value: (row) => formatDate(row.enrolledAt) },
      ];
      downloadCsv(`${fileBase}.csv`, buildCsv(columns, report.rows));
      return;
    }

    if (report.type === 'RESULTS') {
      const columns: CsvColumn<AcademicResultsReportRow>[] = [
        { header: 'Aluno', value: (row) => row.studentName },
        { header: 'RA', value: (row) => row.registrationNumber },
        { header: 'Turma', value: (row) => row.className },
        { header: 'Disciplina', value: (row) => row.subjectName },
        { header: 'Professor', value: (row) => row.teacherName },
        { header: 'Média original', value: (row) => formatPercent(row.gradePercentage) },
        { header: 'Recuperação', value: (row) => formatPercent(row.recoveryPercentage) },
        { header: 'Média final', value: (row) => formatPercent(row.finalGradePercentage) },
        { header: 'Frequência', value: (row) => formatPercent(row.attendancePercentage) },
        { header: 'Situação', value: (row) => getResultStatusLabel(row.resultStatus) },
        { header: 'Status dos dados', value: (row) => row.dataStatus === 'OFFICIAL' ? 'Resultado oficial' : 'Dados parciais' },
      ];
      downloadCsv(`${fileBase}.csv`, buildCsv(columns, report.rows));
      return;
    }

    const columns: CsvColumn<AttendanceReportRow>[] = [
      { header: 'Aluno', value: (row) => row.studentName },
      { header: 'RA', value: (row) => row.registrationNumber },
      { header: 'Turma', value: (row) => row.className },
      { header: 'Presentes', value: (row) => row.presentRecords },
      { header: 'Faltas', value: (row) => row.absentRecords },
      { header: 'Atrasos', value: (row) => row.lateRecords },
      { header: 'Justificadas', value: (row) => row.excusedRecords },
      { header: 'Registros', value: (row) => row.totalRecords },
      { header: 'Frequência', value: (row) => formatPercent(row.attendanceRate) },
    ];
    downloadCsv(`${fileBase}.csv`, buildCsv(columns, report.rows));
  }

  const reportTitle = report ? reportLabels[report.type] : null;
  const institutionName = institutionQuery.currentInstitution?.name ?? 'Instituição de ensino';

  if (institutionQuery.isLoading || optionsQuery.isLoading) {
    return <div role="status" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />Carregando opções dos relatórios...</div>;
  }

  if (institutionQuery.isError || optionsQuery.isError || !options) {
    return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{getUserFacingErrorMessage(institutionQuery.error ?? optionsQuery.error, 'Não foi possível carregar os relatórios acadêmicos.')}</div>;
  }

  return (
    <div className="academic-report-printable space-y-6">
      <header className="print-hidden flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Operação escolar</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Relatórios acadêmicos</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Consulte, filtre e exporte informações da instituição.</p>
        </div>
        <BarChart3 className="hidden h-8 w-8 text-blue-700 dark:text-blue-300 sm:block" aria-hidden="true" />
      </header>

      <div className="print-only hidden">
        <h1 className="text-2xl font-bold">{institutionName}</h1>
        <h2 className="mt-3 text-xl font-bold">RELATÓRIO DE {reportTitle?.toUpperCase() ?? 'DADOS ACADÊMICOS'}</h2>
        <p className="mt-2">Ano letivo: {selectedYear?.name ?? '—'}</p>
        {reportType !== 'ENROLLMENTS' && <p>Período: {selectedTermLabel}</p>}
        {reportType !== 'ENROLLMENTS' && <p>Turma: {selectedClassLabel}</p>}
        <p>Emitido em: {localIssueDate()}</p>
      </div>

      <section className="print-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="academic-reports-filters-title">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Tipo de relatório" htmlFor="academic-report-type">
            <select id="academic-report-type" value={reportType} onChange={(event) => resetReportFilters(event.target.value as AcademicReportType)} className="report-select">
              {Object.entries(reportLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Ano letivo" htmlFor="academic-report-year">
            <select id="academic-report-year" value={selectedYearId} onChange={(event) => { setAcademicYearId(event.target.value); setTermId(''); setClassId(''); setSubjectId(''); setReport(null); }} className="report-select">
              {options.academicYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </select>
          </Field>
          {reportType !== 'ENROLLMENTS' && <Field label="Período" htmlFor="academic-report-term"><select id="academic-report-term" value={selectedTermId} onChange={(event) => { setTermId(event.target.value); setClassId(''); setSubjectId(''); setReport(null); }} className="report-select">{selectedYear?.terms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</select></Field>}
          <Field label="Turma" htmlFor="academic-report-class"><select id="academic-report-class" value={classId} onChange={(event) => { setClassId(event.target.value); setReport(null); }} className="report-select"><option value="">{reportType === 'ENROLLMENTS' ? 'Todas as turmas' : 'Selecione uma turma'}</option>{classOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></Field>
          {reportType !== 'ENROLLMENTS' && <Field label="Disciplina (opcional)" htmlFor="academic-report-subject"><select id="academic-report-subject" value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setReport(null); }} className="report-select"><option value="">Todas as disciplinas</option>{subjectOptions.map((option) => <option key={`${option.id}-${option.termId}`} value={option.id}>{option.label}</option>)}</select></Field>}
          {reportType === 'ENROLLMENTS' && <Field label="Status da matrícula" htmlFor="academic-report-status"><select id="academic-report-status" value={enrollmentStatus} onChange={(event) => { setEnrollmentStatus(event.target.value); setReport(null); }} className="report-select"><option value="ALL">Todos</option><option value="ACTIVE">Ativa</option><option value="TRANSFERRED">Transferida</option><option value="CANCELLED">Cancelada</option><option value="COMPLETED">Concluída</option></select></Field>}
          {reportType === 'ENROLLMENTS' && <Field label="Buscar aluno ou RA" htmlFor="academic-report-search"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input id="academic-report-search" value={search} onChange={(event) => { setSearch(event.target.value); setReport(null); }} placeholder="Nome ou RA" className="report-select pl-9" /></div></Field>}
          {reportType === 'ATTENDANCE' && <Field label="Aluno (opcional)" htmlFor="academic-report-student"><select id="academic-report-student" value={studentId} onChange={(event) => { setStudentId(event.target.value); setReport(null); }} className="report-select"><option value="">Todos os alunos</option>{options.students.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></Field>}
        </div>
        <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
          <p id="academic-reports-filters-title" className="text-sm text-slate-600 dark:text-slate-400">Escolha o contexto e gere uma visualização antes de exportar.</p>
          <button type="button" disabled={!canGenerate || isGenerating} onClick={generateReport} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{isGenerating && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Gerar relatório</button>
        </div>
      </section>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{getUserFacingErrorMessage(error, 'Não foi possível gerar o relatório.')}</div>}

      {!report && !isGenerating && !error && <section className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900"><FileText className="mx-auto h-9 w-9 text-slate-400" aria-hidden="true" /><p className="mt-3 font-semibold text-slate-900 dark:text-white">Selecione os filtros e gere um relatório.</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">A exportação acontece localmente no seu navegador.</p></section>}

      {report && <section className="space-y-4 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="academic-report-result-title">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 dark:border-slate-700 sm:flex-row sm:items-start sm:justify-between">
          <div><h2 id="academic-report-result-title" className="text-lg font-bold text-slate-900 dark:text-white">{reportLabels[report.type]}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{report.rows.length} {report.rows.length === 1 ? 'registro' : 'registros'} · {selectedYear?.name ?? 'Ano'}{report.type !== 'ENROLLMENTS' ? ` · ${selectedTermLabel} · ${selectedClassLabel}` : ''}</p></div>
          <div className="print-hidden flex flex-col gap-2 sm:flex-row"><button type="button" onClick={exportReport} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/30"><Download className="h-4 w-4" aria-hidden="true" />Exportar CSV</button><button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"><Printer className="h-4 w-4" aria-hidden="true" />Imprimir / Salvar como PDF</button></div>
        </div>
        {report.type === 'ENROLLMENTS' && <ReportTable<EnrollmentReportRow> rows={report.rows} emptyMessage="Nenhum registro encontrado para os filtros selecionados." columns={[{ label: 'Aluno', render: (row) => <><strong>{row.studentName}</strong><span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{row.registrationNumber}</span></> }, { label: 'Status do aluno', render: (row) => row.studentStatus }, { label: 'Ano letivo', render: (row) => row.academicYearName }, { label: 'Turma', render: (row) => row.className }, { label: 'Série/Nível', render: (row) => row.gradeLevel ?? '—' }, { label: 'Turno', render: (row) => row.shift ?? '—' }, { label: 'Matrícula', render: (row) => row.enrollmentStatusLabel }, { label: 'Data', render: (row) => formatDate(row.enrolledAt) }]} />}
        {report.type === 'RESULTS' && <ReportTable<AcademicResultsReportRow> rows={report.rows} emptyMessage="Nenhum registro encontrado para os filtros selecionados." columns={[{ label: 'Aluno', render: (row) => <><strong>{row.studentName}</strong><span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{row.registrationNumber}</span></> }, { label: 'Turma', render: (row) => row.className }, { label: 'Disciplina', render: (row) => row.subjectName }, { label: 'Professor', render: (row) => row.teacherName }, { label: 'Média original', render: (row) => formatPercent(row.gradePercentage) }, { label: 'Recuperação', render: (row) => formatPercent(row.recoveryPercentage) }, { label: 'Média final', render: (row) => formatPercent(row.finalGradePercentage) }, { label: 'Frequência', render: (row) => formatPercent(row.attendancePercentage) }, { label: 'Situação', render: (row) => getResultStatusLabel(row.resultStatus) }, { label: 'Dados', render: (row) => row.dataStatus === 'OFFICIAL' ? 'Resultado oficial' : 'Dados parciais' }]} />}
        {report.type === 'ATTENDANCE' && <ReportTable<AttendanceReportRow> rows={report.rows} emptyMessage="Nenhum registro encontrado para os filtros selecionados." columns={[{ label: 'Aluno', render: (row) => <><strong>{row.studentName}</strong><span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{row.registrationNumber}</span></> }, { label: 'Turma', render: (row) => row.className }, { label: 'Presentes', render: (row) => row.presentRecords }, { label: 'Faltas', render: (row) => row.absentRecords }, { label: 'Atrasos', render: (row) => row.lateRecords }, { label: 'Justificadas', render: (row) => row.excusedRecords }, { label: 'Registros', render: (row) => row.totalRecords }, { label: 'Frequência', render: (row) => formatPercent(row.attendanceRate) }]} />}
      </section>}
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return <div><label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</label>{children}</div>;
}
