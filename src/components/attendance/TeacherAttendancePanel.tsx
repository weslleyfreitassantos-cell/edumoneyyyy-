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
    calendarBlocked;
  const blockerLabels = calendarStatus
    ? getCalendarBlockerLabels(calendarStatus.blockers)
    : [];

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
    records.some(
      (record) =>
        originalRecords.get(record.studentId) !==
        getRecordKey(record),
    );

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

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (
      !profileId ||
      !institutionId ||
      !selectedOfferingId ||
      saveMutation.isPending ||
      records.length === 0
    ) {
      return;
    }

    await saveMutation.mutateAsync({
      institutionId,
      subjectOfferingId: selectedOfferingId,
      sessionDate,
      profileId,
      scheduleSlot: selectedScheduleSlot,
      records: records.map((record) => ({
        studentId: record.studentId,
        status: record.status,
        notes: record.notes,
      })),
    });

    setSuccessMessage('Chamada salva com sucesso.');
  };

  return (
    <section className="rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <ClipboardCheck
            className="h-5 w-5 text-[#005bbf]"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-lg font-bold text-[#181c20]">
              Chamada
            </h2>
            <p className="mt-1 text-sm text-[#727785]">
              {activeRollCall?.session
                ? 'Sessão carregada para correção.'
                : activeRollCall?.scheduleSlot
                  ? 'Aula encontrada na grade publicada.'
                : 'Sessão ainda não salva.'}
            </p>
          </div>
        </div>
      </div>

      {workloadQuery.data && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            [
              'Carga prevista no período',
              formatWorkloadMinutes(
                workloadQuery.data.plannedMinutes,
              ),
            ],
            [
              'Prevista até hoje',
              formatWorkloadMinutes(
                workloadQuery.data.plannedMinutesToDate,
              ),
            ],
            [
              'Realizada',
              formatWorkloadMinutes(
                workloadQuery.data.deliveredMinutes,
              ),
            ],
            [
              'Progresso do período',
              workloadQuery.data.completionPercent === null
                ? 'Sem base'
                : `${workloadQuery.data.completionPercent}%`,
            ],
            [
              'Ritmo até hoje',
              workloadQuery.data.deliveryVsPlanToDatePercent === null
                ? 'Sem base'
                : `${workloadQuery.data.deliveryVsPlanToDatePercent}%`,
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-[#dfe3e8] bg-[#f7f9fc] px-3 py-3"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-[#727785]">
                {label}
              </p>
              <p className="mt-1 text-base font-bold text-[#181c20]">
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      {offeringsQuery.isLoading && (
        <div className="rounded-lg border border-[#dfe3e8] p-5 text-sm text-[#727785]">
          Carregando atribuições...
        </div>
      )}

      {offeringsQuery.isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {getErrorMessage(offeringsQuery.error)}
        </div>
      )}

      {!offeringsQuery.isLoading &&
        !offeringsQuery.isError &&
        offerings.length === 0 && (
          <div className="rounded-lg border border-dashed border-[#c1c6d6] p-6 text-center text-sm text-[#727785]">
            Nenhuma turma ou disciplina ativa vinculada ao professor.
          </div>
        )}

      {offerings.length > 0 && (
        <form
          className="space-y-5"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(14rem,0.8fr)_auto] md:items-start">
            <div>
              <label
                htmlFor="attendance-offering"
                className="text-xs font-bold uppercase tracking-wide text-[#727785]"
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
                className="mt-1 w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#181c20] outline-none transition-colors focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
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

            <div>
              <label
                htmlFor="attendance-date"
                className="text-xs font-bold uppercase tracking-wide text-[#727785]"
              >
                Data
              </label>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 focus-within:border-[#005bbf] focus-within:ring-2 focus-within:ring-blue-100">
                <CalendarDays
                  className="h-4 w-4 text-[#727785]"
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
                  className="w-full bg-transparent text-sm text-[#181c20] outline-none"
                />
              </div>
              {availableScheduleSlots.length > 1 && (
                <div className="mt-3">
                  <label
                    htmlFor="attendance-schedule-slot"
                    className="text-xs font-bold uppercase tracking-wide text-[#727785]"
                  >
                    Horário da aula
                  </label>
                  <select
                    id="attendance-schedule-slot"
                    value={
                      selectedScheduleSlot
                        ? attendanceSlotKey(selectedScheduleSlot)
                        : ''
                    }
                    onChange={(event) => {
                      const nextSlot = availableScheduleSlots.find(
                        (slot) =>
                          attendanceSlotKey(slot) ===
                          event.target.value,
                      );

                      setSelectedScheduleSlot(
                        nextSlot
                          ? {
                              startTime: nextSlot.startTime,
                              endTime: nextSlot.endTime,
                            }
                          : undefined,
                      );
                      setSuccessMessage('');
                    }}
                    className="mt-1 w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#181c20] outline-none transition-colors focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Selecione o horário</option>
                    {availableScheduleSlots.map((slot) => (
                      <option
                        key={attendanceSlotKey(slot)}
                        value={attendanceSlotKey(slot)}
                      >
                        {formatAttendanceTime(slot.startTime)} a{' '}
                        {formatAttendanceTime(slot.endTime)}
                        {slot.source === 'HISTORICAL'
                          ? ' · Histórico'
                          : ''}
                      </option>
                    ))}
                  </select>
                  {slotRequired && (
                    <p className="mt-1 text-xs text-amber-700">
                      Escolha o horário da chamada para carregar os alunos.
                    </p>
                  )}
                </div>
              )}
              {termStartDate && termEndDate && (
                <p className="mt-1 text-xs text-[#727785]">
                  Período {selectedOffering?.termName ? `"${selectedOffering.termName}" ` : ''}permitido:{' '}
                  {formatAttendanceDate(termStartDate)} a{' '}
                  {formatAttendanceDate(termEndDate)}.
                </p>
              )}
              {activeRollCall?.scheduleSlot && (
                <p className="mt-1 flex items-center gap-1 text-xs font-medium text-[#005bbf]">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  Aula prevista:{' '}
                  {formatAttendanceTime(
                    activeRollCall.scheduleSlot.startTime,
                  )}{' '}
                  a{' '}
                  {formatAttendanceTime(
                    activeRollCall.scheduleSlot.endTime,
                  )}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={markAllPresent}
              disabled={
                records.length === 0 ||
                saveMutation.isPending ||
                editingDisabled
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#c8d4e3] px-4 py-2 text-sm font-semibold text-[#005bbf] transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 md:mt-5"
            >
              <CheckCircle2
                className="h-4 w-4"
                aria-hidden="true"
              />
              Marcar presentes
            </button>
          </div>

          {dateAdjustmentMessage && (
            <div
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
            >
              {dateAdjustmentMessage}
            </div>
          )}

          {historicalOnlySlot && (
            <div
              role="status"
              className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
            >
              Esta chamada pertence a um horário histórico que não está mais na grade publicada.
            </div>
          )}

          {calendarBlocked && (
            <div
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
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
            <div className="rounded-lg border border-[#dfe3e8] p-5 text-sm text-[#727785]">
              Carregando alunos...
            </div>
          )}

          {rollCallQuery.isError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {getErrorMessage(rollCallQuery.error)}
            </div>
          )}

          {activeRollCall &&
            !calendarBlocked &&
            activeRollCall.records.length === 0 && (
              <div className="rounded-lg border border-dashed border-[#c1c6d6] p-6 text-center text-sm text-[#727785]">
                Nenhum aluno com matrícula ativa para esta data.
              </div>
            )}

          {activeRollCall &&
            calendarBlocked &&
            !historicalSession && (
              <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/50 p-6 text-center text-sm text-amber-900">
                Nenhuma chamada editável para esta aula suspensa.
              </div>
            )}

          {activeRollCall &&
            activeRollCall.records.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-[#dfe3e8]">
                <div className="hidden grid-cols-[1.4fr_0.7fr_1fr] gap-3 bg-[#f7f9fc] px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#727785] md:grid">
                  <span>Aluno</span>
                  <span>Status</span>
                  <span>Observação</span>
                </div>

                <div className="divide-y divide-[#eef1f5]">
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
                          className={`grid gap-3 px-4 py-4 md:grid-cols-[1.4fr_0.7fr_1fr] md:items-center ${
                            isDirty
                              ? 'bg-amber-50/70'
                              : 'bg-white'
                          }`}
                        >
                          <div>
                            <p className="text-sm font-semibold text-[#181c20]">
                              {record.student.fullName}
                            </p>
                            <p className="mt-1 text-xs text-[#727785]">
                              Registro{' '}
                              {
                                record.student
                                  .registrationNumber
                              }
                              {isDirty
                                ? ' · não salvo'
                                : ''}
                            </p>
                          </div>

                          <div>
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
                              className="w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
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

                          <div>
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
                              className="w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
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

          {saveMutation.isError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {getErrorMessage(saveMutation.error)}
            </div>
          )}

          {successMessage && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700">
              {successMessage}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={
                saveMutation.isPending ||
                records.length === 0 ||
                !hasUnsavedChanges ||
                editingDisabled
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#004a99] disabled:cursor-not-allowed disabled:bg-[#9db9dc]"
            >
              <Save
                className="h-4 w-4"
                aria-hidden="true"
              />
              {saveMutation.isPending
                ? 'Salvando...'
                : 'Salvar chamada'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
