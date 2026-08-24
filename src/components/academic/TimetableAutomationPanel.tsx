import { useEffect, useMemo, useState } from 'react';

import { useAcademicYears } from '../../hooks/useAcademicStructure';
import {
  useGenerateTimetableDraft,
  useDeleteTimetableVersion,
  usePublishTimetableVersion,
  useTimetableVersionEntries,
  useTimetableVersions,
  useUpdateTimetableVersionEntry,
} from '../../hooks/useAcademicAutomation';
import type { TimetableVersionEntryRow } from '../../services/timetableAutomationService';

interface EntryDraft {
  day_of_week: number;
  start_time: string;
  end_time: string;
  locked: boolean;
}

const DAY_LABELS = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Não foi possível concluir a operação.';
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}

function summarizeDiagnostics(diagnostics: Array<{ code: string; message: string }>): string {
  const unique = [...new Map(diagnostics.map((diagnostic) => [`${diagnostic.code}:${diagnostic.message}`, diagnostic])).values()];
  const visible = unique.slice(0, 8).map((diagnostic) => diagnostic.message).join(' ');
  const remaining = unique.length - Math.min(unique.length, 8);
  return remaining > 0 ? `${visible} E mais ${remaining} pendência(s).` : visible;
}

function VersionReview({
  entries,
  onEdit,
  editable,
}: {
  entries: TimetableVersionEntryRow[];
  onEdit: (entry: TimetableVersionEntryRow) => void;
  editable: boolean;
}) {
  const classes = useMemo(() => {
    const grouped = new Map<string, TimetableVersionEntryRow[]>();
    for (const entry of entries.filter((item) => item.active)) {
      const current = grouped.get(`${entry.class_id}:${entry.term_id}`) ?? [];
      current.push(entry);
      grouped.set(`${entry.class_id}:${entry.term_id}`, current);
    }
    return Array.from(grouped.values()).map((classEntries) => ({
      name: classEntries[0]?.class_name ?? 'Turma',
      termName: classEntries[0]?.term_name ?? 'Período',
      timeRows: Array.from(
        new Map(
          classEntries.map((entry) => [
            `${entry.start_time}:${entry.end_time}`,
            { startTime: entry.start_time, endTime: entry.end_time },
          ]),
        ).values(),
      ).sort((left, right) => left.startTime.localeCompare(right.startTime)),
      entries: classEntries.sort(
        (left, right) =>
          left.day_of_week - right.day_of_week ||
          left.start_time.localeCompare(right.start_time),
      ),
    }));
  }, [entries]);

  if (classes.length === 0) {
    return (
      <p className="rounded-lg bg-slate-50 p-4 text-sm text-[#667085]">
        Nenhuma aula foi gerada neste rascunho.
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid="timetable-draft-review">
      {classes.map((classGroup) => (
        <section key={`${classGroup.name}:${classGroup.termName}`} className="rounded-lg border border-[#e4e8f1]">
          <h5 className="border-b border-[#e4e8f1] px-4 py-3 font-bold text-[#181c20]">
            {classGroup.name} <span className="font-normal text-[#667085]">· {classGroup.termName}</span>
          </h5>
          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-[980px] table-fixed border-collapse text-left">
              <thead>
                <tr>
                  <th className="w-32 border border-[#e4e8f1] bg-slate-50 px-3 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[#667085]">
                    Horário
                  </th>
                  {[1, 2, 3, 4, 5].map((day) => (
                    <th key={day} className="border border-[#e4e8f1] bg-slate-50 px-3 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[#667085]">
                      {DAY_LABELS[day]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classGroup.timeRows.map((timeRow) => (
                  <tr key={`${timeRow.startTime}:${timeRow.endTime}`}>
                    <th className="w-32 border border-[#e4e8f1] bg-slate-50 px-3 py-3 align-top text-xs font-bold whitespace-nowrap text-[#344054]">
                      {formatTime(timeRow.startTime)}
                      <span className="mt-1 block font-normal text-[#667085]">até {formatTime(timeRow.endTime)}</span>
                    </th>
                    {[1, 2, 3, 4, 5].map((day) => {
                      const cellEntries = classGroup.entries.filter(
                        (entry) =>
                          entry.day_of_week === day &&
                          entry.start_time === timeRow.startTime &&
                          entry.end_time === timeRow.endTime,
                      );
                      return (
                        <td key={day} className="h-24 border border-[#e4e8f1] bg-white p-2 align-top">
                          {cellEntries.length > 0 ? (
                            <div className="space-y-2">
                              {cellEntries.map((entry) => (
                                editable ? <button
                                  type="button"
                                  key={entry.id}
                                  aria-label={`Editar ${entry.subject_name} às ${formatTime(entry.start_time)}`}
                                  onClick={() => onEdit(entry)}
                                  className="block w-full rounded-md border border-blue-100 bg-blue-50 p-2 text-left text-xs hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf]"
                                >
                                  <span className="font-bold text-[#181c20]">
                                    {formatTime(entry.start_time)} {entry.subject_name}
                                  </span>
                                  <span className="mt-1 block text-[#667085]">
                                    {entry.teacher_name ?? 'Professor pendente'}
                                    {entry.locked ? ' · Fixo' : ''}
                                  </span>
                                </button> : <div
                                  key={entry.id}
                                  className="block w-full rounded-md border border-blue-100 bg-blue-50 p-2 text-left text-xs"
                                >
                                  <span className="font-bold text-[#181c20]">
                                    {formatTime(entry.start_time)} {entry.subject_name}
                                  </span>
                                  <span className="mt-1 block text-[#667085]">
                                    {entry.teacher_name ?? 'Professor pendente'}
                                    {entry.locked ? ' · Fixo' : ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-[#98a2b3]">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

export default function TimetableAutomationPanel({
  institutionId,
  createdBy,
}: {
  institutionId: string;
  createdBy: string;
}) {
  const yearsQuery = useAcademicYears(institutionId);
  const years = yearsQuery.data ?? [];
  const [academicYearId, setAcademicYearId] = useState('');
  const selectedYearId = academicYearId || years[0]?.id || '';
  const versionsQuery = useTimetableVersions(institutionId, selectedYearId);
  const generateMutation = useGenerateTimetableDraft();
  const deleteMutation = useDeleteTimetableVersion();
  const publishMutation = usePublishTimetableVersion();
  const updateEntryMutation = useUpdateTimetableVersionEntry();
  const [reviewVersionId, setReviewVersionId] = useState('');
  const versionEntriesQuery = useTimetableVersionEntries(institutionId, reviewVersionId);
  const [editingEntry, setEditingEntry] = useState<TimetableVersionEntryRow | null>(null);
  const [entryDraft, setEntryDraft] = useState<EntryDraft | null>(null);

  const [generationShift, setGenerationShift] = useState('TODOS');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (
      reviewVersionId &&
      !(versionsQuery.data ?? []).some((version) => version.id === reviewVersionId)
    ) {
      setReviewVersionId('');
    }
  }, [reviewVersionId, versionsQuery.data]);

  async function generate(sourceVersionId?: string): Promise<void> {
    setMessage(null);
    setError(null);
    try {
      const result = await generateMutation.mutateAsync({
        institutionId,
        academicYearId: selectedYearId,
        createdBy,
        shift: generationShift,
        sourceVersionId,
        seed: `${institutionId}:${selectedYearId}`,
      });
      if (!result.valid) {
        const requiresAssignments = result.diagnostics.some(
          (diagnostic) => diagnostic.code === 'OFFERING_REQUIRED',
        );
        const preparation = [
          result.automaticAssignmentsCreated > 0 ? `${result.automaticAssignmentsCreated} atribuição(ões) criada(s)` : '',
          result.automaticRoomsCreated > 0 ? `${result.automaticRoomsCreated} sala(s) criada(s)` : '',
          result.automaticSlotsCreated > 0 ? `${result.automaticSlotsCreated} horário(s) padrão criado(s)` : '',
        ].filter(Boolean).join(', ');
        setError(
          `Não foi possível montar a grade automaticamente.${preparation ? ` Preparação automática: ${preparation}.` : ''} ${requiresAssignments ? 'A publicação exige professor por matéria. ' : ''}${summarizeDiagnostics(result.diagnostics)}`,
        );
        return;
      }
      setReviewVersionId(result.versionId ?? '');
      const preparation = [
        result.automaticAssignmentsCreated > 0 ? `${result.automaticAssignmentsCreated} atribuição(ões)` : '',
        result.automaticRoomsCreated > 0 ? `${result.automaticRoomsCreated} sala(s)` : '',
        result.automaticSlotsCreated > 0 ? `${result.automaticSlotsCreated} horário(s) padrão` : '',
      ].filter(Boolean).join(', ');
      setMessage(
        `Grade gerada em rascunho: ${result.entries.length} aulas alocadas. ${preparation ? `Preparação automática: ${preparation}. ` : ''}Revise antes de publicar.`,
      );
    } catch (generationError) {
      setError(getErrorMessage(generationError));
    }
  }

  async function publish(versionId: string): Promise<void> {
    setMessage(null);
    setError(null);
    try {
      await publishMutation.mutateAsync({ versionId, institutionId, academicYearId: selectedYearId });
      setMessage('Grade publicada com validação server-side.');
    } catch (publishError) {
      const publishMessage = getErrorMessage(publishError);
      setError(
        publishMessage.includes('TEACHER_')
          ? 'A grade estrutural está pronta, mas algumas aulas precisam de professor e disponibilidade antes da publicação.'
          : publishMessage,
      );
    }
  }

  async function removeVersion(version: { id: string; name: string; status: string }): Promise<void> {
    if (version.status !== 'DRAFT') return;
    if (!window.confirm(`Excluir a grade "${version.name}"? Todas as aulas deste rascunho serão removidas.`)) return;

    setMessage(null);
    setError(null);
    try {
      await deleteMutation.mutateAsync({ versionId: version.id, institutionId, academicYearId: selectedYearId });
      if (reviewVersionId === version.id) {
        setReviewVersionId('');
        setEditingEntry(null);
        setEntryDraft(null);
      }
      setMessage('Grade removida.');
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    }
  }

  function openEntryEditor(entry: TimetableVersionEntryRow): void {
    setEditingEntry(entry);
    setEntryDraft({
      day_of_week: entry.day_of_week,
      start_time: formatTime(entry.start_time),
      end_time: formatTime(entry.end_time),
      locked: entry.locked,
    });
    setError(null);
  }

  async function saveEntry(): Promise<void> {
    if (!editingEntry || !entryDraft || !reviewVersionId) return;
    setError(null);
    try {
      await updateEntryMutation.mutateAsync({
        id: editingEntry.id,
        versionId: reviewVersionId,
        institutionId,
        ...entryDraft,
      });
      setEditingEntry(null);
      setEntryDraft(null);
      setMessage('Alteração salva no rascunho.');
    } catch (entryError) {
      setError(getErrorMessage(entryError));
    }
  }

  const versions = versionsQuery.data ?? [];
  const reviewVersion = versions.find((version) => version.id === reviewVersionId);

  return (
    <section className="space-y-6 rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">Grade horária</p>
          <h3 className="mt-1 text-lg font-bold text-[#181c20]">Quais horários sua escola utiliza?</h3>
          <p className="mt-1 text-sm text-[#667085]">Escolha o turno, gere os horários automaticamente e revise cada aula antes da publicação.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="text-sm font-semibold text-[#344054]">
            Ano letivo
            <select
              aria-label="Ano letivo da grade"
              value={selectedYearId}
              onChange={(event) => { setAcademicYearId(event.target.value); setReviewVersionId(''); }}
              className="mt-1 block rounded-lg border border-[#d8deea] px-3 py-2 text-sm"
            >
              {years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-[#344054]">
            Turno do gerador
            <select
              aria-label="Turno do gerador"
              value={generationShift}
              onChange={(event) => setGenerationShift(event.target.value)}
              className="mt-1 block rounded-lg border border-[#d8deea] px-3 py-2 text-sm"
            >
              <option value="TODOS">Todos os turnos</option>
              <option value="MATUTINO">Manhã</option>
              <option value="VESPERTINO">Tarde</option>
              <option value="NOTURNO">Noite</option>
              <option value="INTEGRAL">Integral</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={!selectedYearId || generateMutation.isPending}
            className="min-h-10 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white hover:bg-[#004a9b] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generateMutation.isPending ? 'Gerando...' : 'Gerar grade automaticamente'}
          </button>
        </div>
      </div>

      {message && <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>}
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section>
        <div>
          <h4 className="font-semibold text-[#181c20]">Grades geradas</h4>
          <p className="text-xs text-[#667085]">Toda geração começa como rascunho e precisa de revisão.</p>
        </div>
        <div className="mt-3 overflow-x-auto rounded-lg border border-[#e4e8f1]">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.08em] text-[#667085]"><tr><th className="px-3 py-2">Versão</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Origem</th><th className="px-3 py-2">Ações</th></tr></thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id} className="border-t border-[#e4e8f1]">
                  <td className="px-3 py-2 font-semibold text-[#181c20]">{version.name}</td>
                  <td className="px-3 py-2">{version.status}</td>
                  <td className="px-3 py-2">{version.generation_source}</td>
                  <td className="px-3 py-2"><div className="flex flex-wrap gap-3">
                    <button type="button" onClick={() => setReviewVersionId(version.id)} className="font-semibold text-blue-700 hover:text-blue-900">Revisar grade</button>
                    {version.status === 'DRAFT' && <>
                      <button type="button" onClick={() => void generate(version.id)} disabled={generateMutation.isPending} className="font-semibold text-blue-700 disabled:opacity-50">Regenerar grade</button>
                      <button type="button" onClick={() => void publish(version.id)} disabled={publishMutation.isPending} className="font-semibold text-emerald-700 disabled:opacity-50">Publicar grade</button>
                      <button type="button" onClick={() => void removeVersion(version)} disabled={deleteMutation.isPending} className="font-semibold text-red-700 disabled:opacity-50" aria-label={`Excluir grade ${version.name}`}>Excluir grade</button>
                    </>}
                  </div></td>
                </tr>
              ))}
              {versions.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-[#667085]">Nenhuma grade foi gerada para este ano.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {reviewVersionId && (
        <section className="space-y-4 border-t border-[#e4e8f1] pt-5">
          <div><h4 className="font-semibold text-[#181c20]">Revisar grade</h4><p className="text-sm text-[#667085]">Clique em uma aula para editar o horário ou marcá-la como fixa.</p></div>
          {versionEntriesQuery.isLoading ? <p className="text-sm text-[#667085]">Carregando rascunho...</p> : versionEntriesQuery.isError ? <p role="alert" className="text-sm text-red-700">{getErrorMessage(versionEntriesQuery.error)}</p> : <VersionReview entries={versionEntriesQuery.data ?? []} onEdit={openEntryEditor} editable={reviewVersion?.status === 'DRAFT'} />}
        </section>
      )}

      {editingEntry && entryDraft && (
        <section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h4 className="font-semibold text-[#181c20]">Editar {editingEntry.subject_name} — {editingEntry.class_name}</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-semibold text-[#344054]">Dia<select value={entryDraft.day_of_week} onChange={(event) => setEntryDraft((current) => current ? { ...current, day_of_week: Number(event.target.value) } : current)} className="mt-1 block w-full rounded-lg border border-[#d8deea] bg-white px-3 py-2 text-sm font-normal">{DAY_LABELS.slice(1).map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select></label>
            <label className="text-sm font-semibold text-[#344054]">Início<input type="time" value={entryDraft.start_time} onChange={(event) => setEntryDraft((current) => current ? { ...current, start_time: event.target.value } : current)} className="mt-1 block w-full rounded-lg border border-[#d8deea] bg-white px-3 py-2 text-sm font-normal" /></label>
            <label className="text-sm font-semibold text-[#344054]">Fim<input type="time" value={entryDraft.end_time} onChange={(event) => setEntryDraft((current) => current ? { ...current, end_time: event.target.value } : current)} className="mt-1 block w-full rounded-lg border border-[#d8deea] bg-white px-3 py-2 text-sm font-normal" /></label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#344054]"><input type="checkbox" checked={entryDraft.locked} onChange={(event) => setEntryDraft((current) => current ? { ...current, locked: event.target.checked } : current)} />Bloqueado/Fixo: preservar ao regenerar</label>
          <div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={() => void saveEntry()} disabled={updateEntryMutation.isPending} className="rounded-lg bg-[#005bbf] px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{updateEntryMutation.isPending ? 'Salvando...' : 'Salvar alteração'}</button><button type="button" onClick={() => { setEditingEntry(null); setEntryDraft(null); }} className="rounded-lg border border-[#d8deea] bg-white px-3 py-2 text-sm font-bold text-[#344054]">Cancelar</button></div>
        </section>
      )}
    </section>
  );
}
