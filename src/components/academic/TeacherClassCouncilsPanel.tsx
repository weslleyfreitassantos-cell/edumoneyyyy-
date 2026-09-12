import { useState } from 'react';
import { Save, Users } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { useCurrentInstitution } from '../../hooks/useCurrentInstitution';
import {
  useClassCouncilDetails,
  useClassCouncils,
  useUpdateClassCouncilStudentNote,
} from '../../hooks/useClassCouncils';
import type { ClassCouncilStatus } from '../../services/classCouncilService';

const labels: Record<ClassCouncilStatus, string> = {
  DRAFT: 'Rascunho',
  OPEN: 'Aberto',
  COMPLETED: 'Concluído',
  CANCELED: 'Cancelado',
};

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

  if (councils.isError) {
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
      {details.data && <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="font-bold text-slate-900 dark:text-white">Contribuição pedagógica</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Sua contribuição é armazenada separadamente por aluno.</p><div className="mt-4 space-y-3">{details.data.studentNotes.map((note) => { const value = drafts[note.id] ?? note.teacherContributions[profile?.id ?? ''] ?? ''; const editable = details.data.council.status === 'OPEN'; return <div key={note.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"><p className="font-bold text-slate-900 dark:text-white">{note.studentName}</p><p className="text-xs text-slate-500 dark:text-slate-400">RA {note.registrationNumber}</p><textarea disabled={!editable} value={value} onChange={(event) => setDrafts((current) => ({ ...current, [note.id]: event.target.value }))} rows={3} placeholder="Como o estudante participa e aprende nesta disciplina?" className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />{editable && <button type="button" disabled={noteMutation.isPending} onClick={() => void noteMutation.mutateAsync({ councilId: note.councilId, studentId: note.studentId, teacherContribution: value || null })} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-blue-300 px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-50 dark:border-blue-700 dark:text-blue-300"><Save className="h-4 w-4" aria-hidden="true" />Salvar contribuição</button>}</div>; })}</div></section>}
    </div>
  );
}
