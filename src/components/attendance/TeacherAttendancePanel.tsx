import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Save,
} from 'lucide-react';

import {
  useAttendanceRollCall,
  useSaveAttendanceRollCall,
  useTeacherAttendanceOfferings,
} from '../../hooks/useAttendance';
import { useSubjectOfferingWorkloadProgress } from '../../hooks/useWorkload';
import {
  ATTENDANCE_RECORD_STATUSES,
  attendanceSlotKey,
  selectAttendanceOfferingForDate,
  type AttendanceSelectableSlot,
  type AttendanceScheduleSlotSelection,
  type AttendanceStatus,
} from '../../services/attendanceService';
import { formatSubjectOfferingLabel } from '../../lib/subjectOfferingLabels';
import {
  ATTENDANCE_STATUS_LABELS,
  formatAttendanceDate,
  formatAttendanceTime,
  getDateForAttendancePeriod,
  getTodayDateInputValue,
  isAttendanceDateWithinPeriod,
} from './attendanceDisplay';

interface EditableAttendanceRecord {
  studentId: string;
  status: AttendanceStatus;
  notes: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Não foi possível carregar a chamada.';
}

function getRecordKey(
  record: Pick<
    EditableAttendanceRecord,
    'status' | 'notes'
  >,
): string {
  return `${record.status}:${record.notes.trim()}`;
}

function formatWorkloadMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}h ${String(remainingMinutes).padStart(2, '0')}min`;
}

function getCalendarBlockerLabels(
  blockers: readonly { event_type: string }[],
): string[] {
  const labels: Record<string, string> = {
    HOLIDAY: 'Feriado',
    RECESS: 'Recesso',
    CLASS_SUSPENSION: 'Suspensão de aula',
  };

  return blockers
    .map((blocker) => labels[blocker.event_type])
    .filter((label): label is string => Boolean(label));
}

function getDiaryState({
  sessionStatus,
  hasSession,
  historicalOnlySlot,
  calendarBlocked,
}: {
  sessionStatus?: string;
  hasSession: boolean;
  historicalOnlySlot: boolean;
  calendarBlocked: boolean;
}): { label: string; className: string } {
  if (sessionStatus === 'CLOSED') {
    return {
      label: 'Finalizada',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
    };
  }

  if (calendarBlocked) {
    return {
      label: 'Aula suspensa',
      className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
    };
  }

  if (historicalOnlySlot) {
    return {
      label: 'Horário histórico',
      className: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
    };
  }

  if (hasSession) {
    return {
      label: 'Rascunho',
      className: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300',
    };
  }

  return {
    label: 'Nova aula',
    className: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };
}

export default function TeacherAttendancePanel({
  profileId,
  institutionId,
}: {
  profileId: string | undefined;
  institutionId: string | undefined;
}) {
  const [selectedOfferingId, setSelectedOfferingId] =
    useState('');
  const [sessionDate, setSessionDate] = useState(
    getTodayDateInputValue,
  );
  const [selectedScheduleSlot, setSelectedScheduleSlot] =
    useState<AttendanceScheduleSlotSelection>();
  const [selectionTouched, setSelectionTouched] = useState(false);
  const [records, setRecords] = useState<
    EditableAttendanceRecord[]
  >([]);
  const [topic, setTopic] = useState('');
  const [classActivity, setClassActivity] = useState('');
  const [homework, setHomework] = useState('');
  const [notes, setNotes] = useState('');
  const [successMessage, setSuccessMessage] =
    useState('');
  const [dateAdjustmentMessage, setDateAdjustmentMessage] =
    useState('');

  const offeringsQuery =
    useTeacherAttendanceOfferings(
      profileId,
      institutionId,
      sessionDate,
    );

  const offerings = offeringsQuery.data ?? [];
  const selectedOffering = offerings.find(
    (offering) => offering.id === selectedOfferingId,
  );
  const availableScheduleSlots = useMemo<
    AttendanceSelectableSlot[]
  >(
    () =>
      selectedOffering?.selectableSlots ??
      (selectedOffering?.scheduleSlots ?? []).map(
        (slot) => ({ ...slot, source: 'TIMETABLE' }),
      ),
    [
      selectedOffering?.scheduleSlots,
      selectedOffering?.selectableSlots,
    ],
  );
  const slotRequired =
    availableScheduleSlots.length > 1 && !selectedScheduleSlot;
  const termStartDate = selectedOffering?.termStartDate ?? null;
  const termEndDate = selectedOffering?.termEndDate ?? null;
  const todayDate = getTodayDateInputValue();

  useEffect(() => {
    if (offerings.length === 0) {
      return;
    }

    const selectedOffering = selectAttendanceOfferingForDate(
      offerings,
      sessionDate,
      selectionTouched ? selectedOfferingId : undefined,
    );

    if (selectedOffering && selectedOffering.id !== selectedOfferingId) {
      setSelectedOfferingId(selectedOffering.id);
    }
  }, [
    offerings,
    selectedOfferingId,
    selectionTouched,
    sessionDate,
  ]);

  useEffect(() => {
    if (!selectedOffering) {
      return;
    }

    const dateForPeriod = getDateForAttendancePeriod(
      todayDate,
      selectedOffering.termStartDate,
      selectedOffering.termEndDate,
    );

    const todayIsWithinPeriod = isAttendanceDateWithinPeriod(
      todayDate,
      selectedOffering.termStartDate,
      selectedOffering.termEndDate,
    );

    if (todayIsWithinPeriod) {
      if (
        !isAttendanceDateWithinPeriod(
          sessionDate,
          selectedOffering.termStartDate,
          selectedOffering.termEndDate,
        )
      ) {
        setSessionDate(todayDate);
      }
      setDateAdjustmentMessage('');
      return;
    }

    if (dateForPeriod === sessionDate) {
      return;
    }

    setSessionDate(dateForPeriod);
    setDateAdjustmentMessage(
      `A data de hoje está fora do período ${selectedOffering.termName ? `"${selectedOffering.termName}" ` : ''}da atribuição. A chamada foi preparada para ${formatAttendanceDate(dateForPeriod)}. Para registrar a aula de hoje, atualize o período letivo no calendário acadêmico.`,
    );
  }, [selectedOffering, todayDate]);

  useEffect(() => {
    setSelectedScheduleSlot((currentSlot) => {
      if (availableScheduleSlots.length === 1) {
        const onlySlot = availableScheduleSlots[0];

        return onlySlot
          ? {
              startTime: onlySlot.startTime,
              endTime: onlySlot.endTime,
            }
          : undefined;
      }

      if (
        currentSlot &&
        availableScheduleSlots.some(
          (slot) =>
            attendanceSlotKey(slot) ===
            attendanceSlotKey(currentSlot),
        )
      ) {
        return currentSlot;
      }

      return undefined;
    });
  }, [availableScheduleSlots]);

  const rollCallQuery = useAttendanceRollCall(
    institutionId,
    selectedOfferingId || undefined,
    sessionDate,
    selectedScheduleSlot,
    !slotRequired,
  );

  const saveMutation = useSaveAttendanceRollCall();
  const workloadQuery = useSubjectOfferingWorkloadProgress(
    institutionId,
    selectedOfferingId || undefined,
    todayDate,
  );

  const activeRollCall = slotRequired
    ? undefined
    : rollCallQuery.data;
  const selectedSlot = selectedScheduleSlot
    ? availableScheduleSlots.find(
        (slot) =>
          attendanceSlotKey(slot) ===
          attendanceSlotKey(selectedScheduleSlot),
      )
    : undefined;
  const historicalOnlySlot =
    selectedSlot?.source === 'HISTORICAL';
  const calendarStatus = activeRollCall?.calendarStatus;
  const calendarBlocked = Boolean(calendarStatus?.blocked);
  const historicalSession = Boolean(activeRollCall?.session);
  const editingDisabled =
    slotRequired ||
    historicalOnlySlot ||
    calendarBlocked ||
    activeRollCall?.session?.status === 'CLOSED';
  const blockerLabels = calendarStatus
    ? getCalendarBlockerLabels(calendarStatus.blockers)
    : [];
  const diaryState = getDiaryState({
    sessionStatus: activeRollCall?.session?.status,
    hasSession: Boolean(activeRollCall?.session),
    historicalOnlySlot,
    calendarBlocked,
  });
  const displayedScheduleSlot = activeRollCall?.scheduleSlot ?? selectedScheduleSlot;
  const attendanceStatusSummary = useMemo(() => {
    const counts: Partial<Record<AttendanceStatus, number>> = {};

    for (const record of records) {
      counts[record.status] = (counts[record.status] ?? 0) + 1;
    }

    return ATTENDANCE_RECORD_STATUSES
      .filter((status) => (counts[status] ?? 0) > 0)
      .map((status) => `${counts[status]} ${ATTENDANCE_STATUS_LABELS[status].toLocaleLowerCase('pt-BR')}`)
      .join(' · ');
  }, [records]);

  useEffect(() => {
    if (!activeRollCall) {
      setRecords([]);
      return;
    }

    setRecords(
      activeRollCall.records.map((record) => ({
        studentId: record.student.id,
        status: record.status,
        notes: record.notes ?? '',
      })),
    );
    setTopic(activeRollCall.session?.topic ?? '');
    setClassActivity(activeRollCall.session?.classActivity ?? '');
    setHomework(activeRollCall.session?.homework ?? '');
    setNotes(activeRollCall.session?.notes ?? '');
    setSuccessMessage('');
  }, [rollCallQuery.dataUpdatedAt, activeRollCall]);

  const originalRecords = useMemo(() => {
    const values = new Map<string, string>();

    for (const record of activeRollCall?.records ?? []) {
      values.set(
        record.student.id,
        getRecordKey({
          status: record.status,
          notes: record.notes ?? '',
        }),
      );
    }

    return values;
  }, [activeRollCall]);

  const recordsByStudentId = useMemo(
    () =>
      new Map(
        records.map((record) => [
          record.studentId,
          record,
        ]),
      ),
    [records],
  );

  const hasUnsavedChanges =
    (!activeRollCall?.session && records.length > 0) ||
    topic !== (activeRollCall?.session?.topic ?? '') ||
    classActivity !== (activeRollCall?.session?.classActivity ?? '') ||
    homework !== (activeRollCall?.session?.homework ?? '') ||
    notes !== (activeRollCall?.session?.notes ?? '') ||
    records.some(
      (record) =>
        originalRecords.get(record.studentId) !==
        getRecordKey(record),
    );

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () =>
      window.removeEventListener(
        'beforeunload',
        handleBeforeUnload,
      );
  }, [hasUnsavedChanges]);

  const updateRecord = (
    studentId: string,
    changes: Partial<
      Pick<EditableAttendanceRecord, 'status' | 'notes'>
    >,
  ) => {
    setSuccessMessage('');
    setRecords((currentRecords) =>
      currentRecords.map((record) =>
        record.studentId === studentId
          ? {
              ...record,
              ...changes,
            }
          : record,
      ),
    );
  };

  const markAllPresent = () => {
    setSuccessMessage('');
    setRecords((currentRecords) =>
      currentRecords.map((record) => ({
        ...record,
        status: 'PRESENT',
      })),
    );
  };

  const saveDiary = async (
    action: 'SAVE_DRAFT' | 'FINALIZE',
  ) => {

    if (
      !profileId ||
      !institutionId ||
      !selectedOfferingId ||
      saveMutation.isPending ||
      records.length === 0
    ) {
      return;
    }

    if (
      action === 'FINALIZE' &&
      typeof window !== 'undefined' &&
      !window.confirm(
        'Após finalizar, o professor não poderá editar livremente este diário. Deseja continuar?',
      )
    ) {
      return;
    }

    await saveMutation.mutateAsync({
      institutionId,
      subjectOfferingId: selectedOfferingId,
      sessionDate,
      profileId,
      scheduleSlot: selectedScheduleSlot,
      topic,
      classActivity,
      homework,
      notes,
      action,
      records: records.map((record) => ({
        studentId: record.studentId,
        status: record.status,
        notes: record.notes,
      })),
    });

    setSuccessMessage(
      action === 'FINALIZE'
        ? 'Aula finalizada com sucesso.'
        : 'Rascunho salvo com sucesso.',
    );
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    await saveDiary('FINALIZE');
  };

  return (
    <section className="rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <header className="mb-4 flex flex-col gap-3 border-b border-[#dfe3e8] pb-4 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="rounded-lg bg-blue-50 p-2 text-[#005bbf] dark:bg-blue-950/40 dark:text-blue-300">
            <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf] dark:text-blue-400">
              Registro da aula
            </p>
            <h2 className="mt-1 truncate text-lg font-bold text-[#181c20] dark:text-white">
              {selectedOffering
                ? `${selectedOffering.subjectName} · ${selectedOffering.className}`
                : 'Selecione uma atribuição'}
            </h2>
            <p className="mt-1 text-sm text-[#727785] dark:text-slate-400">
              {formatAttendanceDate(sessionDate)}
              {displayedScheduleSlot
                ? ` · ${formatAttendanceTime(displayedScheduleSlot.startTime)}–${formatAttendanceTime(displayedScheduleSlot.endTime)}`
                : ''}
            </p>
          </div>
        </div>
        <span className={`inline-flex w-fit shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-bold ${diaryState.className}`}>
          {diaryState.label}
        </span>
      </header>

      {workloadQuery.data && (
        <section aria-label="Resumo de carga horária" className="mb-4 rounded-lg border border-[#dfe3e8] bg-[#f7f9fc] px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[#181c20] dark:text-white">Carga horária</h3>
            <span className="text-xs text-[#727785] dark:text-slate-400">Acompanhamento do período</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#727785] dark:text-slate-400">Carga prevista no período</p>
              <p className="mt-1 text-sm font-bold text-[#181c20] dark:text-white">{formatWorkloadMinutes(workloadQuery.data.plannedMinutes)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#727785] dark:text-slate-400">Realizada</p>
              <p className="mt-1 text-sm font-bold text-[#181c20] dark:text-white">{formatWorkloadMinutes(workloadQuery.data.deliveredMinutes)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#727785] dark:text-slate-400">Progresso do período</p>
              <p className="mt-1 text-sm font-bold text-[#181c20] dark:text-white">{workloadQuery.data.completionPercent === null ? 'Sem base' : `${workloadQuery.data.completionPercent}%`}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-[#dfe3e8] pt-2 text-xs text-[#727785] dark:border-slate-800 dark:text-slate-400">
            <span>Prevista até hoje: <strong className="text-[#181c20] dark:text-slate-200">{formatWorkloadMinutes(workloadQuery.data.plannedMinutesToDate)}</strong></span>
            <span>Ritmo até hoje: <strong className="text-[#181c20] dark:text-slate-200">{workloadQuery.data.deliveryVsPlanToDatePercent === null ? 'Sem base' : `${workloadQuery.data.deliveryVsPlanToDatePercent}%`}</strong></span>
          </div>
        </section>
      )}

      {offeringsQuery.isLoading && (
        <div className="rounded-lg border border-[#dfe3e8] p-5 text-sm text-[#727785] dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
          Carregando atribuições...
        </div>
      )}

      {offeringsQuery.isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
        >
          {getErrorMessage(offeringsQuery.error)}
        </div>
      )}

      {!offeringsQuery.isLoading &&
        !offeringsQuery.isError &&
        offerings.length === 0 && (
          <div className="rounded-lg border border-dashed border-[#c1c6d6] p-6 text-center text-sm text-[#727785] dark:border-slate-700 dark:text-slate-400">
            Nenhuma turma ou disciplina ativa vinculada ao professor.
          </div>
        )}

      {offerings.length > 0 && (
        <form
          className="space-y-5"
          onSubmit={handleSubmit}
        >
          <section aria-label="Contexto da aula" className="rounded-lg border border-[#dfe3e8] bg-[#f7f9fc] p-4 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(12rem,0.8fr)_minmax(14rem,0.9fr)] lg:items-start">
            <div className="min-w-0">
              <label
                htmlFor="attendance-offering"
                className="text-xs font-bold uppercase tracking-wide text-[#727785] dark:text-slate-400"
              >
                Atribuição
              </label>
              <select
                id="attendance-offering"
                value={selectedOfferingId}
                onChange={(event) => {
                  setSelectedOfferingId(
                    event.target.value,
                  );
                  setSelectedScheduleSlot(undefined);
                  setSelectionTouched(true);
                  setSuccessMessage('');
                }}
                className="mt-1 w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2.5 text-sm text-[#181c20] outline-none transition-colors focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                {offerings.map((offering) => (
                  <option
                    key={offering.id}
                    value={offering.id}
                  >
                    {formatSubjectOfferingLabel(offering)}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label
                htmlFor="attendance-date"
                className="text-xs font-bold uppercase tracking-wide text-[#727785] dark:text-slate-400"
              >
                Data
              </label>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-[#dfe3e8] bg-white px-3 py-2.5 focus-within:border-[#005bbf] focus-within:ring-2 focus-within:ring-blue-100 dark:border-slate-700 dark:bg-slate-900">
                <CalendarDays
                  className="h-4 w-4 text-[#727785] dark:text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="attendance-date"
                  lang="pt-BR"
                  type="date"
                  value={sessionDate}
                  min={termStartDate ?? undefined}
                  max={termEndDate ?? undefined}
                  onChange={(event) => {
                    setSessionDate(event.target.value);
                    setSelectedScheduleSlot(undefined);
                    setSuccessMessage('');
                    setDateAdjustmentMessage('');
                  }}
                  className="w-full bg-transparent text-sm text-[#181c20] outline-none dark:text-white"
                />
              </div>
            </div>

            <div className="min-w-0">
              <label className="text-xs font-bold uppercase tracking-wide text-[#727785] dark:text-slate-400">
                Horário da aula
              </label>
              {availableScheduleSlots.length > 1 ? (
                <select
                  id="attendance-schedule-slot"
                  aria-label="Horário da aula"
                  value={selectedScheduleSlot ? attendanceSlotKey(selectedScheduleSlot) : ''}
                  onChange={(event) => {
                    const nextSlot = availableScheduleSlots.find(
                      (slot) => attendanceSlotKey(slot) === event.target.value,
                    );
                    setSelectedScheduleSlot(nextSlot ? { startTime: nextSlot.startTime, endTime: nextSlot.endTime } : undefined);
                    setSuccessMessage('');
                  }}
                  className="mt-1 w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2.5 text-sm text-[#181c20] outline-none transition-colors focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  <option value="">Selecione o horário</option>
                  {availableScheduleSlots.map((slot) => (
                    <option key={attendanceSlotKey(slot)} value={attendanceSlotKey(slot)}>
                      {formatAttendanceTime(slot.startTime)} a {formatAttendanceTime(slot.endTime)}{slot.source === 'HISTORICAL' ? ' · Histórico' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="mt-1 flex min-h-[42px] items-center gap-2 rounded-lg border border-[#dfe3e8] bg-white px-3 py-2.5 text-sm text-[#181c20] dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                  <Clock3 className="h-4 w-4 shrink-0 text-[#727785] dark:text-slate-400" aria-hidden="true" />
                  {displayedScheduleSlot
                    ? `${formatAttendanceTime(displayedScheduleSlot.startTime)} a ${formatAttendanceTime(displayedScheduleSlot.endTime)}`
                    : 'Horário ainda não definido'}
                </div>
              )}
              {slotRequired && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  Escolha o horário da chamada para carregar os alunos.
                </p>
              )}
            </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-[#dfe3e8] pt-3 text-xs text-[#727785] dark:border-slate-800 dark:text-slate-400">
              {termStartDate && termEndDate && (
                <span>
                  Período {selectedOffering?.termName ? `"${selectedOffering.termName}" ` : ''}permitido: {formatAttendanceDate(termStartDate)} a {formatAttendanceDate(termEndDate)}.
                </span>
              )}
              {activeRollCall?.scheduleSlot && (
                <span className="flex items-center gap-1 font-medium text-[#005bbf] dark:text-blue-300">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  Aula prevista: {formatAttendanceTime(activeRollCall.scheduleSlot.startTime)} a {formatAttendanceTime(activeRollCall.scheduleSlot.endTime)}
                </span>
              )}
            </div>
          </section>

          <section aria-label="Registro do diário" className="grid gap-4 md:grid-cols-2">
            {[
              {
                id: 'diary-topic',
                label: 'Conteúdo ministrado',
                value: topic,
                setValue: setTopic,
                placeholder: 'Descreva o conteúdo trabalhado.',
              },
              {
                id: 'diary-activity',
                label: 'Atividade realizada',
                value: classActivity,
                setValue: setClassActivity,
                placeholder: 'Registre a atividade realizada.',
              },
              {
                id: 'diary-homework',
                label: 'Tarefa',
                value: homework,
                setValue: setHomework,
                placeholder: 'Registre a tarefa proposta.',
              },
              {
                id: 'diary-notes',
                label: 'Observações da aula',
                value: notes,
                setValue: setNotes,
                placeholder: 'Anote observações gerais da aula.',
              },
            ].map((field) => (
              <div key={field.id}>
                <label
                  htmlFor={field.id}
                  className={`text-xs font-bold uppercase tracking-wide ${field.id === 'diary-topic' || field.id === 'diary-activity' ? 'text-[#181c20] dark:text-slate-200' : 'text-[#727785] dark:text-slate-400'}`}
                >
                  {field.label}
                </label>
                <textarea
                  id={field.id}
                  value={field.value}
                  onChange={(event) => {
                    field.setValue(event.target.value);
                    setSuccessMessage('');
                  }}
                  disabled={editingDisabled}
                  rows={2}
                  placeholder={field.placeholder}
                  className="mt-1 w-full resize-y rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#181c20] outline-none transition-colors placeholder:text-[#8a93a3] focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-[#f7f9fc] dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:disabled:bg-slate-950"
                />
              </div>
            ))}
          </section>

          {activeRollCall?.session?.status === 'CLOSED' && (
            <div
              className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-300"
            >
              Aula finalizada. O diário e a chamada estão disponíveis somente para leitura.
            </div>
          )}

          {dateAdjustmentMessage && (
            <div
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
            >
              {dateAdjustmentMessage}
            </div>
          )}

          {historicalOnlySlot && (
            <div
              role="status"
              className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300"
            >
              Esta chamada pertence a um horário histórico que não está mais na grade publicada.
            </div>
          )}

          {calendarBlocked && (
            <div
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
            >
              <p className="font-bold">Aula suspensa</p>
              <p className="mt-1">
                {blockerLabels.length > 0
                  ? blockerLabels.join(' · ')
                  : 'Calendário Acadêmico'}
              </p>
              {historicalSession && (
                <p className="mt-2">
                  Esta data está atualmente bloqueada pelo Calendário Acadêmico, mas já existe uma chamada registrada.
                </p>
              )}
              {!historicalSession && (
                <p className="mt-2">
                  Aula suspensa — chamada não pode ser aberta.
                </p>
              )}
            </div>
          )}

          {rollCallQuery.isLoading && (
          <div className="rounded-lg border border-[#dfe3e8] p-5 text-sm text-[#727785] dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
              Carregando alunos...
            </div>
          )}

          {rollCallQuery.isError && (
            <div
              role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
            >
              {getErrorMessage(rollCallQuery.error)}
            </div>
          )}

          {activeRollCall &&
            !calendarBlocked &&
            activeRollCall.records.length === 0 && (
              <div className="rounded-lg border border-dashed border-[#c1c6d6] p-6 text-center text-sm text-[#727785] dark:border-slate-700 dark:text-slate-400">
                Nenhum aluno com matrícula ativa para esta data.
              </div>
            )}

          {activeRollCall &&
            calendarBlocked &&
            !historicalSession && (
              <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/50 p-6 text-center text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                Nenhuma chamada editável para esta aula suspensa.
              </div>
            )}

          {activeRollCall && (
              <section aria-labelledby="attendance-roll-call-heading">
                <div className="mb-3 flex flex-col gap-3 rounded-lg border border-[#dfe3e8] bg-[#f7f9fc] px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-950/50">
                  <div>
                    <h3 id="attendance-roll-call-heading" className="text-base font-bold text-[#181c20] dark:text-white">Chamada</h3>
                    <p className="mt-1 text-xs text-[#727785] dark:text-slate-400">
                      {activeRollCall.records.length} alunos{attendanceStatusSummary ? ` · ${attendanceStatusSummary}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={markAllPresent}
                    disabled={
                      records.length === 0 ||
                      saveMutation.isPending ||
                      editingDisabled
                    }
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#c8d4e3] px-3 py-2 text-sm font-semibold text-[#005bbf] transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto dark:border-slate-700 dark:text-blue-300 dark:hover:bg-blue-950/40"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Marcar presentes
                  </button>
                </div>
                {activeRollCall.records.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-[#dfe3e8] dark:border-slate-800">
                <div className="hidden grid-cols-[1.4fr_0.7fr_1fr] gap-3 bg-[#f7f9fc] px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#727785] dark:bg-slate-950/70 dark:text-slate-400 md:grid">
                  <span>Aluno</span>
                  <span>Status</span>
                  <span>Observação</span>
                </div>

                <div className="divide-y divide-[#eef1f5] dark:divide-slate-800">
                  {activeRollCall.records.map(
                    (record) => {
                      const editableRecord =
                        recordsByStudentId.get(
                          record.student.id,
                        );
                      const isDirty =
                        Boolean(editableRecord) &&
                        originalRecords.get(
                          record.student.id,
                        ) !==
                          getRecordKey(
                            editableRecord,
                          );

                      return (
                        <div
                          key={record.student.id}
                          className={`grid min-w-0 gap-3 px-3 py-3 md:grid-cols-[1.4fr_0.7fr_1fr] md:items-center sm:px-4 ${
                            isDirty
                              ? 'bg-amber-50/70 dark:bg-amber-950/20'
                              : 'bg-white dark:bg-slate-900'
                          }`}
                        >
                          <div>
                            <p className="text-sm font-semibold text-[#181c20] dark:text-white">
                              {record.student.fullName}
                            </p>
                            <p className="mt-1 text-xs text-[#727785] dark:text-slate-400">
                              Registro{' '}
                              {
                                record.student
                                  .registrationNumber
                              }
                              {isDirty && (
                                <span className="ml-1 inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                  Não salvo
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="min-w-0">
                            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#727785] dark:text-slate-400 md:hidden">
                              Status
                            </span>
                            <label
                              htmlFor={`attendance-status-${record.student.id}`}
                              className="sr-only"
                            >
                              Status de{' '}
                              {record.student.fullName}
                            </label>
                            <select
                              id={`attendance-status-${record.student.id}`}
                              value={
                                editableRecord?.status ??
                                record.status
                              }
                              disabled={editingDisabled}
                              onChange={(event) =>
                                updateRecord(
                                  record.student.id,
                                  {
                                    status:
                                      event.target
                                        .value as AttendanceStatus,
                                  },
                                )
                              }
                              className="w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            >
                              {ATTENDANCE_RECORD_STATUSES.map(
                                (status) => (
                                  <option
                                    key={status}
                                    value={status}
                                  >
                                    {
                                      ATTENDANCE_STATUS_LABELS[
                                        status
                                      ]
                                    }
                                  </option>
                                ),
                              )}
                            </select>
                          </div>

                          <div className="min-w-0">
                            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#727785] dark:text-slate-400 md:hidden">
                              Observação
                            </span>
                            <label
                              htmlFor={`attendance-notes-${record.student.id}`}
                              className="sr-only"
                            >
                              Observação de{' '}
                              {record.student.fullName}
                            </label>
                            <input
                              id={`attendance-notes-${record.student.id}`}
                              value={
                                editableRecord?.notes ?? ''
                              }
                              disabled={editingDisabled}
                              onChange={(event) =>
                                updateRecord(
                                  record.student.id,
                                  {
                                    notes:
                                      event.target.value,
                                  },
                                )
                              }
                              className="w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                              placeholder="Opcional"
                            />
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
                </div>
                )}
              </section>
            )}

          {saveMutation.isError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
            >
              {getErrorMessage(saveMutation.error)}
            </div>
          )}

          {successMessage && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-300">
              {successMessage}
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-[#dfe3e8] bg-white/95 pt-3 backdrop-blur-sm md:sticky md:bottom-0 md:z-10 md:flex-row md:items-center md:justify-between dark:border-slate-800 dark:bg-slate-900/95">
            <div role="status" aria-live="polite" className="text-xs font-semibold text-[#727785] dark:text-slate-400">
              {hasUnsavedChanges ? (
                <span className="inline-flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
                  Alterações não salvas
                </span>
              ) : (
                'Tudo salvo'
              )}
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => void saveDiary('SAVE_DRAFT')}
              disabled={
                saveMutation.isPending ||
                records.length === 0 ||
                !hasUnsavedChanges ||
                editingDisabled
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#005bbf] px-4 py-2 text-sm font-semibold text-[#005bbf] transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-950/40"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {saveMutation.isPending ? 'Salvando...' : 'Salvar rascunho'}
            </button>
            <button
              type="submit"
              aria-label="Finalizar aula (Salvar chamada)"
              disabled={
                saveMutation.isPending ||
                records.length === 0 ||
                !hasUnsavedChanges ||
                editingDisabled
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#004a99] disabled:cursor-not-allowed disabled:bg-[#9db9dc] sm:w-auto"
            >
              <Save
                className="h-4 w-4"
                aria-hidden="true"
              />
              {saveMutation.isPending
                ? 'Salvando...'
                : 'Finalizar aula'}
            </button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}
