import { useMemo, useState } from 'react';
import { ClipboardList, FilterX } from 'lucide-react';

import { useInstitutionClassDiary } from '../../hooks/useAttendance';
import type { InstitutionDiaryEntryStatus } from '../../services/attendanceService';
import {
  formatAttendanceDate,
  formatAttendanceRate,
  getMonthStartDateInputValue,
  getTodayDateInputValue,
} from './attendanceDisplay';
import AttendanceSummaryCard from './AttendanceSummaryCard';

const statusLabels: Record<InstitutionDiaryEntryStatus, string> = {
  COMPLETED: 'Concluída',
  DRAFT: 'Em rascunho',
  PENDING: 'Pendente',
  FUTURE: 'Futura',
  CANCELED: 'Cancelada',
};

function formatTime(value: string): string {
  if (!value) return 'Horário não informado';
  return value.slice(0, 5);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Não foi possível carregar o Diário de Classe institucional.';
}

export default function InstitutionAttendancePanel({
  institutionId,
}: {
  institutionId: string | undefined;
}) {
  const [fromDate, setFromDate] = useState(getMonthStartDateInputValue);
  const [toDate, setToDate] = useState(getTodayDateInputValue);
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherProfileId, setTeacherProfileId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [termId, setTermId] = useState('');
  const [status, setStatus] = useState<InstitutionDiaryEntryStatus | 'ALL'>('ALL');

  const filters = useMemo(
    () => ({
      fromDate,
      toDate,
      classId: classId || undefined,
      subjectId: subjectId || undefined,
      teacherProfileId: teacherProfileId || undefined,
      academicYearId: academicYearId || undefined,
      termId: termId || undefined,
      status,
    }),
    [academicYearId, classId, fromDate, status, subjectId, teacherProfileId, termId, toDate],
  );
  const diaryQuery = useInstitutionClassDiary(institutionId, filters);
  const options = diaryQuery.data?.filters;

  const clearFilters = () => {
    setClassId('');
    setSubjectId('');
    setTeacherProfileId('');
    setAcademicYearId('');
    setTermId('');
    setStatus('ALL');
  };

  const summary = diaryQuery.data?.entries.reduce(
    (total, entry) => ({
      totalRecords: total.totalRecords + entry.summary.totalRecords,
      presentRecords: total.presentRecords + entry.summary.presentRecords,
      absentRecords: total.absentRecords + entry.summary.absentRecords,
      lateRecords: total.lateRecords + entry.summary.lateRecords,
      excusedRecords: total.excusedRecords + entry.summary.excusedRecords,
      attendanceRate:
        total.totalRecords + entry.summary.totalRecords > 0
          ? ((total.presentRecords + entry.summary.presentRecords) /
              (total.totalRecords + entry.summary.totalRecords)) *
            100
          : 0,
    }),
    {
      totalRecords: 0,
      presentRecords: 0,
      absentRecords: 0,
      lateRecords: 0,
      excusedRecords: 0,
      attendanceRate: 0,
    },
  );

  return (
    <section className="rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-5 w-5 text-[#005bbf]" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-bold text-[#181c20] dark:text-white">Diário de Classe</h2>
            <p className="mt-1 text-sm text-[#727785] dark:text-slate-400">
              Consulta institucional das aulas, chamadas e pendências.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex w-fit items-center justify-center gap-2 rounded-lg border border-[#c8d4e3] px-3 py-2 text-sm font-semibold text-[#005bbf] transition-colors hover:bg-blue-50 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          <FilterX className="h-4 w-4" aria-hidden="true" />
          Limpar filtros
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label htmlFor="diary-from-date" className="text-xs font-bold uppercase tracking-wide text-[#727785] dark:text-slate-400">Início</label>
          <input id="diary-from-date" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-1 w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100" />
        </div>
        <div>
          <label htmlFor="diary-to-date" className="text-xs font-bold uppercase tracking-wide text-[#727785] dark:text-slate-400">Fim</label>
          <input id="diary-to-date" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="mt-1 w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100" />
        </div>
        {[
          ['diary-year-filter', 'Ano letivo', academicYearId, setAcademicYearId, options?.academicYears],
          ['diary-term-filter', 'Período', termId, setTermId, options?.terms],
          ['diary-class-filter', 'Turma', classId, setClassId, options?.classes],
          ['diary-subject-filter', 'Disciplina', subjectId, setSubjectId, options?.subjects],
          ['diary-teacher-filter', 'Professor', teacherProfileId, setTeacherProfileId, options?.teachers],
        ].map(([id, label, value, setValue, optionValues]) => (
          <div key={id as string}>
            <label htmlFor={id as string} className="text-xs font-bold uppercase tracking-wide text-[#727785] dark:text-slate-400">{label as string}</label>
            <select id={id as string} value={value as string} onChange={(event) => (setValue as (value: string) => void)(event.target.value)} className="mt-1 w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100">
              <option value="">Todos</option>
              {(optionValues as { id: string; label: string }[] | undefined)?.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </div>
        ))}
        <div>
          <label htmlFor="diary-status-filter" className="text-xs font-bold uppercase tracking-wide text-[#727785] dark:text-slate-400">Status</label>
          <select id="diary-status-filter" value={status} onChange={(event) => setStatus(event.target.value as InstitutionDiaryEntryStatus | 'ALL')} className="mt-1 w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100">
            <option value="ALL">Todos</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-5">
        {diaryQuery.isLoading && <div role="status" className="rounded-lg border border-[#dfe3e8] p-5 text-sm text-[#727785] dark:border-slate-700 dark:text-slate-400">Carregando Diário de Classe...</div>}
        {diaryQuery.isError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{getErrorMessage(diaryQuery.error)}</div>}
        {diaryQuery.data && diaryQuery.data.entries.length === 0 && <div className="rounded-lg border border-dashed border-[#c1c6d6] p-6 text-center text-sm text-[#727785] dark:border-slate-700 dark:text-slate-400">Nenhuma aula encontrada no período selecionado.</div>}
        {diaryQuery.data && diaryQuery.data.entries.length > 0 && (
          <div className="space-y-5">
            {summary && <AttendanceSummaryCard summary={summary} />}
            <div className="overflow-hidden rounded-lg border border-[#dfe3e8] dark:border-slate-700">
              <div className="hidden grid-cols-[0.8fr_0.7fr_1.2fr_1.2fr_0.8fr] gap-3 bg-[#f7f9fc] px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#727785] dark:bg-slate-800 dark:text-slate-400 lg:grid">
                <span>Data</span><span>Horário</span><span>Turma / disciplina</span><span>Professor / conteúdo</span><span>Status</span>
              </div>
              <div className="divide-y divide-[#eef1f5] dark:divide-slate-700">
                {diaryQuery.data.entries.map((entry) => (
                  <details key={entry.id} className="group px-4 py-4">
                    <summary className="grid cursor-pointer list-none gap-3 lg:grid-cols-[0.8fr_0.7fr_1.2fr_1.2fr_0.8fr] lg:items-center">
                      <span className="text-sm font-semibold text-[#181c20] dark:text-white">{formatAttendanceDate(entry.sessionDate)}</span>
                      <span className="text-sm text-[#181c20] dark:text-slate-200">{formatTime(entry.startsAt)}–{formatTime(entry.endsAt)}</span>
                      <span><strong className="block text-sm text-[#181c20] dark:text-white">{entry.offering.className}</strong><small className="text-xs text-[#727785] dark:text-slate-400">{entry.offering.subjectName}</small></span>
                      <span><strong className="block text-sm text-[#181c20] dark:text-white">{entry.offering.teacherName}</strong><small className="text-xs text-[#727785] dark:text-slate-400">{entry.session?.topic ?? 'Sem conteúdo registrado'}</small></span>
                      <span className="text-sm font-bold text-[#005bbf] dark:text-blue-300">{statusLabels[entry.diaryStatus]}</span>
                    </summary>
                    <div className="mt-4 grid gap-3 border-t border-[#eef1f5] pt-4 text-sm text-[#414754] dark:border-slate-700 dark:text-slate-300 md:grid-cols-2">
                      <p><strong>Conteúdo:</strong> {entry.session?.topic ?? 'Não informado'}</p>
                      <p><strong>Atividade:</strong> {entry.session?.classActivity ?? 'Não informada'}</p>
                      <p><strong>Tarefa:</strong> {entry.session?.homework ?? 'Não informada'}</p>
                      <p><strong>Observações:</strong> {entry.session?.notes ?? 'Não informadas'}</p>
                      <p><strong>Frequência:</strong> {entry.summary.totalRecords > 0 ? `${entry.summary.presentRecords} presentes · ${formatAttendanceRate(entry.summary)}` : 'Ainda não registrada'}</p>
                      {entry.historical && <p><strong>Origem:</strong> Sessão histórica fora da grade atual.</p>}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
