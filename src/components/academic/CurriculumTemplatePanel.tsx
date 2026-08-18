import { useMemo, useState } from 'react';

import { useApplyCurriculumTemplate, useCreateCurriculumTemplate, useCurriculumTemplates } from '../../hooks/useAcademicAutomation';
import type { SubjectRow } from '../../services/subjectService';
import type { ClassRow } from '../../services/classService';

export default function CurriculumTemplatePanel({ institutionId, subjects, classes, onClose }: { institutionId: string; subjects: SubjectRow[]; classes: ClassRow[]; onClose: () => void }) {
  const templatesQuery = useCurriculumTemplates(institutionId);
  const createMutation = useCreateCurriculumTemplate();
  const applyMutation = useApplyCurriculumTemplate();
  const [name, setName] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeSubjects = useMemo(() => subjects.filter((subject) => subject.active), [subjects]);

  async function createTemplate(): Promise<void> {
    setError(null);
    try {
      await createMutation.mutateAsync({ institution_id: institutionId, name, items: selectedSubjectIds.map((subject_id) => ({ subject_id, weekly_lessons: 1, lesson_duration_minutes: 50 })) });
      setName('');
      setMessage('Modelo curricular salvo. Ajuste cargas na matriz da turma quando necessario.');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Nao foi possivel salvar o modelo.');
    }
  }

  async function applyTemplate(templateId: string): Promise<void> {
    setError(null);
    try {
      const count = await applyMutation.mutateAsync({ institution_id: institutionId, template_id: templateId, class_ids: selectedClassIds });
      setMessage(`${count} item(ns) aplicados sem duplicatas.`);
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Nao foi possivel aplicar o modelo.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="curriculum-template-title">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between"><div><h3 id="curriculum-template-title" className="text-lg font-bold text-[#181c20]">Modelos de matriz curricular</h3><p className="mt-1 text-sm text-gray-500">Salve uma matriz da escola e aplique-a em varias turmas.</p></div><button type="button" onClick={onClose} className="text-sm text-gray-500">Fechar</button></div>
        {message && <div role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>}
        {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border p-4"><h4 className="font-semibold">Novo modelo</h4><input aria-label="Nome do modelo" value={name} onChange={(event) => setName(event.target.value)} placeholder="7o ano - padrao" className="mt-3 w-full rounded-lg border px-3 py-2 text-sm" /><p className="mt-3 text-xs text-gray-500">Disciplinas do modelo</p><div className="mt-2 max-h-40 space-y-2 overflow-y-auto">{activeSubjects.map((subject) => <label key={subject.id} className="flex gap-2 text-sm"><input type="checkbox" checked={selectedSubjectIds.includes(subject.id)} onChange={() => setSelectedSubjectIds((current) => current.includes(subject.id) ? current.filter((id) => id !== subject.id) : [...current, subject.id])} />{subject.name}</label>)}</div><button type="button" onClick={() => void createTemplate()} disabled={createMutation.isPending || !name.trim() || selectedSubjectIds.length === 0} className="mt-4 rounded-lg bg-[#005bbf] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{createMutation.isPending ? 'Salvando...' : 'Salvar modelo'}</button></section>
          <section className="rounded-lg border p-4"><h4 className="font-semibold">Aplicar modelo</h4><p className="mt-1 text-xs text-gray-500">Selecione turmas; alunos e matriculas nao sao alterados.</p><div className="mt-3 max-h-32 space-y-2 overflow-y-auto">{classes.filter((classRecord) => classRecord.active).map((classRecord) => <label key={classRecord.id} className="flex gap-2 text-sm"><input type="checkbox" checked={selectedClassIds.includes(classRecord.id)} onChange={() => setSelectedClassIds((current) => current.includes(classRecord.id) ? current.filter((id) => id !== classRecord.id) : [...current, classRecord.id])} />{classRecord.name}</label>)}</div><div className="mt-4 space-y-2">{(templatesQuery.data ?? []).map((template) => <div key={template.id} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm"><span>{template.name}</span><button type="button" onClick={() => void applyTemplate(template.id)} disabled={applyMutation.isPending || selectedClassIds.length === 0} className="font-medium text-blue-700 disabled:opacity-50">Aplicar</button></div>)}{(templatesQuery.data ?? []).length === 0 && <p className="text-sm text-gray-500">Nenhum modelo salvo.</p>}</div></section>
        </div>
      </div>
    </div>
  );
}
