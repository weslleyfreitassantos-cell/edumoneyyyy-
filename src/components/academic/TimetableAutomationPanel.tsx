import { useEffect, useMemo, useState } from 'react';

import { useAcademicYears } from '../../hooks/useAcademicStructure';
import { useAcademicShiftSettings } from '../../hooks/useAcademicTermClosing';
import {
  useDeleteTimetableVersion,
  useGenerateTimetableDraft,
  usePublishTimetableVersion,
  useSaveSchoolTimeSlots,
  useSchoolTimeSlots,
  useTimetableVersionEntries,
  useTimetableVersions,
  useUpdateTimetableVersionEntry,
} from '../../hooks/useAcademicAutomation';
import type { TimetableVersionEntryRow } from '../../services/timetableAutomationService';
import {
  getAcademicShiftLabel,
  type AcademicShift,
} from '../../lib/academic/academicShifts';

interface SlotDraft {
  day_of_week: number;
  slot_number: number;
  start_time: string;
  end_time: string;
}

interface EntryDraft {
  day_of_week: number;
  start_time: string;
  end_time: string;
  locked: boolean;
}

const DAY_LABELS = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function getErrorMessage(error: unknown): string {
  const details = readErrorDetails(error);
  const values = [details.code, details.message, details.details, details.hint]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toUpperCase());

  if (values.some((value) => value.includes('INSTITUTION_OPERATION_FORBIDDEN'))) {
    return 'Seu perfil não tem permissão para preparar ou publicar a grade desta instituição.';
  }
  if (values.some((value) => value.includes('CLASS_SCOPE_MISMATCH') || value.includes('SUBJECT_SCOPE_MISMATCH'))) {
    return 'A configuração contém uma turma ou matéria de outra instituição. Atualize os dados e tente novamente.';
  }
  if (values.some((value) => value.includes('23505') || value.includes('DUPLICATE KEY'))) {
    return 'Já existe uma configuração igual para este ano letivo. Atualize a lista antes de gerar novamente.';
  }

  if (values.some((value) => value.includes('TEACHER_NOT_AVAILABLE'))) {
    return 'A publicação foi bloqueada porque há aulas em horários sem disponibilidade semanal cadastrada para os professores. Abra Usuários > Professores, configure a disponibilidade de cada professor e salve antes de publicar novamente.';
  }
  if (values.some((value) => value.includes('TEACHER_SUBJECT_NOT_AUTHORIZED'))) {
    return 'A publicação foi bloqueada porque há professor atribuído a uma disciplina que ele não está habilitado para lecionar. Revise as atribuições dos professores.';
  }
  if (values.some((value) => value.includes('SCHOOL_TIME_SLOT_NOT_CONFIGURED'))) {
    return 'A publicação foi bloqueada porque há aulas sem horário escolar configurado para o turno da turma. Cadastre os horários da escola e tente novamente.';
  }
  if (values.some((value) => value.includes('TIMETABLE_VERSION_CONFLICT'))) {
    return 'A publicação foi bloqueada porque existem conflitos de professor, turma ou sala na grade. Revise os horários antes de publicar.';
  }
  if (values.some((value) => value.includes('WEEKLY_LESSONS_MISMATCH'))) {
    return 'A publicação foi bloqueada porque a quantidade de aulas não corresponde à matriz curricular. Revise a carga semanal das disciplinas.';
  }
  if (values.some((value) => value.includes('TIMETABLE_VERSION_NOT_DRAFT'))) {
    return 'Esta grade não está mais em rascunho e não pode ser publicada novamente.';
  }
  if (values.some((value) => value.includes('STATEMENT TIMEOUT') || value.includes('CANCELING STATEMENT'))) {
    return 'A revisão demorou mais que o esperado. Tente abrir a proposta novamente.';
  }
  if (values.some((value) => value.includes('TIMETABLE_VERSION_SCOPE_MISMATCH'))) {
    return 'A publicação foi bloqueada porque a grade contém dados de outra instituição ou ano letivo. Gere uma nova grade para o contexto atual.';
  }
  if (values.some((value) => value.includes('TIMETABLE_VERSION_FORBIDDEN'))) {
    return 'Você não tem permissão para publicar esta grade.';
  }

  return details.message ?? 'Não foi possível concluir a operação.';
}

function readErrorDetails(error: unknown): {
  code: string | null;
  message: string | null;
  details: string | null;
  hint: string | null;
} {
  if (error instanceof Error) {
    return { code: null, message: error.message, details: null, hint: null };
  }
  if (typeof error === 'string') {
    return { code: null, message: error, details: null, hint: null };
  }
  if (!error || typeof error !== 'object') {
    return { code: null, message: null, details: null, hint: null };
  }

  const record = error as Record<string, unknown>;
  return {
    code: typeof record.code === 'string' ? record.code : null,
    message: typeof record.message === 'string' ? record.message : null,
    details: typeof record.details === 'string' ? record.details : null,
    hint: typeof record.hint === 'string' ? record.hint : null,
  };
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}

function summarizeDiagnostics(diagnostics: Array<{ code: string; message: string }>): string {
  const unique = [...new Map(diagnostics.map((diagnostic) => [`${diagnostic.code}:${diagnostic.message}`, diagnostic])).values()];
  const visible = unique.slice(0, 8).map(formatDiagnostic).join(' ');
  const remaining = unique.length - Math.min(unique.length, 8);
  return remaining > 0 ? `${visible} E mais ${remaining} pendência(s).` : visible;
}

function formatDiagnostic(diagnostic: { code: string; message: string }): string {
  switch (diagnostic.code) {
    case 'SETUP_TERMS_REQUIRED':
      return 'Cadastre os períodos do ano letivo antes de gerar a grade.';
    case 'SETUP_CLASSES_REQUIRED':
      return 'Cadastre as turmas do ano letivo antes de gerar a grade.';
    case 'SETUP_CURRICULUM_REQUIRED':
      return 'Configure a matriz curricular antes de gerar a grade.';
    case 'SETUP_CLASS_SHIFT_REQUIRED':
      return `${diagnostic.message} Informe o turno da turma.`;
    case 'SETUP_CLASS_CURRICULUM_REQUIRED':
      return `${diagnostic.message} Configure suas matérias.`;
    case 'UNSATISFIED':
      return diagnostic.message
        .replace('no compatible slot is available', 'não há horários compatíveis suficientes')
        .replace('all compatible slots are occupied', 'todos os horários compatíveis já estão ocupados');
    case 'TEACHER_SUBJECT_NOT_AUTHORIZED':
      return 'Há uma atribuição com professor não habilitado para a matéria. Revise as atribuições.';
    case 'CURRICULUM_OR_SCOPE_MISMATCH':
      return 'Há uma atribuição fora da turma, matriz curricular ou ano letivo selecionado.';
    default:
      return diagnostic.message;
  }
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
      const current = grouped.get(entry.class_id) ?? [];
      current.push(entry);
      grouped.set(entry.class_id, current);
    }
    return Array.from(grouped.values()).map((classEntries) => ({
      name: classEntries[0]?.class_name ?? 'Turma',
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
        <section key={classGroup.name} className="rounded-lg border border-[#e4e8f1]">
          <h5 className="border-b border-[#e4e8f1] px-4 py-3 font-bold text-[#181c20]">
            {classGroup.name}
          </h5>
          <div className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from(new Set<number>(classGroup.entries.map((entry) => entry.day_of_week))).map((day) => (
              <div key={day}>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#667085]">
                  {DAY_LABELS[day]}
                </p>
                <div className="mt-2 space-y-2">
                  {classGroup.entries
                    .filter((entry) => entry.day_of_week === day)
                    .map((entry) => (
                      <div
                        key={entry.id}
                        role={editable ? 'button' : undefined}
                        tabIndex={editable ? 0 : undefined}
                        onClick={editable ? () => onEdit(entry) : undefined}
                        onKeyDown={editable ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') onEdit(entry);
                        } : undefined}
                        className={`block w-full rounded-md border border-blue-100 bg-blue-50 p-2 text-left text-xs ${editable ? 'cursor-pointer hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf]' : ''}`}
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
              </div>
            ))}
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
  const shiftSettingsQuery = useAcademicShiftSettings(institutionId);
  const years = yearsQuery.data ?? [];
  const [academicYearId, setAcademicYearId] = useState('');
  const selectedYearId = academicYearId || years[0]?.id || '';
  const versionsQuery = useTimetableVersions(institutionId, selectedYearId);
  const versions = versionsQuery.data ?? [];
  const generateMutation = useGenerateTimetableDraft();
  const deleteMutation = useDeleteTimetableVersion();
  const publishMutation = usePublishTimetableVersion();
  const updateEntryMutation = useUpdateTimetableVersionEntry();
  const [reviewVersionId, setReviewVersionId] = useState('');
  const versionEntriesQuery = useTimetableVersionEntries(institutionId, reviewVersionId);
  const [editingEntry, setEditingEntry] = useState<TimetableVersionEntryRow | null>(null);
  const [entryDraft, setEntryDraft] = useState<EntryDraft | null>(null);

  const [shift, setShift] = useState('MATUTINO');
  const enabledShifts: AcademicShift[] =
    shiftSettingsQuery.data ?? ['MATUTINO'];
  const slotsQuery = useSchoolTimeSlots(institutionId, shift);
  const saveSlotsMutation = useSaveSchoolTimeSlots();
  const [slots, setSlots] = useState<SlotDraft[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSlots(
      (slotsQuery.data ?? []).map((slot) => ({
        day_of_week: slot.day_of_week,
        slot_number: slot.slot_number,
        start_time: formatTime(slot.start_time),
        end_time: formatTime(slot.end_time),
      })),
    );
  }, [slotsQuery.data]);

  useEffect(() => {
    if (
      enabledShifts.length > 0 &&
      !enabledShifts.includes(shift as AcademicShift)
    ) {
      setShift(enabledShifts[0]);
    }
  }, [shiftSettingsQuery.data]);

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
    if (!sourceVersionId && (versionsQuery.data ?? []).some((version) => version.status === 'DRAFT')) {
      const shouldContinue = window.confirm('Já existe uma grade em rascunho para este ano. Deseja gerar uma nova proposta?');
      if (!shouldContinue) return;
    }
    try {
      const result = await generateMutation.mutateAsync({
        institutionId,
        academicYearId: selectedYearId,
        createdBy,
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
          result.automaticUnassigned > 0 ? `${result.automaticUnassigned} pendência(s) de professor` : '',
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
        result.automaticUnassigned > 0 ? `${result.automaticUnassigned} pendência(s) de professor` : '',
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
      setError(getErrorMessage(publishError));
    }
  }

  async function removeVersion(versionId: string): Promise<void> {
    const version = versions.find((item) => item.id === versionId);
    if (!version || version.status !== 'DRAFT') return;
    if (!window.confirm('Excluir esta proposta de grade? Esta ação não pode ser desfeita.')) return;

    setMessage(null);
    setError(null);
    try {
      await deleteMutation.mutateAsync({
        versionId,
        institutionId,
        academicYearId: selectedYearId,
      });
      if (reviewVersionId === versionId) {
        setReviewVersionId('');
        setEditingEntry(null);
        setEntryDraft(null);
      }
      setMessage('Proposta excluída.');
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    }
  }

  async function saveSlots(): Promise<void> {
    setError(null);
    try {
      await saveSlotsMutation.mutateAsync({ institution_id: institutionId, shift, slots });
      setMessage('Horários da escola salvos.');
    } catch (saveError) {
      setError(getErrorMessage(saveError));
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

  const reviewVersion = versions.find((version) => version.id === reviewVersionId);

  return (
    <section className="space-y-6 rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">Grade horária</p>
          <h3 className="mt-1 text-lg font-bold text-[#181c20]">Quais horários sua escola utiliza?</h3>
          <p className="mt-1 text-sm text-[#667085]">Configure os slots por turno, gere um rascunho e revise por turma antes da publicação.</p>
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
      {!yearsQuery.isLoading && !yearsQuery.isError && years.length === 0 && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Cadastre um ano letivo antes de configurar a grade.</div>}
      {yearsQuery.isError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">Não foi possível carregar os anos letivos. Atualize a página e tente novamente.</div>}
      {shiftSettingsQuery.isError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">Não foi possível carregar os turnos da escola. Configure a Política acadêmica e atualize a página.</div>}

      <section className="rounded-lg border border-[#e4e8f1] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h4 className="font-semibold text-[#181c20]">Horários da escola</h4>
            <p className="text-xs text-[#667085]">Intervalos não são aulas. Cada turma usará somente o turno compatível.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="text-sm font-semibold text-[#344054]">
              Turno
              <select aria-label="Turno dos horários" value={shift} onChange={(event) => setShift(event.target.value)} className="ml-2 rounded-lg border border-[#d8deea] px-3 py-2 text-sm font-normal">
                {enabledShifts.map((availableShift) => (
                  <option key={availableShift} value={availableShift}>
                    {getAcademicShiftLabel(availableShift)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setSlots((current) => [...current, { day_of_week: 1, slot_number: current.length + 1, start_time: '07:00', end_time: '07:50' }])}
              className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              + Adicionar horário
            </button>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {slots.map((slot, index) => (
            <div key={`${slot.day_of_week}-${slot.slot_number}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <select
                aria-label={`Dia do horário ${index + 1}`}
                value={slot.day_of_week}
                onChange={(event) => setSlots((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, day_of_week: Number(event.target.value) } : item))}
                className="rounded-lg border border-[#d8deea] px-3 py-2 text-sm"
              >
                {DAY_LABELS.slice(1).map((label, dayIndex) => <option key={label} value={dayIndex + 1}>{label}</option>)}
              </select>
              <input aria-label={`Início do horário ${index + 1}`} type="time" value={slot.start_time} onChange={(event) => setSlots((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, start_time: event.target.value } : item))} className="rounded-lg border border-[#d8deea] px-3 py-2 text-sm" />
              <input aria-label={`Fim do horário ${index + 1}`} type="time" value={slot.end_time} onChange={(event) => setSlots((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, end_time: event.target.value } : item))} className="rounded-lg border border-[#d8deea] px-3 py-2 text-sm" />
              <button type="button" onClick={() => setSlots((current) => current.filter((_item, itemIndex) => itemIndex !== index))} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Remover</button>
            </div>
          ))}
          {slotsQuery.isError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">Não foi possível carregar os horários deste turno.</p>}
          {slots.length === 0 && !slotsQuery.isError && <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-[#667085]">Nenhum horário cadastrado para este turno. A geração poderá sugerir horários padrão.</p>}
        </div>
        <button type="button" onClick={() => void saveSlots()} disabled={saveSlotsMutation.isPending} className="mt-3 rounded-lg bg-[#005bbf] px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
          {saveSlotsMutation.isPending ? 'Salvando...' : 'Salvar horários'}
        </button>
      </section>

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
                      <button type="button" onClick={() => void removeVersion(version.id)} disabled={deleteMutation.isPending} className="font-semibold text-red-700 disabled:opacity-50">Excluir proposta</button>
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
