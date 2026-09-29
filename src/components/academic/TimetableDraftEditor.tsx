import { useEffect, useMemo, useState, type DragEvent, type ReactElement } from 'react';
import { CheckCircle2, Copy, History, Loader2, Plus, RotateCcw, Save, Trash2, XCircle } from 'lucide-react';

import { useAcademicYears } from '../../hooks/useAcademicStructure';
import { useClasses } from '../../hooks/useClasses';
import { useCurriculum } from '../../hooks/useCurriculum';
import { useSchoolScheduleBreaks } from '../../hooks/useAcademicTermClosing';
import {
  useAddTimetableDraftEntry,
  useAddTimetableDoubleSlot,
  useCopyTimetableDraftDay,
  useCreateManualTimetableDraft,
  useDuplicateTimetableDraftEntry,
  useDeleteTimetableVersion,
  usePublishTimetableVersion,
  useRemoveTimetableDraftEntry,
  useSchoolTimeSlots,
  useTimetableEditorContext,
  useTimetableVersionEntries,
  useTimetableVersions,
  useUpdateTimetableVersionEntry,
  useValidateTimetableDraft,
} from '../../hooks/useAcademicAutomation';
import { buildTimetableVersionDiff, type TimetableVersionEntryRow } from '../../services/timetableAutomationService';
import { getAcademicShiftLabel, normalizeAcademicShift } from '../../lib/academic/academicShifts';

const DAYS = [1, 2, 3, 4, 5, 6];
const DAY_LABELS: Record<number, string> = { 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };

function shortTime(value: string): string { return value.slice(0, 5); }
function friendlyError(error: unknown): string {
  const structured = typeof error === 'object' && error !== null && 'message' in error
    ? String((error as { message?: unknown }).message ?? '')
    : '';
  const message = error instanceof Error ? error.message : structured || String(error ?? '');
  const known: Array<[string, string]> = [
    ['SCHOOL_TIME_SLOT_NOT_CONFIGURED', 'O horário selecionado não está configurado para o turno da turma.'],
    ['TIMETABLE_BREAK_CONFLICT', 'A aula não pode ocupar um intervalo escolar.'],
    ['TIMETABLE_VERSION_NOT_DRAFT', 'A versão publicada é somente leitura. Crie um novo rascunho para editar.'],
    ['TIMETABLE_VERSION_FORBIDDEN', 'Seu perfil não pode editar a grade desta instituição.'],
    ['TIMETABLE_OFFERING_SCOPE_MISMATCH', 'A disciplina não pertence ao período ou turma selecionados.'],
    ['TIMETABLE_DOUBLE_SLOT_NOT_CONSECUTIVE', 'Os horários escolhidos não são duas aulas consecutivas do mesmo turno.'],
    ['TIMETABLE_SLOT_OCCUPIED', 'Uma das duas células já está ocupada para esta turma e período.'],
  ];
  return known.find(([code]) => message.toUpperCase().includes(code))?.[1] ?? (message || 'Não foi possível salvar a alteração.');
}

interface DraftEntryForm {
  offeringId: string;
  roomId: string;
  day: number;
  start: string;
  end: string;
  locked: boolean;
}

export default function TimetableDraftEditor({ institutionId, createdBy }: { institutionId: string; createdBy: string }) {
  const yearsQuery = useAcademicYears(institutionId);
  const classesQuery = useClasses(institutionId);
  const curriculumQuery = useCurriculum(institutionId);
  const breaksQuery = useSchoolScheduleBreaks(institutionId);
  const years = yearsQuery.data ?? [];
  const classes = classesQuery.data ?? [];
  const [yearId, setYearId] = useState('');
  const selectedYearId = yearId || years[0]?.id || '';
  const selectedYear = years.find((year) => year.id === selectedYearId);
  const terms = selectedYear?.terms.filter((term) => term.active) ?? [];
  const [termId, setTermId] = useState('');
  const selectedTermId = termId || terms[0]?.id || '';
  const [classId, setClassId] = useState('');
  const allYearClasses = useMemo(() => classes.filter((item) => item.active && item.academic_year_id === selectedYearId), [classes, selectedYearId]);
  const shiftOptions = useMemo(() => [...new Set(allYearClasses.map((item) => normalizeAcademicShift(item.shift)))].sort(), [allYearClasses]);
  const [shiftFilter, setShiftFilter] = useState('all');
  const yearClasses = useMemo(() => allYearClasses.filter((item) => shiftFilter === 'all' || normalizeAcademicShift(item.shift) === shiftFilter), [allYearClasses, shiftFilter]);
  const selectedClassId = classId || yearClasses[0]?.id || '';
  const selectedClass = yearClasses.find((item) => item.id === selectedClassId);
  const shift = normalizeAcademicShift(selectedClass?.shift ?? 'MATUTINO');
  const slotsQuery = useSchoolTimeSlots(institutionId, shift);
  const versionsQuery = useTimetableVersions(institutionId, selectedYearId);
  const versions = versionsQuery.data ?? [];
  const [versionId, setVersionId] = useState('');
  const selectedVersionId = versionId || versions[0]?.id || '';
  const selectedVersion = versions.find((version) => version.id === selectedVersionId);
  const entriesQuery = useTimetableVersionEntries(institutionId, selectedVersionId);
  const comparisonVersionId = selectedVersion?.source_version_id
    ?? versions.find((version) => version.status === 'PUBLISHED' && version.id !== selectedVersionId)?.id
    ?? '';
  const comparisonEntriesQuery = useTimetableVersionEntries(institutionId, comparisonVersionId);
  const editorContextQuery = useTimetableEditorContext({ institutionId, academicYearId: selectedYearId, classId: selectedClassId, termId: selectedTermId });
  const editorContext = editorContextQuery.data;
  const curriculum = (curriculumQuery.data ?? []).filter((item) => item.class_id === selectedClassId && item.active);
  const breaks = (breaksQuery.data ?? []).filter((item) => item.active && normalizeAcademicShift(item.shift) === shift);
  const slots = slotsQuery.data ?? [];
  const versionEntries = entriesQuery.data ?? [];
  const entries = versionEntries.filter((entry) => entry.class_id === selectedClassId && entry.term_id === selectedTermId && entry.active);

  const [dialog, setDialog] = useState<DraftEntryForm | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [duplicatingEntryId, setDuplicatingEntryId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<{ valid: boolean; diagnostics: Array<{ code: string; message: string }> } | null>(null);
  const [undoAction, setUndoAction] = useState<(() => Promise<void>) | null>(null);
  const [copySourceDay, setCopySourceDay] = useState(1);
  const [copyTargetDay, setCopyTargetDay] = useState(2);
  const [mobileDay, setMobileDay] = useState(1);

  const createDraft = useCreateManualTimetableDraft();
  const addEntry = useAddTimetableDraftEntry();
  const addDoubleSlot = useAddTimetableDoubleSlot();
  const duplicateEntry = useDuplicateTimetableDraftEntry();
  const updateEntry = useUpdateTimetableVersionEntry();
  const removeEntry = useRemoveTimetableDraftEntry();
  const copyDay = useCopyTimetableDraftDay();
  const validateDraft = useValidateTimetableDraft();
  const publishVersion = usePublishTimetableVersion();
  const deleteVersion = useDeleteTimetableVersion();

  async function refreshHealth(): Promise<void> {
    if (!selectedVersion || selectedVersion.status !== 'DRAFT') return;
    const result = await validateDraft.mutateAsync({ versionId: selectedVersion.id, institutionId });
    setValidation(result);
  }

  useEffect(() => {
    if (yearId && !years.some((year) => year.id === yearId)) setYearId('');
  }, [yearId, years]);
  useEffect(() => {
    if (!terms.some((term) => term.id === termId)) setTermId('');
  }, [termId, terms]);
  useEffect(() => {
    if (!yearClasses.some((item) => item.id === classId)) setClassId('');
  }, [classId, yearClasses]);
  useEffect(() => {
    if (shiftFilter !== 'all' && !shiftOptions.includes(shiftFilter)) setShiftFilter('all');
  }, [shiftFilter, shiftOptions]);
  useEffect(() => {
    if (versionId && !versions.some((version) => version.id === versionId)) setVersionId('');
  }, [versionId, versions]);
  useEffect(() => { setValidation(null); }, [selectedVersionId, selectedClassId, selectedTermId]);

  const rowSlots = useMemo(() => {
    const unique = new Map<string, { start: string; end: string }>();
    for (const slot of slots) unique.set(`${slot.start_time}-${slot.end_time}`, { start: shortTime(slot.start_time), end: shortTime(slot.end_time) });
    return [...unique.values()].sort((a, b) => a.start.localeCompare(b.start));
  }, [slots]);

  const offeringStats = useMemo(() => {
    const countByOffering = new Map<string, number>();
    for (const entry of entries) countByOffering.set(entry.subject_offering_id, (countByOffering.get(entry.subject_offering_id) ?? 0) + 1);
    return (editorContext?.offerings ?? []).map((offering) => {
      const curriculumItem = curriculum.find((item) => item.subject_id === offering.subject_id);
      return { offering, count: countByOffering.get(offering.id) ?? 0, required: curriculumItem?.weekly_lessons ?? 0 };
    });
  }, [curriculum, editorContext?.offerings, entries]);

  function clearFeedback(): void { setNotice(null); setError(null); }

  async function createEmptyDraft(): Promise<void> {
    if (!selectedYearId || !createdBy) return;
    clearFeedback();
    try {
      const id = await createDraft.mutateAsync({ institutionId, academicYearId: selectedYearId, name: `Grade manual · ${getAcademicShiftLabel(shift)} · ${selectedYear?.name ?? ''}`, createdBy, generationShift: shift, entries: [] });
      setVersionId(id);
      setNotice('Rascunho manual criado. Adicione as aulas na matriz semanal.');
    } catch (draftError) { setError(friendlyError(draftError)); }
  }

  async function cloneSelectedVersion(): Promise<void> {
    if (!selectedVersion || !selectedYearId || !createdBy) return;
    clearFeedback();
      const sourceEntries = versionEntries.filter((entry) => entry.active);
    try {
      const sourceEntriesForShift = sourceEntries.filter((entry) => normalizeAcademicShift(entry.class_shift) === shift);
      const id = await createDraft.mutateAsync({ institutionId, academicYearId: selectedYearId, name: `Edição · ${getAcademicShiftLabel(shift)} · ${selectedVersion.name}`, createdBy, generationShift: shift, sourceVersionId: selectedVersion.id, entries: sourceEntriesForShift });
      setVersionId(id);
      setNotice('Novo rascunho criado a partir da versão selecionada. A versão publicada não foi alterada.');
    } catch (draftError) { setError(friendlyError(draftError)); }
  }

  function openAdd(day: number, start: string, end: string): void {
    if (selectedVersion?.status !== 'DRAFT') return;
    clearFeedback();
    setEditingEntryId(null);
    setDuplicatingEntryId(null);
    setDialog({ offeringId: offeringStats.find((item) => item.count < item.required)?.offering.id ?? offeringStats[0]?.offering.id ?? '', roomId: '', day, start, end, locked: false });
  }

  function openEdit(entry: TimetableVersionEntryRow): void {
    if (selectedVersion?.status !== 'DRAFT') return;
    clearFeedback();
    setEditingEntryId(entry.id);
    setDuplicatingEntryId(null);
    setDialog({ offeringId: entry.subject_offering_id, roomId: entry.room_id ?? '', day: entry.day_of_week, start: shortTime(entry.start_time), end: shortTime(entry.end_time), locked: entry.locked });
  }

  function openDuplicate(entry: TimetableVersionEntryRow): void {
    if (selectedVersion?.status !== 'DRAFT') return;
    clearFeedback();
    setEditingEntryId(null);
    setDuplicatingEntryId(entry.id);
    setDialog({ offeringId: entry.subject_offering_id, roomId: entry.room_id ?? '', day: entry.day_of_week, start: shortTime(entry.start_time), end: shortTime(entry.end_time), locked: entry.locked });
  }

  async function handleDrop(day: number, start: string, end: string, event: DragEvent<HTMLDivElement>): Promise<void> {
    if (!isDraft) return;
    event.preventDefault();
    const raw = event.dataTransfer.getData('text/plain');
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as { kind?: string; entryId?: string; offeringId?: string };
      if (payload.kind === 'entry' && payload.entryId && selectedVersion) {
        const entry = versionEntries.find((item) => item.id === payload.entryId);
        if (!entry || (entry.day_of_week === day && shortTime(entry.start_time) === start && shortTime(entry.end_time) === end)) return;
        await updateEntry.mutateAsync({ id: entry.id, versionId: selectedVersion.id, institutionId, dayOfWeek: day, startTime: start, endTime: end, locked: entry.locked, roomId: entry.room_id });
        await refreshHealth();
        setNotice(`${entry.subject_name} movida para ${DAY_LABELS[day]} ${start}.`);
        return;
      }
      if (payload.kind === 'offering' && payload.offeringId) {
        setEditingEntryId(null);
        setDuplicatingEntryId(null);
        setDialog({ offeringId: payload.offeringId, roomId: '', day, start, end, locked: false });
      }
    } catch { setError('Não foi possível interpretar o item arrastado.'); }
  }

  async function saveDialog(): Promise<void> {
    if (!dialog || !selectedVersion || selectedVersion.status !== 'DRAFT') return;
    clearFeedback();
    try {
      const editing = editingEntryId ? entries.find((entry) => entry.id === editingEntryId) : undefined;
      if (duplicatingEntryId) {
        const newId = await duplicateEntry.mutateAsync({ entryId: duplicatingEntryId, versionId: selectedVersion.id, institutionId, dayOfWeek: dialog.day, startTime: dialog.start, endTime: dialog.end });
        setUndoAction(() => async () => removeEntry.mutateAsync({ entryId: newId, versionId: selectedVersion.id, institutionId }));
        setNotice('Aula duplicada no rascunho.');
      } else if (editing) {
        const before = { ...editing };
        await updateEntry.mutateAsync({ id: editing.id, versionId: selectedVersion.id, institutionId, dayOfWeek: dialog.day, startTime: dialog.start, endTime: dialog.end, locked: dialog.locked, roomId: dialog.roomId || null });
        setUndoAction(() => async () => updateEntry.mutateAsync({ id: before.id, versionId: before.version_id, institutionId, dayOfWeek: before.day_of_week, startTime: before.start_time, endTime: before.end_time, locked: before.locked, roomId: before.room_id }));
        setNotice('Alteração salva automaticamente no rascunho.');
      } else {
        const newId = await addEntry.mutateAsync({ versionId: selectedVersion.id, institutionId, academicYearId: selectedYearId, termId: selectedTermId, classId: selectedClassId, subjectOfferingId: dialog.offeringId, roomId: dialog.roomId || null, dayOfWeek: dialog.day, startTime: dialog.start, endTime: dialog.end, locked: dialog.locked });
        setUndoAction(() => async () => removeEntry.mutateAsync({ entryId: newId, versionId: selectedVersion.id, institutionId }));
        setNotice('Aula adicionada ao rascunho.');
      }
      await refreshHealth();
      setDialog(null);
      setEditingEntryId(null);
      setDuplicatingEntryId(null);
    } catch (saveError) { setError(friendlyError(saveError)); }
  }

  async function removeSelected(entry: TimetableVersionEntryRow): Promise<void> {
    if (!selectedVersion || selectedVersion.status !== 'DRAFT') return;
    if (!window.confirm(`Remover ${entry.subject_name} de ${DAY_LABELS[entry.day_of_week]}?`)) return;
    clearFeedback();
    try {
      await removeEntry.mutateAsync({ entryId: entry.id, versionId: selectedVersion.id, institutionId });
      await refreshHealth();
      setNotice('Aula removida do rascunho.');
    } catch (removeError) { setError(friendlyError(removeError)); }
  }

  async function runValidation(): Promise<boolean> {
    if (!selectedVersion || selectedVersion.status !== 'DRAFT') return false;
    clearFeedback();
    try {
      const result = await validateDraft.mutateAsync({ versionId: selectedVersion.id, institutionId });
      setValidation(result);
      if (!result.valid) setError(`${result.diagnostics.length} pendência(s) impedem a publicação.`);
      else setNotice('Rascunho pronto para publicação.');
      return result.valid;
    } catch (validationError) { setError(friendlyError(validationError)); return false; }
  }

  async function addDoubleSlotFromDialog(): Promise<void> {
    if (!dialog || !selectedVersion || selectedVersion.status !== 'DRAFT' || editingEntryId || duplicatingEntryId) return;
    const currentSlot = slots.find((slot) => slot.day_of_week === dialog.day && shortTime(slot.start_time) === dialog.start && shortTime(slot.end_time) === dialog.end);
    const nextSlot = currentSlot ? slots.find((slot) => slot.day_of_week === dialog.day && slot.slot_number === currentSlot.slot_number + 1) : undefined;
    if (!nextSlot) return;
    clearFeedback();
    try {
      const ids = await addDoubleSlot.mutateAsync({
        versionId: selectedVersion.id,
        institutionId,
        academicYearId: selectedYearId,
        termId: selectedTermId,
        classId: selectedClassId,
        subjectOfferingId: dialog.offeringId,
        roomId: dialog.roomId || null,
        dayOfWeek: dialog.day,
        startTime: dialog.start,
        endTime: dialog.end,
        nextStartTime: shortTime(nextSlot.start_time),
        nextEndTime: shortTime(nextSlot.end_time),
        locked: dialog.locked,
      });
      setUndoAction(() => async () => (await Promise.all(ids.map((entryId) => removeEntry.mutateAsync({ entryId, versionId: selectedVersion.id, institutionId }))), undefined));
      setDialog(null);
      await refreshHealth();
      setNotice(`2 aulas consecutivas adicionadas: ${dialog.start}–${shortTime(nextSlot.end_time)}.`);
    } catch (doubleSlotError) { setError(friendlyError(doubleSlotError)); }
  }

  async function publish(): Promise<void> {
    if (!selectedVersion || selectedVersion.status !== 'DRAFT') return;
    if (!(await runValidation())) return;
    try {
      await publishVersion.mutateAsync({ versionId: selectedVersion.id, institutionId, academicYearId: selectedYearId });
      setNotice('Grade publicada. O rascunho foi validado e a publicação foi atômica.');
    } catch (publishError) { setError(friendlyError(publishError)); }
  }

  async function discard(): Promise<void> {
    if (!selectedVersion || selectedVersion.status !== 'DRAFT' || !window.confirm('Descartar este rascunho?')) return;
    try {
      await deleteVersion.mutateAsync({ versionId: selectedVersion.id, institutionId, academicYearId: selectedYearId });
      setVersionId('');
      setNotice('Rascunho descartado.');
    } catch (discardError) { setError(friendlyError(discardError)); }
  }

  async function copySelectedDay(): Promise<void> {
    if (!selectedVersion || selectedVersion.status !== 'DRAFT' || copySourceDay === copyTargetDay) return;
    const sourceCount = versionEntries.filter((entry) => entry.active && entry.day_of_week === copySourceDay).length;
    const occupiedTargets = versionEntries.filter((entry) => entry.active && entry.day_of_week === copyTargetDay);
    if (!window.confirm(`Copiar ${sourceCount} aula(s) de ${DAY_LABELS[copySourceDay]} para ${DAY_LABELS[copyTargetDay]}? ${occupiedTargets.length > 0 ? `${occupiedTargets.length} aula(s) já existem no dia de destino e serão reportadas como conflito, sem sobrescrever.` : ''}`)) return;
    clearFeedback();
    try {
      const result = await copyDay.mutateAsync({ versionId: selectedVersion.id, institutionId, sourceDay: copySourceDay, targetDay: copyTargetDay });
      await refreshHealth();
      setNotice(`${result.created} aula(s) copiadas. ${result.conflicts > 0 ? `${result.conflicts} conflito(s) preservado(s) sem sobrescrever.` : ''}`);
    } catch (copyError) { setError(friendlyError(copyError)); }
  }

  function renderSlotCell(day: number, row: { start: string; end: string }): ReactElement {
    const slot = slots.find((item) => item.day_of_week === day && shortTime(item.start_time) === row.start && shortTime(item.end_time) === row.end);
    const entry = entries.find((item) => item.day_of_week === day && shortTime(item.start_time) === row.start && shortTime(item.end_time) === row.end);
    const blocked = breaks.some((item) => item.day_of_week === day && item.start_time.slice(0, 5) < row.end && row.start < item.end_time.slice(0, 5));
    return <div key={`${day}-${row.start}`} onDragOver={(event) => { if (isDraft) event.preventDefault(); }} onDrop={(event) => { void handleDrop(day, row.start, row.end, event); }} className={`min-h-[6.5rem] border-l border-slate-200 p-2 dark:border-slate-700 ${blocked ? 'bg-slate-100 dark:bg-slate-800/80' : ''}`}>{blocked ? <div className="flex h-full min-h-20 items-center justify-center text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">Intervalo</div> : slot ? entry ? <><button type="button" draggable={isDraft} onDragStart={(event) => { event.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'entry', entryId: entry.id })); }} onClick={() => openEdit(entry)} disabled={!isDraft} className="group w-full rounded-lg border border-blue-200 bg-blue-50 p-2 text-left text-xs hover:border-blue-400 disabled:cursor-default dark:border-blue-800 dark:bg-blue-950/40"><span className="font-bold text-slate-900 dark:text-white">{entry.subject_name}</span><span className="mt-1 block text-slate-600 dark:text-slate-300">{entry.teacher_name ?? 'Professor pendente'}</span><span className="mt-1 block text-slate-500">{entry.room_id ? editorContext?.rooms.find((room) => room.id === entry.room_id)?.name ?? 'Sala' : 'Sala não definida'}{entry.locked ? ' · Fixa' : ''}</span>{isDraft && <span className="mt-1 hidden text-red-700 group-hover:block">Editar / remover</span>}</button>{isDraft && <div className="mt-1 flex gap-1"><button type="button" onClick={() => openDuplicate(entry)} className="rounded border border-blue-200 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">Duplicar</button><button type="button" onClick={() => void removeSelected(entry)} className="rounded border border-red-200 px-1.5 py-0.5 text-[10px] font-bold text-red-700">Remover</button></div>}</> : <button type="button" onClick={() => openAdd(day, row.start, row.end)} disabled={!isDraft} className="flex min-h-20 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs font-semibold text-slate-500 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-default dark:border-slate-700 dark:hover:bg-blue-950/30"><Plus className="mr-1 h-4 w-4" />Adicionar aula</button> : <span className="flex min-h-20 items-center justify-center text-xs text-slate-300">—</span>}</div>;
  }

  const isDraft = selectedVersion?.status === 'DRAFT';
  const busy = createDraft.isPending || addEntry.isPending || addDoubleSlot.isPending || duplicateEntry.isPending || updateEntry.isPending || removeEntry.isPending || copyDay.isPending || validateDraft.isPending || publishVersion.isPending;
  const publicationDiff = selectedVersion && isDraft && comparisonVersionId && !comparisonEntriesQuery.isLoading
    ? buildTimetableVersionDiff(versionEntries, comparisonEntriesQuery.data ?? [])
    : null;

  return (
    <section className="space-y-4" aria-label="Editor visual de grade horária">
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">Editor visual</p>
            <h2 className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">Monte o rascunho por turma</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">A publicação continua protegida por validação. Grades publicadas nunca são editadas diretamente.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300"><span className="rounded-full bg-white px-3 py-1 font-semibold shadow-sm dark:bg-slate-900">Autosave no draft</span><span className="rounded-full bg-white px-3 py-1 font-semibold shadow-sm dark:bg-slate-900">Intervalos visíveis</span><span className="rounded-full bg-white px-3 py-1 font-semibold shadow-sm dark:bg-slate-900">Rascunho seguro</span></div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Ano letivo<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" value={selectedYearId} onChange={(event) => { setYearId(event.target.value); setTermId(''); setClassId(''); setVersionId(''); }}><option value="">Selecione</option>{years.filter((year) => year.active).map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Período<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" value={selectedTermId} onChange={(event) => { setTermId(event.target.value); setVersionId(''); }}><option value="">Selecione</option>{terms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Turno<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" value={shiftFilter} onChange={(event) => { setShiftFilter(event.target.value); setClassId(''); setVersionId(''); }}><option value="all">Todos</option>{shiftOptions.map((value) => <option key={value} value={value}>{getAcademicShiftLabel(value)}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Turma<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" value={selectedClassId} onChange={(event) => { setClassId(event.target.value); setVersionId(''); }}><option value="">Selecione</option>{yearClasses.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.shift ?? 'sem turno'}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Versão<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" value={selectedVersionId} onChange={(event) => setVersionId(event.target.value)}><option value="">Sem versão selecionada</option>{versions.map((version) => <option key={version.id} value={version.id}>{version.name} · {version.status === 'DRAFT' ? 'Rascunho' : version.status === 'PUBLISHED' ? 'Publicada' : 'Arquivada'}</option>)}</select></label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => void createEmptyDraft()} disabled={busy || !selectedYearId || !selectedTermId || !selectedClassId} className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><Plus className="h-4 w-4" />Novo rascunho vazio</button>
          {selectedVersion && <button type="button" onClick={() => void cloneSelectedVersion()} disabled={busy || !selectedTermId || !selectedClassId} className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-bold text-blue-700 disabled:opacity-50 dark:bg-slate-900 dark:text-blue-300"><Copy className="h-4 w-4" />{selectedVersion.status === 'PUBLISHED' ? 'Editar publicada em novo rascunho' : 'Duplicar versão'}</button>}
          {selectedVersion && isDraft && <><button type="button" onClick={() => void runValidation()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><CheckCircle2 className="h-4 w-4" />Validar rascunho</button><button type="button" onClick={() => void publish()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />Publicar versão</button><button type="button" onClick={() => void discard()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700 dark:bg-slate-900"><Trash2 className="h-4 w-4" />Descartar</button></>}
        </div>
        {selectedVersion && isDraft && <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-blue-100 pt-3 text-sm dark:border-blue-900/60"><span className="mr-1 font-bold text-slate-700 dark:text-slate-200">Copiar dia</span><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">De<select className="ml-1 rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950" value={copySourceDay} onChange={(event) => setCopySourceDay(Number(event.target.value))}>{DAYS.map((day) => <option key={day} value={day}>{DAY_LABELS[day]}</option>)}</select></label><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Para<select className="ml-1 rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950" value={copyTargetDay} onChange={(event) => setCopyTargetDay(Number(event.target.value))}>{DAYS.map((day) => <option key={day} value={day}>{DAY_LABELS[day]}</option>)}</select></label><button type="button" onClick={() => void copySelectedDay()} disabled={busy || copySourceDay === copyTargetDay} className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-50 dark:bg-slate-900 dark:text-blue-300"><Copy className="h-4 w-4" />Pré-visualizar e copiar</button><span className="text-xs text-slate-500">Não sobrescreve células ocupadas.</span></div>}
      </div>

      {(notice || error) && <div role={error ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{error ?? notice}</div>}

      {selectedVersion && <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold text-slate-900 dark:text-white">{selectedVersion.name}</h3><p className="text-xs text-slate-500 dark:text-slate-400">{isDraft ? 'Clique em uma célula vazia para adicionar ou em uma aula para editar.' : 'Somente leitura: esta versão já está publicada.'}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${isDraft ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{isDraft ? 'RASCUNHO' : selectedVersion.status}</span></div>
          {entriesQuery.isLoading ? <div className="flex items-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Carregando aulas...</div> : <div className="rounded-lg border border-slate-200 dark:border-slate-700"><div className="flex gap-2 overflow-x-auto p-2 md:hidden" role="tablist" aria-label="Dias da semana"><span className="sr-only">Escolha o dia da grade</span>{DAYS.map((day) => <button key={day} type="button" role="tab" aria-selected={mobileDay === day} onClick={() => setMobileDay(day)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${mobileDay === day ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{DAY_LABELS[day]}</button>)}</div><div className="hidden overflow-x-auto md:block"><div className="min-w-[760px]" role="grid" aria-label="Grade semanal do rascunho"><div className="grid grid-cols-[7rem_repeat(6,minmax(7rem,1fr))] border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><div className="p-3">Horário</div>{DAYS.map((day) => <div key={day} className="border-l border-slate-200 p-3 dark:border-slate-700">{DAY_LABELS[day]}</div>)}</div>{rowSlots.map((row) => <div key={`${row.start}-${row.end}`} className="grid grid-cols-[7rem_repeat(6,minmax(7rem,1fr))] border-b border-slate-200 last:border-b-0 dark:border-slate-700"><div className="p-3 text-xs font-bold text-slate-600 dark:text-slate-300">{row.start}<br /><span className="font-normal">até {row.end}</span></div>{DAYS.map((day) => renderSlotCell(day, row))}</div>)}</div></div><div className="md:hidden" role="grid" aria-label={`Grade de ${DAY_LABELS[mobileDay]}`}><div className="grid grid-cols-[7rem_minmax(0,1fr)] border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><div className="p-3">Horário</div><div className="border-l border-slate-200 p-3 dark:border-slate-700">{DAY_LABELS[mobileDay]}</div></div>{rowSlots.map((row) => <div key={`${row.start}-${row.end}`} className="grid grid-cols-[7rem_minmax(0,1fr)] border-b border-slate-200 last:border-b-0 dark:border-slate-700"><div className="p-3 text-xs font-bold text-slate-600 dark:text-slate-300">{row.start}<br /><span className="font-normal">até {row.end}</span></div>{renderSlotCell(mobileDay, row)}</div>)}</div></div>}
          {isDraft && undoAction && <button type="button" onClick={() => { void undoAction().then(() => { setUndoAction(null); setNotice('Última alteração desfeita.'); }); }} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-blue-700 dark:text-blue-300"><RotateCcw className="h-4 w-4" />Desfazer última alteração</button>}
        </div>
        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-2"><History className="h-4 w-4 text-blue-600" /><h3 className="font-bold text-slate-900 dark:text-white">Saúde do rascunho</h3></div>{validation ? <div className="mt-3 space-y-2">{validation.valid ? <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" />Sem pendências conhecidas</p> : <><p className="flex items-center gap-2 text-sm font-semibold text-red-700"><XCircle className="h-4 w-4" />{validation.diagnostics.length} pendência(s)</p><ul className="max-h-56 space-y-2 overflow-auto text-xs text-slate-600">{validation.diagnostics.slice(0, 10).map((item, index) => <li key={`${item.code}-${index}`}><strong>{item.code}:</strong> {item.message}</li>)}</ul></>}</div> : <p className="mt-3 text-sm text-slate-500">Edite o rascunho para atualizar conflitos de turma, professor, sala, intervalo e carga.</p>}</section><section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><h3 className="font-bold text-slate-900 dark:text-white">Preview de publicação</h3>{publicationDiff ? <><div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3"><span className="rounded bg-emerald-50 px-2 py-1 font-semibold text-emerald-800">+ {publicationDiff.added} adicionada(s)</span><span className="rounded bg-red-50 px-2 py-1 font-semibold text-red-800">− {publicationDiff.removed} removida(s)</span><span className="rounded bg-blue-50 px-2 py-1 font-semibold text-blue-800">↔ {publicationDiff.moved} movida(s)</span><span className="rounded bg-amber-50 px-2 py-1 font-semibold text-amber-800">Sala {publicationDiff.roomChanged}</span><span className="rounded bg-slate-100 px-2 py-1 font-semibold text-slate-700">= {publicationDiff.unchanged} sem alteração</span></div><p className="mt-3 text-xs text-slate-500">Comparação feita com a versão de origem/publicada. A publicação atômica substituirá somente o conjunto coberto por esta versão.</p>{publicationDiff.affectedClassNames.length > 0 && <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Turmas afetadas: {publicationDiff.affectedClassNames.join(', ')}</p>}</> : <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">O rascunho ainda não possui uma versão de referência para comparar.</p>}</section>
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><h3 className="font-bold text-slate-900 dark:text-white">Paleta de disciplinas</h3><p className="mt-1 text-xs text-slate-500">Aulas posicionadas nesta turma/período.</p><div className="mt-3 space-y-2">{offeringStats.length === 0 ? <p className="text-sm text-slate-500">Nenhuma atribuição encontrada.</p> : offeringStats.map(({ offering, count, required }) => <div key={offering.id} draggable={isDraft} onDragStart={(event) => { event.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'offering', offeringId: offering.id })); }} className="rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-700"><div className="flex items-start justify-between gap-2"><span className="font-bold text-slate-800 dark:text-slate-100">{offering.subject_name}</span><span className={count === required ? 'font-bold text-emerald-700' : 'font-bold text-amber-700'}>{count}/{required || '—'}</span></div><span className="mt-1 block text-slate-500">{offering.teacher_name ?? 'Professor pendente'}</span></div>)}</div></section>
        </aside>
      </div>}

      {dialog && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="manual-entry-title"><div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><div><h3 id="manual-entry-title" className="text-lg font-bold text-slate-900 dark:text-white">Aula no rascunho</h3><p className="text-sm text-slate-500">{DAY_LABELS[dialog.day]} · {dialog.start}–{dialog.end}</p></div><button type="button" onClick={() => { setDialog(null); setEditingEntryId(null); setDuplicatingEntryId(null); }} aria-label="Fechar" className="rounded-md p-1 text-slate-500 hover:bg-slate-100"><XCircle className="h-5 w-5" /></button></div><div className="mt-4 space-y-3"><label className="block text-sm font-semibold">Disciplina e professor<select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={dialog.offeringId} onChange={(event) => setDialog({ ...dialog, offeringId: event.target.value })}>{offeringStats.map(({ offering, count, required }) => <option key={offering.id} value={offering.id}>{offering.subject_name} · {offering.teacher_name ?? 'Professor pendente'} ({count}/{required || '—'})</option>)}</select></label><div className="grid gap-3 sm:grid-cols-3"><label className="block text-sm font-semibold">Dia<select className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" value={dialog.day} onChange={(event) => setDialog({ ...dialog, day: Number(event.target.value) })}>{DAYS.map((day) => <option key={day} value={day}>{DAY_LABELS[day]}</option>)}</select></label><label className="block text-sm font-semibold sm:col-span-2">Horário<select className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" value={`${dialog.start}-${dialog.end}`} onChange={(event) => { const [start, end] = event.target.value.split('-'); setDialog({ ...dialog, start, end }); }}>{rowSlots.map((row) => <option key={`${row.start}-${row.end}`} value={`${row.start}-${row.end}`}>{row.start} até {row.end}</option>)}</select></label></div><label className="block text-sm font-semibold">Sala<select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={dialog.roomId} onChange={(event) => setDialog({ ...dialog, roomId: event.target.value })}><option value="">Sem sala definida</option>{(editorContext?.rooms ?? []).map((room) => <option key={room.id} value={room.id}>{room.name}{room.class_id === selectedClassId ? ' · desta turma' : ''}</option>)}</select></label><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={dialog.locked} onChange={(event) => setDialog({ ...dialog, locked: event.target.checked })} />Marcar como aula fixa</label></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => { setDialog(null); setEditingEntryId(null); setDuplicatingEntryId(null); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold">Cancelar</button>{(() => { const currentSlot = slots.find((slot) => slot.day_of_week === dialog.day && shortTime(slot.start_time) === dialog.start && shortTime(slot.end_time) === dialog.end); const nextSlot = currentSlot ? slots.find((slot) => slot.day_of_week === dialog.day && slot.slot_number === currentSlot.slot_number + 1) : undefined; return !editingEntryId && !duplicatingEntryId && nextSlot ? <button type="button" onClick={() => void addDoubleSlotFromDialog()} disabled={busy || !dialog.offeringId} className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-bold text-blue-700">Adicionar 2 aulas consecutivas</button> : null; })()}<button type="button" onClick={() => void saveDialog()} disabled={busy || !dialog.offeringId} className="rounded-lg bg-[#005bbf] px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Salvar no rascunho</button></div></div></div>}
    </section>
  );
}
