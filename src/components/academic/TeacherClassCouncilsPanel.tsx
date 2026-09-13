import { useState } from 'react';
import { Save, Users } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { useCurrentInstitution } from '../../hooks/useCurrentInstitution';
import {
  useClassCouncilDetails,
  useClassCouncils,
  useUpdateClassCouncilStudentNote,
} from '../../hooks/useClassCouncils';
import type { ClassCouncilStatus, ClassCouncilStudentNote } from '../../services/classCouncilService';

const labels: Record<ClassCouncilStatus, string> = {
  DRAFT: 'Rascunho',
  OPEN: 'Aberto',
  COMPLETED: 'Concluído',
  CANCELED: 'Cancelado',
};

const riskLabels: Record<ClassCouncilStudentNote['riskLevel'], string> = {
  NORMAL: 'Normal',
  ATTENTION: 'Atenção',
  CRITICAL: 'Crítico',
};

const riskStyles: Record<ClassCouncilStudentNote['riskLevel'], string> = {
  NORMAL: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  ATTENTION: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  CRITICAL: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300',
};

function formatPercentage(value: number | null): string {
  return value === null ? 'Não informado' : `${value.toFixed(1)}%`;
}

function dataStatusLabel(status: ClassCouncilStudentNote['dataStatus']): string {
  return status === 'OFFICIAL' ? 'Resultado oficial' : 'Dados parciais';
}

export default function TeacherClassCouncilsPanel() {
  const { profile } = useAuth();
  const institution = useCurrentInstitution(profile?.id);
  const councils = useClassCouncils(institution.data, {});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const details = useClassCouncilDetails(selectedId);
  const noteMutation = useUpdateClassCouncilStudentNote();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (councils.isLoading || institution.isLoading) {
    return <div className="grid min-h-[260px] place-items-center rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" aria-label="Carregando" /></div>;
  }

  if (councils.isError || details.isError) {
    return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">Não foi possível carregar os conselhos de classe.</div>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3"><Users className="h-5 w-5 text-blue-600" aria-hidden="true" /><div><h2 className="font-bold text-slate-900 dark:text-white">Conselhos das minhas turmas</h2><p className="text-sm text-slate-600 dark:text-slate-400">Consulte os registros e contribua quando o conselho estiver aberto.</p></div></div>
      </section>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {(councils.data?.length ?? 0) === 0 ? <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum conselho disponível para suas atribuições.</p> : <div className="divide-y divide-slate-200 dark:divide-slate-800">{councils.data?.map((council) => <button key={council.id} type="button" onClick={() => setSelectedId(council.id)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-950"><span><span className="block font-bold text-slate-900 dark:text-white">{council.className}</span><span className="text-xs text-slate-500 dark:text-slate-400">{council.academicYearName} • {council.termName}</span></span><span className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">{labels[council.status]}</span></button>)}</div>}
      </section>
      {details.data && <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="font-bold text-slate-900 dark:text-white">Contribuição pedagógica</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">O contexto abaixo é o snapshot preservado na abertura do conselho.</p><div className="mt-4 space-y-3">{details.data.studentNotes.map((note) => { const value = drafts[note.id] ?? note.teacherContributions[profile?.id ?? ''] ?? ''; const editable = details.data.council.status === 'OPEN'; return <article key={note.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="font-bold text-slate-900 dark:text-white">{note.studentName}</p><p className="text-xs text-slate-500 dark:text-slate-400">RA {note.registrationNumber} • {dataStatusLabel(note.dataStatus)}</p></div><span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-bold ${riskStyles[note.riskLevel]}`}>{riskLabels[note.riskLevel]}</span></div><div className="mt-4 grid gap-2 sm:grid-cols-4"><div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950"><p className="text-xs text-slate-500 dark:text-slate-400">Média</p><p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{formatPercentage(note.averageGrade)}</p></div><div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950"><p className="text-xs text-slate-500 dark:text-slate-400">Frequência</p><p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{formatPercentage(note.attendancePercentage)}</p></div><div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950"><p className="text-xs text-slate-500 dark:text-slate-400">Pendências</p><p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{note.pendingItems}</p></div><div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950"><p className="text-xs text-slate-500 dark:text-slate-400">Disciplinas em atenção</p><p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{note.lowPerformanceSubjects + note.lowAttendanceSubjects}</p></div></div>{note.riskReasons.length > 0 && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900 dark:bg-amber-950/20"><p className="text-xs font-bold text-amber-800 dark:text-amber-300">Motivos do risco</p><ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-amber-800 dark:text-amber-200">{note.riskReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}<label className="mt-4 block text-xs font-bold text-slate-600 dark:text-slate-300">Sua contribuição<textarea disabled={!editable} value={value} onChange={(event) => setDrafts((current) => ({ ...current, [note.id]: event.target.value }))} rows={3} placeholder="Como o estudante participa e aprende nesta disciplina?" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>{editable && <button type="button" disabled={noteMutation.isPending} onClick={() => void noteMutation.mutateAsync({ councilId: note.councilId, studentId: note.studentId, teacherContribution: value || null })} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-blue-300 px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-50 dark:border-blue-700 dark:text-blue-300"><Save className="h-4 w-4" aria-hidden="true" />Salvar contribuição</button>}</article>; })}</div></section>}
    </div>
  );
}
