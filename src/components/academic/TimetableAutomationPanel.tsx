import { useEffect, useState } from 'react';

import { useAcademicYears } from '../../hooks/useAcademicStructure';
import { useGenerateTimetableDraft, usePublishTimetableVersion, useSaveSchoolTimeSlots, useSchoolTimeSlots, useTimetableVersions } from '../../hooks/useAcademicAutomation';

interface SlotDraft { day_of_week: number; slot_number: number; start_time: string; end_time: string }

export default function TimetableAutomationPanel({ institutionId, createdBy }: { institutionId: string; createdBy: string }) {
  const yearsQuery = useAcademicYears(institutionId);
  const years = yearsQuery.data ?? [];
  const [academicYearId, setAcademicYearId] = useState('');
  const selectedYearId = academicYearId || years[0]?.id || '';
  const versionsQuery = useTimetableVersions(institutionId, selectedYearId);
  const generateMutation = useGenerateTimetableDraft();
  const publishMutation = usePublishTimetableVersion();
  const [shift, setShift] = useState('MATUTINO');
  const slotsQuery = useSchoolTimeSlots(institutionId, shift);
  const saveSlotsMutation = useSaveSchoolTimeSlots();
  const [slots, setSlots] = useState<SlotDraft[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSlots((slotsQuery.data ?? []).map((slot) => ({ day_of_week: slot.day_of_week, slot_number: slot.slot_number, start_time: slot.start_time.slice(0, 5), end_time: slot.end_time.slice(0, 5) })));
  }, [slotsQuery.data]);

  async function generate(): Promise<void> {
    setMessage(null);
    setError(null);
    try {
      const result = await generateMutation.mutateAsync({ institutionId, academicYearId: selectedYearId, createdBy, seed: `${institutionId}:${selectedYearId}` });
      if (!result.valid) {
        setError(result.diagnostics.map((diagnostic) => diagnostic.message).join(' '));
        return;
      }
      setMessage(`Rascunho criado: ${result.entries.length} aulas alocadas, score ${result.score}/100.`);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Nao foi possivel gerar a grade.');
    }
  }

  async function publish(versionId: string): Promise<void> {
    setMessage(null);
    setError(null);
    try {
      await publishMutation.mutateAsync({ versionId, institutionId, academicYearId: selectedYearId });
      setMessage('Grade publicada com validacao server-side.');
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Nao foi possivel publicar a grade.');
    }
  }

  async function saveSlots(): Promise<void> {
    setError(null);
    try {
      await saveSlotsMutation.mutateAsync({ institution_id: institutionId, shift, slots });
      setMessage('Horarios padrao salvos.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Nao foi possivel salvar os horarios.');
    }
  }

  return (
    <section className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-[#181c20]">Gerar grade automatica</h3>
          <p className="mt-1 text-sm text-gray-500">A proposta e deterministica, respeita disponibilidade e fica em rascunho ate a publicacao.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div>
            <label htmlFor="automation-year" className="block text-sm font-medium text-gray-700">Ano letivo</label>
            <select id="automation-year" value={selectedYearId} onChange={(event) => setAcademicYearId(event.target.value)} className="mt-1 rounded-lg border px-3 py-2 text-sm">
              {years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => void generate()} disabled={!selectedYearId || generateMutation.isPending} className="rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a73e8] disabled:opacity-50">{generateMutation.isPending ? 'Gerando...' : 'Gerar rascunho'}</button>
        </div>
      </div>

      {message && <div role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>}
      {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Versao</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Origem</th><th className="px-3 py-2 text-left">Acao</th></tr></thead>
          <tbody>
            {(versionsQuery.data ?? []).map((version) => <tr key={version.id} className="border-t"><td className="px-3 py-2">{version.name}</td><td className="px-3 py-2">{version.status}</td><td className="px-3 py-2">{version.generation_source}</td><td className="px-3 py-2">{version.status === 'DRAFT' && <button type="button" onClick={() => void publish(version.id)} disabled={publishMutation.isPending} className="font-medium text-blue-700 disabled:opacity-50">Publicar</button>}</td></tr>)}
            {(versionsQuery.data ?? []).length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">Nenhum rascunho para este ano.</td></tr>}
          </tbody>
        </table>
      </div>

      <section className="mt-6 border-t pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h4 className="font-semibold text-[#181c20]">Horarios padrao da escola</h4><p className="text-xs text-gray-500">Slots reutilizaveis por turno e dia. Intervalos nao sao aulas.</p></div><div className="flex gap-2"><select aria-label="Turno dos horarios" value={shift} onChange={(event) => setShift(event.target.value)} className="rounded-lg border px-3 py-2 text-sm"><option value="MATUTINO">Matutino</option><option value="VESPERTINO">Vespertino</option><option value="NOTURNO">Noturno</option></select><button type="button" onClick={() => setSlots((current) => [...current, { day_of_week: 1, slot_number: current.length + 1, start_time: '07:00', end_time: '07:50' }])} className="rounded-lg border border-blue-200 px-3 py-2 text-sm text-blue-700">Adicionar slot</button></div></div>
        <div className="mt-3 space-y-2">{slots.map((slot, index) => <div key={`${slot.day_of_week}-${slot.slot_number}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"><select aria-label={`Dia do slot ${index + 1}`} value={slot.day_of_week} onChange={(event) => setSlots((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, day_of_week: Number(event.target.value) } : item))} className="rounded-lg border px-3 py-2 text-sm">{[1, 2, 3, 4, 5, 6].map((day) => <option key={day} value={day}>{['', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'][day]}</option>)}</select><input aria-label={`Inicio do slot ${index + 1}`} type="time" value={slot.start_time} onChange={(event) => setSlots((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, start_time: event.target.value } : item))} className="rounded-lg border px-3 py-2 text-sm" /><input aria-label={`Fim do slot ${index + 1}`} type="time" value={slot.end_time} onChange={(event) => setSlots((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, end_time: event.target.value } : item))} className="rounded-lg border px-3 py-2 text-sm" /><button type="button" onClick={() => setSlots((current) => current.filter((_item, itemIndex) => itemIndex !== index))} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700">Remover</button></div>)}{slots.length === 0 && <p className="rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-500">Nenhum slot cadastrado para este turno.</p>}</div>
        <button type="button" onClick={() => void saveSlots()} disabled={saveSlotsMutation.isPending} className="mt-3 rounded-lg bg-[#005bbf] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{saveSlotsMutation.isPending ? 'Salvando...' : 'Salvar horarios'}</button>
      </section>
    </section>
  );
}
