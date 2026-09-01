import { useEffect, useMemo, useState } from 'react';

import { useAcademicYears } from '../../hooks/useAcademicStructure';
import {
  useAcademicShiftSettings,
  useSchoolScheduleBreaks,
} from '../../hooks/useAcademicTermClosing';
import {
  useDeleteTimetableVersion,
  useGenerateTimetableDraft,
  usePublishTimetableVersion,
  useTimetableVersionEntries,
  useTimetablePreparation,
  useTimetableVersions,
  useUpdateTimetableVersionEntry,
} from '../../hooks/useAcademicAutomation';
import type { TimetableVersionEntryRow } from '../../services/timetableAutomationService';
import {
  getAcademicShiftLabel,
  normalizeAcademicShift,
  type AcademicShift,
} from '../../lib/academic/academicShifts';
import type { SchoolScheduleBreakRow } from '../../services/academicAutomationService';
import { REQUIRED_SCHOOL_DAYS } from '../../lib/academic/timetableGenerator';
import TimetableBreakMarker from './TimetableBreakMarker';

interface EntryDraft {
  day_of_week: number;
  start_time: string;
  end_time: string;
  locked: boolean;
}

const DAY_LABELS = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

type TimetableOperation = 'general' | 'publish' | 'review';

function getErrorMessage(error: unknown, operation: TimetableOperation = 'general'): string {
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
  if (values.some((value) => value.includes('TIMETABLE_DAY_NOT_CONFIGURED'))) {
    return 'A publicação foi bloqueada porque há aulas em um dia que não está configurado como letivo.';
  }
  if (values.some((value) => value.includes('ROOM_REQUIRED'))) {
    return 'A publicação foi bloqueada porque a política exige uma sala para cada aula.';
  }
  if (values.some((value) => value.includes('ROOM_NOT_ASSIGNED_TO_CLASS'))) {
    return 'A publicação foi bloqueada porque uma sala exclusiva está vinculada a outra turma.';
  }
  if (values.some((value) => value.includes('CLASS_DAILY_LESSONS_LIMIT'))) {
    return 'A publicação foi bloqueada porque uma turma ultrapassa o limite diário de aulas da política acadêmica.';
  }
  if (values.some((value) => value.includes('SUBJECT_DAILY_LESSONS_LIMIT'))) {
    return 'A publicação foi bloqueada porque uma matéria ultrapassa o limite diário configurado para a turma.';
  }
  if (values.some((value) => value.includes('CONSECUTIVE_SUBJECT_LESSONS_LIMIT'))) {
    return 'A publicação foi bloqueada porque uma matéria aparece em aulas consecutivas além do limite configurado.';
  }
  if (values.some((value) => value.includes('TEACHER_DAILY_LESSONS_LIMIT'))) {
    return 'A publicação foi bloqueada porque um professor ultrapassa o limite diário configurado.';
  }
  if (values.some((value) => value.includes('TEACHER_WEEKLY_LESSONS_LIMIT'))) {
    return 'A publicação foi bloqueada porque um professor ultrapassa a carga semanal configurada.';
  }
  if (values.some((value) => value.includes('TIMETABLE_VERSION_SHIFT_MISMATCH'))) {
    return 'A publicação foi bloqueada porque a proposta contém uma turma de turno diferente do turno selecionado.';
  }
  if (values.some((value) => value.includes('WEEKLY_LESSONS_MISMATCH'))) {
    return 'A publicação foi bloqueada porque a quantidade de aulas não corresponde à matriz curricular. Revise a carga semanal das disciplinas.';
  }
  if (values.some((value) => value.includes('TIMETABLE_VERSION_NOT_DRAFT'))) {
    return 'Esta grade não está mais em rascunho e não pode ser publicada novamente.';
  }
  if (values.some((value) => value.includes('STATEMENT TIMEOUT') || value.includes('CANCELING STATEMENT'))) {
    if (operation === 'publish') {
      return 'A publicação demorou mais que o esperado. Tente publicar novamente.';
    }
    if (operation === 'review') {
      return 'A revisão demorou mais que o esperado. Tente abrir a proposta novamente.';
    }
    return 'A operação demorou mais que o esperado. Tente novamente.';
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
    case 'WEEKDAY_SCHOOL_SLOT_REQUIRED':
      return `${diagnostic.message} Cadastre horários escolares para esses dias e turno.`;
    case 'WEEKDAY_TEACHER_AVAILABILITY_REQUIRED':
      return `${diagnostic.message} Ajuste a disponibilidade dos professores atribuídos.`;
    case 'WEEKDAY_COVERAGE_CAPACITY_INSUFFICIENT':
      return `${diagnostic.message} Revise a carga semanal, os slots e os conflitos.`;
    default:
      return diagnostic.message;
  }
}

function VersionReview({
  entries,
  scheduleBreaks,
  onEdit,
  editable,
  schoolDays,
}: {
  entries: TimetableVersionEntryRow[];
  scheduleBreaks: SchoolScheduleBreakRow[];
  onEdit: (entry: TimetableVersionEntryRow) => void;
  editable: boolean;
  schoolDays?: number[];
}) {
  const classes = useMemo(() => {
    const grouped = new Map<string, TimetableVersionEntryRow[]>();
    for (const entry of entries.filter((item) => item.active)) {
      const current = grouped.get(`${entry.class_id}:${entry.term_id}`) ?? [];
      current.push(entry);
      grouped.set(`${entry.class_id}:${entry.term_id}`, current);
    }
    return Array.from(grouped.entries()).map(([key, classEntries]) => ({
      key,
      name: classEntries[0]?.class_name ?? 'Turma',
      termName: classEntries[0]?.term_name ?? 'Período',
      shift: classEntries[0]?.class_shift ?? null,
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
        <section key={classGroup.key} className="rounded-lg border border-[#e4e8f1]">
          <div className="border-b border-[#e4e8f1] px-4 py-3">
            <h5 className="font-bold text-[#181c20]">{classGroup.name}</h5>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-[#667085]">
              {classGroup.termName}
            </p>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-3">
            {[...new Set<number>([
              ...(schoolDays ?? REQUIRED_SCHOOL_DAYS),
              ...classGroup.entries.map((entry) => entry.day_of_week),
              ...scheduleBreaks
                .filter((scheduleBreak) =>
                  classGroup.shift &&
                  normalizeAcademicShift(scheduleBreak.shift) ===
                    normalizeAcademicShift(classGroup.shift),
                )
                .map((scheduleBreak) => scheduleBreak.day_of_week),
            ])].sort((left, right) => left - right).map((day) => (
              <div key={day}>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#667085]">
                  {DAY_LABELS[day]}
                </p>
                <div className="mt-2 space-y-2">
                  {[
                    ...classGroup.entries
                      .filter((entry) => entry.day_of_week === day)
                      .map((entry) => ({
                        kind: 'lesson' as const,
                        startTime: entry.start_time,
                        entry,
                      })),
                    ...scheduleBreaks
                      .filter((scheduleBreak) =>
                        classGroup.shift &&
                        scheduleBreak.active &&
                        scheduleBreak.day_of_week === day &&
                        normalizeAcademicShift(scheduleBreak.shift) ===
                          normalizeAcademicShift(classGroup.shift),
                      )
                      .map((scheduleBreak) => ({
                        kind: 'break' as const,
                        startTime: scheduleBreak.start_time,
                        scheduleBreak,
                      })),
                  ]
                    .sort((left, right) => left.startTime.localeCompare(right.startTime))
                    .map((item) => item.kind === 'break' ? (
                      <div key={`break-${item.scheduleBreak.id}`}>
                        <TimetableBreakMarker scheduleBreak={item.scheduleBreak} />
                      </div>
                    ) : (
                      editable ? <button
                        type="button"
                        key={item.entry.id}
                        aria-label={`Editar ${item.entry.subject_name} às ${formatTime(item.entry.start_time)}`}
                        onClick={() => onEdit(item.entry)}
                        className="block w-full rounded-md border border-blue-100 bg-blue-50 p-2 text-left text-xs hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf]"
                      >
                        <span className="font-bold text-[#181c20]">
                          {formatTime(item.entry.start_time)} {item.entry.subject_name}
                        </span>
                        <span className="mt-1 block text-[#667085]">
                          {item.entry.teacher_name ?? 'Professor pendente'}
                          {item.entry.locked ? ' · Fixo' : ''}
                        </span>
                      </button> : <div
                        key={item.entry.id}
                        className="block w-full rounded-md border border-blue-100 bg-blue-50 p-2 text-left text-xs"
                      >
                        <span className="font-bold text-[#181c20]">
                          {formatTime(item.entry.start_time)} {item.entry.subject_name}
                        </span>
                        <span className="mt-1 block text-[#667085]">
                          {item.entry.teacher_name ?? 'Professor pendente'}
                          {item.entry.locked ? ' · Fixo' : ''}
                        </span>
                      </div>
                    ))}
                  {classGroup.entries.every((entry) => entry.day_of_week !== day) &&
                    !scheduleBreaks.some((scheduleBreak) =>
                      classGroup.shift &&
                      scheduleBreak.active &&
                      scheduleBreak.day_of_week === day &&
                      normalizeAcademicShift(scheduleBreak.shift) ===
                        normalizeAcademicShift(classGroup.shift),
                    ) && (
                    <p className="rounded-md border border-dashed border-[#e4e8f1] p-2 text-xs text-[#98a2b3]">
                      Sem aulas geradas
                    </p>
                  )}
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
  const scheduleBreaksQuery = useSchoolScheduleBreaks(institutionId);
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

  const [generationShift, setGenerationShift] = useState('TODOS');
  const preparationQuery = useTimetablePreparation(institutionId, selectedYearId, generationShift);
  const enabledShifts: AcademicShift[] =
    shiftSettingsQuery.data ?? ['MATUTINO'];
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
    if (preparationQuery.data && !preparationQuery.data.ready) {
      setError('Resolva os bloqueios da preparação da grade antes de gerar.');
      return;
    }
    if (!sourceVersionId && (versionsQuery.data ?? []).some((version) => version.status === 'DRAFT')) {
      const shouldContinue = window.confirm('Já existe uma grade em rascunho para este ano. Deseja gerar uma nova proposta?');
      if (!shouldContinue) return;
    }
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
      setError(getErrorMessage(publishError, 'publish'));
    }
  }

  async function removeVersion(versionId: string): Promise<void> {
    const version = versions.find((item) => item.id === versionId);
    if (!version || (version.status !== 'DRAFT' && version.status !== 'PUBLISHED')) return;

    const isPublished = version.status === 'PUBLISHED';
    const confirmation = isPublished
      ? 'Excluir a grade publicada? Ela deixará de aparecer para alunos e responsáveis. Esta ação não pode ser desfeita.'
      : 'Excluir esta proposta de grade? Esta ação não pode ser desfeita.';
    if (!window.confirm(confirmation)) return;

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
      setMessage(isPublished ? 'Grade publicada removida.' : 'Proposta excluída.');
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
              {enabledShifts.map((availableShift) => (
                <option key={availableShift} value={availableShift}>
                  {getAcademicShiftLabel(availableShift)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={!selectedYearId || generateMutation.isPending || preparationQuery.isLoading || preparationQuery.isFetching || preparationQuery.isError || Boolean(preparationQuery.data && !preparationQuery.data.ready)}
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

      {selectedYearId && (
        <section className="rounded-lg border border-[#d8deea] bg-slate-50 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="font-semibold text-[#181c20]">Preparação da grade</h4>
              <p className="text-xs text-[#667085]">Confira a capacidade antes de criar a proposta.</p>
            </div>
            <button
              type="button"
              onClick={() => void preparationQuery.refetch()}
              disabled={preparationQuery.isFetching}
              className="self-start rounded-lg border border-[#c1c6d6] bg-white px-3 py-2 text-xs font-semibold text-[#005bbf] hover:bg-blue-50 disabled:opacity-50"
            >
              {preparationQuery.isFetching ? 'Atualizando...' : 'Atualizar preparação'}
            </button>
          </div>

          {preparationQuery.isLoading ? (
            <p className="mt-3 text-sm text-[#667085]">Calculando alunos, salas, professores e horários...</p>
          ) : preparationQuery.isError ? (
            <p role="alert" className="mt-3 text-sm text-red-700">Não foi possível calcular a preparação. Atualize a página e tente novamente.</p>
          ) : preparationQuery.data ? (
            <>
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
                <div className="rounded-lg border border-[#d8deea] bg-white p-3"><strong>{preparationQuery.data.totals.classes}</strong> turma(s)</div>
                <div className="rounded-lg border border-[#d8deea] bg-white p-3"><strong>{preparationQuery.data.totals.students}</strong> aluno(s)</div>
                <div className="rounded-lg border border-[#d8deea] bg-white p-3"><strong>{preparationQuery.data.totals.rooms}</strong> sala(s) ativa(s)</div>
                <div className="rounded-lg border border-[#d8deea] bg-white p-3"><strong>{preparationQuery.data.totals.slots}</strong> horário(s) cadastrado(s)</div>
              </div>
              {preparationQuery.data.blockers.length > 0 && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <strong>Geração bloqueada</strong>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {preparationQuery.data.blockers.slice(0, 8).map((blocker) => <li key={`${blocker.code}:${blocker.message}`}>{blocker.message} {blocker.action}</li>)}
                  </ul>
                  {preparationQuery.data.blockers.length > 8 && <p className="mt-2">E mais {preparationQuery.data.blockers.length - 8} bloqueio(s).</p>}
                </div>
              )}
              {preparationQuery.data.warnings.length > 0 && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <strong>Atenção antes de publicar</strong>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {preparationQuery.data.warnings.slice(0, 5).map((warning) => <li key={`${warning.code}:${warning.message}`}>{warning.message}</li>)}
                  </ul>
                </div>
              )}
              {preparationQuery.data.ready && preparationQuery.data.blockers.length === 0 && (
                <p className="mt-3 text-sm font-semibold text-emerald-700">Preparação concluída. A geração pode ser iniciada.</p>
              )}
            </>
          ) : null}
        </section>
      )}

      <section>
        <div>
          <h4 className="font-semibold text-[#181c20]">Grades geradas</h4>
          <p className="text-xs text-[#667085]">Toda geração começa como rascunho e precisa de revisão.</p>
        </div>
        <div className="mt-3 overflow-x-auto rounded-lg border border-[#e4e8f1]">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.08em] text-[#667085]"><tr><th className="px-3 py-2">Versão</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Turno</th><th className="px-3 py-2">Origem</th><th className="px-3 py-2">Ações</th></tr></thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id} className="border-t border-[#e4e8f1]">
                  <td className="px-3 py-2 font-semibold text-[#181c20]">{version.name}</td>
                  <td className="px-3 py-2">{version.status}</td>
                  <td className="px-3 py-2">{version.generation_shift === 'TODOS' || !version.generation_shift ? 'Todos' : getAcademicShiftLabel(version.generation_shift)}</td>
                  <td className="px-3 py-2">{version.generation_source}</td>
                  <td className="px-3 py-2"><div className="flex flex-wrap gap-3">
                    <button type="button" onClick={() => { setError(null); setReviewVersionId(version.id); }} className="font-semibold text-blue-700 hover:text-blue-900">Revisar grade</button>
                    {version.status === 'DRAFT' && <>
                      <button type="button" onClick={() => void generate(version.id)} disabled={generateMutation.isPending} className="font-semibold text-blue-700 disabled:opacity-50">Regenerar grade</button>
                      <button type="button" onClick={() => void publish(version.id)} disabled={publishMutation.isPending} className="font-semibold text-emerald-700 disabled:opacity-50">Publicar grade</button>
                    </>}
                    {(version.status === 'DRAFT' || version.status === 'PUBLISHED') && <button type="button" onClick={() => void removeVersion(version.id)} disabled={deleteMutation.isPending} className="font-semibold text-red-700 disabled:opacity-50">{version.status === 'PUBLISHED' ? 'Excluir grade' : 'Excluir proposta'}</button>}
                  </div></td>
                </tr>
              ))}
              {versions.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-[#667085]">Nenhuma grade foi gerada para este ano.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {reviewVersionId && (
        <section className="space-y-4 border-t border-[#e4e8f1] pt-5">
          <div><h4 className="font-semibold text-[#181c20]">Revisar grade</h4><p className="text-sm text-[#667085]">Clique em uma aula para editar o horário ou marcá-la como fixa.</p></div>
          {versionEntriesQuery.isLoading ? <p className="text-sm text-[#667085]">Carregando rascunho...</p> : versionEntriesQuery.isError ? <p role="alert" className="text-sm text-red-700">{getErrorMessage(versionEntriesQuery.error, 'review')}</p> : <VersionReview entries={versionEntriesQuery.data ?? []} scheduleBreaks={scheduleBreaksQuery.data ?? []} onEdit={openEntryEditor} editable={reviewVersion?.status === 'DRAFT'} schoolDays={preparationQuery.data?.policy.schoolDays} />}
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
