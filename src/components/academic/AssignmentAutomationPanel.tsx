import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Sparkles, X } from 'lucide-react';

import {
  useApplyAssignmentAutomation,
  useAssignmentAutomationPreview,
} from '../../hooks/useAcademicAutomation';
import type { AcademicYearRow } from '../../services/academicStructureService';
import type { ClassRow } from '../../services/classService';
import type { SubjectRow } from '../../services/subjectService';
import type { TeacherRow } from '../../services/teacherService';

interface AssignmentAutomationPanelProps {
  institutionId: string;
  academicYears: AcademicYearRow[];
  classes: ClassRow[];
  subjects: SubjectRow[];
  teachers: TeacherRow[];
  onClose: () => void;
  onCompleted: (message: string) => void;
}

export default function AssignmentAutomationPanel({
  institutionId,
  academicYears,
  classes,
  subjects,
  teachers,
  onClose,
  onCompleted,
}: AssignmentAutomationPanelProps) {
  const defaultYearId = useMemo(
    () => academicYears.find((year) => year.active)?.id ?? academicYears[0]?.id ?? '',
    [academicYears],
  );
  const [academicYearId, setAcademicYearId] = useState(defaultYearId);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const previewQuery = useAssignmentAutomationPreview(institutionId, academicYearId, true);
  const applyMutation = useApplyAssignmentAutomation();

  useEffect(() => {
    if (!academicYearId && defaultYearId) setAcademicYearId(defaultYearId);
  }, [academicYearId, defaultYearId]);

  const classNames = useMemo(
    () => new Map(classes.map((item) => [item.id, item.name])),
    [classes],
  );
  const subjectNames = useMemo(
    () => new Map(subjects.map((item) => [item.id, item.name])),
    [subjects],
  );
  const teacherNames = useMemo(
    () => new Map(teachers.map((item) => [item.profile_id, item.profiles?.full_name ?? item.profile_id])),
    [teachers],
  );
  const preview = previewQuery.data;

  async function handleApply(): Promise<void> {
    if (!preview || preview.candidates.length === 0 || preview.activeTermCount === 0) return;
    if (!window.confirm(`Aplicar atribuições automáticas para ${preview.candidates.length} combinação(ões)? A operação não altera alunos, matrículas ou a grade.`)) return;

    setErrorMessage(null);
    try {
      const result = await applyMutation.mutateAsync({ institutionId, academicYearId });
      onCompleted(
        result.created > 0
          ? `${result.created} atribuição(ões) criada(s) automaticamente.`
          : 'Nenhuma nova atribuição foi necessária; as existentes foram preservadas.',
      );
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível aplicar as atribuições automáticas.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="assignment-automation-title">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">
              <Sparkles className="h-4 w-4" />
              Preparação automática
            </div>
            <h2 id="assignment-automation-title" className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
              Atribuir professores automaticamente
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              O sistema preencherá apenas o que estiver faltando nos períodos ativos.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" title="Fechar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label htmlFor="assignment-automation-year" className="mt-5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
          Ano letivo
        </label>
        <select id="assignment-automation-year" value={academicYearId} onChange={(event) => setAcademicYearId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
          {academicYears.map((year) => <option key={year.id} value={year.id}>{year.name}{year.active ? ' (ativo)' : ''}</option>)}
        </select>

        {errorMessage && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>}
        {previewQuery.isError && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Não foi possível preparar a prévia das atribuições.</div>}
        {previewQuery.isLoading && <div className="flex items-center gap-2 py-8 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Verificando matérias, períodos e professores...</div>}

        {preview && !previewQuery.isLoading && (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 dark:border-blue-900/60 dark:bg-blue-950/30"><p className="text-xs text-slate-600 dark:text-slate-300">A preencher</p><strong className="text-xl text-blue-700 dark:text-blue-300">{preview.candidates.length}</strong></div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/30"><p className="text-xs text-slate-600 dark:text-slate-300">Já preenchidas</p><strong className="text-xl text-emerald-700 dark:text-emerald-300">{preview.coveredCount}</strong></div>
              <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/30"><p className="text-xs text-slate-600 dark:text-slate-300">Sem professor</p><strong className="text-xl text-amber-700 dark:text-amber-300">{preview.unassigned.length}</strong></div>
            </div>

            {preview.activeTermCount === 0 && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Cadastre pelo menos um período ativo para criar atribuições.</div>}
            {preview.unassigned.length > 0 && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Faltam professores</div><p className="mt-1">Associe um professor habilitado antes de tentar novamente.</p><ul className="mt-2 list-inside list-disc">{preview.unassigned.slice(0, 6).map((item) => <li key={`${item.classId}:${item.subjectId}`}>{classNames.get(item.classId) ?? 'Turma'} · {subjectNames.get(item.subjectId) ?? 'Disciplina'}</li>)}</ul>{preview.unassigned.length > 6 && <p className="mt-1">E mais {preview.unassigned.length - 6} pendência(s).</p>}</div>}

            {preview.candidates.length > 0 && <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"><div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white">Prévia das atribuições</div><div className="max-h-64 overflow-y-auto">{preview.candidates.slice(0, 12).map((item) => <div key={`${item.classId}:${item.subjectId}`} className="grid gap-1 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 sm:grid-cols-[1fr_1fr_1fr] dark:border-slate-800"><span className="font-medium text-slate-900 dark:text-white">{classNames.get(item.classId) ?? 'Turma'}</span><span className="text-slate-600 dark:text-slate-300">{subjectNames.get(item.subjectId) ?? 'Disciplina'} · {item.weeklyLessons} aula(s)/semana</span><span className="text-slate-600 dark:text-slate-300">{teacherNames.get(item.teacherProfileId) ?? 'Professor habilitado'}</span></div>)}</div>{preview.candidates.length > 12 && <p className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-700">Mostrando 12 de {preview.candidates.length} combinações.</p>}</div>}
            {preview.candidates.length === 0 && preview.unassigned.length === 0 && <div className="mt-5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" />Todas as atribuições estão preenchidas.</div>}
          </>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Fechar</button>
          <button type="button" onClick={() => void handleApply()} disabled={!preview || preview.candidates.length === 0 || preview.activeTermCount === 0 || applyMutation.isPending} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"><Sparkles className="h-4 w-4" />{applyMutation.isPending ? 'Aplicando...' : 'Aplicar atribuições'}</button>
        </div>
      </div>
    </div>
  );
}
