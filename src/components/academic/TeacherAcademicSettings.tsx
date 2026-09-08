import { useEffect, useMemo, useState } from 'react';

import { useSubjects } from '../../hooks/useSubjects';
import {
  useSaveTeacherAcademicSettings,
  useSchoolTimeSlots,
  useTeacherAvailability,
  useTeacherSubjects,
} from '../../hooks/useAcademicAutomation';
import { suggestTeacherAvailabilityFromSchoolSlots } from '../../services/academicAutomationService';

const DAY_LABELS: Record<number, string> = { 1: 'Segunda', 2: 'Terca', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sabado' };

export interface TeacherAcademicSettingsProps {
  institutionId: string;
  teacherProfileId: string;
  teacherName: string;
  initialSubjectIds?: string[];
  initialPrimarySubjectId?: string;
  initialAvailability?: AvailabilityDraft[];
  onClose: () => void;
  onSaved?: () => void;
}

export interface AvailabilityDraft {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export default function TeacherAcademicSettings({ institutionId, teacherProfileId, teacherName, initialSubjectIds, initialPrimarySubjectId, initialAvailability, onClose, onSaved }: TeacherAcademicSettingsProps) {
  const subjectsQuery = useSubjects(institutionId);
  const subjectQuery = useTeacherSubjects(institutionId, teacherProfileId);
  const availabilityQuery = useTeacherAvailability(institutionId, teacherProfileId);
  const schoolTimeSlotsQuery = useSchoolTimeSlots(institutionId);
  const saveMutation = useSaveTeacherAcademicSettings();
  const [subjectIds, setSubjectIds] = useState<string[]>(initialSubjectIds ?? []);
  const [primarySubjectId, setPrimarySubjectId] = useState(initialPrimarySubjectId ?? '');
  const [availability, setAvailability] = useState<AvailabilityDraft[]>(initialAvailability ?? []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialSubjectIds && subjectQuery.data) {
      setSubjectIds(subjectQuery.data.filter((item) => item.active).map((item) => item.subject_id));
      setPrimarySubjectId(subjectQuery.data.find((item) => item.primary_subject && item.active)?.subject_id ?? '');
    }
  }, [initialSubjectIds, subjectQuery.data]);

  useEffect(() => {
    if (!initialAvailability && availabilityQuery.data) {
      setAvailability(availabilityQuery.data.map((item) => ({ day_of_week: item.day_of_week, start_time: item.start_time.slice(0, 5), end_time: item.end_time.slice(0, 5) })));
    }
  }, [initialAvailability, availabilityQuery.data]);

  const activeSubjects = useMemo(() => (subjectsQuery.data ?? []).filter((subject) => subject.active), [subjectsQuery.data]);

  function toggleSubject(subjectId: string): void {
    setSubjectIds((current) => current.includes(subjectId) ? current.filter((id) => id !== subjectId) : [...current, subjectId]);
    if (subjectIds.includes(subjectId) && primarySubjectId === subjectId) setPrimarySubjectId('');
  }

  function addAvailability(): void {
    setAvailability((current) => [...current, { day_of_week: 1, start_time: '07:00', end_time: '12:00' }]);
  }

  function suggestAvailability(): void {
    const suggestions = suggestTeacherAvailabilityFromSchoolSlots(schoolTimeSlotsQuery.data ?? []);
    if (suggestions.length === 0) {
      setError('Cadastre os horários da escola antes de sugerir a disponibilidade.');
      return;
    }
    if (availability.length > 0 && !window.confirm('Substituir as janelas atuais pelos horários ativos da escola? Você poderá revisar antes de salvar.')) {
      return;
    }
    setAvailability(suggestions);
    setError(null);
  }

  async function save(): Promise<void> {
    setError(null);
    try {
      await saveMutation.mutateAsync({ institution_id: institutionId, teacher_profile_id: teacherProfileId, subject_ids: subjectIds, primary_subject_id: primarySubjectId || undefined, availability });
      onSaved?.();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Nao foi possivel salvar a configuracao academica.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="teacher-academic-settings-title">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="teacher-academic-settings-title" className="text-lg font-bold text-[#181c20]">Configuracao academica</h3>
            <p className="mt-1 text-sm text-gray-500">{teacherName}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-medium text-gray-500 hover:text-gray-800">Fechar</button>
        </div>

        {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <section className="mt-5">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-[#181c20]">Disciplinas que pode lecionar</h4>
            <span className="text-xs text-gray-500">{subjectIds.length} selecionada(s)</span>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {activeSubjects.map((subject) => (
              <label key={subject.id} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <input type="checkbox" checked={subjectIds.includes(subject.id)} onChange={() => toggleSubject(subject.id)} />
                <span className="flex-1">{subject.name}</span>
                {subjectIds.includes(subject.id) && <button type="button" className="text-xs text-blue-700" onClick={() => setPrimarySubjectId(subject.id)} aria-label={`Definir ${subject.name} como principal`}>{primarySubjectId === subject.id ? 'Principal' : 'Principal?'}</button>}
              </label>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-[#181c20]">Disponibilidade semanal</h4>
              <p className="text-xs text-gray-500">Use os horários ativos da escola como base e ajuste as janelas para a realidade do professor.</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={suggestAvailability}
                disabled={schoolTimeSlotsQuery.isLoading || schoolTimeSlotsQuery.isError || schoolTimeSlotsQuery.data?.length === 0}
                className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Usar horários da escola
              </button>
              <button type="button" onClick={addAvailability} className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">Adicionar janela</button>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {availability.map((window, index) => (
              <div key={`${window.day_of_week}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <select aria-label={`Dia da janela ${index + 1}`} value={window.day_of_week} onChange={(event) => setAvailability((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, day_of_week: Number(event.target.value) } : item))} className="rounded-lg border px-3 py-2 text-sm">
                  {Object.entries(DAY_LABELS).map(([day, label]) => <option key={day} value={day}>{label}</option>)}
                </select>
                <input aria-label={`Inicio da janela ${index + 1}`} type="time" value={window.start_time} onChange={(event) => setAvailability((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, start_time: event.target.value } : item))} className="rounded-lg border px-3 py-2 text-sm" />
                <input aria-label={`Fim da janela ${index + 1}`} type="time" value={window.end_time} onChange={(event) => setAvailability((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, end_time: event.target.value } : item))} className="rounded-lg border px-3 py-2 text-sm" />
                <button type="button" onClick={() => setAvailability((current) => current.filter((_item, itemIndex) => itemIndex !== index))} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50">Remover</button>
              </div>
            ))}
            {availability.length === 0 && <p className="rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-500">Nenhuma janela cadastrada.</p>}
          </div>
        </section>

        <div className="mt-6 flex justify-end gap-2 border-t pt-4">
          <button type="button" onClick={onClose} disabled={saveMutation.isPending} className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button type="button" onClick={() => void save()} disabled={saveMutation.isPending || subjectsQuery.isLoading} className="rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a73e8] disabled:opacity-50">{saveMutation.isPending ? 'Salvando...' : 'Salvar configuracao'}</button>
        </div>
      </div>
    </div>
  );
}
